# PM → Dev

Canal de la PM hacia la dev. **Solo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-08-06 — Entrega `f7fd2a2`: rechazada por un único hueco

Las cinco correcciones pedidas por Sol están bien resueltas. No se reabre
ninguna.

La entrega todavía no cierra la puerta de Fase 1 porque el destino es editable
pero la búsqueda no depende de él. Verificado en
`docs/ux/logistica/prototipo.js`:

- al cambiar `busqueda-destino` solo cambia `pedido.destino`;
- `pedido.candidatos` sigue fijo;
- `aOrigen` y `aDestino` viven fijos en cada transportista;
- una selección previa queda elegida aunque cambie el tramo.

Así la interfaz puede afirmar que un transportista cubre ambas puntas usando
distancias de otro destino. También puede conservar y mostrar su contacto para
un viaje que el comprador ya cambió.

---

## Tarea activa única: hacer coherente el destino editable

Corregí solamente el prototipo aislado de `docs/ux/logistica/`.

### Comportamiento obligatorio

1. **La búsqueda usa el tramo actual.** Los candidatos visibles y las dos
   distancias mostradas tienen que corresponder al origen del pedido y al
   destino seleccionado en ese momento.
2. **La regla de elegibilidad se cumple en los datos del prototipo.** Un
   transportista aparece solo si la distancia de su base al origen y la
   distancia de su base al destino son ambas menores o iguales a su radio
   declarado.
3. **Cambiar el destino invalida siempre la selección previa de ese pedido.**
   Después del cambio queda `necesitaFlete = true` y `elegido = null`, aunque
   el mismo transportista pudiera cubrir el nuevo tramo. El comprador tiene
   que volver a seleccionarlo de forma explícita.
4. **No queda contacto viejo visible.** Al cambiar el destino desaparecen el
   contacto, el estado de elegido y cualquier resumen asociado a la selección
   anterior.
5. **El checkout vuelve a considerar incompleto ese pedido** hasta que el
   comprador elija un transportista para el nuevo tramo o marque “Coordino por
   mi cuenta”.
6. El contador de resultados, las tarjetas, la frase de cobertura y el estado
   vacío tienen que salir del mismo conjunto coherente; no se admiten
   candidatos o kilómetros escritos para un destino distinto.

La implementación interna es decisión tuya. Puede ser una matriz de datos
ficticios por tramo o coordenadas ficticias con cálculo local, siempre que sea
pequeña, legible y verificable. No agregues dependencias.

### Escenario mínimo que tiene que quedar demostrado

1. Abrir el pedido A con destino Venado Tuerto.
2. Seleccionar un transportista y comprobar que aparece su contacto.
3. Cambiar el destino a otra localidad.
4. Comprobar que la selección y el contacto desaparecen.
5. Volver al checkout y comprobar que `Continuar` bloquea el avance por ese
   pedido.
6. Volver a buscar y comprobar que candidatos y ambas distancias corresponden
   al nuevo destino.

Además, recorré **todos los destinos disponibles para los pedidos A y B**.
Para cada combinación reportá una tabla con origen, destino, candidatos
visibles, distancia a origen, distancia a destino y radio. La propia tabla
debe permitir comprobar que ninguna distancia visible supera el radio.

### Criterios de aceptación

1. Ningún destino disponible muestra una tarjeta incompatible con la regla de
   las dos puntas.
2. Las etiquetas de destino y las distancias cambian juntas; no queda ningún
   valor del tramo anterior.
3. Cambiar destino invalida siempre la selección y oculta el contacto.
4. El pedido queda incompleto y el bloqueo del checkout sigue funcionando.
5. Vacío, error y “Coordino por mi cuenta” conservan el comportamiento ya
   aceptado.
6. Se mantienen las cinco correcciones de `f7fd2a2`, incluido contraste:
   4,5:1 mínimo para texto normal, foco visible y controles de 44 px.
7. Verificación real en 1440×900 y 390×844 de las vistas afectadas, sin
   desborde horizontal ni errores de consola.
8. `node --check docs/ux/logistica/prototipo.js`, `npm run build` y
   `git diff --check` en verde.

### Fuera de alcance

- No tocar `src/`, `backend/`, migraciones, API ni base de datos.
- No implementar PostGIS, `locality_id` de destino ni las Piezas B/C.
- No iniciar Fase 2 ni Fase 3.
- No agregar dependencias.
- No corregir todavía el gradiente de `src/index.css`: queda como pieza
  chica separada después de aceptar este prototipo.
- No tocar el reembolso heredado: sigue reservado para Fase 4.

Si para cumplir necesitás salir de esos límites, frená y explicalo en
`PARA-PM.md`. Si no, corregí, verificá, subí el commit de código y después
un commit separado con el informe.

---

## Orden después de esta entrega

1. La PM revisa y acepta o rechaza la corrección.
2. Si pasa, se registra el cierre de la puerta de Fase 1.
3. Recién después se abre la pieza chica del contraste productivo.
4. Hasta el 20/08 no se adelanta implementación de Fase 2 o 3.
