# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-11.

## 1. Resultado

**Terminado.** El commit de producto es **`e3fe9cb`**, sobre tu `0578500`; este
informe va aparte y encima.

| Puerta | Antes | Ahora |
|---|---|---|
| Suite | 41 | **44 casos** |
| Accesibilidad | 50 | **52 pantallas** |
| Contraste | 36 | 36 mediciones |

Las 52 son 26 rutas × 2 medidas: agregué **una** ruta permanente, `checkout:
fletes compatibles`, y son 2 mediciones. Con la cuenta correcta esta vez.

## 2. La declaración de habilitación

Era un booleano. Ahora es una declaración con **detalle** y **fecha del
servidor**, como pide el contrato.

| Situación | Qué pasa |
|---|---|
| Alta de transportista sin detalle | 422, con el motivo |
| Alta con detalle | se guarda, y la fecha la pone el servidor |
| Mandar la fecha en el pedido | se ignora; no se puede retrodatar |
| Guardar sin cambiar el detalle | la fecha **no** se mueve |
| Cambiar el detalle | es una declaración nueva y la fecha se renueva |
| Vaciar el detalle | 400: dejaría el perfil incompleto |

En pantalla dice siempre **«TopGreen no verifica esta habilitación»**, en el
alta, en el perfil y en cada tarjeta del listado.

**No inventé detalle para los perfiles que ya existían.** Quedan sin
declaración, y por eso no aparecen como compatibles hasta que su titular la
complete. El transportista demo del seed sí queda completo, y sigue siendo
idempotente: el caso 41 lo comprueba con la fecha incluida.

## 3. El destino, del padrón

El checkout tenía una lista fija de 24 provincias escritas a mano y una ciudad
de texto libre. Ahora son los dos selectores encadenados del padrón, los mismos
del catálogo y de los perfiles. La dirección exacta sigue siendo texto libre y
no entra al cálculo.

- Los **dos** checkouts validan `shipping_locality_id` **antes de escribir**;
  un destino que no está en el padrón devuelve 400 y no crea ninguna orden.
- Cada orden nueva guarda el destino con FK a `localities`. La ciudad y la
  provincia que se muestran se derivan del padrón, **no** del texto del
  cliente: eso también quedó en `shipping_address_json`.
- Las órdenes anteriores quedan con destino `NULL` y **siguen legibles**, en el
  detalle y en el listado. El caso 44 lo prueba borrando el destino de una
  orden y volviéndola a leer.

La migración es reversible; probé `downgrade` y `upgrade` seguidos, y
`alembic check` no detecta diferencias con los modelos.

## 4. La compatibilidad

Los grupos salen del **carrito del servidor**, una futura orden por vendedor.
El cliente elige el destino y nada más: no puede dictar vendedor, origen ni
radio.

Un transportista entra sólo si su base está dentro de **su propio radio**
respecto del destino **y de cada localidad de origen distinta** del grupo.
Alcanza con fallar en un origen para quedar afuera. Todo eso ocurre en una
consulta de PostGIS con `ST_DWithin`; las distancias visibles salen de
`ST_Distance`. No se trae ningún transportista para descartarlo en Python.

Además del filtro geográfico, sólo entran cuentas activas, verificadas,
transportistas, con transporte, con declaración completa, base válida y radio
positivo. **La capacidad se muestra y no filtra.** No hay orden por «mejor»: el
listado sale por nombre.

La respuesta lleva nombre, base, vehículo, declaración, fecha, radio, capacidad
y las distancias a destino y a cada origen. **No lleva email, teléfono,
WhatsApp, domicilio, CBU ni alias**, y esa ausencia está escrita en el esquema
de salida, no en el criterio de quien arme la pantalla.

En la interfaz se distinguen cuatro estados: cargando, sin coincidencias, grupo
sin origen oficial y error real. **Cambiar el destino reemplaza el listado en el
acto** y cada consulta lleva número, así que una respuesta tardía de un destino
anterior no puede pisar el actual.

## 5. La evidencia

Caso **43**, con dos vendedores y orígenes distintos:

```text
[PASS] 43 Fletes compatibles por futura orden, con PostGIS y sin contacto —
  2 grupos, 3 y 1 candidatos propios; límite en 104.8 km respetado;
  API = PostGIS; sin contacto en JSON ni DOM
```

Los radios de los candidatos se calculan **desde las distancias reales del
padrón**, no con números fijos: Pergamino–Rosario da 104,8 km y
Pergamino–Córdoba 435,8 km, y sobre eso se arman uno que cubre todo, uno que
cubre un solo origen, uno justo en el límite, uno un kilómetro afuera y uno con
el perfil incompleto. La comparación es contra la consulta PostGIS equivalente,
grupo por grupo; no se comparan cantidades del seed.

| Comprobación | Resultado |
|---|---|
| Falla en un solo origen | queda afuera del grupo lejano y adentro del cercano |
| Justo en el límite del radio | adentro; un kilómetro menos, afuera |
| Perfil sin declaración | no aparece en ningún grupo |
| Grupo con un producto sin localidad | `origin_missing`, cero candidatos |
| Cambio de destino | cambia la compatibilidad |
| Contacto en JSON y en el DOM del checkout | ninguno |

**Rojo forzado sobre la regla central.** Saqué la exigencia de cubrir cada
origen y el caso falló exactamente ahí:

```text
[FAIL] 43 — un candidato que falla en un solo origen quedó adentro
```

Casos **42** (la declaración) y **44** (el destino) tienen su propia evidencia,
resumida en los puntos 2 y 3.

## 6. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada | **44/44** |
| Caso 43 sin la regla por origen | rojo, nombrando la causa |
| `npm run a11y -- --todas` | **52/52**, 0 violaciones de cualquier impacto |
| `npm run contraste` | 36/36, 0 textos fuera de umbral |
| `npm run build` | verde |
| `alembic check` y `downgrade`/`upgrade` | sin diferencias, reversible |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

**Sigue el bloqueo de Docker**: no hay imágenes en el entorno y el registro
devuelve `Forbidden`. La suite corrió sobre la instalación nativa con el mismo
puente en el `PATH`, sin modificar `smoke.mjs`.

## 7. Riesgos y desvíos

**Un desvío necesario, y es grande: cambiar el destino rompía cuatro guiones.**
`smoke.mjs`, `a11y.mjs`, `contraste.mjs` y `mobile-audit.mjs` llenaban el
checkout con la provincia por nombre y la ciudad por texto. Los actualicé a los
selectores encadenados. No es alcance nuevo: es el costo de haber sacado el
texto libre, y sin eso ninguna puerta corría.

**Una decisión de criterio.** El listado aparece en el paso de envío, apenas se
elige la localidad, y no en un paso propio. Preferí eso a agregar un paso al
checkout: la persona ve los fletes mientras completa el destino y no queda una
pantalla más entre el carrito y el pago. Si preferís un paso separado, se mueve.

**Lo que la pieza no hace, a propósito:** no se elige transportista, no se
revela contacto, no se asigna a la orden, no hay tarifa, ruteo, mapa ni
capacidad automática. Las distancias son **en línea recta**, y la pantalla lo
dice.

**Una deuda que veo y no toqué:** los productos del seed no tienen localidad
oficial uniforme, así que en una demo recién instalada muchos grupos van a
mostrar «sin origen oficial». No lo arreglé porque tocar las localidades del
catálogo demo es dato de producto y cambia lo que se ve en el buscador. Decime
si querés que el seed les cargue localidad.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
