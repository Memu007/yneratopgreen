# Subagentes adversariales sobre lo publicado — 03/10

Pedido de Emi (03/10): probar los subagentes en dos o tres piezas ya
publicadas para tener datos. PM eligió una por riesgo: cobro, sesión y
permisos. Los tres revisaron `e5d592e` en sólo lectura. PM reprodujo en un
entorno nuevo (`levantar.sh e5d592e`: PostGIS en Docker, API nativa con un
proceso y el doble de Mercado Pago del repositorio). Antes de reproducir, los
casos 231 y 235 dieron 2/2.

Los scripts están en `archivo/subagentes-2026-10-03/`. Los de Python corren
desde `backend/`, con `PYTHONPATH=.` y el `.venv`. Los casos 901 a 906 se
pegan en una copia de `scripts/smoke.mjs`, antes de «La cuenta se hace ACÁ»,
y no afirman nada: imprimen lo que pasó. La copia se borró y el worktree
quedó limpio.

Ningún hallazgo estaba en `NOW.md`, en los informes de la Dev ni en las
reproducciones de PM de esas piezas.

## Cobro con Mercado Pago (Sonnet): 8 hallazgos, 6 reproducidos

| # | Hallazgo | Reproducción PM |
|---|---|---|
| 1 | Una orden cancelada con el cierre del link caído y después pagada queda cancelada con el pago aprobado y el stock descontado, sin aviso a nadie. | Caso 901: cancelar 200 (`cancelled`, `cierre_pendiente`); webhook aprobado 200: orden `cancelled`, reserva `consolidada`, pago `APPROVED`, stock 240→239. Avisos: sólo los de la cancelación. |
| 2 | Un pago aprobado que pasa a `in_mediation` se muestra «en proceso», y la orden pagada se puede cancelar sin devolver el stock. | Caso 902: pago `APPROVED`→`IN_PROCESS`; el comprador cancela 200: orden `cancelled`, pago `CANCELLED`, reserva `consolidada`, stock sin volver. |
| 3 | Un pago devuelto deja la orden sin salida: cancelar da 409 diciendo que hay un pago acreditado, y rechazar da 400. | Caso 903: pago `REFUNDED`, cancelar 409 con ese texto, rechazar 400, stock descontado. |
| 4 | Si lo primero que llega es un pago devuelto, se avisa «Pago aprobado» y «Venta pagada», y el vendedor puede confirmar. | Caso 904: orden `paid` y después `confirmed` (200) con pago `REFUNDED`; avisos «Pago aprobado» y «Venta pagada». |
| 5 | Cancelar con un pago en proceso libera el stock; si después se aprueba, la orden vuelve a pagada sin mercadería reservada. | Caso 905: cancelar 200 (`liberada`); aprobado después: orden `paid`, pago `EN_REVISION`, reserva `liberada`. |
| 6 | Rechazar mientras se arma el link deja una preferencia viva. | **Parcial.** Caso 906: orden `rejected`, pago `CANCELLED` con preferencia y `link_cerrado=false`, pero el comprador no recibió el link. No se clasifica hasta saber si alguien puede llegar a él. |
| 7 | Una firma con caracteres no ASCII da 500 en el webhook público en vez de 401. | `curl` con `x-signature: ts=…,v1=é`: 500. La misma firma en ASCII: 401. |
| 8 | Un commit en medio del cierre suelta el candado de la orden si la credencial no abre. | No reproducido; el subagente lo marca especulativo. |

## Contraseña y sesiones (Opus): 7 hallazgos, 4 reproducidos

| # | Hallazgo | Reproducción PM |
|---|---|---|
| 1 | Un login con la contraseña vieja, en curso durante el cambio, sale con un token de la versión nueva que sigue sirviendo. | `sesiones.py 1`: con la fila tomada, el login con la clave vieja quedó esperando; se confirmó el cambio (versión 0→1 y hash nuevo); el login respondió 200 con `sv=1`; `/auth/me` 200 y `/auth/refresh` 200 después del cambio; un login nuevo con la clave vieja, 401. Las cuatro rutas son `def` y corren en hilos: el cruce es posible en producción. |
| 2 | `/auth/change-password` no tiene límite de intentos sobre la contraseña actual. | `sesiones.py 2`: 50 intentos errados, 50 × 400, ningún 429; el 51 con la correcta, 200. |
| 3 | «Cerrar sesión» no revoca nada en el servidor y un refresh ya rotado sigue sirviendo. | `sesiones.py 3`: refresh con R1 200, otra vez con R1 200; después del logout, `/auth/me` 200 y refresh con R2 200. |
| 4 | El admin restablece su propia contraseña desde el panel sin dar la actual. | `sesiones.py 4`: 200; su token pasa a 401 y la clave nueva entra. |
| 5 | Dos pestañas: una renovación tardía pisa los tokens nuevos y deja afuera a quien cambió la clave. | No reproducido (probable, ventana estrecha). |
| 6 | Bajar y volver a subir la migración revive sesiones cerradas. | No reproducido. Sólo con un `downgrade`, que no es operación normal. |
| 7 | El reintento del frontend puede reenviar una acción con los tokens de otra cuenta. | No reproducido (probable, ventana muy estrecha). |

## Panel de marcas (Sonnet): 7 hallazgos, 6 reproducidos

| # | Hallazgo | Reproducción PM |
|---|---|---|
| 1 | Unir o dar de baja una marca mientras alguien publica con ella deja la publicación con una marca que no existe. | `marcas_carrera.py`, con el cruce forzado en proceso y sin tocar producto: alta 200, marca `carrera-pm`, la opción ya no existe y `brand_label` es nulo. Alta (`async`) y unir (`def`, en hilo) pueden cruzarse en producción; la ventana es de milisegundos. |
| 2 | Un nombre válido que se expande al normalizar da 500 y deja una marca rota en la lista pública. | `marcas.py 2`: «㎒»×25 → 500, y la marca de 75 caracteres queda en `/catalog/form-options`; elegirla 422 y escribirla otra vez 500. «ⅷ»×40 y un NUL: 500 sin dejar marca. |
| 3 | Una marca escrita sigue ofrecida al publicar después de borrar su única publicación, sin límite de altas. | `marcas.py 3`: borrada la publicación, sigue en la lista. |
| 4 | Una letra de otro alfabeto que se ve igual crea un duplicado. | `marcas.py 4`: «Kubоta» (o cirílica) crea `kubta` junto a `kubota`. |
| 5 | Unir no deja alias: el error de tipeo vuelve a crearse. | `marcas.py 5`: unir «Jhon Deere» a John Deere 200; escribir «Jhon Deere» otra vez la crea activa. |
| 6 | Un enlace con una marca unida filtra en silencio y el selector dice «Todas». | API: `brand=` inexistente da 200 y 0 resultados. El selector no se miró. |
| 7 | Cambiar nombre y estado juntos por API no es atómico. | No reproducido; la pantalla no manda los dos. |

Descartado por el subagente y no reproducido por PM: un usuario común no
toca marcas (403), no hay datos ajenos en `/products/my`, no hay XSS ni
inyección.

## Números

| | Hallazgos | Reproducidos | Nadie más los vio |
|---|---|---|---|
| Cobro (Sonnet) | 8 | 6 (más 1 parcial) | 6 |
| Sesiones (Opus) | 7 | 4 | 4 |
| Marcas (Sonnet) | 7 | 6 | 6 |
| **Total** | **22** | **16** | **16** |

Ningún hallazgo resultó falso; los que no se reprodujeron no se intentaron o
son especulativos. Las tres piezas habían pasado la revisión de PM con
negativos y suite completa: los subagentes encontraron huecos de estado y de
carrera alrededor de lo que se afirmaba, no violaciones de lo afirmado.

---

# Barrido sobre lo no revisado — 03/10, segunda parte

Pedido de Emi: hasta dos días de mejoras, con subagentes donde haga falta.
PM mandó tres más sobre `e5d592e`, en sólo lectura, y reprodujo en el mismo
entorno. Scripts: `permisos.py`, `archivos.py` y `ordenes.py` en
`archivo/subagentes-2026-10-03/`; corren desde `backend/` con el `.venv` y
tocan sólo la base local.

**Corrección de PM:** la consigna de permisos decía «el CBU sólo lo ve quien
le compró por transferencia». Esa regla no existe en ningún documento: la
escribió PM. El hallazgo 1 de permisos pasa a decisión de Emi, no a defecto.

## Permisos y datos personales (Sonnet): 8 hallazgos, 8 reproducidos

| # | Hallazgo | Reproducción PM |
|---|---|---|
| 1 | Con algo en el carrito, `/orders/payment-options` devuelve CBU y alias del vendedor sin orden. | `permisos.py 1`: 200 con `cbu` y `alias_bancario`. **Decisión de Emi** (ver arriba). |
| 2 | El vendedor deshace la suspensión del administrador. | `permisos.py 2`: admin pausa 200; el vendedor pone `active` 200; ficha pública 200. |
| 3 | El comprador cancela una orden por transferencia ya aprobada y confirmada. | `permisos.py 3`: aprobada (`PAID`, stock 500→499), confirmada, el comprador cancela 200: `CANCELLED` y stock otra vez 500. |
| 4 | Un vendedor desactivado sigue publicado y vendiendo. | `permisos.py 4`: desactivado; catálogo 200 con sus 20 publicaciones, ficha 200, compra por transferencia 200. Se restauró. |
| 5 | Los comprobantes de transferencia se sirven sin sesión desde `/uploads`. | `permisos.py 3`: `curl` sin sesión a `/uploads/transfer_receipts/…png`: 200. |
| 6 | Elegir transportista sin comprar devuelve email, teléfono y patente. | `permisos.py 6 cerca`: 200 con los tres. Es como está diseñado («después de elegir»); elegir no compromete nada. |
| 7 | El transportista ve órdenes sin pagar y canceladas. | `permisos.py 7 cerca`: la ve sin pagar y la sigue viendo cancelada. |
| 8 | Se puede calificar dos veces la misma compra. | `permisos.py 8 cerca`: cuatro en paralelo, dos 200; dos filas en `ratings`. |

## Archivos, registro y logística (Sonnet): 8 hallazgos, 6 reproducidos (2 repetidos)

| # | Hallazgo | Reproducción PM |
|---|---|---|
| 1 | Las constancias fiscales se guardarían en disco efímero en Railway: `DOCUMENTOS_DIR` no está en `RAILWAY.md` ni en el inventario del 13/09, y su valor por omisión cae fuera del volumen `/data`. | **Por verificar en Railway** (Emi). Confirmado que `RAILWAY.md`, `Dockerfile.railway` y `railway-entrypoint.sh` no la mencionan; `docker-compose.yml` sí usa `/data/documentos`. |
| 2 | Comprobantes públicos. | Igual que permisos 5. |
| 3 | Registrar el correo de otra persona: la bloquea, y si confirma, entra quien la registró. | `archivos.py 3`: el atacante registra 201; la víctima recibe «El email ya está registrado»; la víctima pide el enlace y confirma 200; el atacante entra con su contraseña 200. |
| 4 | El correo distingue mayúsculas. | `archivos.py 4`: registro `Ana.…@Example.com` 201; login en minúsculas 401; una segunda cuenta en minúsculas 201. |
| 5 | Las subidas se leen enteras antes de validar el tamaño. | No reproducido (podría tirar la API local); confirmado leyendo `products.py`. |
| 6 | Una subida rechazada deja archivos huérfanos en disco. | `archivos.py 6`: dos PNG y un `.gif` → 400; dos archivos nuevos en disco y 0 filas. |
| 7 | Se puede saber si un correo está registrado. | Visto en `archivos.py 3`: el 400 «El email ya está registrado». |
| 8 | Contacto de transportistas sin comprar. | Igual que permisos 6. |

## Órdenes, checkout y stock (Opus): 7 hallazgos, 5 reproducidos

| # | Hallazgo | Reproducción PM |
|---|---|---|
| 1 | Por transferencia no se reserva stock: dos compradores pagan la última unidad. | `ordenes.py 1`: stock 1, dos compras 200 y 200, los dos suben comprobante; aprobar al primero 200, al segundo 400 «Stock insuficiente». **Ya registrado** en `DECISIONS.md` («verifica stock al crear la orden pero no lo reserva»): es una decisión pendiente, no un hallazgo nuevo. |
| 2 | El comprador cancela una transferencia aprobada. | Igual que permisos 3. |
| 3 | Subir el comprobante pisa una aprobación simultánea. | No reproducido; confirmado leyendo que la escritura no mira el estado. |
| 4 | La misma compra dos veces (otra pestaña o recarga) crea dos órdenes. | `ordenes.py 4`: 200 y 200, órdenes distintas. |
| 5 | Un precio cambiado entre el carrito y la confirmación se cobra. | `ordenes.py 5`: 100→1000, la orden sale en 1000. **Es la decisión del 12/08** («rige el precio vigente cuando el comprador confirma»); queda revisar que la pantalla muestre ese total antes de pagar. |
| 6 | Una publicación con precio 0 se compra por API y da una orden de $0. | `ordenes.py 6`: 200, total 0.00. |
| 7 | Entradas sin tope dan 500. | `ordenes.py 7`: notas de 600 caracteres → 500. La cantidad de 3.000.000.000 da 400, no 500: esa parte no se confirma. |

## Números de la segunda parte

| | Hallazgos | Reproducidos | Nadie más los vio |
|---|---|---|---|
| Permisos (Sonnet) | 8 | 8 | 6 (1 era regla inventada por PM; 6 es diseño) |
| Archivos y registro (Sonnet) | 8 (2 repetidos) | 4 propios | 5 |
| Órdenes (Opus) | 7 (1 repetido) | 4 propios | 3 (1 y 5 ya estaban decididos) |
