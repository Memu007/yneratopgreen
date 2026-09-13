# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## INTEGRATION-CANDIDATE-1 R2 — las cuatro correcciones

**Resultado: suite completa 168/169 desde base limpia; el único rojo es el 131,
el de Docker Alpine.** `a11y` 64/64 pantallas sin violaciones bloqueantes y
`contraste` 54/54 mediciones con 0 incumplimientos. 114, 167 y 168 pasan en la
corrida completa y también aislados.

- Base: `main` en `3064f10`, ya incorporado a mi rama. Candidata devuelta:
  `fcea099`.
- Commits: contraste `d888969` · arnés `abdf23a` · este informe.
- **En mi rama, no en `main`.** No integré, no desplegué y no toqué Railway,
  datos remotos, secretos ni pagos. No empecé `CAT-PAGE-1`.
- **La suite pasó de 168 a 169 casos.** El 169 es la regresión del punto 1.
- **Acá no hay demonio de Docker**: el puente del repositorio traduce
  `docker exec` y nada más. Todo lo que informo corrió sobre la API nativa. La
  ruta Docker de punta a punta la tenés que correr vos sobre este mismo SHA; lo
  que sí probé de esa ruta está en el punto 1.

Este archivo queda con este informe y nada más, como pediste. LOGO, la cuenta de
prueba y los informes anteriores siguen en Git.

---

### 1. El reinicio anunciaba éxito sin reiniciar nada

Tenías razón, y el mecanismo es peor de lo que parecía. `--reiniciar-api` miraba
procesos **del anfitrión**: con la API en un contenedor no encuentra ninguno, no
mata nada, levanta un uvicorn nativo que no puede tomar el puerto —muere con
`address already in use`— y después pregunta por `/api/health`. Contesta la API
vieja. Sale con 0. `topgreen-api` intacto, `RestartCount=0`, contador entero: lo
que mediste.

Contestar no es haberse reiniciado. Ahora el comando prueba que cambió el
proceso, o falla:

- **con contenedor**: `docker restart topgreen-api`, y después `Pid` y
  `StartedAt` tienen que ser distintos de los de antes;
- **con API nativa**: los PID de los uvicorns tienen que ser otros, y entre
  matar y levantar el puerto tiene que quedarse **mudo** —si sigue contestando
  con todos los uvicorns muertos, lo atiende otro servicio y ese es el que
  guarda el contador—;
- **si no hay ni contenedor ni uvicorn identificable**, no reinicia: frena. Era
  justamente el caso que anunciaba éxito.

La suite ya no anuncia el aislamiento por su cuenta: informa lo que el comando
devolvió, y cuando falla imprime su motivo textual. En esta corrida la línea
dice `uvicorn: [7381] -> [12712]`.

**Caso 169, nuevo.** Le arma al comando esos tres entornos con dobles en el
PATH y exige el rojo; el cuarto escenario es el reinicio real, que tiene que
cambiar de proceso. Los tres negativos son deterministas:

| Escenario | Comando viejo | Comando nuevo |
| --- | --- | --- |
| contenedor que contesta y no se reinicia | sale con 0 | rojo: «misma identidad» |
| API que el comando no ve (tu forma exacta) | sale con 0 | rojo: «no se identifica» |
| el puerto lo atiende otro | sale con 0 | rojo: «sigue contestando» |

Con el comando anterior el 169 da rojo con tu síntoma: «salió con 0 y anunció
éxito». No subí ningún TTL, no toqué el límite y no hay ninguna puerta de prueba
en el producto: el reinicio es lo mismo que le pasa a la API en cada despliegue.
Los escenarios tampoco tocan la API de verdad —el que mata algo mata un proceso
descartable que el propio caso creó— y el caso lo comprueba antes de seguir.

**Lo que no corrí acá:** `docker restart` contra un demonio de Docker de verdad.
El doble prueba que una identidad que no cambia da rojo; que el reinicio real
del contenedor cambie `Pid` y `StartedAt` lo va a demostrar tu corrida, no la
mía.

### 2. El 168 esperaba una respuesta y aceptaba otra

`r.url().includes('/notifications')` también dice que sí a
`/notifications/unread-count`, y ese contador sale **en cada cambio de solapa**
—el panel lo pide cuando la solapa no es la de notificaciones—. Según cuál
llegara primero, la espera se resolvía con un objeto sin `notifications`: tu
«recibió una respuesta sin notifications».

Ahora se compara la ruta exacta y los parámetros —«Mis Compras» y «Mis Ventas»
se distinguen sólo por `as_role`, así que tenían el mismo problema—, y el caso
**fabrica la carrera** en vez de esperar a que aparezca: retiene el contador
hasta que la lista ya está pedida y demora la lista 1,5 s, así la respuesta del
contador cae siempre en medio de la espera.

Negativo medido: con la espera vieja y esa carrera, el 168 falla **todas las
veces** con «la espera se resolvió con .../api/notifications/unread-count». El
negativo anterior sigue puesto: la bandeja se fabrica vacía en la base
descartable y la pantalla se contrasta contra el cuerpo que devolvió la API.

### 3. El 114: dos defectos del arnés, ninguno del producto

**a. El rojo que repetiste.** El perfil guarda claves —`maquinaria`— y los
rótulos los trae aparte `GET /logistics/cargo-types`. Hasta que esa respuesta
llega, la línea dibuja la clave cruda. Medido, demorando el catálogo:

```
sin demora     «Maquinaria agrícola · Otra: Bidones de 200 litros»
demora 2000ms  «maquinaria · Otra: Bidones de 200 litros»   → y al llegar, resuelto
```

El caso leía el panel apenas aparecía «Mi Perfil», así que en una máquina
cargada acusaba al producto de no mostrar las cargas. Es lectura antes de que el
dato asiente, no un defecto del producto: el rótulo llega solo. Ahora el caso
**demora ese catálogo a propósito**, para que la carrera pase siempre, y espera
el rótulo resuelto; si vuelve el rojo, dice qué dice la línea de cargas.

**b. Por qué no se reproducía aislado.** El caso le inyecta al navegador
`state.buyerToken`, que dejan casos anteriores. Corriéndolo solo viajaba la
cadena `undefined`, la pantalla trataba al visitante como anónimo y la tarjeta
ofrecía «Ingresar para continuar»; el caso moría esperando «Agregar al carrito»
con un `Timeout` pelado. Medido: con token válido la tarjeta dice «Agregar al
carrito»; sin él, «Ingresar para continuar». Ahora pide la sesión en vez de
heredarla, y `accionDeLaTarjeta` dice qué botones ofrece la tarjeta en vez de
vencerse en silencio.

Con las dos correcciones, **114 pasa aislado** desde base limpia y en la corrida
completa.

### 4. El selector de estrellas, y la puerta que no lo veía

`.elegida` usaba el cereal claro, que `tokens.css` reserva para formas. Una
estrella llena es un glifo: va el cereal profundo. Medido sobre la capa de
calificación: **#c49a43 sobre #ffffff = 2,61:1 → #8a671c = 5,20:1**.

Extender la puerta era necesario **y no alcanzaba**. La hice visitar la pantalla
—fabrica una orden recibida por las rutas reales y abre el selector, que abre en
5 estrellas elegidas— y con el token viejo **seguía dando verde**. Causa: cada
estrella es un radio nativo con `opacity: 0` **encima** de su glifo, y ese radio
tiene el fondo blanco de la hoja del navegador, así que el medidor lo daba por
«texto tapado». Lo invisible no tapa: ahora un elemento con `opacity: 0` o
`visibility: hidden` no cuenta como tapando.

Con el medidor corregido y el token viejo la puerta da rojo con la pareja
exacta: `2.61:1 (mín 3) span — #c49a43 sobre #ffffff — 34px — "★"`. Con el token
nuevo, 0 incumplimientos. Destapar no escondió otro problema: los textos medidos
pasaron de 11 510 a 12 367 y siguen todos por encima del mínimo.

### 5. El canal

Reemplacé el cuerpo entero. Queda el encabezado y este informe.

---

### Compuertas

| Puerta | Resultado |
| --- | --- |
| Suite completa desde base limpia | **168/169**; sólo el 131 |
| `npm run a11y -- --todas` | 64/64 pantallas, 0 bloqueantes |
| `npm run contraste` | 54/54 mediciones, 0 incumplimientos |
| `npm run lint` · `npx tsc --noEmit` · `node --check` · `diff-check` | verdes |

**El 131**, reproducido: `la receta falló con variables válidas dentro de
alpine:3: puente docker: sólo se traduce 'docker exec'`. Es la limitación de
entorno de siempre —acá no hay demonio de Docker— y no cambia con esta entrega.
En tu ruta Docker debería pasar.

Log de la suite: `logs/suite-integration-candidate-1-r2-abdf23a.log`. `logs/`
está fuera de Git; si lo querés en el repositorio, decímelo.

### Lo que queda dicho

- La FAQ de Contacto dice «Aceptamos transferencias bancarias directas al
  vendedor» y el producto también cobra por Mercado Pago. Sigue sin tocar.
- Sigue esperando tu palabra lo del carrito sin sesión.
- `a11y` no mira el selector de estrellas: axe nunca marcó esa pareja. Que las
  dos puertas recorran la misma lista de pantallas es una tarea aparte; te la
  propongo, no la hago por mi cuenta.
