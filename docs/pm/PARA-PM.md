# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** La suite pasa de 32 a **37 casos**. Los seis grupos de pruebas
obligatorias están cubiertos.

Antes de nada: tenías razón con transportistas. Las dos preguntas están
cerradas en `DECISIONS.md` desde el 05/08 y yo las levanté leyendo una sección
vieja. No vuelvo sobre eso.

## 2. Commit y alcance real

`cb6d888`, este informe aparte. Veinticinco archivos, cinco nuevos.

| Archivo | Qué |
|---|---|
| `models/email_verification.py` + migración `c7d2e9a4f1b6` | tabla de tokens |
| `services/verificacion.py` | emitir, reenviar y consumir |
| `services/correo.py` | los dos transportes |
| `api/auth.py`, `core/dependencies.py`, `schemas/auth.py` | alta pendiente, verificar, reenviar y el cierre de los caminos de sesión |
| `core/config.py` + las dos plantillas | variables de correo |
| `src/components/Pages/VerifyEmailPage.tsx` | la vista del enlace |
| `RegisterModal`, `LoginModal`, `AuthContext`, `App`, `Header`, `types` | aviso pendiente, motivo real y reenvío |
| `scripts/smoke.mjs`, `a11y.mjs`, `contraste.mjs` | casos 33 a 37 y las vistas nuevas en las dos puertas |

Sin recuperación de contraseña, cambio de email, OAuth, captcha ni proveedor
pago. Sin tocar perfiles, transportistas, pagos, catálogo ni despliegue.

## 3. Modelo de amenaza

Lo que esta pieza tiene que impedir, y cómo:

| Amenaza | Qué lo impide |
|---|---|
| leer la base y confirmar cuentas ajenas | se guarda `sha256`, nunca el token. El caso 33 busca el token en claro en la tabla y exige **cero** filas |
| adivinar un token | `secrets.token_urlsafe(32)`, 256 bits |
| reusar un enlace | `consumed_at`, y el consumo es un `UPDATE` condicional |
| dos clics simultáneos | el mismo `UPDATE`: la segunda transacción reevalúa la condición y afecta 0 filas |
| un enlace viejo que sigue sirviendo | el reenvío sella `invalidated_at` en todos los pendientes |
| entrar sin confirmar con un token anterior | `login`, `refresh`, `get_current_user` y el acceso opcional miran `is_verified` |
| averiguar qué correos están registrados | el reenvío responde **el mismo texto** exista o no la cuenta |
| que el token quede registrado | viaja en el cuerpo y no en la URL de la API; ningún transporte escribe el cuerpo en los logs |

## 4. Contrato de cada endpoint

| Endpoint | Entra | Sale |
|---|---|---|
| `POST /auth/register` | igual que antes | **201 sin tokens ni cookies**: `email`, `verification_required`, mensaje. Si el correo no sale, **503 y no se crea la cuenta** |
| `POST /auth/verify-email` | `{token}` en el cuerpo | 200 con mensaje; 400 con motivo propio para vencido, ya usado e inválido |
| `POST /auth/resend-verification` | `{email}` | **200 siempre, con el mismo texto** |
| `POST /auth/login` | igual | 403 con el motivo si falta confirmar |
| `POST /auth/refresh` y protegidas | igual | 403 con el mismo motivo |

Ningún caso termina en 500 ni deja sesión.

## 5. Evidencia

### El correo del outbox, tal cual queda

```text
From: TopGreen <no-responder@topgreen.local>
To: prueba@ejemplo.com
Subject: Confirmá tu correo en TopGreen
Content-Transfer-Encoding: 8bit

Creaste una cuenta en TopGreen. Para poder ingresar, confirmá tu correo entrando en este enlace:

http://localhost:5173/verificar-correo?token=iy2qELWPV4nCxi6sLrCil0z8cmj5Lv7ozNiEY0j75t0

El enlace vence en 24 horas y sirve una sola vez.
```

Ese `8bit` es deliberado. Con la codificación por defecto el enlace salía como
`token=3D…` y **cortado por un salto blando**, así que ni una persona ni la
suite podían copiarlo. Sigue siendo un correo válido.

### Los cinco casos

```text
[PASS] 33 — HTTP 201 sin tokens, hash de 64 y vigencia de 1 day en base,
  token en claro ausente, login HTTP 403 con el motivo
[PASS] 34 — 1 de 2 verificaciones simultáneas aceptada, 1 consumo en base,
  login HTTP 200 y reutilización HTTP 400
[PASS] 35 — vencido HTTP 400; reenvío con 1 usuario, token viejo HTTP 400 y
  nuevo HTTP 200; respuesta idéntica para desconocido y verificado, sin
  correos de más
[PASS] 36 — /auth/me, /products/my y /auth/refresh en HTTP 403 con el motivo;
  el mismo token funciona una vez confirmada la cuenta
[PASS] 37 — aviso con el correo y sin sesión local; login HTTP 403 con motivo
  y reenvío; enlace viejo rechazado, nuevo confirmado y sesión recién después
```

El **34** lanza las dos verificaciones con `Promise.all` sobre el mismo token y
exige que se acepte **exactamente una** y que la base registre **un** consumo.
El **35** envejece el token un segundo más allá de las 24 horas por SQL. El
**36** emite un token de sesión a mano, porque por la API ya no se consigue
ninguno sin confirmar.

### Migración

| Prueba | Resultado |
|---|---|
| desde base limpia | 7 migraciones, `alembic check` sin diferencias |
| sobre base con datos, un usuario puesto en `false` a mano | quedan **0** sin verificar |

Los usuarios que ya existían quedan verificados. Es una decisión explícita y
está escrita en la migración: el requisito es para las altas nuevas y no puede
dejar afuera a quien ya venía usando la plataforma.

### Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **37/37** |
| `npm run a11y -- --todas` | **44 de 44**, 0 de cualquier impacto |
| `npm run contraste` | **36 de 36**, 0 textos fuera de umbral |
| `npm run build` y `alembic check` | verdes |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

Las dos puertas subieron: 40→44 pantallas y 34→36 mediciones, por el aviso de
correo pendiente y la vista del enlace.

## 6. Desvíos, riesgos y hallazgos

**Un hallazgo de contraste, en una vista que no es mía.** Mi vista reusaba los
círculos de ícono de la pantalla de resultado de pago y el barrido la marcó en
rojo: glifo blanco sobre el ámbar da **2,15:1** contra un mínimo de 3:1. Al
medir los tres fondos, el verde de éxito también falla: **2,54:1**. Saqué el
círculo de mi vista —es decorativo y el estado ya lo dicen el título y el
mensaje—, pero **`PaymentResultPage` sigue con esos tres fondos y no está en el
inventario del barrido**. Es deuda previa, no la abrí.

**Una consecuencia de sacar las `ADMIN_*` que conviene tener presente.** Un
`backend/.env` de una copia anterior que todavía las conserve ya no arranca.
Me pasó en mi propio entorno. Quedó avisado en la guía.

**Dos errores míos, los dos encontrados corriendo.** Al extender la puerta de
accesibilidad usé el nombre de constante equivocado para la URL y armé el
correo de prueba con `${medida}`, que es un objeto: el alta fallaba con un
correo inválido y la pantalla nueva nunca se abría. La puerta lo detectó y
falló, que es para lo que la arreglamos.

**Y uno de higiene que casi ensucia la entrega.** Varias ediciones con Python
convirtieron archivos de CRLF a LF, y `diff --check` saltó con un diff enorme
de espacios finales ajenos. Lo reparé realineando por contenido: cada línea que
ya existía recuperó su terminador de origen. El diff quedó en 25 archivos.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

## 7. DECISIÓN SOLICITADA

**a) Los círculos de ícono de `PaymentResultPage`** (punto 6). Beneficio: tres
estados dejan de tener un glifo por debajo del mínimo. Esfuerzo: chico, es
oscurecer dos gradientes; sumar esa pantalla al barrido es un poco más.
Riesgo: toca una pantalla del flujo de pagos, que se rehace en Fase 4.
**Recomiendo esperar a Fase 4** y arreglarlo cuando esa pantalla se toque, para
no pagarlo dos veces.

**b) `EMAIL_TRANSPORT` en Railway.** Hoy el default es `outbox`, que en un
servidor escribe correos en disco y no manda nada. Antes de cualquier
despliegue con usuarios reales hay que fijar `smtp` y sus credenciales. Lo dejo
señalado; si el ensayo de Railway entra antes del 18/08, lo incluyo ahí.

El entorno local sigue levantado.
