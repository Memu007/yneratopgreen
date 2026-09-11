# Reproducción PM — FILTER-INTENT-1 — 2026-09-11

## Resultado

Devuelta como `FILTER-INTENT-1R`.

- Producto/regresión Dev: `0a6cbd4`.
- Informe Dev: `89db3fe`.
- Dev informó 138+139+147+167 en **4/4**.
- Primera suite Dev: **165/167**, rojos 131 y 143.
- Segunda suite Dev: **166/167**, único rojo 131 ambiental; el 143 pasó además
  aislado y Dev explicó su espera intermitente.
- PM revisó el delta y reprodujo el 167 desde otra base Docker limpia en
  **1/1**, salida 0. El smoke incluyó build.
- Log persistente: `/private/tmp/topgreen-pm-filter-intent-167.log`.
- No hubo suite completa PM.

## Conforme en la entrega base

- Una categoría o provincia inexistente se valida después de cargar los
  catálogos, se descarta sin llevarse filtros válidos y deja salir una consulta
  real. El estado visible espera la respuesta correspondiente.
- Un fallo del catálogo auxiliar se diferencia del mercado vacío y ofrece
  reintentar sin descartar un filtro que no pudo validar.
- Los CTA de publicación de Inicio y Servicios usan continuidad: cancelar,
  fallar o registrarse sin sesión no abren el publicador; ingresar correctamente
  lo abre una vez y no ejecuta operaciones comerciales.
- El 167 observa mutaciones para no perder vacíos o avisos transitorios.
- No hay Backend, endpoint, dependencia ni almacenamiento de intención nuevos.

## Motivo de devolución

R6 fue declarado no reproducido, pero el informe documenta su resultado real:
con el carrito abierto y la sesión ya inválida, el contexto conserva
`isAuthenticated=true`, «Continuar compra» abre Checkout y la primera operación
protegida termina en «Sesión expirada» sin ofrecer Login. La ubicación del error
no cambia el recorrido: la persona descubre tarde que no puede continuar y no
tiene la puerta con continuidad ya disponible en el producto.

La corrección debe validar/recuperar la sesión antes de abrir Checkout. Un
refresh válido sigue sin interrupción; una sesión irrecuperable abre Login,
conserva el carrito al cancelar o fallar y abre Checkout una vez después del
ingreso correcto, sin crear órdenes ni mover stock. También incorpora el CTA de
venta de About que Dev identificó con el mismo A9 y pasa a voseo la guarda
defensiva restante de `AddProductModal`.

## Deuda separada

El caso 143 espera el estado de base después del PATCH y lee la tarjeta antes
de que termine el GET que la redibuja. Fue rojo en una suite, verde en la otra y
verde aislado. No se mezcla con esta corrección de producto; queda como
siguiente estabilización corta del arnés.

## Corrección `FILTER-INTENT-1R` revisada

- Producto/regresión Dev: `fbdd88f`.
- Informe Dev: `71976e9`.
- Dev informó 138+139+167 desde base limpia en **3/3**, más lint, TypeScript,
  sintaxis y `diff-check` verdes; no repitió suite completa, como se pidió.
- PM revisó el diff y reprodujo el 167 desde otra base Docker limpia en
  **1/1**, salida 0 y build incluido.
- Log persistente: `/private/tmp/topgreen-pm-filter-intent-167r.log`.
- Un intento previo con `entorno_nativo.sh --recrear` no llegó al smoke porque
  el arnés eligió `sudo -u postgres` en esta Mac; quedó como intento ambiental
  fallido en `/private/tmp/topgreen-pm-filter-intent-167r-entorno.log` y no
  cuenta como prueba.

### Conforme en la corrección

- Un access vencido con refresh válido se renueva y abre Checkout sin pedir
  credenciales.
- Una sesión irrecuperable abre un único Login antes de Checkout; cancelar
  vuelve al carrito, una credencial fallida no avanza y una correcta retoma una
  sola vez.
- El CTA de About comparte la continuidad de Inicio y Servicios y la guarda de
  publicación quedó en voseo.
- El 167 comprueba carrito intacto y ausencia de órdenes, reservas y pagos.

### Motivo de segunda devolución

`asegurarSesion()` convierte cualquier excepción de `/auth/me` en sesión
inválida: limpia tokens y `handleCheckout` abre Login también ante red, timeout
o 5xx. Eso cierra una sesión potencialmente válida por una indisponibilidad
transitoria. A la inversa, cuando la invalidez sí está confirmada, se borran los
tokens pero el contexto React conserva el usuario y la cabecera sigue afirmando
que está conectado.

`FILTER-INTENT-1R2` debe separar vigente/renovada, inválida e indisponible. La
indisponibilidad conserva tokens, usuario y carrito y permite reintentar; la
invalidez abre Login y sincroniza la identidad visible sin borrar el carrito.
Se extiende sólo R6 del caso 167 y no se repite la suite completa.

## Corrección `FILTER-INTENT-1R2` revisada

- Producto/regresión Dev: `a834ec3`.
- Informe Dev: `d21cf78`.
- Dev informó el 167 desde base limpia en **1/1**, más lint, TypeScript,
  sintaxis y `diff-check` verdes.
- PM revisó el diff y reprodujo el 167 desde otra base Docker limpia en
  **1/1**, salida 0 y build incluido.
- Log persistente: `/private/tmp/topgreen-pm-filter-intent-167r2.log`.
- No hubo suite completa PM ni correspondía repetirla.

### Conforme en R2

- Un 503 directo de `/auth/me` conserva carrito, tokens e identidad, informa la
  indisponibilidad y permite reintentar desde el mismo botón.
- Un 503 del refresh conserva también el refresh válido y permite reanudar.
- Una invalidez confirmada baja la identidad visible sin vaciar el carrito; el
  Login conserva cancelación, error y continuidad ya verdes.

### Motivo de tercera devolución

El caso sólo fuerza respuestas HTTP 503. Una caída real de `fetch` rechaza la
promesa con un `TypeError`, que cumple `instanceof Error`; el `catch` actual de
`apiFetch` lo relanza antes de asignarle causa `indisponible`.
`asegurarSesion()` interpreta cualquier error que no tenga esa causa como
`sin-sesion`, limpia credenciales y abre Login. Además, `loadCurrentUser` sigue
limpiando tokens ante cualquier error durante el arranque.

`FILTER-INTENT-1R3` debe envolver el rechazo real como indisponibilidad, tratar
únicamente `sesion-vencida` como invalidez y conservar tokens al arrancar sin
red. Se agrega sólo ese negativo al 167; no se repite suite completa.

## Corrección `FILTER-INTENT-1R3` aceptada

- Producto/regresión Dev: `fa4446a`.
- Informe Dev: `50f63b6`.
- Dev informó el 167 desde base limpia en **1/1**, más lint, TypeScript,
  sintaxis y `diff-check` verdes.
- PM revisó el delta y reprodujo el 167 desde otra base Docker limpia en
  **1/1**, salida 0 y build incluido.
- Log persistente: `/private/tmp/topgreen-pm-filter-intent-167r3.log`.
- No hubo suite completa PM ni correspondía repetirla.

La versión final clasifica como indisponibles el rechazo real de `fetch`, 503,
429 y cualquier error no confirmado; sólo `sesion-vencida` elimina
credenciales. El arranque sin red conserva los tokens y se recupera al volver
la conexión. La sesión realmente inválida baja la identidad sin vaciar el
carrito y mantiene la continuidad hacia Login/Checkout.

`FILTER-INTENT-1R3` queda aceptada en rama Dev. No se integró a `main` ni se
desplegó producto. La siguiente tarea es `TEST-SUITE-167S`, acotada a estabilizar
los casos 139 y 143 antes de continuar con `COPY-CLEAR-1`.
