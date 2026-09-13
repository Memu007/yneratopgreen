# Respaldo y restauración verificada

Persistencia no es respaldo. `topgreen-db` y el volumen de `/data` conservan el
estado mientras nada los rompa, pero no hay nada que devolver si el volumen se
pierde, si una migración sale mal o si alguien borra una fila. Este
procedimiento es la pieza que falta: sacar una copia restaurable, **restaurarla
en un destino nuevo** y **demostrar** que la recuperación conserva los datos y
los archivos.

Todo pasa por un solo comando, `scripts/respaldo.sh`, y todo es local. No toca
Railway, no baja datos remotos, no contrata nada y no escribe secretos.

## Qué se copia

| Origen | Con Docker | Sin Docker |
|---|---|---|
| Base PostgreSQL/PostGIS | `pg_dump -Fc` dentro de `topgreen-db` | `pg_dump -Fc` contra `127.0.0.1:5432` |
| Imágenes subidas | volumen `uploads_data` | `backend/uploads` |
| Documentación fiscal | volumen `documentos_data` | `backend/documentos` |
| Correo sin enviar | `backend/outbox` | `backend/outbox` |

El `outbox` entra porque hoy sustituye al correo real: perderlo es perder la
evidencia de qué se mandó.

**Lo que este respaldo no cubre**, y conviene saberlo antes de confiar en él:
los `.env`, que no se versionan y no se copian acá a propósito —tienen
secretos—; el estado en memoria de la API; y los datos de Railway, que son
remotos y quedan fuera de esta pieza por decisión de la tarea.

## Requisitos

- `pg_dump`, `pg_restore`, `psql`, `tar`, `gzip`, `sha256sum`.
- Con Docker: el demonio en marcha y los contenedores del lanzador oficial.
- Sin Docker: PostgreSQL nativo y `sudo -u postgres` para crear la base de
  destino y su extensión PostGIS —el rol `topgreen` no es superusuario—.

El comando detecta el entorno solo: si hay demonio de Docker usa los
contenedores y volúmenes; si no, la base nativa y los directorios del backend.

## Los cuatro pasos

```bash
# 1. Copiar. Deja el bundle en respaldos/<sello>/ e imprime su ruta.
./scripts/respaldo.sh respaldar

# 2. Restaurar en un destino NUEVO. Imprime el sello del destino.
./scripts/respaldo.sh restaurar respaldos/<sello>

# 3. Comparar origen, bundle y destino. Sale con 0 sólo si todo cierra.
./scripts/respaldo.sh verificar respaldos/<sello> <sello-del-destino>

# 4. Borrar el destino de prueba, y nada más.
./scripts/respaldo.sh limpiar <sello-del-destino>
```

## Qué hay adentro del bundle

```
respaldos/<sello>/
  base.dump            volcado lógico, formato custom de pg_dump
  base.indice.txt      índice legible del volcado (pg_restore --list)
  datos.tar.gz         uploads, documentos y outbox
  huella-base.tsv      por tabla: filas y resumen del contenido ordenado
  huella-archivos.tsv  por archivo: ruta, tamaño y sha256
  manifiesto.json      fecha, entorno, versiones, formato y totales
  SHA256SUMS           checksum de cada archivo del bundle
```

El manifiesto **no lleva credenciales**: nombre de base, versiones y totales.
Los artefactos no se versionan; `respaldos/` está en `.gitignore`.

## Qué demuestra la verificación

Cinco cosas, y cualquiera que falle corta con código distinto de cero:

1. el bundle coincide con sus propios checksums;
2. la base restaurada coincide, tabla por tabla, con la del respaldo —cantidad
   de filas **y** resumen del contenido, así que una fila cambiada se ve aunque
   la cantidad no cambie—;
3. los archivos restaurados coinciden en ruta, tamaño y sha256;
4. el origen conserva la identidad que tenía al respaldar: un respaldo que
   altera lo que copia no es un respaldo;
5. el origen sigue arriba: los contenedores en marcha, o la API contestando.

La comparación es contra **el bundle**, no contra el origen vivo: si el origen
cambió después del respaldo, eso lo dice el punto 4 y no se confunde con una
restauración incompleta.

## Aislamiento y seguridad de la limpieza

El destino se crea siempre nuevo:

- base `topgreen_restore_<AAAAMMDD_HHMMSS>`, nunca `topgreen`;
- archivos en `respaldos/destino-<sello>/`.

`limpiar` sólo acepta un sello con esa forma exacta y se niega a cualquier otra
cosa; comprobado con `topgreen`, con vacío y con un sello mal formado. Nunca
borra volúmenes ni contenedores que no haya creado esta pieza.

## Cuando falla

- **«el bundle no coincide con sus checksums»**: el bundle está incompleto o
  alterado. No se restaura nada; conseguí otra copia.
- **«la base restaurada coincide…» en rojo**: la salida muestra las tablas con
  diferencia. Si la cantidad es la misma y cambia el resumen, cambió el
  contenido de alguna fila.
- **«el origen conserva la identidad…» en rojo**: el origen cambió entre el
  respaldo y la verificación. No invalida la copia; sí invalida compararla con
  lo que hay ahora.
- **`pg_restore` con avisos**: se informan y la verificación decide. Un aviso
  con la comparación verde es ruido; con la comparación roja, la causa.

## Lo que todavía no es

Esto demuestra que el estado local se puede recuperar. **No** es la puerta de
producción: falta decidir dónde se guardan las copias, con qué frecuencia y con
qué retención, y ejercitar la restauración contra el entorno real. Esa decisión
—y su gasto— son de Emi.
