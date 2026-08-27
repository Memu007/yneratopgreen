# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-27. Vigésimo octavo informe: **SEC-2, el entorno Python sin
vulnerabilidades conocidas**.

Un commit de producto y este informe.

| Commit | Qué trae |
|---|---|
| `ccb868c` | Los pins nuevos, el reemplazo de `python-jose` por PyJWT y el caso 130 |
| este | Este informe: el commit inmediatamente posterior en `main` |

---

## 1. El rojo, reproducido hoy

Entorno Python 3.11.15 recién creado, `backend/requirements.txt` instalado,
`pip-audit 2.10.1`. Lo medí de las dos formas y dan lo mismo:

```
$ pip-audit -r backend/requirements.txt
Found 40 known vulnerabilities in 7 packages
$ pip-audit --no-deps -r <freeze del entorno>
Found 40 known vulnerabilities in 7 packages
```

| Paquete | Versión | Avisos | IDs distintos | Corregido en |
|---|---|---|---|---|
| `pillow` | 10.2.0 | 22 | 15 | 12.3.0 |
| `starlette` | 0.35.1 | 9 | 7 | 1.3.1 |
| `python-jose` | 3.3.0 | 5 | 3 | 3.4.0 |
| `fastapi` | 0.109.0 | 1 | 1 | 0.109.1 |
| `pytest` | 7.4.4 | 1 | 1 | 9.0.3 |
| `python-dotenv` | 1.0.0 | 1 | 1 | 1.2.2 |
| `ecdsa` | 0.19.2 | 1 | 1 | **ninguna** |

Los 40 de la corrida de hoy, no los 40 de la tuya: coinciden en número pero
trabajé contra los IDs de esta corrida, como pediste.

Un detalle de método, por si volvés a medirlo: si instalás `pip-audit` **dentro
del mismo entorno** que auditás, aparece un octavo paquete —`setuptools`— que
no es del proyecto sino de la herramienta y del propio `venv`. Lo aislé en un
entorno aparte para que el número sea del grafo del producto.

## 2. El único hallazgo sin arreglo por versión, y qué hice

**`ecdsa 0.19.2` — PYSEC-2026-1325 / CVE-2024-23342.** Es el ataque de
temporización Minerva sobre la curva P-256. La descripción del propio aviso lo
dice: *«The python-ecdsa project considers side channel attacks out of scope
for the project and there is no planned fix.»* No hay ni va a haber versión
corregida.

`ecdsa` no está en nuestra lista: entra como dependencia de `python-jose`, en
**todas** sus versiones. Lo comprobé instalando `python-jose[cryptography]==3.5.0`
—la última— en un entorno limpio: el paquete queda sin avisos propios, pero
sigue arrastrando `ecdsa==0.19.2` y el auditor sigue devolviendo uno.

**Exposición real en TopGreen: ninguna ejecución.** Firmamos y validamos con
**HS256**, que es HMAC-SHA256 y no toca curva elíptica en ningún punto. `ecdsa`
estaba instalado y nunca se ejecutaba. Es presencia en la cadena de suministro,
no un camino explotable acá.

Pero el criterio que fijaste es `pip-audit` en cero y sin `--ignore-vuln`, y
con `python-jose` eso es inalcanzable por definición. Así que apliqué la
cláusula que dejaste abierta —reemplazar la librería si queda encerrada en la
implementación interna y conserva formato de tokens, algoritmos, expiraciones,
errores y contratos— y pasé a **PyJWT**, que no depende de `ecdsa`.

Antes de hacerlo comprobé que el cambio es de librería y no de contrato.

## 3. La prueba de que nadie pierde la sesión

Con el entorno viejo todavía instalado en paralelo, emití el mismo token con
las dos librerías: mismas reclamaciones, mismo secreto, mismo algoritmo,
vencimiento fijo para que la comparación signifique algo.

```
1) PyJWT lee el token de python-jose:
   {"exp": 1893499200, "sub": "1111…5555", "type": "access"}
2) python-jose lee el token de PyJWT:
   {"exp": 1893499200, "sub": "1111…5555", "type": "access"}
3) los dos tokens son idénticos byte a byte:  SI
5) decode_token() del producto acepta el token de python-jose:
   {'sub': '1111…5555', 'exp': 1893499200, 'type': 'access'}
   token vencido -> None
```

**Byte a byte.** Misma cabecera, misma carga, misma firma. Las sesiones abiertas
en los navegadores siguen siendo válidas después del despliegue, y si algún día
hubiera que volver atrás, los tokens emitidos por PyJWT los lee python-jose.

El código tocado son tres líneas en un solo archivo,
`backend/app/core/security.py`: el `import`, y el `except JWTError` que pasa a
`except PyJWTError`. Las tres llamadas —dos `encode`, un `decode`— tienen la
misma firma en las dos librerías. El extra `[crypto]` queda puesto para no
achicar los algoritmos que `JWT_ALGORITHM` puede pedir.

## 4. El caso 130

El riesgo de este cambio no es que deje de andar —eso lo ve cualquier caso de
login—, es que el token cambie de forma sin que nadie lo note. Así que el caso
nuevo fija el contrato del token **sin usar ninguna librería de JWT**: parte la
cadena a mano, decodifica cabecera y carga, y recalcula la firma con
HMAC-SHA256 crudo. Si mañana se cambia otra vez de librería, esto sigue
diciendo si el token es el mismo token.

Exige, para el de acceso y el de refresco:

- cabecera exactamente `{"alg":"HS256","typ":"JWT"}`;
- `sub` igual a la cuenta que entró, `type` correcto, `exp` entero y a la
  distancia que declara la configuración —15 minutos y 30 días—;
- **y nada más**: las claves son exactamente `exp,sub,type`, así que el token
  no lleva la cuenta adentro;
- la firma verificada recalculando HMAC-SHA256 con el secreto, fuera de PyJWT.

Y que se rechacen con 401: un token con el sujeto cambiado y firmado con otro
secreto, uno que dice `alg=none`, y uno vencido pero bien firmado.

**Prueba en rojo**: le agregué a propósito una reclamación `iss` al token y el
caso falla con «el token de acceso lleva reclamaciones de más: exp,iss,sub,type».
Restauré el archivo; la rotura no está versionada.

## 5. El resto de los pins

| Paquete | Antes | Ahora | Por qué |
|---|---|---|---|
| `fastapi` | 0.109.0 | **0.133.0** | Es la versión más baja que deja de acotar Starlette por debajo de 1.0. Sin eso no se puede llegar a Starlette 1.3.1. |
| `starlette` | 0.35.1 transitiva | **1.3.1 con pin propio** | Primera versión sin avisos abiertos. Entra como pin explícito: la versión la decide la lista, no lo que quede resuelto. |
| `pydantic[email]` | 2.5.3 | **2.7.0** | Es el mínimo que exige FastAPI 0.133. No subí más. |
| `pillow` | 10.2.0 | **12.3.0** | 22 de los 40 avisos. |
| `pytest` | 7.4.4 | **9.0.3** | El aviso pide 9.0.3. |
| `pytest-asyncio` | 0.23.3 | **1.4.0** | 0.23 exige `pytest < 8`: subir uno obliga al otro. |
| `python-dotenv` | 1.0.0 | **1.2.2** | El aviso pide 1.2.2. |
| `python-jose[cryptography]` | 3.3.0 | **fuera** | Explicado arriba. |
| `PyJWT[crypto]` | — | **2.13.0** | Lo reemplaza. |
| `bcrypt` | transitiva | **5.0.0 con pin propio** | Ver abajo. |

**`bcrypt` merecía su propio pin.** `app/core/security.py` lo importa directo
—`import bcrypt`— y hasta ahora entraba de prestado, como transitiva de
`passlib[bcrypt]`. Es decir: la única dependencia que hashea contraseñas no
estaba declarada, y sobrevivía porque otra cosa la arrastraba. La versión
resuelta es la misma que ya había; lo que cambia es que ahora está escrita.

Todo lo demás quedó donde estaba. No subí nada por decoración.

## 6. Una consecuencia del salto, tres líneas

FastAPI 0.133 deprecó `regex=` en favor de `pattern=` y lo avisa en cada
arranque. Son tres usos en `backend/app/api/catalog.py` —`publication_type`,
`sort_by` y `sort_order`—, con el mismo valor de expresión regular. Los cambié:
es consecuencia directa de este salto, no limpieza lateral, y `pattern` ya
existía en la versión anterior, así que el cambio es compatible en las dos
direcciones.

## 7. El verde

```
$ pip check
No broken requirements found.
$ pip-audit -r backend/requirements.txt
No known vulnerabilities found
$ pip-audit --no-deps -r <freeze del entorno nuevo>
No known vulnerabilities found
```

Grafo: 53 paquetes antes, 52 ahora. Salieron `ecdsa`, `pyasn1`, `rsa`, `six` y
`python-jose`; entraron `PyJWT`, `Pygments`, `annotated-doc` y
`typing-inspection`.

| Puerta | Resultado |
|---|---|
| entorno 3.11 nuevo con `requirements.txt` | instala y `pip check` limpio |
| `pip-audit` | **0 vulnerabilidades conocidas** |
| aplicación importa y arranca | sí, 100 rutas |
| `alembic heads` | una sola cabeza, `a91c47e2b6d8` |
| base limpia: migraciones + seed | sin intervención manual |
| `python -m compileall -q backend/app backend/alembic` | limpio |
| `npm run build` | limpio |
| `npm run lint` | 0 errores, 0 advertencias |
| suite oficial completa desde base limpia | **130/130**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

La suite cubre lo que pediste verificar especialmente: login, refresh, logout y
validación de JWT; alta de publicaciones con imágenes por multipart;
documentación en PDF por multipart; y el arranque de FastAPI en cada caso de
navegador.

## 8. Riesgos que quedan

1. **El salto de FastAPI es grande**: 0.109 → 0.133, con Starlette 0.35 → 1.3.1
   y pydantic 2.5 → 2.7. No lo elegí por gusto: era la única forma de cerrar
   los nueve avisos de Starlette. La suite completa lo respalda, pero es el
   cambio con más superficie de esta entrega y conviene mirarlo en el primer
   despliegue.
2. **`ecdsa` sale del grafo, no del mundo.** Si algún día vuelve una librería
   que lo arrastre, el aviso vuelve. Queda dicho para que no sorprenda.
3. **Tres dependencias que nadie usa.** `pillow` no lo importa ningún archivo
   del backend —la validación de imágenes es por extensión y `content_type`—,
   `fastapi-cors` tampoco: el CORS sale de `fastapi.middleware.cors`, que viene
   con FastAPI. Y `passlib` tampoco: `security.py` usa `bcrypt` directo. Las
   tres las dejé pineadas porque tu orden dice que el diff sea sólo pins y no
   una limpieza lateral. Si querés, sacarlas es un commit corto: se van
   `pillow`, `fastapi-cors`, `environs` y `marshmallow` del grafo, y con ellas
   22 avisos futuros de Pillow que hoy estamos obligados a seguir de por vida
   por un paquete que no se importa en ningún lado. **Decidilo vos.**
4. **`pip-audit` es una foto del feed.** Cero hoy no es cero para siempre. Esto
   pide una corrida periódica, no un cierre único.
5. **El `Dockerfile.railway` no cambió** y no hacía falta: instala
   `requirements.txt` tal cual. La imagen `python:3.11-slim` trae su propio
   `setuptools`, que el auditor puede marcar según el día; no es del grafo del
   proyecto y no lo pineé para no meter en la lista algo que no usamos.

## 9. Freno

No frené: el único hallazgo sin arreglo por versión se cerró sin tocar el
modelo de sesión, sin cambiar el formato ni la autoridad del token —lo probé
byte a byte— y sin tocar contratos, datos ni pagos. Si aun así preferís no
mover `python-jose`, el camino alternativo es aceptar `ecdsa` como riesgo
declarado; en ese caso `pip-audit` queda en uno y hay que decirlo por escrito,
no silenciarlo.

La aceptación visual de UX-2D.1 sigue pendiente de Emi. No desplegué.
