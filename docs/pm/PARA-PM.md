# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-22. Decimoquinto informe: **el borde de cargas, corregido**.

Leído `df86f5d`. El defecto es real, es tuyo el hallazgo y la causa que
señalaste es exactamente la causa. Corregí sólo eso, más una falla propia que
apareció al correr la suite y que te cuento entera en la sección 5.

## 1. Primero, la corrección que me pediste del informe anterior

**Tenías razón: `3aa6d32` no existe.** El commit de producto publicado es
**`0395d67`**, y el informe anterior era **`510c39f`**.

Por qué pasó, sin excusa: escribí el informe con el hash que me había quedado
del commit local, y **después** rebaseé sobre tu `930a338`, que reescribió los
dos. Publiqué un hash que ya no existía y no volví a mirarlo. El informe se
escribe antes del rebase, así que el hash hay que releerlo después de pushear
y yo no lo hice.

## 2. El defecto

```python
normalizar(None, "Bidones sueltos")  ==  (None, "Bidones sueltos")
normalizar([],   "Bidones sueltos")  ==  (None, None)
```

Dos pedidos que dejan **la misma declaración** —ninguna— guardaban cosas
distintas. La regla no miraba lo que quedaba declarado: miraba **si el pedido
traía o no el campo de las cargas**. Mandando sólo el detalle, el texto quedaba
escrito y después no se mostraba en ningún lado, porque todo lo que lo muestra
pregunta primero por «otra».

Lo confirmé antes de tocar nada, y confirmé también lo otro que dijiste: **la
prueba 113 sigue en verde con el defecto puesto.** Cubría quitar «otra», que es
el camino de la pantalla, y no cubría mandar el detalle solo, que es el camino
de la API.

## 3. La corrección, y la política

Raíz, y sólo la raíz: `app.services.cargas.normalizar`. Elegí **limpiar, no
rechazar**, y la razón es que ya era la política del propio servicio: mandar
`['maquinaria']` con un detalle **ya** lo soltaba en silencio. Rechazar sólo en
el caso nuevo habría dejado la misma incoherencia con otra forma —la misma
acción con dos resultados según qué campos viajaran—, que es justo lo que
devolviste.

La regla quedó en una frase, sin excepciones: **el detalle vive o muere con
«Otra»**, mirando lo que queda declarado y nada más. Vale igual en alta y en
edición porque los dos llamadores le pasan el estado prospectivo, no el parche.

Una consecuencia que quiero dejar dicha porque la decidí yo: sin «otra», el
detalle **ya no se mide**. Antes se comprobaba el largo de un texto que se iba
a descartar, así que un detalle de 121 caracteres sin «otra» frenaba el pedido
por un valor que no iba a quedar guardado. Con «otra» declarada se mide igual
que siempre y el límite de 120 se sigue anunciando.

| Entrada | Antes | Ahora |
|---|---|---|
| `(None, "Bidones")` | **`(None, "Bidones")`** | `(None, None)` |
| `([], "Bidones")` | `(None, None)` | `(None, None)` |
| `(['granos_a_granel'], "Bidones")` | `(['granos_a_granel'], None)` | igual |
| `(['otra'], "Bidones   sueltos")` | `(['otra'], 'Bidones sueltos')` | igual |
| `(['otra'], "   ")` | rechazo, «contá qué transportás» | igual |
| `(['otra'], 121 caracteres)` | rechazo, «no puede superar 120» | igual |
| `(['maquinaria'], 121 caracteres)` | **rechazo** | se descarta sin rechazar |

## 4. La regresión

**Caso 115**, por API y por SQL, sobre los dos caminos:

| Paso | Qué prueba |
|---|---|
| 1 | **alta** con detalle y sin ninguna carga → no se guarda, y en SQL la columna es `NULL` |
| 2 | **edición** sobre un perfil sin nada declarado, mandando sólo el detalle → no se guarda |
| 3 | edición con «maquinaria» declarada, mandando sólo el detalle → no se guarda, y la declaración no cambia |
| 4 | declarar «otra» **con** su detalle → sí se guarda |
| 5 | con «otra» ya declarada, mandar **sólo** el detalle → se actualiza |
| 6 | soltar «otra» → el detalle se va con ella, en API y en SQL |

Los pasos 4 y 5 están para que la corrección no pueda ser «borrar el detalle
siempre»: si alguien la simplifica así, el caso cae.

**Contra `0395d67` cae, y cae por la propiedad:**

```
[PASS] 113 Los tres datos se guardan como se escriben, con límites explícitos
[FAIL] 115 el alta guardó un detalle sin «Otra» declarada: "Bidones sueltos de 200 litros"
```

113 verde y 115 rojo, en la misma corrida: es la demostración de que el caso
nuevo cubre algo que el viejo no tocaba.

## 5. Lo que apareció al correr la suite, y que no era tu devolución

La primera suite completa con la corrección dio **113/115**, y las dos que
fallaron no eran de esta pieza:

```
[FAIL] 111 POST /cart/items respondió HTTP 400: Stock insuficiente. Disponible: 0
[FAIL] 112 POST /cart/items respondió HTTP 400: Stock insuficiente. Disponible: 0
```

**La falla es de una prueba mía, no del producto.** El ayudante que arma el
carrito elegía publicación con `stock > 0`, pero lo que se puede vender es
`stock` **menos lo reservado**, y ordenaba por identificador —que es un UUID
que el seed sortea distinto en cada corrida—. Así que elegía una publicación al
azar y a veces caía en una con todo reservado:

| Consulta | Elegía |
|---|---|
| la de antes | `stock=7 reservado=7` → **disponible 0** |
| la de ahora | `stock=1197 reservado=0` → disponible 1197 |

Lo digo sin adornarlo: **esos dos casos pasaron dos suites completas por
suerte del sorteo, no por estar bien.** Si no salía este sorteo, te entregaba
dos pruebas que no probaban lo que dicen y ninguno de los dos se enteraba hasta
que fallaran solas más adelante. Corregido: se filtra por unidades libres y se
toma la más holgada, así no depende del sorteo.

Es un cambio en `scripts/`, no en producto: no toca migración, campos,
dependencias ni pantallas.

## 6. Evidencia y puertas

| Puerta | Resultado |
|---|---|
| Suite completa desde base limpia | **115/115, 0 fallas** |
| Caso 115 contra `0395d67` | **falla** conservando el valor huérfano |
| Sintaxis Python (`compileall` + importar la app) | limpio |
| `node --check` de la suite | limpio |
| `diff --check` | limpio (ver riesgo 2 del informe anterior: hay que leerlo con `core.whitespace=cr-at-eol`, porque el repo tiene archivos CRLF) |

**No repetí accesibilidad, contraste, hito ni migración**, como indicaste: esta
corrección no toca esas superficies. Su evidencia del informe anterior se
conserva —64/64 pantallas, 52/52 mediciones, 6/6 pasos del hito, ida y vuelta
de `d5b21e8f4c73` y `alembic check` sin diferencias—.

El diff son **tres archivos**: `cargas.py`, `smoke.mjs` y `smoke.sh`.

## 7. Riesgos

1. **Nadie tenía un detalle huérfano guardado.** La base venía de un seed
   limpio y ninguna fila real pasó por el camino roto, así que no hace falta
   una limpieza de datos. Si en algún despliegue existiera una, queda muerta:
   no se muestra en ningún lado. Si querés que la borre, es un `UPDATE` de una
   línea, pero no lo hago sin que lo pidas.
2. **Sigue sin haber un límite superior de largo para un detalle descartado.**
   Es deliberado, está explicado arriba, y el tope de la columna (120) lo
   sostiene igual del lado de la base.
3. **Lo del sorteo de UUID puede estar en otras pruebas.** Encontré y corregí
   la mía. No barrí el resto de la suite buscando el mismo patrón porque me
   dijiste no abrir nada más; queda anotado como algo a mirar cuando toque.

No abrí el hotfix de seguridad ni ninguna otra función. Vuelvo a PM.
