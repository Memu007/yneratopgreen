# Reproducción PM — CATALOG-PHOTOS-1 — 2026-09-09

## Resultado

Aceptada por decisión de Emi.

- Producto/regresión Dev: `e3c277e`.
- Informe Dev: `b414cfb`.
- Integración exacta en `main`: `b26d8ad`.
- PM revisó el delta completo de 37 archivos y `diff-check` quedó limpio.
- PM reprodujo desde una base Docker local limpia los casos 155 y 162:
  **2/2**, 0 fallos.
- Log persistente: `/private/tmp/topgreen-pm-catalog-155-162.log`.
- El smoke incluyó build y produjo seis capturas recuperables: Cuadrícula,
  Lista y dos detalles en escritorio; Cuadrícula y detalle de servicio en
  móvil. PM las inspeccionó sin encontrar overflow ni geometrías accidentales.
- PM comprobó de forma sólo lectura que Railway ya sirve la integración: el
  Mercado publicado muestra las fotos locales y conserva las fotos reales de
  publicaciones del usuario.

No hubo suite completa independiente de PM, Backend, a11y ni contraste total;
no se atribuyen. La reproducción fue la focal acordada para este cambio visual.

## Alcance comprobado

- Los 30 slugs del seed resuelven 30 WebP locales distintos, todos de
  1600 × 1000, sin hotlinks.
- Una foto real del vendedor conserva prioridad y un slug ajeno sin foto usa
  el respaldo honesto.
- Artículos, servicios y logística muestran imagen en Cuadrícula, Lista y
  detalle sin perder sus datos ni acciones.
- El detalle acredita obra, autor, licencia y adaptación.

## Decisión explícita sobre dos imágenes

Dev y PM identificaron dos desajustes del paquete: la foto de
`manga-ganadera-balanza-electronica` muestra una balanza antigua de museo y la
de `dron-pulverizador-agricola-20l` incluye cartelería al fondo visible en el
detalle. PM preparó alternativas, pero Emi decidió cerrar las fotos en su
estado actual y continuar con la página de cuenta. No se abrió una corrección y
no se cambiaron esos activos.

