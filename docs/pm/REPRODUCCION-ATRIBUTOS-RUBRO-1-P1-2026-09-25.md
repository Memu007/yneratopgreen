# Reproducción PM — ATRIBUTOS-RUBRO-1, parte 1

Fecha: 2026-09-25. Base `86fc0da` (decisión PM sobre las listas).

- Producto: `e624831`.
- Arnés: `8dce24b`.
- Auditorías: `3594363`.
- Caso 179 en copia: `4eac0f7`.
- Listas por migración: `7177b2d`.
- Informe Dev: `ba18f76`.
- Integración del commit PM `29b1020`: `d283cac`.

`main` está en `e9cf4c6`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

Es la devolución de la clienta #9: el tercer nivel de su taxonomía.

- **Tipo.** 33 subrubros tienen una lista cerrada de «tipo», con 122
  opciones en total.
  - Quien publica elige una, y es opcional.
  - Aparece en la ficha y filtra el Mercado cuando hay un subrubro elegido.
- **Potencia de Tractores.** Se carga en HP, de 1 a 1000.
  - El filtro ofrece compacto (hasta 59), estándar (60 a 120) y alta (desde
    121).
- **Sin tipo** quedan:
  - las 4 «Mejoras» de Tierras;
  - las 5 listas de una sola opción;
  - Tractores, que va por potencia.
- **Migración `c8e41f2a7d90`.** Crea la tabla de listas y las dos columnas,
  que nacen nulas.
  - En producción la siembra no corre, así que la migración carga las listas
    sobre los subrubros que ya existen.
  - La dev lo detectó y lo corrigió antes de entregar (`7177b2d`).

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, equivalente a la de `entorno_nativo.sh`.
Chromium 141.

| Verificación | Resultado |
|---|---|
| Casos 179, 194, 195 y 196 | **4/4** |
| Negativos de la Dev: filtro después de contar, en el navegador y aceptando nulos | **tres rojos esperados**, cada uno por su motivo; `src` y `backend` quedan como estaban |
| Negativo PM 1: los bordes corridos (60 HP pasa a compacto) | **rojo** en el 195: «los bordes no quedan donde dice la clienta (60 y 120 son estándar; 59 y 121, no)», y los totales de compacto y estándar |
| Negativo PM 2: el alta acepta un tipo de cualquier subrubro | **rojo** en el 194: «un tipo de otro subrubro: el alta respondió 200 … y tenía que ser 400» |
| Negativo PM 3: cambiar de subrubro no suelta el tipo | **rojo** en el 194: «pasar a Cosecha dejó el tipo "subsoladores"» |
| 194 y 195 después de restaurar | **2/2** |
| Suite completa desde base recién creada | **195/196**. Sólo cae el **169**, de entorno. Esta vez no hubo cascada de 429, y el 131 pasó. |
| Caso 191, con el arreglo del token (`2a0c461`) | **verde en la suite completa**; el P3 queda cerrado |
| a11y `--todas` / contraste / auditoría móvil | **78/78**, **86/86**, **12/12** sin desbordes |
| `guia-admin.mjs` | **26 pasos coinciden** en escritorio y en celular |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check con `cr-at-eol` | verdes; `alembic check` sin diferencias |

**Método.** El script de negativos de la Dev reinicia la API con
`entorno_nativo.sh --reiniciar-api`, que no existe en el entorno de PM. PM lo
corrió sin tocarlo, reemplazando sólo ese paso por su propio reinicio.

La primera vez, el reinicio de PM dejaba abierta la salida del script y la
corrida quedó colgada con el catálogo saboteado. PM la cortó, restauró `src`
y `backend` con Git y la repitió. Sólo cuenta la repetición.

## Lectura del diff

- **Filtro.** El tipo y la potencia se aplican en el servidor antes de la
  faceta y del conteo (`catalog.py`), sin ningún `OR … IS NULL`.
  - Con subrubro, el tipo se busca en ese subrubro. «Otros» se repite en
    muchos.
- **Alta y edición.** Validan contra la lista del subrubro final.
  - Si cambia el subrubro y no se manda el tipo, lo que ya no corresponde se
    suelta.
  - La potencia sólo se acepta en Tractores.
- **Migración.** Es aditiva: ninguna fila existente cambia de valor.
  - La copia congelada de las listas es idéntica a `tipos.py`. El caso 196 lo
    compara tipo por tipo, y su negativo lo prueba.

## Riesgo que queda: los nombres internos del sitio publicado

La migración encuentra cada subrubro por su nombre interno (el slug). Si en
Railway un subrubro tuviera otro, ese subrubro quedaría sin lista y no daría
ningún error.

PM verificó que los slugs de rubros y subrubros de la siembra no cambian
desde el 22/08; en ese período sólo se agregaron marcas. Si el catálogo de
Railway salió de la siembra, coinciden. PM no puede verlo, porque la red
bloquea `railway.app`.

**Control después de publicar:** elegir un subrubro por rubro en el Mercado y
ver que ofrezca «Tipo». Por ejemplo, Preparación del suelo, Riego por
aspersión, Fertilizantes, Manejo animal, Neumáticos y cámaras, Sensores de
cultivo y Compra-venta definitiva. En Tractores tiene que ofrecer
«Potencia».

## Decisiones PM sobre el informe

- **Nombres completos en Cosecha y en Cercas y bebederos:** se aceptan. Es el
  mismo criterio que se aprobó para Fertilización.
- **La tarjeta no muestra el tipo:** se acepta; no se pidió.
- **Dos defectos que ya estaban (P2), a la parte 2:**
  - la marca queda cargada en la publicación siguiente;
  - «Mercado» dentro del Mercado saca de la barra la condición, el orden y la
    marca.
- **Tierras:** las listas cargadas no se tocan. Que el rubro se trabaje en
  esta etapa sigue siendo la decisión del 05/08 (Fase 6); esta pieza no la
  cambia.
- **P3 sin tarea:** el script de negativos depende de
  `entorno_nativo.sh --reiniciar-api`.

No se tocó `main`, Railway ni datos reales.
