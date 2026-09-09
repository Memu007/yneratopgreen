# Reproducción PM — ACCOUNT-PAGE-1 — 2026-09-09

## Resultado

Aceptada tras `ACCOUNT-PAGE-1R`.

- Producto/regresión Dev: `7dc1d53`.
- Informe Dev: `968efbc`.
- PM revisó el delta completo de siete archivos; no toca Backend, pagos,
  secretos ni datos remotos y no agrega dependencias.
- PM reprodujo desde una base Docker local limpia 149, 150 y 163: **3/3**, 0
  fallos. El smoke incluyó build.
- Log persistente: `/private/tmp/topgreen-pm-account-149-150-163.log`.
- PM inspeccionó las seis capturas recuperables de Perfil y Mis publicaciones
  en 1440 × 900, 768 × 1024 y 390 × 844.
- `npm run lint`, `node --check scripts/smoke.mjs` y `diff-check`: verdes.

Corrección final:

- Producto/regresión: `958c11c`.
- Informe Dev: `16008a1`.
- El delta contra `7dc1d53` queda en una regla de
  `Header.module.css`, el bloque del caso 163 y el informe. La cuenta comparte
  el selector visual de la sección pública activa; no se copiaron colores ni
  se tocó navegación, guardias o layout.
- PM reprodujo el 163 desde otra base Docker local limpia: **1/1**, 0 fallos.
  Log persistente: `/private/tmp/topgreen-pm-account-163r.log`.
- PM inspeccionó las capturas corregidas de 1440 × 900 y 390 × 844: el acceso
  de cuenta queda blanco, con texto oscuro y peso activo, igual que una sección
  actual; el resto del shell y la página no cambió.
- `npm run lint`, `node --check scripts/smoke.mjs` y `diff-check`: verdes.

No hubo suite completa independiente de PM, Backend, a11y ni contraste total;
no se atribuyen. Los casos 147 y 148 fueron informados verdes por Dev, pero PM
no los repitió: 149, 150 y 163 cubren el riesgo nuevo y sus bordes de suciedad,
foco, navegación y presentación.

## Lo conforme

- Mi cuenta es una sección con URL propia, Header, Footer y scroll del
  documento; ya no es un diálogo general ni conserva backdrop o X.
- Atrás, Adelante y recarga preservan la navegación esperada.
- Entrada anónima, retorno después de ingresar, salida y vuelta de Mercado Pago
  aterrizan en destinos válidos.
- Las cinco salidas con trabajo local preguntan una vez; seguir editando
  conserva URL y contenido, descartar ejecuta el destino y suelta el borrador,
  y los datos persistidos no se confunden con suciedad.
- Las capas internas siguen cerrando de a una y devuelven el foco.
- Las tres anchuras no presentan desborde, controles fuera de pantalla ni
  palabras partidas.

## Omisión inicial y cierre

El contrato exige que el acceso a Mi cuenta quede marcado como página actual.
El botón lleva `aria-current="page"`, pero el único selector que dibuja el
estado activo es `.navLink[aria-current='page']`; el botón usa las clases
`.celda` y `.cuenta`. En las seis capturas se ve con el mismo fondo y peso que
una acción común de sesión. El caso 163 sólo comprueba el atributo ARIA, por lo
que queda verde aunque se retire toda señal visual.

`958c11c` reutiliza el mismo selector para `.navLink` y `.cuenta`. El 163 ahora
mide fondo, color y peso computados de una sección pública activa, prueba que
ese tratamiento difiere de una celda común y exige la misma salida en Mi
cuenta. PM reprodujo el cierre y la pieza queda aceptada sin reabrir ninguna
otra decisión.
