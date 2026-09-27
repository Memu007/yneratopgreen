# Reproducción PM — PUBLISH-FIELDS-1 y REV1-PENDIENTES-1

Fecha: 2026-09-27. Base `fd22e83` (la asignación de las dos piezas).

PUBLISH-FIELDS-1:

- Código: `843126b`.
- Casos y negativos: `c0f44ae`.
- Guía de uso: `78b59a9`.
- Informe: `c5071fc`.

REV1-PENDIENTES-1:

- Páginas y Mercado Pago: `74b0666`.
- Notificación de cancelación: `3b66e21`.
- Casos y negativos: `30a513e`.
- Guías: `7fa6316`.
- Informe: `4d5e409`.

`main` está en `c92c0d7`. **Las dos, aceptadas en rama**, sin integración ni
despliegue.

## Qué cambia

**PUBLISH-FIELDS-1**

- **El alta ya no ofrece «Características» ni «Etiquetas»**, ni en productos
  ni en servicios. Eran los dos bloques que se perdían al publicar.
- **La ficha muestra «Marca»** junto al modelo y al año. Si no hay marca, no
  hay fila.
- **«Editar» cambia la marca** con la misma lista del alta, y «Sin declarar»
  la quita.
- **«Publicaciones» en vez de «operaciones»** en Inicio, en el Mercado y en la
  ficha, también en lo que lee el lector de pantalla. Es la devolución #3.
  - «Operación» queda en «Mis Operaciones» del transportista, porque ahí son
    viajes con una orden creada.
  - En el panel, «garantiza la operación» habla de la compraventa.

**REV1-PENDIENTES-1**, devolución de la clienta del 20/09:

- **#2:** Inicio no muestra publicaciones y ya no dice «Mercado activo».
  Queda el total, que es un número, y un solo botón al Mercado.
- **#4:** «Lo que muestra cada publicación» tiene tres ítems:
  - «Precio y modalidad»;
  - «Ubicación y alcance», que nombra el radio de alcance del transportista;
  - «Quién publica y qué se puede hacer».

  Ya no dice «honesta».
- **#6 y #14:** el bloque repetido era la invitación del final. Estaba en
  Inicio y en Quiénes somos. Quedó sólo en Quiénes somos, con el texto
  «Publicá o buscá en el Mercado agropecuario».
- **#11a:** Contacto ya no tiene preguntas frecuentes.
- **#13:** Quiénes somos ya no tiene «Nuestro equipo», y la foto salió del
  sitio.
- **Nada visible dice «comisión».**
  - Mercado Pago en el panel: ahora dice que AgroBoeda no recibe ni reparte
    el dinero, y que Mercado Pago descuenta lo suyo.
  - En las dos guías: «no recibe ni guarda».
  - La notificación a quien cancela prometía «Se te devolverá el 95% del
    monto (se descuenta la comisión del 5%)». Era falsa y la dev la corrigió
    sin que se lo pidieran.

  La preferencia sigue sin `marketplace_fee`: el caso 79 está en verde.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `4d5e409`.

| Verificación | Resultado |
|---|---|
| Casos 207, 208 y 209 | **3/3** |
| Caso 79 suelto | falla con «Cannot read properties of undefined (reading 'localityId')»: depende de datos de casos anteriores. **En la suite completa pasa.** Es un defecto del arnés (P3), no del producto |
| Negativos de la Dev, PUBLISH-FIELDS-1: ficha sin marca, «Editar» sin marca, conteo con «operaciones» | **tres rojos esperados**; «src después: como estaba» |
| Negativos de la Dev, REV1-PENDIENTES-1: Inicio con publicaciones, FAQ de vuelta, «comisión» visible | **tres rojos esperados**; «src después: como estaba» |
| Negativo PM 1: la notificación de cancelación vuelve a prometer el 95 % | **rojo** en el 209: «la notificación de quien canceló dice «comisión»» y «promete devolver dinero», en los dos anchos |
| Negativo PM 2: vuelve «¿Listo para transformar tu producción?» | **rojo** en el 209: «Quiénes somos tiene 0 invitación(es) …» y «dice «¿Listo para transformar tu producción?»», en los dos anchos |
| Negativo PM 3: vuelven «Precio o modalidad» y «honesta» | **rojo** en el 209: «no dice «Precio y modalidad»», «dice «honesta»» y «dice «precio o modalidad»», en los dos anchos |
| Negativo PM 4: «Editar» muestra la marca pero no la manda a la API | **rojo** en el 207: «cambiar a Case guardó «john-deere»» y «Sin declarar» dejó «john-deere» |
| Suite completa desde base recién creada | **208/209**; sólo cae el **169**, de entorno; el 79, el 131 y el 191 pasan |
| a11y `--todas` / contraste / auditoría móvil | **80/80**, **88/88**, **12/12** sin desbordes |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 26 pasos y 22 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check `fd22e83..4d5e409` con `cr-at-eol` | verdes; no hay migración nueva |
| Búsqueda de «comisión» y «operación» visibles en `src` y `backend/app` | queda sólo lo que la dev declaró: el transportista, el panel y «optimizar sus operaciones» en Quiénes somos |
| `PRE_FIRMA.md` o `.env` en el árbol | ninguno |

## Decisiones PM sobre los informes

- **«Editar» no cambia la categoría.** Por eso la parte de «soltar la marca
  al pasar a Insumos» no se puede hacer desde la pantalla. **Se acepta** que
  se compruebe por la API: la API suelta la marca, y «Editar» de un insumo no
  la ofrece. Hacer la categoría editable no se pidió.
- **El total en Inicio**, «N publicaciones disponibles ahora», **se queda**:
  es un número, no son publicaciones. Si la clienta lo quiere fuera, es una
  línea.
- **«Optimizar sus operaciones»** en Quiénes somos se queda. Habla de las
  operaciones del productor, y ese texto se va a reescribir con misión y
  visión (#12).
- **La notificación del 95 %:** se acepta la corrección y el texto nuevo.
- **P2, a la tarea siguiente (`TEXTOS-DINERO-1`).** Cuando quien vende
  rechaza un pedido, quien compra lee «El monto total será reembolsado.».
  Es falso: AgroBoeda no tiene el dinero. Es la misma clase de defecto que el
  95 %. Ya está en `main`, así que no es una regresión de estas piezas.
- **P3, a la misma tarea:**
  - el comentario de `AboutPage.tsx` le atribuye a la clienta un motivo que
    no dio. Ella dijo «por ahora», y el repositorio se le entrega;
  - el caso 79 no corre suelto.
- **P3 sin tarea:**
  - la salida «Volver a Inicio» de la ficha y la tarjeta «compacta» quedaron
    sin uso;
  - el código de «Especificaciones declaradas» de la ficha nunca se muestra.

No se tocó `main`, Railway ni datos reales.
