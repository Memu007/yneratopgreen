# Estado actual

Actualizado: 2026-07-24

## Objetivo activo

**Cerrar la Fase 0 del roadmap v3: línea base reproducible y verificada.**

No se toca lógica de negocio, no se migra a PostgreSQL y no se agregan
pantallas hasta que la línea base esté aprobada.

## Estado

- Repositorio conectado y con commit base. La fuente de verdad es este
  FastAPI + React; el Django queda congelado como referencia.
- **Nadie ejecutó este código todavía.** No hay evidencia de que levante,
  migre, siembre ni pase un smoke test.
- La documentación de entrega **no es confiable**: declara una migración
  `011` con geolocalización que no existe. Verificado. Mientras no haya
  smoke tests, todo lo marcado como "✅ completo" en
  `docs/PROJECT_STATUS.md` es una afirmación, no un hecho.
- El alcance vinculante es `docs/PM_ROADMAP.md` v3, no la documentación
  de entrega. Estimación: 9–11 semanas desde la línea base aprobada.

## Próximas tareas

1. **Levantar y verificar la línea base** (dev).
   Docker compose, `alembic upgrade head`, seed, `npm run build`, y smoke
   tests de: health, registro, login, catálogo, carrito, checkout/orden,
   productos del vendedor, compras, ventas y admin.
   - Criterio de aceptación: instalación reproducible desde cero; build
     verde; última migración aplicada informada con su número real;
     cada smoke test con caso, resultado HTTP/UI y observación; errores
     exactos con causa y solución propuesta. Sin credenciales reales de
     Mercado Pago.

2. **Auditar la documentación de entrega contra el código** (dev).
   El caso `011` ya está confirmado como falso. Hay que saber cuántos
   más hay antes de planificar sobre esa base.
   - Criterio de aceptación: lista de afirmaciones de
     `PROJECT_STATUS.md` que no se sostienen contra el código, con
     archivo y línea. Sin corregir nada todavía.

3. **Matriz requisito contractual → evidencia → estado** (PM, con el
   resultado de 1 y 2).
   - Criterio de aceptación: cada requisito del roadmap v3 tiene estado
     verificado, no declarado.

## Bloqueo activo — Fase 0 detenida en la migración

`alembic upgrade head` falla con:

```
Cannot open database "topgreen" requested by the login. The login failed. (4060)
```

**Nada en el repositorio crea la base `topgreen`.** Verificado: no está en
`docker-compose.yml`, no hay entrypoint en `backend/Dockerfile`, ninguna
migración la crea, y `scripts/init_local_db.sh` va directo de
`docker compose up -d` a `alembic upgrade head`.

El único `CREATE DATABASE` del repo es `README_LOCAL_SETUP.md:126`, en el
Camino B (nativo), y usa otro nombre: `topgreen_local`, mientras
`.env.example` apunta a `topgreen`.

Conclusión: **el Camino A (Docker) del README nunca pudo funcionar.**
Falla el criterio "instalación reproducible desde cero".

Arreglo aprobado (mínimo): crear la base de forma idempotente en
`scripts/init_local_db.sh` (y su par `.ps1`) antes de las migraciones,
con `sqlcmd`, que ya está en la imagen de SQL Server. No cambia el
esquema ni el modelo.

## Otros bloqueos

- **Todo el roadmap está bloqueado por la tarea 1.** Planificar fases 1 a
  6 sobre un código que nadie ejecutó es especular.
- **Decisión contractual pendiente: PostgreSQL + PostGIS.** El contrato
  lo exige, el código usa SQL Server. Migrar es Fase 2 y es caro. Si hay
  margen para negociar el cambio por escrito, hay que saberlo antes de
  la Fase 2, no durante.
- **Mercado Pago desvinculado** y con un bug de sandbox conocido. No se
  configuran credenciales reales hasta la Fase 5.

## Último resultado validado

Inventario del repositorio y verificación de la migración `011`
(no existe; no hay columnas geo). Resultado en `REPO_MAP.md`.
Nada ejecutado todavía.
