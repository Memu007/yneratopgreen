# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PUBLISH-FIELDS-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `fd22e83` |
| código | `843126b` |
| casos y negativos | `c0f44ae` |
| guía de uso | `78b59a9` |
| no integrado, no desplegado | `main` sigue en `238d113` |

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

## Dónde queda «operación», y por qué

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

## Casos

| caso | qué mira |
|---|---|
| 207 | el alta de producto y de servicio sin «Características» ni «Etiquetas»; la ficha con «Marca: John Deere» justo antes de «Modelo», y sin fila si no hay marca; «Editar» con la lista del alta, que cambia a Case y la quita con «Sin declarar»; en Insumos, la marca se suelta y no se ofrece |
| 208 | en escritorio y celular: Inicio, el Mercado con y sin resultados, la ficha y la ficha que no está dicen «publicaciones», y ninguna dice «operación», ni en el texto, ni en los nombres accesibles, ni en lo escondido para el lector de pantalla |

## Negativos

`python3 scripts/sabotajes_publish_fields_1.py` → «todos dieron el rojo
esperado» y «src después: como estaba».

| sabotaje | rojo |
|---|---|
| `ficha-sin-marca` | 207: «la ficha con marca dice «Marca: undefined» y no «Marca: John Deere»»; nada de «Editar» |
| `editar-sin-marca` | 207: ««Editar» no ofrece la marca»; nada de la ficha |
| `conteo-con-operaciones` | 208: «el conteo del Mercado dice «24 de 241 OPERACIONES»», en escritorio y en celular; nada de Inicio ni de la ficha |

## Las guías

- **`docs/USER_MANUAL.md`:** la ficha nombra «Marca» (paso 7); «Editar» la
  cambia y «Sin declarar» la quita (paso 16). La lista final ya no tiene el
  defecto de características y etiquetas. El programa comprueba «Marca: John
  Deere» en las dos fichas y el cambio a Case y a «Sin declarar».
- **La guía del panel** no nombraba nada de esto y sigue coincidiendo.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=207,208 node scripts/smoke.mjs
# → 2/2 pasaron; 0 fallaron

python3 scripts/sabotajes_publish_fields_1.py
# → todos dieron el rojo esperado

node scripts/guia-usuario.mjs
# → LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular
```

## Puertas

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

## Riesgos y visto de paso

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
- **Inicio va a cambiar otra vez con REV1-PENDIENTES-1,** que saca sus
  publicaciones. El 208 se ajusta ahí.

Sigo con REV1-PENDIENTES-1, por separado.
