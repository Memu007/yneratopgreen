# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BACKUP-RESTORE-1

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3`, reiniciada desde `main` porque la candidata anterior ya está integrada |
| **SHA base** | `24dcca8` |
| **SHA candidato** | `79af761` |
| **HEAD de este informe** | el commit que trae este archivo, o sea la punta de la rama |
| **Diff del candidato** | `scripts/respaldo.sh` (nuevo), `docs/RESPALDO_Y_RESTAURACION.md` (nuevo) y tres líneas de `.gitignore`. **No toca producto**: nada de `src/`, `backend/`, `public/` ni el arnés |
| **Delta posterior al SHA candidato** | sólo este documento |
| **Estado** | en mi rama. No integré, no desplegué, no toqué Railway, datos remotos, secretos ni Mercado Pago. No empecé `POST-INTEGRATION-CLEAR-1` ni `CAT-PAGE-1` |

**Acá no hay demonio de Docker**, así que todo lo que informo corrió por la ruta
nativa. Lo digo ahora porque es la limitación de esta entrega, y está detallada
al final.

---

### Lo que hay

Un comando, `scripts/respaldo.sh`, con cuatro verbos, y el procedimiento escrito
en `docs/RESPALDO_Y_RESTAURACION.md`:

```
respaldar              → respaldos/<sello>/  (imprime la ruta)
restaurar  <bundle>    → base y archivos nuevos (imprime el sello del destino)
verificar  <bundle> <sello>
limpiar    <sello>
```

El bundle lleva `base.dump` (`pg_dump -Fc`), su índice legible, `datos.tar.gz`
con el almacenamiento persistente, `manifiesto.json`, las dos huellas y
`SHA256SUMS`. **El manifiesto no tiene ni una credencial**: nombre de base,
versiones, formato y totales.

### La huella, que es de lo que depende todo

- **Base**: por tabla, cantidad de filas **y** un resumen `md5` del contenido
  ordenado. Contar filas no distingue una fila cambiada de una intacta, y esta
  pieza existe para demostrar que la recuperación conserva los datos.
- **Archivos**: ruta relativa, tamaño y `sha256` de cada uno.
- Las consultas fijan `timezone=UTC` y `extra_float_digits=3` por `PGOPTIONS`,
  para que la huella dé lo mismo en tu máquina y en la mía.

### Aislamiento

El destino se crea siempre nuevo: base `topgreen_restore_<AAAAMMDD_HHMMSS>` y
directorio `respaldos/destino-<sello>`. Nunca sobre `topgreen`, `topgreen-db`,
`topgreen-api` ni sus volúmenes. `limpiar` sólo acepta un sello con esa forma
exacta.

### Evidencia

**Positivo.** Sembré marcadores no sensibles —una tabla `respaldo_marcador` con
tres filas, una con acento y ñ, y un `marcador-respaldo.txt` en cada uno de los
tres almacenamientos—, respaldé, restauré y verifiqué:

```
$ ./scripts/respaldo.sh respaldar
     base: 404K · datos: 244K
     2836 archivos y 23 tablas en la huella
$ ./scripts/respaldo.sh restaurar respaldos/20260913_193743   → 20260913_193746
$ ./scripts/respaldo.sh verificar respaldos/20260913_193743 20260913_193746
  ✓ el bundle coincide con sus checksums
  ✓ la base restaurada coincide con la del respaldo
  ✓ los archivos restaurados coinciden con los del respaldo
  ✓ el origen conserva la identidad que tenía al respaldar
  ✓ la API de origen sigue contestando
RECUPERACIÓN VERIFICADA                                        (código 0)
```

Y los marcadores están del otro lado, leídos en la base de destino y en sus
archivos: las tres filas —con la ñ y los acentos intactos— y los tres
`marcador-respaldo.txt`.

**Los negativos, cinco, todos medidos.**

| Sabotaje | Qué hizo la verificación |
| --- | --- |
| un archivo alterado en el destino | rojo, y nombra la ruta: `uploads/marcador-respaldo.txt`, 64 → 31 bytes y otro sha256. Código 1 |
| un archivo ausente | rojo, con la línea que falta y «1 línea(s) de diferencia» |
| **una fila cambiada, sin cambiar la cantidad** | rojo: `respaldo_marcador 3 d32ce83…` → `3 3fe70e4…`. Esto es justo lo que el conteo solo no ve |
| un byte agregado al `base.dump` del bundle | `restaurar` **se niega**: «el bundle no coincide con sus checksums: no se restaura» |
| `limpiar topgreen`, vacío, o un sello mal formado | se niega en los tres: «no tiene la forma de un destino de esta pieza» |

Después de reponer cada sabotaje desde el bundle, la verificación vuelve a
verde.

**El origen no se movió.** La huella del origen después de todo el ejercicio es
idéntica a la que quedó guardada en el bundle, y la API siguió contestando en
las cinco verificaciones. Los tres directorios quedaron con los archivos que
tenían.

**Repetible.** Corrí el ciclo entero una segunda vez, ya sin marcadores y con el
destino anterior borrado: respaldar → restaurar → verificar verde → limpiar. Los
dos bundles conviven sin pisarse.

**Limpieza.** Borré el destino de prueba y retiré los marcadores del origen. Los
bundles quedan en `respaldos/`, que agregué al `.gitignore`.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| Ciclo completo positivo | verde, dos veces |
| Los cinco negativos | rojos, cada uno con su mensaje |
| `bash -n scripts/respaldo.sh` · `node --check` · `diff-check` | verdes |
| Focales 157 y 162 | 2/2 — son los casos que enumeran documentos y guiones del repositorio, y esta pieza agrega dos archivos a esas listas |
| Suite completa, `a11y`, `contraste` | **no corridas**, y lo declaro: el diff no toca producto ni arnés |

### Lo que no pude correr, y es la limitación de esta entrega

**La ruta Docker.** Acá el `docker` del PATH es el puente del repositorio, que
sólo traduce `docker exec`: no hay demonio, así que no pude crear el contenedor
ni los volúmenes de destino. El código de esa ruta está escrito y es chico a
propósito —son tres funciones: consultar, volcar y copiar el almacenamiento; el
resto del procedimiento es el mismo—, pero **no lo ejecuté**. Que funcione con
`topgreen-db`, `uploads_data` y `documentos_data` lo tenés que demostrar vos
sobre este mismo SHA.

Ahí hay un supuesto mío que conviene mirar primero: en la ruta Docker copio los
volúmenes con `docker run --rm -v <volumen>:/origen:ro` sobre `alpine:3`. Si esa
imagen no está en tu máquina, se baja sola; si preferís que no se baje nada, hay
que cambiarlo por `docker cp` desde el contenedor. Decime y lo cambio.

### Dos cosas dichas antes de que confíes en esto

- **No es la puerta de producción.** Demuestra que el estado local se recupera.
  Falta decidir dónde se guardan las copias, con qué frecuencia y con qué
  retención, y ejercitar la restauración contra el entorno real. Esa decisión y
  su gasto son de Emi, y quedaron fuera de alcance por tu tarea.
- **Lo que el respaldo no cubre**, escrito también en el procedimiento: los
  `.env` —tienen secretos, no se versionan y no se copian—, el estado en memoria
  de la API y los datos remotos de Railway.

### Lo que sigue esperando tu palabra

- el carrito sin sesión;
- la FAQ de Contacto dice «Aceptamos transferencias bancarias directas al
  vendedor» y el producto también cobra por Mercado Pago
  (`src/components/Pages/ContactPage.tsx:305`). Sin tocar.
