# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## TEST-HARNESS-MAC-1 — los cinco defectos, y una puerta que no puedo cerrar

Hecho lo que puedo hacer. Arnés e informe en commits separados. **No desplegué.**

- Arnés: `4b1a493` — «TEST-HARNESS-MAC-1: los cinco defectos de portabilidad del arnés»

---

### 0. Empiezo por lo que NO puedo verificar

**Tu puerta 2 pide `npm run smoke` 140/140 dos veces en macOS con Docker
Desktop. No la puedo cumplir y no la voy a declarar cumplida.**

Corro en un contenedor Linux efímero, sin macOS y **sin demonio de Docker**: el
`docker` de mi PATH es un puente que traduce `docker exec` a la base y al venv
nativos, y lo escribí yo. No puedo levantar Compose, no puedo construir
imágenes y no puedo correr `npm run smoke`, que empieza por
`docker compose down -v`.

Así que de los cinco arreglos:

| defecto | reproducido | corregido | verificado el verde |
|---|---|---|---|
| 1. CRLF en el bootstrap | sí, acá | sí | **sí** |
| 2. contenedor → host | no (necesita Docker) | sí | **no** |
| 3. casos 86 y 110 | sí, simulando el entorno del contenedor | sí | **sí** |
| 4. caso 105 | no (necesita Docker) | sí | parcial |
| 5. caso 131 | sí, con un `sed` que se comporta como el de BSD | sí | parcial |

Lo digo antes que nada porque un informe que esconde esto no vale nada. Lo que
sigue es qué medí y con qué.

### 1. CRLF en el bootstrap — reproducido y cerrado

```
DB_NAME extraido: $'topgreen\r'
ERROR: DB_NAME o DB_USER contienen caracteres no permitidos   ← tu rojo, en Linux
```

Es tu mismo error, en mi máquina: no hace falta macOS, alcanza con copiar la
plantilla versionada, que tiene 48 de 50 líneas en CRLF. Un solo punto de
lectura, `valor_de_env`, con `tr -d '\r'`. Después:

```
DB_NAME ahora: topgreen -> pasa el control
```

### 2. El contenedor no alcanzaba al host — corregido a ciegas

`extra_hosts: - "host.docker.internal:host-gateway"` en el servicio
`topgreen-api`, y ahí mismo `MP_AUTH_BASE_URL`/`MP_API_BASE_URL` apuntando a
ese nombre. Es la capacidad nativa de Compose y funciona igual en Docker
Desktop y en Linux, que es lo que pediste.

Las dos URL quedan separadas de verdad: el navegador y las comprobaciones del
host siguen con `127.0.0.1:8099` desde `backend/.env`, y sólo la API ve
`host.docker.internal`. La clave `MP_BASE_DEL_DOBLE` permite pisarlo sin tocar
el archivo.

Verifiqué que el YAML es válido y que las claves quedan donde tienen que estar.
**No verifiqué que el contenedor llegue**, porque no puedo levantarlo.

### 3. Casos 86 y 110 — tu diagnóstico no era el correcto, y lo demuestro

Tu informe dice que el caso agrega una segunda clave y que «la lectura dotenv
conserva la primera». Lo medí y **no es eso**:

- El caso 86 ya reemplazaba la clave: produce **una sola** ocurrencia.
- Cuando hay claves repetidas, acá gana la **última**, no la primera.

La causa real es otra, y explica los dos casos con un solo mecanismo: **en
pydantic-settings el entorno del proceso le gana a `_env_file`**. Adentro del
contenedor, `env_file: ./backend/.env` mete TODA clave de ese archivo como
variable de entorno, y `environment:` agrega `UPLOAD_DIR=/data/uploads`. El
ayudante escribía su plantilla en un archivo temporal… que nunca gobernaba
nada.

Lo reproduje sin Docker, simulando ese entorno:

```
caso 86  (URL de aviso con parametros)     nativo         -> rechazado (el caso pasa)
caso 86  (URL de aviso con parametros)     como en Docker -> CARGA_OK  ← ROJO
caso 110 (constancias adentro de lo publico) nativo       -> rechazado (el caso pasa)
caso 110 (constancias adentro de lo publico) como en Docker -> CARGA_OK ← ROJO
```

El arreglo va en el único punto que gobierna: `cargarConSettings` saca del
entorno las claves que el contenido declara antes de leerlo. Y de paso hace lo
que pediste igual: **rechaza un contenido con la misma clave dos veces**, para
no depender de cuál gana. Con el mismo entorno del contenedor:

```
caso 86                                      -> rechazado
caso 110                                     -> rechazado
plantilla intacta (tiene que CARGAR)         -> CARGA_OK
contenido con clave repetida (tiene que avisar) -> aviso de clave repetida
```

El caso 110 pasa a **reemplazar** `UPLOAD_DIR` y `DOCUMENTOS_DIR` en vez de
agregarlas, que es lo que pediste y ahora además es obligatorio.

### 4. Caso 105 — los archivos se miran donde viven

`existsSync` y `readdirSync` corrían en el host sobre una ruta que
`CARPETA_DOCUMENTOS` lee de la aplicación: bajo Docker, la ruta del contenedor.
Ahora se pregunta donde están, por el mismo puente que ya lee la configuración,
sin exponer rutas internas en ninguna aserción.

Acá pasa igual que antes porque host y contenedor son la misma máquina, así que
**mi verde no prueba el arreglo**: prueba que no rompí nada. El defecto sólo se
manifiesta con Docker.

### 5. Caso 131 — reproducido con un `sed` que se porta como el de BSD

No tengo macOS, así que puse en el PATH un `sed` que hace lo único que importa:
tratar el `-e` que sigue a `-i` como sufijo de respaldo.

```
la receta del Dockerfile, con el sed de esta maquina (GNU)  -> salida=0
la receta del Dockerfile, con un sed tipo BSD              -> salida=1  ← tu rojo
```

El arreglo no reescribe la receta ni saltea el caso: **detecta** si el `sed` de
la máquina se comporta como el de Alpine y, si no, ejecuta el mismo texto en
`alpine:3`.

```
sed GNU -> se comporta como Alpine: se ejecuta directo
sed BSD -> NO se comporta como Alpine: se ejecuta en alpine:3
```

La rama de Alpine no la pude ejecutar. Es la que va a correr en tu máquina.

Nota de alcance: esa rama hace que el caso necesite Docker en macOS. No lo veo
como un costo, porque `npm run smoke` ya empieza con `docker compose down -v`,
pero es un cambio de dependencia y prefiero decirlo.

### 6. El rótulo del lanzador

Decía «Ejecutando 117 smoke tests». Ahora no lleva la cuenta: la da la suite al
terminar, que es quien la sabe.

### 7. Puertas, en Linux nativo

```
node --check scripts/smoke.mjs                  ok
bash -n de los tres guiones tocados             ok
docker-compose.yml                              YAML válido
base limpia + node scripts/smoke.mjs            140/140   (0 fallaron)
base limpia otra vez                            140/140   (0 fallaron)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

**Esas dos corridas no son `npm run smoke`**: son `scripts/smoke.mjs` sobre el
entorno nativo, porque el lanzador oficial necesita Docker. Es exactamente la
distinción que vos marcaste al no declarar 140/140 desde tu reproducción, y la
respeto en la misma dirección.

Diff:

```
 docker-compose.yml       |  11 +++
 scripts/init_local_db.sh |  11 ++-
 scripts/smoke.mjs        | 124 ++++++++++++++++++++++++++++++-----
 scripts/smoke.sh         |   4 +-
```

Sin `backend/`, sin `src/`, sin migraciones, sin seed, sin dependencias, sin
Railway y sin datos. No toqué los casos 116 ni 140. No abrí TRANSFER-REC-1.

### 8. Hashes

```
scripts/smoke.mjs        f9dbb95987545f61
scripts/smoke.sh         a7f99fd260aaec12
scripts/init_local_db.sh 173d688228395d03
docker-compose.yml       afd56cf30ce90c3e
```

(SHA-256 truncado a 16, del árbol en el commit del arnés.)

### 9. Lo que hace falta de tu lado

Para cerrar la puerta 2 alcanza con que corras, en tu máquina, dos veces:

```bash
npm run smoke
```

Si alguno de los cinco vuelve a aparecer, el mensaje ahora dice más que antes:
el 131 informa si corrió con el `sh` del host o con `alpine:3`, y el ayudante
de configuración avisa por nombre si un contenido trae una clave repetida.

### 10. Riesgos residuales

1. **Tres de los cinco arreglos están verificados sólo por construcción.** Los
   escribí mirando el mecanismo, no viéndolos pasar en Docker.
2. **`host.docker.internal` con `host-gateway` necesita Docker Compose v2 y
   Docker Engine 20.10 o posterior.** En Docker Desktop viene; en un Linux con
   Docker viejo, no. Si aparece, se puede pisar con `MP_BASE_DEL_DOBLE`.
3. **El caso 131 pasa a depender de Docker en máquinas con `sed` de BSD.** Ver
   la nota de la sección 5.
4. **La suite sigue sin poder correrse dos veces sobre la misma base**, por el
   caso 02. Ya te lo anoté en TEST-IMG-1 y sigue sin tocar.

### 11. Frenos

No inventé un verde: la puerta 2 queda declarada como no verificada, con el
motivo. No salteé casos por sistema operativo, no convertí fallas en avisos, no
bajé ningún control y no toqué producto. No desplegué. `PRE_FIRMA.md` sigue
fuera del versionado y lo confirmé antes de empujar.
