# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## TEST-HARNESS-MAC-1R — las tres raíces, y la puerta sigue siendo tuya

Hecho lo que puedo hacer. Corrección e informe en commits separados. **No desplegué.**

- Corrección: `33e5200` — «TEST-HARNESS-MAC-1R: las tres raíces del 96/140 en macOS»

**Y te lo pido expresamente, como pediste: corré `npm run smoke` dos veces en
tu Mac, cada vez desde base limpia, y decime qué dio.** Yo no puedo cerrar esa
puerta y no la voy a declarar cerrada.

---

### 1. El doble no escuchaba donde el contenedor llamaba — 33 rojos

Tu diagnóstico es exacto. En `4b1a493` le di a la API un
`host.docker.internal` que llega a la máquina, pero el doble seguía atendiendo
sólo loopback. Medido acá, con las dos configuraciones:

```
ligado a 127.0.0.1 (como estaba):  127.0.0.1  -> HTTP 401
                                   192.0.2.2  -> ECONNREFUSED   ← el contenedor no llega

ligado a todas (como queda ahora):  127.0.0.1  -> HTTP 401  alcanzable
                                    192.0.2.2  -> HTTP 401  alcanzable
```

`192.0.2.2` es la dirección no-loopback de esta máquina: es exactamente el
camino que usa el contenedor. El `401` es la respuesta correcta del doble a un
`POST /oauth/token` vacío; lo que importa es que **conteste**.

La interfaz quedó parametrizada en `MP_DOBLE_INTERFAZ` por si querés fijarla, y
por defecto liga a todas, que es lo único que funciona igual en Docker Desktop
y en Linux. Es un servidor de prueba, con valores inventados, que vive lo que
dura un caso; aun así prefiero que la decisión esté escrita y no implícita.

### 2. La carpeta documental — 10 rojos

`/app/documentos` no es escribible por `appuser`. La configuración local de
Compose le da ahora una carpeta privada y escribible:

```
DOCUMENTOS_DIR   = /data/documentos      (volumen propio, documentos_data)
UPLOAD_DIR       = /data/uploads
nginx monta documentos_data:  no
```

**Hermana de la pública, no adentro.** Lo comprobé contra la propia
aplicación, que es quien decide:

```
UPLOAD_DIR     = /data/uploads
DOCUMENTOS_DIR = /data/documentos
la aplicación acepta la separación: las constancias no caen adentro de lo público
```

Sin `chmod 777`, sin mover nada a la carpeta pública y sin tocar el servicio.
**La escritura y el borrado como `appuser` dentro del contenedor no los pude
comprobar**: no tengo demonio de Docker. Es la primera de tus pruebas focales y
queda para tu Mac.

### 3. La sonda del `sed` era falsa — caso 131

Tenés razón y el error es mío: la sonda probaba con **una** expresión y la
receta real usa **dos**. El `sed` de BSD acepta la primera y falla la segunda,
así que la heurística clasificaba macOS como compatible y el caso se ponía rojo
igual. Una sonda que no reproduce lo que va a pasar no sirve para decidir.

Se fue. La receta corre siempre en `alpine:3`. Es más corto y prueba el entorno
real del Dockerfile.

**Y tiene un costo que quiero que veas antes de aceptarlo:** acá, sin Docker,
el caso 131 ya no puede correr. Mi corrida nativa pasa a **139/140**, con el
131 en rojo por esto:

```
[FAIL] 131 … — la receta fallo con variables validas dentro de alpine:3:
              puente docker: sólo se traduce 'docker exec'
```

Eso no es un defecto: es mi entorno diciendo que no tiene Docker, con el
mensaje correcto. Dos corridas completas desde base limpia dieron lo mismo:
139/140, y **el 131 fue el único rojo en las dos**. Los 33 casos de Mercado
Pago y los 10 de documentación están verdes en las dos, ahora con el doble
ligado a todas las interfaces.

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

Diff:

```
 docker-compose.yml       | 12 ++++++++
 scripts/lib/mp-doble.mjs | 14 +++++++++-
 scripts/smoke.mjs        | 30 ++++++--------------
```

Tres archivos, los tres del alcance que fijaste. Conservé todo `4b1a493`. Sin
producto, sin dependencias, sin migraciones, sin seed, sin Railway, sin datos.
No salteé ningún caso y no abrí TRANSFER-REC-1.

### 5. Tus tres pruebas focales: qué queda de tu lado

| prueba focal | acá | en tu Mac |
|---|---|---|
| contenedor → doble responde | probado contra una interfaz no-loopback | falta el salto real |
| `appuser` crea/lee/borra en la carpeta privada | **no** | falta |
| receta CSP en Alpine, y variables vacías fallan | **no** | falta |

De las tres, la única que pude atacar de verdad es la primera, y sólo hasta el
borde de la máquina.

### 6. Hashes

```
scripts/lib/mp-doble.mjs  686a593502e09c2f
docker-compose.yml        97787b22313212b1
scripts/smoke.mjs         b70f201a9b01514d
```

(SHA-256 truncado a 16, del árbol en el commit de corrección.)

### 7. Riesgos residuales

1. **El doble queda escuchando en todas las interfaces mientras dura un caso.**
   En una máquina de desarrollo compartida eso es visible en la red local. No
   sirve para nada —contesta datos inventados y no toca la base— pero es un
   cambio de exposición y por eso dejé `MP_DOBLE_INTERFAZ` para acotarlo.
2. **El caso 131 ahora exige Docker en cualquier máquina**, incluida la mía.
   Es tu decisión y la comparto; el costo es que mi verde nativo ya no puede
   ser 140/140.
3. **Tres de los arreglos de esta devolución están verificados por
   construcción**, no por verlos pasar en Docker. La misma limitación de la
   entrega anterior.
4. La suite sigue sin poder correrse dos veces sobre la misma base, por el caso
   02. Sin tocar, como quedamos.

### 8. Frenos

No inventé un verde: la puerta 2 sigue abierta y es tuya. No salteé casos, no
convertí fallas en avisos, no bajé controles, no toqué producto y no
desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.
