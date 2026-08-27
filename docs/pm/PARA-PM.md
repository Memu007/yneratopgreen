# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SEC-3R — el 500 no controlado sale con la misma base defensiva

Hecho. Corrección e informe en commits separados. **No desplegué.**

- Corrección: `e78e3d5` — «SEC-3R: el 500 no controlado sale con la misma base defensiva»
- Archivos: `backend/app/main.py` (la corrección), `scripts/smoke.mjs` (la regresión). Nada más.

Tenías razón y el rechazo era correcto. 200, 401 y 404 traían las cinco
cabeceras; el 500 salía pelado. Lo reproduje antes de tocar nada.

---

### 1. El rojo, contra `625d958`

```
--- 500 no controlado -> 500 ---
    strict-transport-security        FALTA
    x-content-type-options           FALTA
    x-frame-options                  FALTA
    referrer-policy                  FALTA
    permissions-policy               FALTA
    content-type                     text/plain; charset=utf-8
    cuerpo                           'Internal Server Error'
--- 200 /api/health   -> 200 ---   las cinco presentes
--- 401 /api/auth/me  -> 401 ---   las cinco presentes
--- 404 /api/no-existe-> 404 ---   las cinco presentes
```

Y la regresión nueva, corrida contra `625d958`, falla exactamente ahí:

```
[FAIL] 131 … — backend/500: strict-transport-security aparece 0 veces -> []
```

### 2. Por qué pasaba: no fue un olvido, fue el orden de la pila

Medí la pila efectiva de Starlette 1.3.1, no la deduje:

```
ANTES (625d958)                         AHORA (e78e3d5)
  0. ServerErrorMiddleware                0. CabecerasDefensivas
  1. CabecerasDefensivas          →       1. ServerErrorMiddleware
  2. CORSMiddleware                       2. CORSMiddleware
  3. ExceptionMiddleware                  3. ExceptionMiddleware
  4. AsyncExitStackMiddleware             4. AsyncExitStackMiddleware
  5. APIRouter                            5. APIRouter
```

`add_middleware` **no puede** cubrir el 500. Starlette arma la pila con
`ServerErrorMiddleware` siempre en la capa 0, por fuera de todo lo que uno
registre. Cuando la excepción sube, esa capa la atrapa y escribe su propia
respuesta con el `send` **crudo** del servidor: el middleware de uno no ve nunca
ese `http.response.start`. Por eso 200, 401 y 404 salían bien —esos sí pasan por
la capa— y el 500 no.

### 3. La corrección, y por qué esta y no otra

Redefiní `build_middleware_stack` en una subclase de `FastAPI`, que envuelve la
pila ya armada:

```python
class Aplicacion(FastAPI):
    def build_middleware_stack(self):
        return CabecerasDefensivas(super().build_middleware_stack())
```

Tres cosas sobre esa elección, porque tu freno las nombra:

- **No es una API privada de Starlette.** `build_middleware_stack` no lleva guión
  bajo y **la propia FastAPI la redefine** —`fastapi/applications.py:1021`— para
  meter su `AsyncExitStackMiddleware`. Es el punto de extensión previsto.
- **No duplica la política en dos caminos.** Queda **una** capa poniendo las
  cabeceras, para todas las respuestas. La alternativa que descarté era registrar
  un manejador de `Exception`: habría funcionado, pero deja dos caminos distintos
  que pueden divergir, que es justo lo que pedís evitar.
- **No cambia el comando de despliegue.** `app` sigue siendo una instancia de
  FastAPI y `uvicorn app.main:app` sigue sirviendo lo mismo.

Descarté también envolver la app entera (`app = CabecerasDefensivas(app)`): `app`
dejaría de ser FastAPI y rompería todo lo que va debajo en el módulo.

### 4. El 500 sigue sin contar nada

| | antes | ahora |
|---|---|---|
| código | 500 | 500 |
| `Content-Type` | `text/plain; charset=utf-8` | `text/plain; charset=utf-8` |
| cuerpo | `Internal Server Error` | `Internal Server Error` |
| cabeceras defensivas | ninguna | las cinco, una vez cada una |

La regresión no se conforma con «están»: exige que cada una aparezca **una sola
vez** —lee la lista cruda, no el diccionario, que colapsaría un duplicado—, que
el valor sea **idéntico** al de 200, 401 y 404, que la `Permissions-Policy` niegue
las diecisiete capacidades, y que el cuerpo no contenga `RuntimeError`,
`Traceback`, el mensaje de la excepción, `app/main.py` ni el nombre de la ruta.

### 5. Cómo se provoca el 500 sin ensuciar el producto

No hay ni va a haber una ruta que reviente a pedido. La prueba levanta la
aplicación **real**, con su pila real, y le engancha **en memoria** una ruta que
lanza un `RuntimeError`; esa ruta nace y muere adentro del proceso de Python de
la prueba. El producto no gana ningún endpoint de diagnóstico ni interruptor de
fallo, y el nombre de esa ruta sólo aparece dentro del caso 131.

### 6. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          131/131   (0 fallaron)
npm run a11y -- --todas                         sin violaciones bloqueantes, cobertura completa
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
python -m compileall backend/app                ok
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El caso 131 conserva todo lo anterior: 200, 401, 404, `/api/docs`, `/uploads`,
la descarga del PDF con su tipo y su nombre, el preflight CORS con su origen, y
las cuatro rutas del candidato Nginx. No toqué la CSP, ni Nginx, ni CORS, ni un
contrato, ni el frontend.

Diff de producto completo:

```
 backend/app/main.py | 38 +++++++++++++++++++----
 scripts/smoke.mjs   | 87 ++++++++++++++++++++++++++++++++++++++++++++++++++++-
```

### 7. Riesgos residuales

1. **La corrección depende de que `build_middleware_stack` siga existiendo.** Es
   público y FastAPI misma lo usa, así que una desaparición silenciosa es
   improbable; y si cambiara, el caso 131 lo muestra el día de la actualización,
   no en producción.
2. **El 500 sigue sin cabeceras CORS**, igual que antes: `CORSMiddleware` también
   queda por dentro de `ServerErrorMiddleware`. No lo cambié porque tu alcance
   dice no tocar CORS. Consecuencia práctica: un navegador que reciba un 500 en
   una llamada cruzada ve un error de CORS en vez del 500. No filtra nada y no es
   nuevo; si querés cerrarlo, es otra tarea con su propio rojo.
3. **`ServerErrorMiddleware` vuelve a lanzar la excepción** después de responder,
   para que el servidor la registre. Eso no cambió: el traceback sigue yendo al
   log del servidor, nunca al cliente.

### 8. Hashes

```
backend/app/main.py   aa8b64410282cdd7
scripts/smoke.mjs     5e23156645f9f8d8
```

(SHA-256 truncado a 16, del árbol en el commit de corrección.)

### 9. Frenos

No hizo falta cambiar el cuerpo de error público, ni agregar un endpoint de
diagnóstico, ni depender de una API privada, ni duplicar la política. No
desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.
