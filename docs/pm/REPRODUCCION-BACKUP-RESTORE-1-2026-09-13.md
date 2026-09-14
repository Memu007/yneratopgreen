# Reproducción PM — BACKUP-RESTORE-1 R4

Fecha: 2026-09-13/14, `America/Argentina/Buenos_Aires`.

## Decisión

**Aceptada** la candidata `52ba294`, informe Dev `b8223b1`, e integrada a
`main` mediante `fbd6caf`.

El diff desde `0f89e78` se limita a `.gitignore`,
`docs/RESPALDO_Y_RESTAURACION.md`, `scripts/respaldo.sh` y el informe Dev. No
toca producto. `bash -n` y `diff-check` quedaron verdes.

## Entorno y origen

La reproducción usó Docker real local, PostGIS/PostgreSQL 16.4 y tres marcas
sintéticas no sensibles en base, `uploads`, `documentos` y `outbox`.

Identidad tomada antes del ciclo y conservada después:

- `topgreen-db`: contenedor
  `8e6b385d017002f7df9571eff31782a600f5d6454799ec7fde517d433cf35e2f`,
  saludable, inicio `2026-09-13T14:18:42.936966598Z`;
- `topgreen-api`: contenedor
  `116085bfe3bc55fa8752c872610783e87a078b1327d85eda1c34dd0f20e3d692`,
  saludable, inicio `2026-09-13T21:13:50.623186228Z`.

## Ciclo positivo

Sobre un worktree aislado en `52ba294` se ejecutaron, con un directorio
temporal fuera del repositorio:

```bash
TOPGREEN_RESPALDOS=/private/tmp/topgreen-backup-r4-artifacts \
  ./scripts/respaldo.sh respaldar
TOPGREEN_RESPALDOS=/private/tmp/topgreen-backup-r4-artifacts \
  ./scripts/respaldo.sh restaurar \
  /private/tmp/topgreen-backup-r4-artifacts/20260914_002048
TOPGREEN_RESPALDOS=/private/tmp/topgreen-backup-r4-artifacts \
  ./scripts/respaldo.sh verificar \
  /private/tmp/topgreen-backup-r4-artifacts/20260914_002048 20260914_002111
```

El manifiesto declaró entorno Docker, PostgreSQL 16.4, PostGIS 3.4.3, 23
tablas, tres raíces de archivos y `pg_dump` 16.4. La verificación quedó verde
en sus seis controles: checksums del bundle, base restaurada, archivos
restaurados, identidad del origen, salud de DB/API y ausencia de una base de
restauración dentro del clúster original.

En el destino se comprobaron la fila `pm-r4-20260913` y los tres archivos
marcadores con sus contenidos. El contenedor y el volumen aislados tenían las
dos etiquetas exigidas: pieza y ejecución.

## Negativo de integridad

Se cambió únicamente
`uploads/.pm-backup-r4-marker` en el destino restaurado. `verificar` terminó
con código 1, nombró esa ruta y mostró el cambio de tamaño y SHA-256. Después
de reponer el contenido original, la misma verificación volvió a quedar verde.

## Negativo de propiedad

Se crearon un contenedor y un volumen homónimos para el sello
`20260914_002500`, sin las etiquetas de la pieza. `limpiar` terminó con código
1 antes de borrar nada e informó que ambas etiquetas estaban ausentes. La PM
comprobó que el contenedor y el volumen seguían existiendo y luego retiró sólo
esos señuelos.

## Limpieza y estado final

La limpieza normal del destino firmado `20260914_002111` eliminó exactamente
su contenedor, volumen y directorio. Se retiraron las cuatro marcas sintéticas.
No quedaron contenedores ni volúmenes `topgreen-restore-*`; ambos contenedores
de origen conservaron los IDs, tiempos de inicio y salud indicados arriba.

El bundle y los logs fueron material temporal del ensayo y no son requisito
para auditar la aceptación: la evidencia durable queda en los SHA, este
resultado y el procedimiento versionado.

## Límite de esta aceptación

Queda demostrado el procedimiento local con datos sintéticos. No se accedió a
Railway ni a datos remotos, no se activó un servicio pago y no existe todavía
una copia externa o administrada de producción con retención acordada.
