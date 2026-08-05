# PM → Dev

Canal de la PM hacia la dev. **Solo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Devolucion del informe `64aa62b`

Informe aceptado. Quedan registradas estas correcciones de la dev:

- la maquina de estados tiene cuatro puertas cerradas, no tres;
- la suite vigente tiene 21 casos y paso desde base limpia, aunque sin el
  runner oficial de Docker;
- el contacto sensible sale por `/orders/my`, no por el detalle;
- Railway es configuracion, no despliegue;
- el perfil de transportista necesita una puerta de alta/edicion propia;
- `Payment` no sirve para suscripciones porque exige `order_id`.

No empieces suscripciones, Transportistas B/C ni cambios de certificacion
en esta pieza.

---

## Tarea activa unica: cerrar la orden de transferencia inmortal

### Problema

Una orden en `AWAITING_TRANSFER_RECEIPT` no puede cancelarse, decidirse ni
moverse por ninguna de las cuatro puertas actuales. Es un defecto de algo
ya entregado y va antes que los modulos nuevos.

### Alcance aprobado

1. Agrega primero un caso permanente que falle contra el codigo actual.
   El informe debe incluir la corrida roja previa y la verde posterior.
2. En `AWAITING_TRANSFER_RECEIPT`, comprador y vendedor pueden cancelar.
3. En `TRANSFER_RECEIPT_SUBMITTED`, el comprador no cancela de forma
   unilateral; el vendedor puede cancelar/rechazar o aprobar.
4. El vendedor puede aprobar o rechazar una transferencia observada en su
   cuenta aunque el comprador no haya adjuntado comprobante. El motivo de
   rechazo sigue siendo obligatorio.
5. La pantalla de transferencia muestra el numero de orden como referencia
   e instruye al comprador a usarlo como concepto del pago.
6. Las transiciones de decision/cancelacion son atomicas: dos solicitudes
   concurrentes no pueden dejar un estado final incompatible ni descontar
   stock dos veces.
7. Cancelar una transferencia no invoca un reembolso de Mercado Pago.
   TopGreen no administra esos fondos; cualquier devolucion se coordina
   entre comprador y vendedor.

### Reglas de estado aprobadas

| Estado | Comprador | Vendedor |
|---|---|---|
| `AWAITING_TRANSFER_RECEIPT` | Cancela | Cancela, aprueba o rechaza |
| `TRANSFER_RECEIPT_SUBMITTED` | No cancela | Cancela, aprueba o rechaza |

La asimetria evita que el comprador cancele mientras el vendedor esta
validando dinero ya acreditado.

### Criterios de aceptacion

1. El nuevo caso reproduce al menos el `400` del comprador y del vendedor
   contra `AWAITING_TRANSFER_RECEIPT` antes del arreglo.
2. Despues del arreglo, API y base coinciden para cada transicion de la
   tabla anterior.
3. Un usuario ajeno recibe `403` y no cambia la orden.
4. Aprobar desde cualquiera de los dos estados descuenta stock exactamente
   una vez; rechazar o cancelar antes de aprobar no lo modifica.
5. La respuesta y la interfaz muestran la misma referencia de orden.
6. Las rutas heredadas de pagos y OAuth siguen en `404`.
7. Los 21 casos existentes y los nuevos quedan verdes. Si no hay Docker,
   declara con precision que se corrio la misma suite y no el runner
   oficial; no uses ambos resultados como equivalentes sin la aclaracion.

### Fuera de alcance de esta pieza

- vencimiento automatico;
- reserva de stock;
- cambios de esquema;
- seed bancario y arreglo de instalacion sin Docker;
- transportistas, contacto y suscripciones;
- Mercado Pago para compras;
- Railway o despliegue.

Vencimiento y reserva se diseñan juntos despues: hoy el checkout verifica
stock pero no lo reserva, por lo que hablar de "liberarlo" seria falso.

### Frena y responde si

- la atomicidad exige una migracion o una reescritura amplia;
- el flujo obliga a reactivar `payments` o `mp_oauth`;
- una cancelacion intenta procesar fondos de terceros;
- un caso anterior deja de pasar.

### Entrega

Una sola pieza, un commit de producto y un informe en `PARA-PM.md` con:

- archivos cambiados;
- corrida roja anterior;
- corrida verde posterior;
- salida completa de la suite;
- verificacion SQL de estado y stock;
- decisiones no tomadas;
- riesgos restantes.

---

## Guardia de cronograma

Estamos en semana 2. Esta tarea no cambia el cierre contractual de la Fase
1 el 09/08. La siguiente pieza sera cerrar el flujo UX/UI de logistica.

Las puertas por fase estan en `CRONOGRAMA.md` y los limites funcionales en
`ALCANCE-Y-LIMITES.md`. Si una solucion excede esos limites, frena antes de
construirla.

