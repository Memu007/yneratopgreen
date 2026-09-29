# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## RECONCILIADOR-PROGRAMADO-1: frenada en el punto 2

**Resultado: freno por dos condiciones tuyas.** «Si algo no se puede como lo
pido acá, decilo con la cita», y «si hace falta cambiar el Backend o su
configuración en Railway». Según la documentación de Railway, las dos pasan.
No escribí configuración ni código: no hay commit de producto.

**Lo que dice Railway.** Una aclaración antes: **no pude abrir las páginas.**
Mi entorno y la herramienta de lectura web tienen bloqueado
`docs.railway.com`. Lo de abajo sale de los resúmenes del buscador sobre esas
páginas. No son citas textuales, y alguien que llegue a las páginas tiene que
confirmarlas.

1. **La configuración en el repositorio (`railway.toml`) está en desuso.**
   - El reemplazo es «Infrastructure as Code», un archivo
     `.railway/railway.ts`.
   - **Los servicios nuevos no pueden usar `railway.toml`**, y el del
     reconciliador sería nuevo.
   - **Los que ya lo usan dejan de tenerlo el 01/12/2026**, un corte
     definitivo. Son el Backend (`/backend/railway.toml`) y el Frontend
     (`/railway.toml`).
   - Fuentes: https://docs.railway.com/config-as-code y
     https://docs.railway.com/config-as-code/reference.
2. **Hay un problema conocido con el horario definido en la configuración:**
   a veces no dispara. Railway recomienda sacarlo del archivo y ponerlo desde
   el panel. Fuentes: https://station.railway.com/questions/cron-jobs-are-stuck-and-not-executing-on-40255aab
   y https://station.railway.com/questions/cron-schedule-not-triggering-299650cf.
3. **No encontré si `.railway/railway.ts` admite horario.** El resumen del
   buscador no lo dice. Fuente: https://docs.railway.com/infrastructure-as-code/reference.
4. **Sobre el horario en sí** (https://docs.railway.com/cron-jobs):
   - el intervalo mínimo es de 5 minutos, en UTC;
   - si la corrida anterior sigue activa, Railway saltea la nueva, **y no
     termina la vieja**;
   - el proceso tiene que terminar solo, sin dejar conexiones abiertas.

   La política de reinicio «Never» existe
   (https://docs.railway.com/deployments/restart-policy).
5. **El costo:** Railway cobra por minuto de uso. El plan Hobby cuesta 5 USD
   e incluye 5 USD de uso (https://docs.railway.com/pricing/plans). Un
   servicio más suma uso, poco, pero es un costo nuevo: otra condición tuya
   para frenar.

**Lo que sí medí, sin commit.** Copié sólo los archivos que copia
`backend/Dockerfile.railway`, sin `.env`, y corrí el comando con
`env -i`:

```text
ENV=production + DATABASE_URL + MP_TOKEN_KEY + JWT_SECRET
./railway-entrypoint python -m app.reconciliar
→ RECONCILIACION {"sin_respuesta": 15}      salida 0

sin JWT_SECRET
→ «JWT_SECRET  Field required» (pydantic)   salida 1
```

- **El servicio necesita `JWT_SECRET` aunque no lo usa**, porque la
  configuración lo exige al cargar. Tiene que ser una referencia a la del
  Backend, no una copia.
- **Hay un riesgo que encontré leyendo el código, sin medirlo.** Si al
  servicio le falta `MP_TOKEN_KEY`, o tiene otra, no puede descifrar los
  tokens (`mp_vinculo.py:357-365` y `:368`). Entonces marca como
  «reconectar» la cuenta de Mercado Pago de cada vendedor con órdenes
  pendientes, y hace `commit`. La comprobación de variables al arrancar
  tiene que incluir esa clave, y tiene que ser **la misma del Backend**.
- **Frecuencia que propongo: cada 10 minutos** (`*/10 * * * *`). La reserva
  y el link valen 30 minutos (`MP_MINUTOS_DE_VIGENCIA`), y el reconciliador
  suelta después de 10 más de gracia (`MP_MINUTOS_DE_GRACIA`). Con cada 10,
  una reserva abandonada vuelve entre los 40 y los 50 minutos. Cada 5 es el
  mínimo de Railway y duplica las corridas por poco.

**Lo que decidís vos (o Emi):**

1. **Cómo se programa el servicio nuevo.** Te recomiendo la (a):
   - **(a) Todo desde el panel de Railway**, que es lo que Railway recomienda
     para el horario. En el repositorio queda la especificación en
     `RAILWAY.md`, paso a paso para Emi, y la comprobación local. Emi carga
     en el panel: el Dockerfile, el comando, el horario, «Never» y las
     variables. Tus negativos «la configuración apunta a otro comando» y «el
     servicio corre las migraciones» pasan a mirar el comando y el
     `entrypoint`, no un archivo de Railway.
   - **(b) Migrar a `.railway/railway.ts`.** Es más grande: toca los tres
     servicios, y no sé si admite horario.
2. **El corte del 01/12/2026 para el Backend y el Frontend.** Pide una
   pieza propia, antes de esa fecha, y la tiene que confirmar alguien que
   llegue a las páginas de Railway.
3. **El costo de un servicio más**, aunque sea chico.

Con la (a) sigo con los casos, los negativos, la comprobación de variables y
`RAILWAY.md`, sin tocar Railway.

---

## PAGO-ORDEN-CERRADA-1

Aceptada en rama sobre `b3b5f3c`. Sin cambios.
