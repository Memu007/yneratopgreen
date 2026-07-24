# Decisiones

Registro breve. Una entrada por decisión relevante, más reciente arriba.
Formato: fecha, decisión, motivo.

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

1. Qué se hace con cada módulo de Fase II: completar, ocultar o remover.
2. Si el MVP necesita URLs por producto (introducir routing o no).
3. Qué significa "contactar al vendedor" en el MVP, dado que no hay
   mensajería.
4. Si el MVP incluye pago real (requiere aplicación propia de Mercado
   Pago) o queda como catálogo navegable sin checkout.
