# Dev → PM

Sol: este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-05. **Los cinco huecos, corregidos.** Commit `f7fd2a2`,
pusheado a `main`. No reescribí el prototipo: sólo toqué los puntos que
marcaste.

Todo sigue dentro de `docs/ux/logistica/`. **`src/` y `backend/` no cambian**,
así que no repetí los 25 casos de producto, como pediste.

---

## 1. Cada pedido exige una decisión explícita

Cuatro cambios, los cuatro verificados:

- **`Continuar` bloquea el avance** si algún pedido quedó sin resolver, sea
  porque no se eligió nada o porque se marcó "Necesito flete" y no hay
  transportista.
- **El aviso nombra los pedidos que faltan** —"decidí el traslado del pedido A
  y el pedido B"— en un `role="alert"`, y desaparece en cuanto el comprador
  hace algo.
- **El foco va al primer pedido incompleto**, que además queda con el borde
  ámbar.
- **Desde vacío y error, "Coordino por mi cuenta" guarda `false`** para ese
  pedido. Antes sólo cambiaba de pantalla y dejaba el estado nulo.
- **"Mis compras" ya no miente.** Si el traslado nunca se decidió dice *"Este
  pedido quedó sin resolver el traslado"*, no *"coordinás por tu cuenta"*.

```text
✓ con todo sin decidir, NO se llega al resumen
✓ el aviso nombra los pedidos que faltan
✓ el foco va al primer pedido incompleto
✓ con "necesito flete" y sin transportista, NO se llega al resumen
✓ desde error, "coordino por mi cuenta" deja el pedido resuelto
✓ sin decidir, Mis compras NO afirma que coordina por su cuenta
✓ con todo resuelto, Mis compras no marca pendientes
```

---

## 2. Sin nombre comercial

Aceptado. Los tres transportistas pasaron a nombres que hoy puede devolver
`full_name`: **Sebastián Duarte, Ramón Ledesma y Marcela Ibarra**. El dato se
rotula **"Transportista"**, no "nombre comercial".

No toqué el perfil productivo ni el esquema.

```text
✓ el nombre no promete un campo comercial
```

**Una salvedad honesta:** `full_name` es texto libre, así que un transportista
real puede escribir igual "Transportes La Carreta" ahí. El prototipo ya no
*promete* razón social, pero tampoco puede impedir que alguien la escriba. No
hay nada que hacer al respecto sin agregar validación, y no la propongo.

---

## 3. Las distancias dicen qué miden

Cada tarjeta muestra ahora **dos**, con su punta nombrada:

```text
DE SU BASE AL ORIGEN            DE SU BASE AL DESTINO
228 km  en línea recta,         196 km  en línea recta,
        hasta Reconquista               hasta Venado Tuerto

Las dos puntas del viaje caen dentro de su radio de 240 km.
```

Cuando la base coincide con una punta dice **"misma localidad"** en vez de
"0 km", que se lee mejor.

**Rehice los números ficticios, porque los anteriores eran incoherentes.**
Tenía a "Don Ramón" con base en Venado Tuerto y radio de 150 km apareciendo
como candidato para un tramo que arranca en Reconquista, a unos 390 km. Con
la regla de las dos puntas visible, esa inconsistencia quedaba a la vista.
Ahora los tres cierran contra su propio radio.

```text
✓ la tarjeta rotula las dos distancias
✓ cada distancia dice hasta qué punta se mide
✓ la tarjeta afirma que las dos puntas están cubiertas
✓ no hay ranking ni recomendación
```

---

## 4. Ni peso inventado ni contacto del comprador

La vista del transportista muestra **los artículos y cantidades que ya
existen en la orden**:

```text
Qué hay que mover
  · Semilla de soja RR — 40 bolsas de 50 kg
  · Inoculante — 4 unidades
  El sistema no calcula peso ni volumen.

Coordinación
  El comprador recibió tus datos y te contactará para coordinar.
```

El teléfono y el correo del comprador desaparecieron. Y los sumé a la lista
de "lo que no ves, y es a propósito", junto al precio, el comprobante y lo
bancario.

```text
✓ no hay peso inventado en la vista del transportista
✓ muestra los artículos y cantidades de la orden
✓ no expone teléfono ni correo del comprador
✓ explica que el comprador lo contacta
✓ no trae comprobantes ni datos bancarios
```

---

## 5. Contraste: tenías razón, y había una segunda

**Tu medición era correcta.** Blanco sobre `#059669`:

```text
blanco sobre #059669 (primary-600): 3.77   ← no llega a 4,5
blanco sobre #047857 (primary-700): 5.48
blanco sobre #065f46 (primary-800): 7.68
```

El gradiente ahora arranca en **primary-700** y termina en **primary-800**, así
que el punto más claro del botón da **5,48:1**. Son los dos tonos que ya
existían; no toqué la paleta.

**Y encontré una segunda que no estaba en tu lista.** `--text-tertiary` sobre
`--bg-tertiary` da **4,34:1**, y esa pareja se usaba en dos lugares: el aviso
"Los datos de contacto aparecen cuando lo seleccionás" y **los pasos inactivos
del checkout** —"Carrito", "Pago"—. Los dos pasaron a `--text-secondary`, que
sobre el mismo fondo da **6,92:1**.

Esta vez **no heredé nada**: escribí un medidor que recorre el DOM de las ocho
vistas, resuelve el fondo efectivo subiendo por los ancestros y calcula el
ratio WCAG de cada texto, con el umbral 3:1 para texto grande y 4,5:1 para el
resto.

```text
✓ contraste: 146 textos medidos, peor 4.52:1 en c-busqueda (P.ayuda)
```

**146 textos, ninguno por debajo del mínimo.** El peor es un texto de ayuda a
4,52:1 — pasa raspando, y lo dejo señalado: si algún día se aclara
`--text-tertiary`, ese es el primero que cae.

Los elementos con gradiente los mide el navegador como "sin color de fondo
sólido", así que ésos los calculé aparte, sobre los dos extremos del
gradiente. Son los tres números de arriba.

---

## Las ocho puertas de aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | No se llega al resumen/pago con un pedido sin resolver | ✅ |
| 2 | Vacío y error permiten marcar "coordino por mi cuenta" | ✅ |
| 3 | Sin peso inventado ni contacto del comprador | ✅ |
| 4 | Cada tarjeta muestra las dos distancias con sus extremos | ✅ |
| 5 | Los nombres no prometen un campo comercial | ✅ |
| 6 | Todo texto normal en 4,5:1 o más; controles y foco visibles | ✅ 146 medidos, peor 4,52:1 |
| 7 | Capturas afectadas actualizadas | ✅ ver abajo |
| 8 | `node --check`, `npm run build`, `git diff --check` | ✅ los tres |

```text
$ node --check docs/ux/logistica/prototipo.js     → OK
$ npm run build                                   → ✓ built in 1.85s
$ git diff --cached --check                       → (sin salida)
```

**Sobre el criterio 7, para ser precisa:** pediste actualizar *solamente* las
capturas afectadas, y **actualicé las diecinueve**. El cambio de contraste toca
los botones primarios y los pasos del checkout, que aparecen en casi todas las
pantallas; y el de nombres y distancias toca el resto. Preferí regenerarlas
todas antes que dejar dos afirmando cosas viejas.

---

## Decisiones que no tomé

1. **No implementé el `locality_id` de destino** que marcaste como cimiento de
   Fase 2. Lo dejé como está.
2. **No agregué validación al nombre** para impedir que alguien escriba una
   razón social en `full_name`. Sería inventar una regla de negocio.
3. **No cambié el flujo aprobado.** El flete sigue siendo opcional; lo que
   ahora es obligatorio es *elegir una de las dos salidas*, que es exactamente
   lo que pediste.
4. **No toqué código productivo.** Ninguno de los cinco arreglos lo necesitó,
   así que no aplicó tu condición de freno.

---

## Riesgos que quedan

**El prototipo y la aplicación tienen contrastes distintos ahora.** El
gradiente que corregí acá sigue igual en `src/index.css`: la aplicación real
usa `#059669 → #047857` y por lo tanto **tiene el mismo 3,77:1 en todos sus
botones primarios**.

No lo toqué porque es código productivo y esta pieza no lo incluye. Pero es
una falla de accesibilidad **que existe hoy en producción**, no sólo en el
prototipo. Cambiar un token de color es media hora. **Decime si querés que
entre como pieza chica** o si va a la revisión final de la Fase 5.

Lo demás sigue como te lo dije: el prototipo se va a desactualizar contra el
producto, y conviene borrarlo cuando la Pieza B esté hecha.

---

## Lo que necesito de vos

1. **Que aceptes o rechaces esta corrección.**
2. **La decisión sobre el gradiente de `src/index.css`**, que es el mismo
   problema de contraste pero en la aplicación de verdad.
3. **El enunciado de la próxima pieza**, si con esto cierra la puerta de
   Fase 1.

El entorno local sigue levantado.
