# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BACKUP-RESTORE-1 R2

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **SHA base** | `24dcca8` |
| **SHA candidato** | `b9d0036` |
| **SHA R1, que no reescribí** | `79af761` (producto/arnés) y `2ffb08a` (informe) |
| **HEAD de este informe** | el commit que trae este archivo |
| **Diff total desde `24dcca8`** | `scripts/respaldo.sh`, `docs/RESPALDO_Y_RESTAURACION.md` y tres líneas de `.gitignore`. **No toca producto** |
| **Estado** | en mi rama. No integré, no desplegué, no toqué Railway, datos remotos ni secretos. No abrí otra tarea |

---

### Antes que nada: la devolución no es sobre mi entrega

La revisión R1 dice que revisó la candidata `5ae5572` y el informe `4636b23`.
Esos dos commits **no son míos**:

```
$ git branch -r --contains 5ae5572   → origin/codex/backup-restore-1
$ git branch -r --contains 4636b23   → origin/codex/backup-restore-1
$ git branch -r --contains 79af761   → origin/claude/dev-role-repo-3l0kp3
```

Hay otra entrega de `BACKUP-RESTORE-1`, en `origin/codex/backup-restore-1`, y es
la que revisaste. Los identificadores que cita la devolución lo confirman:
`data_roots` y `cleanup` no existen en mi guión —los míos son `respaldar`,
`restaurar`, `verificar` y `limpiar`—; `grep -c 'data_roots\|cleanup'` sobre
`scripts/respaldo.sh` da **0**.

**Decidí vos cuál sigue.** Yo trabajé sobre la mía porque es la que puedo
sostener con evidencia, pero tener dos implementaciones de la misma pieza es un
problema de coordinación, no técnico.

### Punto 1 del retorno: ya estaba

`outbox` está en el bundle **desde R1**, no lo agregué ahora. En `79af761`:
`CARPETAS_NATIVAS` incluye `backend/outbox`, la rama Docker lo copia aparte, y
el positivo de R1 ya llevaba un marcador en las tres raíces. La huella de esta
corrida lo muestra:

```
documentos/marcador-respaldo.txt
outbox/marcador-respaldo.txt
uploads/marcador-respaldo.txt
```

Lo que sí agregué es decir **de dónde sale en cada entorno**, que era lo otro
que pedías: en el lanzador local el outbox no es un volumen sino el montaje
`./backend/outbox → /app/outbox`, así que se copia del anfitrión; en producción
vive dentro del volumen de `/data` (`EMAIL_OUTBOX_DIR=/data/outbox`) y entra por
la copia de volúmenes. Está en el comentario del código y en el procedimiento.
No toqué el compose ni el producto para acomodar la prueba.

### Punto 2 del retorno: tenías razón, y valía para la mía también

Mi `limpiar` se apoyaba en el patrón del nombre. Eso no prueba propiedad, tal
cual lo escribiste. Corregido:

- al restaurar, cada destino queda **firmado** con un identificador de
  ejecución: una fila en `respaldo_meta.propiedad` dentro de la base y un
  archivo `.propiedad` en el directorio. El esquema es aparte de `public` a
  propósito, para no ensuciar los datos restaurados ni la comparación;
- `limpiar` exige **las dos firmas y que coincidan entre sí**. Si falta una, si
  está vacía o si la base no lleva la ejecución que dice el directorio, frena y
  no borra nada. El patrón del nombre sigue, pero ahora es lo primero de tres,
  no lo único.

**Negativo de propiedad, medido.** Creé a mano una base `topgreen_restore_
20260101_000000` con datos adentro y un directorio con el nombre que la pieza
usaría:

```
a) sin firma:
   ERROR: respaldos/destino-20260101_000000 no lleva la firma de esta pieza.
          No se borra nada.
b) con firma FALSIFICADA en el directorio y base sin firmar:
   ERROR: la base topgreen_restore_20260101_000000 no lleva la firma
          deadbeefdeadbeefdeadbeef: no la creó esta ejecución. No se borra nada.
¿sobrevivió?  «esto no es de la pieza» y no-es-mio.txt, intactos
```

Después lo retiré con un comando explícito y acotado: `DROP DATABASE
"topgreen_restore_20260101_000000"` y `rm -rf` de ese único directorio. Y el
destino legítimo, el firmado, sí se limpia: «borrados … los dos firmados con
`f908a60a…`; nada más se tocó».

### Un tercer defecto, que encontré yo y era el que te iba a romper la corrida

Al comprobar `sh -n` me puse a mirar qué herramientas usa el guión, y la huella
dependía de **utilidades que en macOS no existen**: `sha256sum` —ahí es `shasum
-a 256`—, `find -printf`, `stat -c` y `xargs -r`, todas GNU. Con Docker el
`docker run` corre en el contenedor, pero la huella de los archivos se calcula
en tu anfitrión: te habría fallado la primera vez. Ahora se resuelve una sola
vez al arrancar y el resto del guión no se entera; los tamaños salen de `wc -c`
en lotes, que es POSIX. Misma huella, sobre los mismos 2836 archivos.

Sobre `sh -n`: el guión declara `#!/usr/bin/env bash` y usa arreglos, así que
`sh -n` marca la línea 110 —igual que marcaría cualquier bash con arreglos—. La
compuerta que corresponde es **`bash -n`, y está verde**. Si querés que sea
POSIX puro se puede, pero hay que sacar los arreglos; decime.

### Positivo completo, sobre `b9d0036`

```
$ ./scripts/respaldo.sh respaldar          → respaldos/20260913_201105
     2836 archivos y 23 tablas en la huella
$ ./scripts/respaldo.sh restaurar …        → destino 20260913_201108
$ ./scripts/respaldo.sh verificar … 
  ✓ el bundle coincide con sus checksums
  ✓ la base restaurada coincide con la del respaldo
  ✓ los archivos restaurados coinciden con los del respaldo
  ✓ el origen conserva la identidad que tenía al respaldar
  ✓ la API de origen sigue contestando          (código 0)
```

Y del otro lado, las tres filas del marcador —con la ñ y los acentos— y los
tres `marcador-respaldo.txt`, uno por raíz.

### Negativos de integridad, otra vez sobre este SHA

| Sabotaje | Resultado |
| --- | --- |
| archivo alterado | rojo, con ruta, tamaño 38 → 25 y otro sha256 |
| archivo ausente | rojo, con la línea que falta |
| fila cambiada, misma cantidad | rojo: `respaldo_marcador 3 cfb39a0…` → `3 dddf39f…` |
| bundle adulterado | `restaurar` se niega: «no coincide con sus checksums» |

### Origen, antes y después

Idéntico: la huella del origen al terminar es la misma que guardó el bundle, la
única base que queda es `topgreen`, la API contesta 200 y los tres directorios
tienen los archivos que tenían. Retiré los marcadores y el destino de prueba.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| Positivo completo | verde |
| Cuatro negativos de integridad | rojos |
| Negativo de propiedad, dos variantes | frena sin borrar; el ajeno sobrevive |
| `bash -n` · `diff-check` | verdes |
| `sh -n` | marca un arreglo de bash en la línea 110; el guión es bash |
| Suite funcional completa | **no corrida**, como pediste |

### Lo que sigue sin correr

La ruta Docker. Acá el `docker` del PATH es el puente del repositorio y no hay
demonio, así que no pude crear el contenedor ni los volúmenes de destino. Con la
corrección de portabilidad tiene bastante menos superficie para romperse, pero
**no la ejecuté**: la tenés que demostrar vos sobre este SHA. Y sigue en pie la
pregunta de R1: la copia de volúmenes usa `docker run --rm -v <volumen>:/origen:
ro` sobre `alpine:3`; si no querés que se baje esa imagen, lo cambio por
`docker cp`.

### Lo que sigue esperando tu palabra

- el carrito sin sesión;
- la FAQ de Contacto dice «Aceptamos transferencias bancarias directas al
  vendedor» y el producto también cobra por Mercado Pago
  (`src/components/Pages/ContactPage.tsx:305`).
