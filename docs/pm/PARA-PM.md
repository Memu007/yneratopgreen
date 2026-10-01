# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## CAMBIAR-CONTRASENA-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `30f9791` (tu respuesta al freno) |
| código | `f7340f5` · `001507f` (clase propia de la sección) |
| caso, negativos y guías | `544cbd0` · `afd1235` (sólo un final de línea) |
| no integrado, no desplegado | `main` sigue en `77d3d2c` |

**Resultado.**

- **«Cambiar contraseña» en Mi cuenta, para cualquier rol**, al final de «Mi
  Perfil». Pide la actual, la nueva y su repetición.
  - Si las dos nuevas no coinciden, no manda nada.
  - Si la actual está mal, no cambia nada, y lo escrito en los tres campos
    queda.
  - Los mensajes son los de la API.
- **Una sola regla en la API, la opción A** (`ClaveNueva`, en
  `schemas/auth.py`): de 6 caracteres a 72 bytes. La usan el registro, el
  cambio, el alta del panel y el restablecer del panel.
- **Más de 72 bytes nunca da 500.**
  - Guardar una así responde 422 con el motivo.
  - Ingresar con una así es «Email o contraseña incorrectos».
  - No se trunca nada, ni cambia cómo se guardan las contraseñas.
- **Las dos guías suman lo nuevo:**
  - la de uso tiene el paso 23, «Cambiar tu contraseña»;
  - la del panel nombra el rechazo de una contraseña de más de 72 bytes en el
    alta.
- **Arreglé algo que no estaba pedido, porque es de seguridad.** Un 422
  devolvía en `input` lo que se había escrito, y en un campo de contraseña
  eso es el secreto. Ya pasaba con la regla del mínimo. Ahora se saca de los
  campos de contraseña; el resto del formato de FastAPI no cambia
  (`main.py`).

**Nada para decidir.**

## Los mensajes

| cuándo | qué dice | dónde |
|---|---|---|
| nueva de menos de 6 caracteres | «La contraseña tiene que tener al menos 6 caracteres.» | API, 422 |
| nueva de más de 72 bytes | «La contraseña puede tener hasta 72 caracteres. Las letras con acento y la ñ cuentan doble.» | API, 422 |
| actual equivocada, también si tiene más de 72 bytes | «Contraseña actual incorrecta» | API, 400; ya existía |
| ingreso con más de 72 bytes | «Email o contraseña incorrectos» | API, 401; el mismo de siempre |
| las dos nuevas distintas | «La contraseña nueva y su repetición no coinciden.» | pantalla; no se manda |
| el cambio salió | «Cambiaste tu contraseña.» | pantalla |

Debajo de «Contraseña nueva», la sección dice: «Al menos 6 caracteres y hasta
72. Las letras con acento y la ñ cuentan doble.».

**Por qué «72 caracteres» y no «72 bytes».** Cuentan igual con letras sin
acento, y una persona no sabe qué es un byte. La ñ y las letras con acento
ocupan dos, y el mensaje lo dice.

## Las sesiones abiertas

Siguen como medí en el freno: cambiar la contraseña no cierra ninguna, y una
sesión que se renueva no vence nunca. No lo toqué: es
`SESIONES-AL-CAMBIAR-1`, la que sigue.

## Caso y negativos

| caso | qué mira |
|---|---|
| 235 | **Por la API, llamada directo**, 11 pedidos: 73 bytes, 37 eñes (74 bytes), 5 y 3 caracteres en el registro, el cambio, el alta y el restablecer del panel; 72 bytes justos, que se aceptan; 73 bytes en el ingreso y como actual. Ningún 500, cada rechazo con su motivo y ninguno devuelve la contraseña. **En la pantalla, en 1440 y 390, con una cuenta nueva por ancho:** las nuevas distintas no mandan nada; la actual mal no cambia nada ni borra lo escrito; el cambio bueno avisa y vacía los campos; después de salir, la vieja no entra por la pantalla ni por la API, y la nueva sí |

**Contra el código de antes** (`30f9791`), el 235 encuentra 29 problemas:

- los 500 de los 73 bytes en los seis caminos;
- los motivos en inglés («String should have at least 6 characters»);
- la contraseña devuelta en el 422;
- el restablecer con 3 caracteres, que daba 400 y no 422;
- Mi Perfil sin «Cambiar contraseña», en los dos anchos.

`python3 scripts/sabotajes_cambiar_contrasena_1.py` → «todos dieron el rojo esperado» y «src y backend después: como estaban»

| sabotaje | rojo del 235 |
|---|---|
| `api-sin-validar` (pedido): el cambio acepta cualquier nueva | 7 problemas: «cambio a una de 3 caracteres: HTTP 200» y «cambio a una de 73 bytes: HTTP 500», con sus motivos, y la cuenta queda con la contraseña cambiada. Nada del registro, del panel, del ingreso ni de la pantalla |
| `pantalla-sin-actual` (pedido): la sección no pide la actual | 14 problemas, en los dos anchos: «la sección no pide «Contraseña actual»», y por eso el cambio no sale, la vieja sigue entrando y la nueva no. Nada de la API |
| `ingreso-con-500`: el ingreso le pasa a bcrypt más de 72 bytes | 4 problemas: «ingreso con 73 bytes: HTTP 500» y lo mismo con la actual de 73 bytes en el cambio, con sus motivos. Nada más |
| `devuelve-la-clave`: el 422 devuelve la contraseña | 8 problemas: «la respuesta devuelve la contraseña escrita», en cada 422. Los códigos y los motivos no cambian |

**Aviso de entorno.** Los tres de la API reinician con `REINICIAR_API`. El
de pantalla espera a que el servidor de desarrollo sirva el archivo roto, y
después el sano.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=235 node scripts/smoke.mjs
# → 1/1 pasaron; 0 fallaron

REINICIAR_API="<tu reinicio>" python3 scripts/sabotajes_cambiar_contrasena_1.py
# → todos dieron el rojo esperado

node scripts/guia-usuario.mjs
# → LA GUÍA Y EL SITIO COINCIDEN: 23 pasos en escritorio y celular
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `544cbd0` | **234/235**. Sólo cae el **131**, de entorno: «puente docker: sólo se traduce 'docker exec'». Pasan el 213 y el 235 |
| tipos, lint, build | verdes (`npm run build` incluye `tsc`; lint sin avisos) |
| `compileall`, `node --check`, parseo de Python | verdes |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` sobre `30f9791..afd1235` | limpio; ninguna línea cambia sólo por el final |
| a11y `--todas` | 78 de 78 pantallas, 0 violaciones |
| contraste | 82 de 82, ninguna por debajo del mínimo |
| auditoría móvil | 12 de 12 recorridos y 39 pantallas: 0 desbordes, 0 controles tapados, 0 errores de consola y 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 23 pasos en escritorio y celular» |

`afd1235` sólo cambia el final de una línea de `guia-usuario.mjs`, que no
usa la suite: `git diff --ignore-cr-at-eol 544cbd0 afd1235` sale vacío.

**Líneas con CR por archivo, contra la base:**

| archivo | base | ahora |
|---|---|---|
| `scripts/smoke.mjs` | 4 | 4 (las mismas) |
| `backend/app/schemas/auth.py` | 196 | 229, todas las agregadas, como sus vecinas |
| `src/components/UserDashboard/UserDashboard.tsx` | 4180 | 4182: el bloque agregado, como sus vecinas. La línea del `import`, sin CR, como la de al lado |
| `admin.py`, `security.py`, `main.py`, `api.ts`, `UserDashboard.module.css` | todo CRLF | todo CRLF |
| `CambiarClave.tsx`, los dos `.md`, `guia-*.mjs` y el script de negativos | 0 | 0 |

## Riesgos

- **Una cuenta creada antes del 27/08 con más de 72 bytes**, si existiera, no
  puede entrar. Hoy recibe un 500; ahora va a recibir «incorrecta». La
  causa es que bcrypt 4 truncaba en silencio. No hay ninguna en la base
  local; la de producción no la veo.
- **El restablecer del panel cambió de forma.** Su cuerpo pasó a ser un
  esquema: con menos de 6 caracteres responde 422 con el motivo de la regla,
  y no 400. El panel genera una de 20, así que desde la pantalla no se ve.
- **Las sesiones abiertas** siguen hasta `SESIONES-AL-CAMBIAR-1`.
