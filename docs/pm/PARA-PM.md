# Dev → PM

Sol: este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-04. Informe pedido antes de programar. **No toqué
`PARA-DEV.md` ni empecé las Piezas B/C.**

---

## 1. Base de trabajo — confirmado, con una corrección

| Qué | Valor |
|---|---|
| Repositorio | `Memu007/yneratopgreen` ✅ |
| Rama | `main` ✅ |
| Último commit que toca **código de producto** | `382bcbe` ✅ |
| `HEAD` real hoy | **`4e34d42`** |

**La corrección:** `382bcbe` no es `HEAD`. Arriba hay tres commits míos que
son **sólo documentación** —`f5f20da`, `f7696e0`, `4e34d42`—. Sobre código
de producto, `382bcbe` es la punta, así que tu premisa es correcta; te lo
aclaro para que no te sorprenda el SHA cuando mires el log.

**Sobre `ynerafinal/`: no existe.** No hay carpeta ni referencia con ese
nombre en el repositorio. Verificado sobre el árbol de trabajo y sobre
`git ls-tree -r main`. No hay nada que ignorar.

Lo que sí existe con nombre parecido es `ynerafinal-production.up.railway.app`,
que es **el sitio de Ynera**, ajeno a este proyecto. No lo toqué.

---

## 2. Transferencias: confirmado, y hay una cuarta puerta

Tu lectura de la máquina de estados es correcta:

| Afirmación | Dónde | Verificado |
|---|---|---|
| Nace en `AWAITING_TRANSFER_RECEIPT` | `backend/app/api/orders.py:256` | ✅ |
| Vendedor sólo decide en `TRANSFER_RECEIPT_SUBMITTED` | `orders.py:393` | ✅ |
| Cancelar sólo admite `PLACED`, `CONFIRMED`, `PAID` | `orders.py:709` | ✅ |

**Falta una cuarta puerta que no mencionaste, y también está cerrada:**
`PATCH /orders/{id}/status` (`orders.py:559`). Sus dos tablas de
transiciones —`seller_transitions` en la línea 600 y `buyer_transitions` en
la 607— **no contienen ninguno de los dos estados de transferencia**, así
que `allowed_transitions` queda vacía y siempre responde `400`.

### El caso que falla contra el código actual

Corrido hoy contra la API levantada, base limpia. No toqué el repositorio:
el script vive fuera, en mi scratchpad.

```text
--- 3. Checkout por transferencia: la orden nace AWAITING_TRANSFER_RECEIPT ---
POST /orders/checkout/transfer -> 200
orden: ORD-20260804-30C8CA14 | estado: awaiting_transfer_receipt

--- 4. El comprador NUNCA sube el comprobante. Intenta cancelar ---
POST /orders/{id}/cancel (comprador) -> 400
  {"detail":"Solo se pueden cancelar órdenes pendientes, pagadas o confirmadas"}

--- 5. El vendedor intenta cancelar ---
POST /orders/{id}/cancel (vendedor) -> 400
  {"detail":"Solo se pueden cancelar órdenes pendientes, pagadas o confirmadas"}

--- 6. El vendedor intenta rechazar el comprobante que no existe ---
PATCH /orders/{id}/transfer-receipt -> 400
  {"detail":"La orden no tiene un comprobante pendiente"}

--- 7. El vendedor intenta mover el estado a mano ---
PATCH /orders/{id}/status -> 400
  {"detail":"No puedes cambiar de awaiting_transfer_receipt a cancelled"}

--- 8. Estado final de la orden ---
estado final: awaiting_transfer_receipt

>>> ORDEN COLGADA: ninguna de las cuatro puertas la mueve.
```

**Cuatro caminos, cuatro `400`.** La orden queda inmortal.

### Un matiz que cambia la prioridad

Los dos estados **no están igual de muertos**:

- `AWAITING_TRANSFER_RECEIPT` — **muerto de verdad.** Ninguna salida.
- `TRANSFER_RECEIPT_SUBMITTED` — tiene una salida: el vendedor rechaza y
  la orden va a `REJECTED`. Lo que falta ahí es menor: el comprador no
  puede retirarse después de haber subido el comprobante.

O sea, el incendio es el primero.

### La transición mínima que propongo

**Un solo cambio**, en la lista de `cancel_order`:

```python
CANCELABLES = [
    OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PAID,
    OrderStatus.AWAITING_TRANSFER_RECEIPT,      # nuevo
    OrderStatus.TRANSFER_RECEIPT_SUBMITTED,     # nuevo, sólo vendedor
]
```

Con un reparto asimétrico, y te digo por qué:

| Estado | Comprador | Vendedor |
|---|---|---|
| `AWAITING_TRANSFER_RECEIPT` | ✅ cancela | ✅ cancela |
| `TRANSFER_RECEIPT_SUBMITTED` | ❌ | ✅ cancela |

**Motivo de la asimetría:** si el comprador puede cancelar después de subir
el comprobante, existe la carrera en que cancela justo mientras el vendedor
aprueba, y el vendedor ya vio la plata en su cuenta. Dejarle esa puerta al
comprador crea un problema de dinero real donde hoy no lo hay. El vendedor
sí puede, porque es quien sabe si la plata llegó.

**Sobre el stock, y es la parte linda:** no hace falta tocar nada. El
descuento ocurre recién al aprobar (`orders.py:408-413`), y la restauración
en `cancel_order` ya está condicionada a `PAID`/`CONFIRMED`. En los dos
estados nuevos el stock nunca se descontó, así que la condición existente
hace lo correcto sin cambiarla.

**Lo que NO propongo:** dejar que el vendedor "rechace" una orden sin
comprobante por `PATCH /transfer-receipt`. Rechazar es un juicio sobre un
comprobante; cancelar es un juicio sobre la orden. Mezclarlos ensucia la
semántica y el rechazo ya guarda motivo obligatorio.

**Los otros tres arreglos** —referencia de pago, comprobante opcional,
vencimiento con liberación de stock— siguen como están en
`PAGOS-TRANSFERENCIA.md`. Este es sólo el que desbloquea.

---

## 3. Sí, corrí los 21 casos. Hoy, desde base limpia

Tenías razón en el señalamiento. Aclaro el origen del `20/20` y después te
paso lo de hoy.

**De dónde venía el `20/20`:** era el informe de la dev anterior, del
2026-07-26. El caso 21 entró después, en `aa0ebd1 feat: registrar perfiles
de transportista`. En mi informe de ayer declaré explícitamente *"No corrí
la suite de humo hoy"*, así que no estaba dando ese número como propio,
pero era el último registrado y quedó viejo. Queda reemplazado.

**Corrida de hoy**, sobre `4e34d42`:

```text
[PASS] 18 Transferencia completa desde la interfaz — UI + API + DB, avisos
       visibles al comprador y vendedor antes de aprobar (29309 ms)
[PASS] 19 Las rutas financieras heredadas no están expuestas — payments,
       mp-oauth y simulate-payment respondieron HTTP 404 (8 ms)
[PASS] 20 Respaldo de imágenes en el recorrido de demostración (42793 ms)
[PASS] 21 Registro de transportista desde la interfaz — UI + API + DB,
       localidad=Pergamino, radio=125.50 km (15231 ms)

Resumen smoke tests
-------------------
21/21 pasaron; 0 fallaron
```

Base limpia de verdad: `DROP DATABASE` + `CREATE` + `CREATE EXTENSION
postgis`, y desde ahí las cinco migraciones:

```text
Running upgrade  -> 766eee72137f, esquema inicial postgresql
Running upgrade 766eee72137f -> 06e1be636327, agregar localidades y ubicación
Running upgrade 06e1be636327 -> cfff8c361c11, agregar transferencias bancarias
Running upgrade cfff8c361c11 -> 63c3ab99fea0, guardar snapshot bancario en orden
Running upgrade 63c3ab99fea0 -> 23ff06b57d6d, agregar perfil de transportista
```

**Fallas previas: ninguna.** Verde a la primera.

### Cómo tuve que correrlo, porque importa

`npm run smoke` **no se puede ejecutar acá**: `scripts/smoke.sh` exige
Docker (`docker compose down -v`, `./scripts/init_local_db.sh`) y en mi
entorno el demonio no está disponible. Levanté el stack nativo y corrí
`node scripts/smoke.mjs` directo. Para que `querySql` funcionara
—shellea `docker exec topgreen-db psql`— puse un shim de `docker` en el
`PATH` que traduce esa invocación a `psql` local.

**El shim vive en mi scratchpad, fuera del repositorio.** No cambié
`smoke.mjs` ni `smoke.sh`. También tuve que enlazar Chromium 1194 al nombre
de build 1234 que espera Playwright 1.62.

Te lo digo porque **corrí la misma suite, no el mismo runner.** Si querés
la corrida por el camino oficial, hace falta un entorno con Docker.

### Y lo más importante de esta sección

**El verde no cubre la orden colgada.** Los 21 casos pasan y el bug del
punto 2 está vivo. Ningún caso llega a un final donde el comprador
simplemente no sube nada: el 14 deja la orden esperando y no intenta
cancelarla; el 15 prueba un archivo inválido pero después sube uno bueno.

Por eso, cuando me habilites el arreglo, **el caso nuevo tiene que fallar
contra el código de hoy antes de tocarlo**. Te voy a pegar la corrida en
rojo y la corrida en verde. Un caso que pasa antes del arreglo no prueba
nada.

---

## 4. Perfil de transportista editable, sin duplicar la validación

**Confirmado el hueco:** `UserUpdateRequest` (`schemas/auth.py:130-139`)
tiene ocho campos y **ninguno es de transportista**. En el frontend, los
cinco campos existen sólo en `RegisterModal.tsx`; `UserDashboard.tsx` no
los conoce. Hoy, si te registraste sin marcar la casilla, no hay forma de
volverte transportista, y si cambiaste de camión no podés decirlo.

### La propuesta: el perfil de transportista es un recurso aparte

**No agregar los cinco campos a `PATCH /auth/me`.** El motivo es la
semántica: `PATCH` es parcial, y con campos parciales se puede llegar a un
transportista con radio pero sin localidad. La validación de registro es
*todo o nada*, y esa invariante es la correcta.

```text
PUT    /auth/me/carrier    → alta o reemplazo completo del perfil
DELETE /auth/me/carrier    → deja de ser transportista
```

**`PUT` con carga completa tiene exactamente la misma invariante que el
registro**, y por eso puede reusar **el mismo validador sin copiarlo**:

```python
class CarrierProfilePayload(BaseModel):
    carrier_base_locality_id: Optional[str] = Field(None, max_length=20)
    carrier_transport: Optional[str] = Field(None, max_length=255)
    carrier_transport_certified: bool = False
    carrier_coverage_radius_km: Optional[float] = Field(None, gt=0)
    carrier_capacity: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def validate_carrier_profile(self): ...   # la de hoy, movida acá

class UserRegisterRequest(CarrierProfilePayload):   # hereda validador
    ...
class CarrierProfileRequest(CarrierProfilePayload): # mismo validador
    ...
```

Un solo validador, dos puertas de entrada. Si mañana cambia la regla, se
cambia en un lugar y el registro y la edición se mueven juntos —que es
justamente lo que hoy no pasaría si copio y pego.

**`DELETE` en vez de `is_carrier: false` por `PATCH`**, porque bajarse de
transportista tiene que limpiar los cinco campos a la vez, y un `PATCH`
parcial dejaría restos.

**Lo que esto no resuelve y te lo marco:** si un transportista con
publicaciones activas cambia su localidad base o achica el radio, los
resultados de búsqueda cambian solos. No es un problema hoy porque no
existe el listado, pero cuando entre la Pieza B hay que decidir si eso
afecta órdenes ya coordinadas. Es una de las cuatro preguntas de diseño.

---

## 5. `carrier_transport_certified`: declaración fechada

**El diagnóstico es correcto y es peor de lo que decís.** El validador de
registro (`schemas/auth.py:35-36`) rechaza el alta si el campo no viene en
`true`. Entonces **el 100 % de los transportistas tiene `true` por
construcción**. Un campo con un solo valor posible tiene cero información:
no se puede filtrar por él, no se puede ordenar, y no distingue a nadie.

### Recomiendo declaración fechada. Con una condición

No por completitud de datos, sino por responsabilidad. Hoy el campo dice
"habilitado" sin que nadie haya verificado nada, y eso le da al comprador
una impresión de control que no existe. Si un transportista sin
habilitación real tiene un accidente con carga de un cliente, la plataforma
afirmó algo que no comprobó.

**La forma que propongo** (sin tocar el esquema todavía, como pediste):

- Reemplazar el booleano por **una declaración con fecha y texto**: qué
  declara —tipo de habilitación y número—, cuándo lo declaró, y opcional
  cuándo vence.
- **Mostrarlo siempre con la atribución explícita**: *"Declarado por el
  transportista el 04/08/2026. TopGreen no verifica habilitaciones."*
- La fecha sí informa: un transportista que declaró hace tres años y no
  actualizó es distinto de uno que declaró la semana pasada, y eso el
  comprador lo puede evaluar solo.

**La condición, y es un límite de alcance:** **no propongo verificar contra
ningún registro oficial.** Cruzar contra RUTA o RENATRE no está en el
contrato, agrega una dependencia externa y es un módulo entero. Precio
cerrado: lo que construyamos de más lo pagamos nosotros.

**Por qué no la opción B** —dejarlo informativo sin fecha—: es lo que ya
tenemos, y ya sabemos que no informa.

**Esto es una decisión tuya y toca el esquema.** No la ejecuto hasta que la
apruebes, y cuando la apruebes va con migración aditiva.

---

## 6. Mapa de teléfono y dirección

Barrido sobre `backend/app/schemas` y `backend/app/api`. Todo verificado
con llamadas reales, no leyendo nada más que el código.

| Endpoint | Devuelve | Quién puede | Puerta |
|---|---|---|---|
| `GET /orders/my?as_role=seller` | `buyer_phone`, `buyer_address` | El vendedor de esas órdenes | Filtro SQL `seller_id` |
| `GET /orders/my?as_role=buyer` | `seller_phone`, `seller_whatsapp` | El comprador de esas órdenes | Filtro SQL `buyer_id` |
| `GET /auth/me` | `phone`, `whatsapp` propios | El dueño | Token |
| `GET /admin/users`, `/admin/users/{id}` | `phone`, `whatsapp` de todos | Admin | `require_admin` |
| `GET /contact`, `/contact/{id}` | `phone` del remitente | Admin | Chequeo en línea 67 |

Salida real de hoy:

```text
GET /orders/my?as_role=seller -> 200 | ordenes: 5
  buyer_name: María Cliente
  buyer_phone: +54 11 9876-5432
  buyer_address: Ruta 8 km 220, Pergamino, Buenos Aires
GET /orders/{id} -> 200 | buyer_phone: null | buyer_address: null
GET /orders/my?as_role=buyer -> 200 | seller_phone: +54 11 1234-5678
```

### Dos precisiones sobre tu punto

**No existe `GET /orders`.** Las rutas son `GET /orders/my` y
`GET /orders/{order_id}`.

**Y `GET /orders/{order_id}` hoy NO devuelve teléfono ni dirección**, aunque
el schema `OrderResponse` tenga los campos: `get_order_detail`
(`orders.py:542-556`) simplemente no los llena y quedan en `null`. Sólo el
listado los completa, en `orders.py:475-488`.

Eso importa para tu pregunta, porque **la ruta que un transportista va a
necesitar es justamente la del detalle**, que es la que hoy está limpia.

**El catálogo no filtra contacto**: `SellerInfo` y `SellerBasicInfo`
(`schemas/catalog.py:47-66`) exponen `location`, que es texto libre de
perfil, nunca `phone`.

### Cómo evitar que el transportista saltee el candado

El riesgo no es el código de hoy: es el cambio de mañana. Cuando el
transportista se enganche a la orden, lo natural es agregar
`or order.carrier_id == current_user.id` al permiso de `get_order_detail`
y darlo por hecho. **Ese día el transportista hereda `OrderResponse`
entero**, y cuando alguien complete el detalle con los datos del comprador
—que es lo que falta para que el schema sea coherente— el candado queda
salteado sin que nadie haya escrito la línea que lo saltea.

Cuatro recomendaciones, en orden de importancia:

**1. El transportista nunca recibe `OrderResponse`.** Schema propio,
`CarrierOrderView`, construido desde cero con lo que necesita para decidir
un flete: número de orden, localidad de origen, localidad de destino, peso
o volumen, y estado. Sin teléfono, sin calle, sin monto, sin ítems. Un
schema separado no se puede ampliar por accidente.

**2. Una sola función decide sobre contacto.** Hoy la decisión está
escrita en línea dentro de `get_my_orders`. Propongo
`contact_visible_for(viewer, target, order) -> bool`, y que **ningún
endpoint pueda devolver un teléfono sin pasar por ahí**. El candado de
suscripción vive adentro de esa función. Un solo lugar para auditar, un
solo lugar para probar.

**3. Partir la dirección en dos.** Hoy `buyer_address` concatena calle +
ciudad + provincia (`orders.py:482`). Para rutear, el transportista
necesita la localidad; la calle es lo sensible. Con el campo partido, el
transportista ve la localidad siempre y la calle sólo cuando corresponde,
sin ninguna condición nueva.

**4. Sacar `as_role` de la mano de quien llama.** Hoy es un query param
que el cliente declara. **No es un agujero** —el filtro SQL es sobre
`seller_id`/`buyer_id`, así que declarar `seller` sin serlo devuelve tus
propias órdenes de vendedor y nada más—, pero el rol debería derivarse de
la relación con la orden, no del pedido. Es el patrón que hace que el
error del punto anterior sea fácil de cometer.

---

## 7. Suscripciones: inventario, sin implementar

**Punto de partida: no existe nada.** Cero coincidencias de
`subscription`, `suscrip`, `premium` o `plan_` en `backend/app` y `src`,
salvo el nombre de un producto del seed —"Semillas de Maíz DK Premium"—.
Se construye entero.

### Modelos nuevos

| Modelo | Para qué | Nota |
|---|---|---|
| `SubscriptionPlan` | Básico y Premium: precio, período, qué habilita | Sembrado, no editable por usuario |
| `Subscription` | Vínculo usuario ↔ plan: estado, vigencia, `mp_preapproval_id` | Es lo que lee el candado |
| `SubscriptionCharge` | Cada cobro recurrente y su resultado | Necesario para reclamos |
| `Conversation` + `Message` | Mensajería premium | Dos tablas, no una |

**Hallazgo que ahorra una discusión:** el modelo `Payment` que quedó del
Mercado Pago viejo **no se puede reusar**. Su `order_id` es
`nullable=False` (`models/payment.py:28`) y una suscripción no tiene
orden. Tabla nueva, sí o sí.

### Endpoints nuevos

```text
GET    /subscriptions/plans           listado público
POST   /subscriptions/subscribe       crea la preaprobación en MP
GET    /subscriptions/me              estado de mi suscripción
POST   /subscriptions/cancel          baja
POST   /subscriptions/webhook         avisos de cobro recurrente de MP
GET    /admin/subscriptions           panel

GET    /messages/conversations        bandeja        (premium)
GET    /messages/conversations/{id}   hilo           (premium)
POST   /messages/conversations/{id}   enviar         (premium)
```

### Pantallas nuevas

- **Planes y precios**, con la comparación Básico/Premium.
- **Alta de suscripción**, con la vuelta desde Mercado Pago.
- **Mi suscripción** dentro del panel: estado, próximo cobro, baja.
- **Bandeja de mensajes** y **hilo**, sólo premium.
- **Avisos de bloqueo** donde hoy se muestra el contacto, con la salida a
  contratar.
- **Panel de administración** de suscripciones.

### Qué se toca de lo que ya existe

| Qué | Impacto |
|---|---|
| `contact_visible_for` del punto 6 | **Es el punto de encaje.** Si entra antes, suscripciones lo consume; si no, hay que buscar los teléfonos uno por uno |
| `UserResponse` | Suma estado de suscripción; lo consume todo el frontend |
| `main.py` | Router nuevo montado |
| **Caso 19 de la suite** | Verifica que `payments` y `mp-oauth` devuelvan `404`. El módulo nuevo **no puede resucitarlos**, y ese caso tiene que seguir verde |
| Seed | Los dos planes |
| Revisión de seguridad | Vuelven credenciales de Mercado Pago al proyecto |
| Garantía de 90 días | Pasa a cubrir un sistema de cobro recurrente |

### Y una advertencia que te debo

`DECISIONS.md` dice que **la plataforma no recibe ni administra fondos de
terceros**, con la excepción explícita de cobrar suscripciones —servicio
propio a cliente propio—. Esa distinción hoy vive en un documento.

**Cuando entren las credenciales de Mercado Pago para suscripciones, la
distinción tiene que vivir en el código**, igual que el caso 19 hizo que
"los pagos heredados no existen" fuera una propiedad verificable y no una
promesa. Si no, en tres meses nadie va a poder demostrar que la plataforma
no puede cobrar una venta entre terceros.

**No lo empiezo.** Falta el enunciado con criterios.

---

## 8. Railway: hay configuración, no hay despliegue

**Sólo configuración.** No encontré ninguna evidencia de un deploy.

**Lo que existe** (`382bcbe`, 9 archivos, 228 líneas, todo nuevo):
`Dockerfile.railway` en raíz y en `backend/`, sus dos `.dockerignore`,
`railway.toml` en raíz y en `backend/`, `backend/railway-entrypoint.sh`,
`infra/railway/nginx.conf.template` y `RAILWAY.md`.

**Lo que prueba que no se desplegó:**

1. **No hay ninguna URL de despliegue en el repositorio.** Busqué
   `railway.app` y `up.railway` en todo el árbol —markdown, toml, ts, tsx,
   py, sh, templates—: cero resultados. Un servicio desplegado deja su
   dominio en alguna variable o en alguna nota.
2. **`RAILWAY.md` está escrito en imperativo**, de principio a fin:
   *"Creá el servicio"*, *"Conectá el repositorio"*, *"Activá backups
   antes de cargar datos reales"*. Es una guía para hacerlo, no el registro
   de haberlo hecho.
3. **Su sección 4 se titula "Verificación" y empieza con "Después del
   primer despliegue"**, listando tres comprobaciones `GET` sin ningún
   resultado pegado. El propio documento declara que el despliegue no
   ocurrió.
4. **No hay informe de la dev anterior** sobre este commit.

**Y no confundo "compila" con "está publicado": tampoco puedo afirmar que
compile.** No pude construir ninguno de los dos `Dockerfile.railway`
porque **Docker no está disponible en mi entorno** — el mismo motivo por
el que no pude usar el runner oficial de la suite. Lo único que verifiqué
hoy es que `npm run build` pasa en verde, y eso no dice nada sobre la
imagen de Railway.

### Dos cosas que quiero marcarte antes de que esto se despliegue

**`backend/railway.toml` trae `preDeployCommand = "railway-entrypoint
migrate"`.** Cada despliegue va a correr `alembic upgrade head`
automáticamente contra la base de producción, sin intervención. Con datos
de gente real adentro, una migración mal escrita se aplica sola. No digo
que esté mal —es lo habitual— pero es una decisión que nadie tomó por
escrito.

**`RAILWAY.md` línea 39 pide `ADMIN_PASSWORD=CAMBIAR_ANTES_DEL_PRIMER_DEPLOY`.**
Está bien que sea un marcador, y quiero que quede anotado que el primer
despliegue crea un administrador. Si ese marcador se copia tal cual, el
sistema queda con una contraseña de administrador conocida y escrita en el
repositorio.

**Y lo de siempre: no se despliega nada antes de la revisión de
seguridad.** Está en `NOW.md` como condición de la fase 5.

---

## Estado de mi entorno

Levanté PostgreSQL 16 + PostGIS 3.4, la API en 8000 y Vite en 5173 para
poder correr todo esto. Los dejo **prendidos** por si querés que verifique
algo más antes de contestarme; los bajo cuando me des la devolución.

Archivos temporales fuera del repositorio, en mi scratchpad. **El árbol de
trabajo del repositorio está limpio** salvo este informe.

---

## Lo que necesito de vos

1. **Aprobación del arreglo del punto 2**, con la asimetría comprador /
   vendedor que propongo, o la corrección si no te cierra.
2. **Decisión sobre el punto 5**, porque toca el esquema.
3. **El enunciado de suscripciones**, sin el cual no puedo empezar el
   punto 7.
4. **Las cuatro preguntas de diseño de transportistas**, que siguen
   bloqueando B y C.

Y una pregunta mía: **¿querés que el `contact_visible_for` del punto 6
entre antes que suscripciones?** Mi recomendación es que sí. Construirlo
primero convierte el candado en un parámetro; construirlo después obliga a
revisar todos los endpoints de nuevo. Es la misma lógica con la que se
decidió no posponer las decisiones estructurales de privacidad.
