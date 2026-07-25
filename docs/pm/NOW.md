# Estado actual

Actualizado: 2026-07-25

## Objetivo activo

**Cerrar la línea base reproducible y verificada.** Bloqueada hoy (ver
abajo).

No se toca lógica de negocio, no se migra a PostgreSQL y no se agregan
pantallas hasta que esté aprobada.

## Estado

- El contrato entró al repositorio: `CONTRATO.md`. Es la **única** fuente
  de alcance. `PM_ROADMAP.md` pasa a ser plan interno y **sobrepasa el
  contrato** en varios puntos; ese exceso queda fuera del MVP.
- **Nadie logró ejecutar este código todavía.** El primer intento se
  detuvo en las migraciones.
- La documentación de entrega **no es confiable**: dos afirmaciones
  verificadas como falsas (migración `011`, instalación por Docker).
- El repositorio es **público**. Ver bloqueos.

## Secuencia propuesta después de la línea base

Derivada del contrato, no del roadmap interno. Mucho más corta que las
9–11 semanas del roadmap v3, porque se recorta el alcance inventado.

1. **PostgreSQL + PostGIS.** Contractual y sin alternativa (sección 4).
   Además es el cimiento de todo lo que sigue.
2. **Geolocalización**: coordenadas en publicaciones y filtro por
   ubicación en el buscador (3.1).
3. **Directorio de transportistas** (3.2): tipo especial de proveedor con
   ubicación base, certificación, radio y capacidad. Listado por zona en
   la compra. Seleccionar o contactar directo. Sin motor de cotización.
4. **Transferencia bancaria** (3.3): CBU/alias, comprobante, validación
   manual del vendedor.
5. **Categorías faltantes**: Bienes y Ganado, Tecnología para el Cultivo,
   Logística.
6. **Registro con validación** real de ambos roles (3.1).
7. QA, carga inicial y despliegue.

Los puntos 2 y 3 son los que habilitan el segundo hito de cobro.

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

3. **Matriz requisito de `CONTRATO.md` → evidencia → estado** (PM, con el
   resultado de 1 y 2).
   - Criterio de aceptación: cada requisito del contrato tiene estado
     verificado, no declarado. Se hace contra `CONTRATO.md`, no contra el
     roadmap interno.

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

- **El repositorio es público.** Contiene el proyecto de un cliente, su
  documentación de entrega, credenciales demo del seed y notas internas
  de PM que señalan fallas del equipo anterior. Nadie decidió esto de
  forma explícita. Definir si pasa a privado.
- **Relación esfuerzo / presupuesto.** El contrato es a precio cerrado y
  el trabajo pendiente es el núcleo del MVP. Requiere conversación
  comercial antes de comprometer fechas. Números en el PDF, fuera del
  repositorio.
- **PostgreSQL + PostGIS es obligatorio.** La sección 4 del contrato no
  ofrece alternativa. El código usa SQL Server. Es la primera tarea
  después de la línea base y es cimiento de la geolocalización.
- **Mercado Pago desvinculado** y con un bug de sandbox conocido. No se
  configuran credenciales reales hasta la fase de pagos.

## Último resultado validado

Contrato incorporado y contrastado contra el código: `CONTRATO.md` y las
tablas de brechas en `PROJECT.md`. Verificado también que nada en el
repositorio crea la base de datos. Nada ejecutado todavía.
