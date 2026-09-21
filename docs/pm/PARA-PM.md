# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PRIMARY-IMAGE-INTEGRITY-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `1e2b751` |
| SHA candidato (producto + migración + regresión) | `cfeff88` |
| informe | este commit |
| no integrado, no desplegado | `main` quedó en `0bd7fbc`, donde lo dejaste vos |

**Sobre la base.** Pediste partir de `0bd7fbc`. La rama está en `1e2b751`, que
es `0bd7fbc` más tu commit de documentación: el único delta son cuatro archivos
de `docs/pm/`. El producto que medí es exactamente el de `0bd7fbc`.

Y una corrección al vuelo: escribí este informe diciendo que `main` seguía en
`4c8569d`, y no. Mientras trabajaba lo llevaste a `0bd7fbc`, que es la
aceptación de `RISK-REC-1`. O sea que la base que me diste **es** la punta de
`main`, y lo que entrego se apoya derecho sobre la composición publicada. Yo no
toqué `main`.

### Lo primero, porque te toca decidir

Para cerrar esto tuve que **tocar el caso 172**, que estaba en tu lista de «no
se toca». Te explico abajo en detalle, pero el resumen es: el caso fabricaba
una segunda imagen principal por SQL directo, y eso es exactamente lo que esta
tarea vuelve imposible. No cambié lo que el caso mide; moví la parte que ya no
se puede construir al único lugar donde todavía se puede.

---

## Lo que medí antes de tocar nada

```
duplicadas en la base sembrada                  0
índice único parcial sobre product_images       no existe
una segunda principal por SQL directo           la base la acepta
dos primeras cargas simultáneas                 1 principal (ver abajo)
borrar la principal, con órdenes desordenados   promovió la de orden 9
                                                teniendo al lado la de orden 5
```

Dos cosas que conviene que sepas, porque cambian cómo leer el trabajo:

**La base sembrada no tiene duplicados hoy.** Los que aparecieron mientras
medía los había creado yo. Así que la limpieza de la migración no está
arreglando un desastre existente: está dejando el camino listo para que la
restricción se pueda crear sobre cualquier base, incluida la de producción,
que no miré.

**Las dos cargas simultáneas ya daban una sola principal, pero por accidente.**
El endpoint decide leyendo un conteo y escribiendo después; entre las dos
cosas no hay ningún `await`, así que el bucle de eventos no le da paso a la
otra petición justo ahí. Es la misma protección accidental que te informé como
riesgo adyacente en `RISK-REC-1`: **deja de valer el día que alguien agregue un
`await` en el medio**. Ahora no depende de eso.

---

## Lo que hice

### 1. La migración `b6d3f12a8e94`

Dos pasos, y el orden es el punto:

1. de cada publicación con más de una principal sobrevive **una**: la de menor
   `display_order` y, a igualdad, la de menor `id`;
2. recién entonces se crea el **índice único parcial** sobre
   `product_images(product_id)` `WHERE is_primary`.

Al revés no funciona, y no es teoría: el sabotaje `dedupe` lo demuestra —
`alembic upgrade head` falla sobre datos con duplicados.

El criterio de cuál sobrevive **no lo elegí yo**: es el mismo con el que el
catálogo viene eligiendo desde `QUERY-IMG-1`. Así, una publicación que hoy
tenga duplicados no cambia la foto que ya se le ve. Elegir cualquier otra sería
cambiarle la tapa a una publicación sin que nadie lo pidiera.

**No se borra ninguna imagen.** Las que dejan de ser principales siguen en la
galería, con su orden.

La vuelta atrás retira la restricción y nada más: no reconstruye duplicados
—no se puede saber cuáles eran, y tampoco haría falta— y no toca una fila.

El índice va también declarado en el modelo. No es una copia de más: si
estuviera sólo en la migración, el esquema y el modelo no coincidirían y
`alembic check` lo marcaría en cada corrida.

### 2. La carga

Estaba mezclada: leía el archivo, lo subía al almacenamiento y decidía si era
principal, todo en el mismo bucle. Cada `await` de ese bucle le da paso a otra
petición, así que la decisión quedaba tomada sobre un conteo que podía cambiar
antes de escribirse.

Ahora son dos tramos: primero se guardan los archivos, después se escribe la
base, y ese segundo tramo no tiene ninguna espera adentro. Además **toma la
fila de la publicación** antes de mirar sus imágenes, para que la regla no
dependa de que ese tramo siga sin esperas. El índice es la última palabra; esto
evita que la última palabra sea un 500 en la cara de quien sube una foto.

Y cambié **qué** decide: antes miraba si había imágenes, ahora mira si hay
**principal**. Una publicación con fotos y sin principal existe —dato viejo, o
un borrado que no llegó a promover— y no se ve en el catálogo; la próxima carga
la deja sana en vez de dejarla como estaba. Si ya hay principal, no se la toca.

### 3. El borrado

Promovía «la primera fila que devuelva la base», sin orden ninguno. Medido
sobre tres imágenes con los órdenes cambiados a mano: **promovió la de orden 9
teniendo al lado la de orden 5**. La tapa de la publicación quedaba a criterio
del planificador de consultas.

Ahora promueve siempre la misma —menor `display_order`, y por `id` a igualdad—
y lo hace en la **misma transacción** que el borrado. Con dos commits quedaba
una ventana en la que la publicación tenía fotos y ninguna principal, y en esa
ventana el catálogo la muestra sin foto.

---

## El caso 172, que sí toqué

El caso fabricaba cuatro publicaciones **con dos imágenes principales** por
`INSERT` directo, para medir que el listado las tolerara: una sola tarjeta, una
sola URL y el total sin inflar. Era la defensa que dejó `QUERY-IMG-1`.

Ese `INSERT` ahora lo rechaza la base. El caso se pone rojo, y no por un
defecto: por el arreglo.

Lo resolví sin perder nada de lo que medía:

- **En el 172**, ese grupo pasa a medir que la base **rechace** la segunda
  principal, y sigue quedando con dos filas por publicación —la segunda entra
  como secundaria— para que el `outerjoin` siga teniendo de dónde multiplicar
  la fila si alguien le sacara la subconsulta determinista al listado. Todo lo
  demás del caso —el N+1, el total, las URLs, el orden— no se tocó.
- **En el 179**, con la migración abajo y el duplicado existiendo de verdad, se
  comprueba que el listado siga sacando **una sola tarjeta** y **la imagen de
  menor orden**. Es la misma afirmación de antes, medida en la única ventana en
  la que ese dato puede existir.

Tolerar el duplicado y no dejar que se cree son dos defensas distintas, y las
dos siguen puestas. **No toqué `catalog.py`**: la subconsulta determinista de
`QUERY-IMG-1` quedó igual.

Si preferís que el 172 quede exactamente como estaba, la única forma es que
baje y suba la migración él mismo para fabricar su escenario, y eso deja la
suite corriendo un rato sin la restricción. Me pareció peor. Decidilo vos.

---

## Diff

```
backend/alembic/versions/…_una_sola_imagen_principal.py   +80      dedupe y el índice
backend/app/models/product_image.py                       +21 −1   el índice, declarado
backend/app/api/products.py                               +71 −24  carga y borrado
scripts/smoke.mjs                                        +385 −18  caso 179 y el 172
scripts/sabotajes_primary_image_1.py                     +227      los cuatro rojos
```

Sin endpoint nuevo, sin tabla nueva, sin dependencia, sin cambio de contrato de
respuesta y sin tocar la UI.

---

## Los cuatro rojos, con su texto

`python3 scripts/sabotajes_primary_image_1.py` aplica cada rotura, corre el
caso 179 contra ella y deja el árbol **y la base** como estaban.

| Sabotaje | Lo que dice el rojo |
|---|---|
| la migración no crea el índice | «no existe el índice «uq_product_images_primaria_unica» sobre product_images: sin él la regla vuelve a depender de que ningún camino se olvide» |
| la migración crea el índice sin limpiar antes | `alembic upgrade head` falla: es el motivo por el que los dos pasos van en ese orden |
| borrar la principal promueve cualquiera | «borrar la principal promovió la imagen equivocada: la tapa de la publicación quedó a criterio del planificador de consultas y no de una regla» |
| toda imagen subida se declara principal | «no se pudieron dejar dos imágenes: HTTP 200 y 500» |

El primero es el negativo que pediste: sin la restricción, el caso se pone rojo
al admitir dos principales; restaurada la candidata, vuelve a verde.

**Una advertencia sobre el script.** Restaurar la base no es «bajar y volver a
subir»: la versión saboteada `indice` deja la base marcada como migrada y sin
índice, así que el `downgrade` falla al retirar algo que no está y no se
recrea nada. Medido: los tres sabotajes siguientes corrían sin índice y daban
todos el mismo rojo, que es un falso verde disfrazado de rojo. El script ahora
lleva la base a un estado conocido —retira el índice exista o no, deduplica, y
marca la versión anterior sin ejecutar DDL— y recién entonces sube.

---

## Lo que ejecuté

```
caso 179 focal                                  1/1
casos 20, 162 y 172                             3/3, verdes en la suite completa
suite completa desde base limpia (cfeff88)      178/179   ← único rojo el 131
los cuatro sabotajes                            FAIL en el caso 179, 4/4
alembic upgrade head desde base vacía           verde, deja el índice
alembic downgrade -1 y upgrade head             verdes, sin perder imágenes
alembic check                                   No new upgrade operations detected
npm run build / lint / tsc --noEmit             verdes
node --check · compileall · pip check           verdes
git -c core.whitespace=cr-at-eol diff --check   sin avisos
```

**No corrí a11y ni contraste**, y no es un olvido: esta pieza no cambia ninguna
superficie visible. No toca un componente, una hoja de estilos ni un texto de
pantalla. Si querés que las corra igual, las corro.

Docker y PostGIS **sí** están disponibles en mi entorno y ejecuté todo lo de
arriba. El caso 131 sigue siendo el único ambiental: necesita demonio de Docker
y la imagen `alpine:3`, que este contenedor no tiene.

---

## Qué mide el caso 179

**A. La restricción existe y es de PostgreSQL.** Lee `pg_indexes` y exige que
sea único, sobre `(product_id)` y con `WHERE is_primary`. Después escribe una
segunda principal **desde la base**, sin pasar por la aplicación, y exige el
rechazo. Una secundaria más sigue entrando.

**B. La migración limpia lo que ya estaba sucio.** El dato sucio no se puede
fabricar con la restricción puesta, así que el caso **baja la migración**, deja
una publicación con tres principales y otra con dos del mismo
`display_order` —ahí el desempate por `id` es lo único que decide—, comprueba
que bajar no tocó ninguna fila, y **vuelve a subirla**. Exige: una sola
principal en cada una, la correcta, sin perder ninguna imagen. Y con el
duplicado todavía existiendo, que el listado siga sacando una tarjeta y la
imagen de menor orden.

**C. Los recorridos.** Primera carga deja una principal; las posteriores no se
la cambian y no se declaran principales; los órdenes no se repiten; borrar la
principal promueve la de menor orden; borrar las que quedan deja cero, que es
válido.

**D. Dos primeras cargas a la vez.** Tres rondas: sin 5xx, las dos imágenes
conservadas y una sola principal.

**E. Los límites de antes.** Vendedor ajeno en 403, el tope de tres imágenes y
el filtro de formato siguen rechazando, y la publicación al tope conserva una
sola principal.

---

## Lo que encontré y **no** toqué

**El orden de exhibición puede repetirse.** La carga asigna
`display_order = cuántas hay + posición`. Si antes se borró una imagen del
medio, el número nuevo puede coincidir con uno existente. No rompe nada —tanto
la promoción como el catálogo desempatan por `id`, así que la elección sigue
siendo determinista— pero el número deja de ser un orden estricto. Se arregla
con `máximo + 1`. No lo hice porque ningún criterio tuyo lo pide y no quería
meter un cambio de comportamiento más en esta pieza.

**El borrado sigue tocando el almacenamiento antes que la base.** Si la
escritura fallara después de borrar el archivo, la fila queda apuntando a algo
que no está. Es como estaba y no lo toqué: cambiar ese orden es otra decisión.

---

## Lo que no hice

No cambié `QUERY-IMG-1`, paginación, contratos de respuesta ni la UI. No
rediseñé la galería, no agregué reordenamiento manual ni un endpoint para
elegir la principal. No toqué el N+1 del carrito. No toqué Railway, datos
remotos ni `main`, y **no desplegué**. La migración queda en rama: publicarla
es una puerta operativa tuya, y con más razón que de costumbre, porque después
de una migración de esquema no hay vuelta atrás ciega sólo de código.

Freno acá para tu revisión.
