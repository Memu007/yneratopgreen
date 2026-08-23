# Handoff visual — TopGreen / Puerta 3

Dirección: **B — Mesa de negocios**
Estado: **paquete para revisión de Emi y PM; no entregar a Opus**
Base revisada: `main` en `6488a9e` y despliegue público observado el 2026-08-22.

Este directorio es una especificación visual aislada. Nada de acá se importa en
`src/`, entra al build o modifica datos y flujos por sí solo.

## Presentación de salida

1. [Identidad final](./IDENTIDAD.md), [principios](./PRINCIPIOS.md) y SVG en
   `assets/wordmark/`.
2. [Catálogo](./marketplace.html) y [detalle](./detalle.html) responsive.
3. [Cuatro anatomías](./ANATOMIAS.md).
4. [Tablero de componentes y estados](./estados.html).
5. [Fotografía](./FOTOGRAFIA.md), [activos y licencias](./ACTIVOS.md).
6. [Mapa al producto real](./MAPA-COMPONENTES.md).

La presentación contractual para decisión está en
[PRESENTACION-PUERTA-3.md](./PRESENTACION-PUERTA-3.md).
La cobertura bloque por bloque está en
[AUDITORIA-CONTRATO.md](./AUDITORIA-CONTRATO.md).

## Fuentes de implementación

- [TOKENS.md](./TOKENS.md) y [`tokens.css`](./tokens.css).
- [`shared.css`](./shared.css), `marketplace.css`, `detalle.css` y `estados.css`.
- [COPY.md](./COPY.md).
- [RESPONSIVE.md](./RESPONSIVE.md).
- [PARIDAD.md](./PARIDAD.md).
- [FUTURO-NO-IMPLEMENTAR.md](./FUTURO-NO-IMPLEMENTAR.md).

## Capturas contractuales

`capturas/` contiene catálogo, detalle y tablero en:

- `1440×900` desktop;
- `768×1024` tablet;
- `390×844` mobile.

Además incluye vistas `*-resultados`, `*-operacion` y `*-anatomias` desplazadas
dentro del mismo viewport. Son evidencia complementaria para que la versión
mobile no se evalúe sólo por la cabecera o el primer pliegue.
El inventario exacto y el criterio de render están en
[CAPTURAS.md](./CAPTURAS.md).

Las capturas son evidencia. La fuente de verdad son los SVG, tokens, reglas y
HTML/CSS del paquete.

## Condiciones de uso

- Las imágenes conceptuales de Puerta 2 no están incluidas.
- No existe un pack de fotografía demo: no se obtuvo todavía un conjunto con
  licencia y aprobación explícitas.
- Los prototipos usan los fallbacks finales para probar el caso más difícil.
- `Ver transportistas` sólo se habilita en checkout después de conocer destino
  y carrito. No se inventa un directorio público.
- `Iniciar operación` para un activo con precio conserva la lógica actual de
  carrito/checkout; no abre mensajería.
