# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-22. Decimoctavo informe: **el CSRF, cerrado — y una premisa mía
que se cayó**.

Commit de producto `6ece3fb`. Tus dos correcciones eran correctas y una de
ellas me evitó dejar abierto justo lo que estaba cerrando. Pero hay algo más
grande: **`SameSite=Lax` no se puede usar**, y lo descubrí midiendo. Va primero,
porque de eso depende un criterio tuyo.

## 1. Tus dos correcciones, comprobadas

**La del refresco tenía razón y era grave.** `/auth/refresh` no pasa por la
dependencia de acceso: llama a `credencial_unica` directo (`auth.py:390`). Con
mi propuesta original, renovar —que **emite credenciales nuevas**, o sea que es
una mutación— seguía siendo disparable con la cookie sola. Mi propio criterio 4
habría fallado contra mi propia implementación.

**La de `credentials: 'include'` también, y la medí antes de aceptarla:**

| Modo | Resultado del alta de sesión entre sitios |
|---|---|
| `credentials: 'include'` | login 200 · **2 cookies guardadas** |
| `credentials: 'same-origin'` | login 200 · **0 cookies** ← el navegador ignoró `Set-Cookie` |
| `credentials: 'omit'` | login 200 · **0 cookies** ← ídem |

Sacarlo habría dejado al callback de Mercado Pago sin cookie que reconocer. No
toqué una línea del frontend.

## 2. Lo que se cayó: `SameSite=Lax` no se puede usar acá

Tu criterio 1 pide que ninguna cookie salga con `SameSite=None`. **No lo
cumplí, y no es por comodidad.**

Medido, con control, cambiando **una sola** variable —si la página y la API son
el mismo sitio— contra la misma API emitiendo la misma cookie `Lax`:

```
MISMO sitio     (página 127.0.0.1:5173 → API 127.0.0.1:8000)
   login 200 · cookies guardadas: 2 (access_token SameSite=Lax, refresh_token SameSite=Lax)

sitios DISTINTOS (página localhost:5173 → API 127.0.0.1:8000)
   login 200 · cookies guardadas: 0  ← el navegador DESCARTÓ el Set-Cookie
```

`SameSite=Lax` no gobierna sólo cuándo se **manda** una cookie: gobierna
también cuándo se **guarda**. Entre sitios distintos, un `Set-Cookie` marcado
`Lax` se descarta. En producción la página está en `ynerav.up.railway.app` y la
API en otro dominio, así que con `Lax` **la cookie nunca llegaría a existir**, y
la vuelta de Mercado Pago se quedaría sin a quién reconocer.

### Dónde me equivoqué yo

Esto contradice la evidencia que te llevé en el informe anterior, y el error es
mío y es concreto: **para probar `Lax` inyecté la cookie en el navegador con
`addCookies`**, que la escribe de prepo y **saltea justamente la regla de
guardado**. Después medí sólo si viajaba. Probé la mitad del camino y la
presenté como el camino entero. La conclusión «con Lax el ataque muere y el
callback sobrevive» era verdadera sobre una cookie que en producción no habría
existido.

## 3. Y sin embargo el ataque está cerrado

Porque lo que lo cierra no es el atributo. Lo medí en el navegador, con la
cookie **plenamente ambiental** (`SameSite=None`, guardada y viajando) contra el
código de este commit:

```
cookies guardadas: 2 access_token SameSite=None, refresh_token SameSite=None
la función de ataque existe: function
resultado: la petición SALIÓ y CORS tapó la respuesta (TypeError)

filas de documentación escritas: 0
el servidor:  POST /api/documentacion → 401 Unauthorized
```

La petición salió, llegó al servidor, y **el servidor la rechazó**. La mitad
estructural hace todo el trabajo; `Lax` no aportaba nada que ésta no diera, y
encima rompía la vinculación.

**Lo dejé en `None` y freno acá, como pediste.** No cambio tu criterio por mi
cuenta: te traigo la medición y la decisión es tuya.

## 4. Qué quedó implementado

| Archivo | Cambio |
|---|---|
| `dependencies.py` | `token_del_header` reemplaza a `get_token_from_cookie_or_header`: rutas protegidas, sólo `Authorization` |
| `dependencies.py` | se **borra** `credencial_unica`, que era la que aceptaba la cookie |
| `dependencies.py` | `get_current_user_optional` conserva la cookie: único lector, para el callback |
| `auth.py` | `/auth/refresh` lee sólo la cabecera |
| `auth.py` | el borrado de cookies emite los mismos atributos que la emisión |
| `src/` | **sin cambios**, como indicaste |

Borré `credencial_unica` en vez de dejarla sin uso: una función que sigue ahí
es una que alguien vuelve a enchufar sin enterarse de por qué se había dejado
de usar.

## 5. Rutas, credencial aceptada y resultado

| Ruta | Cookie sola | Cabecera sola |
|---|---|---|
| `GET /auth/me` y toda ruta protegida | **401** | 200 |
| `POST /cart/sync` | **401**, sin tocar el carrito | 200 |
| `POST /documentacion` (multipart) | **401**, 0 filas escritas | 201 |
| `POST /products/{id}/images` (multipart) | **401**, 0 imágenes | 200 |
| `POST /orders/{id}/transfer-receipt` (multipart) | **401**, sin adjuntar | 200 |
| `POST /auth/refresh` | **401**, 0 cookies emitidas | 200, emite 2 |
| `GET /mp-oauth/callback` | **reconoce al dueño** (es su único uso) | no aplica: navegación sin cabecera |

Con las dos credenciales presentes manda la cabecera. Ya no hay contradicción
que resolver, porque no hay dos fuentes: hay una.

## 6. Un defecto que apareció solo

Reescribiendo las pruebas encontré que **el cierre de sesión no borraba las
cookies en el navegador cruzado**. El caso 117 contra el commit anterior falla
con «cerrar sesión dejó 2 cookies».

En el informe pasado te dije que el borrado funcionaba «aunque los atributos no
coincidieran». **Eso estaba mal y lo medí mal**: lo probé con `curl`, que no
aplica las reglas de cookies del navegador. Un `Set-Cookie` de borrado marcado
`Lax` sale por la misma puerta que la de arriba: entre sitios, se descarta. La
sesión seguía viva en el navegador después de salir. Con el borrado alineado a
la emisión, se borra.

## 7. Evidencia

| Caso | Qué prueba | Contra `717f40b` |
|---|---|---|
| 49 (reescrito) | la cookie sola no autentica, ni para leer ni para escribir | **falla**: «la cookie sola autenticó: HTTP 200» |
| 50 (reescrito) | renovar sólo con cabecera | **falla**: «la cookie sola renovó: HTTP 200» |
| 116 (nuevo) | las cuatro mutaciones del ataque, con cookie sola | **falla**: «devolvió HTTP 201 en vez de 401» |
| 117 (nuevo) | ciclo de la cookie en navegador cruzado + vuelta de MP | **falla**: «cerrar sesión dejó 2 cookies» |

| Puerta | Resultado |
|---|---|
| **Suite completa desde base limpia** | **117/117, 0 fallas** |
| Build | limpio |
| Sintaxis Python | limpio |
| `diff --check` | limpio |

Seis guiones que corren dentro de la API se autenticaban por cookie y pasaron a
cabecera. **No les saqué la cookie**: el callback de Mercado Pago la necesita, y
el caso 117 lo comprueba de punta a punta.

## 8. Lo que decidís vos

**Una sola pregunta: qué hacemos con `SameSite`.** Las tres salidas que veo, y
mi recomendación:

1. **Dejarlo en `None`** (lo que está). El ataque queda cerrado igual y la
   vinculación funciona. Es lo que recomiendo.
2. Pasar a `Lax` y **aceptar que la vinculación con Mercado Pago se rompe**
   hasta que frontend y Backend compartan sitio. No lo recomiendo.
3. Rediseñar el callback para que no necesite la cookie. Es alcance nuevo y no
   lo abro.

Cuando tengamos `topgreen.com` y `api.topgreen.com` pasan a ser el mismo sitio
y `Lax` se vuelve posible. Nada de esto habría que rehacerlo.

## 9. Riesgos

1. **Criterio 1 sin cumplir**, dicho arriba y con la medición.
2. **Acotar la cookie por `path` a `/api/mp-oauth` sería un cierre extra** —el
   navegador no la mandaría a ninguna otra ruta—. **No lo propongo porque no lo
   medí**: acabo de equivocarme por proponer algo que no había medido entero, y
   no lo voy a repetir en el mismo informe.
3. **Sigue sin haber revocación al cerrar sesión.** Ahora el navegador sí
   pierde las cookies, pero el token sigue siendo válido hasta que vence.
4. **No desplegué nada**, como pediste.

Todo lo ofensivo quedó local y acotado: el sitio de prueba se apagó y se borró,
y no toqué Railway.

Freno acá.
