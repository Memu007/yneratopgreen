# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-09. Primer informe con el formato de `ONBOARDING-DEV.md` §5.

## 1. Resultado

**Terminado.** Los cuatro criterios se cumplen.

## 2. Commit y alcance real

`83c4b59` código, este informe aparte. 19 archivos; en `src/`, 45 inserciones y
39 borrados. El grueso del diff son dos guiones nuevos en `scripts/`.

- `AgroMarket` → `TopGreen` en las cuatro apariciones visibles.
- `scripts/a11y.mjs` + `npm run a11y`.
- Correcciones de las tres familias que la puerta encontró.
- Dos desvíos míos, en el punto 4.

**Tu conteo era el correcto y el mío no**: cuatro visibles, no cinco. La quinta
que reporté es un comentario. Quedan sin tocar ese comentario y el `name` del
paquete, como indicaste.

## 3. Evidencia

Todo corrido en este entorno, ahora:

| Comprobación | Resultado |
|---|---|
| `npm run a11y` | **40 pantallas, 0 serious, 0 critical, 0 minor, 0 moderate** |
| `npm run contraste` | 8.271 textos, **0** por debajo del mínimo |
| `npm run build` | verde |
| Suite oficial, base recreada desde cero | **25/25** |
| `git -c core.whitespace=cr-at-eol diff --check` | sin avisos |
| `AgroMarket` en la interfaz | ninguna aparición |

**No corrido:** `npm run smoke` tal cual, porque exige Docker y acá no hay.
Corrí `scripts/smoke.mjs`, la misma suite, contra la base recreada a mano.
Es la misma limitación de siempre.

**Rojo que ya estaba:** `npm run lint`, 21 problemas, 14 errores. Lo corrí con
mi rama y sin ella: el mismo número exacto. No lo toqué.

Detalle por regla en `scripts/a11y.mjs`; las cabeceras de los dos guiones
explican qué cubre cada uno y por qué no se reemplazan.

### Lo que la puerta encontró y corregí

| Regla | Impacto | Nodos | Corrección |
|---|---|---:|---|
| `select-name` | critical | 66 | 18 selects: `aria-label` sin rótulo visible, `id`+`htmlFor` con rótulo |
| `button-name` | critical | 36 | borrar producto: `aria-label` con el nombre del producto |
| `color-contrast` | serious | 9 | segundo mapa de estados, en el panel |

Los badges del panel: `#22c55e`→`#15803d` (2,28→5,02), `#f59e0b`→`#b45309`
(2,15→5,02), `#3b82f6`→`#1d4ed8` (3,68→6,70), `#8b5cf6`→`#6d28d9` (4,23→7,10).

## 4. Desvíos, riesgos y hallazgos fuera de la tarea

**Rompí el caso 20 de la suite y lo arreglé.** Al darle nombre accesible a los
botones de cerrar, `getByRole('button', { name: '✕' })` dejó de encontrarlos:
24/25. Apunté ese selector a `'Cerrar'`. Es el único cambio en la suite y lo
hice porque el nombre accesible cambió de verdad, no para que el caso pasara.
Mirálo con desconfianza, es el tipo de cambio que la merece.

**Dos desvíos de alcance, ya implementados, antes de que existiera el protocolo
que dice proponerlos en vez de hacerlos.** Los dos se revierten solos:

- versioné el barrido de contraste como `npm run contraste`;
- sumé quienes somos, servicios y contacto a la puerta.

Van como decisión en el punto 5.

**Corregí dos defectos semánticos que axe no detecta.** El cambio entre
ingresar y registrarse era un `<span>` con `onClick`: sin rol y sin Tab, con
teclado no se podía pasar de un modal al otro. Ahora es `<button>`, idéntico a
la vista. Y diez botones de cerrar se anunciaban como "×"; ahora dicen
"Cerrar".

**Hallazgo que no corregí:** los modales de autenticación no cierran con
Escape. No es violación de la norma —con Tab se sale, no hay trampa— y es
cambio de comportamiento, no semántica.

**Riesgo que conviene registrar:** el badge de contraste se me escapó dos veces
por dos motivos distintos. El barrido no abría esas pestañas, y el análisis
estático sólo lee CSS mientras esos colores están escritos en el TSX. axe lo
vio. Es la prueba concreta de que las dos puertas se necesitan, y también de
que **cualquier color escrito en TSX queda fuera del control estático**.

**Inconsistencia menor del repositorio:** `NOW.md` dice que Sol fue la segunda
PM y que hay una tercera desde el 06/08, pero `31b8dbd` se titula "para la PM
Sol". No sé cuál de los dos refleja hoy la realidad. Es de Emi, no lo toqué.

## 5. DECISIÓN SOLICITADA

**a) Versionar el barrido de contraste.** Beneficio: la evidencia que sostiene
`918c4b9` hoy no la puede reproducir nadie más que yo, y axe no la cubre —su
regla `color-contrast` devuelve "incompleto", no "violación", ante gradiente,
foto o capas translúcidas—, así que sin esto un cambio futuro puede romper el
contraste en silencio. Esfuerzo: hecho. Riesgo: un guion más que mantener.
Fase: 1. **Recomiendo conservarlo.** Alternativa: lo saco y la evidencia de
contraste queda fuera del repositorio.

**b) Tres rutas públicas de más en la puerta.** Beneficio: las dos puertas
miden lo mismo; el barrido de contraste ya las cubría. Esfuerzo: hecho, cero
violaciones. Riesgo: alcance mayor al que pediste. Fase: 1. **Recomiendo
conservarlas.** Alternativa: se sacan en una línea.

**c) Escape para cerrar los modales.** Beneficio: se nota al usar con teclado.
Esfuerzo: un manejador por modal. Riesgo: cambio de comportamiento, toca varios
componentes. Fase: 1 o 5. **Recomiendo hacerlo ahora**, mientras estoy en esto.

**d) `npm run lint` en rojo.** No propongo arreglarlo en esta pieza: toca tipos
de `AuthContext`, `CartContext` y `api.ts`. Pido que le pongas fase.

**e) Próxima pieza.** Fase 1 cierra el 20/08 y Fase 2 arranca el 21/08. Siguen
abiertas y sin asignar las dos cosas rotas de Fase 2: el seed no carga CBU ni
alias —sobre una instalación limpia la transferencia no se puede usar— y el
camino de instalación sin Docker. **Recomiendo el seed primero**: bloquea el
flujo de pago completo, que es lo único que hoy no se puede demostrar de punta
a punta.

Nada queda bloqueado esperando (a) a (d). El entorno local sigue levantado.
