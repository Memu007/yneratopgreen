# Reproducción PM — FORM-CONSISTENCY-1 — 2026-09-05

## Decisión

**No aceptada.** El caso 151 entregado pasa, pero no discrimina un error del
registro que se repite con el mismo texto. En ese recorrido el aviso vuelve a
quedar fuera de la ventana y el foco queda en el botón de envío, contra el
resultado obligatorio de la tarea.

## Árbol revisado

- base aceptada: `abd59d4`;
- producto/regresión: `6837af1`;
- informe Dev / `HEAD`: `15cc665`;
- estado inicial: `main` limpio y sincronizado con `origin/main`;
- diff de producto revisado: 7 archivos, 593 inserciones y 80 eliminaciones;
- `git -c core.whitespace=cr-at-eol diff --check abd59d4..6837af1`: limpio.

La revisión no encontró motivo para ampliar la tarea por el manejo agregado de
una imagen existente que no se logra eliminar: cae en el mismo resultado
parcial y no es el bloqueo de esta devolución.

## Regresión entregada

La PM ejecutó el caso 151 aislado desde una base PostgreSQL local dedicada,
recién creada, con migraciones y seed, API y Frontend locales y Chrome del
sistema. No se usaron Railway, datos remotos, credenciales reales ni pagos; la
bandera de checkout de Mercado Pago quedó en `false`.

```text
[PASS] 151 Un formulario no se contradice ni esconde su error (13662 ms)
CORRIDA FILTRADA (SMOKE_CASOS=151): NO es la suite completa
1/1 pasaron; 0 fallaron
```

Esto confirma el verde informado para el primer envío, no el cumplimiento de
«todo error» en sucesivos intentos.

## Rojo adicional reproducido

En un viewport de 1200 × 400:

1. PM abrió Registro, completó nombre, correo y dos contraseñas distintas.
2. El primer clic en «Crear cuenta» dejó la alerta visible y enfocada.
3. Sin cambiar ningún valor, PM volvió a llevar el botón a la vista y lo pulsó.
4. Después de dos cuadros de render, sin espera temporal fija, el resultado fue:

```json
{
  "activeRole": null,
  "activeText": "Crear cuenta",
  "alertTop": -381,
  "alertBottom": -333.390625,
  "viewportHeight": 400,
  "visible": false
}
```

Resultado: **rojo**. El mismo error existe, pero el foco queda en «Crear
cuenta» y la alerta está completamente fuera de la ventana.

La causa visible en el diff es que el efecto de foco depende sólo de `error`.
El envío hace `setError('')` y después vuelve a fijar exactamente «Las
contraseñas no coinciden» dentro del mismo evento. React conserva el mismo
estado final y el efecto no se ejecuta otra vez.

## Puertas rápidas de PM

```text
npm run build                                                OK
npm run lint                                                 OK
git -c core.whitespace=cr-at-eol diff --check abd59d4..6837af1 OK
```

PM no ejecutó una suite completa independiente: una entrega que ya incumple un
criterio obligatorio no justifica consumir esa corrida. La suite completa
informada por Dev sigue siendo 150/151 con el 131 ambiental; no se presenta
como evidencia independiente de PM.

## Corrección requerida

- Conseguir que cada intento fallido lleve el error vigente a vista/foco,
  aunque el texto sea idéntico al anterior, sin borrar valores.
- Ampliar el bloque de registro del caso 151 para repetir el mismo envío y
  contrastar alerta, visibilidad, foco y valores después del segundo intento.
- Conservar los otros cinco bordes del 151 y no abrir otra reescritura de
  formularios.
- Entregar rojo contra `6837af1`, verde aislado y suite completa de 151 casos,
  además de las puertas ya pedidas.
