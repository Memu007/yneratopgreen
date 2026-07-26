# Dev → PM

## Estado

- **Tarea 3 terminada y subida:** `5620c06`.
- **Tarea 2, relevamiento móvil, terminada y subida:** `3a14e12`.
- No hice correcciones de interfaz móvil. Respeté el cambio de prioridad de
  `PARA-DEV.md`.

## Tarea 3 — puerto fijo de Vite

`package.json` quedó con:

```json
"dev": "vite --port 5173 --strictPort"
```

Lo verifiqué con dos instancias. La primera levantó en `5173`; la segunda
falló, sin moverse a otro puerto:

```text
> vite --port 5173 --strictPort
error when starting dev server:
Error: Port 5173 is already in use
```

## Tarea 2 — cómo se relevó

Agregué `scripts/mobile-audit.mjs`, separado de `smoke.mjs`. Usa Chromium
headless y recorre:

1. Home y entrada a AgroMarket.
2. Filtros de categoría, provincia y localidad.
3. Catálogo y tarjetas.
4. Detalle.
5. Carrito y checkout hasta el paso de pago.
6. Formulario de publicación, arriba y abajo.
7. Panel del vendedor, sus productos, administración y tabla de productos.

Tamaños ejecutados:

- `360×800`: 12 estados.
- `390×844`: 12 estados.
- `768×1024`: 12 estados.

Salida final:

```text
Pantallas verificadas: 36
Desbordes horizontales: 0
Errores/advertencias de consola: 0
Respuestas 4xx/5xx: 0
Resultado: docs/pm/evidence/mobile-2026-07-26/audit-results.json
```

Los filtros nativos se seleccionaron realmente en las tres medidas. También
se navegó a pestañas que empiezan fuera de pantalla: `Mis Productos` del
vendedor y `Productos` de administración.

## Inventario de lo roto

### Impide usar

Nada encontrado. Los recorridos completos llegaron a su estado final en las
tres medidas.

### Molesta

1. **Panel del vendedor, 360×800 y 390×844:** la barra de pestañas requiere
   desplazamiento horizontal para llegar a `Mis Productos`. El scroll está
   contenido en la barra; no desborda la página.
2. **Administración, 360×800 y 390×844:** las pestañas y la tabla de productos
   requieren desplazamiento horizontal. El scroll está contenido; la página
   no crece fuera del viewport.
3. **Filtros, 360×800 / 390×844 / 768×1024:** los `select` de categoría,
   provincia y localidad miden respectivamente `302×36`, `332×36` y
   `686×42` CSS px. Funcionaron con contexto táctil, pero quedan por debajo
   de 44 px de alto.

### Feo

1. **Administración, tabla de productos, 360×800 y 390×844:** varias imágenes
   demo no cargan y el navegador muestra el ícono roto con el texto
   alternativo. El catálogo público sí reemplaza esas imágenes por
   `Sin Imagen`.
2. Hay controles secundarios debajo de 44 px: cierre del formulario
   (`32×32`), botones de autenticación del header (`34–37` px de alto) y
   enlaces del footer. Ninguno trabó el recorrido.

No corregí estos puntos: la PM anuló expresamente las correcciones móviles.
El detalle completo por pantalla, incluido cada target táctil medido, está en
`audit-results.json`.

## Consola

Inventario final: **0 errores y 0 advertencias** en los 36 estados.

El script registra sin filtrar:

- `pageerror`;
- mensajes `warning`, `warn` y `error` de consola;
- pantalla y viewport donde ocurre cada evento.

## Red

Inventario final: **0 respuestas fuera de `2xx`/`3xx`** en los 36 estados.

El script registra método, estado, URL, pantalla y viewport de cada respuesta
fallida.

## Evidencia

Directorio: `docs/pm/evidence/mobile-2026-07-26/`

- 12 capturas en `360×800`.
- 12 capturas en `390×844`.
- `audit-results.json` con las 36 observaciones, consola y red.

Hay más capturas que las siete mínimas porque separé carrito/pago,
formulario arriba/abajo y vistas iniciales/de productos de ambos paneles.

## Smoke final

Ejecutado después de cerrar el script y las capturas:

```text
Resumen smoke tests
-------------------
PASS 01 Salud del servicio
PASS 02 Registro de usuario
PASS 03 Ingreso y obtención del token
PASS 04 Catálogo con categoría y precio
PASS 05 Catálogo con provincia y localidad
PASS 06 Detalle de producto
PASS 07 Agregar al carrito y verlo
PASS 08 Crear orden desde el carrito
PASS 09 Publicar producto como vendedor desde la interfaz
PASS 10 Fallo de imagen visible sin perder la publicación
PASS 11 Ver mis compras y mis ventas
PASS 12 Administración: usuarios, productos y órdenes
-------------------
12/12 pasaron; 0 fallaron
```

También pasó el build de frontend dentro del smoke.

## No ejecutado

- No corrí métricas de rendimiento: están fuera de alcance.
- No hice correcciones móviles ni pruebas de “antes/después”, porque no hubo
  ningún fix de interfaz.
