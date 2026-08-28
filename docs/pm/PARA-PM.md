# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## SEC-6R — una caída de la base no gasta el cupo de ingresos de nadie

Hecho. Corrección e informe en commits separados. **No desplegué.**

- Corrección: `8b806ca` — «SEC-6R: una caída de la base no gasta el cupo de ingresos de nadie»
- Archivos: `backend/app/api/auth.py` (la corrección), `scripts/smoke.mjs` (caso 135). `limite_de_intentos.py` **no se tocó**.

El rechazo era correcto y el defecto es mío. Peor todavía: es un defecto que
introduje *por* hacer bien la otra mitad. La reserva se toma antes de saber cómo
termina el intento —eso es lo que impide que dos pedidos simultáneos crucen el
umbral por una carrera—, pero la devolución la escribí a mano en cada salida. Y
una salida escrita a mano se olvida: cuando la base se cae en medio de la
consulta, la excepción sube sin pasar por ninguna de esas líneas.

---

### 1. El rojo, contra `6c24de7`

Seis intentos de ingreso con la base caída, a través del flujo real:

```
codigos:              [500, 500, 500, 500, 500, 429]
cuerpo del ultimo:    {"detail":"Demasiados intentos de ingreso. Espera unos minutos..."}
marcas por correo:    5
claves por IP:        1
```

El sexto ya no es el incidente: es el límite. Un corte de base de treinta
segundos le dejaba la cuenta bloqueada quince minutos a alguien que nunca escribió
mal su contraseña, y encima le decía «demasiados intentos», que es falso.

La regresión nueva, corrida contra `6c24de7`, falla exactamente ahí:

```
[FAIL] 135 … — los seis intentos con la base caida dieron [500,500,500,500,500,429]
              y tenian que ser seis 500
```

### 2. La corrección

El cuerpo del login pasa a estar dentro de un `try`, y la devolución al `finally`:

```python
    marcas_consumidas = False
    try:
        ...
        if not user:
            marcas_consumidas = True
            raise HTTPException(401, "Email o contraseña incorrectos")
        ...
    finally:
        if not marcas_consumidas:
            soltar_las_marcas()
```

`marcas_consumidas` se pone en exactamente **dos** lugares: los dos 401 genéricos
de credenciales. Todo lo demás —los dos 403, el acierto y cualquier excepción—
cae en el `finally` y devuelve.

Es al revés de como estaba, y esa inversión es el punto: antes había que
acordarse de soltar en cada salida nueva; ahora hay que acordarse de **retener**,
y retener es lo excepcional. Una salida futura que nadie previó suelta sola.

Lo que **no** cambié, porque tu alcance lo prohíbe y porque no hacía falta: la
reserva sigue siendo atómica y en el mismo orden, cada pedido sigue devolviendo
su propia ficha —`devolver` busca esa ficha y no la última—, y la política,
mensajes, umbrales, ventanas, identidad de origen, poda y tope de claves quedaron
intactos. `limite_de_intentos.py` no tiene una línea distinta.

### 3. El verde, medido

Con la base caída:

| | |
|---|---|
| códigos | `[500, 500, 500, 500, 500, 500]` |
| cuerpos distintos | **1** — `Internal Server Error` |
| marcas por correo | **0** |
| claves por IP | **0** |
| tokens emitidos | ninguno |
| cookies puestas | ninguna |

Y el 500 no cuenta nada: la prueba exige que el cuerpo no contenga
`OperationalError`, `conexion perdida`, `Traceback`, `sqlalchemy`, `SELECT` ni
`app/api/auth.py`.

Con la base sana, en la misma corrida —y esto es la mitad que importa, porque una
corrección que soltara **también** las marcas del 401 apagaría el límite sin que
nadie se entere—:

```
cinco 401 y el sexto 429      -> [401, 401, 401, 401, 401, 429]
marcas tras los cinco 401     -> 5 por correo, 1 clave por IP
cuerpo del 429                -> "Demasiados intentos de ingreso…"  (el mismo)
Retry-After                   -> 900
ingreso correcto              -> 200, y deja 0 marcas
```

### 4. Cómo se provoca la caída sin voltear la suite

No rompo la base de verdad: la prueba corre **dentro del proceso de la
aplicación** y le da al endpoint una sesión que falla como falla una base caída
—se cae en `query`, que es donde se cae—. El endpoint es el real y la pila de
middleware también; lo único simulado es la sesión, y se instala con
`app.dependency_overrides`, que es el mecanismo previsto de FastAPI y se limpia al
salir. El producto no gana ningún interruptor.

### 5. Lo que sigue igual

- **Concurrencia** (tu criterio 4): el caso 134 no cambió y sigue verde — cero
  pedidos atraviesan un contador lleno con ocho simultáneos, y exactamente uno
  cuando queda un lugar. La corrección no toca `reservar`.
- **Sin marcas huérfanas ni cruzadas**: `devolver(clave, ficha)` busca **esa**
  ficha en la cola; si no está, no hace nada. Dos pedidos concurrentes tienen
  fichas distintas y ninguno puede soltar la del otro.
- **Contratos vecinos**: registro, confirmación, reenvío, login pendiente, login
  inactivo, refresh y logout, verdes en la suite completa.

### 6. Puertas, desde base limpia

```
base limpia (drop/create + PostGIS + alembic upgrade head + seed)
node scripts/smoke.mjs                          135/135   (0 fallaron)
python -m compileall backend/app                ok
python -m pip check                             No broken requirements found
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Diff:

```
 backend/app/api/auth.py | 171 ++++++++++++++++++++++++++----------------------
 scripts/smoke.mjs       | 133 +++++++++++++++++++++++++++++++++++++
```

El número de `auth.py` engaña: la mayor parte es el cuerpo del login corriéndose
cuatro espacios para entrar en el `try`. Las líneas con contenido nuevo son
trece: el comentario, `marcas_consumidas = False`, `try:`, dos
`marcas_consumidas = True`, y las tres del `finally`; y se van las tres llamadas
sueltas a `soltar_las_marcas()`.

### 7. Riesgos residuales

1. **El `finally` protege el cuerpo del endpoint, no lo que pasa después.** Si
   Starlette fallara al serializar la respuesta —después de que la función
   retornó—, las marcas ya se habrían devuelto igual, así que ese caso queda del
   lado seguro. No encontré ningún camino en que se retengan sin ser un 401.
2. **Un 500 no deja rastro del intento.** Es lo pedido, pero significa que una
   caída de base es también una ventana en la que nadie cuenta nada: mientras la
   base esté caída no se puede ni verificar una contraseña, así que no hay
   fuerza bruta posible, pero tampoco hay registro. Lo digo para que esté escrito.
3. **Siguen en pie los cinco riesgos de SEC-6**, sin cambios: el estado vive en
   la memoria de un solo proceso y se pierde al reiniciar; `X-Real-IP` descansa
   en que Railway lo pise —ahora con tu fuente oficial, que no reabro—; treinta
   fallos por IP cada diez minutos es poco para una oficina detrás de una sola
   salida; la bolsa común puede castigar de más; y registro, reenvío y refresh
   siguen sin límite.

### 8. Hashes

```
backend/app/api/auth.py   35b50cb726700923
scripts/smoke.mjs         25cbeafe5d97c5c5
```

(SHA-256 truncado a 16, del árbol en el commit de corrección.)

### 9. Frenos

No hizo falta debilitar la reserva atómica: sigue tomándose antes de conocer el
resultado, con el candado, y lo único que cambió es quién la devuelve. El 401 que
sí cuenta se distingue de forma estable porque lo marca la propia línea que lo
levanta, no una inspección posterior de la respuesta. No cambié el contrato
público: el 500 conserva su cuerpo, el 401 su texto y el 429 su cuerpo y su
`Retry-After`. No agregué infraestructura ni desplegué. `PRE_FIRMA.md` sigue
fuera del versionado y lo confirmé antes de empujar.
