# Reproducción PM — CAMBIAR-CONTRASENA-1

Fecha: 2026-10-01. Base `30f9791` (respuesta PM al freno `3f9f2e5`).

- Código: `f7340f5` y `001507f`.
- Caso 235, negativos y guías: `544cbd0` y `afd1235`.
- Informe: `cf02a50`, integrado en `02e82e3`.

`main` está en `30f9791`. **Aceptada en rama**, sin integración ni despliegue.

## Qué cambia

- **«Cambiar contraseña» en Mi cuenta**, para cualquier rol.
  - Pide la actual, la nueva y su repetición.
  - Si las nuevas no coinciden, no manda nada.
  - Si la actual está mal, no cambia nada y no borra lo escrito.
- **Una sola regla en la API** (`ClaveNueva`): de 6 caracteres a 72 bytes.
  La usan el registro, el cambio, el alta del panel y el restablecer del
  panel.
- **Más de 72 bytes nunca da 500.** Guardar una así es 422 con el motivo, e
  ingresar con una así es «Email o contraseña incorrectos». No se trunca
  nada ni cambia cómo se guardan las contraseñas.
- **Sin pedirlo, la Dev arregló algo de seguridad:** un 422 devolvía la
  contraseña escrita en `input`. Ahora se saca de los campos de contraseña
  (`main.py`).
- **Las guías:** la de uso suma el paso 23, «Cambiar tu contraseña», y la
  del panel nombra el rechazo de más de 72 bytes en el alta.
- **Sin migraciones.**

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `02e82e3`.

| Verificación | Resultado |
|---|---|
| Caso 235 | **1/1** |
| Negativos de la Dev: API sin validar, pantalla sin la actual, ingreso con 500, el 422 devuelve la clave | **cuatro rojos esperados**; «src y backend después: como estaban» |
| Negativo PM 1: el alta del panel vuelve a su regla vieja (`min_length=6`, sin máximo) | **rojo** en el 235: «alta desde el panel con 73 bytes: HTTP 500 y tenía que ser 422» |
| Negativo PM 2: un error de la pantalla borra lo escrito | **rojo** en el 235: «el error de la actual borró la contraseña nueva», en los dos anchos |
| Negativo PM 3: el filtro del 422 mira sólo el campo `password` y no `new_password` | **rojo** en el 235: «cambio a una de 73 bytes: la respuesta devuelve la contraseña escrita» |
| Suite completa desde base recién creada | **234/235**; sólo cae el **169**, de entorno; pasan el 131, el 191, el 213 y el 235 |
| a11y `--todas` / contraste / auditoría móvil | **78/78**, **82/82**, **12/12** sin desbordes |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 26 pasos y 23 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check `30f9791..02e82e3` con `cr-at-eol` | verdes |

**Método.** El primer intento del negativo PM 1 no cambió nada. `admin.py`
termina sus líneas en CRLF, y el patrón no lo tenía en cuenta. PM lo vio por
la cuenta de cambios en cero y lo repitió con el patrón correcto. Sólo cuenta
la repetición.

## Decisiones PM sobre el informe

- **«72 caracteres» en el mensaje**, con la aclaración de la ñ y los
  acentos: se acepta.
- **Restablecer desde el panel con menos de 6 caracteres** pasa de 400 a
  422. Se acepta: el panel genera una de 20.
- **Una cuenta anterior al 27/08 con más de 72 bytes**, si existiera, pasa
  de recibir un 500 a recibir «incorrecta». Se acepta: igual no podía
  entrar, y se recupera con «Restablecer» desde el panel.
- **El filtro del 422:** se acepta, y se registra como mejora de seguridad.
- **Las sesiones abiertas:** van en `SESIONES-AL-CAMBIAR-1`, la tarea que
  sigue.
- **P3 sin tarea:** «Cambiar contraseña» no tiene límite de intentos para la
  actual. Quien lo use ya tiene una sesión abierta. Va a la auditoría de
  seguridad final.

No se tocó `main`, Railway ni datos reales.
