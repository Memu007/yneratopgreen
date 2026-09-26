# Reproducción PM — ATRIBUTOS-RUBRO-1, parte 2

Fecha: 2026-09-26. Base `a50cddc` (la asignación).

- Backend: `8a72310`.
- Frontend: `85650e8`.
- Arnés: `cd75cdf`.
- Informe Dev: `43c669f`.
- Integración de los commits PM hasta `65e198a`: `2a00720`.

`main` está en `238d113`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

- **Modelo, año y origen.** Se declaran al publicar, se validan, se ven en
  la ficha y se editan.
  - Modelo y año van donde va la marca: los decide `usa_marca` de la
    categoría, hoy sólo Maquinaria agrícola.
  - El origen va sólo en productos y siempre rotulado «declarado por quien
    vende», en texto común.
  - El año filtra por rango y el origen filtra en el servidor. El modelo se
    encuentra con el buscador de texto.
- **Los tres P2:**
  - el alta siguiente abre vacía;
  - «Mercado» y recargar conservan todos los filtros y la página;
  - el primer filtro se llama «Productos o servicios».
- **Panel de filtros.** Tiene tres grupos: «Qué buscás», «Dónde» y «Precio».
  Además hay «Más filtros», plegado. Si «Más filtros» tiene algo puesto, se
  abre y dice «(N activos)».
  - La Dev atacó la propuesta PM (decisión delegada por Emi el 26/09) y quedó
    en pie.
  - En servicios no se ofrecen condición, origen ni año, salvo que la barra
    ya traiga uno puesto.
- **Migración `a47300b5554c`.** Es aditiva: agrega tres columnas nulas. No
  carga ninguna lista: los dos orígenes y el rango de años viven en el
  código.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada.

| Verificación | Resultado |
|---|---|
| Casos 199 a 204 | **6/6** |
| Negativos de la Dev: después de contar, en el navegador, acepta nulos, marca sin limpiar, falta en la barra, «Más filtros» escondido | **seis rojos esperados**; «src y backend después: como estaban» |
| Negativo PM 1: «año desde» con `>` en vez de `>=` | **rojo** en el 200: «año desde 2010: el total dice 12 y en la base hay 13» |
| Negativo PM 2: el origen se acepta en un servicio | **rojo** en el 199: «un origen en un servicio: el alta respondió 200» |
| Negativo PM 3: el modelo sale del buscador de texto | **verde en el 199 y en el 200**. **Hueco de cobertura:** ninguna prueba lo vigila |
| Comprobación directa del modelo en el buscador | con el modelo único `PMQX77` puesto a mano en la base local, `search=PMQX77` trae **1** con el código de la Dev y **0** sin la línea. Funciona; lo que falta es el caso |
| Caso 170, que a la Dev le falló una vez | **8/8** repetido solo, y verde en la suite completa |
| Suite completa desde base recién creada | **203/204**; sólo cae el **169**, de entorno; el 131, el 170 y el 191 pasan |
| Migración en modo producción: archivos de `Dockerfile.railway`, `ENV=production`, copia de base en `01ff14043124` | sube a `a47300b5554c` con las tres columnas en nulo; la huella de las publicaciones no cambia (`67fcc9bd…`) |
| a11y `--todas` / contraste / auditoría móvil | **80/80**, **88/88**, **12/12** sin desbordes |
| `guia-admin.mjs` | los 26 pasos coinciden en escritorio y en celular |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check con `cr-at-eol` | verdes |

## El 170: hipótesis PM, sin reproducir

`main.tsx` monta la aplicación en `StrictMode`. En desarrollo, eso corre dos
veces la carga de la sesión al abrir la página (`AuthContext.tsx`, efecto de
`/auth/me`). Si la segunda respuesta llega después de «Salir», vuelve a
poner al usuario, y el efecto no tiene ninguna guarda contra una respuesta
tardía.

En el sitio publicado la carga corre una sola vez, así que el riesgo real es
bajo. No se reprodujo en 9 corridas del caso (8 sueltas y 1 en la suite).

Queda como **P2 registrado, sin tarea**. Si vuelve a aparecer, la pieza es
que la carga de la sesión ignore una respuesta que llega después de una
salida.

## Decisiones PM

- **Modelo y año atados a `usa_marca`:** se acepta.
- **«Mercado» también conserva la página:** se acepta.
- **«Desde» mayor que «hasta» da cero, sin error:** se acepta.
- **El año máximo se calcula en UTC** (tres horas del 31/12): se acepta.
- **P3 sin tarea:**
  - cerrar el alta con sólo marca, modelo, año u origen cargados no pide
    confirmar el descarte;
  - el panel no edita la categoría de una publicación.
- **El hueco del modelo en el buscador** va como caso en la próxima pieza.

No se tocó `main`, Railway ni datos reales.
