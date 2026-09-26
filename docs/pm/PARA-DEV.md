# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — USER-GUIDE-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre la parte 2 de ATRIBUTOS-RUBRO-1

**Aceptada en rama** sobre `2a00720`. Evidencia en
`REPRODUCCION-ATRIBUTOS-RUBRO-1-P2-2026-09-26.md`.

- **Casos:** 199 a 204 en 6/6.
- **Negativos:** los seis tuyos dan rojo, y también dos míos:
  - «desde» con `>`;
  - origen en un servicio.
- **Suite completa desde base nueva:** 203/204. Sólo cae el 169, de entorno.
  El 170 pasó 8/8 suelto y también en la suite.
- **Migración en modo producción:** verde.
- **Auditorías:** 80/80, 88/88, 12/12, y la guía coincide.

**Un hueco que encontré:** saqué `Product.model` del buscador y el 199 y el
200 siguieron verdes. Comprobé a mano que la búsqueda por modelo funciona,
pero ninguna prueba la vigila. Va en esta tarea (punto 5).

**El 170:** no lo reproduje. Mi hipótesis es `StrictMode` en desarrollo: la
carga de `/auth/me` corre dos veces y la segunda puede llegar después de
«Salir». Queda como P2 registrado, sin tarea. Si lo volvés a ver, avisame.

Aceptadas tus decisiones: modelo y año atados a `usa_marca`, la página que
sobrevive a «Mercado», cero sin error, y año en UTC.

### Problema y prioridad

`docs/USER_MANUAL.md` no se le puede entregar a la clienta así como está:

- dice «TopGreen / AgroMarket»;
- publica las contraseñas de las cuentas demo;
- describe un Mercado anterior, sin los filtros nuevos ni el Mercado único;
- no tiene la parte de quien transporta.

El repositorio se entrega al final. Lo que queda falta es la guía de uso
para quien compra, vende y transporta, con el mismo rigor que la del panel:
un programa la recorre y falla si miente.

### Qué entra

1. **Reescribir `docs/USER_MANUAL.md` como la guía de uso de AgroBoeda**, en
   español llano, para alguien que no es técnico, con tres partes:
   - **Quien compra:** registrarse y verificar el correo; buscar y filtrar
     (el panel nuevo: tipo, potencia, marca, año, condición, origen,
     ubicación y precio); la ficha; el carrito; pagar por transferencia o por
     Mercado Pago cuando el vendedor lo tiene; «Mis órdenes»; calificar.
   - **Quien vende:** publicar, con qué pide cada rubro (tipo, potencia,
     marca, modelo, año, condición y origen «declarado por quien vende»);
     fotos; editar, pausar y agotado; vender por transferencia (confirmar el
     comprobante); vincular Mercado Pago; la documentación y su distintivo.
   - **Quien transporta:** su perfil, cobertura y cómo lo encuentra quien
     compra.
2. **Sin credenciales.** Ninguna contraseña ni cuenta demo en la guía. El
   acceso local y las cuentas de prueba van en la documentación técnica que ya
   las trata (`RAILWAY.md` o el README), no acá.
3. **Verificada por programa**, como `scripts/guia-admin.mjs`:
   - un recorrido por paso;
   - cada texto entre «» aparece en la pantalla;
   - cada afirmación de resultado está atada a una comprobación;
   - «Lo que el programa no comprueba» al final;
   - escritorio y celular.
4. **Lo que el producto no hace**, dicho arriba de todo, como en la guía del
   panel:
   - la plataforma no cobra ni guarda el dinero de las ventas;
   - la transferencia la confirma quien vende;
   - el origen lo declara quien vende y no se verifica.
5. **Caso nuevo en el smoke:** el modelo se encuentra con el buscador de
   texto. Tiene que ser una publicación cuyo modelo no aparezca ni en el
   nombre ni en la descripción. Negativo: sacar `Product.model` del buscador
   da rojo.

### Fuera de alcance

- Cambiar el producto para que la guía quede más linda. Si la guía encuentra
  un defecto, frená y consultá.
- La guía del panel de administración, que ya existe.
- Traducciones, videos y capturas obligatorias. Las capturas se permiten
  como en la guía del panel.
- Suscripciones y teléfono (PENDIENTE de Emi): no se describen.
- Integración y despliegue.

### Aceptación verificable

1. El script nuevo pasa en escritorio y en celular.
2. Tres negativos del script, cada uno rojo por su motivo:
   - una frase de resultado falsa;
   - un texto «» que no está en la pantalla;
   - un control sin nombrar en la guía.
3. El caso del modelo y su negativo.
4. `grep` sin contraseñas ni cuentas demo en `docs/USER_MANUAL.md`.
5. Suite completa desde base nueva, a11y, contraste, móvil, `guia-admin.mjs`
   y las puertas de siempre.

### Frená y consultá

- Si al escribir un paso encontrás que el producto hace otra cosa que lo que
  la guía tendría que decir.
- Si un flujo necesita correo real (SMTP) para comprobarse: en local se usa
  el outbox, y la guía no promete lo que producción todavía no tiene.

### Entrega en `PARA-PM.md`

- SHA;
- estructura de la guía;
- el script y sus negativos;
- el caso del modelo;
- las puertas;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

Lo decide la PM cuando cierre `USER-GUIDE-1`. Lo que depende de Emi (correo,
cuentas de prueba de Mercado Pago) puede reordenar la cola.
