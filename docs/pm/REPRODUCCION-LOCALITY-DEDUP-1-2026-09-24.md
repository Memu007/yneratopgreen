# Reproducción PM — LOCALITY-DEDUP-1

Fecha: 2026-09-24. Base de la tarea `c6e0f4a`; producto, caso 188 y negativos
`34bab15`; informe Dev `fc246c0` (sólo `docs/pm/PARA-PM.md`). `main`
permanece en `0bd7fbc`. **Aceptada en rama**, sin integración ni despliegue.

## Qué se revisó

`backend/app/services/padron.py` reconoce una entidad anidada por el
identificador y el nombre: diez dígitos, los ocho primeros son una localidad
presente y repite su nombre. No hay columna nueva, migración ni datos tocados.

- `/catalog/localities` deja de ofrecer las anidadas.
- Agrega `label`, con el departamento sólo si el nombre se repite en la
  provincia, y `nested_ids`.
- El filtro `locality_id` cubre la localidad y sus anidadas.
- Los seis selectores muestran `label`. Los que abren con un valor guardado
  muestran la localidad contenedora sin cambiar lo guardado.

## Medición independiente PM (SQL sobre el padrón cargado)

| Medida | Resultado |
|---|---|
| Filas del padrón | 4.028 |
| Pares (nombre, provincia) repetidos, antes | 154 |
| Entidades anidadas | **105** |
| Pares homónimos que quedan | **51** (108 localidades), 0 sin departamento que los distinga |

La premisa PM decía 49 homónimas. Dev la corrigió con razón: 2 de los 105
pares con anidada tienen además una homónima en otro departamento
(«Malvinas Argentinas» en Buenos Aires y «San José» en Catamarca).

## Resultados

| Verificación | Resultado |
|---|---|
| Caso 188 | **1/1**: 3.923 localidades ofrecidas de 4.028, sin las 105; 51 homónimas con departamento; una sola «Mar del Plata» en filtro y alta; lo guardado en `0635711003` aparece al filtrar por `06357110`, su ficha lo nombra y editar el precio conserva el id |
| Negativo `codigo-de-la-base` | **rojo**: 154 repetidas, «Mar del Plata» dos veces |
| Negativo `filtro-sin-anidadas` | **rojo**: el filtro no trae lo guardado en la anidada |
| Negativo `editor-sin-absorber` | **rojo**: el editor muestra «Seleccionar...» |
| Negativo `rotulo-sin-departamento` | **rojo**: cuatro «San Pedro» iguales |
| Árbol y API después de los negativos | restaurados; el 188 se repitió **1/1** |
| 1–22, 41–43, 50–51, 53–56, 111–115, 132, 140, 149, 156, 171, 175, 183, 186, 187 | **45/45** (localidad, transportista, fletes, PostGIS, filtros) |
| a11y `--todas` / contraste / auditoría móvil | **76/76**, **84/84**, **12/12** sin desbordes |
| Build, lint, tipos, compilación Python, `node --check`, diff-check CRLF | verdes |

Sonda PM por API: Buenos Aires ofrece 850 localidades sin rótulos
repetidos. «Mar del Plata» absorbe `0635711003`. Santiago del Estero ofrece
«San Pedro (Capital)», «(Choya)», «(Guasayán)» y «(Jiménez)». Un id
inexistente filtra sin resultados.

Entorno: el mismo de las reproducciones del 23 y 24/09, con base PostGIS
Docker recién creada, API nativa, `.env` inventados y Chromium 141.

## Decisiones PM

- **Filtrar por el id de una anidada**, que sólo puede llegar por un enlace
  viejo, cuenta como su localidad. Se acepta la recomendación de Dev: es el
  mismo lugar y es lo que el selector muestra elegido.
- **Ficha y tarjeta sin departamento** para homónimas («San Pedro, Santiago
  del Estero»). Quien compra no distingue cuál es. Pasa a
  `LOCALITY-LABEL-DISPLAY-1`.

No se tocó `main`, Railway, backend remoto ni datos reales. En Railway no se
midió si hay publicaciones sobre anidadas; el filtro las cubre igual.
