# Reproducción PM — DEMO-USER-1

Fecha: 2026-09-08
Producto/regresión: `53a9635`
Informe Dev: `bf31919`
Resultado: **aceptada**

## Revisión de DEMO-USER-1R

La corrección `d9b4ab7` y su informe `ba66943` actualizaron únicamente
`README.md`, `docs/DATABASE.md`, `docs/USER_MANUAL.md` y el bloque documental
del caso 157. Las siete listas reales muestran la cuenta y explican en su
contexto que las credenciales son públicas y sólo sirven sobre una base local
descartable.

PM revisó el diff y ejecutó el 157 corregido desde base Docker local nueva:
**1/1**. El log recuperable quedó en
`/private/tmp/topgreen-pm-demo-user-1r-157.log`. Build/TypeScript fueron parte
del recorrido; `node --check` y `diff-check` quedaron verdes. No se repitió
suite completa ni puertas ajenas al delta documental.

Se acepta `DEMO-USER-1R`. La cuenta permanece exclusivamente en el seed local;
no existe por esta entrega en Railway ni en otra base remota.

## Evidencia funcional

- Diff completo revisado: siete archivos, limitado a seed, caso 157 y listas de
  credenciales locales.
- Dev informó rojo contra `d63158c`: cero filas para
  `pruba@agroboeda.com`; el login directo devolvió 401.
- PM ejecutó el caso 157 del producto final desde una base Docker local nueva:
  **1/1**. El log recuperable quedó en
  `/private/tmp/topgreen-pm-demo-user-main-157.log`.
- La reproducción confirmó una única cuenta normalizada, contraseña hasheada,
  rol `user`, activa, verificada, sin Admin, transportista, publicaciones ni
  datos bancarios/MP iniciales. Entró por la UI, creó una publicación real, la
  encontró como propia y en Mercado, y un segundo seed preservó cuenta y
  publicación.
- El mismo caso confirmó el freno previo a conexión con `ENV=production`.
- Build/TypeScript quedaron incluidos en el recorrido; `node --check` y
  `git -c core.whitespace=cr-at-eol diff --check` quedaron verdes.
- Dev informó suite completa **156/157**, con único rojo 131 por su entorno sin
  Docker Alpine. PM no ejecutó ni atribuye una suite completa propia.

Los siete hashes truncados informados por Dev coinciden con los SHA-256
completos reproducidos por PM. `scripts/entorno_nativo.sh` y ambas variantes de
`init_local_db` incluyen la cuenta y el aviso local; la salida real lo confirmó.

```text
backend/app/seed.py        a69e8ce189e4b7ac404ee2729961b772a0c5c7344737b1a138624bfadb378660
scripts/smoke.mjs          44bd6f2ea990b08da6eaa6d3900d6b28ab49714da79259de40b3d1132fa5f3d7
scripts/entorno_nativo.sh  d7ce9ab8a2cef00b3e604f86667b09b71d0a93724b1ee46e882cb8e03544cc29
scripts/init_local_db.sh   bbc30e2b218fd969a3919c4d0057e6742878c8293e7f8267511d57a0c3d5f0a9
scripts/init_local_db.ps1  5e5f05e290b3e86c0956e611e45060c85bb327b3f71330760a93c0db5a53775f
README.md                  15343aa9fef55053ea79b74632612698d3b9fe28d2076ac2bbf5833368356dce
README_LOCAL_SETUP.md      9a60056f10b1d33c3106e8bdfba49d18e506e589ed39f2e71c7217435e044003
```

## Omisiones encontradas

`docs/DATABASE.md` y `docs/USER_MANUAL.md` ya enumeran cuentas del seed, pero
no incluyen `pruba@agroboeda.com`; DATABASE tampoco advierte allí el carácter
público/local de esas claves. `README.md` agrega la fila, pero su aviso genérico
«Cambiar antes de producción» no dice que sólo sirve sobre una base local
descartable. El caso 157 final no inspecciona documentación ni salidas, así que
no detecta estas contradicciones.

## Decisión

La función no se rehace y no se repite suite completa. `DEMO-USER-1R` debe
alinear sólo DATABASE, USER_MANUAL y el aviso de README, y agregar al 157 una
comprobación estática mínima de las listas reales. No se acepta hasta cerrar
ese delta pequeño.
