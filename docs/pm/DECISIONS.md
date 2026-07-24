# Decisiones

Registro breve. Una entrada por decisión relevante, más reciente arriba.
Formato: fecha, decisión, motivo.

---

## 2026-07-24 — La documentación de entrega no es fuente de verdad

La migración `011` con `lat`, `lng` e índice geo, declarada en
`docs/PROJECT_STATUS.md`, **no existe**. Verificado: hay 10 migraciones
(`001`–`010`), ninguna menciona coordenadas, y `product.py` no las tiene.
`PM_ROADMAP.md` ya lo marcaba como sospecha; queda confirmado.

Consecuencia: el estado declarado en la documentación de entrega se trata
como afirmación no verificada hasta que exista evidencia end-to-end. El
alcance vinculante es `PM_ROADMAP.md` v3.

---

## 2026-07-24 — El objetivo activo es la Fase 0, no un MVP navegable

Se corrige el objetivo que figuraba antes en `NOW.md`. Nadie ejecutó el
código todavía: no hay evidencia de build, migraciones, seed ni smoke
tests. Planificar features sobre eso es especular.

Motivo: el roadmap v3 condiciona todas las fases siguientes a la
aprobación de la línea base, y la auditoría del `011` muestra por qué.

---

## 2026-07-24 — Adoptar `docs/pm/` como contexto de trabajo

Se crea la estructura `NOW.md`, `PROJECT.md`, `REPO_MAP.md` y
`DECISIONS.md` para trabajar sin recorrer el repositorio completo en cada
sesión.

Motivo: la documentación de entrega es extensa y descriptiva; hacía falta
una capa corta y actualizable que diga en qué estamos.

---

## Heredadas de la entrega Fase I (2026-06-04)

Decisiones tomadas por el equipo anterior que siguen vigentes. No fueron
revisadas por el equipo actual.

- **Split payment con Mercado Pago Marketplace**, 5 % de comisión
  configurable. Moneda única ARS.
- **Vendedor y comprador no son roles separados.** Los roles en base son
  `admin` y `user`; cualquier usuario puede publicar y comprar.
- **Mercado Pago se entrega desvinculado**, con todas las variables `MP_*`
  vacías. Motivo declarado: seguridad en el traspaso.
- **Imágenes en filesystem local** (`/data/uploads`) en lugar de S3 o
  Cloudinary. La entrega lo marca como no apto para producción.
- **Navegación por estado en `App.tsx`**, sin `react-router`.
  Consecuencia: no hay URL por producto.
- **Los módulos de Fase II quedan integrados a medio terminar** en vez de
  removidos, porque están entrelazados en migraciones, modelos y UI.
  La decisión sobre cada uno queda abierta para el equipo actual.

---

## Pendientes de decidir

Sin resolver. Cada una debería cerrarse con una entrada arriba.
Ordenadas por cuánto bloquean.

1. **PostgreSQL + PostGIS, o cambio contractual aprobado por escrito.**
   El contrato lo exige; el código usa SQL Server. Es Fase 2 y es caro.
   Hay que decidirlo antes de empezarla, no durante.
2. **Qué se hace con cada módulo de Fase II** (ratings, servicios,
   subcategorías, form options): completar, ocultar o remover. Están
   entrelazados en migraciones, modelos y UI; no se apagan con un flag.
3. **Si el MVP necesita URLs por producto.** Hoy no las hay. El roadmap
   pide en Fase 3 que el buscador "conserve filtros en navegación", lo
   que empuja hacia introducir routing.
4. **Alcance del rol transportista** en el MVP: selección directa,
   cotización, o ambas.
