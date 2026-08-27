# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SEC-3 — cabeceras defensivas y una CSP construida por medición

Hecho. Producto e informe en commits separados. **No desplegué.**

- Producto: `625d958` — «SEC-3: base defensiva en las dos respuestas públicas y una CSP sin comodines»
- Archivos: `infra/railway/nginx.conf.template`, `Dockerfile.railway`, `backend/app/main.py`, `scripts/smoke.mjs`

Dos cosas antes del detalle, porque cambian lo que pediste:

1. **`'unsafe-inline'` no quedó en la política.** Lo había puesto por los
   veintiocho atributos `style` que escribe React. Lo medí y sobra: React no
   parsea esos estilos como marcado, los asigna por CSSOM (`node.style`), y la
   CSP no gobierna el CSSOM. Levanté los dos candidatos, con y sin el permiso, y
   el `display` calculado es el mismo y no aparece un solo «Refused to apply
   inline style». La política final no tiene ningún `unsafe-*`.
2. **Encontré y arreglé un defecto en la receta que yo mismo había escrito.** Si
   `VITE_API_URL` llegaba vacía, el paso de construcción salía con 0 y dejaba la
   política con un origen en blanco. El `test -n` estaba en el medio de la cadena
   y el estado de salida del `RUN` es el del último comando; el `grep` final no
   se enteraba porque el marcador sí había desaparecido —sustituido por nada—.
   Lo encontró la prueba, no la lectura.

---

### 1. El rojo: qué faltaba y dónde

`infra/railway/nginx.conf.template` —el que sirve Railway, no el Nginx local
heredado— no declaraba **ninguna** cabecera. FastAPI tampoco aplicaba nada
global.

Cuatro rojos, cada uno contra el estado que corresponde:

| # | Contra qué | Qué dijo |
|---|---|---|
| 1 | Backend y Frontend previos | `backend/salud: strict-transport-security vale undefined y tiene que valer "max-age=31536000; includeSubDomains"` |
| 2 | Sólo la plantilla previa (Backend ya arreglado) | `la plantilla declara 0 veces Strict-Transport-Security; tiene que ser una` |
| 3 | Política completa pero con `'unsafe-inline'` de vuelta | `la politica trae 'unsafe-inline', que la orden prohibe` |
| 4 | Receta previa a `set -eu` | `con VITE_API_URL vacia la receta salio con 0: la politica quedaria con un origen en blanco` |

Ninguno de esos estados se versionó: se reprodujeron revirtiendo archivos en el
árbol de trabajo y volviendo atrás.

### 2. Matriz ruta / header, medida sobre los dos candidatos

```
ruta                               cod   HSTS CSP nosniff frame ref perm
--- Frontend (nginx, plantilla real) ---
/ (documento)                      200   sí sí sí sí sí sí
/assets/index-CziRzdou.js (asset)  200   sí sí sí sí sí sí
/health                            200   sí sí sí sí sí sí
/ruta-spa-inexistente              200   sí sí sí sí sí sí
--- Backend (FastAPI) ---
/api/health                        200   sí -- sí sí sí sí
/api/catalog/products (200)        200   sí -- sí sí sí sí
/api/auth/me sin token (401)       401   sí -- sí sí sí sí
/api/no-existe (404)               404   sí -- sí sí sí sí
/api/docs (swagger)                200   sí -- sí sí sí sí
/api/auth/me con token (200)       200   sí -- sí sí sí sí
/uploads (imagen subida)           200   sí -- sí sí sí sí
```

Once rutas, ninguna cabecera duplicada, todas con `always` y todas a nivel
`server`: en Nginx un `add_header` adentro de un `location` **reemplaza** a los
heredados, así que el caso 131 falla si alguien pone uno ahí.

La API no manda CSP y es a propósito: devuelve JSON y archivos, y su única página
HTML —Swagger— trae los recursos de un CDN. Está dicho en el código y afirmado en
la prueba, para que no se «arregle» sin querer.

En el Backend la base va en un middleware ASGI puro registrado **por fuera** de
`CORSMiddleware` y que toca `http.response.start`. Por eso también cubre los 404
del router, Swagger y `/uploads`, que un middleware de FastAPI se pierde.

### 3. La política, permiso por permiso, y la prueba de que cada uno hace falta

```
default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
frame-src 'none'; object-src 'none'; worker-src 'none'; script-src 'self';
style-src 'self'; font-src 'self'; img-src 'self' data: blob: <IMÁGENES>;
media-src 'self'; connect-src 'self' <API>
```

No la escribí y la dejé pasar porque el sitio andaba. Por cada permiso que la
política **abre**, levanté el mismo candidato con **ese** permiso recortado y
comprobé que el navegador rechazara algo real. Un permiso que al sacarlo no rompe
nada es un permiso que sobra:

| permiso | al sacarlo, el navegador dice | quién lo usa |
|---|---|---|
| `script-src 'self'` | `Refused to load the script .../assets/index-*.js` | el bundle |
| `style-src 'self'` | `Refused to load the stylesheet .../assets/index-*.css` | la hoja del build |
| `font-src 'self'` | `Refused to load the font .../fuentes/Inter.woff2` | Inter e Inter Tight |
| `img-src data:` | `Refused to load the image 'data:image/png;base64,…'` | el alta lee la foto con `FileReader.readAsDataURL` |
| `img-src blob:` | `Refused to load the image 'blob:…'` | editar una publicación previsualiza las fotos nuevas con `URL.createObjectURL` |
| `img-src <imágenes>` | `Refused to load the image 'http://…/uploads/products/…png'` | las fotos de las publicaciones |
| `media-src 'self'` | `Refused to load media from '…/video-topgreen.mp4'` | el video de «Quiénes somos» |
| `connect-src <api>` | `Refused to connect to '…/api/catalog/products?…'` | toda la API |

Ocho de ocho. **`'unsafe-inline'` fue el noveno y no pasó la prueba**, así que no
está. Corregí además un comentario mío que era falso: `blob:` no está por las
constancias en PDF —esas se abren con `window.open`, que no pasa por `img-src`—
sino por la vista previa de la edición.

`data:` y `blob:` viven sólo en `img-src`; el caso 131 recorre las directivas una
por una y falla si aparecen en cualquier otra.

### 4. Un navegador de verdad, y la prueba de que el barrido ve algo

66 comprobaciones verdes sobre el candidato Nginx real: cinco páginas públicas,
los cuatro roles con el detalle abierto, login → refresh forzado → logout,
publicación multipart, carrito y checkout, documentación, y la vuelta de OAuth de
Mercado Pago. Cero recursos bloqueados, cero violaciones, cero errores de consola.

Tres cosas que no me dejé pasar:

- **Las cancelaciones no se toleran a ciegas.** Separo bloqueo (`ERR_BLOCKED_*`,
  siempre fallo) de cancelación (`ERR_ABORTED`), y cada cancelación viene con la
  prueba positiva de que el recurso sí funcionó.
- **El video no carga en este Chromium y no es la política.** El servidor
  contesta `206 video/mp4` —el pedido salió—, y lo que falla después es el
  decodificador: el Chromium de Playwright se compila sin H.264,
  `canPlayType('video/mp4; codecs="avc1…"')` devuelve `''` y el elemento termina
  en `MEDIA_ERR_SRC_NOT_SUPPORTED`. La prueba exige eso, no la reproducción.
- **El catálogo local no tenía ninguna foto subida**, así que mi primera versión
  del barrido decía «2 imágenes del origen remoto» contando el SVG de marca del
  propio sitio. Era falso. Sembré una publicación con foto real y ahora la
  comprobación mira el origen de imágenes y exige que decodifique.

Y para que «todo verde» signifique algo, un **control negativo**: el mismo
recorrido contra un candidato con la política recortada a mano detecta las dos
violaciones esperadas. El detector tiene dientes.

### 5. Los orígenes salen del build, y la receta ahora corta

Los orígenes no están escritos a mano: la plantilla lleva `__CSP_ORIGEN_API__` y
`__CSP_ORIGEN_IMAGENES__`, y `Dockerfile.railway` los completa **al construir**,
con las mismas variables con las que se compiló el bundle. No van por `envsubst`
de arranque a propósito: si la política se armara con variables de despliegue,
podría terminar autorizando un origen distinto del que el código quedó
consultando.

Se toma el **origen** —esquema, host y puerto—: la ruta `/api` de `VITE_API_URL`
no forma parte de la política.

El caso 131 no lee esa receta: la **ejecuta**. La extrae del `Dockerfile` por lo
que hace —es el `RUN` que nombra el marcador—, une las continuaciones como las
une Docker, y la corre contra una copia de la plantilla:

```
1. Con orígenes reales        -> salida 0, dos orígenes sustituidos, 0 marcadores
2. La ruta /api no se cuela   -> connect-src 'self' https://api.…example
3. Sin VITE_API_URL           -> salida distinta de 0   (antes salía 0: el defecto)
4. Con un marcador sin sustituir -> salida distinta de 0
5. La plantilla ya sustituida -> nginx -t: configuration file test is successful
```

### 6. Nada cambió salvo las cabeceras

- **Rutas:** 104 rutas con sus métodos, antes y después. `diff` vacío.
- **Cuerpos:** levanté las **dos** versiones de la app a la vez —la anterior en
  `:8001`, la de SEC-3 en `:8000`— y comparé cuerpo, código y `Content-Type` de
  diez rutas con y sin sesión, incluidas `/api/auth/me` 401 y 200, `/api/no-existe`
  404 y `/api/openapi.json`. **10 idénticos, 0 distintos.**
- CORS y preflight intactos: el caso lo afirma sobre el `OPTIONS` real.
- La descarga del PDF conserva `Content-Type: application/pdf`,
  `Content-Disposition` con nombre y los bytes `%PDF`.

### 7. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                     131/131   (0 fallaron)
npm run a11y -- --todas                    sin violaciones bloqueantes, cobertura completa
npm run contraste                          52/52 mediciones, TODO OK
npm run hito                               6/6 pasos
npm run build                              ok
npm run lint                               ok (--max-warnings 0)
python -m compileall backend/app           ok
git -c core.whitespace=cr-at-eol diff --check   limpio
healthcheck frontend  :8081/health         200 text/plain «ok»
healthcheck backend   :8000/api/health     200 {"status":"ok",…}
```

Un aviso sobre las tres primeras corridas de la suite: fallaron 70, 79 y 117 y
**el error era mío**, no del producto. Las había invocado con
`SMOKE_FRONTEND_URL=http://127.0.0.1:5173` mientras la configuración del Backend
dice `localhost:5173`; el caso 117 justamente exige que la página y la API queden
en hosts distintos. Con la invocación correcta pasan. Lo digo porque un verde que
depende de cómo lo llamás no es un verde.

### 8. Lo que no pude hacer, dicho como es

**No construí las dos imágenes.** Este entorno no tiene demonio de Docker —sólo
un puente que traduce `docker exec`—, así que «construcción de ambos contenedores
candidatos» no se cumplió en su forma literal. Lo que sí hice:

- El candidato de Frontend es la **plantilla versionada** pasada por el mismo
  `envsubst` con el mismo filtro que declara el `Dockerfile`, con la misma
  sustitución de orígenes, servida por **Nginx de verdad** con el `dist` real.
- La receta de la etapa Nginx se **ejecuta textualmente**, con sus dos caminos de
  falla (punto 5).
- La plantilla ya sustituida pasa `nginx -t`.
- Los dos healthchecks responden 200.

Es todo lo que se puede medir sin daemon. Si querés la construcción real, se hace
en un entorno con Docker; no la voy a dar por hecha acá.

### 9. Riesgos residuales

1. **La política depende de que las variables del build sean las del despliegue.**
   Si Railway construye con un `VITE_API_URL` y la app termina hablando con otro
   host, la política lo bloquea. Es el comportamiento buscado —falla ruidosa, no
   silenciosa—, pero conviene saberlo antes de publicar.
2. **HSTS sin `preload` y sin `includeSubDomains` en subdominios ajenos.** Un año
   de `max-age`. Si algún subdominio de TopGreen tuviera que servir HTTP plano,
   habría que revisarlo antes; hoy no hay ninguno.
3. **`style-src` sin `'unsafe-inline'` es correcto para React puro.** Si algún día
   entra una biblioteca CSS-in-JS que inyecte `<style>` en tiempo de ejecución, la
   política la bloquea. El caso 131 lo va a mostrar el mismo día, no en producción.
4. **`frame-ancestors 'none'` impide embeber el sitio.** Si comercialmente hiciera
   falta un widget embebible, hay que abrirlo a un origen concreto, no sacarlo.
5. **La API sigue sin CSP.** Es deliberado y está afirmado, pero significa que
   Swagger queda sin política. Es la documentación interna, no una superficie de
   usuario; si te preocupa, la opción mínima es servir Swagger sólo fuera de
   producción, y eso ya es otra tarea.
6. **El video de «Quiénes somos» es H.264 solo.** Los navegadores reales lo
   reproducen; el Chromium de pruebas no. No es un problema hoy, pero no tenés
   cobertura automática de que ese video se ve.

### 10. Hashes

```
Dockerfile.railway                 75f7adaf6f04d42b
infra/railway/nginx.conf.template  c5f0d7ec49ac141f
backend/app/main.py                cb7d10ecbef5bcaa
scripts/smoke.mjs                  6033d2870ea2f4ca
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 11. Frenos que respeté

No hizo falta ningún comodín, ninguna integración externa pidió un origen que no
salga de configuración, y ninguna cabecera rompió OAuth, pagos ni descargas —lo
verifiqué en navegador, no por deducción—. No desplegué. `PRE_FIRMA.md` no está
versionado y lo confirmé antes de empujar. No toqué credenciales de Mercado Pago
ni de SMTP, y el `backend/.env` local volvió a su estado original: los orígenes
`127.0.0.1:8081` y `:8082` que necesité para los candidatos fueron temporales y
ese archivo no se versiona.
