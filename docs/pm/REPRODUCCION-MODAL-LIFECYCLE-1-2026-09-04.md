# Reproducción PM — MODAL-LIFECYCLE-1

Fecha: 2026-09-04  
Producto/regresión revisado: `b07ebce`  
Informe Dev: `83f6985`

## Veredicto

**Aceptada.** El detalle de una orden entra en la misma pila de capas que el
panel de Administración. El primer Escape cierra sólo el detalle, conserva
pestaña, filtro, página y scroll, y devuelve el foco al botón exacto que lo
abrió. El segundo Escape cierra Administración y devuelve el foco al Header.

C1 ya estaba resuelto por `useCapaModal`: Inicio, Mercado y Servicios devuelven
el foco al disparador correcto al cerrar el detalle por Escape, X o fondo. La
Dev lo midió antes de editar y no tocó `ProductCard` ni `ProductDetailModal`.

## Revisión del cambio

- El cambio de producto queda acotado a `AdminPanel.tsx`: reutiliza
  `useCapaModal`, añade semántica de diálogo y un nombre accesible al botón de
  cada orden.
- No crea otra infraestructura de modales ni agrega dependencias.
- La devolución de foco conserva el elemento exacto, no sólo otro botón con el
  mismo texto.
- No toca Backend, navegación, formularios, modelos, migraciones, seed, pagos,
  BOEDA, Railway ni datos remotos.

## Ejecución independiente y evidencia combinada

| Puerta | Resultado |
|---|---:|
| Dev, suite completa desde base limpia | **147/148**; único rojo: 131 por limitación declarada de su puente Docker |
| PM, caso 148 aislado con stack propio | **1/1** |
| PM, caso 131 aislado con stack propio | **1/1** |
| Build TypeScript/Vite dentro de ambas corridas PM | verde |
| `npm run lint -- --max-warnings 0` | verde |
| Sintaxis de `scripts/smoke.mjs` | verde |
| `compileall` de Backend | verde |
| `pip check` dentro de la imagen real del Backend | sin dependencias rotas |
| `diff --check` real | limpio |

La PM inició además una repetición completa, pero la salida final no quedó
recuperable al cambiar el turno de la herramienta. No se presenta como prueba.
Para no gastar otra corrida idéntica, se aplicó el protocolo de verificación
por riesgo: la entrega Dev cubrió 147 casos y la PM reprodujo por separado el
caso nuevo y su único rojo. La base anterior `bcdd448` ya había cerrado
147/147 de forma independiente. El conjunto cubre los 148 casos sin atribuir
una corrida completa inexistente.

## Salvedades no bloqueantes

- El detalle de orden sólo tiene un control focalizable; Tab y Shift+Tab deben
  permanecer en ese control y el caso 148 lo comprueba.
- El `onClose` del panel de Administración todavía nace como función nueva en
  cada render de `App`. Hoy no produce un fallo reproducido. Si se toca ese
  cableado, debe estabilizarse sin abrir otra arquitectura ni mezclarse con
  esta aceptación.
- El caso 148 crea datos únicamente en su base efímera para disponer de página
  y scroll reales; no modifica seed ni entornos remotos.
