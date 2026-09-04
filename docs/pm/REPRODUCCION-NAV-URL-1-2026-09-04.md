# Reproducción PM — NAV-URL-1

Fecha: 2026-09-04  
Producto/regresión revisado: `bcdd448`  
Informe Dev: `aeafc13`

## Veredicto

**Aceptada.** Inicio, Mercado, Servicios, Quiénes somos y Contacto tienen URL
estable; Atrás y Adelante restauran vista, pestaña y filtros; las rutas de pago
y verificación se normalizan al salir; el primer Atrás cierra el detalle sin
perder el listado.

## Revisión del cambio

- La solución usa la History API nativa y no agrega dependencias.
- La política de sección/URL es pura y las acciones de navegación y el único
  `popstate` viven en un módulo compartido.
- `ProductCard` delega la capa de detalle; no instala listeners propios.
- `useProductFilters` relee la URL al moverse el historial y sólo expone sus
  parámetros mientras Mercado está activo.
- El diff no toca Backend, modelos, migraciones, seed, autenticación, pagos,
  BOEDA ni Railway.

## Ejecución independiente

Desde bases limpias en la máquina PM:

| Puerta | Resultado |
|---|---:|
| Caso 147 aislado (`SMOKE_CASOS=147`, stack propio) | **1/1** |
| Suite oficial completa (stack propio) | **147/147** |
| Caso 131 dentro de la suite | **pasa** |
| Build TypeScript/Vite | verde |
| `npm run lint` | verde |
| Sintaxis de `scripts/smoke.mjs` | verde |
| `compileall` de Backend | verde |
| `pip check` | sin dependencias rotas |
| `diff --check` real | limpio |

El caso focal y la suite completa contrastaron simultáneamente URL, sección
visible y celda activa; recorrieron Atrás/Adelante, enlaces directos, recargas,
Mercado filtrado, las cuatro rutas especiales y detalles desde las tres
superficies.

## Salvedad no bloqueante

Los comentarios del módulo hablan del «único lugar que escribe historial».
Tres escrituras deliberadas permanecen afuera: filtros del Mercado y limpieza
de los parámetros de resultado MP y del token de correo. No navegan entre
secciones y las pruebas no muestran desincronización, pero la frase es más
absoluta que la arquitectura real. Se corrige cuando vuelva a tocarse esa
documentación; no justifica otra tarea de producto.
