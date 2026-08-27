# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SEC-5 — el registro público no reparte roles

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `0a898ae` — «SEC-5: el registro público no reparte roles, el rol lo pone el servidor»
- Archivos: `backend/app/schemas/auth.py`, `backend/app/api/auth.py`, `scripts/smoke.mjs` (caso 133).

Tu rojo se quedaba corto. No es que la cuenta «tendría las mismas
autorizaciones»: la tiene, y lo atravesé hasta el final.

---

### 1. El rojo, contra `9251701`, hasta las últimas consecuencias

```
POST /api/auth/register  {"role": "admin"}      -> HTTP 201
fila persistida                                  -> role=ADMIN, activo=true, verificado=false
administradores en la base                       -> 1 → 2
token de verificación                            -> 1
notificación de bienvenida                       -> 1
correo en el outbox                              -> +1
```

Y después seguí, porque «tendría» no es una medición:

```
POST /api/auth/verify-email  (con el token del correo)  -> HTTP 200
POST /api/auth/login                                     -> sesión abierta
GET  /api/admin/users                                    -> HTTP 200
GET  /api/admin/dashboard                                -> HTTP 200
POST /api/admin/users  {"role": "admin"}                 -> HTTP 201
```

El token no lo saqué de la base: lo leí del correo, que es lo que tiene quien
ataca —la casilla es suya—. Con eso, un desconocido termina leyendo el padrón
completo de usuarios, el tablero, y **creando más administradores**. La escalada
es total y no necesita nada previo.

La regresión nueva, corrida contra `9251701`, falla en la primera afirmación:

```
[FAIL] 133 … — la API no respondió HTTP 422
```

### 2. La corrección: dos capas, y las dos hacen falta

**Capa 1 — el esquema público acota el campo.**

```python
role: Literal[UserRole.USER] = UserRole.USER
```

Un pedido con `admin` se rechaza con **422 antes de entrar al endpoint**, así que
no hay cuenta, ni token, ni correo, ni notificación que deshacer. Y OpenAPI queda
con `enum: ["user"]`.

Elegí rechazar y no ignorar en silencio, como pediste. Sacar el campo del esquema
también cerraba la escalada, pero un `"role": "admin"` habría recibido 201 sin que
nadie se enterara de que pidió algo que no le corresponde.

**Capa 2 — el endpoint no le cree al esquema.**

```python
role=UserRole.USER,
```

Antes era `role=user_data.role`. Esta línea no depende de la anterior: es la que
hace verdadero tu criterio 2.

**Por qué se queda el campo.** El frontend manda `"role": "user"` explícito
—`src/contexts/AuthContext.tsx`—, así que sacarlo lo rompía. Aceptar ese único
valor no debilita la regla, porque quien decide qué se guarda es el servidor.

### 3. Matriz payload / rol / efectos, medida contra el endpoint real

| payload | HTTP | rol persistido | tokens | notifs | correos |
|---|---|---|---|---|---|
| sin `role` | 201 | **USER** | 1 | 1 | 1 |
| `role: "user"` | 201 | **USER** | 1 | 1 | 1 |
| transportista sin `role` | 201 | **USER** | 1 | 1 | 1 |
| `role: "admin"` | **422** | — | **0** | **0** | **0** |
| `role: "ADMIN"` | **422** | — | **0** | **0** | **0** |
| `role: null` | **422** | — | **0** | **0** | **0** |
| transportista + `role: "admin"` | **422** | — | **0** | **0** | **0** |

Administradores en la base al terminar: **1**, el del seed. `role: null` ya se
rechazaba antes —el campo nunca fue opcional—; lo incluyo para que se vea que no
cambié ese comportamiento.

### 4. El que persiste no le cree al esquema, probado

Acotar el tipo frena al HTTP, no a alguien que arme el objeto por dentro. Lo
construí **salteando la validación** y llamé al endpoint de verdad:

```
el esquema quedó con role = UserRole.ADMIN   (la validación no corrió)
lo que se PERSISTIÓ:      UserRole.USER
```

Está dentro del caso 133, y el caso además exige que el forzado haya funcionado
—si `model_construct` dejara de saltear la validación, la prueba avisa que no
está midiendo nada en vez de pasar de arriba—.

### 5. Autorizaciones: lo que se cierra y lo que se conserva

| ruta | cuenta pública confirmada | administrador |
|---|---|---|
| `GET /api/admin/users` | **403** | 200 |
| `GET /api/admin/dashboard` | **403** | 200 |
| `GET /api/admin/products` | **403** | 200 |
| `GET /api/admin/orders` | **403** | 200 |

Y el único camino autorizado sigue entero:

```
POST /api/admin/users {"role":"admin"} con sesión de admin   -> 201, la cuenta queda ADMIN
POST /api/admin/users {"role":"admin"} con sesión pública    -> 403
```

`/api/admin/users` y `/api/admin/users/{id}` usan `CreateUserRequest` y
`UpdateUserRequest`, que son **esquemas propios**, no el del registro. Por eso tu
freno —«si el único flujo administrativo también depende del mismo esquema»— no
se activó: son independientes y no los toqué.

También revisé el otro camino por el que se podría colar un rol: el
`UserUpdateRequest` del perfil propio **no tiene** campo `role`, así que
`PUT /api/auth/me` nunca pudo escribirlo. El único escritor de roles es
`admin.py`, bajo `require_admin`.

### 6. OpenAPI

```
UserRegisterRequest.role  ->  {"type":"string","enum":["user"],"const":"user","default":"user"}
CreateUserRequest.role    ->  {"allOf":[{"$ref":"#/components/schemas/UserRole"}],"default":"user"}
```

El esquema público del registro no menciona `admin` en ninguna parte —lo verifica
el caso 133 sobre el JSON servido, no sobre el código—. El esquema administrativo
conserva el enum completo, que es lo correcto: ahí sí se pueden asignar roles.

### 7. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          133/133   (0 fallaron)
python -m compileall backend/app                ok
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

No repetí a11y, contraste ni hito: no cambia marcado visual. No toqué el
frontend.

Diff completo:

```
 backend/app/api/auth.py     |  10 ++-
 backend/app/schemas/auth.py |  17 ++++-
 scripts/smoke.mjs           | 177 ++++++++++++++++++++++++++++++++++++++++++++
```

Sin migración, sin tocar el enum persistido, sin roles nuevos, sin rediseñar
auth, sin rate limiting, sin seed, sin cookies, sin JWT, sin UI, sin Railway, sin
datos y sin dependencias.

### 8. Un tropiezo mío, dicho como fue

La primera corrida completa dio 132/133. No era el producto: al reproducir el
rojo levanté una API a mano y quedó viva, así que el `uvicorn` del script de base
limpia no pudo tomar el puerto y la suite siguió midiendo el código viejo. Maté
el proceso, rearmé la base y quedó 133/133. Lo cuento porque un verde que depende
de qué proceso quedó colgado no es un verde, y prefiero que lo sepas por mí.

### 9. Riesgos residuales

1. **La cuenta creada durante mi reproducción del rojo quedó en mi base local.**
   La base se recrea entera en cada corrida de puertas, así que ya no existe.
   **En una base que haya estado expuesta con el código anterior, esto no
   alcanza**: la corrección impide crear administradores nuevos, no revoca los
   que ya se hubieran creado. Si Railway estuvo publicado con `9251701` o
   anterior, hay que auditar `SELECT email, created_at FROM users WHERE
   role='ADMIN'` y dar de baja lo que no reconozcas. Es lo primero que haría
   antes de publicar.
2. **El campo `role` sigue existiendo en el registro público.** Lo dejé por
   compatibilidad con el frontend. El día que `AuthContext.tsx` deje de mandarlo,
   se puede sacar del esquema y el caso 133 sigue verde, porque también prueba el
   alta sin `role`.
3. **No hay auditoría de cambios de rol.** `admin.py` asigna roles sin dejar
   registro de quién promovió a quién. No estaba en el alcance y no lo agregué,
   pero es la pieza que falta para poder responder «¿de dónde salió este
   administrador?» sin adivinar.
4. **El correo de confirmación no es una barrera contra esto.** Cualquiera
   confirma su propia casilla; en el rojo lo hice yo. Sirve para validar que el
   correo existe, no para autorizar nada.

### 10. Hashes

```
backend/app/schemas/auth.py   556569ff8c196df0
backend/app/api/auth.py       a7bbae59f0ccc4e6
scripts/smoke.mjs             5a1faae745694307
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 11. Frenos

Ningún cliente contractual necesita elegir `admin` en el registro público: el
único que manda el campo es el frontend propio, y manda `"user"`. El flujo
administrativo no comparte esquema con el registro. Cerrar la escalada no exigió
migrar datos ni tocar el enum persistido. No ignoré el valor privilegiado en
silencio: se rechaza con 422 y hay una regresión que mide el rol **persistido**,
no sólo el código de respuesta. No desplegué. `PRE_FIRMA.md` sigue fuera del
versionado y lo confirmé antes de empujar.
