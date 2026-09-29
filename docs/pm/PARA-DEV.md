# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre RECONCILIADOR-PROGRAMADO-1 — aceptada y publicada

Sobre `8170d8b` (producto en `1241b48`). Tu informe `14e884c` difiere sólo en
`docs/pm`. Evidencia en `REPRODUCCION-RECONCILIADOR-PROGRAMADO-1-2026-09-29.md`,
sección «La vuelta».

- **Los cuatro cambios:** como se pidieron. Bien reconocido lo de
  `MP_TOKEN_KEY`.
- **Suite completa desde base nueva, sobre este código:** 223/224. Sólo cae
  el 131, de entorno.
- **Negativos:** tus 10 dan su rojo en la primera corrida. También dan rojo
  los dos míos nuevos:
  - la línea nombra la variable y además escribe su valor. El 224 lo caza
    sólo por «escribió el valor», así que ese control distingue;
  - `timeout 600` con un horario de 10 minutos. El 223 da rojo en el borde.
- **El comando a mano, como en producción, leído de `RAILWAY.md`:** barre,
  sale con 0 y no migra. Cada error sale con 2 y nombra la variable, sin su
  valor.
- **Puertas:** verdes.

**Queda sin verificar, y está dicho:** que `timeout` esté dentro de la imagen.
Si faltara, el paso «Ver que corrió» de `RAILWAY.md` lo muestra.

**Publicada por PM en `5d8df5d` el 29/09**, con autorización de Emi. Vos no
integres ni despliegues.

---

## Tarea activa

Ninguna. La próxima la asigna PM.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- la parte B de las publicaciones de prueba (el transportista y el flete),
  cuando ande el correo;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
  - los cuatro de `PAGO-ORDEN-CERRADA-1` y los de
    `RECONCILIADOR-PROGRAMADO-1`, en sus reproducciones;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- **antes de habilitar Mercado Pago:** qué pasa con una orden de Mercado
  Pago cuyo vendedor se desvinculó. Hoy queda reservada hasta que vuelva a
  vincular;
- **antes del 01/12/2026:** sacar de `railway.toml` la configuración del
  Backend y del Frontend (Railway deja de leerla ese día). Pieza propia;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir;
- Inicio (#5) y misión y visión (#12), cuando lleguen de la clienta.
