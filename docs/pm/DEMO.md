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

Abrí el marketplace. **24 publicaciones, doce categorías, nueve
provincias.** Mostrá las cinco categorías del pliego: insumos, ganado,
maquinaria, tecnología de cultivo y logística.

> "Estas son las cinco categorías de su documento, con publicaciones
> reales cargadas."

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

**Ahí frenás.** No intentes pagar.

> "El cobro está implementado y esperando la cuenta de Mercado Pago de
> ustedes, que es lo que figura como responsabilidad del cliente."

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
> el documento, y hay doce pruebas automáticas que verifican este mismo
> recorrido con un solo comando."

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
