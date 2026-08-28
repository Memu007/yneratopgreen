# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## OPS-1 — Backend y Frontend dicen de qué commit son

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `c7f480d` — «OPS-1: Backend y Frontend dicen de qué commit son»
- Archivos: `backend/app/core/config.py`, `backend/app/main.py`, `vite.config.ts`, `Dockerfile.railway`, `RAILWAY.md`, `scripts/smoke.mjs` (caso 136).

---

### 1. El rojo, contra `8b806ca`

```
[FAIL] 136 … — el health no publica ninguna revision
```

Y el `dist` construido con ese commit no tiene ninguna etiqueta de revisión. Las
dos puntas eran mudas: `/api/health` devolvía `version: "1.0.0"` —la comercial,
que no se mueve— y el documento del Frontend no decía nada.

### 2. El verde: las tres representaciones, byte por byte

Construí las dos puntas con el mismo SHA sintético de 40 hexadecimales:

```
SHA usado en la prueba   0123456789abcdef0123456789abcdef01234567

artefacto del Frontend   0123456789abcdef0123456789abcdef01234567
GET /api/health          0123456789abcdef0123456789abcdef01234567
log de arranque          0123456789abcdef0123456789abcdef01234567
```

Iguales, sin recortar —el caso exige además que midan 40 caracteres—. La
regresión falla si alguna difiere, y también si el SHA sintético dejara de tener
forma de SHA, para que la prueba no se apruebe sola.

### 3. Dónde va cada una

**Backend.** `Settings` declara `RAILWAY_GIT_COMMIT_SHA` y `REVISION` decide qué
mostrar. `/api/health` suma una clave y sólo una:

```json
{"status":"ok","service":"TopGreen Marketplace API","version":"1.0.0",
 "environment":"local","revision":"sin-revision-local"}
```

El log de arranque la lleva junto a versión y entorno:

```
starting_application  env=local version=1.0.0 revision=…
```

**Frontend.** Un plugin de tres líneas en `vite.config.ts` inyecta la revisión en
la metadata del documento:

```html
<meta name="topgreen:revision" content="0123456789abcdef0123456789abcdef01234567">
```

Elegí metadata y no un archivo estático aparte porque se lee con un `curl` a la
raíz —sin adivinar una ruta— y viaja con el mismo documento que sirve el sitio:
si alguien despliega un `index.html` viejo, la revisión vieja viene pegada a él.
No agrega texto visible, ni consola, ni una superficie de diseño nueva.

La revisión se lee de `process.env` y no de `loadEnv`, porque `loadEnv` sólo trae
las `VITE_*` y ésta no es nuestra, es de la plataforma.

### 4. Sin la variable: se lee como lo que es

```
sin-revision-local
```

Tiene guiones y no es hexadecimal, así que no puede confundirse con un commit ni
aprobarse por error de un vistazo. No es una cadena vacía y no se deriva de la
hora ni de nada que parezca un SHA sin serlo. Desarrollo, la suite y una
construcción local siguen funcionando igual: el `build` no falla por no tener la
variable, y el arranque tampoco.

Y si la variable **sí** viene, se usa tal cual, sin recortar ni normalizar:
acortarla haría que dos artefactos distintos se vieran iguales, que es
exactamente lo que esto tiene que impedir.

### 5. Lo que no se filtró y lo que no se rompió

El health expone **cinco** claves y el caso las compara contra la lista exacta,
así que una sexta —venga de donde venga— lo pone en rojo. Además verifica que el
texto no contenga `JWT_SECRET`, `DATABASE_URL`, `SMTP`, `MP_`, `postgres` ni
`password`.

Conserva estado, servicio, **versión comercial `1.0.0` sin tocar** y entorno; y
sigue saliendo con las cinco cabeceras defensivas de SEC-3, que el caso vuelve a
medir sobre la respuesta real.

### 6. El `ARG` del Dockerfile, que es lo único que me hizo dudar

Tu alcance dice no agregar Docker. Lo hice igual, con una línea, y te explico por
qué: **una construcción con Dockerfile no ve las variables del servicio sola**.
Railway las ofrece como build args, pero Docker exige declarar el `ARG` para
consumirlas. Sin esa línea el Frontend nunca podría llevar el SHA real y la
tarea no se podría cumplir. Lo entendí como «no agregues infraestructura», no
como «no toques el archivo»; si lo leíste al revés, decímelo y lo saco, pero
entonces el Frontend queda sin identidad.

El Backend no necesita nada: recibe la variable en tiempo de ejecución.

### 7. El comando de verificación, después de desplegar

Quedó en `RAILWAY.md`, que es donde alguien lo va a buscar:

```bash
git fetch origin main >/dev/null 2>&1
main=$(git rev-parse origin/main)
backend=$(curl -fsS "https://<backend>/api/health" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["revision"])')
frontend=$(curl -fsS "https://<frontend>/" \
  | grep -o '<meta name="topgreen:revision" content="[^"]*"' \
  | sed 's/.*content="//; s/"$//')
printf 'main      %s\nbackend   %s\nfrontend  %s\n' "$main" "$backend" "$frontend"
[ "$main" = "$backend" ] && [ "$main" = "$frontend" ] \
  && echo "OK: los tres son el mismo commit" \
  || { echo "NO coinciden: hay un servicio atrasado"; exit 1; }
```

**No lo dejé escrito y listo: lo corrí.** Contra los dos candidatos locales
—uvicorn con la variable puesta y el Nginx real sirviendo el `dist` construido
con la misma—, las dos extracciones devolvieron el SHA exacto. Lo único que no
pude ejercitar es el `git rev-parse`, porque para eso hace falta un despliegue de
verdad.

### 8. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          136/136   (0 fallaron)
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

No repetí a11y, contraste ni hito: no cambia la presentación visible. Sin
dependencias nuevas, sin endpoints de diagnóstico, sin leer `.git` en runtime,
sin llamar a GitHub, sin tocar autenticación, datos, migraciones ni despliegue.

```
 Dockerfile.railway         |   8 +++
 RAILWAY.md                 |  25 +++++++++
 backend/app/core/config.py |  27 +++++++++
 backend/app/main.py        |  14 ++++-
 scripts/smoke.mjs          | 133 ++++++++++++++++++++++++++++++++++++++++
 vite.config.ts             |  29 +++++++++-
```

### 9. Riesgos residuales

1. **Nada de esto prueba que Railway entregue la variable.** Es lo que no puedo
   verificar sin desplegar, y es el freno que dejaste anotado. Lo que sí sé: la
   documentación que citaste dice que existe, el Backend la recibe en tiempo de
   ejecución —el camino más simple— y el Frontend depende además de que Railway
   pase las variables del servicio como build args al Dockerfile. **La primera
   vez que despliegues, el comando del punto 7 es la prueba**: si el Frontend
   dice `sin-revision-local`, la variable no llegó al build y hay que
   configurarla explícitamente en el servicio.
2. **Frontend y Backend pueden recibir commits distintos.** Son dos servicios y
   se despliegan por separado; nada en la plataforma los ata. Eso no lo arregla
   esta tarea —no era el encargo—: lo que hace es **volverlo visible en un
   comando** en vez de invisible. Si querés que además no pueda pasar, es otra
   pieza y otra decisión.
3. **Una carga por CLI no queda asociada a ningún commit.** Si alguien corre algo
   a mano en la consola del servicio, la revisión que se publica sigue siendo la
   del despliegue, no la de lo que esa persona hizo. Es honesto —la revisión
   describe el artefacto, no las acciones manuales— pero conviene saberlo antes
   de usarla como coartada.
4. **La etiqueta del documento es pública.** Cualquiera puede ver de qué commit
   es el sitio. Es lo pedido y es lo normal en un repositorio que se entrega al
   cliente, pero queda dicho: un SHA le dice a quien mire qué versión del código
   está publicada.

### 10. Hashes

```
backend/app/core/config.py   f5940e2d2b9b68d7
backend/app/main.py          4c00d2f9b081c8eb
vite.config.ts               eb62875615b288e6
Dockerfile.railway           352786c7cf161894
RAILWAY.md                   8db07ee44c65ef07
scripts/smoke.mjs            0f066e1c7869782d
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 11. Frenos

No inventé ningún SHA ni relajé la comparación: las tres representaciones se
exigen idénticas byte por byte. No hizo falta mostrar la identidad visualmente.
No desplegué ni toqué el entorno remoto. Lo único donde me aparté de la letra de
tu alcance es el `ARG` del Dockerfile, explicado en el punto 6, y la única
afirmación que no puedo respaldar con una medición mía es que Railway entregue la
variable en los dos builds — está en el punto 9 con la forma de comprobarlo.
`PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de empujar.
