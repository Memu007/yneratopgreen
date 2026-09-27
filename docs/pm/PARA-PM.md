# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## NOTIF-TEXTOS-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `4a69064` (tu asignación) |
| código | `3e806de` |
| casos y negativos | `e912d8f` |
| no integrado, no desplegado | `main` sigue en `c92c0d7` |

**Resultado.**

- **Ninguna notificación promete dinero, envíos ni avisos.** El rechazo ya no
  dice «El monto total será reembolsado.»; el envío ya no dice «Te avisaremos
  cuando llegue.»; la confirmación ya no dice «Pronto será enviado.».
- **Todas usan el «vos».** Salieron «Procede» y «Tienes».
- **La bienvenida** ya no dice «marketplace» ni «productos agrícolas».
- **Los dos próximos pasos que nombran existen** en «Mis Compras», y el caso
  los busca: cómo pagar y «Confirmar Recepción».
- **El comentario de Quiénes somos** dice sólo «salió por ahora (la clienta,
  20/09)».
- **El 79 corre solo** sobre una base recién creada.
- **Las guías no citan ninguna notificación**, así que no cambiaron.

**Una pregunta, no bloqueante.** Está abajo, en «Para decidir». Entregué la
opción A.

## Los textos

Cambiaron seis:

| notificación | a quién | antes | después | por qué |
|---|---|---|---|---|
| Pedido realizado | quien compra | «Tu pedido #N fue creado exitosamente. Procede al pago para continuar.» | «Tu pedido #N fue creado y está pendiente de pago. En Mis Compras tenés cómo pagarlo.» | «Procede» es «tú». El paso existe: Mis Compras muestra la cuenta y «Enviar comprobante» por transferencia, o «Continuar pago» («Preparar pago» si el link no está) por Mercado Pago |
| Nueva venta recibida | quien vende | «Tienes un nuevo pedido #N pendiente de pago.» | «Tenés un nuevo pedido #N pendiente de pago.» | «Tienes». El título queda: Mis Ventas ya llama «Venta #N» a esa orden |
| Pedido confirmado | quien compra | «El vendedor confirmó tu pedido #N. Pronto será enviado.» | «El vendedor confirmó tu pedido #N.» | Prometía un envío y un plazo que el producto no controla. En un servicio o un retiro no se envía nada |
| Pedido enviado | quien compra | «Tu pedido #N está en camino. Te avisaremos cuando llegue.» | «El vendedor marcó tu pedido #N como enviado. Cuando lo recibas, confirmá la recepción en Mis Compras.» | Nadie avisa la llegada: la confirma quien compra, con «Confirmar Recepción». Y el producto no sabe si está «en camino»; sabe que quien vende lo marcó |
| Pedido rechazado | quien compra | «El vendedor rechazó tu pedido #N. El monto total será reembolsado.» | «El vendedor rechazó tu pedido #N.» | AgroBoeda no tiene ese dinero y no reembolsa nada |
| Bienvenida | quien se registra | «¡Bienvenido a AgroBoeda!» y «Hola X, tu cuenta fue creada exitosamente. Explorá el marketplace y comenzá a comprar o vender productos agrícolas.» | «¡Bienvenido/a a AgroBoeda!» y «Hola X, tu cuenta fue creada. En el Mercado podés publicar un equipo, un insumo o un servicio, o buscar lo que necesitás.» | La devolución #1 pidió «agropecuario». La frase nueva es la de Quiénes somos. «Bienvenido/a» es la forma del ingreso («¡Bienvenido/a de nuevo!») |

Quedan como estaban, porque son ciertas y el caso también las lee:

- quien compra: «Tu pedido #N fue marcado como entregado. ¡Gracias por tu
  compra!» y «Tu pedido #N fue cancelado.»;
- quien vende: «El comprador confirmó la recepción del pedido #N. ¡Venta
  completada!» y «El comprador canceló el pedido #N.».

Hay una que nadie ve: «Pago aprobado» y «¡Venta confirmada!». Ninguna parte
del producto la manda. Tiene «tú» («Por favor confirma y envía el pedido»).
No la toqué, porque ningún caso puede dispararla. Si se conecta con el cobro
confirmado, hay que reescribirla.

## Para decidir (no bloqueante)

**¿Qué lee quien compra sobre su dinero cuando se cae un pedido que ya pagó
por transferencia?**

- **Por Mercado Pago no pasa.** Una orden cobrada no se rechaza ni se cancela:
  responde 409 (caso 96).
- **Por transferencia sí pasa.** Después de «Aprobar comprobante», quien vende
  puede «Rechazar» o «Cancelar Venta», y quien compra puede «Cancelar
  Pedido».
  - El dinero está en la cuenta de quien vende.
  - La guía ya le dice a quien vende (paso 18): «la devolución la arreglás
    directamente con quien compró».

Opciones:

- **A, la que entregué.** El aviso dice sólo que el pedido fue rechazado o
  cancelado. No promete nada, pero quien pagó no sabe qué hacer.
- **B.** Sólo si la orden estaba pagada, agregar «Si ya transferiste, el
  reintegro lo arreglás directamente con el vendedor. AgroBoeda no tiene ese
  dinero.». Hoy, en una orden rechazada, Mis Compras no muestra el contacto de
  quien vende. Ese paso no tiene camino en el producto hasta que se decida qué
  datos de contacto ve cada persona, que está pendiente de Emi.

**Recomiendo A ahora, y B junto con la decisión sobre los datos de
contacto.**

## Caso y negativos

| caso | qué mira |
|---|---|
| 210 | Dispara todas las notificaciones que el producto manda, con dos cuentas nuevas y cinco órdenes por transferencia: una recibida, una enviada, una rechazada después de pagar, una cancelada por quien compra y una sin pagar. Las lee en la API (exactas, ni una de más ni de menos) y en la pestaña «Notificaciones», en escritorio y en celular. Ninguna puede decir reembolso, devolución, porcentaje, «avisaremos», «en camino», «pronto será», «comisión», «marketplace», «agrícola» ni formas del «tú». Además, en «Mis Compras», la orden sin pagar tiene que ofrecer «Enviar comprobante» y la enviada, «Confirmar Recepción» |

**Contra el código de antes** (`4a69064`), el 210 encuentra 105 problemas: los
seis textos, en la API y en los dos anchos.

`python3 scripts/sabotajes_notif_textos_1.py` → «todos dieron el rojo esperado» y «src y backend después: como estaban»

| sabotaje | rojo del 210 |
|---|---|
| `reembolso-de-vuelta` | 7 problemas: «promete un reembolso» en la API y en la pestaña de los dos anchos, más el texto esperado que falta; nada de quien vende, del «tú» ni de los avisos |
| `tuteo-de-vuelta` | 27 problemas, todos de quien vende: «trata de «tú»» en la API y en los dos anchos, y las cinco ventas que no dicen «Tenés»; nada de quien compra |
| `aviso-de-vuelta` | 12 problemas, todos del envío: «promete un aviso que no existe» en la API y en los dos anchos, y los dos avisos de envío que no dicen el paso; nada de reembolso ni de «tú» |
| `sin-confirmar-recepcion` | 2 problemas: «el pedido enviado no ofrece «Confirmar Recepción» en Mis Compras», en escritorio y en celular; nada de la API |

## El caso 79

**Causa.** El ayudante que publica leía la localidad que deja el caso 5, y
el caso publicaba con la sesión de vendedor que dejan los casos anteriores.
Suelto, no tenía ninguna de las dos.

**Arreglo.**

- Si no hay caso 5, el ayudante usa una localidad del padrón. Ahí se mide
  dinero, no ubicación.
- El 79 publica con el token de la cuenta que vinculó, que es la misma
  (`vendedor@ejemplo.com`).

En la suite no cambia nada.

Sobre una base recién creada: `SMOKE_CASOS=79` → «1/1 pasaron; 0 fallaron». Antes del arreglo, en la misma base, fallaba con «Cannot read properties of undefined (reading 'localityId')».

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
./scripts/entorno_nativo.sh --recrear && SMOKE_CASOS=79 node scripts/smoke.mjs
# → 1/1 pasaron; 0 fallaron

SMOKE_CASOS=210 node scripts/smoke.mjs
# → 1/1 pasaron; 0 fallaron

python3 scripts/sabotajes_notif_textos_1.py
# → todos dieron el rojo esperado
# → src y backend después: como estaban
```

Aviso de entorno: tres de los cuatro sabotajes cambian la API y la
reinician con `./scripts/entorno_nativo.sh --reiniciar-api`, antes y después.
En el entorno Docker, ese paso es el que reinicia el contenedor
`topgreen-api`.

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `e912d8f` | **209/210**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 79, el 96 y el 210 |
| tipos, lint, build | verdes (`npm run build` incluye `tsc`; lint sin avisos) |
| `compileall`, `node --check`, parseo de Python | verdes (26 scripts de Python) |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` y finales de línea | limpios sobre `4a69064..e912d8f` |
| a11y `--todas` | 80 de 80 pantallas, 0 violaciones |
| contraste | 88 de 88, ninguna por debajo del mínimo |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |

## Riesgos y visto de paso

- **P3.** 15 mensajes de error de la API tratan de «tú» («No tienes
  permiso…», «No puedes desactivar tu propia cuenta»). Al menos el último se
  ve en el panel, y la guía de admin lo cita en el paso 8. No son
  notificaciones y no los toqué. Te recomiendo una tarea chica aparte.
- **Fuera de alcance, porque es cuándo se manda:**
  - «Rechazar comprobante» deja la orden «Rechazado» sin avisarle a quien
    compra;
  - aprobar un pago, por transferencia o por Mercado Pago, no le avisa a
    nadie.
- **Comentarios que citan a la clienta.**
  - En la invitación de Quiénes somos, el comentario le atribuía también «las
    mejores soluciones tecnológicas». Ahora cita sólo lo que ella nombró en la
    #14.
  - En `notifications.py` decía «el tema de la comisión no se anticipa».
    Ahora dice «cómo se explica la comisión está por decidir», que es lo que
    ella dijo.

---

## PUBLISH-FIELDS-1 y REV1-PENDIENTES-1

Aceptadas en `4a69064`. Sin cambios.
