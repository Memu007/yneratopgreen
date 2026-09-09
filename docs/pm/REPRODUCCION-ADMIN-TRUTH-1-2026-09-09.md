# Reproducción PM — ADMIN-TRUTH-1R

Fecha: 2026-09-09.

## Entrega revisada

- Producto/regresión base: `aaa51ce`.
- Informe base: `21aa17e`.
- Corrección de regresión: `21cd4d1`.
- Informe final: `638e1b9`.
- Rama: `origin/claude/dev-role-repo-3l0kp3`.

El diff exacto de `21cd4d1` toca sólo `scripts/smoke.mjs`. No modifica
Frontend, Backend, dependencias, configuración ni datos. La corrección crea
cuatro publicaciones y diez órdenes propias, las identifica sin depender del
estado previo de la suite y contrasta cada badge con el texto y el color
computado declarados por el diccionario real.

## Reproducción independiente

Sobre `21cd4d1`, desde una base Docker local nueva:

```text
SMOKE_CASOS=160 npm run smoke
PASS 160
1/1 pasaron; 0 fallaron
```

La salida enumeró los cuatro estados de publicación y los diez de orden,
incluido `draft`; verificó cada fila por identidad propia y confirmó que sólo
`draft`, cuyo tono declarado es neutro, comparte el color de respaldo. También
repitió dentro del caso el contrato del dashboard, los cinco fallos con
reintento y el alta administrativa. Duración del caso: 24.211 ms.

Log persistente: `/private/tmp/topgreen-pm-admin-160r.log`.

Un intento previo no llegó a ejecutar el caso porque Chromium no pudo crear su
caché (`EPERM`). No se cuenta como rojo ni verde. La repetición autorizada tuvo
salida recuperable y código 0.

## Puertas y límite de evidencia

- `node --check scripts/smoke.mjs`: verde.
- `git diff --check`: limpio.
- El smoke incluyó el build: verde.
- No se ejecutó suite completa, 145/146, a11y, contraste ni Backend aparte.
  El producto ya había sido revisado y el delta final sólo corrigió el arnés.
- Dev había informado **159/160** para la entrega base, con el 131 ambiental;
  esta corrección no repitió esa suite. PM no atribuye 161/161 ni una suite
  completa propia.

## Decisión

`ADMIN-TRUTH-1R` queda aceptada técnicamente en rama. La integración permanece
retenida para evitar un despliegue incidental mientras se prepara la mejora de
fotos solicitada para la demo. No se tocó Railway, pagos, secretos ni datos
remotos.
