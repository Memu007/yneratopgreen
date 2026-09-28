# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PUBLICACIONES-PRUEBA-1: frenada en el paso 2

**Actualización (28/09, 18:50).** Emi me pasó a la terminal de su Mac, por
decisión suya. **Desde esa red llego al sitio:** el frontend y
`/api/health` responden 200.

**Frené en el paso 2: no hay cuenta de prueba, y Emi no tiene una cuenta de
administración en producción para crearla.** La siembra no corre ahí, así
que `admin@topgreen.com` no existe en el sitio publicado. Crear una cuenta de
administración pide la base o Railway, y las dos cosas las prohíbe la tarea.
No toqué nada: ni Railway, ni la base, ni cuentas.

**Lo que decidís vos** (o Emi):

1. **Cómo se consigue la cuenta de prueba en producción.** La plataforma
   tiene dos caminos, y los dos están cerrados:
   - registrarse, que pide confirmar el correo, y el correo (#15) no anda;
   - crearla desde el panel, que pide una cuenta de administración.
2. **O esperar al correo:** con el correo andando, Emi se registra como
   cualquiera y la tarea sigue igual.

Mientras tanto no cargo nada.

---

### Primer informe: frenada en el paso 1

**Resultado: desde mi red no llego a `railway.app`.** El proxy del entorno
contesta 403 a los dos hosts. No cargué nada, no pedí la cuenta y no recibí
contraseña ni token: no hay nada que borrar en ningún lado.

**Evidencia.** El 28/09, desde el entorno en la nube de la Dev:

```bash
curl -sS -m 20 -o /dev/null https://yneratopgreen-production.up.railway.app
# curl: (56) CONNECT tunnel failed, response 403
curl -sS -m 20 -o /dev/null https://backend-production-ba84.up.railway.app/api/health
# curl: (56) CONNECT tunnel failed, response 403
```

El registro del proxy dice, para los dos hosts: «gateway answered 403 to
CONNECT (policy denial or upstream failure)». Es la política de red del
entorno. No lo rodeé.

**Qué hace falta, y lo decide Emi.** Son dos caminos:

1. **Emi habilita esos dos hosts** en la configuración de red del entorno de
   la Dev: en claude.ai/code, el menú del entorno en la barra de la sesión,
   «Editar», y en «Network access» agregar
   `yneratopgreen-production.up.railway.app` y
   `backend-production-ba84.up.railway.app` a los dominios permitidos. Con
   eso retomo desde el paso 2.
2. **Emi las carga a mano**, como estaba decidido el 27/09. Si querés, reviso
   los filtros después desde el código y ella me pasa lo que ve.

Mientras tanto no hay nada de esta tarea que se pueda hacer sin el sitio.

**Tu detalle sobre `REINICIAR_API`:** anotado. La próxima vez pongo el
reinicio por omisión y el de Docker sólo como ejemplo.

---

## COBRO-CONCURRENTE-1

Aceptada en rama sobre `599dded`. Sin cambios.
