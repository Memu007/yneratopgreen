# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12.

## 1. Resultado

**Hecho.** El commit es **`70b0d7b`**, sobre `bd87b76`; este informe va aparte y
encima. La suite pasa de 48 a **50 casos**.

No corrí accesibilidad ni contraste: no hay una línea de interfaz en el diff.
Los tres archivos tocados son `dependencies.py`, `auth.py` y la suite.

## 2. La regla

Una sola función decide, y la usan los tres puntos que leen credenciales: la
dependencia de los endpoints protegidos, el refresco y la dependencia opcional.

Cookie y header **dejan de tener orden de preferencia**. Si vienen los dos y no
son el mismo token, la petición no tiene una identidad —tiene dos— y se corta
con 401 **antes de decodificar nada, antes de mirar la base y sin decir cuál de
las dos servía**. No se intenta seguir con la otra.

Lo demás queda como estaba: una sola credencial funciona igual, vaya en la
cookie o en el header; las dos iguales resuelven una vez como esa identidad; y
no toqué tokens, expiraciones, cookies, `localStorage`, roles, CORS ni
criptografía.

**La dependencia opcional no rechaza: queda anónima.** Ahí no estar autenticado
es una respuesta válida, y personalizar sería justo lo que no se puede hacer,
elegir una de las dos. Aviso algo que encontré al implementarla: **hoy no la
usa ningún endpoint**. Está declarada y nada la consume. La corregí igual, para
que el día que se use no traiga el agujero puesto.

## 3. La evidencia

**Caso 49**, acceso, con dos cuentas reales, sobre una lectura (`/auth/me`) y
una escritura (`/cart/sync`):

| Credenciales | Resultado |
|---|---|
| sólo header A | 200, identidad A |
| sólo cookie A | 200, identidad A |
| las dos, mismo token A | 200, identidad A |
| header A + cookie B | **401** |
| header B + cookie A | **401** |

De los dos rechazos se exige, además: mismo motivo en los dos sentidos —si
cambiara, el orden estaría diciendo cuál valía—, que el motivo no nombre
ninguna cuenta ni devuelva parte de ningún token, y que **los dos carritos
queden byte por byte como estaban**. La escritura contradictoria pide guardar
un tercer producto con cantidad 7; después del 401 no aparece en ninguno de los
dos carritos.

**Caso 50**, la misma matriz sobre `/auth/refresh` con refresh tokens. Con una
sola credencial y con las dos iguales emite normalmente; contradictorio da 401,
**no emite tokens** y **la respuesta no trae un solo `Set-Cookie`**.

**La dependencia opcional** se mide donde vive, llamándola con peticiones
armadas a mano, porque no tiene superficie HTTP:

```text
solo_cookie → cliente@ejemplo.com     iguales   → cliente@ejemplo.com
solo_header → null (como antes)       conflicto → null, en los dos órdenes
```

**Rojo forzado**, con los dos archivos del backend devueltos a su estado
anterior y nada más cambiado:

```text
[FAIL] 49 — header A + cookie B: la API respondió HTTP 200 en vez de 401
[FAIL] 50 — header A + cookie B: HTTP 200 en vez de 401
```

## 4. Que lo de siempre siga andando

No lo afirmo por lectura, lo afirma la suite: login por API y por navegador,
refresco automático, logout desde el encabezado y los clientes de una sola
fuente están cubiertos por los 48 casos anteriores, que siguen verdes. Los
casos de navegador son los que más importan acá, porque son los únicos que
mandan cookie **y** header a la vez —los dos iguales, que es el caso normal— y
pasan sin cambios.

## 5. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada desde cero | **50/50** |
| Casos 49 y 50 con el backend anterior | rojos, nombrando la causa |
| `npm run build` (incluye `tsc`) | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |
| Accesibilidad y contraste | no corresponde: cero cambios de interfaz |

Una nota de método, porque prefiero decirla: en la **primera** corrida completa
el caso 42 se cayó con `fetch failed` a los 3 ms —un fallo de conexión del
cliente, no un HTTP de la API, que en ese momento no registró ni un error—.
Recreé la base y volví a correr: **50/50**. Lo cuento porque la cifra que
informo es la de la segunda corrida.

## 6. Riesgo

**Uno, y es el precio de la regla que pediste.** La comparación es entre los dos
tokens, no entre las identidades que llevan adentro. Eso es lo correcto —decidir
mirando adentro de un token que todavía no validé sería empezar a confiar en
él—, pero significa que **dos tokens distintos de la misma persona también dan
401**.

Hoy eso no pasa: login y refresco setean la cookie y el `localStorage` en la
misma respuesta, y el cliente ya deduplica los refrescos simultáneos de una
pestaña. El recorrido que podría producirlo es angosto: dos pestañas refrescando
a la vez, con las respuestas intercaladas de forma que la cookie quede de una y
el `localStorage` de la otra. La siguiente petición daría 401 y el cliente
cerraría sesión. Se recupera volviendo a entrar, no se pierde nada.

Si querés cerrarlo, la salida barata es que el cliente no mande el header cuando
ya va la cookie —una fuente sola por petición—, y eso es del frontend, no de
esta pieza. No lo hice: es cambiar el cliente, y vos acotaste esto al punto
común mínimo del servidor.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

Nota de reproducibilidad, la de siempre: Docker no está disponible en mi entorno
—demonio caído y registry 403—, así que la suite corre nativa con un puente que
traduce sólo las dos invocaciones que la suite hace por `docker exec`.
`./scripts/init_local_db.sh` sigue siendo el camino con contenedores y no lo
cambié.

El entorno local quedó levantado: API en `:8000`, Vite en `:5173`, base recreada
y con seed.
