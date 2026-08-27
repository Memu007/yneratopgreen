# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-27. Vigésimo noveno informe: **SEC-2.1, se van tres
dependencias que nadie importa**.

Un commit de producto y este informe.

| Commit | Qué trae |
|---|---|
| `c05e0fb` | El retiro de `pillow`, `fastapi-cors` y `passlib` en `backend/requirements.txt` |
| este | Este informe: el commit inmediatamente posterior en `main` |

---

## 1. La prueba de que no hay consumidores

Tres formas independientes, todas reproducibles.

**Búsqueda de texto sobre todo el backend**, incluyendo los tres paquetes y las
dos transitivas que arrastra `fastapi-cors`:

```
$ grep -rniE "\b(pil|pillow|passlib|fastapi_cors|fastapi-cors|environs|marshmallow)\b" \
    backend/ --include=*.py --include=*.ini --include=*.cfg --include=*.toml --include=*.sh
(sin resultados)
```

**Ausencia de import dinámico**, que es lo que podría esconder un consumidor de
una búsqueda de texto:

```
$ grep -rnE "importlib|__import__|\bexec\(|\beval\(|pkgutil|entry_points" \
    backend/app backend/alembic --include=*.py
(sin resultados)
```

**Recorrido del árbol sintáctico** de cada `.py` de `app/` y `alembic/`. Esto
resuelve también los imports perezosos, los que viven adentro de una función y
no arriba del archivo:

```
modulos de primer nivel importados por el producto: 43
sospechosos encontrados: ninguno
los que importa de verdad (terceros): alembic, bcrypt, boto3, botocore,
  cloudinary, cryptography, fastapi, geoalchemy2, httpx, jwt, pydantic,
  pydantic_settings, sqlalchemy, structlog
```

Que ese método sí encuentra imports perezosos lo demuestra su propio resultado:
`boto3`, `botocore` y `cloudinary` aparecen ahí y **no están en la lista de
dependencias**. No es un problema: son los respaldos opcionales de
almacenamiento en `app/services/storage.py`, importados adentro de la función
que los usa y con un `ImportError` que dice qué instalar si alguien enciende
ese camino. Lo menciono porque explica por qué el recorrido devuelve nombres
que no están en `requirements.txt`, y porque confirma que el barrido ve lo que
tiene que ver.

## 2. Qué hace cada uno, y por qué ninguno hace falta

- **`pillow`** estaba bajo el comentario «Validación de imágenes». La
  validación de imágenes que existe es por extensión —`.jpg`, `.jpeg`, `.png`,
  `.webp`— y por `content_type`, en `app/api/products.py`. Ningún archivo abre
  una imagen.
- **`fastapi-cors`** estaba bajo «CORS y middleware». El CORS del producto sale
  de `fastapi.middleware.cors.CORSMiddleware`, en `app/main.py`, que viene con
  FastAPI. El paquete sólo servía para arrastrar `environs`.
- **`passlib`** estaba bajo «Autenticación». El hasheo es `bcrypt` directo en
  `app/core/security.py`: `bcrypt.gensalt()`, `bcrypt.hashpw()`,
  `bcrypt.checkpw()`.

**`bcrypt` se queda**, con su pin propio. Y quiero marcarlo porque es la razón
por la que este retiro es seguro: hasta SEC-2, `bcrypt` entraba de prestado
como transitiva de `passlib[bcrypt]`. Si hubiéramos sacado `passlib` antes de
declararlo, nos habríamos llevado puesto el hasheo de contraseñas sin que
ningún archivo cambiara. El pin que agregué la entrega pasada es lo que
convierte esto en un cambio de una línea y no en un incidente.

## 3. Las transitivas exclusivas

```
$ pip show fastapi-cors | grep Requires   -> environs, fastapi
$ pip show environs     | grep Required-by-> fastapi_cors
$ pip show marshmallow  | grep Required-by-> environs
$ pip show passlib      | grep Required-by-> (nadie)
$ pip show pillow       | grep Required-by-> (nadie)
```

`environs` la pedía sólo `fastapi-cors`; `marshmallow` la pedía sólo
`environs`. Las dos se van con él. `environs` también pedía `python-dotenv`,
que declaramos por nuestra cuenta y se queda.

## 4. El grafo, antes y después

Entorno Python 3.11.15 recién creado en los dos casos.

```
$ pip check
No broken requirements found.

$ diff <(grafo de ccb868c) <(grafo de ahora)
< environs==15.1.0
< fastapi_cors==0.0.6
< marshmallow==4.3.1
< passlib==1.7.4
< pillow==12.3.0
```

Cinco paquetes menos y ni uno más: 52 → **47**. La diferencia es exactamente la
esperada, sin efectos de costado.

```
$ pip-audit -r backend/requirements.txt
No known vulnerabilities found
$ pip-audit --no-deps -r <freeze del entorno>
No known vulnerabilities found
```

Cero por los dos métodos, sin exclusiones, sin `--ignore-vuln` y sin
comentarios de supresión.

## 5. Las rutas, comparadas línea por línea

No alcanza con que la aplicación importe: había que probar que importa **lo
mismo**. Levanté el árbol de rutas con el grafo de `ccb868c` y con el de ahora,
ordenado y con método y nombre de cada una:

```
rutas con el grafo de ccb868c: 100
rutas ahora: 100
$ diff rutas-ccb868c.txt rutas-sec21.txt
IDENTICAS
```

## 6. Puertas

| Puerta | Resultado |
|---|---|
| entorno 3.11 nuevo con `requirements.txt` | instala y `pip check` limpio |
| `pillow`, `fastapi-cors`, `passlib`, `environs`, `marshmallow` | fuera del grafo |
| `bcrypt==5.0.0` | declarado e instalado |
| `pip-audit` | **0 vulnerabilidades conocidas**, sin exclusiones |
| rutas públicas | **100, idénticas a `ccb868c`** |
| `alembic heads` | una sola cabeza, `a91c47e2b6d8` |
| base limpia: migraciones + seed | sin intervención manual, 30 publicaciones |
| `python -m compileall -q backend/app backend/alembic` | limpio |
| `npm run build` | limpio |
| `npm run lint` | 0 errores, 0 advertencias |
| suite oficial completa desde base limpia | **130/130**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

No agregué ningún caso: la suite ya discrimina lo que este retiro podría
romper. El arranque de FastAPI está en cada caso de navegador; las imágenes por
multipart, en el alta de publicaciones; la documentación en PDF, en su propio
recorrido; y la autenticación, en los casos 129 y 130 además de todo el resto.
Si alguno de los tres paquetes hubiera hecho falta, la corrida se caía.

El commit de producto toca **un solo archivo**, `backend/requirements.txt`. Sin
código de aplicación, sin frontend, sin otras versiones, sin caso nuevo.

## 7. Riesgos que quedan

1. **Si alguien agrega validación real de imágenes**, `pillow` vuelve —a una
   versión sin avisos— y con ella sus veintidós avisos abiertos de por vida.
   Vale la pena decidir entonces si se valida con Pillow o con una comprobación
   de cabecera de archivo, que no necesita dependencia.
2. **`boto3` y `cloudinary` siguen sin declarar.** Es deliberado y está bien
   resuelto —import perezoso con un `ImportError` que dice qué instalar—, pero
   significa que los dos respaldos de almacenamiento no funcionan con este
   `requirements.txt` tal cual. Hoy no se usan. No lo toqué porque tu orden
   acota el diff a retirar los tres, pero queda anotado.
3. **La separación entre dependencias de producción y de prueba sigue sin
   hacerse.** `pytest`, `pytest-asyncio` y `httpx` están en la misma lista, y
   los dos primeros no los usa ningún archivo —tampoco hay tests de Python en
   el repositorio—. Dijiste que era una decisión aparte y no la toqué.
4. **`pip-audit` es una foto del feed.** Cero hoy no es cero para siempre.

## 8. Freno

No frené: no apareció ningún import dinámico ni ningún consumidor, y ninguno de
los tres retiros rompió un recorrido. No agregué ninguna biblioteca de
reemplazo, porque no había función que reemplazar.

La aceptación visual de UX-2D.1 sigue pendiente de Emi. No desplegué.
