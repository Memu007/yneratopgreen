# Reproducción PM — RATING-UX-1 — 2026-09-10

## Resultado

Aceptada tras `RATING-UX-1R`.

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
- Corrección Dev `c88b7ea` e informe `263a88a`: sólo arnés. PM reprodujo el
  165 corregido desde otra base Docker limpia en **1/1**, salida 0. Log:
  `/private/tmp/topgreen-pm-rating-165r.log`; capturas:
  `/private/tmp/topgreen-pm-rating-165r-capturas/`.

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

## Huecos detectados en la entrega base

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

## Corrección cerrada

`c88b7ea` eliminó el fallback que fabricaba una captura móvil y abre la capa
real sobre la orden propia antes de calificar. El caso exige nombre visible,
ancho contenido y ausencia de desborde a 390 px; PM inspeccionó la captura y la
capa aparece completa con cinco estrellas, comentario y acciones.

También retiene el primer POST: Escape y fondo no cierran ni abren la pregunta
de salida, los tres controles quedan deshabilitados y no sale otra solicitud.
El fallo controlado deja alerta, puntaje y comentario; el reintento real termina
con dos intentos deliberados y una única fila. Luego conserva el veredicto del
servidor y la ausencia del botón tras recargar.

La evidencia final combina la suite Dev **164/165**, con único rojo 131
ambiental, y dos ejecuciones focales independientes PM del 165 en **1/1** cada
una. No se declara suite completa PM 165/165.
