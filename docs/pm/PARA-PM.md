# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Hay dos entregas esperando tu revisión: REV1-PENDIENTES-1, arriba, y
PUBLISH-FIELDS-1, abajo, sin cambios desde `c5071fc`.

## REV1-PENDIENTES-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `c5071fc` (la entrega de PUBLISH-FIELDS-1) |
| código | `74b0666` las páginas y Mercado Pago · `3b66e21` la notificación de cancelación |
| casos y negativos | `30a513e` |
| guías | `7fa6316` |
| no integrado, no desplegado | `main` está en `c92c0d7` (ver «Para que lo sepas») |

**Resultado.**

- **Inicio ya no muestra publicaciones.** Salieron la sección «Mercado
  activo» y su encabezado. El único acceso al Mercado de la página es
  «Ir al Mercado», arriba.
- **«Lo que muestra cada publicación.»** reemplaza a «Los datos que definen
  la publicación.». Los tres ítems:
  - «Precio y modalidad»: el precio, su unidad y, en los servicios, cómo se
    cobra. Sin precio publicado, se pide cotización.
  - «Ubicación y alcance»: la localidad, la cobertura de un servicio y el
    radio de alcance de cada transportista.
  - «Quién publica y qué se puede hacer»: el nombre y la reputación de quien
    publica, y la acción disponible (agregar al carrito, contratar o pedir
    cotización).

  Sin «honesta». La bajada de Inicio dice ahora «Publicaciones con precio y
  modalidad, ubicación y quién publica.».
- **El bloque que se repetía era la invitación del final** (resuelve #6 y
  #14 juntos):
  - estaba en Inicio («¿Tenés algo para ofrecer?», con «Publicar una oferta»
    y «Ver el mercado») y en Quiénes somos («¿Listo para transformar tu
    producción?», con «Comenzar a Vender» y «Explorar Productos»);
  - en Contacto no estaba;
  - es el bloque de la captura de la clienta, sobre el pie.

  **Quedó sólo en Quiénes somos,** que no tenía otro camino al Mercado. Dice
  «Publicá o buscá en el Mercado agropecuario», con «Publicá un equipo, un
  insumo o un servicio, o buscá lo que necesitás.» y dos botones: «Publicar
  una oferta» e «Ir al Mercado». Inicio no la necesita, porque arriba tiene
  los mismos dos botones.
- **Contacto sin preguntas frecuentes.** El formulario y los datos de
  contacto siguen.
- **Quiénes somos sin «Nuestro equipo».** Salió también su foto del sitio
  (`public/MercedesRaiz.jpg`); queda en la historia de Git si vuelve.
- **Nada visible dice «comisión».**
  - La vinculación de Mercado Pago decía «no te cobra comisión por vender».
    Ahora dice «AgroBoeda no los recibe ni los reparte. Mercado Pago
    descuenta lo que cobra por cada venta, como en cualquier venta tuya.».
  - Las dos guías decían «no cobra, no recibe ni guarda el dinero»; ahora
    dicen «no recibe ni guarda».
  - Se mantienen, como pediste: la plataforma no recibe ni guarda el dinero,
    y la transferencia la confirma quien vende.
  - La conducta no cambió: la preferencia sigue sin `marketplace_fee` (caso
    79 en verde).
- **Caso 209 en verde y los tres negativos en rojo, cada uno por su
  motivo.**
- **Las dos guías coinciden.**

**Para que lo sepas.**

1. **Corregí una «comisión» que el pedido no nombraba.** Quien compra y
   cancela una orden recibía la notificación «Se te devolverá el 95% del
   monto (se descuenta la comisión del 5%)». Es falso: AgroBoeda no cobra
   ese 5 % ni tiene el dinero para devolverlo. Ahora dice «Tu pedido #… fue
   cancelado.». Es un commit aparte (`3b66e21`); si preferís otro texto, se
   cambia ahí.
2. **Dejé en Inicio el total** («N publicaciones disponibles ahora»). Es un
   número, no son publicaciones. Si lo querés fuera también, es una línea.
3. **`main` ya no está donde dije.** Está en `c92c0d7`, que integra
   USER-GUIDE-1 hasta tu aceptación. En el informe de PUBLISH-FIELDS-1
   escribí que seguía en `238d113` y no lo había verificado. Yo no toqué
   `main`.

**No toqué**, como pediste: la idea rectora de Inicio (#5), AgroMarket
(#10), misión y visión (#12), retener fondos o cobrar comisión (#11b) y la
logística en los filtros.

## Casos

| caso | qué mira, en escritorio y en celular |
|---|---|
| 209 | Inicio sin tarjetas ni «Publicaciones disponibles», con el total y un solo camino al Mercado («Ir al Mercado», que llega). «Lo que muestra cada publicación.» con sus tres ítems, sin «honesta», «precio o modalidad», «próximo paso» ni «Antes de avanzar». La invitación, una sola vez y sólo en Quiénes somos, con sus dos botones. Contacto sin preguntas frecuentes. Quiénes somos sin «Nuestro equipo» y sin pedir la foto. Nada dice «comisión»: las tres páginas, el Mercado, Mercado Pago sin vincular y vinculado, y la notificación de quien canceló. Ninguna página desborda a lo ancho |

**Contra el código de antes** (`c5071fc`), el 209 encuentra 60 problemas:
todos los puntos, en los dos anchos. Incluye la notificación del 95 %.

**Casos viejos ajustados**, porque leían lo que se fue: 124 (ahora mira el
total de Inicio y qué pasa si la API se cae), 139, 140, 147, 148, 155,
167, 168, 170, 175, 183, 192 y 208. Donde abrían una ficha desde las
tarjetas de Inicio, la abren desde el Mercado.

## Negativos

`python3 scripts/sabotajes_rev1_pendientes_1.py` → «todos dieron el rojo
esperado» y «src después: como estaba».

| sabotaje | rojo del 209 |
|---|---|
| `inicio-con-publicaciones` | «Inicio muestra 1 publicación(es)», en los dos anchos; nada más |
| `faq-de-vuelta` | «Contacto vuelve a tener «Preguntas Frecuentes»» y la pregunta, en los dos anchos; nada de Inicio ni de comisión |
| `comision-visible` | «Mercado Pago vinculado dice «comisión»», en los dos anchos; nada más |

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=209 node scripts/smoke.mjs
# → 1/1 pasaron; 0 fallaron

python3 scripts/sabotajes_rev1_pendientes_1.py
# → todos dieron el rojo esperado

node scripts/guia-usuario.mjs
# → LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular
```

Aviso de entorno: el 209 levanta el doble local de Mercado Pago en el puerto
8099, como los casos de Mercado Pago (62 a 100). Si ese puerto está ocupado,
no arranca.

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `7fa6316` | «208/209 pasaron; 1 fallaron»: sólo el 131, de entorno (el puente no traduce `docker run`). El 79, sin `marketplace_fee`, en verde |
| tipos, lint, build | verdes |
| `compileall`, `node --check`, parseo de Python | verdes |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` y finales de línea | limpios |
| a11y `--todas` | 80 de 80, sin violaciones bloqueantes |
| contraste | 88 de 88 |
| auditoría móvil | 12 de 12 recorridos, 39 pantallas, sin desbordes, controles tapados, errores de consola ni respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |

## Riesgos y visto de paso

- **La ficha ya no se abre desde Inicio**, así que su salida «Volver a
  Inicio» y la tarjeta «compacta» quedaron sin uso. No las saqué: son
  pocas líneas y vuelven si Inicio vuelve a mostrar algo.
- **P2, visto de paso:** cuando quien vende rechaza un pedido, quien compra
  lee «El monto total será reembolsado.». AgroBoeda no reembolsa nada: el
  dinero, si lo hubo, fue a quien vende. No es «comisión» y no lo toqué. Te
  recomiendo cambiarlo en una tarea chica, junto con cualquier otro texto de
  notificaciones que hable de dinero.

## PUBLISH-FIELDS-1: entrega (sin cambios desde `c5071fc`)

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `fd22e83` |
| código | `843126b` |
| casos y negativos | `c0f44ae` |
| guía de uso | `78b59a9` |
| no integrado, no desplegado | `main` está en `c92c0d7` (ver arriba) |

**Resultado.**

- **El alta ya no ofrece «Características» ni «Etiquetas»,** ni de producto ni
  de servicio. Salieron también su estado, sus manejadores, sus estilos y los
  dos campos del tipo. La edición no los tenía. Nada fuera del alta los usaba.
- **La ficha muestra «Marca: John Deere»** junto al modelo y el año. Sin
  marca, no hay fila.
- **«Editar» cambia la marca** con la misma lista del alta, sólo en las
  categorías que la usan, y «Sin declarar» la quita.
- **Inicio, el Mercado y la ficha dicen «publicaciones»**, también en lo que
  lee el lector de pantalla.
- **Casos 207 y 208 en verde; los tres negativos, en rojo por su motivo.**
- **Las dos guías coinciden.**

**Para que lo sepas: una parte del pedido no se puede hacer en «Editar».**
Pediste que «Editar» suelte la marca «al pasar a Insumos», pero en «Editar»
la categoría está bloqueada y dice «La categoría no se puede cambiar»: no hay
cómo pasar a Insumos desde ahí. No la hice editable, porque eso sería producto
nuevo. Lo comprobé donde sí pasa:

- la API, al pasar la publicación a Insumos, suelta la marca;
- «Editar» de un insumo no ofrece marca.

Si querés que la categoría se pueda cambiar desde «Editar», es otra tarea.

### Dónde queda «operación», y por qué

Cambié todo lo visible de Inicio, el Mercado y la ficha:

- Inicio: «Explorar publicaciones», «Publicaciones disponibles», el medidor
  («… publicaciones disponibles ahora»), «Ver todas las publicaciones»,
  «Todavía no hay publicaciones.», el error de carga, y los títulos para el
  lector de pantalla;
- **«Los datos que definen la publicación.»** El título cambia acá; el resto
  de ese bloque es de REV1-PENDIENTES-1;
- el Mercado: el conteo («N publicaciones»), «No hay publicaciones con estos
  filtros.», el paginador («Página siguiente de publicaciones») y su título
  para el lector de pantalla;
- la ficha que no está: «Las publicaciones vigentes están en el Mercado.».

**Lo dejé donde sí es una operación concretada:**

- **«Mis Operaciones» del transportista, con «Operación #…»,** su carga y su
  error. Son los viajes que le asignaron, con orden creada.
- **El panel de administración:** «no … garantiza la operación», sobre la
  documentación. Habla de la compraventa.

**Y en un sentido que no es éste:** en «Quiénes somos», «empresas que buscan
optimizar sus operaciones» habla de las operaciones del productor, no de las
publicaciones. Lo dejé; si preferís otra palabra, es copy de esa página.

Los nombres internos no cambiaron.

### Casos

| caso | qué mira |
|---|---|
| 207 | el alta de producto y de servicio sin «Características» ni «Etiquetas»; la ficha con «Marca: John Deere» justo antes de «Modelo», y sin fila si no hay marca; «Editar» con la lista del alta, que cambia a Case y la quita con «Sin declarar»; en Insumos, la marca se suelta y no se ofrece |
| 208 | en escritorio y celular: Inicio, el Mercado con y sin resultados, la ficha y la ficha que no está dicen «publicaciones», y ninguna dice «operación», ni en el texto, ni en los nombres accesibles, ni en lo escondido para el lector de pantalla |

### Negativos

`python3 scripts/sabotajes_publish_fields_1.py` → «todos dieron el rojo
esperado» y «src después: como estaba».

| sabotaje | rojo |
|---|---|
| `ficha-sin-marca` | 207: «la ficha con marca dice «Marca: undefined» y no «Marca: John Deere»»; nada de «Editar» |
| `editar-sin-marca` | 207: ««Editar» no ofrece la marca»; nada de la ficha |
| `conteo-con-operaciones` | 208: «el conteo del Mercado dice «24 de 241 OPERACIONES»», en escritorio y en celular; nada de Inicio ni de la ficha |

### Las guías

- **`docs/USER_MANUAL.md`:** la ficha nombra «Marca» (paso 7); «Editar» la
  cambia y «Sin declarar» la quita (paso 16). La lista final ya no tiene el
  defecto de características y etiquetas. El programa comprueba «Marca: John
  Deere» en las dos fichas y el cambio a Case y a «Sin declarar».
- **La guía del panel** no nombraba nada de esto y sigue coincidiendo.

### Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=207,208 node scripts/smoke.mjs
# → 2/2 pasaron; 0 fallaron

python3 scripts/sabotajes_publish_fields_1.py
# → todos dieron el rojo esperado

node scripts/guia-usuario.mjs
# → LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular
```

### Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `78b59a9` | «207/208 pasaron; 1 fallaron»: sólo el 131, de entorno |
| tipos, lint, build | verdes |
| `compileall`, `node --check`, parseo de Python | verdes |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` y finales de línea | limpios |
| a11y `--todas` | 80 de 80, sin violaciones bloqueantes |
| contraste | 88 de 88 |
| auditoría móvil | 12 de 12 recorridos, 39 pantallas, sin desbordes ni controles tapados |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «22 pasos, 352 textos citados» y «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |

### Riesgos y visto de paso

- **El nombre de la marca sale de la lista del alta** (`/catalog/form-options`),
  en el frontend. Si la administración saca una marca de la lista, las
  publicaciones que ya la tienen la muestran por su valor
  (`john-deere`). No toqué la API.
- **«Editar» manda la marca sólo si cambió.** La API rechaza una marca que ya
  no está en la lista; reenviarla sin tocarla impediría guardar lo demás de
  esas publicaciones.
- **La ficha conserva el código de «Especificaciones declaradas»,** que se
  alimenta de las características. Nunca se muestra, porque la API no las
  devuelve. No lo saqué: no es del alta. Si querés, entra en una limpieza.
- **Inicio cambió otra vez con REV1-PENDIENTES-1,** que sacó sus
  publicaciones. El 208 ya se ajustó ahí (`30a513e`).
