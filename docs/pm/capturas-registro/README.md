# Capturas del alta de cuenta — REGISTER-POLISH-1

Las cuatro imágenes de esta carpeta son **evidencia estática del commit
`7ca4fc7`**. Las generó el caso 154 de `scripts/smoke.mjs` sobre el entorno
local. No salen de Railway ni de ningún despliegue, y no prueban qué SHA está
publicado: son el estado del alta en ese árbol.

| Archivo | Qué muestra | Medida |
| --- | --- | --- |
| `alta-base-1440x900.png` | Alta base, sin la ampliación de transportista | 1440 × 900 |
| `transportista-1440x900.png` | Ampliación abierta, con el título del grupo a la vista | 1440 × 900 |
| `alta-base-con-error-390x844.png` | Alta base con el error de validación anunciado | 390 × 844 |
| `transportista-390x844.png` | Ampliación abierta, con el título del grupo a la vista | 390 × 844 |

## Una corrida normal no las toca

Correr el caso 154 sin variables **no escribe acá**: las capturas van a una
carpeta temporal nueva —`mkdtempSync` bajo el temporal del sistema— y el caso
informa la ruta en su línea de resultado. Ninguna corrida por defecto deja el
árbol sucio.

```bash
SMOKE_CASOS=154 node scripts/smoke.mjs     # escribe en /tmp/topgreen-registro-XXXX
```

Para mandarlas a un destino elegido, incluida esta carpeta cuando se decida
refrescar la evidencia a propósito:

```bash
SMOKE_CAPTURAS=docs/pm/capturas-registro SMOKE_CASOS=154 node scripts/smoke.mjs
```

Refrescarlas es una decisión, no un efecto: los PNG **no son reproducibles**.
Entre dos corridas del mismo árbol cambian de hash —incluida la captura que no
muestra ningún dato variable—, así que un `git status` sucio acá nunca
significa que el producto cambió.

## Qué prueban y qué no

Las capturas son para revisión humana. Lo que la regresión **mide** —anchos,
caja del botón Mostrar/Ocultar, blanco táctil, nombre accesible, desborde, foco
del error y persistencia de la ampliación— está en las aserciones del caso 154,
no en las imágenes.
