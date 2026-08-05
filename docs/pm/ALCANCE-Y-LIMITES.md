# Alcance y limites contractuales

Actualizado: 2026-08-05.

Fuente primaria: *Documento de Especificacion Funcional y Propuesta
Comercial - Marketplace del Sector Agropecuario (Fase Nacional)*, revision
visual completa de sus cinco paginas el 2026-08-05.

Este archivo convierte el PDF en guardas operativas para la PM y la dev.
No agrega alcance. Si este archivo, `PROJECT.md` o un plan interno se
contradicen con el PDF, gana el PDF y se corrige el documento interno.

Las cifras comerciales, porcentajes y montos permanecen en el PDF original
y no se versionan en el repositorio que se entregara a la clienta.

---

## 1. Regla de control de alcance

Una funcion pertenece al MVP contractual solamente si puede trazarse a una
frase del PDF. Una decision posterior del dueño puede entrar al producto,
pero no entra automaticamente en el precio, el cronograma ni los hitos del
PDF.

Para todo pedido nuevo hay tres tratamientos posibles:

1. reemplaza una solucion existente sin ampliar el resultado comprometido;
2. se documenta en un addendum con plazo y aceptacion propios;
3. se posterga a una fase posterior al MVP contractual.

Construirlo sin elegir uno de esos tratamientos equivale a absorber alcance
sin haberlo acordado.

---

## 2. Limites por bloque

### Plataforma

**Incluido:** plataforma web responsive para la fase nacional argentina,
usable en computadora y dispositivo movil.

**Limite:** no incluye aplicacion nativa, operacion internacional,
multiidioma ni adaptaciones regulatorias de otros paises.

### Catalogo y busqueda

**Incluido:** busqueda y filtros por categoria y ubicacion; publicaciones
con imagenes, descripcion, precio, ubicacion y stock; las cinco familias del
PDF:

1. Insumos y Materia Prima.
2. Bienes y Ganado.
3. Maquinaria y Servicios.
4. Tecnologia para el Cultivo.
5. Logistica Integrada.

**Limite:** las subcategorias adicionales pueden quedarse si ya funcionan,
pero no justifican retrasar lo contractual. No entran publicidad,
posicionamiento pago, portal editorial, SEO masivo ni paridad con Agrofy.

### Comprador

**Incluido:** registro con validacion, perfil, busqueda por categoria y
ubicacion, carrito e historial de pedidos.

**Limite:** el PDF no define favoritos, cupones, financiacion, canje,
reseñas ni recomendaciones con IA.

### Vendedor o prestador

**Incluido:** registro con validacion, perfil, panel basico, publicacion y
edicion del catalogo y stock, y gestion de ventas recibidas.

**Limite:** no se prometio una sucursal digital completa, analitica
avanzada, reputacion verificada ni automatizacion comercial.

### Transportista

**Incluido:** es un tipo especial de proveedor, no un tercer rol. Declara
localidad base, transporte habilitado certificado, radio de cobertura en
kilometros y capacidad. En la compra se listan opciones compatibles, el
comprador puede seleccionarlo e incluirlo en la operacion o contactarlo de
forma directa.

**Interpretacion minima aprobada para el MVP:**

- Es un directorio por geolocalizacion, no un motor de ruteo.
- La compatibilidad geografica exige que origen y destino esten dentro del
  radio declarado por el transportista. Se calcula con PostGIS y distancia
  en linea recta.
- La capacidad se muestra para que el comprador decida. No se agrega un
  motor automatico por peso o volumen mientras las publicaciones no tengan
  esos datos estructurados.
- La certificacion se registra como declaracion del transportista con
  detalle y fecha. TopGreen no verifica organismos externos ni presenta la
  declaracion como certificacion propia.
- El listado no expone datos de contacto. El comprador accede al contacto
  del transportista despues de seleccionarlo.
- El transportista recibe una vista propia con origen, destino y necesidad
  logistica; no recibe precios, comprobantes ni el detalle financiero de la
  orden.

**Limite:** no incluye optimizacion de rutas, distancia por caminos,
seguimiento GPS, cotizacion logistica, calculo automatico de tarifa,
documentacion ARCA/Carta de Porte ni verificacion oficial de certificados.

### Pagos de las compras

**Incluido:**

- Mercado Pago mediante checkout basico para tarjeta, debito y dinero en
  cuenta.
- Transferencia directa del comprador al vendedor, mostrando CBU o alias,
  con posibilidad de adjuntar comprobante y validacion manual del vendedor.

**Limite:** TopGreen no recibe, retiene, divide ni gira dinero de las ventas
entre terceros. No entran split payments, OAuth de vendedores, comision de
marketplace, conciliacion bancaria ni reembolsos automaticos de
transferencias.

El comprobante es opcional como evidencia; el vendedor valida contra su
cuenta bancaria. La referencia de la orden debe permitir identificar el
pago.

### Tecnologia e infraestructura

**Incluido:** React o Next; FastAPI, Django o Node; PostgreSQL con PostGIS;
hosting inicial de bajo costo y HTTPS.

**Limite:** PostgreSQL con PostGIS no es intercambiable. El PDF nombra AWS,
Supabase o Render. Railway puede ser equivalente tecnicamente, pero necesita
confirmacion de Emi/clienta y una verificacion de costo antes de tratarlo
como destino contractual.

Las imagenes persistentes, backups, secretos rotados y HTTPS son condiciones
del despliegue; una configuracion en el repositorio no cuenta como sitio
publicado.

### Cierre y entrega

**Incluido:** QA integral, ajustes de usabilidad, carga inicial, despliegue
exitoso en produccion, accesos administrativos, capacitacion basica del
panel, documentacion tecnica del despliegue y garantia por bugs durante 90
dias desde el lanzamiento.

**Limite de garantia:** cubre defectos del software entregado. No cubre
funciones nuevas, cambios de negocio, integraciones adicionales ni
ampliaciones de alcance.

---

## 3. Fuera del PDF y del cronograma contractual

Estas decisiones pueden ser valiosas, pero son alcance posterior al PDF:

- suscripciones recurrentes por Mercado Pago;
- planes Basico y Premium;
- mensajeria interna Premium;
- tierras y parcelas como aviso de consulta;
- chatbot o funciones de inteligencia artificial.

No se asignan a las fases 1 a 5 ni consumen automaticamente las semanas 13
y 14. Requieren addendum, absorcion comercial explicita o fase 6.

---

## 4. Ambiguedades que no debe resolver la dev sola

1. Fecha exacta desde la cual corre la semana 1.
2. Que mecanismo satisface "registro con validacion": validacion de datos,
   correo, aprobacion administrativa u otro.
3. Aprobacion de Railway como alternativa a los proveedores nombrados.
4. Tratamiento comercial y temporal de suscripciones, planes, mensajeria y
   tierras.

Hasta que Emi cierre cada punto, la dev no inventa una solucion que amplie
el alcance.

