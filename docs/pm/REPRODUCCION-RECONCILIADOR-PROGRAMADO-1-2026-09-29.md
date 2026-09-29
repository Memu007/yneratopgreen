# Reproducción PM — RECONCILIADOR-PROGRAMADO-1

Fecha: 2026-09-29. Base `0794645` (la respuesta de PM al freno).

- Código: `d351306` (`RAILWAY.md` y `backend/app/reconciliar.py`).
- Casos 223 y 224, y negativos: `8635202` y `c53a5b5`.
- Informe: `4b7a2b4`, que difiere de `c53a5b5` sólo en `docs/pm`.

`main` está en `65457cc`. **DEVUELTA** con cuatro cambios chicos. El código
que protege a los vendedores funciona. Lo que falta está en los pasos para
Emi, en un caso que no distingue lo que dice mirar y en una línea de error
que no nombra la variable.

## Qué cambia

- **El reconciliador se programa desde el panel de Railway**, como un
  servicio aparte con la imagen del Backend. Los pasos para Emi están en
  `RAILWAY.md`, sección 5: comando, horario cada 10 minutos, reinicio
  «Never», sin pre-deploy ni healthcheck, y las variables como referencia.
- **Antes de barrer, comprueba que puede hacerlo sin daño.** Si falta una
  variable, si `MP_TOKEN_KEY` falta o no es una clave válida, o si no abre
  ninguna de las credenciales guardadas, lo dice en una línea
  «RECONCILIACION NO CORRIO: …» y sale con 2 sin tocar nada.
- **Sin migraciones y sin cambios visibles.**

## Revisión del código

- **La comprobación va antes del barrido y no escribe.** Lee las
  credenciales guardadas y prueba descifrarlas; con una que abra, barre.
  Después hace `rollback` y recién entonces barre.
- **Con una sola credencial ilegible sigue marcando para reconectar**, como
  antes: es lo correcto. Sólo frena cuando no abre ninguna, que es el síntoma
  de una clave equivocada y no de una credencial rota.
- **El error de configuración se atrapa sólo corriendo como servicio**
  (`__name__ == "__main__"`). Importado desde otro lado, sigue como siempre.
  La línea nombra las variables que faltan y nunca imprime valores. La traza
  de pydantic que reemplaza sí mostraba pedazos del entorno
  (`input_value={'ENV': 'production', 'DA...`), así que el cambio además saca
  eso de los registros de Railway.
- **El entrypoint no cambió:** para cualquier comando que no sea `serve` o
  `migrate` hace `exec "$@"`, sin migrar.

## Resultados PM

Base PostGIS recién creada, API nativa reiniciada en el código entregado (un
solo proceso), frontend de desarrollo y configuración local inventada.

| Verificación | Resultado |
|---|---|
| Casos 223 y 224 | **2/2** en 15 s: «RECONCILIACION {"vencida":1}», salida 0, sin migrar; y las tres escenas del 224 con salida 2 y su línea |
| Negativos de la Dev (6) | **6 rojos esperados**, cada uno por su motivo; «src, backend y RAILWAY.md después: como estaban». Detalle abajo |
| Negativo PM 1, `pm-avisa-pero-barre`: dice «NO CORRIO» pero barre igual | **rojo** en el 224: «sin MP_TOKEN_KEY: salió con 0», «barrió igual», «marcó 1 vendedor(es) para reconectar»; lo mismo con otra clave. El caso mira lo que pasa, no sólo la línea. La primera corrida la marqué mal por un error mío en lo esperado (la escena sin clave ya marca a la vendedora, así que la de otra clave no puede volver a marcarla); corregido eso, dio el rojo esperado |
| Negativo PM 2, `pm-horario-restringido`: `RAILWAY.md` programa `*/10 3 * * *`, que corre sólo entre las 3 y las 4 UTC | **NO DISCRIMINA.** El 223 pasa: «el horario es «*/10 3 * * *»». Mira sólo el campo de los minutos, y dice que comprueba «cada N minutos» |
| El comando a mano, como en producción (punto 4 de la aceptación) | **8 de 8 como se esperaba.** Detalle abajo |
| Suite completa desde base recién creada | **223/224** en 24 minutos. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 100 y del 210 al 224 |
| Build, tipos, lint, `alembic check` | verdes; «No new upgrade operations detected.» Sin migraciones |
| `compileall`, `pip check`, `node --check` | verdes; «No broken requirements found.» |
| Diff-check `0794645..c53a5b5` con `cr-at-eol` | limpio. `smoke.mjs` tiene 4 líneas CRLF en la base y las mismas 4 en la entrega |
| `PRE_FIRMA.md`, `.env` o secretos en el delta | ninguno |
| a11y, contraste, auditoría móvil y guías | no corridas: la entrega no toca `src/` ni nada visible, y la pieza vuelve |

Los negativos de la Dev:

| Sabotaje | Rojo |
|---|---|
| `no-termina` | 223: «no terminó en 90 s» |
| `corre-migraciones` | 223: «el servicio corrió migraciones: «alembic» en su salida» |
| `otro-comando` | 223: «no imprimió «RECONCILIACION {…}»: "Python 3.11.15"», y la orden vencida quedó «placed» |
| `sin-comprobar-la-clave` | 224: con otra clave «salió con 0», «barrió igual», «marcó 1 vendedor(es) para reconectar» |
| `sin-exigir-la-clave` | 224: sin clave, lo mismo |
| `mensaje-con-traza` | 224: «sin JWT_SECRET: no dijo por qué en una línea» y «salió con una traza» |

El comando a mano. Sólo los archivos que copia `backend/Dockerfile.railway`,
el entrypoint en el `PATH`, `env -i`, sin `.env` y con `ENV=production`. **La
URL de la base va como la da Railway** (`postgresql://`), así que la adapta el
entrypoint; el 223 usa la URL local, que ya viene adaptada. `MP_API_BASE_URL`
apunta a un puerto local cerrado: ninguna llamada salió a Mercado Pago.

| Corrida | Resultado |
|---|---|
| 1. El comando de `RAILWAY.md`, con `postgresql://` | «RECONCILIACION {"sin_respuesta": 7}», salida 0, sin migrar |
| 2. Con `postgres://`, la otra forma que da Railway | lo mismo |
| 3. Con la propuesta de la Dev, `timeout 540` | lo mismo |
| 4. `MP_TOKEN_KEY` vacía, como llega una referencia a algo que no existe | «RECONCILIACION NO CORRIO: falta MP_TOKEN_KEY. …», salida 2 |
| 5. `MP_TOKEN_KEY` que no es una clave | «… MP_TOKEN_KEY no es una clave válida: tiene que ser la del Backend.», salida 2. Esta rama no tiene caso |
| 6. `MP_MINUTOS_DE_GRACIA` vacía | «RECONCILIACION NO CORRIO: la configuración no es válida: 1 error(es)», salida 2. **No dice cuál** |
| 7. Sin `DATABASE_URL` | «… faltan variables: DATABASE_URL. …», salida 2 |
| 8. `timeout 3` a través del entrypoint, con un proceso de 30 s | salida 124 a los 3 s |

`alembic_version` antes y después: `a47300b5554c`. Ninguna corrida imprimió
una traza. Las primeras tres corridas fallaron por un error mío: el `.env`
local repite claves y mi script leía las dos. Leyendo los valores como los
carga la API, dieron lo de la tabla.

## Lo que se devuelve

1. **`RAILWAY.md` da por hecho que el Backend tiene `MP_TOKEN_KEY`, y nadie lo
   sabe.** Tu informe dice «Ninguna es un secreto que el Backend no tenga»,
   pero no hay con qué afirmarlo:
   - la sección 2 de `RAILWAY.md` no pone ninguna variable de Mercado Pago
     entre las del Backend;
   - de Mercado Pago, el inventario del 13/09 sólo registra
     `MP_CHECKOUT_HABILITADO=false`;
   - `MP_TOKEN_KEY` vale `""` por omisión, y Mercado Pago no está habilitado.

   Si el Backend no la tiene, la referencia llega vacía, y cada corrida sale
   con 2 (corrida 4). `RAILWAY.md` le dice a Emi «Corregila en Variables», y
   eso no lo arregla: la referencia está bien, lo que falta es el valor del
   Backend. Era una de las condiciones para frenar.
2. **La propuesta del tope, aceptada** (corridas 3 y 8).
3. **El 223 no distingue un horario restringido** (negativo PM 2).
4. **«la configuración no es válida: 1 error(es)» no dice qué variable**
   (corrida 6). `RAILWAY.md` promete que la línea dice «qué variable falta o
   está mal».

## Decisiones PM

- **El servicio se crea el día que se habilita Mercado Pago**, con el Backend
  ya con su `MP_TOKEN_KEY` y antes de encender el cobro. Sin Mercado Pago no
  hay nada que reconciliar, y sin la clave cada corrida saldría con error.
- **El comando lleva `timeout 540`.** Railway no corta una corrida colgada y
  saltea las siguientes mientras siga activa; con el tope, la corrida se
  corta a los 9 minutos, antes de la siguiente, y queda como fallida a la
  vista. Reemplaza el «detenela a mano».
- **Los nombres del panel:** se aceptan como están. Si Emi no encuentra un
  campo, frena y avisa.
- **Lo que dice Railway, confirmado por el buscador** (ni PM ni la Dev llegan
  a `docs.railway.com`): un servicio nuevo ignora `railway.toml`, y Railway
  rechaza que se le fije la ruta. Coincide con «Config File: vacío».

## P3, sin tarea

- **Una orden de Mercado Pago de un vendedor que desvinculó su cuenta queda
  reservada hasta que vuelva a vincular.** El reconciliador no puede
  preguntarle a Mercado Pago sin el token, la cuenta como «sin_respuesta» en
  cada barrido y no suelta nada. En la base local quedaron 7 así (órdenes del
  224, cuyas vendedoras se desvinculan al terminar). `/mp-oauth/unlink` no
  pregunta por órdenes abiertas. Viene de antes y no es de esta pieza: hay que
  decidirlo antes de habilitar Mercado Pago.
- **Al publicar con migraciones, una corrida puede caer** si arranca con el
  código nuevo antes de que el Backend migre. La siguiente, 10 minutos
  después, ya encuentra la base migrada.
- **El 223 usa variables escritas en el caso**, no las que da `RAILWAY.md`.
  Si faltara una, la comprobación al arrancar lo diría en su línea.
- **Si algún día se rota la clave a propósito**, el reconciliador no barre
  hasta que reconecte algún vendedor, y su línea dice que la clave «no es la
  del Backend». Rotarla ya obliga a todos a reconectar; se ve cuando se decida
  una rotación.

No se tocó `main`, Railway ni datos reales.
