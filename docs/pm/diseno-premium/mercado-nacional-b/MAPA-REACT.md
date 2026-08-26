# Mapa de B al producto React

| Superficie real | Preservar | Aplicar desde B | Evidencia mínima |
|---|---|---|---|
| `src/tokens.css` | Espaciado, capas, semánticos y breakpoints. | Familias y roles cromáticos de `HANDOFF-DEV.md`. | Una sola capa `--tg-*`; contraste. |
| `src/index.css` | Reset, foco, botones y aliases consumidos. | Alias hacia los nuevos roles; sin segunda temática. | Buscar hex/editorial residual. |
| `Header/Header.tsx` | Secciones, callbacks, sesión, roles, carrito, Salir y MP. | Celdas por rol; `Cuenta` mobile; placeholder mobile. | Cuatro roles × 1440/768/390. |
| `Header/Header.module.css` | Semántica y foco. | Banda verde, Mercado 2 bandas, navegación 3+2. | Cero overflow/recorte; zoom 200 %. |
| `Pages/HomePage.tsx` | Copy, `vistaPrevia`, total real, login/publicar y CTA. | Sólo estructura necesaria para banda de foto/medidor/libro. | 0/1/N, loading/error/offline. |
| `Pages/HomePage.module.css` | Orden DOM accesible. | Hero 47/53, registro, libro y densidad B. | Tres viewports; foto sin overlay. |
| `Pages/ServicesPage.tsx` | Filtro real, copy, datos, autenticación y callbacks. | Registro fotográfico y composición B. | Servicio/logística reales; vacío/error. |
| `Pages/ServicesPage.module.css` | Orden DOM. | Hero 53/47 y foto primero mobile. | Tres viewports; sin claims. |
| `App.tsx` / `App.module.css` | Carga, filtros, URL, secciones y callbacks. | Shell/toolbar/densidad de Mercado. | Filtros combinados y navegación intactos. |
| `FilterSidebar/*` | Opciones, localidad dependiente y limpiar. | Color, borde, espaciado y sidebar B. | Desktop y apertura mobile. |
| `ProductGrid/*` | Orden, loading, vacío, error y total. | Grilla 3/2/1 y toolbar B. | 0/1/N y total API. |
| `ProductCard/*` | Cuatro anatomías, formatos, stock/datos y acciones. | Borde superior y jerarquía B; no duplicar card. | Activo/insumo/servicio/logística. |
| `ProductImage/*` | URL, alt, carga y foto rota/ausente. | `no-photo-b.svg` y registro bajo. | Imagen válida, vacía y rota. |
| `Footer/*` | Links y contenido vigente. | Tokens/fuentes/wordmark B. | Navegación y contraste. |
| About/Contact/Auth/Detalle/Carrito/Paneles/Admin | Todos los flujos y composiciones. | Sólo fundaciones compartidas que no rompan. | Puertas completas sin rediseño inventado. |
| `public/fuentes/` | Licencias existentes. | Añadir Inter/Inter Tight + OFL. | Cero request externo/fuente fallida. |
| `public/marca/` | Nombres consumidos o actualizar imports. | Cuatro SVG corregidos del paquete. | Logo legible 1440/390 y 16–24 px. |
| `public/media/comercial/` | Los cuatro WebP actuales. | Reutilizar; no copiar ni recomprimir. | Hashes sin cambio. |

## Riesgos que Dev debe controlar

1. No copiar el `viewBox` defectuoso de una entrega anterior: los SVG válidos
   del paquete final son `555×110` y `555×136`.
2. El HTML contiene datos ilustrativos; nunca convertirlos en seed, fixtures o
   constantes de producto.
3. No perder `Salir` aunque la lámina resumida de Header no lo muestre.
4. No convertir la navegación 3+2 en cinco botones diminutos o scrollables.
5. No aplicar el verde de marca indiscriminadamente a éxito, seguridad o MP.
6. No usar el fallback de foto en cards de servicio que por anatomía no llevan
   fotografía.
7. Los estilos B deben llegar por roles/tokens, no por cientos de hex locales.

