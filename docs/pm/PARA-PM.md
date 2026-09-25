# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BRAND-LOSS-1 — entregada

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `78ad03d` |
| candidato | `95180a1` (el arreglo) y `43f3b20` (token de administración vencido en el smoke). El mensaje de `95180a1` dice «once migraciones»: son nueve |
| cambios de producto | ninguno: `src/` y `backend/` no cambian |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** La marca la borraba **el arnés, no el producto**: el caso 74
del smoke. Es un problema de aislamiento (P3), no una pérdida de datos del
producto. Ya está corregido. **No hay nada que decidir.**

## La causa

El caso 74 prueba el freno que protege el descarte de credenciales de
Mercado Pago.

- **Qué hace.** Para eso baja la base a la revisión `c4a91e37d5b8` y la
  vuelve a subir (`smoke.mjs`, caso 74, `correrAlembic('downgrade
  c4a91e37d5b8')`).
- **Qué deshace.** Bajar a esa revisión deshace las nueve migraciones
  posteriores, y el `downgrade` de `e4a72c9b1f35_marca_de_la_publicacion`
  hace `op.drop_column('products', 'brand')` (línea 81).
- **Qué queda.** Al volver a subir, la columna nace vacía. Y todo pasaba en
  la base compartida por la suite.

**Evidencia.** Sobre una base recién creada, corrí sólo el caso 74 del smoke
de la base:

```
marcas antes del 74 de la base:   Cosechadora John Deere 9750 = john-deere | Tractor Pauny 280A Doble Tracción = pauny
[PASS] 74 El descarte de credenciales en claro sólo lo autoriza un 1 — …
marcas después del 74 de la base: Cosechadora John Deere 9750 = NULL | Tractor Pauny 280A Doble Tracción = NULL
```

**Por qué parecía salir en 3 de 5 corridas.** En realidad sale siempre que
el 74 corre.

- En dos de mis tres corridas anteriores, la sonda que yo había puesto
  dependía de la columna `brand`. Eso le impidió al `downgrade` borrarla: el
  74 falló y las marcas sobrevivieron.
- Tus dos corridas no tenían sonda, y las dos las perdieron.

**Por qué las horas apuntaban a los casos 157 a 162.** Borrar una columna no
toca `updated_at`. Lo que viste a esas horas fue otro caso editando esas
filas, cuando la marca ya se había ido en el 74.

**No era sólo la marca.** Esas nueve bajadas también borran:

- la tabla de documentación de los vendedores;
- las reservas de stock (`products.stock_reservado`, `orders.stock_reserva`);
- el medio de pago de cada orden;
- la condición y la anatomía de las publicaciones;
- los datos del transportista;
- las tablas de Mercado Pago.

Todo lo que corría después del 74 lo hacía sobre una base a medio vaciar.
Ningún dato real se tocó nunca: es la base local de la suite.

## El arreglo

- **El caso 74 trabaja sobre una copia.**
  - Crea `<base>_caso74` con `CREATE DATABASE … TEMPLATE <base>`.
  - Corre ahí Alembic, con el `DATABASE_URL` de la copia, y sus consultas.
  - La borra al terminar. La base de la aplicación no se toca.
  - La plantilla no admite otras conexiones: el caso corta las de la API,
    que se reconecta sola en el pedido siguiente (`pool_pre_ping`), y
    reintenta hasta cinco veces.
- **`scripts/lib/sql.mjs`.** `querySql`, `queryRows` y `queryCount` aceptan
  `{ base }` para hablar con otra base del mismo servidor. Sin eso, siguen
  como antes.
- **El caso 187 ya no depende de la siembra.** Publica su propia publicación
  con marca y la retira al terminar.
- **El caso 74 ya no borra la marca.** Con el arreglo, sobre una base
  recién creada:

  ```
  antes:          Cosechadora John Deere 9750 = john-deere | Tractor Pauny 280A Doble Tracción = pauny
  [PASS] 74 … Todo en una copia de la base
  después del 74: Cosechadora John Deere 9750 = john-deere | Tractor Pauny 280A Doble Tracción = pauny
  bases que quedan: topgreen          (la copia se borró)
  ```

- **El 187 pasa sin las marcas de la siembra.** Les puse `brand = NULL` a mano
  a las dos, sin ninguna publicación activa con marca, y corrí el 187 solo:
  **1/1**. Al terminar no quedó ninguna publicación con marca, porque la suya
  la retira.

**Los centavos en el script de la guía (P3).** `guia-admin.mjs` lee todos
los importes del panel en centavos. «$ 1.646.783,3» son 164678330 centavos,
y la base se compara con `round(x * 100)`. Pasa en el «Volumen vendido» del
paso 2 y en los montos y el precio del detalle de la orden.

Reproducción, sobre la base que dejaron dos suites, con una orden pagada con
30 centavos:

```
script de la base:  [FALLA] Paso 2. Leer el resumen: … «Volumen vendido» dice 16467833 y la suma de las
                    pagadas, enviadas y entregadas es 1646783
script nuevo:       [OK] Paso 2. Leer el resumen (10 frases de resultado)
                    LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio
```

**Un arreglo más del smoke, mío.** En la suite completa, los casos 190 y
191, de la pieza anterior, cayeron con 401 «Token inválido o expirado».
`tokenDeAdmin` guardaba el token del primer caso que lo pedía, y a esa
altura ya había vencido. Ahora prueba el guardado y, si no sirve, vuelve a
ingresar (`43f3b20`).

## Las dos suites

Corrí dos suites sobre `43f3b20`. Antes de cada una recreé la base con
`entorno_nativo.sh --recrear`, porque la suite la pide limpia. Hice la
consulta de marcas antes y después de cada una:

```
suite 1   antes:   Cosechadora John Deere 9750 = john-deere | Tractor Pauny 280A Doble Tracción = pauny
          190/191; sólo falla el 131 (entorno: el puente de docker no traduce `docker run`)
          después: Cosechadora John Deere 9750 = john-deere | Tractor Pauny 280A Doble Tracción = pauny
suite 2   antes:   Cosechadora John Deere 9750 = john-deere | Tractor Pauny 280A Doble Tracción = pauny
          190/191; sólo falla el 131
          después: Cosechadora John Deere 9750 = john-deere | Tractor Pauny 280A Doble Tracción = pauny
```

El 187 pasó en las dos. El 74 y el 190 también.

**La guía, después de la segunda suite.** Quedaron 51 órdenes con centavos
de 124, y un volumen pagado de $ 1.631.891,50:

```
node scripts/guia-admin.mjs   salida 0, 26/26 en escritorio y 26/26 en celular
                              [OK] Paso 2. Leer el resumen (10 frases de resultado), en los dos anchos
```

**Antes, sobre `95180a1`, corrí dos suites seguidas sin recrear la base
entre una y otra.** Así probaba otra lectura de «seguidas».

- En las dos, las marcas quedaron intactas y el 187 pasó.
- La primera dio 188/191: el 131, y el 190 y el 191 por el token vencido
  que corregí después.
- La segunda dio 164/191. Los 27 rojos se encadenan desde el caso 2, que
  registra un correo fijo que ya existía. La suite no está hecha para correr
  dos veces sobre la misma base.

**Puertas sobre el candidato:** tipos, lint, build, `compileall`,
`node --check` y diff-check con `cr-at-eol`, verdes.

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --recrear
psql: select name, brand from products where name in ('Cosechadora John Deere 9750', 'Tractor Pauny 280A Doble Tracción')
  → john-deere y pauny
SMOKE_CASOS=74 node scripts/smoke.mjs
  → [PASS] 74 … Todo en una copia de la base
la misma consulta
  → john-deere y pauny otra vez
```

Para ver la causa, corré el 74 de la base:

```
git show 78ad03d:scripts/smoke.mjs > scripts/.smoke-de-la-base.mjs
SMOKE_CASOS=74 node scripts/.smoke-de-la-base.mjs
```

Las dos marcas quedan en `NULL`. Borrá el archivo después.

**Antes de correrlo:** el caso crea y borra la base `<DB_NAME>_caso74`, así
que el usuario de la base necesita permiso para crear bases. El local lo
tiene (`rolcreatedb`), y en la imagen `postgis/postgis` el usuario de
`POSTGRES_USER` es superusuario. Para copiar, corta una vez las conexiones de
la API a la base, y la API se reconecta sola.

## Riesgos

- **La copia corta las conexiones de la API** una vez, en el medio de la
  suite. En ese momento no corre nada más, y la API se reconecta sola en el
  pedido siguiente. Si en tu entorno el usuario no puede cortar conexiones ni crear
  bases, el caso 74 falla y lo dice; no toca la base compartida.
- **Los casos 55 y 58 hacen `downgrade -1`.** Hoy eso sólo deshace la última
  migración, `b6d3f12a8e94`, cuyo `downgrade` sólo borra un índice, así que
  no pierden datos. Pero tampoco
  miden lo que decían medir cuando se escribieron, porque desde entonces se
  sumaron migraciones. No lo toqué: está fuera del alcance.

No toqué `main`, Railway, `src/`, `backend/` ni datos reales, y no desplegué.
