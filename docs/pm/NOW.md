# Estado actual

Actualizado: 2026-07-24

## Objetivo activo

Publicar un MVP navegable del marketplace agropecuario.

## Estado

- Repositorio conectado. **No es un proyecto vacío**: contiene la entrega
  Fase I de TopGreen / AgroMarket (versión `1.0.1`), correspondiente a lo
  publicado en `topgreen.com.ar`.
- Inventario de pantallas completado (ver `REPO_MAP.md`).
- El recorrido comprador catálogo → producto ya existe y funciona.
- El recorrido no es enlazable: la navegación es por estado en `App.tsx`,
  no hay router ni URL por producto.

## Próximas tareas

1. **Decidir el alcance del MVP navegable frente a Fase II parcial.**
   Hay módulos a medio integrar (ratings, servicios, subcategorías,
   form options, geo) que no se apagan con un flag. Definir para cada uno:
   completar, ocultar del frontend, o remover.
   - Criterio de aceptación: cada módulo de Fase II tiene una decisión
     escrita en `DECISIONS.md`.

2. **Definir si el MVP requiere URLs por producto.**
   Hoy no las hay. Sin router no se puede compartir un enlace a una
   publicación ni indexarla en buscadores.
   - Criterio de aceptación: decisión registrada; si es "sí", queda
     estimado el trabajo de introducir routing.

3. **Definir el paso "contacto" del recorrido comprador.**
   Existe `ContactPage` (formulario general de la empresa) y existe
   checkout con Mercado Pago desvinculado. No existe mensajería
   comprador ↔ vendedor.
   - Criterio de aceptación: está escrito qué significa "contactar al
     vendedor" en el MVP y con qué pieza se resuelve.

## Bloqueos

- **Mercado Pago entregado desvinculado.** Todas las variables `MP_*`
  vienen vacías. Si el MVP incluye compra real, hay que crear una
  aplicación propia de Mercado Pago antes (ver `docs/SETUP_PAYMENTS.md`).
- **Sin URLs por producto.** Bloquea compartir y indexar publicaciones.
- **Imágenes en filesystem local** (`/data/uploads`), no apto para
  producción según la propia documentación de entrega.

## Último resultado validado

Inventario de pantallas y módulos backend, hecho leyendo el repositorio.
Resultado en `REPO_MAP.md`. Nada ejecutado ni desplegado todavía.
