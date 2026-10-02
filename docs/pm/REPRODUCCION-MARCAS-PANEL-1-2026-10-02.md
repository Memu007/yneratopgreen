# Reproducción PM — MARCAS-PANEL-1

Fecha: 2026-10-02. Base `dc377d9`, más los commits PM hasta `59bdbeb`
integrados por la Dev.

- Código: `24296c5`.
- Caso 239, negativos, auditorías y guías: `55abb3b`.
- Caso 182 con ocho secciones: `0e2cab3`.
- Rama publicada: `c27214c`. Informe: `ee8e90e`.

`main` está en `dc377d9`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

- **El panel tiene una pestaña nueva, «Marcas»**, en escritorio y celular.
  Cada marca muestra:
  - cuántas publicaciones la usan, sin contar las eliminadas;
  - si es «De la lista» o «Escrita al publicar»;
  - si está «Dada de baja».
- **Corregir el nombre** usa la misma regla que «Otra marca».
  - Si el nombre nuevo es el de otra marca, aunque cambien mayúsculas,
    acentos, espacios, guiones o puntos, no la pisa.
  - En ese caso ofrece «Unir con …».
- **Unir** pide confirmar y mueve todas las publicaciones a la marca que
  queda. La otra desaparece del filtro, del alta y del panel. No se deshace.
- **Dar de baja** saca la marca del alta y del filtro. La página de la
  publicación la sigue mostrando. **Dar de alta** la devuelve.
- **Cada acción responde 403** a quien no es administración.
- **La Dev cerró dos cosas más:**
  - Configuración ya no puede borrar ni renombrar una marca por su ruta
    genérica, que no movía las publicaciones;
  - el subtítulo de Configuración tenía poco contraste (3,93 a 1).
- Sin migración.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `ee8e90e`.

| Verificación | Resultado |
|---|---|
| Caso 239 | **1/1**, en escritorio, celular y por la API |
| Caso 182 suelto | falla con «no hay órdenes con las que abrir un detalle»: depende de datos de casos anteriores. Se mide en la suite completa |
| Los 8 negativos de la Dev | **ocho rojos esperados**; «src y backend después: como estaban» |
| Negativo PM 1: el panel cuenta también las publicaciones eliminadas | **rojo** en el 239: la confirmación de baja dice «Sus 19 publicaciones» en escritorio y «Sus 20» en celular |
| Negativo PM 2: corregir y dar de baja no piden administración | **rojo** en el 239: «quien vende pide corregir y recibe 200 y no 403», lo mismo al dar de baja, y «lo que pidió quien vende cambió algo» |
| Negativo PM 3: unir mueve sólo las publicaciones activas | **sobrevive**: el 239 pasa. Ver «Huecos» |
| Negativo PM 4: Configuración puede renombrar una marca por la ruta genérica | **sobrevive**: el 239 pasa. Ver «Huecos» |
| Suite completa desde base recién creada | **237/239**. Cae el **169**, de entorno, y el **195**, que repetido solo pasa (1/1). Pasan el 131, el 182, el 191 y el 239 |
| a11y `--todas` / contraste / auditoría móvil | sin violaciones bloqueantes y con cobertura completa / «TODO OK, COBERTURA COMPLETA» / **12/12**, sin desbordes |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 30 pasos y 23 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check` (sin migración), diff-check `dc377d9..ee8e90e` con `cr-at-eol` | verdes |

**El 195 no es de esta pieza.** El caso abre el filtro de tipo y lee sus
opciones apenas el selector aparece, sin esperar a que la pantalla traiga
las cantidades. Si llegan tarde, lee sólo «Todos». Es una carrera del caso,
no del producto: la pantalla carga las opciones un momento después, y el
paso siguiente del mismo caso las elige sin problema. La lectura viene de
`FILTROS-DE-PUBLICACIONES-1`, que ya está en `main`. P3 del arnés.

## Huecos de cobertura (P3)

El código hace lo correcto en los dos puntos. Lo que falta es un caso que lo
compruebe:

1. **Unir con publicaciones pausadas o eliminadas.** `unir` mueve todas, sin
   filtrar por estado. Si un cambio futuro filtrara por estado, una pausada
   quedaría con una marca que ya no existe, y al reactivarla no aparecería
   en el filtro. Hoy el 239 no lo detecta.
2. **Renombrar una marca desde Configuración.** El 239 prueba el borrado
   (400) y no el cambio de nombre por la misma ruta.

## Decisiones PM

- **Se aceptan los cuatro supuestos de la Dev:**
  - «De la lista» sale de la lista de las 44;
  - no se puede unir a una marca dada de baja;
  - unir mueve también las pausadas y las eliminadas;
  - las marcas de la lista también se corrigen, se unen y se dan de baja.
- **Se aceptan los riesgos declarados:**
  - unir no se deshace, y la confirmación lo dice;
  - un enlace guardado con una marca unida muestra el Mercado vacío;
  - la carrera de unir en el mismo instante en que alguien publica con esa
    marca.
- **P3, observado por PM.** Una marca unida puede volver: si alguien escribe
  otra vez «Jhon Deer» con «Otra marca», se crea de nuevo, porque la unión
  no guarda el nombre viejo. Se vuelve a unir desde el panel. No se arregla
  ahora.
- **P3, observado por PM en el código.** En «Editar», una publicación cuya
  marca fue dada de baja muestra el valor interno («agromec») y no el nombre
  («AgroMec»). Antes casi no pasaba, porque dar de baja no estaba en la
  pantalla.
- **Los dos huecos, el P3 de «Editar» y la espera del 195** van con
  `INICIO-CIERRE-CELULAR-1` como agregado chico.

No se tocó `main`, Railway ni datos reales.
