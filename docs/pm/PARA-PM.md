# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-22. Decimoséptimo informe: **consulta de arquitectura sobre CSRF
y tokens**. No toqué una línea de código ni ningún otro documento.

**El riesgo es explotable hoy y lo reproduje entero.** Desde un sitio ajeno, en
un navegador de verdad, le reemplacé a un vendedor su documentación fiscal
aprobada. Va todo abajo.

## 1. Riesgo real, con archivos y líneas

### 1.1 CSRF: explotable, demostrado

Tres piezas que por separado parecen razonables:

| Dónde | Qué hace |
|---|---|
| `backend/app/api/auth.py:254-269` (ingreso) y `:432-447` (refresco) | emite `access_token` y `refresh_token` como cookies `HttpOnly; Secure; SameSite=None` |
| `backend/app/core/dependencies.py:69-90` | `get_token_from_cookie_or_header` acepta **la cookie sola** como credencial de cualquier ruta protegida |
| `backend/app/main.py:40-47` | CORS con `allow_credentials=True` y una lista de orígenes |

`SameSite=None` significa, textualmente, *mandá esta cookie en toda petición
entre sitios*. Y como la cookie sola alcanza para autenticar, cualquier sitio
que la víctima visite puede actuar en su nombre.

**Lo que CORS no hace.** CORS no impide que la petición salga ni que el
servidor la ejecute: impide que el atacante **lea la respuesta**. Es la
diferencia entre no poder ver el resultado y no poder causarlo. Pedí una lista
de comprobación de esto y acá está medida:

```
1. la víctima inicia sesión en el sitio real: 200
2. la víctima abre otro sitio: http://localhost:9099
   · token en su localStorage ahí: null        ← el atacante no tiene ningún token
3. la petición del sitio ajeno: "Failed to fetch"  ← CORS le tapó la RESPUESTA

documentación del vendedor ANTES:   Campo Verde SRL · APROBADA
documentación del vendedor DESPUÉS: Robada Por CSRF SRL · PENDIENTE
```

El registro del servidor lo confirma: `POST /api/documentacion → 201 Created`.

Daño concreto: el vendedor **pierde el distintivo «Documentación revisada»** y
te queda en la cola de administración un papel falso a su nombre, presentado
por una página que él sólo visitó.

### 1.2 Por dónde entra, exactamente

No entra por todos lados, y la diferencia importa para dimensionar la
corrección. Una petición entre sitios sólo evita la verificación previa si su
tipo de contenido es de los «simples». Lo medí:

| Prueba | Resultado |
|---|---|
| ruta JSON con `Content-Type: text/plain` (simple) | **422**: FastAPI no interpreta ese cuerpo. No entra |
| ruta JSON con `application/json` | 200 por consola, pero en un navegador **hay verificación previa** y el origen ajeno no está permitido |
| ruta `multipart/form-data` | **entra**: es tipo simple, no hay verificación previa |

Así que la superficie explotable son las rutas que aceptan formulario, que son
exactamente tres, más el refresco:

| Ruta | Archivo | Qué logra el atacante |
|---|---|---|
| `POST /api/documentacion` | `documentacion.py:210-213` | **reemplazar la documentación fiscal**, tirando abajo el distintivo |
| `POST /api/orders/{id}/transfer-receipt` | `orders.py:302-304` | subir un comprobante falso a una orden ajena |
| `POST /api/products/{id}/images` | `products.py:115-117` | meter imágenes en publicaciones de la víctima |
| `POST /api/auth/refresh` | `auth.py:378` | **200 y dos cookies nuevas**: es un POST sin cuerpo ni cabeceras propias, o sea simple. Renueva la sesión ajena en silencio |

No hay ninguna ruta `GET` que mute estado, así que no hay vector por `<img>`.

### 1.3 XSS: el riesgo es real pero **no** es el que se citó

Los tokens viven en `localStorage` (`src/utils/api.ts:14-26`). Es cierto que un
XSS los roba. Pero busqué el sumidero y **no hay ninguno**: cero
`dangerouslySetInnerHTML` y cero asignaciones a `innerHTML` en todo `src/`.

Con eso quiero ser honesto en las dos direcciones. **Una:** hoy no tenemos una
vía de XSS propia, así que el riesgo de `localStorage` es hipotético y depende
de una dependencia comprometida. **Dos:** el CSRF de arriba **no es
hipotético, lo ejecuté**. Si hay que gastar esfuerzo en un solo lugar, no es
en mover los tokens.

Y hay algo peor que cualquiera de las dos opciones por separado: **hoy
tenemos las dos superficies y el beneficio de ninguna.** Los tokens están en
`localStorage` —con su riesgo de XSS— *y además* viajan como cookie ambiental
—con su riesgo de CSRF—, porque `src/utils/api.ts:66,165,270` manda
`credentials: 'include'` en todo y encima el `Authorization`.

### 1.4 Dos cosas más que encontré mirando esto

- **El cierre de sesión no revoca nada.** `auth.py:371-372` borra las cookies
  del navegador y listo: no hay lista de revocación en ningún lado. Un token
  filtrado sirve **24 horas** (acceso) y el de refresco **30 días**
  (`config.py:35-36`). Cerrar sesión no lo acorta.
- **La cookie de borrado no coincide en atributos** con la que se emitió
  (`SameSite=lax` y sin `Secure`, contra `SameSite=none; Secure`). Lo probé y
  **igual borra**, porque el navegador identifica la cookie por nombre, dominio
  y ruta. Lo digo para que no figure como hallazgo: no lo es.

## 2. Las tres opciones

| | Bearer/localStorage solo | Sólo cookies | Híbrido mínimo |
|---|---|---|---|
| CSRF | **imposible**: no hay credencial ambiental | hay que agregar token CSRF o validar `Origin` en toda ruta mutadora | **imposible en las rutas mutadoras**, si la cookie no las autentica |
| XSS | el token es robable | la cookie no es legible por script | el token es robable |
| Vuelta de Mercado Pago | **se rompe** | funciona | funciona |
| Tamaño del cambio | medio, y rompe algo que anda | grande | **una palabra en cuatro lugares, más una función** |

La columna que decide es la tercera. `GET /api/mp/callback`
(`mp_oauth.py:106-113`) es una **navegación de nivel superior** que dispara
Mercado Pago: ninguna cabecera puede acompañarla. Su única forma de saber qué
navegador volvió es la cookie, vía `get_current_user_optional`
(`dependencies.py:211-233`), que lee **sólo** la cookie.

Por eso «sacar la cookie» no es la respuesta: **la cookie no es peso muerto,
tiene exactamente un uso legítimo.** Ese callback, además, ya está protegido
contra CSRF por su `state` de un solo uso, que se gasta y se compara contra la
identidad del navegador (`mp_oauth.py:131-148`).

## 3. Recomendación única

**`SameSite=None` → `SameSite=Lax`, y que la cookie deje de autenticar rutas
mutadoras.** Nada de token CSRF. Nada de validar `Origin`.

No te lo propongo por doctrina: monté las dos conductas en el navegador,
cambiando **sólo el atributo de la cookie, sin tocar el repositorio**.

```
A. el mismo ataque entre sitios, con la cookie en Lax
   → documentación después: Campo Verde SRL · APROBADA   (intacta)
   → registro del servidor:  POST /api/documentacion 401 Unauthorized

B. navegación de nivel superior entre sitios (la vuelta de Mercado Pago)
   → 200 · la cookie Lax SÍ viajó
```

`Lax` está hecho exactamente para esto: no acompaña peticiones entre sitios que
mutan, y sí acompaña una navegación de nivel superior. Mata el ataque y
conserva el único uso.

Le agrego la segunda mitad porque `Lax` solo depende de que el navegador y yo
estemos de acuerdo sobre qué es «otro sitio», y hay un caso donde no lo tengo
confirmado —lo explico en el riesgo 1—. Si además la cookie **no puede**
autenticar una ruta mutadora, la pregunta deja de importar: no hay camino, del
mismo modo que el dominio del transportista no sale del directorio porque no
está en el contrato, y no porque nos acordemos de sacarlo.

## 4. Cambios exactos, regresiones y esfuerzo

| Archivo | Cambio |
|---|---|
| `backend/app/api/auth.py:259, 268, 437, 446` | `samesite="none"` → `"lax"` (cuatro veces) |
| `backend/app/api/auth.py:371-372` | el borrado emite los mismos atributos que la emisión |
| `backend/app/core/dependencies.py:69-90` | `get_token_from_cookie_or_header` lee **sólo** la cabecera |
| `backend/app/core/dependencies.py:211-233` | queda como está: es el único lector legítimo de la cookie, para el callback |
| `src/utils/api.ts:66, 165, 270` | sacar `credentials: 'include'` — ya no aporta nada y deja de mandar una credencial que no se usa |

**No cambia** ninguna pantalla, ningún modelo, ninguna migración, ni el
`Authorization` que la interfaz ya manda en todas sus peticiones. Lo verifiqué
ruta por ruta, incluidas las tres cargas multipart
(`CheckoutModal.tsx:414`, `UserDashboard.tsx:1352`, `AddProductModal.tsx:509`).

**Regresiones necesarias:**

1. Un caso nuevo que **reproduzca el ataque y espere que falle**: multipart
   entre sitios con la cookie sola contra las tres rutas, comprobando por SQL
   que no se escribió nada. Tiene que fallar contra el commit de hoy.
2. Un caso que compruebe que la vuelta de Mercado Pago **sigue reconociendo al
   navegador** con la cookie en `Lax`.
3. **Los casos 49 y 50 hay que reescribirlos.** Hoy prueban que cookie y
   cabecera contradictorias dan 401. Con la cookie fuera de las rutas
   protegidas esa contradicción deja de existir ahí: la regla nueva es que la
   cabecera es la única credencial. Te lo marco porque **es una defensa
   existente que esta propuesta retira**, y no quiero que se pierda sin que lo
   decidas: deja de hacer falta porque desaparece la ambigüedad que la motivaba.

**Esfuerzo: bajo.** Cinco archivos, sin migración ni interfaz. La mayor parte
del trabajo son las regresiones, no el cambio.

## 5. Lo que dejo afuera por YAGNI

- **Token CSRF sincronizado.** Es la defensa clásica y acá sobra: sin
  credencial ambiental en rutas mutadoras no hay qué falsificar. Agregarlo
  sería mantener un mecanismo entero para un riesgo ya cerrado.
- **Validar `Origin`/`Referer`.** Redundante con lo anterior, y frágil: hay
  clientes y proxies que no mandan `Origin`, y terminaríamos aflojando la regla
  hasta que no sirva.
- **Mover los tokens fuera de `localStorage`.** Hoy no hay sumidero de XSS
  propio. Es una decisión que tomaría con una CSP puesta, y va aparte.
- **Revocación de tokens al cerrar sesión.** Es real (punto 1.4) pero es otra
  pieza: necesita almacenamiento de revocados y decidir vidas de token.
- **Soporte para clientes externos de API.** No está en el contrato.
- **Acortar las 24 horas del token de acceso.** Discutible, medible, y no es
  esto.

## 6. Criterios de aceptación

1. Ninguna cookie se emite ya con `SameSite=None`: `grep` sobre `auth.py` no
   encuentra `"none"`.
2. El ataque reproducido en este informe, repetido tal cual, **deja la
   documentación del vendedor en `APROBADA`** y el servidor responde 401.
3. Lo mismo contra las otras dos rutas multipart: sin escritura.
4. `POST /api/auth/refresh` entre sitios **no emite cookies nuevas**.
5. La vuelta de Mercado Pago sigue reconociendo al navegador: el callback con
   `state` válido y sesión propia vincula la cuenta.
6. Una petición con la cookie válida y **sin** `Authorization` recibe **401**
   en cualquier ruta protegida.
7. Una petición con `Authorization` válido y **sin** cookie sigue funcionando
   en todas: la interfaz no cambia de conducta.
8. Suite completa desde base limpia, con los casos 49 y 50 reescritos, y el
   caso nuevo del ataque fallando contra el commit anterior.

## 7. Riesgos de la propuesta

1. **No pude confirmar si `up.railway.app` es un sufijo público.** Si no lo
   fuera, `ynerav.up.railway.app` y el Backend serían «el mismo sitio» y una
   cookie `Lax` viajaría entre ellos —y desde cualquier otra aplicación alojada
   en Railway—. **Por eso la recomendación no depende de esa respuesta**: la
   segunda mitad, que la cookie no autentique rutas mutadoras, cierra el riesgo
   sea cual sea. Consultarlo requiere `publicsuffix.org`, que el proxy de
   salida de mi entorno **bloquea**; no lo rodeé.
2. **El dominio productivo futuro cambia el cálculo, a mejor.** Con
   `topgreen.com` y `api.topgreen.com` todo pasa a ser el mismo sitio y la
   cookie `Lax` funcionaría también para la interfaz. Nada de lo propuesto hay
   que rehacerlo.
3. **Esto no toca el riesgo de XSS.** Sigue igual que hoy. Dicho, no tapado.
4. **La ventana sigue abierta hasta desplegar.** Igual que con el hotfix
   anterior.

## 8. Cómo quedó mi entorno

Lo digo porque hice un ataque de verdad: monté un sitio de prueba local, lo usé,
**lo apagué y lo borré**, y dejé la documentación del vendedor restaurada en
`Campo Verde SRL · APROBADA`. No hice ninguna prueba contra Railway. El
repositorio quedó sin una línea modificada: `git status` vacío salvo este
informe.

Freno acá. Vos elegís; no implemento nada hasta que lo digas.
