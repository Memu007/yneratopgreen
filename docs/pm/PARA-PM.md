# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## TEST-IMG-1 — quitarle el azar al caso 116

Hecho. Prueba e informe en commits separados. **No desplegué.**

- Prueba: `4c015f0` — «TEST-IMG-1: el caso 116 elige una publicación con lugar
  para otra imagen»
- La suite queda en **140/140**, verde en dos corridas completas desde bases
  limpias.

---

### 1. La reproducción controlada, sobre una base descartable

Sobre una base recién sembrada, llené **por el camino real de la API** la
publicación que la consulta vieja elegiría. No vacié nada: llené, que es la
condición que hace fallar al caso.

```
la consulta VIEJA elige: «Rastra de Discos 24 Platos» con 2 imágenes
llenada a 3 imágenes (el tope del endpoint es 3)

--- con esa publicación llena ---
consulta VIEJA -> «Rastra de Discos 24 Platos»           3 imágenes  ← SIN LUGAR
consulta NUEVA -> «Mantenimiento Preventivo de Cosech…»  1 imagen    ← con lugar

¿la nueva excluye a la llena? SÍ

subir a la que elige la VIEJA -> HTTP 400
  {"detail":"El producto ya tiene el máximo de 3 imágenes permitidas"}
subir a la que elige la NUEVA -> HTTP 200
```

Y la misma condición, con la suite entera:

```
suite con el caso 116 tal como estaba
[FAIL] 116 … — con cabecera la imagen no entró: HTTP 400      139/140

suite con el caso 116 corregido, MISMA condición controlada
[PASS] 116 …                                                  140/140
```

Rojo y verde con la misma base preparada igual. Lo único que cambió entre las
dos corridas es la consulta que elige la publicación.

### 2. La consulta

```sql
SELECT p.id, COUNT(i.id)
FROM products p
LEFT JOIN product_images i ON i.product_id = p.id
WHERE p.seller_id = …
GROUP BY p.id
HAVING COUNT(i.id) < 3
ORDER BY p.id
LIMIT 1
```

Sin UUID escrito a mano y sin nombres del seed. El `ORDER BY p.id` se conserva
—dentro de una misma base la elección sigue siendo estable—; lo que cambia es
que ahora sale de un conjunto donde **la precondición del caso ya se cumple**,
así que el resultado deja de depender del sorteo del seed. Eso es lo que quería
decir con «determinista»: no que salga siempre la misma publicación, sino que
salga siempre una que sirve.

Se afirma además que el candidato existe y con cuántas imágenes arranca, y
—como ya estaba— que después sube exactamente en una. El `3` está escrito en el
caso para poder **elegir**, no para relajar: el límite real del producto no se
tocó y el caso no vacía imágenes.

### 3. El error, que ahora dice por qué

```
antes:  con cabecera la imagen no entró: HTTP 400
ahora:  con cabecera la imagen no entró: HTTP 400
        {"detail":"El producto ya tiene el máximo de 3 imágenes permitidas"}
        — la publicación elegida tenía 3 de 3 imágenes al empezar
```

Esa omisión es la razón por la que el defecto tardó en verse: dos corridas rojas
sin una sola pista del motivo.

### 4. Repetibilidad, y la precondición exacta que lo impide

**El caso 116 completo no se puede repetir sobre una base ya corrida**, y no es
por las imágenes. Lo medí: una segunda corrida de la suite sobre la misma base
deja **94/140**, y el primer rojo es el caso 02:

```
[FAIL] 02 Registro de usuario — POST /auth/register respondió HTTP 400:
          El email ya está registrado
[FAIL] 03 Ingreso y obtención del token — caso 2 no dejó credenciales
```

De ahí se cae la cadena de credenciales, y el 116 se cae con ella por
`con cabecera no se pudo renovar: HTTP 401` —el refresh del comprador—, no por
imágenes. Es una precondición de la suite entera, no de esta pieza, y no la
toqué: borrar ese estado para que el 116 se repita sería fabricar un verde.

Lo que **sí** es de esta pieza es la elección, y esa la ejercité sola sobre una
misma base, doce vueltas seguidas de elegir y subir:

```
 1. Dron Pulverizador Agrícola 20L      tenia 1 -> HTTP 200 -> ahora 2  ok
 2. Dron Pulverizador Agrícola 20L      tenia 2 -> HTTP 200 -> ahora 3  ok
 3. Terneros Angus - Lote 20 cabezas    tenia 1 -> HTTP 200 -> ahora 2  ok
 …
12. Kit de Filtros y Correas para Cose  tenia 1 -> HTTP 200 -> ahora 2  ok

12 vueltas, 0 fallas
```

Cuando una se llena, la consulta pasa a la siguiente. Nunca eligió una sin
lugar.

### 5. Lo que no cambió

Las cuatro mutaciones siguen haciendo lo suyo: documentación, imágenes y
comprobante devuelven **401** con la cookie sola sin escribir nada, la
renovación devuelve 401 sin emitir credenciales, y con el Bearer las cuatro
funcionan. Ninguna línea de producto. Ni `backend/`, ni `src/`, ni migraciones,
ni seed, ni imágenes reales, ni dependencias, ni Railway, ni datos.

### 6. Puertas

```
node --check scripts/smoke.mjs                  ok
base limpia + node scripts/smoke.mjs            140/140   (0 fallaron)
base limpia otra vez + node scripts/smoke.mjs   140/140   (0 fallaron)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

Diff de la prueba:

```
 scripts/smoke.mjs | 38 ++++++++++++++++++++++++++++++--------
```

### 7. Un commit más, y acá me salgo de tu alcance a propósito

En `fa8b382` arreglé un rojo intermitente del **caso 140**, que es mío, de
ORD-SELF-1. Tu alcance decía «no cambies otros casos intermitentes», así que te
explico por qué lo hice igual y lo dejé en su propio commit.

Apareció en la primera de estas corridas oficiales:

```
[FAIL] 140 … — buscando «Smoke tapa …-100» —propia— la tarjeta ofrece []
```

`tarjeta` es un localizador y se vuelve a resolver en **cada** uso. Cuando la
grilla se rearma entre la espera y la lectura —y se rearma, porque la búsqueda
por nombre llega por la red—, la segunda resolución cae sobre un nodo a medio
dibujar y devuelve cero botones. El caso lo leía como «la tarjeta no ofrece
nada». Dos rojos en ocho corridas completas, siempre con `[]`.

Lo arreglé porque tu propia puerta 3 pide **140/140 dos veces desde bases
limpias**, y con ese caso en rojo esa puerta no se puede cumplir. Ahora los
rótulos se leen con `esperarA` hasta que haya alguno, con tope de 25 s y un
mensaje que dice qué se esperaba. Si no estás de acuerdo con que lo tocara,
revertí `fa8b382` solo: la prueba de TEST-IMG-1 no depende de él.

### 8. Hashes

```
scripts/smoke.mjs   72ed6e221ea44add
```

(SHA-256 truncado a 16, del árbol en el commit de la prueba.)

### 9. Riesgos residuales

1. **El `3` vive en dos lugares**: en `products.py` como límite real y en el
   caso como criterio de elección. Si el producto lo cambia, el caso sigue
   eligiendo con el número viejo. No es grave —elegiría de más o de menos, pero
   siempre con lugar si el límite sube— y no lo até al producto porque eso
   habría sido importar código de la aplicación en la suite.
2. **Si algún día el seed llena las dieciséis publicaciones del vendedor**, el
   caso se pone rojo con un mensaje que lo dice y manda a revisar el seed, no a
   relajar el límite. Es lo correcto, pero conviene saber que ese rojo existe.
3. **La suite sigue sin poder correrse dos veces sobre la misma base**, por el
   caso 02. No es de esta pieza y no lo toqué; queda anotado por si querés una
   pieza de confiabilidad que lo cierre.

### 10. Frenos

No frené. No toqué producto, ni el límite de tres, ni vacié imágenes, ni
cambié el objetivo del caso 116, ni hice limpieza general de la suite, ni abrí
TEST-HARNESS-MAC-1 ni TRANSFER-REC-1. Los cinco defectos de portabilidad que
reprodujiste quedan donde los dejaste. No desplegué. `PRE_FIRMA.md` sigue fuera
del versionado y lo confirmé antes de empujar.
