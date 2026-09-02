# Reproducción PM — CART-RECOVERY-1

Fecha: 2026-09-02.  
Producto revisado: `ebb2b20`.  
Informe Dev: `8c29f47`.

## Dictamen

**Aceptada.** Una copia local inservible ya no atrapa la aplicación y se
descarta únicamente la clave del carrito. Una copia válida sobrevive la
recarga y la recuperación local no modifica el carrito del servidor.

## Revisión independiente

- Producto concentrado en `CartContext.tsx` y regresión en `smoke.mjs`; sin
  Backend, migración ni dependencia nueva.
- La lectura validada ocurre al construir el estado, antes del primer render;
  evita tanto el `JSON.parse` sin captura como el pisado del carrito válido por
  el estado vacío inicial bajo React estricto.
- Reutiliza `tienePrecioPublicado` y elimina sólo `agromarket_cart`; no limpia
  sesión ni otras preferencias.
- Build y lint: verdes. `diff --check`: limpio.

## Corridas de PM desde bases limpias

1. Caso 142 aislado: **1/1**, salida 0.
2. Suite completa desde otra base limpia: **142/142**, salida 0.

El caso 142 verificó JSON malformado, raíz que no es arreglo, ítem incompleto,
segunda recarga, conservación exacta de un carrito válido, sesión y clave ajena
intactas, carrito servidor sin cambios y cero peticiones a `/cart/sync` durante
la recuperación. Los casos transitorios 121 y 131 pasaron en la corrida
completa.

## Riesgo residual registrado

La escritura posterior con `localStorage.setItem` no captura una excepción por
cuota agotada o almacenamiento bloqueado. No fue el defecto encargado y no
bloquea este cierre. Si se reproduce en un navegador real o en una prueba
discriminante, se abre como pieza pequeña separada; no se mezcla con
SERVICE-STATE-1.
