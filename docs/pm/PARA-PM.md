# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SEC-4 — el seed de demostración no corre fuera de un entorno descartable

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `9251701` — «SEC-4: el seed de demostración no corre fuera de un entorno descartable»
- Archivos: `backend/app/seed.py` (el freno), `scripts/smoke.mjs` (la regresión, caso 132), `RAILWAY.md` (la documentación operativa que decía lo contrario).

---

### 1. El rojo, contra `e78e3d5`

Sobre una base de ensayo **aparte** —`topgreen_sec4`, creada, migrada y borrada
para esto—, nunca contra Railway ni contra la base con datos de demostración que
usan las puertas. Le puse dos filas centinela con los mismos identificadores que
el seed usa, para que cualquier lectura o escritura se notara.

```
ENV=production DATABASE_URL=<base de ensayo> python -m app.seed
estado de salida: 0
…
📝 Credenciales de acceso:
  Admin:    <las tres cuentas, con su contraseña, impresas en la consola>
```

Y escribió. Huella de las 22 tablas, antes y después:

| tabla | antes | después |
|---|---|---|
| users | 1 (el centinela) | 4 |
| categories | 1 (el centinela) | 13 |
| localities | 0 | 4028 |
| products | 0 | 30 |
| product_images | 0 | 35 |
| subcategories | 0 | 44 |
| form_options | 0 | 18 |

El centinela de `users` tenía el mismo correo que la cuenta de administración
del seed: no sólo escribió, además **pisó** la fila que ya estaba.

La regresión nueva, corrida contra `e78e3d5`, falla:

```
[FAIL] 132 … — con ENV=production el seed salio con 1 y tiene que salir con 2
```

Sale con 1 porque intentó conectarse a la base que le pasé —un puerto muerto— y
se rompió ahí. O sea: llegó hasta la base.

### 2. El freno, y dónde exactamente está

Lo primero que hace `create_seed_data()`, **antes** de `SessionLocal()`:

```python
def create_seed_data():
    """Crear datos iniciales en la base de datos"""

    # Primero el freno y despues la base: si el entorno no corresponde, esta
    # funcion termina sin haber tocado nada.
    exigir_entorno_con_seed()

    db = SessionLocal()
```

La entrada por línea de comandos lo traduce a algo que entienda un script:

```python
    try:
        create_seed_data()
    except EntornoNoAptoParaSeed as error:
        print(f"\n⛔ {error}", file=sys.stderr)
        raise SystemExit(2)
```

Mensaje a la salida de **error** y estado **2**, no 0: un `... && python -m
app.seed && ...` de un script de despliegue se corta ahí en vez de seguir como
si nada.

### 3. La decisión que quiero que revises: lista de admitidos, no de prohibidos

```python
ENTORNOS_CON_SEED = frozenset({"local"})
```

La lista dice dónde **sí**. Lo pensé al revés primero —«rechazar si
`ENV == "production"`»— y lo descarté cuando vi qué se colaba. Medido, no
supuesto:

| `ENV` | con lista de prohibidos | con lista de admitidos |
|---|---|---|
| `production` | rechaza | **rechaza** (salida 2) |
| `Production` | **pasa** | **rechaza** |
| `PRODUCTION` | **pasa** | **rechaza** |
| `prod` | **pasa** | **rechaza** |
| `produccion` | **pasa** | **rechaza** |
| `staging` | **pasa** | **rechaza** |
| `` (vacío) | **pasa** | **rechaza** |
| `local` / `LOCAL` / `" local "` | pasa | pasa |

Si no consta que el entorno es de desarrollo, se trata como producción.

Los dos únicos valores de `ENV` que el proyecto documenta son `local`
—`backend/.env.example`— y `production` —`backend/.env.production.example` y
`RAILWAY.md`—. No hay un tercero en ningún lado, y las pruebas no fijan `ENV`,
así que heredan `local`. Por eso la lista tiene un solo elemento: no inventé
`dev`, `test` ni `ci`, que nadie usa.

**No agregué ningún `ALLOW_*`.** Se enciende para salir del paso y queda
encendido para siempre. Para sembrar una base descartable se pone `ENV=local`,
que es un acto visible. El caso 132 falla si alguien mete un `ALLOW_`, `FORCE_`,
`SKIP_`, `os.environ` o `getenv` en `seed.py`.

### 4. Cero acceso y cero escritura, probado de dos maneras

**Por la huella.** Puse los centinelas de nuevo, corrí el seed rechazado por las
dos vías, y comparé las 22 tablas:

```
huella IDÉNTICA en las 22 tablas: cero filas leídas o escritas
```

**Por el puerto muerto.** Le pasé `DATABASE_URL` apuntando a
`127.0.0.1:59999/no_existe`. Si el freno hubiera corrido después de abrir la
sesión, habría salido un error de conexión. Salió el rechazo, estado 2, y **cero**
menciones de `connection`, `OperationalError`, `psycopg` o el puerto. Nunca
intentó conectarse.

Las dos invocaciones que pediste:

| | estado | stdout | qué dijo |
|---|---|---|---|
| `python -m app.seed` | **2** | vacío (0 bytes) | el rechazo, por stderr |
| `create_seed_data()` directo | — | — | levanta `EntornoNoAptoParaSeed` |

Y la salida no nombra ninguna de las ocho credenciales demo —los cuatro correos
y las cuatro contraseñas—: lo verifiqué una por una, y el caso 132 lo exige en
cada corrida.

### 5. Local y pruebas, intactas

Base limpia, migraciones y seed con `ENV=local`, dos veces seguidas:

```
primera corrida  -> salida 0, 30 productos
segunda corrida  -> salida 0, 30 productos
huella IDÉNTICA entre corrida 1 y 2: no duplica ni pisa
users 4 · categories 12 · subcategories 44 · products 30 · localities 4028 · form_options 18
```

Cuentas, datos bancarios, publicaciones, taxonomía y el transportista quedan como
estaban. No borré ni renombré ninguna cuenta demo y no roté ninguna credencial.

### 6. Puertas

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          132/132   (0 fallaron)
python -m compileall backend/app                ok
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

La suite subió a 132 con el caso nuevo. No repetí a11y, contraste ni hito: no
cambia ninguna superficie servida, como dijiste.

Diff completo:

```
 RAILWAY.md          |  29 ++++++++++----
 backend/app/seed.py |  56 +++++++++++++++++++++++++-
 scripts/smoke.mjs   | 111 ++++++++++++++++++++++++++++++++++++++++++++++++++++
```

### 7. La documentación decía lo contrario, y la corregí

`RAILWAY.md` mandaba a correr el seed **en producción**: «Para cargar el catálogo
de demostración, una vez y desde la consola del servicio `Backend`:
`python -m app.seed`». Eso ahora es imposible, así que el párrafo dice qué pasa,
por qué, y qué hacer en su lugar.

También corregí, en el mismo archivo, la frase que daba por hecho un
administrador preexistente con contraseña conocida: en producción ese
administrador no existe, y el primero se crea a mano sobre la base ya migrada.

No toqué `README_LOCAL_SETUP.md` ni `docs/DATABASE.md`: ahí el seed se invoca en
contexto local, que sigue funcionando igual.

### 8. Riesgos residuales

1. **Un entorno intermedio queda sin seed.** Si mañana existe un `staging` con
   `ENV=staging`, el seed lo rechaza. Es lo buscado —fallo ruidoso—, pero
   significa que sembrarlo exige poner `ENV=local` a mano y volver a cambiarlo.
   Es deliberado: prefiero un paso incómodo y visible a una variable de escape.
2. **`ENV` no está validado en `Settings`.** Sigue siendo un texto libre y sólo
   se usa para mostrar el entorno en `/api/health` y en el log de arranque. El
   freno del seed es hoy el único que lo mira en serio. Restringirlo a un
   conjunto cerrado en `config.py` sería más prolijo, pero cambia el arranque de
   la aplicación y eso no estaba en el alcance.
3. **`python -m app.seed_localities` sigue corriendo en cualquier entorno.**
   Tiene su propio `__main__` y escribe 4028 filas del padrón oficial. **No trae
   ninguna credencial** —es dato de referencia, no cuentas—, así que lo dejé
   fuera del freno; bloquearlo rompería una carga legítima en producción. Lo
   digo para que sea una decisión tuya y no un olvido mío.
4. **El seed sigue teniendo contraseñas escritas en el repositorio.** No las
   roté porque tu alcance lo prohíbe. Dejan de ser un riesgo de producción, pero
   siguen siendo credenciales conocidas en cualquier base local expuesta a una
   red.

### 9. Hashes

```
backend/app/seed.py   088aa36ef2ba81c0
scripts/smoke.mjs     0394be6cc7415eb9
RAILWAY.md            9d06c652d314f438
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 10. Frenos

El entorno productivo se identifica sin ambigüedad —`ENV=production`, documentado
en dos archivos— y ninguna puerta necesita correr el seed bajo ese valor: la
suite lo corre con `ENV=local`, que es lo que trae `backend/.env`. No hizo falta
tocar variables ni despliegues de Railway, y no lo hice. La reproducción del rojo
fue en una base de ensayo separada que después borré. No desplegué.
`PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de empujar.
