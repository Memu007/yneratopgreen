# Reproducción PM — DESVINCULAR-CON-COBROS-1

Fecha: 2026-09-30. Base `0495b31` (la respuesta de PM al freno).

- Producto: `bcc8ca5` (la regla y la pantalla) y `a27fc7c` (contraste).
- Casos, negativos, suite y `API_ENDPOINTS.md`: `718ec68`, `ead24f6` y
  `777bee1`.
- Informe: `d1a6a3e`, que difiere de `777bee1` sólo en `docs/pm`.

`main` está en `5d8df5d`. **ACEPTADA EN RAMA**, sin integración ni
despliegue.

## Qué cambia

- **Con cobros de Mercado Pago en curso no se desvincula ni se pasa a otra
  cuenta.** `unlink` contesta 409 con el motivo y cuántos cobros hay; la vuelta
  de Mercado Pago con otra cuenta vuelve con `otra_cuenta_con_cobros` y deja la
  de antes. Renovar y reconectar la misma cuenta pasan siempre.
- **El criterio vive en un solo lugar**, `cobro.en_curso`: reserva viva
  (reservada o cierre pendiente), o pago aprobado o en revisión con el link
  abierto. El reconciliador lo usa con el vencimiento agregado.
- **La pantalla** dice por qué no se puede y hasta cuándo, y la confirmación
  avisa que una devolución o un contracargo posterior no se va a ver.
- **La confirmación común de advertencia** pasa a título y botón en blanco
  sobre el marrón: estaban a 2,28:1 y quedan a 6,94:1. También cambia en
  «Vaciar carrito».
- **Sin migraciones.**

## Revisión del código

- **Decidir y escribir en la misma sentencia.** Desvincular es un `UPDATE …
  WHERE id = … AND (sin cuenta OR NOT EXISTS cobros en curso)`; guardar otra
  cuenta, lo mismo con «o es la misma cuenta». Si no escribe, `rollback` y
  `False`. Desvincular sin cuenta sigue siendo idempotente.
- **El reconciliador barre lo mismo que antes.** `_candidatas` pasa a
  `cobro.en_curso(vencida=…)`, que arma la misma condición: medio Mercado Pago
  y (reserva viva y vencida, o link abierto con cobro). Un negativo de PM lo
  comprueba (abajo).
- **La respuesta después de escribir lee el estado nuevo.** La sesión expira
  los objetos al confirmar, y el usuario de la sesión es el mismo `db` del
  pedido.
- **El 409 sólo nombra el motivo y el número.** El número se cuenta aparte,
  después del `rollback`; lo que decide es la sentencia.
- **La pantalla** toma el `detail` del 409 (`ErrorDeLaApi.detalle`, nuevo y
  compatible) y deja el motivo a la vista con `role="alert"`, en vez del aviso
  que se va. Cualquier otro error sigue con el aviso genérico.
- **La suite** desvincula en un solo lugar. Ante el 409 termina las ventas por
  los caminos del producto y vuelve a pedir; si sigue el 409, el caso falla,
  aunque la llamada esté en un `finally`. Nada del producto se abrió para la
  suite.
- **Los casos 76 y 92 cambiaron** porque probaban lo que la regla prohíbe. El
  92 sigue viendo `sin_destinatario` con un aviso de una cuenta que nadie
  tiene vinculada: es el mismo camino. El 76 ya no alcanza `sin_vinculo` en el
  reintento del link (P3, abajo).

## Resultados PM

Base PostGIS recién creada, API nativa reiniciada en el código entregado (un
solo proceso), frontend de desarrollo y configuración local inventada.

| Verificación | Resultado |
|---|---|
| Suite completa desde base recién creada | **229/230** en 24 minutos. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 76, el 92 y del 225 al 230. «Para desvincular hubo que terminar ventas en curso en: 75, 76, 77, 78, 79, 81, 82, 87, 90, 91, 97, 224, 228, 230», la misma lista del informe |
| Negativos de la Dev (7) | **7 rojos esperados**, cada uno por su motivo; «src y backend después: como estaban». Detalle abajo |
| Negativo PM 1, `pm-misma-cuenta-frenada`: la vuelta y la renovación frenan también a la misma cuenta | **rojo** en el 229: «con la misma cuenta volvió con «otra_cuenta_con_cobros»» y «renovar respondió 200 … "motivo":"otra_cuenta_con_cobros"». Es el camino para destrabar una orden, y está cubierto |
| Negativo PM 2, `pm-reconciliador-barre-lo-vigente`: el reconciliador usa el criterio sin el vencimiento | **rojo** en el 225: «con una reservada: desvincular respondió 200 y no 409», porque barrió también la venta vigente. El cambio de `_candidatas` está cubierto |
| Reproducción PM del punto 5, con un caso propio fuera del repositorio | una venta reservada: **409** `{"motivo":"cobros_en_curso","cobros_en_curso":1}` y las credenciales iguales; vencida y barrida, la reserva pasa de `reservada` a `liberada`, la orden a `CANCELLED` y el link queda apagado en el doble; **el segundo `unlink` da 200** y no queda nada guardado |
| Capturas de la confirmación y del panel, en escritorio y celular | se leen bien: el aviso en la confirmación, el motivo en un recuadro de advertencia, los botones apilados en celular. La primera captura de la confirmación salió a mitad de la animación; repetida al terminar, se ve completa. No se suben |
| Build, tipos, lint, `compileall`, `pip check`, `node --check`, `alembic check` | verdes; «No broken requirements found.» y «No new upgrade operations detected.» |
| a11y `--todas`, contraste, auditoría móvil | **80 de 80** pantallas, 0 serias o críticas; **88 de 88** mediciones; **12 de 12** recorridos, 0 errores de consola y 0 respuestas 4xx o 5xx. Las capturas no se suben |
| Las dos guías, después de la suite | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos» y «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos», en escritorio y celular |
| Diff-check `0495b31..777bee1` con `cr-at-eol` | limpio. **Pero `smoke.mjs` perdió sus 4 líneas CRLF** (36326 a 36329, de un caso de `AVISOS-DE-PAGO-1`): mismo texto, otro terminador, fuera de la zona de la pieza. El diff-check con `cr-at-eol` no lo ve. Los demás archivos con CRLF los conservan |
| `PRE_FIRMA.md`, `.env`, secretos o migraciones en el delta | ninguno |

Los negativos de la Dev:

| Sabotaje | Rojo |
|---|---|
| `regla-solo-en-la-pantalla` | 225: «con dos reservadas: desvincular respondió 200 y no 409», las credenciales cambian y «la vencida quedó reservada» |
| `sin-cierre-pendiente` | 226: «en cierre pendiente: desvincular respondió 200 y no 409» |
| `sin-link-abierto` | 227: «con el link abierto: desvincular respondió 200 y no 409» |
| `vuelta-acepta-otra-cuenta` | 229: «con otra cuenta volvió con «vinculado»» y «las credenciales cambiaron» |
| `pantalla-generica` | 225: «dice «No se pudo desvincular la cuenta.»» y el panel no dice nada, en los dos anchos |
| `otro-vendedor-frena` | 228: con sólo ventas terminadas y una ajena reservada, no desvincula |
| `sin-aviso-en-la-confirmacion` | 225: «la confirmación no avisa lo de las devoluciones», en los dos anchos |

## Decisiones PM sobre el informe

- **Los textos se aceptan como están.** Dicen lo que el código hace y cuándo
  se va a poder. Emi los lee en el parte.
- **Una orden sin link también frena** (punto 2 de la Dev): aceptado. Sin
  cuenta, el reconciliador no la puede cerrar. Quien vende arregla su cuenta o
  espera el vencimiento, hasta unos 50 minutos.
- **El cambio de la confirmación común** se acepta: arregla un contraste que ya
  estaba mal, también en «Vaciar carrito».

## P3, sin tarea

- **Antes de habilitar Mercado Pago, chico:** un pago devuelto o con
  contracargo cuyo link no se pudo apagar queda fuera del criterio y del
  reconciliador, y el link queda abierto (punto 3 de la Dev, leído en el
  código y sin reproducir). Pide dos fallas seguidas al apagarlo. La propuesta
  de la Dev: que el link abierto mire los cuatro estados con cobro.
- **`smoke.mjs` perdió 4 terminadores CRLF** fuera de la zona de la pieza. Se
  restauran en la próxima pieza que toque ese archivo.
- **`sin_vinculo` en el reintento del link quedó sin caso.** El 76 ya no lo
  alcanza desvinculando; se alcanza con una credencial que no abre.
- **El número del 409 se cuenta después de decidir.** Si justo termina una
  venta en el medio, la pantalla podría decir «tenés 0 ventas».
- **La confirmación común no tiene rol de diálogo** (lo dice la Dev).

No se tocó `main`, Railway ni datos reales.
