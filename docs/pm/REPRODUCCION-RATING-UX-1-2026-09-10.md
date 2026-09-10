# Reproducción PM — RATING-UX-1 — 2026-09-10

## Resultado

Devuelta como `RATING-UX-1R` por evidencia incompleta del caso 165; no por un
defecto de producto reproducido.

- Producto/regresión Dev: `96ac68b` y `08256c8`.
- Informe Dev: `50d4875`.
- Dev informó 149+150+165 en **3/3** dos veces y suite completa **164/165**,
  con único rojo 131 por la limitación ambiental ya documentada.
- PM revisó el delta completo y reprodujo el 165 desde otra base Docker limpia:
  **1/1**, salida 0. El smoke incluyó build.
- Log persistente: `/private/tmp/topgreen-pm-rating-165.log`.
- Capturas inspeccionadas en
  `/private/tmp/topgreen-pm-rating-165-capturas/`.
- No hubo suite completa PM.

## Producto conforme hasta esta puerta

- Usa el UUID `orderId` con `/ratings/order/{id}/can-rate`; el número visible
  queda sólo como rótulo.
- Consulta en paralelo sólo órdenes entregadas, distingue fallo de un “no” y
  ofrece reintento sin mostrar una acción de elegibilidad desconocida.
- Después de calificar vuelve a consultar al servidor; la recarga del caso
  conserva ausente el botón de esa orden.
- Sustituye los `span onClick` por cinco radios nativos dentro de `fieldset`, y
  la capa usa nombre, descripción, `useCapaModal` y la guarda ya aceptada.
- El perfil dibuja cinco estrellas cuando hay reputación y expone una sola
  descripción accesible; el estado sin calificaciones sigue siendo explícito.
- No hay cambios de Backend, contratos, migraciones ni dependencias.

## Tres afirmaciones todavía no medidas

1. La captura `calificacion-dialogo-390x844.png` no contiene un diálogo. La
   propia salida del caso dice «en 390 px se midió la lista sin botón» y la
   imagen muestra “Mis compras” cargando. El `else` crea un archivo con nombre
   de diálogo y cuenta la captura aun cuando no abre la capa.
2. El caso hace un clic en Enviar y espera el desmontaje; no retiene la
   solicitud ni intenta Escape/fondo durante el envío, ni demuestra que los
   tres botones estén deshabilitados o que no salga otro POST.
3. No fuerza un fallo de `POST /ratings/`; por eso no comprueba que la capa y
   los valores sobrevivan, que el error quede visible ni que un reintento
   deliberado produzca una sola fila.

La corrección queda limitada al arnés. Como el producto no cambia, no se
repiten suite, focales vecinos ni puertas totales. PM reproducirá sólo el 165
corregido y revisará sus tres capturas.
