# Transferencia bancaria: ¿está bien resuelta, o es para una 2.0?

Análisis del 2026-07-26, pedido por el dueño del proyecto. La duda era
buena: el circuito depende de que el comprador suba un comprobante, y eso
se sentía frágil.

**Respuesta corta:** la intuición era correcta, el diagnóstico no. Hay un
problema real y grave, pero **no se arregla postergando el módulo a una
2.0: se arregla con tres cambios chicos.** Postergarlo dejaría la
plataforma sin ningún medio de pago funcionando.

---

## 1. El problema real, verificado en el código

No es que el comprobante sea molesto. Es que **hay órdenes que quedan
muertas y nadie las puede sacar de ahí.**

La transferencia agregó dos estados nuevos: *esperando comprobante* y
*comprobante enviado*. Y pasa esto:

| Situación | Qué pasa hoy |
|---|---|
| El comprador transfiere pero **no sube el comprobante** | El vendedor **no puede aprobar**: el sistema exige que exista un comprobante para poder decidir |
| Nadie sube nada y el comprador se arrepiente | **No se puede cancelar.** La cancelación sólo acepta los estados viejos, no los dos nuevos |
| El comprador sube el comprobante y el vendedor no decide nunca | Igual: **tampoco se puede cancelar** |

Resultado: **la orden queda colgada para siempre**, ocupando la lista de
compras del comprador y la de ventas del vendedor, sin ninguna salida
posible desde la aplicación.

Es un error introducido con la función nueva. La cancelación se escribió
antes de que existieran esos dos estados y nadie la actualizó.

**Esto se arregla ahora, no en una 2.0.**

---

## 2. Por qué el módulo no va a una 2.0

Dos razones, y las dos son fuertes.

**Está en el contrato, sección 3.3, textual:** *"el sistema muestra el
CBU/Alias del vendedor, el comprador adjunta el comprobante, y el vendedor
lo valida manualmente"*. Sacarlo es sacar un requisito acordado.

**Y es el único medio de pago que funciona.** Mercado Pago quedó
desmontado —el heredado convertía a la plataforma en administradora de
fondos de terceros— y se reconstruye cuando haya credenciales. Si la
transferencia también se posterga, **la plataforma no tiene ninguna forma
de cobrar**, y eso no es un marketplace.

---

## 3. Qué sí es para una 2.0

La separación correcta no es "transferencia sí o no". Es:

| Etapa | Qué |
|---|---|
| **Ahora** | Mostrar el CBU, dejar constancia del pago, que el vendedor confirme, y que ninguna orden quede colgada |
| **2.0** | Que el sistema **verifique solo** que el dinero entró |

La verificación automática necesita conectarse con un banco o con un
proveedor de pagos. En la Argentina, para un marketplace chico, eso pasa
por un proveedor de todas formas —no hay una conexión bancaria directa
simple—, así que es el mismo trabajo que la integración de pagos. Tiene
sentido cotizarlo junto con eso.

---

## 4. Las otras formas, evaluadas

El dueño preguntó si hay otra manera. Sí, hay cuatro, y ninguna es
gratis.

**a. Sólo mostrar el CBU, sin comprobante.** El vendedor marca la orden
como pagada cuando ve el dinero. Es **más simple y exactamente igual de
confiable**, porque el comprobante no verifica nada. Problema: el contrato
lo pide. Solución: que sea **opcional**, no obligatorio. Ver punto 5.

**b. Que el vendedor use su propio enlace de cobro** de Mercado Pago o
similar. Traslada el problema: cada vendedor tiene que generar y mantener
su enlace, y la plataforma no se enteraría del resultado igual. No mejora
nada.

**c. Integración con proveedor de pagos** para verificación automática. Es
la buena, y es la 2.0. Requiere la cuenta de la clienta y dar de alta a
cada vendedor.

**d. Conexión bancaria directa.** No existe una opción simple para este
tamaño de operación. Descartada.

---

## 5. Las tres mejoras, todas chicas

En orden de valor, no de esfuerzo. Las tres juntas son mucho menos trabajo
que el módulo original.

### 5.1 Referencia de pago en cada orden — la más valiosa

**El problema que nadie planteó todavía:** un vendedor con diez ventas
abiertas mira su resumen bancario y ve diez transferencias. **No tiene cómo
saber cuál corresponde a cuál orden.** Los montos pueden repetirse y el
nombre del titular puede no coincidir con el usuario.

Sin resolver esto, la "validación manual" es adivinar.

**La solución cuesta casi nada:** cada orden ya tiene un número. Mostrarlo
grande en la pantalla de transferencia, con la instrucción de ponerlo como
referencia o concepto de la transferencia. El vendedor lo busca en su
resumen y lo encuentra.

Es el cambio que convierte el circuito de "frágil" a "usable", y es
básicamente un texto en pantalla.

### 5.2 El comprobante pasa a ser opcional

El comprobante **no prueba el pago** —es una imagen falsificable— así que
exigirlo es friccón sin beneficio. Pero sí sirve como constancia de la
conversación, y el contrato lo menciona. Entonces:

- El comprador **puede** subirlo, y se guarda.
- El vendedor **puede confirmar el pago sin él**, si ya vio el dinero en
  su cuenta.

Eso corta la dependencia de que el comprador haga un paso extra, que es
justamente lo que se sentía complicado. El requisito contractual sigue
cumplido: la posibilidad de adjuntar existe.

### 5.3 Ninguna orden queda colgada

- La cancelación tiene que aceptar los dos estados nuevos.
- Que el comprador pueda cancelar mientras nadie confirmó nada.
- Que el vendedor pueda rechazar sin esperar un comprobante.
- **Vencimiento:** si en una cantidad de días nadie confirma, la orden se
  cierra sola y libera el stock. La cantidad de días la define la clienta;
  siete es un valor razonable para empezar.

---

## 6. Lo que tiene que definir la clienta

1. **Si transfieren de menos**, qué prefiere: rechazar y empezar de nuevo,
   permitir completar la diferencia, o registrar saldo pendiente. La
   primera es simple, la última es prácticamente un módulo de cuenta
   corriente.
2. **Cuántos días** espera una orden sin confirmación antes de cerrarse.
3. **Si quiere obligar al comprobante** aunque no sirva para verificar.
   Recomendación: no.

---

## 7. Tareas propuestas para la dev

En este orden. Ninguna toca el esquema salvo la última, y esa apenas.

| # | Tarea | Tamaño |
|---|---|---|
| 1 | Cancelación válida en los dos estados nuevos, para comprador y vendedor | Chica |
| 2 | Referencia de pago visible con instrucción de usarla en la transferencia | Chica |
| 3 | El vendedor puede confirmar o rechazar sin comprobante | Chica |
| 4 | Vencimiento automático con liberación de stock | Media |

**Criterios de aceptación, para las cuatro:**

- Casos nuevos en la suite que cubran cada camino, incluido el de la orden
  que hoy queda colgada. Ese caso tiene que **fallar** contra el código de
  hoy: es la prueba de que el error existía.
- Verificación contra la base, no contra valores fijos.
- El stock liberado tiene que coincidir con el descontado, comprobado por
  consulta.

**Lo que no se hace:** verificación automática del pago, conciliación
bancaria, avisos por correo, y nada de pagos parciales hasta que la clienta
defina el punto 6.1.
