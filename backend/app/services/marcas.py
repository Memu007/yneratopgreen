"""Que categorias declaran marca, y cual es la lista.

**No se deduce de la anatomia.** `activo` incluye «Tierras y parcelas» y
«Bienes y Ganado», y ni un campo ni un ternero tienen marca. Tampoco alcanza
con «vende cosas fabricadas»: un herbicida tiene marca, pero no es ninguna de
las que hay cargadas, que son de maquinaria. Ofrecer esta lista dentro de
«Insumos agricolas» seria el mismo defecto que ofrecerla para un campo.

Por eso arranca en una sola categoria. Ampliarla a otra es cargar la lista de
esa otra categoria, y es una decision de producto, no un renglon mas aca.

Este modulo decide el valor POR OMISION que escribe la semilla. Lo que manda en
caliente es `categories.usa_marca`, que la clienta edita desde el panel.

Y resuelve «Otra marca»: la que escribe quien publica cuando no esta en la
lista (decision de Emi, 01/10). Se guarda como una opcion mas de la misma
lista, asi que el filtro, la ficha y el alta la tratan igual que a las
cargadas, y las que ya existian no cambian.
"""
import re
import unicodedata
import uuid
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db.base import SessionLocal
from app.models.form_option import FormOption

MARCA_MINIMO = 2
MARCA_MAXIMO = 40

# El candado de las marcas escritas. Dos altas que escriben la misma marca
# nueva a la vez tienen que terminar en UNA: sin el candado, las dos buscan,
# no la encuentran y la crean. La tabla no tiene un indice unico que lo
# impida, y agregarlo exigiria tocar las opciones que ya existen.
CANDADO_DE_MARCAS = 1_010_200_101

# Cuanto espera una marca escrita a que otra suelte el candado. Lo tiene
# apenas lo que tarda en buscar y crear una fila; si pasa de esto, algo anda
# mal, y es mejor un error que esperar para siempre.
ESPERA_DEL_CANDADO = "5s"


def _sin_acentos(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii").lower()


def orden_de_marca(opcion: FormOption):
    """Donde va una marca en la lista: su orden, y a igual orden, su nombre.

    El nombre se compara sin mayusculas ni acentos, y en Python, no en la
    base: la base local ordena bytes («Zeta» antes que «agromec») y la de
    produccion puede no hacerlo, y una marca escrita en minuscula tiene que
    caer en el mismo lugar en las dos.
    """
    return (opcion.display_order or 0, _sin_acentos(opcion.label))


def clave_de_marca(texto: str) -> str:
    """Lo que hace iguales a dos marcas: sin mayusculas, acentos ni espacios.

    Tambien sin guiones ni puntos: «Deutz-Fahr» y «Deutz Fahr», o «John
    Deere» y «johndeere», son la misma marca escrita de dos formas.
    """
    return re.sub(r"[^a-z0-9]", "", _sin_acentos(texto))


def limpiar_marca(texto: str) -> str:
    """El nombre como se escribio, sin espacios de mas."""
    return " ".join(texto.split())


def marca_escrita(nombre: str) -> str:
    """El `value` de la marca escrita: la que ya existe, o una nueva.

    Si coincide con una de la lista —activa o no— se usa esa y no se crea
    otra. Una dada de baja no se reactiva desde un alta: se rechaza, como se
    rechaza elegirla de la lista.

    Si es nueva, entra a la lista con el nombre como se escribio, en su lugar
    alfabetico y sin mover a las demas: toma el orden de la que le sigue, y el
    empate se resuelve por nombre, que es como se ordena la lista.

    **Se resuelve en una transaccion propia, corta, y se confirma aca.** El
    candado no puede vivir en la transaccion de la publicacion. Medido: una
    alta con «Otra marca» que despues fallaba por otro dato lo dejaba tomado
    hasta cerrar su sesion, y otra alta con «Otra marca» lo esperaba sin
    soltar el proceso —las rutas son `async` y la base se llama sin `await`—,
    asi que la sesion de la primera nunca se cerraba: la API entera dejaba de
    responder. Por eso quien llama la resuelve despues de validar todo lo
    demas, y una alta rechazada no deja su marca.
    """
    nombre = limpiar_marca(nombre)
    clave = clave_de_marca(nombre)
    db = SessionLocal()
    try:
        db.execute(text(f"SET LOCAL lock_timeout = '{ESPERA_DEL_CANDADO}'"))
        db.execute(text("SELECT pg_advisory_xact_lock(:candado)"), {"candado": CANDADO_DE_MARCAS})
        valor = _buscar_o_crear(db, nombre, clave)
        db.commit()
        return valor
    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar la marca en este momento. Probá de nuevo.",
        )
    finally:
        # Sin `commit`, cerrar deshace la transaccion y suelta el candado.
        db.close()


def _buscar_o_crear(db, nombre: str, clave: str) -> str:
    """La que coincide, o una nueva; con el candado ya tomado."""
    opciones = db.query(FormOption).filter(FormOption.option_type == "brand").all()
    for opcion in opciones:
        if clave in (clave_de_marca(opcion.label), clave_de_marca(opcion.value)):
            if not opcion.is_active:
                raise HTTPException(
                    status_code=400,
                    detail=f"La marca «{opcion.label}» no está disponible. Elegí otra.",
                )
            return opcion.value

    valor = re.sub(r"[^a-z0-9]+", "-", _sin_acentos(nombre)).strip("-")
    usados = {opcion.value for opcion in opciones}
    base, numero = valor, 2
    while valor in usados:
        valor, numero = f"{base}-{numero}", numero + 1

    activas = sorted((opcion for opcion in opciones if opcion.is_active), key=orden_de_marca)
    siguiente = next(
        (opcion for opcion in activas if _sin_acentos(opcion.label) > _sin_acentos(nombre)),
        None,
    )
    if siguiente is not None:
        orden = siguiente.display_order or 0
    else:
        orden = max((opcion.display_order or 0 for opcion in opciones), default=-1) + 1

    db.add(FormOption(
        id=str(uuid.uuid4()),
        option_type="brand",
        value=valor,
        label=nombre,
        display_order=orden,
        is_active=True,
    ))
    return valor


CATEGORIAS_CON_MARCA = frozenset({
    "maquinaria-agricola",
})


def usa_marca_por_categoria(
    slug_de_categoria: Optional[str],
    categoria_es_servicio: bool,
) -> bool:
    """¿Esta categoria ofrece marca?

    Una categoria de servicio no la ofrece nunca: un asesoramiento no tiene
    marca. Se comprueba aunque hoy ninguna figure en la lista, porque la lista
    se edita y un error ahi no puede convertir un servicio en una maquina.
    """
    if categoria_es_servicio:
        return False
    return slug_de_categoria in CATEGORIAS_CON_MARCA
