# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BACKUP-RESTORE-1 R3

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **SHA base** | `24dcca8`; `origin/main` (`bd04587`) incorporado por merge, sin reescribir nada |
| **SHA candidato** | `f3e9d54` |
| **SHA anteriores, intactos** | `79af761`/`2ffb08a` (R1) y `b9d0036`/`6f02c32` (R2) |
| **Diff total desde `24dcca8`** | `scripts/respaldo.sh`, `docs/RESPALDO_Y_RESTAURACION.md`, tres líneas de `.gitignore` y este canal. **No toca producto** |
| **Estado** | en mi rama. No integré, no desplegué, no toqué Railway ni datos remotos. No abrí otra tarea |

**Los cuatro defectos eran míos, y por la misma causa: escribí esa rama sin
poder correrla.** Van corregidos de raíz, no parcheados.

---

### 1. Nada se adivina

Tenías razón y lo confirmé contra el `docker-compose.yml`: los volúmenes se
declaran `uploads_data` y `documentos_data`, y Compose les pone el prefijo del
proyecto, así que esos nombres **no existen**. Montarlos habría creado volúmenes
vacíos y los habría respaldado como si fueran el origen.

**Ya no se nombra ningún volumen de origen.** Usuario, base, imagen y las tres
rutas del almacenamiento salen de `docker inspect` sobre los contenedores en
marcha:

```
POSTGRES_USER, POSTGRES_DB   ← inspect topgreen-db
Config.Image                 ← inspect topgreen-db
UPLOAD_DIR, DOCUMENTOS_DIR,
EMAIL_OUTBOX_DIR             ← inspect topgreen-api
```

Y una ruta relativa se resuelve contra el `WorkingDir` del contenedor, que es
justo el caso del outbox: `EMAIL_OUTBOX_DIR=outbox` sobre `/app`. Por eso la
misma pieza sirve en un entorno donde el outbox está en el volumen de `/data`:
la ruta la dice la aplicación, no yo.

### 2. El destino ya no vive dentro del origen

Crear `topgreen_restore_*` adentro de `topgreen-db` escribía en el volumen que
esta pieza tiene que proteger. Ahora el destino es **otro contenedor sobre otro
volumen**: `topgreen-restore-<sello>-db` y `topgreen-restore-<sello>-datos`.
Y la verificación suma una comprobación nueva: que dentro de `topgreen-db` **no
haya aparecido ninguna base de restauración**.

### 3. Usuario, imagen y credencial

El usuario es el que declara `POSTGRES_USER` —nunca más `postgres`—, y el
clúster de destino se levanta con **la misma imagen que ya sirve el origen**,
leída del contenedor real: por definición está en la máquina. La credencial de
ese contenedor se genera en la corrida, es local y efímera, y no se escribe en
el bundle, ni en el manifiesto, ni acá.

### 4. Sin imagen auxiliar

`alpine:3` desapareció. Los archivos se copian con `docker cp`, que no necesita
herramientas adentro del contenedor. **La ruta no dispara ninguna descarga.**

### 5. Etiquetas, no nombres

Cada contenedor y cada volumen que crea la pieza llevan `topgreen.respaldo=pieza`
y `topgreen.respaldo.ejecucion=<id>`, y `limpiar` comprueba la etiqueta de
**cada** recurso antes de borrarlo, además de las firmas que ya tenía.

### 6. Un defecto más, que encontré yo

Una restauración que se caía a la mitad dejaba el contenedor y el volumen
colgados, y el próximo intento chocaba con ellos. Ahora se retiran solos. Ahí no
se comprueban etiquetas a propósito: se borra exactamente lo que esa misma
ejecución acaba de crear y anotó.

---

## Lo que pude probar, y lo que no

**No tengo demonio de Docker.** No pude correr la evidencia 2 a 5 que pedís
contra los contenedores reales, y no la voy a declarar corrida.

Lo que sí hice, para no entregarte otra vez código que no vi funcionar: **armé
un doble del demonio** —fuera del repositorio, en mi carpeta de trabajo— que
responde `inspect`, `cp`, `run`, `exec`, `volume` y `rm` con la forma real, y
apoya las bases del «contenedor» de destino en el PostgreSQL nativo. Con eso
corrí el ciclo Docker entero:

```
respaldar  → bundle con "entorno_de_origen": "docker", los tres marcadores adentro
restaurar  → contenedor topgreen-restore-<sello>-db · volumen …-datos
verificar  → ✓ checksums · ✓ base · ✓ archivos · ✓ origen sin moverse
             ✓ topgreen-db y topgreen-api en marcha
             ✓ topgreen-db no tiene ninguna base de restauración adentro
integridad → rojo con la ruta y los dos sha256
propiedad  → contenedor y volumen homónimos SIN etiqueta: «no lleva la etiqueta
             topgreen.respaldo.ejecucion=… (dice «nada»). No se borra nada.»
             y los dos sobreviven
limpiar    → borra los dos, etiquetados, y nada más
rescate    → con pg_isready roto a propósito: «la restauración quedó a medias;
             se retira lo que había creado» y no queda nada colgado
```

**Qué prueba eso y qué no.** Prueba el flujo, los argumentos, el orden de las
llamadas y toda la lógica que no es Docker —descubrimiento, huella, comparación,
firmas, etiquetas, rescate—. **No prueba la semántica real de Docker**: si
`docker cp -a` no le gusta a tu versión, si el `postgis/postgis` de destino
tarda distinto o si `docker inspect -f` devuelve otra cosa, lo vas a ver vos y
no yo. El doble encontró dos cosas igual: un mensaje que decía «base
topgreen_restore_…» cuando en Docker el destino es un contenedor, y el defecto
del punto 6.

**La ruta nativa, que comparte casi todo el código, sí la corrí entera** después
de la corrección: positivo verde, negativo de integridad rojo, negativo de
propiedad frenando sin borrar, limpieza y origen idéntico. Era la condición que
pusiste para no repetirla.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| `bash -n` · `diff-check` | verdes |
| Ciclo nativo completo tras la corrección | verde, con sus dos negativos |
| Ciclo Docker contra un doble del demonio | verde, con integridad, propiedad y rescate |
| Ciclo Docker contra Docker real | **no corrido**: acá no hay demonio |
| Suite funcional | no corrida, como pediste |

### Lo que te pido

Una de dos, la que prefieras:

1. **Corrés vos la evidencia 2 a 5** sobre `f3e9d54` y me devolvés lo que falle;
   o
2. **me das un entorno con demonio de Docker** y la corro yo. Es la tercera
   vuelta de la misma pieza y las tres devoluciones fueron por lo mismo: escribo
   una ruta que no puedo ejecutar. Mientras eso no cambie, el ciclo se repite.

### Lo que sigue esperando tu palabra

- el carrito sin sesión;
- la FAQ de Contacto dice «Aceptamos transferencias bancarias directas al
  vendedor» y el producto también cobra por Mercado Pago
  (`src/components/Pages/ContactPage.tsx:305`).
