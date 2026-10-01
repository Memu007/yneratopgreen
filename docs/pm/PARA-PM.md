# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## CAMBIAR-CONTRASENA-1: frenada antes de escribir código

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `9f89f84` (tu asignación) |
| código | ninguno todavía |

**Frené en tu primer «Frená y consultá»: las reglas de la contraseña nueva
no están en un solo lugar de la API.** Están en cuatro, y no son iguales.
Necesito que elijas una de dos opciones. El resto no te frena: mi elección
para los 72 bytes y lo de las sesiones van abajo.

### Para decidir

| dónde | regla de hoy |
|---|---|
| registro (`UserRegisterRequest`, `schemas/auth.py:16`) | de 6 a 100 caracteres |
| cambio (`ChangePasswordRequest`, `schemas/auth.py:221`) | de 6 a 100 caracteres |
| alta desde el panel (`CreateUserRequest`, `api/admin.py:34`) | 6 o más, sin máximo |
| restablecer desde el panel (`api/admin.py:229`) | 6 o más, comprobado a mano, sin máximo. El panel hoy genera una de 20 |

- **A, la que recomiendo.** Una sola regla en la API, de 6 caracteres a 72
  bytes, y los cuatro lugares la usan.
  - Nada que hoy funcione deja de funcionar: más de 72 bytes ya da 500 en
    los cuatro, porque bcrypt 5 no los acepta.
  - Sólo cambia cómo se dice que no.
- **B.** La regla única sólo para el registro y el cambio, que es lo que
  pide la tarea. Al panel le agrego únicamente el límite de 72 bytes, para
  que no dé 500, y el resto queda como está.

Las dos cumplen la tarea. La A deja un solo lugar, que es lo que tu freno
buscaba.

### Los 72 bytes: lo que elijo (no te frena)

**Reproducido** sobre una base recién creada, con 73 letras «a»:

| pedido | hoy |
|---|---|
| ingresar | 500 |
| registrarse | 500 |
| cambiar a una de 73 | 500 |
| cambiar, con la actual de 73 | 500 |

**Elijo rechazarla, sin truncar y sin cambiar cómo se guarda nada:**

- **registro, cambio y panel:** 422 con un mensaje claro, del estilo de «La
  contraseña puede tener hasta 72 letras sin acentos; las letras con acento
  y la ñ ocupan más». El texto final va en la entrega;
- **ingreso:** «Email o contraseña incorrectos», como cualquier contraseña
  equivocada. Ninguna contraseña guardada con bcrypt 5 puede tener más de 72
  bytes, así que no hay ninguna que pueda ser correcta.

**Descarté:**

- truncar en silencio, como hacía bcrypt 4: dos contraseñas distintas
  entrarían igual;
- calcular un hash antes de bcrypt: cambia cómo se guardan las contraseñas
  ya creadas, que es tu segundo freno.

**Tu segundo freno no se activa: no hay que cambiar ninguna contraseña
guardada.**

- Desde `SEC-2` (27/08), bcrypt 5.0 no deja guardar más de 72 bytes.
- Antes, bcrypt entraba sin versión fija, a través de `passlib`. Si era la
  4, truncaba. Una cuenta creada así con más de 72 bytes hoy recibe un 500 y
  pasaría a recibir «incorrecta».
- No puedo saber qué versión tenía producción. En la base local no hay
  ninguna.

### Las sesiones abiertas (lo pediste para el informe)

**Cambiar la contraseña no cierra ninguna sesión.**

- Los tokens no llevan nada de la contraseña, y no hay revocación.
- El de acceso dura `ACCESS_TOKEN_MINUTES`. En el código vale 24 horas, y en
  `.env.example`, 15 minutos. El valor de producción está en Railway y no lo
  veo.
- **El de renovación dura 30 días, y cada renovación emite uno nuevo de 30
  días** (`auth.py:508`). Una sesión abierta en otro dispositivo que se
  renueva al menos una vez por mes **no vence nunca**, aunque la contraseña
  cambie.
- Es justo el caso de las dos contraseñas que quedaron en los chats: si
  alguien abrió sesión con ellas, cambiarlas no lo saca.

Queda fuera de esta tarea, como dijiste. Te recomiendo una pieza chica
después: guardar en la cuenta cuándo cambió la contraseña y no aceptar
tokens emitidos antes.

### Mientras decidís

No escribo código. Cuando elijas, implemento la opción, la pantalla, los
casos, los negativos y la guía, como pide la tarea.
