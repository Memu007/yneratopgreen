# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## DESVINCULAR-CON-COBROS-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `0495b31` (tu respuesta al freno) |
| producto | `bcc8ca5` (la regla y la pantalla) y `a27fc7c` (contraste) |
| casos, negativos, suite y `API_ENDPOINTS.md` | `718ec68`, `ead24f6` y `777bee1` |
| no integrado, no desplegado | `main` sigue en `5d8df5d` |

**Resultado.**

- **Con cobros de Mercado Pago en curso no se desvincula ni se pasa a otra
  cuenta.** Renovar y reconectar la misma cuenta pasan siempre.
  - `unlink` contesta **409** con `detail: {"motivo": "cobros_en_curso",
    "cobros_en_curso": N}` y no toca nada.
  - Si en la vuelta de Mercado Pago viene otra cuenta, vuelve con
    `mp_error=otra_cuenta_con_cobros` y queda la de antes.
- **El criterio vive en `cobro.en_curso`**, en un solo lugar. El
  reconciliador lo usa con el vencimiento agregado.
- **La carrera se achica sin tocar el checkout.** Desvincular y guardar otra
  cuenta deciden y escriben en la misma sentencia. Lo que queda está en
  «Riesgos».
- **La pantalla dice por qué y hasta cuándo**, y la confirmación avisa lo de
  las devoluciones. Los textos están abajo.
- **Sin migraciones.**
- **Suite completa desde base nueva, sobre `777bee1`:** 229/230. Sólo cae
  el 131, el de entorno de siempre (el puente sólo traduce `docker exec`).

**Lo que decidís vos (o Emi):**

1. **Los textos.** Están completos abajo.
2. **Una orden sin link también frena.** Pasa cuando falló la creación del
   link. El reconciliador le pregunta a Mercado Pago antes de mirar si hay
   link, así que sin cuenta no la puede cerrar: entra en «reserva viva», como
   pediste. **La consecuencia:** quien vende no puede pasar a otra cuenta para
   reanudar esa misma orden. Tiene que arreglar la suya, o esperar a que venza
   (hasta unos 50 minutos). Antes el 76 probaba justamente eso, y lo cambié
   (abajo).
3. **Un hueco del criterio que no cambié.** Es un pago devuelto o con
   contracargo cuyo link no se pudo apagar. Hacen falta dos fallas seguidas al
   apagarlo: una al cobrar y otra al llegar la devolución.
   - `link_abierto` mira sólo `APPROVED` y `EN_REVISION`. Esa orden queda
     fuera del criterio y del reconciliador: **el link queda abierto para
     siempre**, y quien vende puede desvincular.
   - Lo leí en el código (`_resumen` deja `REFUNDED` o `CHARGED_BACK`); no lo
     reproduje.
   - **Propuesta:** que `link_abierto` mire los cuatro estados con cobro
     (`CON_COBRO`). No lo hice: cambia qué barre el reconciliador, y no lo
     pediste.

## El criterio

`cobro.en_curso(vencida=None)`: una orden de Mercado Pago con la reserva
viva (reservada o cierre pendiente), o con un pago aprobado o en revisión cuyo
link sigue abierto. Sobre `Order`, con `Payment` por fuera.

- **El vínculo** lo usa por vendedor (`hay_cobros_en_curso`), adentro del
  `UPDATE` que borra o cambia la cuenta.
- **El reconciliador** lo usa con `vencida` (`_candidatas`): a la reserva
  viva le agrega el vencimiento.
- **Cuántas** (`cobros_en_curso`) se cuentan aparte, sólo para decirlo.

**Dónde hace falta el token**, comprobado en el código:

| uso | qué orden | ¿en el criterio? |
|---|---|---|
| crear el link (`mp_preferencia.preparar_pago`) | reservada | sí, reserva viva |
| cancelar o rechazar (`cerrar_cobro`) | reservada | sí |
| el reconciliador (`_una` → `sincronizar`) | sus candidatas, **también sin link** | sí |
| apagar el link cobrado (`apagar_link`) | aprobado o en revisión, link abierto | sí |
| lo mismo, ya devuelto o con contracargo | `REFUNDED`/`CHARGED_BACK`, link abierto | **no** (punto 3 de arriba) |
| el aviso y la vuelta (`procesar_pago`, `sincronizar`) | una orden en curso | sí |
| lo mismo, una novedad posterior | devolución o contracargo de una terminada | no: es tu (a), y lo dice la confirmación |

**Sin cuenta, la vuelta de una orden terminada** dice lo último que se sabía,
«sin verificar». Es parte de la (a).

## Los textos nuevos

**La confirmación de desvincular.** Lo del medio es nuevo:

> Se borran de AgroBoeda las credenciales de tu cuenta.
>
> Si después se devuelve un pago o hay un contracargo, AgroBoeda no se va a
> enterar: la compra va a seguir figurando como pagada.
>
> Para retirarle el permiso a la aplicación también del lado de Mercado Pago,
> hacelo desde tu cuenta.

**El panel, cuando no se puede.** Queda a la vista, en lugar del aviso «No se
pudo desvincular la cuenta.»:

> Todavía no podés desvincular tu cuenta: tenés 1 venta con cobro de Mercado
> Pago en curso, y AgroBoeda necesita tu cuenta para confirmar con Mercado Pago
> cómo termina. Vas a poder desvincularla cuando esa venta se pague, se
> cancele o venza sin pago.

Con más de una: «tenés 2 ventas…», «cómo terminan», «cuando esas ventas se
paguen, se cancelen o venzan sin pago».

**La vuelta de Mercado Pago con otra cuenta:**

> Tenés ventas con cobro de Mercado Pago en curso, y se terminan con la cuenta
> que ya tenías vinculada: sigue vinculada esa. Vas a poder cambiarla cuando
> esas ventas se paguen, se cancelen o venzan sin pago.

**Antes de vincular**, en «Qué pasa cuando la vinculás»: «Podés desvincularla
cuando quieras, salvo mientras tengas ventas con cobro de Mercado Pago en
curso». Antes decía «Podés desvincularla cuando quieras».

**La guía de usuario no cambió:** sólo recorre «Cuenta no vinculada» y
«Vincular Mercado Pago» (paso 14). `API_ENDPOINTS.md` dice el 409 y el motivo
de la vuelta.

**El contraste de la confirmación.** axe encontró, en la confirmación de
desvincular, el título y el botón a 2,28:1: iba el color de texto sobre el
marrón de advertencia. Ahora van en blanco, a 6,94:1 (`a27fc7c`). Es la
confirmación común de tipo «warning», así que también cambia «Vaciar
carrito». El mensaje nuevo del panel va a 12,85:1.

## Casos

| caso | qué mira | con el producto de la base |
|---|---|---|
| 225 | Dos ventas reservadas: 409 con 2 y las credenciales iguales. La pantalla, en escritorio con dos y en celular con una: la confirmación con el aviso, el panel con su texto exacto, sin el genérico y con axe limpio. Vence una con el reconciliador: 409 con 1. La cancela quien compra y desvincula. Antes de vincular dice la condición | rojo, 14 problemas: desvincula, la pantalla no avisa ni explica, y **la vencida queda reservada** porque la vendedora ya no tiene cuenta |
| 226 | Rechazada con el cierre caído: cierre pendiente y 409. El reconciliador la cierra y desvincula | rojo: desvincula |
| 227 | Pago aprobado con el link sin apagar: 409. El reconciliador lo apaga y desvincula | rojo: desvincula |
| 228 | Una cobrada con el link apagado, una cancelada y una vencida: desvincula aunque otra vendedora tenga una reservada. A esa otra, la suya la frena | rojo: a la otra no la frena |
| 229 | Con una reservada, volver con otra cuenta dice `otra_cuenta_con_cobros`, la pantalla lo explica y las credenciales no cambian. La misma cuenta reconecta y renueva. Vencida la venta, pasa a la otra | rojo: se queda con la otra cuenta |
| 230 | La carrera: con el link retenido en el doble, la orden ya está escrita. Desvincular da 409. Después el link sale con la cuenta que sigue vinculada | rojo: **desvincula, y el link sale igual con la cuenta recién borrada**. Es la orden trabada del freno |

Corridos en la suite completa, sobre `777bee1`:

```text
[PASS] 225 … con dos ventas reservadas desvincular da 409 «cobros_en_curso» con 2, y con una, 1; las credenciales no cambian. La confirmación avisa lo de las devoluciones y el panel dice por qué y hasta cuándo, en escritorio y celular. Vencida una por el reconciliador y cancelada la otra, desvincula (10535 ms)
[PASS] 226 … rechazada con el cierre caído queda en cierre pendiente y desvincular da 409 con 1; cuando el reconciliador apaga el link y suelta la mercadería, desvincula (4370 ms)
[PASS] 227 … con el pago aprobado y el link sin apagar, desvincular da 409 con 1; cuando el reconciliador apaga el link, la venta terminó y desvincula (4716 ms)
[PASS] 228 … con una venta cobrada y el link apagado, una cancelada y una vencida, desvincula aunque otra vendedora tenga una venta reservada; a esa otra, su venta sí la frena (409 con 1) (9112 ms)
[PASS] 229 … con una venta reservada, volver con otra cuenta dice «otra_cuenta_con_cobros», la pantalla lo explica y las credenciales no cambian; la misma cuenta reconecta y renueva; vencida la venta, pasa a la otra cuenta (5353 ms)
[PASS] 230 … con la creación del link retenida en Mercado Pago, la orden ya está escrita y reservada, y desvincular da 409 con 1; el link sale después con la cuenta que sigue vinculada (4491 ms)
```

Los rojos de la tabla los medí con la primera versión de los casos
(`718ec68`) contra el producto de `0495b31`. Después el 225 sumó axe y la
espera nueva: sólo agregan controles.

## Negativos

`python3 scripts/sabotajes_desvincular_con_cobros_1.py`, sobre `777bee1`: los
siete dan su rojo en la primera corrida. Dice «todos dieron el rojo esperado»
y «src y backend después: como estaban».

| sabotaje | rojo |
|---|---|
| `regla-solo-en-la-pantalla` (la API desvincula igual) | 225: «desvincular respondió 200 y no 409», con dos y con una |
| `sin-cierre-pendiente` | 226: «en cierre pendiente: desvincular respondió 200 y no 409». Además, «el reconciliador la dejó cierre_pendiente»: usa el mismo criterio |
| `sin-link-abierto` | 227: «con el link abierto: desvincular respondió 200 y no 409». Además, «el reconciliador no apagó el link» |
| `vuelta-acepta-otra-cuenta` | 229: «con otra cuenta volvió con «vinculado»» y «las credenciales cambiaron» |
| `pantalla-generica` | 225: «dice «No se pudo desvincular la cuenta.»» y el panel no dice nada, en los dos anchos. La API sigue bien |
| `otro-vendedor-frena` | 228: «desvincular respondió 409» con sólo ventas terminadas |
| `sin-aviso-en-la-confirmacion` | 225: «la confirmación no avisa lo de las devoluciones», en los dos anchos |

**Un negativo encontró un error del caso.** En la primera corrida,
`pantalla-generica` dio rojo pero no por su motivo: el 225 buscaba el aviso
genérico después de esperar 15 s al panel, y el aviso ya se había ido. Ahora
espera lo primero que aparezca (`777bee1`).

**Aviso de entorno.** Tres negativos dejan desvincular con ventas en curso:
`regla-solo-en-la-pantalla`, `sin-cierre-pendiente` y `sin-link-abierto`.
Cada corrida deja esas ventas trabadas en la base, que es el daño que miden.
Son de vendedoras nuevas de cada corrida y no frenan a ningún otro caso. El
reconciliador las vuelve a mirar en cada barrido y las saltea sin llamar a
Mercado Pago.

## La suite

**Desvincular en la suite.** Los 103 lugares llaman a `desvincular`, y lo
arreglé ahí, una sola vez:

- ante el 409, termina las ventas en curso de esa vendedora por los caminos del
  producto: las reservadas las rechaza ella, y el reconciliador cierra el
  cierre pendiente y el link abierto;
- después vuelve a pedir. Si igual da 409, **el caso falla** por eso, aunque
  la llamada esté en un `finally`;
- usa el doble del caso, y si ya lo cerró, uno propio. Le enseña las
  preferencias que no conoce: Mercado Pago recuerda las que emitió, pero cada
  caso levanta un doble nuevo;
- el resumen dice en qué casos hizo falta. En la última corrida: 75, 76, 77,
  78, 79, 81, 82, 87, 90, 91, 97, 224, 228 y 230. Todos al limpiar, menos el
  77, que a mitad de camino pasa a la cuenta lenta cuando ya terminó con la
  primera orden.

**Dos casos probaban lo que la regla prohíbe:**

- **el 76** desvinculaba con una orden trabada para ver `sin_vinculo`, y
  después pasaba a otra cuenta para reanudarla. Ahora la cuenta rechaza el
  link y después lo acepta (en el doble: `rechazarPreferencias` y
  `aceptarPreferencias`). Desvincular con la orden trabada da 409, y la misma
  orden se reanuda reconectando la misma cuenta;
- **el 92** desvinculaba con la orden en curso para ver `sin_destinatario`.
  Ahora mira el 409, y `sin_destinatario` sale de un aviso de una cuenta que
  nadie tiene vinculada, que pasa por el mismo lugar.

`sin_vinculo` en el reintento del link ya no se alcanza desvinculando. Sigue
en el producto para una orden que quede sin cuenta por la carrera.

## La carrera

**Con evidencia, del 230:**

- con el código de la base, desvincular pasa con el link en camino, y el link
  sale igual con la cuenta recién borrada: la orden queda trabada;
- con el cambio, desde que el checkout escribió la orden, desvincular la ve y
  da 409, aunque Mercado Pago todavía no haya devuelto el link.

**Lo que queda, leído en el código y sin reproducir.** Es la ventana entre que
empieza la sentencia de desvincular y su `commit`, de milisegundos:

- una compra que confirma su orden en ese momento no se ve;
- si lee el token antes del `commit`, crea el link con la cuenta que se
  borra: queda trabada, como antes;
- si lo lee después, no hay link. La orden queda reservada y sin cuenta: el
  reconciliador tampoco la puede cerrar.

En los dos casos se destraba volviendo a vincular la misma cuenta. Con otra
cuenta también se puede vincular, porque ya no hay una guardada con qué
compararla, pero esa no apaga un link de la anterior. La vuelta de Mercado
Pago con otra cuenta tiene la misma ventana.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=225,226,227,228,229,230 node scripts/smoke.mjs
# → 6/6 pasaron; 0 fallaron   (un minuto)

python3 scripts/sabotajes_desvincular_con_cobros_1.py
# → todos dieron el rojo esperado   (unos 3 minutos)
# → src y backend después: como estaban
```

**Tu punto 5** lo hace el 225: con una orden reservada, `unlink` da 409; la
orden vence con el reconciliador y el 409 baja a 1, y cuando la otra termina,
`unlink` pasa. El 226 y el 227 hacen lo mismo con el cierre pendiente y con
el link abierto.

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `777bee1` | 229/230; cae el 131, de entorno |
| lint, `tsc --noEmit`, build | verdes |
| `compileall`, `pip check`, `node --check` | verdes; «No broken requirements found.» |
| `alembic check` | «No new upgrade operations detected.» |
| diff-check con `cr-at-eol` | limpio sobre `0495b31..777bee1` |
| a11y `--todas` | «SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA»: 0 serias o críticas, 0 menores o moderadas |
| contraste | «TODO OK, COBERTURA COMPLETA»: ningún texto bajo el mínimo en las 88 mediciones |
| la pantalla que cambia | el 225 corre axe sobre la confirmación y sobre el panel con el motivo, en los dos anchos: sin nada serio ni crítico |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |

## Riesgos

- **La carrera** (arriba): milisegundos, sin reproducir, y hoy Mercado Pago no
  está habilitado.
- **Una devolución o un contracargo después de desvincular no se registra.**
  Es tu (a), y lo dice la confirmación.
- **El hueco del link abierto de un pago devuelto** (punto 3).
- **Quien vende no puede cambiar de cuenta para reanudar una orden sin link**
  (punto 2).
- **Las órdenes que ya quedaron trabadas**, como las 7 de tu base, siguen
  así: estaba fuera de alcance. Si alguna es de una vendedora que todavía está
  vinculada, ahora le frena desvincular hasta que el reconciliador la cierre.
- **La confirmación común no tiene rol de diálogo.** El 225 la busca por su
  clase. No lo cambié.

---

## DESVINCULAR-CON-COBROS-1: el freno

Respondido en `0495b31`: van la (a) y la (i).

## RECONCILIADOR-PROGRAMADO-1

Aceptada sobre `8170d8b` y publicada por vos en `5d8df5d`. Sin cambios.
