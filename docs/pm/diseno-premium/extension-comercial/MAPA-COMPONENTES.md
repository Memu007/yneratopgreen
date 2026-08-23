# Mapa al producto real

## Fundaciones y shell

| Archivo real | Preservar | Aplicar | Riesgo / evidencia |
|---|---|---|---|
| `src/tokens.css` | Familias, espacios, radios, estados y capas. | Valores de `tokens.css`: canvas, action, hover y link. | Buscar hex duplicados; contraste/a11y en tres viewports. |
| `src/index.css` | Alias antiguos aún consumidos y controles globales. | Hacer que aliases apunten a la única capa `--tg-*`. | No crear `commercial-*` en paralelo. |
| `Header/Header.tsx` | Sesión, roles, carrito, vender, admin, callback MP y destinos reales. | Variante compacta Inicio/Servicios y variante buscador Mercado. | Todas las variantes de auth; teclado; zoom 200 %. |
| `Header/Header.module.css` | Foco, header no sticky en mobile/baja altura. | Geometría de `RESPONSIVE.md`. | 390 sin scroll horizontal; no perder Quiénes/Contacto. |
| `Footer/Footer.*` | Enlaces y descriptor vigentes. | Nuevos tokens; mantener wordmark claro. | Footer no agrega redes falsas ni claims. |

## Inicio

| Archivo real | Preservar | Aplicar | Dato/callback | Riesgo / gate |
|---|---|---|---|---|
| `Pages/HomePage.tsx` | Login requerido para publicar, toasts y callbacks. | Estructura completa de `inicio.html`; eliminar beneficios/iconos/claims. | `onNavigateToMarketplace`, `onPublishClick`, `onLoginClick`; preview real. | No duplicar ProductCard/formatters; estados de red. |
| `Pages/HomePage.module.css` | Sólo nombres consumidos tras refactor. | Hero 44/56, taxonomía, preview, decisión y CTA. | Sin dato. | 1440/768/390 y full page; 0 % overlay. |
| `App.tsx` | Estado de sección, URL y carga actual del Mercado. | Proveer preview/carga y total sin afectar filtros del Mercado. | `getProducts`, `ProductListResponse.total`. | Cancelación de efectos, error/offline, no doble carrera. |

La taxonomía no es botón en esta versión. Si Dev decide mapearla, debe traer a
PM la correspondencia exacta con categoría/tipo existente antes de habilitarla.

## Servicios

| Archivo real | Preservar | Aplicar | Dato/callback | Riesgo / gate |
|---|---|---|---|---|
| `Pages/ServicesPage.tsx` | Navegación a Contacto sólo donde aún corresponda. | Estructura de `servicios.html`; retirar video/claims/lista hardcodeada. | Preview de `servicio`/`logistica`; publicar; navegar filtrado. | No inventar cobertura/modalidad; servicio sin foto. |
| `Pages/ServicesPage.module.css` | Nada de la placa/overlay actual. | Hero 56/44, cards de datos, bloque de comparación y CTA. | Sin dato. | Resolución interina de hero; 0 % overlay. |
| `App.tsx` | `selectedType`, URL y `handleNavigate`. | `setSelectedType('servicios')` antes de ir al Mercado. | Estado existente del hook. | La URL sola no actualiza un hook ya montado. |

## Mercado

| Archivo real | Preservar | Aplicar | Riesgo / gate |
|---|---|---|---|
| `App.tsx` / `App.module.css` | Intro, filtros, ProductGrid, error/offline y callbacks. | Copy/espaciado de `mercado.html`; nuevos tokens. | No tocar carga, filtro, URL ni callbacks. |
| `FilterSidebar/*` | Opciones API y localidad dependiente. | Sólo color/espaciado que llegue por tokens. | Limpiar, combinación, mobile. |
| `ProductGrid/*` | Orden, conteo, carga/vacío/error. | Mantener densidad; no copiar cards del prototipo. | Estado de 0/1/N y sort actual. |
| `ProductCard/*` | Cuatro anatomías y acciones aceptadas. | Sólo tokens/globales. | `operationKind`, stock, cotización, foto y detalle. |
| `ProductImage/*` | Foto real, ausencia y error. | Sin cambio semántico. | URL vacía/rota y alt. |

## Activos

| Origen | Destino sugerido | Regla |
|---|---|---|
| `assets/produccion/*.webp` | `public/media/comercial/` | Copiar los cuatro; conservar nombre/hash. |
| `assets/*-concepto.webp` | Ninguno | Prohibido copiar/importar. |
| `../handoff/assets/*` | Ya implementado en `public/` | No duplicar ni re-subsetear. |

## Fuera de alcance y deuda

- Backend, modelo, seed, pagos, checkout, auth, paneles y administración.
- Nueva foto final de Servicios: compra/producción comercial, no decisión Dev.
- Rediseño completo de Quiénes somos y Contacto: reciben tokens/header/footer,
  pero no se inventa otra composición sin pantalla aprobada.
- Cualquier ruta, chat, mapa, financiación, sello o verificación nueva.
