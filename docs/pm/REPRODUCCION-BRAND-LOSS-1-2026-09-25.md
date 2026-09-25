# Reproducción PM — BRAND-LOSS-1

Fecha: 2026-09-25. Base de la tarea `78ad03d`. Arreglo `95180a1`, token de
administración del smoke `43f3b20`, informe Dev `fe2572b` (sólo
`docs/pm/PARA-PM.md`). `main` permanece en `0bd7fbc`. **Aceptada en rama.**
Sin cambios en `src/` ni en `backend/`, sin integración ni despliegue.

## La causa

La marca la borraba **el arnés, no el producto**: el caso 74 del smoke.

- Para probar un freno de migración, el caso bajaba la base compartida a
  `c4a91e37d5b8` y la volvía a subir.
- La bajada de `e4a72c9b1f35` borra la columna `products.brand`. Al volver a
  subir, la columna nace vacía.
- Las mismas bajadas vaciaban también otras columnas y tablas: la
  documentación de vendedores, las reservas de stock, el medio de pago, la
  condición y la anatomía, los datos del transportista y las tablas de
  Mercado Pago.

Todo esto pasaba sólo en la base local de la suite; ningún dato real se tocó
nunca. Los casos que corrían después del 74 lo hacían sobre una base a medio
vaciar.

**Corrección de la hipótesis PM:** las horas 22:10 y 22:11 no marcaban el
borrado. Borrar una columna no cambia `updated_at`, así que esas horas eran
ediciones posteriores de otros casos.

## El arreglo

- El caso 74 trabaja sobre una copia: `CREATE DATABASE … TEMPLATE`. La borra
  al terminar.
- `scripts/lib/sql.mjs` acepta `{ base }`.
- El caso 187 publica su propia publicación con marca y la retira al
  terminar.
- `guia-admin.mjs` lee los importes en centavos.
- `tokenDeAdmin` vuelve a ingresar si el token guardado venció.

## Reproducción PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
`.env` inventados, con la configuración local de `entorno_nativo.sh`.

| Verificación | Resultado |
|---|---|
| **Causa**: caso 74 del smoke de la base (`78ad03d`) | **1/1**, y las dos marcas pasan de `john-deere`/`pauny` a **`NULL`** |
| Caso 74 del candidato, base recién creada | **1/1**; las marcas quedan **intactas**; no queda la base copia (`postgres,topgreen`) |
| Caso 187 con las marcas de la siembra en `NULL` a mano | **1/1**; al terminar no queda ninguna publicación activa con marca |
| Suite completa, base recién creada | **172/191**; marcas **intactas** antes y después; 74, 187, 190 y 191 en verde; no queda la base copia |
| Los 18 casos que cayeron en cadena por el 169 (167, 168, 170–185), después de reiniciar la API | **18/18** |
| `guia-admin.mjs` después de la suite (51 de 112 órdenes con centavos) | **26/26** en escritorio y **26/26** en celular; el paso 2 lee bien «Volumen vendido» |
| Tipos, lint, `node --check` de los tres scripts, diff-check con `cr-at-eol` | verdes |
| `git diff 78ad03d 43f3b20 -- src backend` | vacío |

El 169, el reinicio real de la API, sigue siendo de entorno en la revisión
PM: 190 de 191 casos quedan cubiertos.

## Registrado sin tarea

- **P3:** los casos 55 y 58 hacen `downgrade -1`. Hoy eso sólo deshace un
  índice, así que no pierden datos, pero ya no miden lo que medían cuando se
  escribieron.
- **Implicancia para la evidencia anterior:** las suites completas que
  corrieron el 74 viejo pusieron a prueba todo lo posterior sobre una base
  parcialmente vaciada. No invalida las aceptaciones, porque cada pieza tuvo
  su caso focal. Sí es una razón para que la suite previa a publicar se corra
  sobre este candidato o uno posterior.

No se tocó `main`, Railway ni datos reales.
