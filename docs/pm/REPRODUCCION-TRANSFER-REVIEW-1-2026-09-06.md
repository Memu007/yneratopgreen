# Reproducción PM — TRANSFER-REVIEW-1 — 2026-09-06

## Decisión

**Devuelta.** Producto/regresión `0878bd4`; informe `5f82093`, con corrección
del SHA en `5423a86`.

El recorrido principal y el caso 153 están bien encaminados, pero la capa puede
cerrarse mientras el PATCH irreversible sigue en vuelo. La interfaz comunica
cancelación y después la orden queda rechazada. TRANSFER-REVIEW-1 no se acepta
hasta que el envío pendiente tenga un ciclo modal coherente.

## Diff y procedencia

- base PM: `d93988e`;
- producto/regresión: `0878bd4`;
- sólo `UserDashboard.tsx` y `scripts/smoke.mjs`: 467 inserciones y 11
  eliminaciones;
- `diff-check` con `core.whitespace=cr-at-eol`: limpio;
- hashes SHA-256 reproducidos por PM:

```text
39548738f63f10e5e7e896ecd3f8ada32f729036b5f774bbf78c26c2d7a8bc8e  src/components/UserDashboard/UserDashboard.tsx
073d11db03a8d8f348bfb856afdd4943a410e89d98fc457509dfa32186d1979b  scripts/smoke.mjs
```

No hay Backend, modelos, migraciones, estilos, pagos ni infraestructura en el
diff. La aprobación conserva su función anterior; el rechazo usa capa propia,
motivo recortado, error inline y recarga desde la fuente real.

## Regresión discriminante reproducida

PM creó una base PostgreSQL nueva y aislada, aplicó migraciones y seed local,
levantó API/Frontend locales con `MP_CHECKOUT_HABILITADO=false` y ejecutó el
caso 153 actual:

```text
PASS 153 Rechazar una transferencia se decide dentro del producto
1/1 pasaron; 0 fallaron
```

El caso comprueba capa propia, blanco sin PATCH, foco/error, cuatro cierres en
reposo, fallo de API, reintento único, motivo persistido y aprobación todavía
disponible. No es una suite completa y no se atribuye como tal.

Dev informó 152/153 con el único rojo ambiental conocido en 131, más build,
lint, TypeScript, sintaxis, a11y 64/64 y `diff-check` verdes. Es evidencia de
Dev; PM no la repitió porque el rojo adicional siguiente ya decide devolución.

## Rojo adicional de PM — cierre durante el envío

Sobre otra transferencia local pendiente, PM interceptó el PATCH sin dejarlo
responder, confirmó el rechazo y comprobó que la capa mostraba
`Rechazando…`. En ese momento X y Cancelar seguían habilitados. PM pulsó Escape:
la capa desapareció antes de que existiera respuesta. Al liberar la petición,
el Backend respondió 200 y la orden terminó rechazada.

```json
{
  "durante": {
    "boton": 1,
    "cerrarHabilitado": true,
    "cancelarHabilitado": true
  },
  "cerradaAntesDeResponder": true,
  "estadoFinal": "rejected"
}
```

Esto contradice el cierre «sin mutar la orden» y deja a la persona sin el
resultado visible de una decisión irreversible. Además, por inspección, una
respuesta exitosa llama `cerrarElRechazo()` sin distinguir qué capa está abierta:
si pudiera reabrirse otra mientras la primera petición sigue viva, la respuesta
anterior cerraría la nueva. No hace falta reproducir esa segunda consecuencia
para cerrar la raíz.

## Corrección mínima exigida

Mientras `enviandoElRechazo` sea verdadero, ninguna de las cuatro salidas de la
capa —Escape, X, Cancelar o fondo— puede cerrarla ni permitir abrir otro
rechazo. La capa permanece mostrando el estado pendiente hasta que:

- el éxito cierre, recargue y muestre el resultado real; o
- el fallo mantenga motivo y error y vuelva a habilitar cierre/reintento.

No hace falta cancelar HTTP, cambiar Backend ni crear otro gestor modal. Un
único cierre protegido usado por `useCapaModal`, X, Cancelar y fondo alcanza;
los controles que no pueden actuar deben comunicar su estado de forma
coherente.

Se amplía el mismo caso 153: retener el primer PATCH, intentar las cuatro
salidas mientras está pendiente y exigir que la capa permanezca, que sólo haya
un PATCH y que el motivo siga visible. Después se libera como fallo y continúa
el bloque actual de error/reintento/persistencia. No se crea el caso 154, ya
reservado para Registro.

Dev corre 153 aislado, 148 y una suite completa. Si el diff sigue limitado a
Frontend/regresión, bastan build, lint, `tsc --noEmit`, `node --check` y
`diff-check`; no se repiten Backend, `pip check`, contraste ni a11y completa.

No hubo despliegue, datos remotos, secretos ni pagos. La base y archivos
sintéticos se eliminan al cerrar la revisión.
