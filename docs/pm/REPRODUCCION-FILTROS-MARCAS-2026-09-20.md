# Reproducción PM — QUERY-IMG-1 y filtros/marcas — 2026-09-20

## Composición revisada

- Rama: `claude/dev-role-repo-3l0kp3`.
- SHA exacto: `34e7ebf`.
- Producto relevante: `6e498fd` (imagen), `e798c85` (condición),
  `4bdfc71` (marca) y `020e907` (superviviente `chery`).
- Entorno: Docker local descartable, migraciones desde cero y seed versionado.

## Base y esquema

- `alembic check`: `No new upgrade operations detected`.
- Sólo `Maquinaria agrícola` declara `usa_marca`.
- Hay **44** opciones activas de marca.
- Sobreviven `case`, `case-ih`, `chery`, `deutz`, `deutz-fahr` y `fiat`;
  no aparecen `chery-bylion`, `fiat-someca`, `someca` ni `jhon-deere`.
- Activos del seed: 3 nuevos, 3 usados y 3 sin declarar.

## Focales independientes

- Caso 172: **PASS**. La tabla de imágenes se recorrió 1 vez con 6 tarjetas y
  1 con 24; 24 tarjetas correctas, 16 nulas, cuatro publicaciones con dos
  primarias sin duplicar tarjeta ni total.
- Caso 173: **PASS**. 30 nuevos, 5 usados y 4 sin condición; filtro, total,
  páginas, URL, Atrás, limpieza, reinicio de página y carrera correctos.
- Caso 174: **PASS**. 44 marcas; cuatro retiradas ausentes y siete
  supervivientes; alta, descarte, rechazo, edición, tarjeta, detalle y modal
  correctos sólo en la categoría habilitada.

Dos intentos de 173/174 dieron rojo porque el frontend temporal quedó apuntando
a otra API después de que la receta reescribiera `.env`. Se clasificó el arnés,
se alinearon frontend, API y base sobre la misma composición, y ambos casos
pasaron. Esos rojos no se atribuyen al producto.

## Negativos discriminantes

- 172 contra `5410bef`: los recorridos crecieron de 38 a 55. El valor inicial
  depende del acumulado de estadísticas; el discriminante es el crecimiento.
- 173 contra `a3bfce0`: la API informó 39 al pedir los 30 nuevos.
- 174 antes de marca: ninguna categoría declaraba `usa_marca`.
- Reintroducir `chery-bylion`: el caso detectó 45 marcas en vez de 44.

No se repitieron las quince mutaciones internas declaradas por Dev: PM reprodujo
un rojo independiente por cada conducta nueva y el rojo específico de la lista.
Las cinco mutaciones por caso permanecen como evidencia Dev, no PM.

## Suite y decisión

La suite PM completa se inició desde cero y llegó a **128/174, sin rojos**.
Emi indicó detenerla para delegar corridas costosas y luego aclaró que Dev no
tiene acceso a Docker. Por eso no se atribuye esa puerta a Dev: en la próxima
entrega PM vuelve a ser responsable de Docker, migración, focales, suite, a11y
y contraste. Dev había informado antes 173/174 sobre esta composición, con
único rojo ambiental 131; ese resultado queda atribuido a su informe.

Con lectura de esquema, focales, negativos y la excepción explícita de Emi para
la suite larga, PM **acepta QUERY-IMG-1 y las etapas 1 y 2**. La etapa 3 queda
habilitada. Esto no integra ni publica: `main` conserva auto-deploy.

## Etapa 3 — BRAND-FACET-1 — 2026-09-21

- Base declarada: `1c7eb48`.
- Producto y arnés revisados: `8e20b06`.
- Informe Dev: `761a371`; el delta posterior al producto es sólo documental.
- Build de producción sobre la candidata: verde.
- Base Docker descartable desde cero, migraciones y seed: verdes.
- Caso 175 PM: **1/1**. Verificó API, total, páginas, IDs y orden; faceta con
  filtros y antes de marca/paginación; nulos/inactivas/cero; escritorio
  1440×900, celular 390×844, URL, Atrás, limpieza y carrera de respuesta.
- Negativo de conteo: **rojo**, 48 informadas contra 30 John Deere.
- Negativo de faceta: **rojo**, la selección dejó sólo John Deere.
- Negativo de URL: **rojo**, `brand` no apareció en la barra.
- El arnés restauró la candidata y PM retiró sus contenedores y volúmenes.

El primer lanzamiento de los sabotajes no dio veredicto porque el wrapper de
la suite había retirado sus `.env` temporales; no fue un verde ni un rojo de
producto. Con el entorno requerido repuesto, los tres discriminantes fallaron
por la razón exacta declarada.

PM no repitió suite completa, a11y ni contraste: Dev informó **174/175** con
único rojo ambiental 131, **74/74** superficies y **82/82** mediciones, y la
revisión independiente cubrió el único comportamiento nuevo y sus tres
mutaciones. Se acepta `BRAND-FACET-1` en `8e20b06`. Jacto queda sin declarar:
no existe entre las 44 opciones cerradas y esta tarea no autoriza reabrirlas.
Esto no integra ni publica; `main` conserva auto-deploy.
