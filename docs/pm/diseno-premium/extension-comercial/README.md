# Handoff aprobado — extensión comercial agro

Fecha: 2026-08-23
Dirección elegida por Emi: **A — Mercado a cielo abierto**
Estado: **aprobada para entregar a Dev; no es código de producto**.

Esta extensión corrige la devolución visual de
`../DEVOLUCION-EMI-UX2B.md`. Conserva wordmark, tipografías, cuatro anatomías,
estados y flujos del handoff original. Cambia la composición de Inicio y
Servicios, y redefine la ocupación del color/fotografía en las superficies
comerciales. La variante B queda archivada como control y **no se implementa**.

## Orden de lectura para Dev

1. [DECISION-EMI.md](./DECISION-EMI.md)
2. [PRESENTACION-FINAL.md](./PRESENTACION-FINAL.md)
3. [IMPLEMENTACION-DEV.md](./IMPLEMENTACION-DEV.md)
4. [TOKENS-Y-CONTRASTE.md](./TOKENS-Y-CONTRASTE.md) y [`tokens.css`](./tokens.css)
5. [RESPONSIVE.md](./RESPONSIVE.md)
6. [COPY.md](./COPY.md) y [ESTADOS-Y-DATOS.md](./ESTADOS-Y-DATOS.md)
7. [SISTEMA-FOTOGRAFICO.md](./SISTEMA-FOTOGRAFICO.md) y [ACTIVOS.md](./ACTIVOS.md)
8. [MAPA-COMPONENTES.md](./MAPA-COMPONENTES.md)
9. [PARIDAD.md](./PARIDAD.md)
10. [AUDITORIA.md](./AUDITORIA.md) y [CAPTURAS.md](./CAPTURAS.md)

Lo no redefinido aquí sigue regido por `../handoff/`: identidad, wordmark,
tipografía completa, detalle, anatomías, formularios, capas, paneles, checkout,
fallbacks, estados globales y funciones excluidas.

## Fuente visual ejecutable

- [`inicio.html`](./inicio.html)
- [`servicios.html`](./servicios.html)
- [`mercado.html`](./mercado.html)
- [`prototipo.css`](./prototipo.css)

Son referencias HTML/CSS aisladas. No se importan en `src/`, no dictan
arquitectura React y no contienen lógica real. La implementación consume los
datos y callbacks existentes.

## Evidencia

`pantallas/` contiene los tres viewports contractuales:

- `1440×900`
- `768×1024`
- `390×844`

También incluye capturas de página completa en 1440 y 390 para Inicio,
Servicios y Mercado. `concepto-a.png` resume el sistema; `comparativa-a-b.png`
registra la decisión. Las pantallas B se conservan como historial, no como
alternativa abierta.

## Corte adversarial

El handoff no autoriza:

- volver al hero índigo o cubrir fotografías con overlay;
- convertir las cuatro anatomías en una card universal;
- llamar `destacadas` a operaciones sin dato de curaduría;
- hacer clickeable una taxonomía sin un filtro/destino real;
- copiar las imágenes conceptuales de publicaciones al producto;
- mantener claims de IA, satélites, eficiencia, sustentabilidad o confianza que
  no estén respaldados por datos y alcance del producto;
- crear rutas, chat, financiación, mapas, verificación o funciones nuevas.

## Bloqueo comercial separado

Se entregan derivados optimizados de dos fotografías existentes del cliente
para Home y Servicios. Antes de una salida pública, Emi/PM deben conservar en
`ACTIVOS.md` la confirmación de autoría/cesión. La foto de Servicios sirve para
el MVP pero queda por debajo del estándar final de resolución; el reemplazo
fotográfico encargado está especificado, no se disimula.
