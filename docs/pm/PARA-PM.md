# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## RECONCILIADOR-PROGRAMADO-1: la vuelta

| | |
|---|---|
| base | `edfd886` (tu devolución) |
| producto | `1241b48` (`RAILWAY.md` y el import de `reconciliar.py`) |
| casos y negativos | `8170d8b` |
| no integrado, no desplegado | no entré a Railway |

**Resultado: los cuatro cambios, y tus dos negativos en el script.**

1. **`MP_TOKEN_KEY` en el Backend.** Tenías razón: escribí «Ninguna es un
   secreto que el Backend no tenga» sin nada que lo sostuviera. Fue un error
   mío. `RAILWAY.md`, sección 5, dice ahora:
   - **cuándo se crea:** el día que se habilita Mercado Pago, con el Backend
     ya configurado y antes de encender el cobro;
   - **antes de crearlo:** mirar en «Variables» del Backend que figure
     `MP_TOKEN_KEY`, sólo el nombre. Si no está, no se crea;
   - **ante «NO CORRIO: falta MP_TOKEN_KEY»:** mirar primero el Backend; si
     la tiene, revisar la referencia en este servicio.
2. **El tope.** El comando es `railway-entrypoint timeout 540 python -m app.reconciliar`,
   y salió el «detenela a mano». El 223 exige un `timeout` menor que el
   intervalo del horario, y `sin-tope` da rojo. Una aclaración: `timeout` es de
   coreutils, que viene en la imagen Debian de `python:3.11-slim`. Lo
   comprobé en mi entorno, no dentro de la imagen, porque acá no hay Docker.
3. **El horario, los cinco campos.** El 223 exige `*/N * * * *` con N ≥ 5.
   Tu `pm-horario-restringido` da rojo.
4. **La variable que no sirve se nombra, sin su valor.** El 224 tiene una
   escena más: `MP_MINUTOS_DE_GRACIA=diez-minutos`. La línea dice
   «variables con un valor que no sirve: MP_MINUTOS_DE_GRACIA», y el caso
   comprueba que el valor no aparezca. `invalida-sin-nombre` da rojo.

**La línea opcional del primer despliegue: la puse**, en condicional y sin
verificar: «Railway puede hacer un primer despliegue apenas conectás el
repositorio… Si ese primero falla, no pasa nada: cuando termines,
«Redeploy»».

**Lo que corrí**, como pediste para la vuelta:

```text
SMOKE_CASOS=100,210…224 node scripts/smoke.mjs
→ 16/16 pasaron; 0 fallaron

python3 scripts/sabotajes_reconciliador_programado_1.py
→ los 10 [ROJO ESPERADO], en la primera corrida
→ src, backend y RAILWAY.md después: como estaban
→ todos dieron el rojo esperado

git -c core.whitespace=cr-at-eol diff --check   → limpio
compileall                                      → verde
```

| sabotaje nuevo | rojo |
|---|---|
| `sin-tope` | 223: «el comando de RAILWAY.md, «railway-entrypoint python -m app.reconciliar», no tiene un tope menor que el intervalo del horario (600 s)» |
| `pm-horario-restringido` | 223: «el horario de RAILWAY.md, «*/10 3 * * *», no es «*/N * * * *» con N de 5 o más» |
| `invalida-sin-nombre` | 224: «con MP_MINUTOS_DE_GRACIA inválida: no dijo por qué en una línea: "…la configuración no es válida: 1 error(es)"» |
| `pm-avisa-pero-barre` | 224: sin clave, «salió con 0», «barrió igual» y «marcó 1 vendedor(es)»; con otra clave, «salió con 0» y «barrió igual» |

Los 6 de antes siguen dando el mismo rojo.

**No corrí:** la suite completa, porque sólo toqué lo que dijiste: `RAILWAY.md`,
el import de `reconciliar.py` y los casos 223 y 224. Tampoco lint, tipos ni
build: no hay cambios en `src/`.

---

## RECONCILIADOR-PROGRAMADO-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `0794645` (tu respuesta al freno) |
| producto | `d351306` (`RAILWAY.md` y `backend/app/reconciliar.py`) |
| casos y negativos | `8635202` y `c53a5b5` |
| no integrado, no desplegado | `main` sigue en `65457cc`. No entré a Railway |

**Resultado.**

- **El servicio se crea desde el panel, con los pasos de `RAILWAY.md`,
  sección 5.** Están escritos para Emi, y el caso 223 los lee de ahí:
  - el comando es `railway-entrypoint python -m app.reconciliar`;
  - corre cada 10 minutos (`*/10 * * * *`), con reinicio «Never»;
  - no tiene pre-deploy ni healthcheck, ni archivo de configuración;
  - las variables van como referencia, por nombre y cada una con su porqué.
- **Antes de barrer, el reconciliador comprueba que puede hacerlo sin daño.**
  - Si falta una variable, o si `MP_TOKEN_KEY` falta, no es válida o no abre
    ninguna credencial guardada, lo dice en una línea que empieza con
    `RECONCILIACION NO CORRIO: …` y sale con 2 sin tocar nada.
  - Con el código de la base, el 224 **mide el daño que te había anunciado
    leyendo el código**: sin clave, o con otra, el barrido marca para
    reconectar a la vendedora con una orden pendiente.
- **La comprobación local es como en producción.**
  - Usa sólo los archivos que copia `backend/Dockerfile.railway`, leídos del
    Dockerfile, más el entrypoint.
  - Corre sin `.env`, con `ENV=production` y con las variables de la
    sección 5.
  - El comando cierra una orden vencida, dice `RECONCILIACION {…}`, sale con
    0 y no migra.
- **Suite completa desde base nueva, sobre `c53a5b5`: 223/224.** Sólo cae
  el 131, de entorno.

**Lo que decidís vos (o Emi):**

1. **Un tope para una corrida colgada.** Railway no corta una corrida que no
   termina, y mientras siga activa saltea las siguientes: el reconciliador
   dejaría de correr sin avisar.
   - `RAILWAY.md` le dice a Emi que la detenga a mano si pasa de 10 minutos.
   - **Propuesta:** que el comando sea
     `railway-entrypoint timeout 540 python -m app.reconciliar`, así el
     proceso se corta solo antes de la corrida siguiente. No lo hice porque
     el comando lo fijaste vos.
2. **Los nombres del panel.** Escribí «Custom Start Command», «Cron
   Schedule», «Restart Policy» y «Config File» como los conozco y como
   aparecen en los resúmenes del buscador. No pude abrir las páginas, así que
   Emi puede encontrarlos con otro nombre. El valor de cada uno no cambia.

## Lo que dice Railway

Con la misma aclaración que en el freno: `docs.railway.com` está bloqueado
para mi entorno y para la herramienta de lectura web. Esto sale de los
resúmenes del buscador sobre esas páginas; no son citas textuales.

| qué | lo que dice | fuente |
|---|---|---|
| cómo se programa | desde el panel del servicio o con `deploy.cronSchedule` en `railway.toml`/`railway.json`, que está en desuso para servicios nuevos | https://docs.railway.com/cron-jobs y https://docs.railway.com/config-as-code |
| intervalo mínimo | 5 minutos | https://docs.railway.com/cron-jobs |
| zona horaria | UTC | lo mismo |
| si la anterior sigue corriendo | saltea la nueva, y no termina la vieja | lo mismo |
| el proceso | tiene que terminar solo, sin dejar conexiones abiertas | lo mismo |
| reinicio | existe «Never» | https://docs.railway.com/deployments/restart-policy |
| otro Dockerfile | la variable `RAILWAY_DOCKERFILE_PATH`, o «Dockerfile Path» en la configuración del servicio | https://docs.railway.com/builds/dockerfiles |
| horario en el archivo | problema conocido: a veces no dispara; recomiendan ponerlo en el panel | https://station.railway.com/questions/cron-jobs-are-stuck-and-not-executing-on-40255aab |

## La frecuencia

**Cada 10 minutos.** La reserva y el link valen 30 minutos
(`MP_MINUTOS_DE_VIGENCIA`), y el reconciliador suelta después de 10 más de
gracia (`MP_MINUTOS_DE_GRACIA`). Con cada 10, una compra abandonada devuelve su
mercadería entre los 40 y los 50 minutos, y un link que no se pudo apagar se
reintenta a los 10. Cada 5 es el mínimo de Railway y duplica las corridas por
poco.

## Las variables

Todas como referencia (`${{Servicio.VARIABLE}}`), para que haya un solo valor.
En `RAILWAY.md` cada una tiene su porqué, en palabras de Emi.

| variable | valor | por qué |
|---|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `Dockerfile.railway` | la imagen del Backend; sin ella usaría `backend/Dockerfile`, el del entorno local |
| `ENV` | `production` | como el Backend |
| `DATABASE_URL` | `${{PostGIS.DATABASE_URL}}` | la misma base |
| `JWT_SECRET` | `${{Backend.JWT_SECRET}}` | no la usa, pero la configuración común no arranca sin ella (medido: sin ella, «faltan variables: JWT_SECRET») |
| `MP_TOKEN_KEY` | `${{Backend.MP_TOKEN_KEY}}` | abre las credenciales de cada vendedor; tiene que ser la del Backend |

Ninguna es un secreto que el Backend no tenga. `MP_MINUTOS_DE_GRACIA` y
`MP_API_BASE_URL` van como referencia sólo si el Backend las define: una
referencia a algo que no existe llega vacía.

## Casos

| caso | qué mira | con el código de la base |
|---|---|---|
| 223 | El comando que `RAILWAY.md` le da al servicio, corrido como en producción, cierra una orden vencida de una vendedora nueva. Dice `RECONCILIACION {…}` con `vencida` ≥ 1, sale con 0 y no migra. La reserva vuelve y el link se apaga en el doble. El horario de `RAILWAY.md` es «cada N minutos» con N ≥ 5 | pasa: el comando ya funcionaba. Lo nuevo son los pasos y la comprobación |
| 224 | Con una vendedora vinculada y una orden vencida esperando: sin `JWT_SECRET`, sin `MP_TOKEN_KEY` y con otra clave. El servicio no barre, lo dice en una línea, sale con 2, no marca a nadie para reconectar y no toca la orden | rojo, 11 problemas: sin `JWT_SECRET` sale con la traza de pydantic; sin clave y con otra, barre, sale con 0 y **marca a la vendedora para reconectar** |

Salida en la suite completa:

```text
[PASS] 223 … «railway-entrypoint python -m app.reconciliar», con los archivos de backend/Dockerfile.railway,
  ENV=production y sin .env, barrió en 1.6 s, dijo «RECONCILIACION {"sin_respuesta":1,"vencida":1}», salió con 0
  y no migró; la orden vencida quedó cancelada, con su link apagado y su unidad de vuelta; el horario es «*/10 * * * *»
[PASS] 224 … sin JWT_SECRET: salida 2, «RECONCILIACION NO CORRIO: faltan variables: JWT_SECRET. …»;
  sin MP_TOKEN_KEY: salida 2, «RECONCILIACION NO CORRIO: falta MP_TOKEN_KEY. …»;
  con otra MP_TOKEN_KEY: salida 2, «RECONCILIACION NO CORRIO: MP_TOKEN_KEY no abre ninguna de las 1 …»
```

**Un error del caso que encontró un negativo.** Al vencer el tope, Python
entrega la salida en bytes, y el 223 se rompía en vez de decir «no terminó».
Lo encontró `no-termina` y está arreglado en `c53a5b5`. En el título de ese
commit dice «RECONCILIACION» por «RECONCILIADOR»; no reescribí la historia.

## Negativos

`python3 scripts/sabotajes_reconciliador_programado_1.py`: «todos dieron el
rojo esperado» y «src, backend y RAILWAY.md después: como estaban», sobre
`c53a5b5`.

| sabotaje | rojo |
|---|---|
| `no-termina` (barre y se queda esperando) | 223: «no terminó en 90 s» |
| `corre-migraciones` (el entrypoint migra antes de cualquier comando) | 223: «el servicio corrió migraciones: «alembic» en su salida» |
| `otro-comando` (`RAILWAY.md` dice `railway-entrypoint python -V`) | 223: «no imprimió «RECONCILIACION {…}»: "Python 3.11.15"», y la orden vencida queda sin cerrar |
| `sin-comprobar-la-clave` | 224: con otra clave sale con 0, barre y marca a la vendedora para reconectar |
| `sin-exigir-la-clave` | 224: sin clave, lo mismo |
| `mensaje-con-traza` | 224: sin `JWT_SECRET` sale la traza de pydantic y no la línea |

**Aviso de entorno.** El caso copia `app/` del entorno de la API. En el tuyo,
nativo, los sabotajes de `reconciliar.py` llegan solos. En Docker harían falta
reconstruir la imagen. El entrypoint y `RAILWAY.md` los lee siempre del
repositorio.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=223,224 node scripts/smoke.mjs
# → 2/2 pasaron; 0 fallaron

python3 scripts/sabotajes_reconciliador_programado_1.py
# → todos dieron el rojo esperado   (unos 3 minutos; no-termina espera 90 s)
# → src, backend y RAILWAY.md después: como estaban
```

**El comando a mano, como en producción.** Es el punto 4 de tu aceptación. El
223 lo hace solo, pero si querés verlo:

```bash
T=$(mktemp -d) && cd backend && cp -r requirements.txt alembic.ini alembic app "$T"/ \
  && cp railway-entrypoint.sh "$T"/railway-entrypoint && chmod +x "$T"/railway-entrypoint && cd "$T" \
  && env -i PATH="$T:$OLDPWD/.venv/bin:/usr/bin:/bin" ENV=production \
     DATABASE_URL="<la de backend/.env>" JWT_SECRET=x MP_TOKEN_KEY="<la de backend/.env>" \
     railway-entrypoint python -m app.reconciliar; echo "salida $?"
# → RECONCILIACION {…}
# → salida 0
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `c53a5b5` | **223/224**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 100, del 213 al 222, el 223 y el 224 |
| lint, `tsc --noEmit`, build | verdes |
| `compileall`, `pip check`, `node --check` | verdes; «No broken requirements found.» |
| `alembic check` | «No new upgrade operations detected.» |
| diff-check con `cr-at-eol` | limpio sobre `0794645..c53a5b5` |
| a11y, contraste, auditoría móvil, guías | **no corridas**: no cambia nada visible |

## Riesgos

- **Una corrida colgada deja de programar las siguientes** (arriba, punto 1).
- **El servicio pide `JWT_SECRET` aunque no lo usa.** Va como referencia, no
  como copia. Sacarlo pide cambiar la configuración común: no es de esta
  tarea.
- **No verifiqué el panel de Railway.** Los pasos siguen la documentación en
  resumen; los nombres pueden variar.
- **El corte del 01/12 para el Backend y el Frontend** sigue pendiente, en su
  pieza.

---

## PAGO-ORDEN-CERRADA-1

Aceptada en rama sobre `b3b5f3c`. Sin cambios.
