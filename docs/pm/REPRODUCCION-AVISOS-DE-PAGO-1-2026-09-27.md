# Reproducción PM — AVISOS-DE-PAGO-1

Fecha: 2026-09-27. Base `2e86854` (la asignación).

- Código: `efb743c`.
- Casos 211, 212 y 213, y negativos: `a97911b`.
- Informe: `c6792ff`. Difiere de `a97911b` sólo en `docs/pm/PARA-PM.md`.

`main` está en `c92c0d7`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

| Cuándo | A quién | Aviso |
|---|---|---|
| Quien vende rechaza la transferencia, con comprobante o sin él | quien compra | Transferencia rechazada |
| Quien vende la aprueba | las dos partes | Pago aprobado / Venta pagada |
| Mercado Pago acredita el pago | las dos partes, una sola vez por orden | Pago aprobado / Venta pagada |

«¡Venta confirmada!» pasa a «Venta pagada»: confirmar es un paso que falta.

## Revisión del código

- **Transferencia:** el aviso sale después del `commit` de la decisión. Si
  falla, la decisión queda escrita.
- **Mercado Pago:** el aviso está en `cobro.aplicar`, en la única transición
  de «colocada» a «pagada». Una confirmación repetida no vuelve a pasar por
  ahí.
  - Va en la misma transacción, dentro de un savepoint. Si escribir el aviso
    falla, se pierde el aviso y no el pago.
- **Los dos estados de la decisión de transferencia** son `REJECTED` y
  `PAID`, así que la rama `else` no puede avisar «aprobado» por otro motivo.
- **Sin defectos.** Una observación, sin acción: un servicio
  (`cobro.py`) importa de la capa de API (`notifications.py`).

## Resultados PM

Entorno: SHA exacto `c6792ff`; PostgreSQL 16 nativo con PostGIS 3.4, base
recién creada con `entorno_nativo.sh --recrear`; API nativa y frontend de
desarrollo.

| Verificación | Resultado |
|---|---|
| Casos 210, 211 y 212 | **3/3** |
| Negativos de la Dev: `sin-aviso-de-rechazo`, `aviso-duplicado`, `sin-aviso-de-mercado-pago`, `aviso-que-falla` | **cuatro rojos esperados** |
| Negativo PM `pm-aviso-equivocado`: el rechazo avisa «Pago aprobado» | **rojo** en el 211: «tiene Pago aprobado… y tenía que tener…» y quien compra no lee el rechazo en los dos anchos |
| Negativo PM `pm-destinatarios-cruzados`: los avisos de Mercado Pago llegan a la parte equivocada | **rojo** en el 212: 10 problemas, «quien compra tiene Venta pagada» y «quien vende tiene Pago aprobado» |
| Árbol después de los seis | «src y backend después: como estaban» |
| Suite completa desde base nueva | **211/212**. Sólo cae el **131**, de entorno: el puente de `docker` no traduce `docker run` con `alpine:3`. El 169 pasa |
| lint, `tsc --noEmit`, build | verdes |
| `compileall`, `node --check`, `alembic check` | verdes; «No new upgrade operations detected.» |
| diff-check con `cr-at-eol` sobre `2e86854..a97911b` | limpio |
| a11y `--todas` | 80 de 80 pantallas, 0 violaciones |
| contraste | 88 de 88 mediciones |
| auditoría móvil | 0 errores de consola, 0 respuestas 4xx/5xx, 0 recorridos incompletos |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos» |

Los negativos de PM se corrieron con el mismo mecanismo del script de la Dev,
que reemplaza una zona, reinicia la API, corre el caso y restaura.

## El P1: tres confirmaciones a la vez cuelgan la API

**Confirmado por PM, y ya existía.**

- **Sobre `c6792ff`:** el 213 da rojo a los 31 s y la salud no responde. La
  base muestra una consulta `SELECT orders … FOR UPDATE` esperando el
  bloqueo, y dos transacciones abiertas esperando al cliente.
- **Sobre el código de producto de `2e86854`**, restaurado después: el 213
  da el mismo rojo. No lo trae esta pieza.

**Decisión PM:** se corrige en una tarea aparte, antes de habilitar Mercado
Pago. Hoy el sitio no tiene Mercado Pago habilitado.

## La pregunta de la Dev: un pago que llega a una orden ya cerrada

**Decisión PM: sin aviso por ahora.** En ese camino el stock no se vuelve a
tomar y la mercadería puede haberse vendido a otra persona, así que «Pago
aprobado» sería falso. El hueco es otro: hoy ese pago sólo queda en el
registro del servidor y nadie se entera. Se resuelve junto con el P1, antes
de habilitar Mercado Pago.

## Límites del entorno PM, declarados

- La red no llega a `railway.app`.
- Playwright 1.62 pide un Chromium que la imagen no trae. Se usó el
  Chromium 141 instalado, por `PLAYWRIGHT_BROWSERS_PATH` a un directorio
  fuera del repositorio. Sin tocar el repositorio.
- La auditoría móvil escribe sus capturas en `docs/pm/evidence/`. Se
  sacaron del repositorio; el resultado queda en esta tabla.
