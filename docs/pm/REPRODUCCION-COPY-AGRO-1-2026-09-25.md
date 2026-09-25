# Reproducción PM — COPY-AGRO-1

Fecha: 2026-09-25. Base `e9cf4c6`. Texto `a1b4acd`, caso 192 y negativos
`2b92988`, informe Dev `71fc9fa`. `main` está en `e9cf4c6`. **Aceptada en
rama**, sin integración ni despliegue.

## Qué cambia

Es el punto #1 de la devolución de la clienta. El sitio dice «agropecuario»
en las once apariciones de «agro» suelto:

- la portada, dos veces;
- el pie;
- el cierre de Servicios;
- el cierre de Quiénes somos;
- el título de la pestaña y cinco metadatos de `index.html`.

No se tocan la marca AgroBoeda, AgroMarket (espera la decisión #10), la
taxonomía de la clienta ni los identificadores internos. El caso 192 busca
«agro» suelto en 183 archivos de fuente y en la pantalla, a 1440 y 360 px, y
mide que los textos más largos entren.

## Resultados PM

Base PostGIS Docker recién creada, API nativa y frontend de desarrollo.

| Verificación | Resultado |
|---|---|
| Caso 192 | **1/1** |
| Negativos de Dev (`textos-de-la-base`, `solo-en-la-pantalla`, `solo-en-el-correo`) | **tres rojos esperados**; `src`, `backend` e `index.html` quedaron como estaban |
| Negativo PM: `aria-label="Todo el AGRO en un lugar"` en el pie | **rojo** (atributo y mayúsculas) |
| 192 después de restaurar | **1/1** |
| 24 casos que recorren Inicio, Servicios, Quiénes somos, el pie o `index.html` | **24/24** |
| Auditoría móvil / a11y `--todas` / contraste | **12/12** sin desbordes / sin violaciones bloqueantes / todo OK |
| Build, diff-check con `cr-at-eol` | verdes |

## Decisiones

- **Bajada de la portada en celulares angostos** (320 y 360 px): pasa a dos
  renglones. Emi decidió que quede como lo pidió la clienta, con la palabra
  «agropecuario» y sin otra redacción.
- **Registrado sin tarea (P3):** Quiénes somos tutea en «Únete a AgroBoeda y
  accede…», dentro del bloque del punto #14. Se resuelve con el #14.

No se tocó `main`, Railway ni datos reales.
