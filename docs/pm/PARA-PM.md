# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## MARCAS-PANEL-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `dc377d9`; después integré tus commits hasta `59bdbeb`, sólo `docs/pm` |
| código | `24296c5` |
| caso, negativos, auditorías y guías | `55abb3b` · `0e2cab3` (el 182) |
| rama publicada | `c27214c` |
| no integrado, no desplegado | `main` sigue en `dc377d9` |

**Resultado.** En el panel, una pestaña nueva, «Marcas», en escritorio y
celular, con la lista completa. Cada marca dice:

- su nombre;
- cuántas publicaciones la usan, sin contar las eliminadas;
- «De la lista» o «Escrita al publicar»;
- «Dada de baja», si lo está.

**Corregir el nombre** sigue la regla de «Otra marca»: de 2 a 40 caracteres,
con letras o números. Si el nombre ya es de otra marca, aunque cambien las
mayúsculas, los acentos, los espacios, los guiones o los puntos, no la pisa.
Dice, por ejemplo, «Ya existe la marca «John Deere», con 5 publicaciones.» y
ofrece «Unir con John Deere».

**Unir** pide confirmar y dice cuántas publicaciones pasan. Las mueve a la que
queda, y la que se va sale del filtro, del alta y del panel. No se puede
deshacer.

**Dar de baja** la saca del alta y del filtro, y la ficha la sigue mostrando.
**Dar de alta** la vuelve a ofrecer.

**Permisos:** cada acción responde 403 a quien no es administración.

**Nada para decidir.** Las dos consultas del «Frená y consultá» no se dieron.
No hay migración, y las marcas se guardan igual que antes.

Cuatro supuestos, todos reversibles:

1. **«De la lista» sale de la lista de las 44.** La lista pasó a
   `services/marcas.py`, y la siembra la usa de ahí. Una marca de la lista
   que se corrige sigue siendo «De la lista».
2. **Unir a una marca dada de baja se rechaza** (400): primero hay que darla
   de alta.
3. **Unir mueve también las publicaciones pausadas y las eliminadas,** para
   que ninguna quede con una marca que no existe. El número que muestra el
   panel cuenta sólo las no eliminadas.
4. **Una marca de la lista también se puede corregir, unir y dar de baja.**

## Lo que cerré además

- **Configuración podía borrar o renombrar una marca por su ruta genérica**
  (`/admin/form-options/{id}`), sin mover sus publicaciones. La pantalla no lo
  ofrecía, pero la API sí. Ahora responde 400 «Esta opción no se edita desde
  Configuración. Las marcas se corrigen en «Marcas».»
- **El subtítulo de Configuración tenía poco contraste:** usaba el color de un
  borde, 3,93 a 1 sobre blanco. Ahora usa el color de texto secundario. Lo
  encontró la auditoría de contraste al medir «Marcas», que comparte ese
  estilo. Antes no se medía.

## Caso y negativos

**Caso 239, en escritorio y celular, por el panel:**

- una publicación con «Otra marca: Jhon Deer», unida a John Deere, pasa a
  contar en John Deere: en la suite desde base nueva, de 0 a 1 tractores.
  «Jhon Deer» sale de la lista del panel, del filtro (en la API y en la
  pantalla) y del alta;
- «Agromec» corregida a «AgroMec» se ve así en la ficha y en el filtro, y la
  publicación conserva la misma marca;
- dada de baja, sale del alta y del filtro, y la ficha sigue diciendo «Marca:
  AgroMec». Dada de alta, vuelve con 1.

**Y por la API:**

- quien vende recibe 403 al listar, corregir, dar de baja y unir, y nada
  cambia;
- unir dos veces seguidas responde 200 y 404; dos uniones a la vez, 200 y
  404. En los dos casos la publicación se mueve una sola vez;
- unir consigo misma da 400, y a una dada de baja, también 400;
- corregir al nombre de otra marca da 409, con esa otra; corregir a «A», 422;
- borrar una marca desde Configuración da 400.

Las reglas que, rotas, borrarían una marca se prueban sobre marcas que el caso
crea y retira. En mi primera corrida de negativos, `baja-borra` borró Zoomlion
de mi base local, porque el caso la usaba. La repuse, cambié el caso y repetí
los ocho.

`python3 scripts/sabotajes_marcas_panel_1.py` → «todos dieron el rojo
esperado» (ocho), «src y backend después: como estaban», y la base sigue con
44 marcas:

| sabotaje | rojo del 239 |
|---|---|
| `unir-sin-mover` (pedido): unir borra la marca sin mover sus publicaciones | 8 problemas: «escritorio: unida, la publicación quedó con «jhon-deer»», «John Deere cuenta 6 en el filtro y tenía que contar 7», lo mismo en celular y por la API |
| `unir-sin-rol` (pedido): unir no pide administración | 4 problemas: «API: quien vende pide unir y recibe 200 y no 403», «lo que pidió quien vende cambió algo». Listar, corregir y dar de baja siguen en 403 |
| `baja-borra`: dar de baja borra la marca | 7 problemas: «dada de baja, la ficha dice «Marca: agromec»», y no hay cómo darla de alta |
| `corregir-pisa`: corregir no mira las demás | 1 problema: «API: corregir al nombre de John Deere respondió 200» |
| `consigo-misma` | «API: unir una marca consigo misma respondió 200», y la marca desaparece |
| `unir-a-dada-de-baja` | «API: unir a una dada de baja respondió 200» |
| `configuracion-borra`: la ruta genérica borra marcas | 1 problema: «API: Configuración borró una marca por la ruta genérica (HTTP 200)» |
| `panel-no-recarga`: la pantalla no vuelve a pedir la lista después de unir | 2 problemas: «escritorio: unida, «Jhon Deer» sigue en la lista del panel», y en celular |

**La guía del panel también cae** con `unir-sin-mover`, en escritorio: «Paso
29. Unir dos marcas: la guía dice “Las publicaciones de la que se va pasan a
la que queda” y no pasa».

## Las guías

- **Guía del panel:** la sección nueva «9. Marcas», pasos 26 a 29: ver,
  corregir, dar de baja y de alta, unir. La recorre `guia-admin.mjs`, en los
  dos anchos, con un tractor propio con «Otra marca». Al final lo une a John
  Deere, así que la corrida no deja marcas de más.
- **El panel tiene ocho pestañas,** y la guía lo dice.
- **El límite de «Antes de empezar»** dejó de decir que las marcas no se
  corrigen. Ahora dice: «Las marcas nuevas no se aprueban antes de aparecer»,
  y que se corrigen desde «Marcas».
- **«No se puede deshacer»** queda en «Lo que el programa no comprueba», con
  su fuente en el código.
- **Guía de uso:** sólo cambió el motivo de una frase que no se comprueba.

## Cómo verificarlo

Con el entorno arriba:

```bash
SMOKE_CASOS=239 node scripts/smoke.mjs
# → 1/1 pasaron; 0 fallaron

REINICIAR_API="<tu reinicio>" python3 scripts/sabotajes_marcas_panel_1.py unir-sin-mover unir-sin-rol
# → dos [ROJO ESPERADO] y «todos dieron el rojo esperado»
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `0e2cab3` | **238/239**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'» |
| la corrida anterior, sobre `55abb3b` | 237/239: el 131 y el **182**, «7 Tab desde Cerrar llevan a «Marcas» y no a «Configuración»». Contaba siete secciones. Lo pasé a ocho en `0e2cab3` y repetí la suite entera |
| tipos, lint, build | verdes: `npm run lint` sin avisos y `npm run build` con `tsc` |
| `compileall`, `node --check`, parseo de Python | verdes |
| `alembic check` | `No new upgrade operations detected.` (sin migración) |
| diff-check con `cr-at-eol` sobre `dc377d9..c27214c` | limpio; ninguna línea cambia sólo por el final |
| a11y `--todas` | 82 de 82 pantallas (dos nuevas: «Marcas» y su aviso de nombre repetido), «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA» |
| contraste | «las 86 mediciones exigidas se hicieron» (cuatro nuevas), «TODO OK, COBERTURA COMPLETA» |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 30 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 23 pasos en escritorio y celular» |

**Líneas con CR por archivo, contra la base.** En los archivos mezclados, cada
línea agregada tiene el mismo final que su vecina:

| archivo | base | ahora |
|---|---|---|
| `admin.py`, `AdminPanel.module.css` | todo CRLF | todo CRLF |
| `AdminPanel.tsx` | 2228 de 2262 | 2498 de 2532 |
| `backend/app/seed.py` | 600 de 1479 | 523 de 1402: salieron las 81 de la lista de marcas y entraron 4 |
| `scripts/smoke.mjs` | 4 | 4 (las mismas) |
| `marcas.py`, la guía, sus scripts, las auditorías y el script de negativos | 0 | 0 |

## Riesgos

- **Unir no se puede deshacer.** La confirmación lo dice.
- **Un enlace guardado con una marca unida o dada de baja** (`?brand=…`)
  muestra el Mercado vacío, sin esa marca en el filtro. Es lo mismo que pasa
  hoy con una marca dada de baja.
- **Una carrera muy angosta.** Si una alta ya validó su marca y se guarda
  justo después de que administración une esa marca, queda con la marca
  vieja, y la ficha muestra el valor interno. Para que pase, hay que unir en
  el mismo instante en que alguien publica con esa marca.
- **Las marcas nuevas no se aprueban antes de aparecer:** fuera de alcance,
  como pediste.
