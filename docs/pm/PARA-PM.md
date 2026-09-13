# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BACKUP-RESTORE-1 — entrega para revisión

| | |
| --- | --- |
| **Resultado** | Terminado |
| **Rama** | `codex/backup-restore-1` |
| **SHA base** | `24dcca8` |
| **SHA candidato probado** | `5ae5572` |
| **Alcance** | Backup lógico PostgreSQL/PostGIS, copia de `/data/uploads` y `/data/documentos`, restore local aislado, fingerprints, negativo y limpieza segura |
| **Estado** | Pusheado para revisión PM; no integrado ni desplegado |

### Cambios

- `scripts/backup_restore.sh`: un único comando con `backup`, `restore`,
  `verify`, `cleanup` y `self-test`.
- `docs/operations/BACKUP_RESTORE_LOCAL.md`: requisitos y procedimiento único.
- `.gitignore`: excluye `backups/`; ningún bundle ni dato de prueba se versiona.

El bundle incluye dump custom de `pg_dump`, archivo de los dos volúmenes,
manifiesto con fecha UTC y versión/formato, inventarios y SHA-256. El restore
usa únicamente el bundle y las imágenes locales registradas, crea dos
contenedores y tres volúmenes con prefijo `topgreen-restore-`, no publica
puertos y usa `--pull=never`.

### Evidencia reproducible

Comando focal final, sobre el SHA candidato:

```bash
./scripts/backup_restore.sh self-test
```

Resultado:

```text
Backup creado: backups/self-test-20260913194204-43557
Restore creado con prefijo: topgreen-restore-test-20260913194204-43557
Verificación íntegra: esquema, extensiones, tablas, filas y archivos coinciden
Positivo: marcador DB y archivo incluidos en fingerprints restaurados
Negativo: archivo alterado rechazado por la verificación
Destino aislado eliminado: topgreen-restore-test-20260913194204-43557
Origen intacto: identidades, fingerprints y salud coinciden antes/después
Self-test completo. Bundle conservado: backups/self-test-20260913194204-43557
```

El positivo compara esquema y extensiones —incluida PostGIS—, todas las tablas
con cantidad y huella de filas, secuencias y cada archivo por ruta, tamaño y
SHA-256. El negativo altera el marcador restaurado y `verify` falla. Al final
no quedaron contenedores, volúmenes, schemas ni archivos marcador de prueba.

Guardas adicionales:

```text
sh -n scripts/backup_restore.sh                         → verde
git diff --check 24dcca8..5ae5572                     → verde
./scripts/backup_restore.sh cleanup topgreen-db        → rechazado por prefijo
búsqueda de password/secret/JWT/SMTP/MP en manifiesto → sin coincidencias
topgreen-db y topgreen-api                             → mismos IDs, healthy
```

El manifiesto inspeccionado contiene sólo formato, fecha, nombres de base y
usuario, imágenes locales y raíces de datos; no contiene valores de entorno ni
contraseñas.

### Rojos durante desarrollo

1. Un primer intento no llegó a ejecutarse porque venció la revisión automática
   del permiso local; comprobé que no dejó recursos ni marcadores y no lo conté
   como evidencia.
2. La primera corrida efectiva detectó que `pg_isready` veía el PostgreSQL
   temporal del entrypoint. Se corrigió esperando que PID 1 sea `postgres`.
3. La siguiente corrida restauró pero falló la comparación de esquema: la
   imagen PostGIS inicializaba extensiones auxiliares ausentes en el origen. Se
   corrigió restaurando el dump sobre una base limpia creada desde `template0`.
4. Después de ambas correcciones, la corrida final anterior quedó verde de
   punta a punta.

### No corrido / límites respetados

- No corrí la suite funcional completa, build, a11y ni contraste: el diff no
  toca producto.
- No toqué Railway, datos remotos, secretos, ramas de despliegue, Mercado Pago,
  `POST-INTEGRATION-CLEAR-1` ni `CAT-PAGE-1`.
- No integré a `main`.

### Riesgo residual

La huella de tablas materializa filas en PostgreSQL para obtener una comparación
genérica y determinista. Es adecuada para el volumen local actual; si el dataset
crece de forma importante, convendrá reemplazarla por fingerprints por lotes.
No hace falta resolver retención, cifrado externo ni backups administrados en
esta pieza: siguen siendo decisiones operativas de Emi.
