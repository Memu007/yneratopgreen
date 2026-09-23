# Puerta contractual de Fase 2 — Desarrollo base

Fecha: 2026-09-23. Ventana contractual: 04/09–24/09.

## Decisión PM

La **puerta funcional de Fase 2 está cumplida** en la composición aceptada
`1e4a63c`. Esta decisión no publica esa rama ni declara listo el entorno de
producción. `origin/main` sigue en `0bd7fbc`, el SHA de la última verificación
del runtime demostrativo (21/09).

## Criterios del cronograma y evidencia

| Criterio | Evidencia reproducida |
|---|---|
| Arquitectura, PostgreSQL/PostGIS, migraciones y seed | El lanzador Docker creó una base limpia, aplicó todas las migraciones hasta `b6d3f12a8e94` y sembró 4.028 localidades, categorías y 30 publicaciones. `alembic check` no encontró operaciones pendientes. Casos 4–6, 41, 43 y 55 pasaron en la suite. |
| Comprador y vendedor registrados con validación por correo | Casos 2–3 y 33–35 pasaron: alta pendiente, enlace de 24 horas y un solo uso, reenvío y bloqueo de login antes de confirmar. El correo se probó con outbox local; SMTP real pertenece a la puerta productiva. |
| Perfiles editables | Casos 39–40 pasaron en los recorridos de UI, API y base; el perfil común y el del transportista conservan sus datos al editar. |
| Transportista como proveedor especial, con localidad, certificación declarada, radio y capacidad | Casos 22, 39 y 42 pasaron: padrón oficial, detalle y fecha de la declaración, radio persistido y cargas declaradas. El transportista sigue siendo un proveedor especial, sin rol nuevo. |

La suite PM sobre `1e4a63c`, desde base Docker limpia, terminó **180/181**.
El único rojo fue el caso 157, ajeno a esta puerta: la copia temporal no tenía
metadatos Git y ese caso ejecuta `git ls-files`. Con Git disponible, el mismo
caso pasó **1/1**. La composición queda cubierta por 181 casos entre ambas
corridas; la evidencia completa está en
`REPRODUCCION-CART-PRODUCT-QUERY-1-2026-09-22.md`.

## Alcance de esta decisión

La fecha contractual no se mueve. La Fase 3 y el hito intermedio tienen su
aceptación propia en `MATRIZ.md`. La homologación real de Mercado Pago, SMTP
productivo, backups externos, red-team, despliegue final y entrega de accesos
siguen en sus puertas posteriores. Las tres piezas posteriores a `main`, una
de ellas con migración, permanecen aceptadas sólo en rama.
