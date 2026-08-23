# Mapa de implementación sobre el producto real

Este mapa evita que el handoff invente una segunda aplicación. Todos los cambios
indicados son visuales, de jerarquía o de copy salvo deuda explícita. En esta
Puerta no se modifica ningún archivo de producto.

## Entrada y estructura

| Superficie real | Preservar | Aplicar desde el handoff | Deuda / no inventar | Regresión / gate |
|---|---|---|---|---|
| `src/App.tsx` | Estado de sección, `?section=marketplace`, callbacks, carga, filtros, modales y sesión. | Orden visual de Mercado, encabezado, filtros y grilla. | No crear ruta `/mesa-de-negocios`. | Navegación directa y volver/adelante; `build`, `hito`. |
| `src/index.css`, `src/App.module.css` | Reset y comportamiento global necesarios. | Mapear `tokens.css`; una sola fuente de verdad para color, tipografía, foco y ancho. | No mantener dos temas paralelos ni propagar colores hex sueltos. | `contraste`, `a11y`, 3 viewports. |
| `src/types/index.ts` | Contratos API actuales. | Consumir precio, stock, ubicación, condición, vendedor y servicio reales. | No inferir “verificado”, moneda o modalidad ausente. Tipar semántica futura antes de depender de ella. | TypeScript en `build`; fixtures de casos límite. |

## Mercado y publicación

| Componente real | Preservar | Aplicar desde el handoff | Deuda / no inventar | Regresión / gate |
|---|---|---|---|---|
| `Header/Header.tsx` | Sesión, roles, búsqueda sólo en Mercado, carrito, navegación y avisos de Mercado Pago. | Wordmark compacto/horizontal, jerarquía en dos bandas y variantes anónima/comprador/vendedor/admin de `estados.html`. | No renombrar rutas ni ocultar acciones por estética. | Teclado completo, 390 px sin overflow, `a11y`. |
| `FilterSidebar/FilterSidebar.tsx` | Categorías/provincias/localidades de API, bloqueo de localidad y callbacks. | Panel lateral desktop y composición colapsable mobile. Copy de `COPY.md`. | No hardcodear opciones del prototipo. Un drawer modal futuro debe conservar foco y URL/estado. | Filtros combinados, limpieza, localidad dependiente; `hito`. |
| `ProductGrid/ProductGrid.tsx` | Carga, vacío y apertura de detalle. | Conteo de `operaciones`, orden, grilla 3/2/1 y estados de `estados.html`. | Si el orden todavía no está respaldado, ocultar controles no funcionales. | Loading/vacío/error; ancho 1440/768/390. |
| `ProductCard/ProductCard.tsx` | Apertura, carrito, stock, datos del vendedor y servicio. | Elegir anatomía por datos reales: alto valor, insumo, servicio o logística; jerarquía de `ANATOMIAS.md`. | El modelo actual no declara de forma completa tipo de operación, moneda o “alto valor”; acordar regla de dominio, no inferir sólo por precio en UI. | CTA por tipo, títulos largos, sin precio/stock/foto; `a11y`. |
| `ProductImage/ProductImage.tsx` | URL real, `alt` y manejo de error. | `assets/no-photo.svg` y `photo-broken.svg` con copies distintos. | Retirar la repetición de `IlustracionDeFamilia` como fallback comercial; no usar imagen conceptual. | Error de red, URL vacía, relación vertical/horizontal. |
| `ProductDetail/ProductDetailModal.tsx` | Modal, cantidad, carrito, perfil del vendedor y cierre. | Jerarquía de `detalle.html`, resumen de operación, tabla técnica y CTA por tipo. | `Iniciar operación` usa carrito/checkout: no chat, reserva ni escrow. | Trap/restauración de foco, Escape, scroll, stock; `a11y`, `hito`. |
| `SellerProfile/SellerProfileModal.tsx` | Datos, rating, ventas y estado documental reales. | Bloque de contraparte y copy sobrio. | `Documentación revisada` sólo con booleano verdadero; cero rating = `Sin calificaciones aún`. | Datos ausentes/0, privacidad, `contraste`. |

## Publicar, comprar y operar

| Componente real | Preservar | Aplicar desde el handoff | Deuda / no inventar | Regresión / gate |
|---|---|---|---|---|
| `AddProduct/AddProductModal.tsx` | Tipo producto/servicio, categorías, ubicación, atributos, tags, drag/drop, principal y validación. | Campos, subida y validaciones de `estados.html`; densidad y foco del sistema. | No agregar certificaciones ni reglas de aprobación sin backend. | Archivo inválido, límite, error, teclado; `a11y`, `hito`. |
| `Cart/CartModal.tsx` | Cantidad, remoción, stock y paso a checkout. | Resumen compacto y CTA transaccional. | No tratar servicios o `A cotizar` como compra cerrada si el flujo actual no lo soporta. | Totales, vaciar, stock, sesión; `hito`. |
| `Checkout/CheckoutModal.tsx` | Destino, sincronización, candidatos logísticos, decisión por vendedor, medios y órdenes. | Drawer/modal, tabla, estados y lenguaje de logística del tablero. | `Ver transportistas` sólo aquí y tras destino; no directorio público ni candidato inventado. | Sin cobertura, cuenta propia, candidato, cambio de destino, pago; `smoke` en entorno aislado. |
| `UserDashboard/UserDashboard.tsx` | Perfil, operaciones, compras, ventas, publicaciones, avisos, edición, traslado y documentos. | Cabecera por rol, tabs, tablas, badges y estados de `estados.html`. | No resumir estados legales/operativos en un color sin texto. | Tablas en 390 px, todas las tabs, edición, documentación; `hito`, `a11y`. |
| `AdminPanel/AdminPanel.tsx` | Gestión y tablas actuales. | Variante de cabecera admin, tablas y alertas del sistema. | No elevar permisos ni agregar métricas ficticias. | Overflow de tablas, acciones destructivas, roles; `a11y`. |
| `Toast/Toast.tsx` | Tipos, confirmación, cierre y región viva. | Toasts del tablero, color + título + texto. | Nunca depender sólo del color; no ocultar fallos críticos automáticamente. | Lectura por lector, foco de confirmación; `a11y`. |

## Páginas y soporte

| Superficie real | Preservar | Aplicar | Regresión |
|---|---|---|---|
| `Footer/Footer.tsx` | Navegación Home/Servicios/Quiénes somos/Contacto. | Wordmark monocromo, descriptor y jerarquía del tablero. | Enlaces y contraste. |
| `Pages/ContactPage.tsx` | Formulario, asuntos y WhatsApp actuales. | Sistema de campos y el puente honesto desde `Solicitar cotización`. | No prometer prefill por publicación si no existe. |
| `Pages/HomePage.tsx`, `ServicesPage.tsx`, `AboutPage.tsx` | Navegación y CTAs reales. | En una fase posterior, extender el sistema sin copiar la grilla del Mercado. | No bloquear la implementación del Mercado ni rehacer contenido en esta entrega. |
| Auth y resultados de pago | Sesión, validación, tokens y estados de pago. | Campos, modales, alertas y jerarquía compartidos. | Nunca suavizar error de pago ni exponer datos. |

## Activos y deuda explícita

- Copiar sólo assets listados en `ACTIVOS.md`; self-host de fuentes.
- Adoptar `tokens.css` mediante variables/tokens del producto, no importar los
  HTML de referencia.
- Las clases y el CSS del prototipo son especificación visible, no arquitectura
  recomendada para React.
- Falta un tipo de dominio inequívoco para las cuatro anatomías y una semántica
  explícita de `precio publicado` vs `a cotizar`. Resolver antes de ramificar UI.
- Falta una solicitud de cotización asociada a publicación. Hasta entonces,
  Contacto es sólo un puente general y debe decirlo.

## Gates existentes

En implementación, ejecutar en este orden:

1. `npm run build`
2. `npm run lint`
3. `npm run contraste`
4. `npm run a11y`
5. `npm run hito`
6. `npm run smoke` únicamente en el entorno aislado previsto por el script: el
   smoke local gestiona contenedores y volúmenes y no debe dispararse sobre un
   entorno con datos que deban preservarse.

Sumar pruebas visuales a 1440×900, 768×1024 y 390×844, además de teclado,
reduced motion, zoom 200 %, títulos largos y errores de imagen/red.
