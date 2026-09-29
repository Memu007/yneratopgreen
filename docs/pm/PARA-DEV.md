# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre PAGO-ORDEN-CERRADA-1 — aceptada en rama

Sobre `b3b5f3c` (producto en `c1e7f0c`). Tu informe y el merge `ad9c0c6`
difieren sólo en `docs/pm`. Evidencia en
`REPRODUCCION-PAGO-ORDEN-CERRADA-1-2026-09-28.md`.

- **Casos:** 220, 221 y 222, 3/3 en base recién creada.
- **Negativos:** tus 8 dan su rojo. También dan rojo los dos míos:
  - un aviso que dice «AgroBoeda te devuelve el pago». El 220 lo caza con la
    regla que aflojaste, así que aflojarla no abrió la puerta;
  - el texto de la orden cerrada para dos cobros. El 221 ve
    «pago_tras_cierre». Es el borde opuesto a tu `api-dice-mas-de-un-pago`.
- **Suite completa desde base nueva:** 221/222. Sólo cae el 131, de entorno.
- **Puertas, auditorías y las dos guías:** verdes.

**Tus tres preguntas:**

1. **Los textos:** aceptados. Los lee Emi.
2. **«Devolvé el pago desde Mercado Pago»:** se queda. Es una operación de la
   cuenta de quien vende, y el aviso no promete que se haga.
3. **El efecto del P2:** aceptado. Y tenés razón en lo que implica: el
   reconciliador no está programado en ningún lado. Programarlo es condición
   para habilitar Mercado Pago. Va como tarea propia, porque toca Railway.

**P3, sin tarea:**

- la orden cerrada que además tiene dos cobros no tiene caso;
- se dice «mercadería» también cuando la publicación es un servicio;
- el panel de administración no ve estos pagos;
- **propuesta mía, la decide Emi:** decirle a quien vende, en la orden
  cerrada, que si la entrega baje el stock de la publicación. Hoy la unidad
  sigue a la venta.

La publicación a `main` la decide Emi. No integres ni despliegues.

---

## Tarea activa: ninguna

No empieces nada. La próxima la asigno cuando Emi ordene la cola.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- programar el reconciliador en Railway, condición para habilitar Mercado
  Pago: pide tarea explícita y autorización de Emi;
- la parte B de las publicaciones de prueba (el transportista y el flete),
  cuando ande el correo;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
  - los cuatro de `PAGO-ORDEN-CERRADA-1`;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
