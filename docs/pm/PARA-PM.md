# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PUBLICACIONES-PRUEBA-1: frenada en el paso 1

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
