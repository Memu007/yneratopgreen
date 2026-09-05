# Reproducción PM — FORM-DIRTY-1

Fecha: 2026-09-05.
Producto/regresión revisado: `7741b91`.
Informe Dev: `52b7add`, hash corregido en `ddcdc35`.

## Veredicto

**Devuelta.** La política de salida protege el descarte, pero introduce una
regresión transversal de foco que impide escribir normalmente en los tres
contenedores modificados: alta de publicación, checkout y Mi Panel.

Los tres callbacks entregados dependen del objeto completo devuelto por
`useSalidaProtegida`. Ese objeto se crea otra vez en cada render. Por lo tanto,
cada cambio de campo cambia el callback que recibe `useCapaModal`; su efecto se
desmonta y monta de nuevo y vuelve a enfocar el primer control de la capa.

## Evidencia independiente

PM montó una reproducción aislada con los mismos `useSalidaProtegida` y
`useCapaModal` y la misma dependencia usada en producto. El campo recibió
`pressSequentially('abc')`, con una actualización React por tecla.

Resultado contra `7741b91`:

```text
{"valor":"a","foco":"cerrar"}
```

Esperado: valor `abc` y foco todavía en el campo. Actual: sólo entra la primera
letra y el foco salta al botón Cerrar. El caso 149 no detecta esto porque carga
los valores con `fill()`, que concentra la edición y no comprueba que el foco se
mantenga después del render.

El alcance del defecto está confirmado en:

- `AddProductModal.tsx`: `pedirCierre` depende de `salida`;
- `CheckoutModal.tsx`: `pedirCierre` depende de `salida`;
- `UserDashboard.tsx`: `pedirCierreDelPanel` depende de `salida`.

Build, lint y `diff --check` quedaron verdes. Esas puertas no contradicen la
regresión funcional.

## Suite y entorno

La primera ejecución PM del caso 149 quedó sin resultado recuperable al
interrumpirse la sesión, por lo que se registra como **desconocida**. Al
reanudar, Docker Desktop 4.41.2 no volvió a iniciar. Sus logs y la verificación
local muestran que el binario incluido de Docker Compose tiene firma inválida;
Docker aborta al consultar sus metadatos. No se usó `Reset to factory defaults`,
no se borraron volúmenes y no se tocó Railway.

No corresponde gastar una suite completa antes de corregir el defecto
determinista que ya impide aceptar la pieza. Después de FORM-DIRTY-1R, PM debe
reproducir la regresión de foco, el 149 y la suite completa desde base limpia.

