# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## TRANSFER-REVIEW-1R — cancelar no puede rechazar después

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `b9eddf3` — «TRANSFER-REVIEW-1R: cancelar no puede
  rechazar despues»
- La suite sigue en **153 casos**: amplié el bloque, no creé el 154.

Era el riesgo residual que informé, y lo dejé abierto igual. Tenías razón en
tratarlo como defecto y no como nota al pie: una pantalla que deja cancelar una
decisión que se ejecuta lo mismo miente, y encima esconde el resultado.

---

### 1. El rojo, contra `0878bd4`

Con el bloque nuevo puesto y el producto devuelto:

```
[FAIL] 153 … — Escape o el fondo cerraron la capa con el rechazo en vuelo
```

Ordené las aserciones para que ese sea el primer rojo: las dos salidas que
siempre se pueden intentar —Escape y fondo— van antes que las que ahora quedan
deshabilitadas. Así el mensaje dice el defecto y no un síntoma lateral.

### 2. La corrección

Un solo cierre, protegido:

```
soltarElRechazo()   limpia la capa. Lo usa el éxito.
cerrarElRechazo()   lo reciben useCapaModal, el fondo, la X y Cancelar.
                    No hace nada mientras el envío está en curso.
```

El estado del envío viaja por referencia para que ese cierre sea **uno solo y
estable**. Además la X y Cancelar quedan deshabilitadas, la capa se declara
`aria-busy`, el rótulo del botón dice `Rechazando…` y no se puede abrir otro
rechazo mientras uno viaja.

El **éxito cierra por el camino directo** —`soltarElRechazo`— a propósito: el
protegido lo frenaría, porque el `finally` que baja la bandera corre después de
la recarga. El **fallo** deja capa, motivo y error, y recién ahí vuelve a
habilitar cierre y reintento.

No cancelo HTTP, no toqué `useCapaModal` y no agregué un gestor modal.

### 3. El bloque del caso 153

Ampliado donde pediste. El primer PATCH se **retiene**: la ruta interceptada no
responde hasta que el caso la suelta. Es la única forma de mirar la ventana en
la que la petición ya salió y todavía no hay resultado.

Con el rechazo en vuelo el caso exige: la capa abierta después de Escape y de
un clic en el fondo, Cancelar y la X deshabilitadas, `aria-busy` puesto, el
motivo intacto, **un solo** PATCH y la orden sin mover. Después libera la
petición como fallo y sigue el bloque de error, reintento sano y persistencia
que ya estaba verde.

Un detalle del arnés: el botón cambia de rótulo mientras trabaja, así que ahora
se lo ubica por los dos nombres. Buscarlo sólo por «Confirmar rechazo» fallaba
justo en el momento que hay que medir.

### 4. Puertas

```
base limpia + SMOKE_CASOS=153                   1/1
base limpia + SMOKE_CASOS=148                   1/1
base limpia + suite completa                    152/153   (131 rojo)
  controles                                     18, 19, 24 y 148 en verde
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
npx tsc --noEmit                                ok
node --check scripts/smoke.mjs                  ok
git -c core.whitespace=cr-at-eol diff --check   limpio
```

El diff quedó en Frontend y regresión, así que —como indicaste— no repetí
Backend, `pip check`, contraste ni a11y completa.

El **131** es el ambiental de siempre; **153/153 es lo que tiene que dar en tu
máquina**.

### 5. Hashes

```
src/components/UserDashboard/UserDashboard.tsx  3981e2c06bcc5a55
scripts/smoke.mjs                               8d250eb697e84dcb
```

(SHA-256 truncado a 16, del árbol en `b9eddf3`.)

### 6. Riesgos residuales

1. **La petición sigue sin cancelarse**, como pediste. Si el navegador se
   cierra o la pestaña se recarga con el rechazo en vuelo, la orden puede
   quedar rechazada sin que nadie haya visto el resultado. Eso ya no lo puede
   provocar la pantalla, pero existe.
2. **Un envío que nunca responde deja la capa trabada.** No hay tiempo máximo:
   si la API se cuelga sin cerrar la conexión, la única salida es recargar. Con
   `fetch` sin `AbortController` no hay forma de acotarlo sin cancelar, y
   cancelar lo frenaste.
3. **Este freno vive sólo en esta capa.** El resto de los envíos del panel
   —guardar perfil, guardar publicación— siguen permitiendo cerrar mientras
   trabajan. Ahí el daño es otro —se pierde el aviso, no una decisión sobre una
   orden ajena—, pero si querés la misma regla en los tres, decilo y la aplico
   en una pieza aparte.
4. Sigue en pie lo del informe anterior: el motivo no tiene mínimo de longitud
   y el aviso de éxito sigue siendo un toast.

### 7. Frenos

No cambié Backend, estados de orden, stock, reservas, archivos, pagos, datos
bancarios, navegación, BOEDA, Railway ni datos remotos. No mezclé
`REGISTER-POLISH-1` ni nada de la cola visual. No creé el 154. No desplegué.
`PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
