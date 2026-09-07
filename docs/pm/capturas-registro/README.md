# Capturas del alta de cuenta — REGISTER-POLISH-1

Las cuatro imágenes de esta carpeta **las genera el caso 154** de
`scripts/smoke.mjs` sobre el entorno local. No salen de Railway ni de ningún
despliegue, y no prueban qué SHA está publicado: son el estado del alta en el
árbol desde el que se corrió la suite.

| Archivo | Qué muestra | Medida |
| --- | --- | --- |
| `alta-base-1440x900.png` | Alta base, sin la ampliación de transportista | 1440 × 900 |
| `transportista-1440x900.png` | Ampliación abierta, con el título del grupo a la vista | 1440 × 900 |
| `alta-base-con-error-390x844.png` | Alta base con el error de validación anunciado | 390 × 844 |
| `transportista-390x844.png` | Ampliación abierta, con el título del grupo a la vista | 390 × 844 |

Correr el caso 154 otra vez **las sobrescribe**: es a propósito, para que la
evidencia visual no envejezca respecto del código. Si querés generarlas en otro
lado sin tocar las versionadas:

```bash
SMOKE_CAPTURAS=/tmp/capturas SMOKE_CASOS=154 node scripts/smoke.mjs
```

Las capturas son para revisión humana. Lo que la regresión **mide** —anchos,
caja del botón Mostrar/Ocultar, blanco táctil, nombre accesible, desborde,
foco del error y persistencia de la ampliación— está en las aserciones del
caso, no en las imágenes.
