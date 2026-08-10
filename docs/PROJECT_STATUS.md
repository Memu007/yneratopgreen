# Documento histórico — no usar como estado del proyecto

**Este archivo describía el estado de la Fase I al 2026-06-04, tal como lo
dejó el equipo anterior. No se mantiene y no refleja el proyecto actual.**

Una revisión del 2026-07 encontró **ocho afirmaciones verificadas como
falsas** en su contenido, sobre despliegue, integraciones y alcance. Se
conserva el archivo porque es parte de la historia del proyecto y porque otros
documentos lo citan, pero **no se debe tomar ninguna decisión a partir de él**.

## Dónde está el estado real

| Qué buscabas acá | Dónde está ahora |
|---|---|
| Estado y avance del proyecto | [`docs/pm/NOW.md`](pm/NOW.md) |
| Decisiones tomadas y sus motivos | [`docs/pm/DECISIONS.md`](pm/DECISIONS.md) |
| Fases, semanas y fechas | [`docs/pm/CRONOGRAMA.md`](pm/CRONOGRAMA.md) |
| Alcance contractual y sus límites | [`docs/pm/ALCANCE-Y-LIMITES.md`](pm/ALCANCE-Y-LIMITES.md) |
| Cómo levantar el proyecto | [`README_LOCAL_SETUP.md`](../README_LOCAL_SETUP.md) |
| Despliegue en Railway | [`RAILWAY.md`](../RAILWAY.md) |
| Problemas conocidos | [`docs/KNOWN_ISSUES.md`](KNOWN_ISSUES.md) |

## Por qué no se reescribió

Reescribirlo sería inventar un segundo documento de estado que competiría con
`NOW.md` y volvería a envejecer igual. El estado vive en un solo lugar.

El contenido original está en el historial de Git: `git log --follow -p
docs/PROJECT_STATUS.md`.
