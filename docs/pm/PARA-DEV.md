# PM → Dev

Canal de la PM hacia la dev. **Solo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Entrega `d105849`: aceptada

Queda aceptado el commit de producto `0039e00`, que cierra la orden de
transferencia inmortal.

La PM verifico directamente:

- las reglas asimetricas de cancelacion y decision aprobadas;
- el bloqueo de fila que evita descontar stock dos veces;
- que las transferencias no llamen al reembolso de Mercado Pago;
- la referencia de pago y las acciones nuevas en la interfaz;
- `npm run build` en verde y el backend compilando.

La dev aporto rojo previo y **25/25** en verde desde base limpia con la misma
suite, ejecutada sin el runner oficial. Docker tampoco esta disponible en el
entorno de la PM. Repetir el runner oficial queda como puerta de Fase 5, no
bloquea esta aceptacion.

La dependencia residual de `orders.py` con el modulo heredado de reembolsos se
registra para la reconstruccion de pagos en Fase 4. **No se abre ahora.**

---

## Tarea activa unica: cerrar el flujo UX/UI de logistica

### Objetivo

Cerrar la puerta de **Diseño y UX/UI de la Fase 1 antes del 20/08** con un
prototipo web navegable del recorrido logistico. Esta pieza define pantallas,
estados, informacion y navegacion. La busqueda real con PostGIS y la inclusion
del transportista en la orden pertenecen a la Fase 3.

### Forma de entrega

Construir un prototipo web aislado de la aplicacion productiva, versionado en
`docs/ux/logistica/`. Debe abrirse localmente sin API ni base de datos y usar
datos ficticios claramente identificados.

- Reusar la identidad visual, componentes y lenguaje de TopGreen.
- No redisenar la marca ni el resto del marketplace.
- No agregar dependencias si HTML, CSS y JavaScript alcanzan.
- No tocar `backend/`, migraciones, modelos, endpoints ni el flujo productivo
  de `src/` en esta pieza.

### Recorrido que debe quedar navegable

#### Comprador

1. En el checkout elige entre **“Necesito flete”** y **“Coordino el traslado
   por mi cuenta”**.
2. La seleccion de flete es **por vendedor/orden**, no por carrito completo.
   El prototipo debe dejar claro que un carrito con dos vendedores puede
   requerir dos elecciones distintas.
3. El origen viene de la localidad de la publicacion/vendedor. El destino se
   precarga con la localidad del comprador y puede cambiarse desde una lista
   estructurada.
4. La busqueda muestra estados de carga, resultados, vacio y error.
5. Antes de seleccionar, cada tarjeta muestra nombre comercial, localidad
   base, cobertura, transporte declarado, capacidad y declaracion de
   habilitacion. **No muestra telefono, correo ni direccion exacta.**
6. La tarjeta explica que cubre origen y destino y que la distancia es en
   linea recta. No muestra rutas, mapas, tarifa ni tiempo estimado.
7. Al seleccionar un transportista aparece el contacto declarado y se lo
   incorpora al resumen de esa orden. El comprador puede cambiarlo o quitarlo.
8. El flujo vuelve al checkout y continua al pago sin convertir el flete en
   un producto ni agregar un precio automatico.
9. En “Mis compras” se ve el transportista elegido y su contacto.

#### Transportista

10. Perfil de alta/edicion con localidad base, transporte, capacidad, radio y
    declaracion de habilitacion con detalle y fecha.
11. Vista de una operacion en la que fue seleccionado: origen, destino y
    necesidad logistica. No expone precios de productos, comprobantes, CBU,
    alias ni datos financieros.

#### Vendedor

12. Resumen de venta con el transportista seleccionado y el tramo a coordinar,
    sin nuevas acciones logisticas ni estados de cotizacion.

### Textos que no pueden inducir a error

- “Declarado por el transportista el [fecha]. TopGreen no verifica esta
  habilitacion.”
- “Distancias estimadas en linea recta.”
- “La coordinacion y el precio del flete se acuerdan directamente.”

No usar “certificado por TopGreen”, “tarifa calculada”, “ruta optima” ni
“entrega garantizada”.

### Criterios de aceptacion

1. Se puede recorrer con clics todo el camino comprador → seleccion → resumen
   → pago, y volver para cambiar o quitar la seleccion.
2. Se pueden abrir tambien las vistas de transportista y vendedor sin editar
   la URL manualmente.
3. Los cuatro estados de busqueda —carga, resultados, vacio y error— son
   visibles mediante controles del prototipo.
4. Los datos de contacto permanecen ocultos antes de seleccionar y aparecen
   despues.
5. El prototipo representa una compra con dos vendedores y deja la seleccion
   asociada a cada orden.
6. Escritorio 1440×900 y movil 390×844 sin desborde horizontal, con controles
   tactiles de al menos 44 px.
7. Navegacion por teclado, foco visible, etiquetas y contraste legible.
8. `npm run build` sigue verde y `git diff --check` no agrega ruido de formato.
9. La entrega incluye capturas de ambos tamanos y un informe en
   `PARA-PM.md` con decisiones no tomadas y puntos que la PM deba revisar.

### Fuera de alcance

- consultas PostGIS, endpoints, persistencia o migraciones;
- mapas, ruteo, GPS, distancia por caminos o seguimiento;
- cotizacion, tarifa, peso/volumen automatico o pago del flete;
- Carta de Porte, ARCA o verificacion contra organismos;
- mensajeria, suscripciones, planes o candados premium;
- Mercado Pago, transferencia bancaria y Railway;
- cambios visuales generales del marketplace.

### Frena y responde si

- el prototipo exige cambiar el esquema o la API actual;
- no se puede representar un transportista por orden sin inventar una regla
  comercial nueva;
- una pantalla necesita revelar contacto antes de la seleccion;
- aparece una dependencia nueva o una reescritura del frontend productivo.

---

## Guardia de cronograma

La semana 1 comienza el **viernes 07/08** y la Fase 1 termina el **jueves
20/08**. Esta es la unica pieza activa. No abras la implementacion real de
Piezas B/C, validacion por correo, pagos, suscripciones ni despliegue.
