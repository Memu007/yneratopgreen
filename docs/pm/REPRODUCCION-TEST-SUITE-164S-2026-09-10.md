# Reproducción PM — TEST-SUITE-164S — 2026-09-10

## Resultado

Devuelta como `TEST-SUITE-164SR` por una única frase obsoleta en la salida.

- Arnés Dev: `6d20ecf` y `4319623`.
- Informe Dev: `819cead`.
- El delta de producto es vacío: ambos commits modifican sólo
  `scripts/smoke.mjs`.
- Dev informó suite completa **163/164**, con único rojo 131 por la
  incompatibilidad ambiental documentada del puente Docker nativo.
- PM revisó el delta y reprodujo juntos 21, 54, 57, 125, 157 y 162 desde base
  Docker limpia: **6/6**, salida 0. Log persistente:
  `/private/tmp/topgreen-pm-suite-21-54-57-125-157-162.log`.
- `node --check` y `diff-check`: verdes.

## Lo conforme

- 21 fabrica una publicación sin foto y otra con carga real; ya no depende de
  un producto previo ni de que las fotos demo usen `/uploads/`.
- 54 y 57 preparan sesión y localizan Mi cuenta como página, conservando sus
  comprobaciones de privacidad logística y snapshot de origen.
- 157 limpia sólo publicaciones propias dejadas por ejecuciones anteriores y
  mantiene la comprobación de que un segundo seed no pisa la publicación.
- 162 guarda estados, vuelve visibles los 30 slugs demo, aparta temporalmente
  publicaciones ajenas y restaura fila por fila en `finally`.
- 125 admite únicamente foto local del catálogo o fallback honesto y sigue
  rechazando imágenes remotas o aleatorias junto a precios reales.

## Única corrección

La salida verde del 125 todavía dice «las publicaciones son servicios o
logística de la base y no ganan foto». Esa afirmación quedó derogada por
`CATALOG-PHOTOS-1` y contradice tanto el código nuevo como el 162: los servicios
demo sí tienen foto local. Debe reemplazarse por una frase que diga que sólo
usan foto local del catálogo o el respaldo honesto. No cambia comportamiento y
no requiere otra corrida Docker.
