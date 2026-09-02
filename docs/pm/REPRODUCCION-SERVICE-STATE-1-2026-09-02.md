# Reproducción PM — SERVICE-STATE-1

Fecha: 2026-09-02.
Base de producto: `ebb2b20`.
Entrega revisada: `a038b56`; informe Dev: `bad5a1b`.
Veredicto: **aceptada**.

## Qué se revisó

El cambio reemplaza tres conversiones divergentes de publicación por una sola
función pura local, `aPublicacionDelPanel`, en
`src/components/UserDashboard/UserDashboard.tsx`. Los tres caminos del panel
—carga inicial, recarga por acción y recarga posterior a editar— la reutilizan.

La conversión conserva `operationKind`, `unit` y `pricingType`; el stock cero
sólo produce «Agotado» en publicaciones que usan stock. No hubo Backend,
endpoint, migración, dependencia ni rediseño. El cambio reduce el módulo en 27
líneas netas y agrega la regresión de navegador 143.

## Evidencia independiente de PM

Ejecutado desde bases limpias distintas:

- build: verde;
- lint: verde;
- caso oficial 143 aislado: **1/1**, salida 0;
- suite oficial completa: **143/143**, salida 0;
- dentro del pase completo también quedaron verdes 114, 121 y 131;
- `diff --check`: limpio.

Las líneas `ERROR` esperadas de las pruebas negativas de Mercado Pago y bloqueo
no fueron fallos de suite; el proceso completo terminó con salida 0.

El caso 143 recorre un servicio real con stock técnico 0 en carga inicial,
pausa, reactivación, edición y recarga completa, y contrasta UI, API y base. Un
producto real con stock 0 actúa como control y conserva «Agotado».

## Señales residuales

- Dev informó un rojo transitorio del caso 114 en una de tres corridas. PM no
  lo reprodujo: el caso pasó en la repetición completa. No abre producto; si
  vuelve, el arnés debe guardar el contenido visible de la tarjeta.
- `/products/my` sigue sin paginar y `operationKind` continúa tipado como
  `string` en el panel. Son deudas separadas, no bloquean esta aceptación.
- Los servicios ignoran stock cargado manualmente por decisión de dominio: no
  reservan unidades.
- El caso deja sus dos publicaciones de prueba en la base descartable al final
  de la corrida; no toca datos persistentes ni producción.

## Resultado

El defecto encargado está corregido con una sola fuente de verdad y una prueba
que discrimina servicio de producto agotado. **SERVICE-STATE-1 cierra.**
