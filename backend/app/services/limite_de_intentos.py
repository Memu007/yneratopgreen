"""Freno de fuerza bruta para el ingreso.

El login aceptaba intentos ilimitados: treinta y un intentos seguidos con la
contraseña equivocada devolvían treinta y un 401 y la cuenta seguía entrando con
la contraseña buena. Acá está la pieza que cuenta esos fallos y contesta 429
cuando se pasan de la raya.

Dos ventanas deslizantes, que miden cosas distintas y por eso no se mezclan:

  · Por **correo**: cinco fallos en quince minutos. Protege a una cuenta puntual
    de que le prueben el diccionario. Un ingreso correcto antes del límite lo
    limpia, porque quien acertó demostró que la cuenta es suya.

  · Por **IP**: treinta fallos en diez minutos. Protege al padrón entero de que
    alguien pruebe una contraseña conocida contra muchas cuentas. Un acierto
    **no** lo limpia: si lo limpiara, bastaría con tener una credencial válida
    propia para reiniciar el contador entre tanda y tanda.

Lo que NO es: no hay bloqueo manual ni permanente. Vencida la ventana el intento
se vuelve a evaluar solo, sin que nadie destrabe nada.
"""
from __future__ import annotations

import threading
import time
from collections import OrderedDict, deque

# La política, en un solo lugar y sin variables de entorno: son números de
# seguridad, no de configuración. Que no se puedan aflojar desde el despliegue
# es parte de lo que se está arreglando.
FALLOS_POR_CORREO = 5
VENTANA_CORREO_SEGUNDOS = 15 * 60

FALLOS_POR_IP = 30
VENTANA_IP_SEGUNDOS = 10 * 60

# El estado vive en memoria y tiene que quedar acotado: sin tope, cualquiera que
# mande correos distintos hace crecer el diccionario para siempre. Primero se
# barren las ventanas vencidas —que es lo que sobra el 99% de las veces— y sólo
# si aun así no entra se descarta la clave más vieja.
MAXIMO_DE_CLAVES = 10_000

# Cada cuántas reservas se barren las ventanas vencidas de TODAS las claves. Es
# un barrido barato y espaciado: la clave que se toca se poda siempre, así que
# esto es sólo para las que nadie vuelve a tocar.
CADA_CUANTO_SE_BARRE = 256


class VentanaDeslizante:
    """Cuenta fallos por clave dentro de una ventana de tiempo.

    El reloj se inyecta para poder probar el vencimiento sin esperar quince
    minutos de verdad. Por defecto es `time.monotonic`, que no salta si alguien
    ajusta la hora de la máquina.

    Todo lo que toca el estado pasa por un candado. El endpoint de login corre
    en el pool de hilos de Starlette —es una función `def`, no `async def`—, así
    que dos pedidos simultáneos son dos hilos de verdad.
    """

    def __init__(self, permitidos: int, ventana_segundos: float, reloj=time.monotonic):
        self._permitidos = permitidos
        self._ventana = ventana_segundos
        self._reloj = reloj
        # clave -> deque de (ficha, instante). `OrderedDict` para poder tirar la
        # más vieja cuando se llega al tope.
        self._fallos: "OrderedDict[str, deque]" = OrderedDict()
        self._candado = threading.Lock()
        self._proxima_ficha = 0
        self._reservas_hechas = 0

    # -- lo que usa el endpoint ---------------------------------------------

    def reservar(self, clave: str):
        """Mira y anota en un solo paso, sin soltar el candado en el medio.

        Devuelve `(espera, None)` si la clave ya está limitada —`espera` es lo
        que falta para que la ventana se corra—, o `(None, ficha)` si el intento
        puede seguir. La ficha sirve para devolver la marca si el intento
        termina NO siendo un fallo de credenciales.

        Anotar antes de saber el resultado es a propósito: si se anotara
        después, dos pedidos simultáneos leerían el contador al borde del límite,
        los dos pasarían y el umbral se cruzaría por una carrera.
        """
        with self._candado:
            ahora = self._reloj()
            self._podar(clave, ahora)
            marcas = self._fallos.get(clave)
            if marcas is not None and len(marcas) >= self._permitidos:
                # Falta lo que le queda de vida a la marca más vieja: cuando esa
                # se caiga, el contador vuelve a estar por debajo del límite.
                return self._ventana - (ahora - marcas[0][1]), None
            return None, self._anotar(clave, ahora)

    def devolver(self, clave: str, ficha) -> None:
        """Saca una marca reservada: el intento no fue un fallo de credenciales."""
        if ficha is None:
            return
        with self._candado:
            marcas = self._fallos.get(clave)
            if not marcas:
                return
            for indice, (guardada, _) in enumerate(marcas):
                if guardada == ficha:
                    del marcas[indice]
                    break
            if not marcas:
                self._fallos.pop(clave, None)

    def olvidar(self, clave: str) -> None:
        """Borra el contador de una clave. Lo usa el ingreso correcto."""
        with self._candado:
            self._fallos.pop(clave, None)

    # -- mantenimiento y observación ----------------------------------------

    def olvidar_vencidos(self) -> int:
        """Barre las ventanas vencidas. Devuelve cuántas claves se fueron."""
        with self._candado:
            return self._barrer(self._reloj())

    def claves(self) -> int:
        with self._candado:
            return len(self._fallos)

    def fallos_de(self, clave: str) -> int:
        """Cuántos fallos vigentes tiene una clave. Sólo para pruebas y medición."""
        with self._candado:
            self._podar(clave, self._reloj())
            return len(self._fallos.get(clave, ()))

    def vaciar(self) -> None:
        with self._candado:
            self._fallos.clear()

    # -- adentro, siempre con el candado tomado ------------------------------

    def _podar(self, clave: str, ahora: float) -> None:
        marcas = self._fallos.get(clave)
        if marcas is None:
            return
        limite = ahora - self._ventana
        while marcas and marcas[0][1] <= limite:
            marcas.popleft()
        if not marcas:
            del self._fallos[clave]

    def _anotar(self, clave: str, ahora: float):
        self._reservas_hechas += 1
        if self._reservas_hechas % CADA_CUANTO_SE_BARRE == 0:
            self._barrer(ahora)

        marcas = self._fallos.get(clave)
        if marcas is None:
            self._hacer_lugar(ahora)
            marcas = deque()
            self._fallos[clave] = marcas
        self._fallos.move_to_end(clave)

        self._proxima_ficha += 1
        ficha = self._proxima_ficha
        marcas.append((ficha, ahora))
        return ficha

    def _barrer(self, ahora: float) -> int:
        limite = ahora - self._ventana
        vencidas = []
        for clave, marcas in self._fallos.items():
            while marcas and marcas[0][1] <= limite:
                marcas.popleft()
            if not marcas:
                vencidas.append(clave)
        for clave in vencidas:
            del self._fallos[clave]
        return len(vencidas)

    def _hacer_lugar(self, ahora: float) -> None:
        if len(self._fallos) < MAXIMO_DE_CLAVES:
            return
        self._barrer(ahora)
        # Si el barrido no alcanzó, se tira la más vieja. Perder un contador es
        # peor que quedarse sin memoria, pero no es lo mismo que no tener
        # ninguno: el límite por correo sigue cubriendo a cada cuenta.
        while len(self._fallos) >= MAXIMO_DE_CLAVES:
            self._fallos.popitem(last=False)


# Las dos instancias que usa el login.
POR_CORREO = VentanaDeslizante(FALLOS_POR_CORREO, VENTANA_CORREO_SEGUNDOS)
POR_IP = VentanaDeslizante(FALLOS_POR_IP, VENTANA_IP_SEGUNDOS)


def clave_de_correo(correo: str) -> str:
    """Normaliza el correo para que no haya un contador por cada forma de
    escribirlo. `Vendedor@Ejemplo.com` y `vendedor@ejemplo.com ` son el mismo.
    """
    return (correo or "").strip().lower()


def clave_de_ip(request) -> str:
    """De dónde viene el pedido, sin creerle a un header que escribe el cliente.

    Acá hay una trampa medida, no supuesta. Uvicorn trae `proxy_headers=True`
    **por defecto** —no hace falta la bandera— y con `forwarded_allow_ips` sin
    fijar confía en el par local, así que **reescribe** `request.client.host`
    con lo que venga en `X-Forwarded-For`. Medido contra el servidor de la
    suite, que arranca sin ninguna bandera de proxy:

        sin headers                          -> client.host = 127.0.0.1
        con `X-Forwarded-For: 203.0.113.99`  -> client.host = 203.0.113.99

    Y `backend/railway-entrypoint.sh` va más lejos: `--forwarded-allow-ips="*"`,
    o sea que en el despliegue confía en cualquiera. Conclusión: `client.host`
    es, en los dos entornos, un dato que puede escribir quien ataca. Un contador
    montado sobre eso no existe: bastaría con cambiar el header en cada intento.

    Por eso la identidad se elige según dónde está corriendo esto:

    · **Detrás del borde de Railway** se usa `X-Real-IP`, que lo escribe la
      plataforma. Si llega repetido o no llega, no se inventa una identidad: van
      todos a una misma bolsa. Contar de más es preferible a no contar.

    · **Fuera del borde** —desarrollo y la suite— se usa `client.host`, pero
      sólo si el pedido NO trae `X-Forwarded-For`. Si lo trae, `client.host`
      salió de ahí y no sirve como identidad, así que también van todos a una
      misma bolsa. Acá no hay proxy legítimo delante, de modo que ese header es
      siempre alguien probando suerte.
    """
    repetido_o_ausente = "identidad-no-confiable"
    if _detras_del_borde():
        reales = request.headers.getlist("x-real-ip")
        if len(reales) != 1:
            return repetido_o_ausente
        return reales[0].strip() or repetido_o_ausente
    if request.headers.getlist("x-forwarded-for"):
        return repetido_o_ausente
    cliente = getattr(request, "client", None)
    return getattr(cliente, "host", None) or "sin-cliente"


def _detras_del_borde() -> bool:
    # Se importa acá adentro para que el módulo se pueda leer y probar sin
    # arrastrar la configuración entera.
    from app.core.config import settings

    return (settings.ENV or "").strip().lower() == "production"
