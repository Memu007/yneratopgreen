# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## TEST-HARNESS-MAC-1S — las dos raíces, y te pido de nuevo las dos corridas

Hecho lo que puedo hacer. Corrección e informe en commits separados. **No desplegué.**

- Corrección: `78972cf` — «TEST-HARNESS-MAC-1S: la URL pública separada de la
  interna, y el destino del volumen»

**Te lo pido otra vez, expresamente: corré `npm run smoke` dos veces en tu Mac,
cada vez desde base limpia, y decime qué dio.**

---

### 1. La URL de autorización la ve el navegador, y yo la pisé

Tenés razón y el error es mío. En `33e5200` pisé **las dos** bases con
`host.docker.internal`, y no son lo mismo:

- `MP_AUTH_BASE_URL` arma la URL que el servidor **le devuelve al navegador**
  (`mp_vinculo.py:224`). El navegador corre en el host, que no resuelve ese
  hostname: `fetch failed` en 62–66.
- `MP_API_BASE_URL` es la base **servidor a servidor** (`mp_vinculo.py:243`,
  `mp_preferencia.py:171`, `mp_pagos.py:65`). Esa sí necesita salir del
  contenedor.

Compose pisa ahora **sólo la segunda**. La primera vuelve a salir de
`backend/.env`, que es donde la escribe `smoke.sh`, en loopback. Verificado
contra el producto, con las dos variables puestas distintas a propósito:

```
MP_AUTH_BASE_URL (la que ve el navegador): http://127.0.0.1:8099
MP_API_BASE_URL  (servidor a servidor)   : http://host.docker.internal:8099

URL de autorizacion armada:
  http://127.0.0.1:8099/authorization?client_id=app-local-de-prueba&…
```

Loopback en la que viaja al navegador, `host.docker.internal` en la que usa la
API. Eso es exactamente lo que pediste.

### 2. El destino del volumen tenía que existir en la imagen

También acertaste con la causa. `backend/Dockerfile` hacía:

```dockerfile
RUN mkdir -p /data/uploads && chown -R appuser:appuser /data
```

Un volumen nuevo se inicializa con lo que la imagen tiene **en su punto de
montaje**. `/data/uploads` existe en la imagen y hereda dueño; `/data/documentos`
no existía, así que Docker lo creaba vacío y de root, y `appuser` —UID 1000— no
podía escribir. De ahí el `PermissionError`, y de ahí que uploads sí funcionara:
la diferencia no era el `chown`, que ya cubría `/data`, sino que el destino
existiera.

```dockerfile
RUN mkdir -p /data/uploads /data/documentos && chown -R appuser:appuser /data
```

Es la solución mínima que pediste: sin `chmod 777`, sin mover nada a la carpeta
pública y sin que nginx lo monte. Sigue **separado** de `/data/uploads`, que se
sirve entero como estático, y la aplicación acepta esa separación —lo verifiqué
en la entrega anterior—.

### 3. Lo que se conserva

El caso 131 sigue corriendo la receta en `alpine:3`, sin heurística. Todo lo
válido de `4b1a493` y `33e5200` queda como está. No toqué el arnés en esta
vuelta: las dos raíces eran de configuración, así que `scripts/` no cambió.

### 4. Puertas

```
node --check scripts/smoke.mjs y scripts/lib/mp-doble.mjs   ok
docker-compose.yml                                          YAML válido
base limpia + node scripts/smoke.mjs                        139/140 (sólo el 131)
base limpia otra vez                                        139/140 (sólo el 131)
npm run build                                               ok
npm run lint                                                ok (--max-warnings 0)
python -m compileall backend/app                            ok
python -m pip check                                         ok
git -c core.whitespace=cr-at-eol diff --check               limpio
npm run a11y -- --todas                                     ok
npm run contraste                                           ok
npm run hito                                                ok
```

El 131 fue el único rojo en las dos corridas, y por lo mismo de siempre: acá no
hay demonio de Docker, así que la receta no puede correr en Alpine. No es un
defecto; es mi entorno diciéndolo con el mensaje correcto.

Diff:

```
 backend/Dockerfile | 10 +++++++++-
 docker-compose.yml |  9 ++++++---
```

Dos archivos, los dos del alcance. Sin producto, sin dependencias, sin
migraciones, sin seed, sin Railway y sin datos. No abrí TRANSFER-REC-1.

### 5. Tus tres pruebas previas a la suite: qué pude y qué no

| prueba | acá | en tu Mac |
|---|---|---|
| URL de autorización resoluble en el host | **sí**: `127.0.0.1:8099`, contra el producto | confirmar en el navegador |
| intercambio del contenedor contra el doble | no: no tengo contenedor | falta |
| crear/leer/borrar como `appuser` en un volumen **nuevo** | no | falta |

La primera la pude atacar de verdad, porque es una propiedad del código y no
del contenedor. Las otras dos no.

### 6. Hashes

```
docker-compose.yml  2efe1a8089a7227e
backend/Dockerfile  5cd84db72aeee547
```

(SHA-256 truncado a 16, del árbol en el commit de corrección.)

### 7. Riesgos residuales

1. **El volumen `documentos_data` que ya tenés creado sigue siendo de root.**
   El arreglo actúa cuando el volumen se **crea**, y Docker sólo lo inicializa
   la primera vez. Tu `npm run smoke` empieza con `docker compose down -v`, que
   lo borra, así que la próxima corrida lo crea de nuevo y ahí toma el dueño
   correcto. Si probás sin ese `down -v`, va a seguir fallando y no va a ser
   este arreglo el que falle.
2. **Hace falta reconstruir la imagen** para que el `mkdir` nuevo exista. El
   lanzador ya hace `docker compose down -v --remove-orphans` y `init_local_db.sh`
   levanta con `--build`, así que debería salir solo; lo digo por si probás a
   mano.
3. **Dos de las tres pruebas focales siguen sin verificar de mi lado**, por lo
   mismo de siempre.
4. Mi verde nativo tiene tope en 139/140 desde que el 131 exige Docker. Es la
   consecuencia aceptada de la vuelta anterior.

### 8. Frenos

No inventé un verde. No salteé casos, no convertí fallas en avisos, no bajé
controles, no toqué producto y no desplegué. `PRE_FIRMA.md` sigue fuera del
versionado y lo confirmé antes de empujar.
