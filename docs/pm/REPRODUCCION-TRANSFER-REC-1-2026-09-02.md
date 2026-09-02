# Reproducción PM — TRANSFER-REC-1

Fecha: 2026-09-02.  
Producto revisado: `14d561b`.  
Informe Dev: `a9c3fbd`.

## Dictamen

**Aceptada.** El comprador puede retomar desde Mis compras una transferencia
cerrada antes de adjuntar el comprobante, usando el snapshot de la orden y la
ruta existente. No se abrió ni se cerró `TRANSFER-REVIEW-1`.

## Revisión independiente

- Diff de producto: sólo `UserDashboard.tsx` y `scripts/smoke.mjs`; sin Backend,
  migración ni dependencia nueva; `diff --check` limpio.
- Build: verde.
- Lint con cero advertencias permitidas: verde.
- Caso 141: pasó en los dos pases completos de PM. Cubre cierre del checkout,
  recarga completa, reapertura de Mis compras, snapshot bancario, concepto,
  total, cambio posterior de datos del vendedor, carga del archivo, estado en
  base y estado final visible.

## Corridas oficiales

1. Desde base limpia: **140/141**. El caso nuevo 141 pasó; falló el caso viejo
   121, publicación sin fotografía.
2. Caso 121 aislado desde otra base limpia: **1/1**, salida 0.
3. Repetición completa desde otra base limpia: **141/141**, salida 0.

El primer rojo no se interpreta como regresión de producto porque el mismo
caso pasó aislado y dentro de la repetición completa sin cambio de código. Se
conserva esta evidencia como señal de inestabilidad transitoria del arnés; una
reincidencia debe investigarse, no normalizarse.

## Riesgos residuales

- El flujo depende correctamente de `payment_method=transfer` y del estado
  explícito de espera; no deduce órdenes antiguas incompletas.
- El checkout vigente impide crear una transferencia sin CBU ni alias. Si ese
  contrato cambia, habrá que volver a revisar la recuperación.
- La apariencia compartida con el bloque de Mercado Pago es una decisión
  visual futura, no parte de esta corrección.
