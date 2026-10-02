# Reproducción PM — SESIONES-AL-CAMBIAR-1

Fecha: 2026-10-02. Base `57adab6`, más los commits PM `086f9a1` y `c21fb9d`
integrados por la Dev.

- Código: `cc439b9` y `f306af7`.
- Caso 236, negativos y guías: `617f809`.
- Caso 130: `f0ac6df`.
- Informe: `263198d`.
- Commit PM sobre el que se revisó: `6265cc2`.

`main` está en `c21fb9d`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

- **Cada cuenta tiene una versión de sesiones** (`users.sesion_version`), que
  viaja en cada token. Cerrar las sesiones es subirla.
  - Cambiar la propia contraseña las cierra todas y le da tokens nuevos a la
    sesión que la cambió.
  - Restablecer desde el panel también las cierra.
  - Cambiar el estado de la cuenta las cierra, al desactivar y al reactivar.
- **Al desplegar, nadie queda afuera.** Un token sin versión cuenta como 0
  hasta el primer cierre de su cuenta.
- **Tres bordes que agregó la Dev:**
  - el choque entre el cambio propio y el restablecer lo gana siempre el
    panel, porque la suma se hace en la base y con condición;
  - el navegador no tira una sesión nueva ante el rechazo del token viejo;
  - reactivar también cierra.
- **Migración `ba10450712c6`, aditiva:** una columna entera, no nula, con 0 por
  omisión.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `6265cc2`.

| Verificación | Resultado |
|---|---|
| Casos 130, 235 y 236 | **3/3** |
| Los once negativos de la Dev | **once rojos esperados**; «src y backend después: como estaban» |
| Negativo PM 1: la edición del panel no cierra al cambiar el estado | **rojo** en el 236: «C, con la edición: reactivada, la sesión de antes […] /auth/me responde 200 y tenía que ser 401», con acceso y con renovación |
| Negativo PM 2: toda sesión nueva se firma con versión 0 | **rojo** en el 236: «B, una sesión nueva con la contraseña del panel: /auth/me responde 401 y tenía que seguir en 200» |
| Negativo PM 3: la sesión opcional (`get_current_user_optional`) no mira la versión | **verde. Hueco de cobertura:** ningún caso lo vigila. El código sí la mira. Hoy la usa sólo la vuelta de Mercado Pago (`/mp-oauth/callback`), y para llegar ahí hace falta un `state` que sólo se crea con una sesión vigente y se gasta en un uso. P3 |
| **Migración en modo producción.** Archivos de `Dockerfile.railway`, `ENV=production`, sin `.env`, sobre una copia de la base con datos bajada a `a47300b5554c` | sube a `ba10450712c6`; las 23 cuentas quedan en 0; la columna queda `NOT NULL DEFAULT 0`; la huella de las cuentas no cambia (`f6bd30d3…`). La segunda corrida no cambia nada |
| Suite completa desde base recién creada | **235/236**; sólo cae el **169**, de entorno; pasan el 130, el 131, el 191, el 213, el 235 y el 236 |
| a11y `--todas` / contraste / auditoría móvil | **78/78**, **82/82**, **12/12** sin desbordes |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 26 pasos y 23 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check `c21fb9d..6265cc2` con `cr-at-eol` | verdes |

**Método.** El contenedor se reinició entre los negativos de la Dev y los de
PM. PM levantó de nuevo la base, la API y el frontend sobre el mismo
worktree, y siguió desde ahí.

## Decisiones PM

- **Se acepta el número de versión** en lugar de una fecha. La razón es la
  precisión de un segundo.
- **Se acepta que reactivar también cierre.**
- **P3 sin tarea:** el hueco de cobertura de la sesión opcional.

## Publicación

Trae migración. Va con la decisión del 25/09: el entorno es demostrativo y no
pide backup previo. La migración es aditiva y su vuelta atrás borra sólo la
columna nueva.

No se tocó `main`, Railway ni datos reales.
