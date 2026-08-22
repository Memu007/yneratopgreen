# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-22. Decimosexto informe: **hotfix de `python-multipart`**.

Commit de dependencia `b496ed4`. Un archivo, tres líneas.

## 1. El aviso que trajo el contraste es real, y es uno de nueve

Confirmé el aviso oficial y me encontré con que el problema es más grande que
el que te informaron. `python-multipart==0.0.6` arrastra **nueve CVE**, no uno:

| Corregida en | CVE | Severidad | Qué es |
|---|---|---|---|
| 0.0.7 | CVE-2024-24762 | alto 7,5 | ReDoS al analizar `Content-Type` ← **el que trajo el contraste** |
| 0.0.18 | CVE-2024-53981 | alto 8,7 | registro excesivo por saltos de línea antes del primer borde |
| 0.0.22 | CVE-2026-24486 | alto 8,6 | recorrido de rutas al escribir archivos |
| 0.0.26 | CVE-2026-40347 | medio 5,3 | preámbulo o epílogo grandes |
| 0.0.27 | CVE-2026-42561 | alto 7,5 | cabeceras de parte sin límite |
| 0.0.30 | CVE-2026-53537 | bajo 3,7 | contrabando de parámetros por RFC 2231/5987 |
| 0.0.30 | CVE-2026-53538 | bajo 3,7 | `;` tratado como separador de campos |
| 0.0.30 | CVE-2026-53539 | alto 7,5 | análisis cuadrático con `;` |
| 0.0.31 | CVE-2026-53540 | bajo 3,7 | `Content-Length` negativo |

Lo que importa de esa tabla: **subir a 0.0.7 —la versión que corrige el aviso
citado— deja ocho abiertos, tres de ellos altos.** Habría cumplido la tarea
como está escrita y dejado el problema puesto.

**0.0.31 es la versión mínima sin ningún aviso abierto**, y por eso es la que
elegí. No fui a 0.0.32, que es la última publicada: no corrige nada más y vos
pediste la mínima.

### De dónde salieron los datos

De la propia lista de vulnerabilidades que PyPI publica por versión, que da el
corte exacto:

```
0.0.6  → 16 registros (9 CVE, contados por GHSA y por PYSEC)
0.0.7  → 14 registros (8 CVE)
0.0.27 →  6 registros (3 CVE)
0.0.30 →  2 registros (1 CVE)
0.0.31 →  0
```

**No pude consultar `api.osv.dev`: el proxy de salida de mi entorno lo rechaza
con 403 por política.** No lo rodeé. Usé PyPI y la base de avisos de GitHub,
que están permitidas y son igual de oficiales, y te lo digo por si en algún
momento querés una herramienta de auditoría automática acá adentro: hoy no
podría salir a esa fuente.

## 2. A cuánto nos alcanzaba de verdad

No te inflo el número. Fui a ver **cómo** usa Starlette la biblioteca:

| Lo que usa Starlette 0.35.1 | Consecuencia |
|---|---|
| `parse_options_header` | el ReDoS de `Content-Type` **sí** nos alcanzaba |
| `MultipartParser` | los agotamientos por partes, preámbulo y cabeceras **sí** |
| `QuerystringParser` | los dos del `;` **sí**, y valen para cualquier formulario, no sólo cargas |
| **no** usa el escritor de archivos de la biblioteca | **CVE-2026-24486 no nos alcanzaba** |

Ese último es alto 8,6 y no aplicaba: depende de `UPLOAD_DIR` y
`UPLOAD_KEEP_FILENAME` de la propia biblioteca, y Starlette escribe los
archivos por su cuenta. Lo corregimos igual porque viene en el mismo salto,
pero no lo cuento como exposición que teníamos.

Y nada del producto importa `multipart` directamente: todo pasa por FastAPI.

## 3. Sin actualización encadenada

| Comprobación | Resultado |
|---|---|
| FastAPI 0.109.0 declara | `python-multipart>=0.0.5`, **sin tope superior** |
| Starlette 0.35.1 importa | el alias `multipart`, que 0.0.31 **sigue publicando** |
| `requires_python` de 0.0.31 | `>=3.10`; el backend corre 3.11 |
| `pip check` | *No broken requirements found* |

Esto lo probé **en un entorno aislado y descartable, antes de tocar el
repositorio**: un venv nuevo con FastAPI 0.109.0 y 0.0.31, y los tres
recorridos multipart en miniatura —un archivo, varios archivos, y archivo con
campos de texto—, más un nombre con acentos y espacios. Los cinco pasaron. Si
hubiera roto algo, te traía la opción y no el cambio.

## 4. Instalación desde cero

Borré el entorno y lo rehice entero desde `requirements.txt`. Versión efectiva:
**0.0.31**, la declarada.

Diferencias contra el entorno anterior, todas, sin filtrar:

| Paquete | Antes | Ahora | Por qué |
|---|---|---|---|
| python-multipart | 0.0.6 | **0.0.31** | este cambio |
| mercadopago | 2.2.1 | **ya no está** | resto del módulo heredado; no está en `requirements.txt` y nadie lo importa |
| requests, urllib3, charset-normalizer | presentes | **ya no están** | eran dependencias del SDK anterior |
| Mako, greenlet, idna, marshmallow, packaging | — | subieron de parche | transitivas sin fijar: una instalación desde cero siempre resuelve a la última |

Las tres de Mercado Pago me llamaron la atención y las verifiqué: **nadie las
importa**, y el comentario de `requirements.txt` ya decía que el SDK se había
sacado. Estaban en el entorno viejo, no en la lista. La instalación desde cero
las dejó afuera sola.

Lo de las transitivas de parche lo digo porque es real: **no las controlo con
este cambio**. Están sin fijar desde antes y cualquier instalación nueva las
mueve. Si querés un entorno reproducible de verdad, eso es fijar el árbol
completo, y es alcance aparte.

## 5. Evidencia

| Recorrido multipart | Casos | Resultado |
|---|---|---|
| Imagen de producto | 9, 10 | pasan |
| Comprobante de transferencia | 16, 18, 19, 100 | pasan |
| Documentación del vendedor | 108 | pasa |

| Puerta | Resultado |
|---|---|
| **Suite completa desde base limpia** | **115/115, 0 fallas** |
| `pip check` | sin incompatibilidades |
| Sintaxis Python (`compileall` de `app` + importar `app.main`) | limpio |
| `diff --check` | limpio |

**No hice ninguna prueba de denegación de servicio** contra Railway ni contra
nada, ni fabriqué una carga costosa para demostrar el aviso, tal como pediste.
Lo que hay es la versión, el aviso oficial y los recorridos funcionando.

El diff es **un archivo**: `backend/requirements.txt`.

## 6. Riesgos

1. **El entorno descartable sigue con 0.0.6 hasta que se despliegue.** El
   cambio está en `requirements.txt`; el Backend de Railway toma la versión
   nueva recién en su próxima instalación. Mientras tanto la exposición sigue
   ahí. No toqué Railway porque está fuera de alcance, pero el hotfix no
   termina de servir hasta ese despliegue.
2. **Las transitivas siguen sin fijar.** Explicado arriba. Hoy dos
   instalaciones en días distintos pueden no dar lo mismo.
3. **No hay auditoría automática de dependencias.** Esto lo encontró un
   contraste externo, no una puerta nuestra. Con `api.osv.dev` bloqueado,
   armarla acá adentro necesita elegir una fuente que el proxy permita. Lo
   dejo anotado, no lo abro.
4. **El resto de la biblioteca de dependencias no la revisé.** Miré
   `python-multipart` porque es lo que pediste. Que ésta tuviera nueve avisos
   acumulados y nadie se enterara hasta el contraste dice algo sobre las otras,
   pero no lo convierto en tarea por mi cuenta.

No toqué localStorage ni CSRF: dijiste que van en una revisión aparte. Vuelvo
a PM.
