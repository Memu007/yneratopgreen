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

## Corrección TRANSFER-REVIEW-1R — aceptación 2026-09-07

**Aceptada.** Producto/regresión `b9eddf3`; informe `ee42e62`, con corrección
del SHA en `317379c`.

El diff correctivo queda limitado a `UserDashboard.tsx` y `scripts/smoke.mjs`:
64 inserciones y 6 eliminaciones. `cerrarElRechazo` es el único cierre que
reciben `useCapaModal`, fondo, X y Cancelar, y consulta el envío vigente antes
de actuar. El éxito usa la liberación directa; el fallo conserva capa, motivo y
error. X y Cancelar quedan deshabilitados, la capa expone `aria-busy` y no se
puede abrir otro rechazo durante el pedido. No hay Backend, estilos, pagos,
infraestructura ni abstracción modal nueva.

PM reprodujo los hashes completos del árbol entregado:

```text
3981e2c06bcc5a557d672da650cb71e8e45ed3883d7a63c32430f1b4e9788347  src/components/UserDashboard/UserDashboard.tsx
8d250eb697e84dcbe7a571647b6d70df1a9fc81ff216b4dd3c23213a47eebae5  scripts/smoke.mjs
```

Desde otra base PostgreSQL local nueva, con migraciones, seed y
`MP_CHECKOUT_HABILITADO=false`, PM ejecutó el 153 ampliado:

```text
PASS 153 Rechazar una transferencia se decide dentro del producto
1/1 pasaron; 0 fallaron
```

La petición se retuvo de verdad. Mientras estuvo pendiente, Escape y fondo no
cerraron; X y Cancelar quedaron deshabilitados; `aria-busy`, motivo y capa se
conservaron; salió un solo PATCH y la orden no se movió antes de la respuesta.
Al liberar el fallo, el error quedó visible y el reintento sano persistió el
único rechazo real. El log recuperable quedó en
`/private/tmp/boeda-pm-transfer-153r-20260907.log`.

Puertas independientes PM: build con TypeScript, lint sin avisos,
`node --check` y `diff-check` con `core.whitespace=cr-at-eol`, todas verdes. PM
no repitió 148 ni la suite completa: el diff correctivo es mínimo, 148 ya fue
reproducido por Dev y la suite Dev fue **152/153**, con el único rojo ambiental
conocido en 131. Esa corrida no se atribuye a PM.

Los dos riesgos declarados —recarga del navegador o respuesta que nunca llega—
requieren cancelación/timeout y quedaron expresamente fuera de esta corrección;
la propia pantalla ya no puede fingir que canceló la decisión. Se eliminaron la
base, el archivo sintético y el puente local. La base habitual `topgreen` quedó
intacta. No hubo despliegue, Railway, datos remotos, secretos ni pagos.
