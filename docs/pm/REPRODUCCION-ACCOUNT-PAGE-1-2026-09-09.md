# Reproducción PM — ACCOUNT-PAGE-1 — 2026-09-09

## Resultado

Devuelta como `ACCOUNT-PAGE-1R` por una única omisión visual.

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

## Omisión que impide aceptar

El contrato exige que el acceso a Mi cuenta quede marcado como página actual.
El botón lleva `aria-current="page"`, pero el único selector que dibuja el
estado activo es `.navLink[aria-current='page']`; el botón usa las clases
`.celda` y `.cuenta`. En las seis capturas se ve con el mismo fondo y peso que
una acción común de sesión. El caso 163 sólo comprueba el atributo ARIA, por lo
que queda verde aunque se retire toda señal visual.

La corrección debe reutilizar el tratamiento activo existente y hacer que el
163 compare el estilo computado del acceso a Mi cuenta con el de una sección
activa real, sin copiar colores duros. No se reabre ninguna otra decisión.

