# Guión de la demostración — 30 de julio de 2026

Reunión de firma. El cliente viene de que le cobraron mucho por muy poco,
así que **mostrar producto funcionando es el argumento más fuerte que hay**.

Elegir qué mostrar es criterio profesional, no ocultamiento: se muestra el
recorrido terminado y no lo que está a medio hacer.

---

## Antes de entrar a la reunión

1. **Correr `npm run smoke`.** Doce casos, arranque limpio. Si da verde,
   nada te va a sorprender en vivo. Si da rojo, no entres a demostrar
   hasta resolverlo.
2. **Dejar la aplicación ya levantada**, con sesión iniciada en una
   pestaña y otra en blanco. Nada de levantar Docker delante del cliente.
3. **Tener el catálogo abierto** en la pantalla inicial del recorrido.
4. **Ensayarlo una vez completo, cronometrado.** Diez minutos alcanzan.

Datos de acceso:

| Perfil | Correo | Clave |
|--------|--------|-------|
| Comprador | `cliente@ejemplo.com` | `cliente123` |
| Vendedor | `vendedor@ejemplo.com` | `vendedor123` |
| Administración | `admin@topgreen.com` | `admin123` |

---

## El recorrido, en orden

### 1. El catálogo (2 min)

Abrí el marketplace. **28 publicaciones, doce categorías, nueve
provincias**, con la taxonomía que mandó ella: sus 7 categorías y 43
subcategorías, más Bienes y Ganado, más los servicios.

> "Esto ya no son las categorías que inventamos nosotros: es la
> clasificación que usted nos mandó, cargada tal cual, con sus 43
> subcategorías."

Es el mejor momento de toda la demostración para construir confianza,
porque le devolvés su propio trabajo hecho realidad en tres días.

### 1b. Tierras y parcelas — abrilo vos, antes que ella (1 min)

**Abrí la categoría y mostrá el campo de 120 hectáreas con el botón de
agregar al carrito.** Después decí:

> "Fíjese en esto: un campo de 950 millones con un botón de 'agregar al
> carrito'. No tiene sentido, y por eso se lo traigo yo antes de que lo
> encuentre usted. Un campo no se compra en línea: se consulta, se visita
> y se negocia. Necesita superficie, régimen de tenencia, mejoras y
> documentación. Es un producto distinto dentro de la misma plataforma."

**Por qué conviene mostrarlo en vez de esconderlo.** Si lo tapás y ella lo
descubre después, parece que se lo ocultaste. Si lo mostrás vos, tres
cosas quedan claras de una: que cargaste su taxonomía completa, que
entendés su negocio mejor que el documento, y que hay un desarrollo
adicional que **no está incluido** en lo firmado.

Es la misma jugada que el `Jhon Deere` mal escrito. Señalar el problema
antes que el cliente es lo que separa a un proveedor de un vendedor.

**No cierres un número en la reunión.** Alcanza con: *"lo cotizamos
aparte, cuando definamos si va en esta etapa o en la siguiente"*.

### 2. La búsqueda por ubicación (2 min) — **el momento fuerte**

Es lo que diferencia el producto y es lo que habilita el segundo cobro.

- Filtrá por provincia. Mostrá cómo cambia el listado.
- Elegí una localidad dentro de esa provincia.
- Combinalo con una categoría y un rango de precio.
- **Recargá la página**: el filtro se mantiene. El enlace se puede
  compartir.

> "La ubicación no es un texto escrito a mano: son las 4.028 localidades
> del padrón oficial del Estado, con coordenadas. Sobre eso se construye
> después la logística por cercanía."

### 3. Detalle y compra (2 min)

Entrá a una publicación, agregá al carrito, mostrá el carrito, avanzá al
checkout **hasta la pantalla de pago**.

Con Mercado Pago **ahí frenás.** No intentes pagar.

> "El cobro con tarjeta está implementado y esperando la cuenta de
> Mercado Pago de ustedes, que es lo que figura como responsabilidad del
> cliente."

### 3b. La transferencia bancaria, completa (3 min) — **el segundo momento fuerte**

Esto sí funciona de punta a punta y conviene mostrarlo entero, porque en
el campo es como se paga de verdad.

- En el checkout elegí **Transferencia bancaria**. Aparecen el CBU, el
  alias y el titular **del vendedor de esa publicación**.
- Adjuntá un comprobante.
- **Cambiá a la cuenta del vendedor**, entrá a "Mis ventas" y mostrá que
  ahí está el comprobante esperando.
- Aprobalo. La orden pasa a pagada.
- Volvé atrás y mostrá también el rechazo, que exige escribir un motivo.

> "Nadie compra una cosechadora con tarjeta. Por eso la transferencia está
> completa: el comprador ve el CBU del vendedor, sube el comprobante, y el
> vendedor lo aprueba o lo rechaza con un motivo. La plataforma no toca la
> plata en ningún momento."

**Si pregunta por la seguridad**, tenés una respuesta concreta y probada:

> "Un vendedor no puede aprobar el comprobante de una venta que no es
> suya. Está verificado con una prueba automática que lo intenta y
> confirma que el sistema lo rechaza."

**Lo que no hay que prometer**: conciliación bancaria automática, avisos
por correo, ni qué pasa si el comprador transfiere de menos. Eso último es
una pregunta abierta para ella, no una función faltante.

### 4. Publicar como vendedor (2 min)

Cambiá a la cuenta de vendedor. Publicá algo en vivo: nombre, precio,
categoría, **provincia y localidad de una lista**, y una imagen.

> "El vendedor no escribe la ubicación: la elige del padrón. Por eso
> después se puede buscar por cercanía."

Mostrá que aparece en el catálogo y en su panel.

### 5. Administración (1 min)

Entrá con la cuenta de administración: usuarios, publicaciones, órdenes y
estadísticas.

### 6. Cierre (1 min)

> "Todo esto corre sobre PostgreSQL con PostGIS, que es la base que pide
> el documento, y hay **dieciocho pruebas automáticas** que verifican este
> mismo recorrido con un solo comando."

---

## Qué NO abrir

| No mostrar | Por qué |
|------------|---------|
| La página de Servicios | Es institucional estática, no publicaciones. Confunde en un marketplace |
| Intentar pagar | No hay credenciales de Mercado Pago |
| Cualquier cosa de transportistas | No está construido |
| Modo oscuro | Existe pero no hay forma de activarlo desde la interfaz |
| El repositorio o la documentación heredada | No aporta y abre preguntas sobre el equipo anterior |

---

## Las tres preguntas que va a hacer, con la respuesta pensada

### "¿Y los fletes? ¿Los transportistas?"

> "Es la próxima etapa y es el diferencial del producto. La base ya está
> puesta: cada publicación tiene coordenadas oficiales y la base calcula
> distancias reales. Lo que falta definir con ustedes es cómo declara su
> cobertura el transportista: por zonas que atiende o por radio en
> kilómetros. Con esa definición arranca."

**Convierte una carencia en una decisión que le pedís a él.** Y es cierto.

### "¿Puedo cobrar ya?"

> "El cobro con Mercado Pago está implementado. Necesita la cuenta de
> ustedes para activarse; es la parte que figura como responsabilidad del
> cliente. La transferencia bancaria con comprobante entra en la etapa de
> pagos."

### "¿Cuándo está listo?"

> "El plazo del documento son 12 a 14 semanas desde la firma."

**No des una fecha más precisa.** Lo construido hasta ahora es previo al
reloj y es ventaja tuya, no un adelanto que puedas prometer.

---

## Si algo se rompe en vivo

No lo escondas ni lo minimices. Anotalo, seguí con el resto, y decí que
queda registrado y se corrige. Ese cliente ya vivió que le dijeran que
todo andaba cuando no andaba: la reacción honesta te suma más de lo que te
resta el error.

---

## Lo que no es parte de la demo pero se lleva a la reunión

Las tres cláusulas de `PRE_FIRMA.md`: la lista de lo que no incluye, la
cotización aparte de todo pedido fuera de alcance, y el límite de la
garantía de 90 días a errores y no a funcionalidad nueva.

Presentá la lista de exclusiones como transparencia. A alguien que ya fue
maltratado, saber con precisión qué entra y qué no le suma confianza.
