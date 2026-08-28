# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SEC-6 — el ingreso deja de aceptar intentos ilimitados

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `6c24de7` — «SEC-6: el ingreso deja de aceptar intentos ilimitados»
- Archivos: `backend/app/services/limite_de_intentos.py` (nuevo), `backend/app/api/auth.py`, `scripts/smoke.mjs` (caso 134).

Antes del detalle, **una cosa que cambia una premisa de la orden** y que quiero
que veas primero, porque si no la miro el límite por IP no existiría.

---

### 1. `request.client.host` es un dato del cliente, en los dos entornos

Vos escribiste: «localmente existe `request.client.host`». Lo medí antes de
usarlo y no alcanza.

Uvicorn 0.27 trae **`proxy_headers=True` por defecto** —no hace falta ninguna
bandera— y con `forwarded_allow_ips` sin fijar confía en el par local. Resultado,
contra un servidor levantado como lo levanta la suite, sin ninguna bandera de
proxy:

```
sin headers                          -> client.host = 127.0.0.1
con X-Forwarded-For: 203.0.113.99    -> client.host = 203.0.113.99
```

Y `backend/railway-entrypoint.sh` va más lejos: `--forwarded-allow-ips="*"`, o
sea confía en cualquiera. Así que `client.host` **es** el `X-Forwarded-For` del
pedido, tanto en el despliegue como en desarrollo.

Lo comprobé por las malas: mi primera versión usaba `client.host` fuera del
borde, y treinta y un intentos con un `X-Forwarded-For` distinto cada uno
recibieron treinta y un 401. El límite por IP no existía.

**Cómo quedó la identidad**, entonces:

| pedido | fuera del borde (`ENV≠production`) | detrás del borde (`ENV=production`) |
|---|---|---|
| sin headers | `10.0.0.1` (par real) | `identidad-no-confiable` |
| `X-Real-IP: 198.51.100.7` | `10.0.0.1` (se ignora) | **`198.51.100.7`** |
| `X-Real-IP` repetido | `10.0.0.1` | `identidad-no-confiable` |
| `X-Forwarded-For: 203.0.113.99` | `identidad-no-confiable` | `identidad-no-confiable` |

Las dos reglas, dichas en una línea: **detrás del borde manda `X-Real-IP`, que lo
escribe Railway; fuera del borde manda el par real, y sólo si nadie mandó
`X-Forwarded-For`.** Lo que no se puede identificar va todo a una misma bolsa:
contar de más antes que no contar. Un `X-Real-IP` repetido —que es lo que se
vería si alguien intentara inyectarlo— también cae ahí.

No frené por esto porque no hace falta confiar en un header falsificable: hay una
regla por entorno que no depende de ninguno. Pero la premisa era distinta de la
que trae la orden y prefiero que lo sepas por mí.

### 2. El rojo, contra `0a898ae`

```
31 intentos con la contraseña equivocada:
  401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401
  401 401 401 401 401 401 401 401 401 401 401 401 401 401 401
6 intentos contra un correo inexistente:  401 401 401 401 401 401
y después, con la contraseña BUENA:       200
```

Ningún freno, y la cuenta entra igual. La regresión nueva, corrida contra
`0a898ae`, falla:

```
[FAIL] 134 … — el sexto fallo respondio 401 y tenia que ser 429
```

### 3. La política, y qué contesta cada intento

| | umbral | ventana | ¿un acierto lo limpia? |
|---|---|---|---|
| por **correo** normalizado | 5 fallos | 15 min | **sí**, si fue antes del límite |
| por **IP** | 30 fallos | 10 min | **no** |

Medido de punta a punta contra el endpoint real:

```
por cuenta:  401 401 401 401 401 | 429  <- el sexto, exacto
             Retry-After: 899
             {"detail":"Demasiados intentos de ingreso. Espera unos minutos y volve a probar."}

por origen:  401 ×30 | 429              <- el trigésimo primero, exacto
```

El contador por IP **no** se limpia con un acierto a propósito: si se limpiara,
tener una credencial válida propia alcanzaría para reiniciarlo entre tanda y
tanda de un ataque de pulverización contra otras cuentas.

Sólo cuentan los fallos que hoy dan 401 —correo inexistente o contraseña
incorrecta—. Los 403 de cuenta inactiva o sin confirmar no consumen cupo: la
contraseña estuvo bien. Está probado: seis ingresos seguidos con la clave
correcta sobre una cuenta sin confirmar dan seis 403, no un 429.

### 4. El 429 no es un oráculo

Si el cuerpo dijera «esta cuenta está bloqueada», el límite se volvería una forma
de averiguar qué correos existen: bastaría con fallar seis veces contra cada uno
y mirar cuál contesta distinto. Por eso el caso 134 compara las **dos secuencias
completas** —código, cuerpo y presencia de `Retry-After`, seis intentos cada
una— de un correo que existe y uno que no:

```
existe:    idénticas
no existe: idénticas
```

Y exige que el cuerpo no repita el correo ni mencione «cuenta», «usuario»,
«existe» o «contraseña».

Escribir el correo distinto tampoco crea un contador aparte: `MAYÚSCULAS`,
` con espacios `, `MiXtO` y la forma normal comparten uno solo. El sexto, escrito
de la quinta forma distinta, ya recibe 429.

### 5. Antes del límite no se rompe nada; después no se emite nada

| | antes del límite | ya limitado |
|---|---|---|
| credencial correcta | 200, dos tokens, cookies, `last_login` actualizado | **429** |
| tokens emitidos | sí | **ninguno** |
| `last_login` | cambia | **no cambia** |
| contador de la cuenta | se limpia | — |

El «no cambia `last_login`» se mide leyendo la columna antes y después, no
suponiendo. Y que el acierto limpia el contador se prueba al revés: después del
acierto vuelven a caber **cinco** fallos antes del 429; si no se hubiera
limpiado, el segundo ya cortaría.

### 6. Reloj, limpieza y concurrencia

Nada de esto espera quince minutos: el reloj se inyecta.

```
al llegar al límite                -> faltan 900s
un segundo antes del vencimiento   -> faltan 1s
un segundo después                 -> pasa
300 correos distintos              -> 300 claves; vencidas, quedan 0
```

La carrera se prueba con hilos de verdad, que es lo que hay debajo de un endpoint
`def` en Starlette:

```
contador en el límite,  8 pedidos simultáneos -> pasan 0
a un fallo del límite,  8 pedidos simultáneos -> pasa exactamente 1
```

Ese «exactamente 1» es el punto. `reservar` **mira y anota en un solo paso**, con
el candado tomado. Si anotara después de saber el resultado, los ocho leerían el
contador en 4, los ocho pasarían y el umbral se cruzaría por una carrera. Como la
marca se toma antes, el intento que no termina siendo un fallo de credenciales la
devuelve.

El estado queda acotado por tres vías: se podan las ventanas vencidas de la clave
que se toca, hay un barrido general cada 256 reservas, y un tope de 10.000 claves
que descarta la más vieja si el barrido no alcanzó.

### 7. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          134/134   (0 fallaron)
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

No repetí a11y, contraste ni hito: no cambia marcado visual. Registro,
confirmación, reenvío, login pendiente, login inactivo, refresh y logout
conservan sus contratos —los cubren sus casos de siempre, y el 134 vuelve a
tocar los cuatro últimos—.

Diff completo, sin dependencias nuevas:

```
 backend/app/api/auth.py                    |  52 ++++-
 backend/app/services/limite_de_intentos.py | 247 ++++++++++++++++++++++++
 scripts/smoke.mjs                          | 299 +++++++++++++++++++++++++++++
```

### 8. Dos tropiezos míos

**El proceso viejo, otra vez.** Al medir a mano dejé un `uvicorn` vivo que el
script de base limpia no mataba —mataba por PID guardado y por un `pkill` que no
coincidía—, así que la suite midió un proceso con el contador ya lleno y todo
daba 429. Endurecí mi script para que mate cualquier `uvicorn` de esta
aplicación y **falle si queda uno vivo**, en vez de seguir como si nada. Es mi
herramienta, no producto, pero es la segunda vez que me pasa lo mismo y prefiero
contarlo.

**El caso 134 tiene un orden deliberado.** El contador por IP es uno solo para
todo lo que llega de 127.0.0.1, así que un bloque que gasta treinta fallos
dejaría limitado el origen que usan los demás casos. Los bloques que fallan a
propósito suman unos veinte —lejos de treinta— y el bloque que sí agota el límite
por IP va **último y por otra bolsa**: manda `X-Forwarded-For`, que fuera del
borde cae en la bolsa de identidades no confiables. Eso mide el umbral de punta a
punta, prueba de paso que el header inventado no fabrica un contador por intento,
y deja el origen normal intacto.

### 9. Riesgos residuales

1. **El estado vive en memoria de un proceso.** La topología versionada corre
   **un** Uvicorn —`railway-entrypoint.sh`, un solo `exec`—, así que hoy alcanza.
   Dos consecuencias que quiero explícitas: un reinicio del servicio **borra los
   contadores**, y si algún día hay más de una réplica cada una contaría por su
   cuenta, o sea que el límite efectivo se multiplicaría por la cantidad de
   réplicas. No agregué Redis ni nada externo, como pediste. Si el servicio pasa
   a más de una réplica, **esto hay que rehacerlo**, y la opción mínima sería un
   almacén compartido; no la incorporé porque no verifiqué que haga falta.
2. **`X-Real-IP` es una premisa sobre Railway que no pude verificar acá.** El
   diseño confía en que el borde lo **escribe pisando** lo que mande el cliente.
   Si lo agregara sin pisar, un `X-Real-IP` propio podría colarse; por eso, si
   llega repetido, no se usa. Verificarlo lleva un pedido contra el dominio
   público con `X-Real-IP: 1.2.3.4` y mirar si el contador lo toma. **Lo haría
   antes de confiar del todo en el límite por IP**, y es algo que se comprueba
   sólo con el servicio publicado, o sea vos.
3. **Treinta fallos por IP cada diez minutos es poco para una oficina.** Varias
   personas detrás de una misma salida a internet comparten el contador. Es el
   número que pediste y lo respeté; si aparecen quejas de 429 en un cliente
   corporativo, el lugar a mirar es ese, no el límite por cuenta.
4. **La bolsa común puede castigar de más.** En producción, un pedido que llegara
   sin `X-Real-IP` cae en `identidad-no-confiable` junto con todos los demás en
   esa situación. Elegí contar de más antes que no contar; si el borde alguna vez
   dejara de mandar el header, el efecto sería que el login se limita globalmente
   cada treinta fallos. La alternativa —volver a `client.host`— es la que
   justamente no sirve, así que preferí el fallo ruidoso.
5. **No cambié nada de las otras rutas.** Registro, reenvío de correo y refresh
   siguen sin límite. No estaba en el alcance; el reenvío es el que más se
   parece a esto y sería la próxima pieza natural.

### 10. Hashes

```
backend/app/services/limite_de_intentos.py   e7bd28f5766f6c03
backend/app/api/auth.py                      195689c4ca810152
scripts/smoke.mjs                            88ca12c58c1f33bd
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 11. Frenos

La IP real **sí** se puede distinguir sin confiar en un header falsificable, con
una regla por entorno; por eso no frené, aunque la premisa de la orden sobre
`client.host` no se sostenía. No hizo falta infraestructura nueva, ni migración,
ni persistencia: un proceso, memoria, un candado. El límite no cambia la
respuesta de una cuenta existente frente a una inexistente —está medido, las dos
secuencias son idénticas— y no rompe una sesión válida antes del umbral. No
amplié a otras rutas. No desplegué ni toqué la base o los administradores
remotos. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de empujar.
