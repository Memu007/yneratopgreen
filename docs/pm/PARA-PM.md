# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## USER-GUIDE-1: consulta, la guía encontró un defecto

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `ff0d70f` |
| hecho | `134aa86`: caso 205, el modelo con el buscador |
| guía y script | en curso, sin commit |
| no integrado, no desplegado | `main` sigue en `238d113` |

**Resultado hasta acá.**

- **El caso del modelo (punto 5) está hecho.** El 205 da verde, y sacar
  `Product.model` del buscador lo pone en rojo:
  `[FAIL] 205 … buscar «ZX847393» en la API trajo 0 publicaciones y no la del modelo`.
- **Al relevar la compra de punta a punta para escribir la guía, apareció un
  defecto del producto.** Frené, como pide la tarea.

**Para decidir vos (bloqueante sólo para el paso «Calificar» de la guía).**

1. **Corregirlo dentro de USER-GUIDE-1, con caso y negativo.** Lo recomiendo:
   son unas líneas del frontend.
2. **Dejarlo como está,** y que la guía diga «volvé a abrir «Mis Compras»».
   No lo recomiendo: sería documentar un defecto como si fuera un paso.

## El defecto

**En «Mis Compras» y «Mis Ventas», después de cualquier acción sobre una
orden, la tarjeta pierde dos datos hasta que se recarga la página.**

- **El traslado** pasa a decir «Traslado no definido.», aunque la orden
  tiene el suyo guardado. La base dice `shipping_mode = self` y, al
  recargar, la tarjeta vuelve a decir «El comprador coordina el traslado por
  su cuenta.».
- **«Calificar Vendedor» no aparece** después de «Confirmar recepción».
  Recién aparece si se sale de «Mis Compras» y se vuelve a entrar.

Afecta las acciones de las dos pestañas: aprobar o rechazar el comprobante,
«Confirmar Pedido», «Marcar como Enviado» y «Confirmar recepción».

**La causa.** En `UserDashboard.tsx`, las órdenes se arman en dos lugares:

- **al abrir la pestaña** (línea 751), completas, y además se pregunta si se
  puede calificar;
- **al recargar después de una acción** (`reloadOrders`, línea 1302), con una
  copia de ese armado a la que le faltan el traslado y los datos de la
  transferencia, y sin preguntar si se puede calificar.

**Lo que haría.**

- Un solo armado de la orden, usado por los dos caminos.
- Que la recarga también pregunte si se puede calificar.
- Un caso en el smoke: después de «Confirmar recepción», sin recargar, se ve
  «Calificar Vendedor» y el traslado de la orden.
- Un negativo: la recarga sin el traslado da rojo.

No cambia la API ni la base.

## Cómo lo reproduje, para que lo veas

En la pantalla, con una vendedora que tenga alias y una compradora:

1. Comprá por transferencia con «Coordino el traslado por mi cuenta» y enviá
   el comprobante.
2. Como vendedora, en «Mis Ventas», tocá «Aprobar comprobante». La tarjeta
   pasa a «Pagado» y el traslado dice «Traslado no definido.».
3. Recargá la página: vuelve a decir «El comprador coordina el traslado por
   su cuenta.».
4. Seguí con «Confirmar Pedido» y «Marcar como Enviado». Como compradora,
   tocá «Confirmar recepción»: la tarjeta pasa a «Entregado» y no aparece
   «Calificar Vendedor».
5. Salí de «Mis Compras» y volvé a entrar: aparece.

Lo recorrí con dos cuentas nuevas y una publicación propia. El traslado y la
calificación se leyeron antes y después de recargar.

## Cómo va a tratar la guía lo que producción todavía no tiene

Esto no es consulta: es cómo lo voy a escribir, para que no te sorprenda.

- **Registrarse pide confirmar el correo,** y el sitio publicado todavía no
  manda correos (SMTP, PENDIENTE de Emi). La guía describe el paso y dice
  arriba que hoy no se puede completar en el sitio publicado. El programa lo
  comprueba en local con el outbox.
- **Pagar con Mercado Pago todavía no está disponible.** El propio perfil lo
  dice: vincular la cuenta «deja lista tu forma de cobro». La guía describe
  vincular la cuenta como eso, y el pago por Mercado Pago como PENDIENTE.

Mientras tanto no toqué el producto. No toqué `main`, Railway ni datos
reales, y no desplegué.
