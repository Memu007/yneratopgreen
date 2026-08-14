# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-14. Sexto informe: **MP-D, la homologación preparada**.

Empiezo por el freno, porque cambia cómo leer todo lo demás.

## 1. La pasada documental no la pude hacer, y no la voy a simular

La primera mitad de MP-D era contrastar el código aceptado contra la
documentación oficial vigente, en los contratos que el doble no puede probar. No
pude: **la salida de red hacia Mercado Pago está bloqueada por política del
entorno**, y no en un dominio sino en todos los que probé.

```
https://www.mercadopago.com.ar   bloqueado por el proxy de egress
https://api.mercadopago.com      sin respuesta
https://www.mercadopago.com.br   sin respuesta
https://www.mercadopago.com.mx   sin respuesta
https://www.mercadopago.cl       sin respuesta
```

El propio manual del proxy dice qué corresponde hacer: *«never disable TLS
verification, never unset HTTPS_PROXY, and do not retry organization policy
denials — report them instead»*. Es además la regla que ya tenemos con Emi: una
política de seguridad del entorno no se rodea —ni con otro navegador, ni con un
túnel, ni con un espejo—; se informa. Así que se informa.

Lo que **no** hice, y quiero que quede dicho porque era la salida fácil: buscar
la misma documentación en un dominio que el proxy todavía no bloquee, o citar de
memoria. Vos pediste fuente oficial **con fecha** para toda afirmación sobre la
API real. Una cita de memoria disfrazada de fuente es peor que no tener la
fuente, porque parece verificada.

Sí funciona el buscador web, y devuelve resúmenes de terceros sobre esos mismos
documentos. No los uso como fuente: no son oficiales y no tienen fecha.

### Lo que queda pendiente de verificar, en forma de preguntas cerradas

Esto es lo que hay que mirar apenas haya acceso —o lo puede mirar cualquiera con
un navegador—. Están escritas para responderse con un sí o un no y una cita.

1. **Firma del Webhook.** ¿El manifiesto es exactamente
   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`? ¿Se omite entera la parte
   cuyo campo no viene? ¿El `data.id` alfanumérico va en minúsculas? ¿El `ts` es
   en segundos o milisegundos?
2. **`source_news=webhooks`.** ¿Es el parámetro vigente y va en la
   `notification_url` de la preferencia? ¿Hace falta además declarar la URL en
   el panel de la aplicación?
3. **Campos reales de `/v1/payments/{id}`.** ¿Existe `preference_id` en la
   respuesta? Hoy lo comparo **sólo si viene**, y la atadura fuerte es el
   `orden_id` de la metadata. ¿`collector_id` viene siempre en el nivel de
   arriba o a veces sólo dentro de `collector`?
4. **Cierre de preferencia.** ¿`PUT /checkout/preferences/{id}` con `expires` y
   una fecha pasada sigue siendo la forma oficial de apagar un link emitido?
   ¿Devuelve algún error propio si ya venció?
5. **Estados y tipos.** ¿La lista de estados de pago sigue siendo la que trato
   —`pending`, `in_process`, `authorized`, `in_mediation`, `approved`,
   `rejected`, `cancelled`, `expired`, `refunded`, `charged_back`—? ¿Hay alguno
   nuevo? ¿`excluded_payment_types` con `ticket` y `atm` sigue siendo la forma
   de excluir efectivo y cajero?
6. **OAuth de cuenta de prueba.** ¿Una cuenta de prueba puede autorizar la
   aplicación por OAuth como un vendedor real, o hay diferencias?

Ninguna de las seis se puede responder desde acá, y ninguna la voy a responder a
ojo.

## 2. Lo que sí entregué

La segunda mitad de MP-D no depende de la documentación: depende del código
aceptado y de lo que se puede probar localmente. Está en
`docs/homologacion-mercadopago.md`, y es un documento para que lo siga una
persona en orden, sin leer código.

Lo puse en un archivo del repositorio y no acá adentro por una razón: este
archivo lo reemplazo entero en cada informe, y un runbook que Emi va a seguir
paso a paso no puede vivir en algo que se borra en el ciclo siguiente. Si
preferís que viva sólo acá, se mueve.

Tiene los cinco puntos que pediste:

1. **Checklist de cuentas, aplicación y secretos**, con qué produce cada cosa y
   dónde termina el valor. Ninguna contraseña ni token pasa por mí ni por Git.
2. **Variables y URLs exactas**, sacadas del código y no de mi memoria:
   `{API}/api/mp-oauth/callback`, `{API}/api/mp/webhook` y los tres retornos en
   `{FRONT}/payment/…`. La bandera arranca y termina apagada, y durante la
   homologación se enciende en un solo paso del guion.
3. **Comando único del reconciliador**, frecuencia propuesta con el número que
   la justifica, y la prueba de solapamiento.
4. **Guion de punta a punta**, diecisiete pasos con qué mirar en cada uno.
5. **Criterio de rollback**: qué se apaga, qué se sigue aceptando y qué no hay
   que hacer.

## 3. La prueba de solapamiento, y lo que muestra de más

Pediste prueba de que dos ejecuciones solapadas no duplican efectos. Es el caso
**100**, y son **dos procesos en paralelo**, no dos llamadas seguidas: una orden
abandonada y vencida —hay que cancelarla y devolver su unidad— y una cobrada sin
aviso —hay que procesarla—, cada una sobre una publicación distinta para poder
atribuir cada efecto.

```
corrida A   {"cobrada":1, "en_curso":1, "vencida":1}
corrida B   {"cobrada":1, "en_curso":1, "liberada":1}
```

Mirá los dos resúmenes antes de leer la conclusión: **las dos corridas informan
haber actuado sobre las mismas dos órdenes**. Y sin embargo hubo exactamente una
cancelación, una unidad devuelta, un descuento de stock, una venta contada y una
sola fila de intento.

No es contradicción, es el diseño, y prefiero decirlo yo antes de que lo piques:
lo que garantiza «una sola vez» no es que el barrido corra una sola vez —eso no
se puede garantizar— sino el `UPDATE ... WHERE` condicional sobre la marca de
reserva, que la base serializa. El que gana la fila aplica el efecto; el que la
pierde no hace nada y **lo informa igual**. El resumen registra lo que cada
corrida miró, no lo que movió. Quien lea esos números en producción tiene que
saberlo, así que está escrito también en el runbook.

Una tercera corrida posterior no mueve nada.

## 4. Código

**Ninguno de producto.** No encontré un hueco que la documentación o una prueba
local demostrara, y sin la documentación no voy a inventar uno. Lo único que
agregué es el caso 100 y un ayudante de la suite para pedir dos publicaciones
distintas del mismo vendedor.

Ese ayudante salió de una falla mía: la primera versión del caso usaba el mismo
producto para las dos órdenes, y ahí una liberación y una consolidación se
compensan en el total reservado —de 2 a 0— así que la prueba no podía distinguir
«cada efecto una vez» de «dos efectos cruzados». Con publicaciones distintas cada
efecto es atribuible.

## 5. Puertas

| Puerta | Resultado |
|---|---|
| Suite completa | **100 de 100**, 0 fallas |
| `git diff --check` (con `cr-at-eol`) | limpio |

No corrí hito, build, accesibilidad ni contraste: no hay cambio de producto ni
de DOM en esta entrega. Si querés las cuatro igual, las corro.

## 6. Dónde frena esto

Frena en el punto exacto que pediste: **la homologación necesita acciones de Emi
que yo no puedo ni debo hacer** —crear la aplicación, las dos cuentas de prueba,
obtener el secreto de firma y cargar las variables en el Railway descartable—, y
además necesita una verificación documental que este entorno no permite hacer.

No abrí despliegue, no toqué Railway, la bandera sigue en `false` y no hay una
sola credencial inventada en el repositorio.

Lo que necesito para seguir, en orden de bloqueo:

1. que se destrabe el acceso a la documentación oficial, o que alguien responda
   las seis preguntas de la sección 1 con cita y fecha;
2. que Emi cree lo de la sección 1 del runbook y cargue las variables;
3. una orden explícita para ejecutar la homologación, que hoy no tengo.
