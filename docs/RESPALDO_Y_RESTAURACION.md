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
| Base PostgreSQL/PostGIS | `pg_dump -Fc` por `docker exec` en `topgreen-db` | `pg_dump -Fc` contra `127.0.0.1:5432` |
| Imágenes subidas | `docker cp` desde `$UPLOAD_DIR` de `topgreen-api` | `backend/uploads` |
| Documentación fiscal | `docker cp` desde `$DOCUMENTOS_DIR` | `backend/documentos` |
| Correo sin enviar | `docker cp` desde `$EMAIL_OUTBOX_DIR` | `backend/outbox` |

**Con Docker no se adivina nada.** Usuario, base, imagen y las tres rutas del
almacenamiento se leen de los contenedores que están corriendo
(`docker inspect`), no del `docker-compose.yml` ni de un nombre de volumen. Los
nombres de volumen del compose llevan el prefijo del proyecto, así que usarlos
tal cual crearía volúmenes vacíos y los respaldaría como si fueran el origen; y
el usuario de la base es el que diga `POSTGRES_USER`, que no es `postgres`.

Por eso también sirve igual en un entorno donde el correo sin enviar vive dentro
del volumen de `/data` —`EMAIL_OUTBOX_DIR=/data/outbox`— y en el lanzador local,
donde es un montaje del repositorio en `/app/outbox`: la ruta sale de la
aplicación, no de una suposición. Una ruta relativa se resuelve contra el
directorio de trabajo del contenedor. No se cambia el compose ni el producto
para acomodar la prueba.

El `outbox` entra porque hoy sustituye al correo real: perderlo es perder la
evidencia de qué se mandó.

**Lo que este respaldo no cubre**, y conviene saberlo antes de confiar en él:
los `.env`, que no se versionan y no se copian acá a propósito —tienen
secretos—; el estado en memoria de la API; y los datos de Railway, que son
remotos y quedan fuera de esta pieza por decisión de la tarea.

## Requisitos

- `tar`, `gzip` y **`sha256sum` o `shasum -a 256`**: se usa el que haya, así que
  funciona igual en Linux y en macOS. Nada de `find -printf`, `stat -c` ni
  `xargs -r`, que son de GNU.
- Con Docker: el demonio en marcha y los contenedores del lanzador oficial. Las
  herramientas de PostgreSQL salen de los contenedores; en el anfitrión no hace
  falta ninguna. **Esta ruta no descarga ninguna imagen**: el destino se levanta
  con la misma imagen que ya está sirviendo el origen, leída del contenedor
  real, y los archivos se copian con `docker cp`, sin imagen auxiliar.
- Sin Docker: PostgreSQL nativo con `pg_dump`, `pg_restore` y `psql`, y
  `sudo -u postgres` para crear la base de destino y su extensión PostGIS —el
  rol `topgreen` no es superusuario—.

El comando detecta el entorno solo: si hay demonio de Docker trabaja con los
contenedores; si no, con la base nativa y los directorios del backend.

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
5. el origen sigue arriba: los contenedores en marcha, o la API contestando; y
   con Docker, que dentro de `topgreen-db` no haya aparecido ninguna base de
   restauración, porque el destino es otro contenedor.

La comparación es contra **el bundle**, no contra el origen vivo: si el origen
cambió después del respaldo, eso lo dice el punto 4 y no se confunde con una
restauración incompleta.

## Aislamiento y seguridad de la limpieza

El destino se crea siempre nuevo, y **fuera del origen**:

- con Docker, **otro contenedor sobre otro volumen**:
  `topgreen-restore-<sello>-db` y `topgreen-restore-<sello>-datos`. No se crea
  ninguna base adentro de `topgreen-db`: eso escribiría en el volumen que se
  está tratando de proteger. La credencial de ese contenedor se genera en la
  corrida, es local y efímera, y no se escribe en el bundle ni en ningún
  informe;
- sin Docker, la base `topgreen_restore_<AAAAMMDD_HHMMSS>`, nunca `topgreen`;
- en los dos casos, los tres árboles de archivos en `respaldos/destino-<sello>/`.

Si la restauración se cae a la mitad, lo que alcanzó a crear se retira solo: no
quedan contenedores ni volúmenes colgados esperando al próximo intento.

**El nombre no prueba propiedad.** Cualquiera puede crear una base o una carpeta
que se llame igual, y borrar por patrón es borrar lo que otro dejó ahí. Por eso
cada destino queda firmado, al restaurarlo, con un identificador de ejecución:

- en la base, una fila en `respaldo_meta.propiedad` —un esquema aparte, para no
  ensuciar los datos restaurados ni la comparación, que sólo mira `public`—;
- en el directorio, un archivo `.propiedad` con esa misma ejecución;
- con Docker, además, **el contenedor y el volumen llevan etiquetas**:
  `topgreen.respaldo=pieza` y `topgreen.respaldo.ejecucion=<id>`.

`limpiar` exige las firmas y que coincidan entre sí; con Docker comprueba la
etiqueta de **cada** recurso antes de borrarlo. Si falta una, si están
vacías o si la base no lleva la ejecución que dice el directorio, **frena sin
borrar nada**. Y antes de eso sigue exigiendo que el sello tenga la forma
exacta. Un destino ajeno con el nombre correcto sobrevive: comprobado, con y sin
una firma falsificada en el directorio.

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
