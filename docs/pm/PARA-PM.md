# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Los tres hallazgos corregidos**, cada uno con su rojo forzado antes del
verde. La suite sigue en **37 casos**: el 35 y el 37 crecieron en vez de
aparecer casos nuevos, como pediste.

Los tres eran reales. El primero además contradecía un comentario que yo mismo
había escrito en el código.

## 2. Commit y alcance real

`7262955`, este informe aparte. Cinco archivos.

| Archivo | Qué |
|---|---|
| `src/components/Pages/VerifyEmailPage.tsx` | el token sale de la barra antes de llamar a la API, y salir deja la URL en `/` |
| `index.html` | `<meta name="referrer" content="strict-origin">` |
| `backend/app/api/auth.py` | el reenvío deja de delatar cuentas cuando el correo falla |
| `scripts/smoke.mjs` | las tres comprobaciones nuevas en los casos 35 y 37 |

Sin refactor de autenticación, sin rate limiting, sin colas ni proveedores, sin
tocar pagos.

## 3. Hallazgo 1 — el token en registros normales

### Lo reproduje y era peor de lo que viste

Con la configuración por defecto —sin `VITE_API_URL`, o sea `/api` por el proxy
y todo del mismo origen— el token viajaba en **cuatro** peticiones:

```text
GET /verificar-correo?token=nAmLSfDXLPGxBw7      [en la URL]
GET /@vite/client                                 [en Referer: …?token=nAmL…]
GET /src/main.tsx                                 [en Referer: …?token=nAmL…]
GET /@react-refresh                               [en Referer: …?token=nAmL…]
URL de la barra tras verificar: …/verificar-correo?token=nAmLSfDXLPGxBw73…
```

Lo que vos viste en la llamada de verificación es el mismo defecto; los
subrecursos del documento lo agravan.

### Dos arreglos, porque uno solo no alcanzaba

**`history.replaceState` antes de llamar a la API**, como pediste. Resuelve la
llamada de verificación, la barra y la recarga.

**No resuelve los subrecursos**: se piden mientras el documento se parsea,
antes de que React monte. Por eso agregué `<meta name="referrer"
content="strict-origin">`: ninguna petición manda ruta ni query en `Referer`,
sólo el origen. En el `dist` compilado el meta queda **antes** del script y de
la hoja de estilos, así que los cubre a los dos.

Después del arreglo quedan dos apariciones en desarrollo y **una sola en
producción**:

| Petición | Después | En producción |
|---|---|---|
| `GET /verificar-correo?token=…` | sigue | **sí**, es el enlace mismo |
| `@vite/client` en `Referer` | sigue | **no**, es el servidor de desarrollo y no se despliega |
| `src/main.tsx`, `@react-refresh` | resueltas | — |
| barra del navegador | limpia | limpia |

Nada de esto lo verifiqué de palabra: está en el caso 37.

### Lo que queda, y por qué no lo cerré solo

**El `GET` del documento sigue llevando el token**, y eso entra en el registro
de acceso de quien sirva el frontend. Es inherente a un enlace con el token en
el query. Se elimina del todo poniéndolo en el **fragmento** —`#token=…`—, que
el navegador nunca manda al servidor. Son cuatro líneas: el armado del enlace y
la lectura en la vista.

No lo hice porque tu instrucción decía query más `replaceState`, y cambiar el
formato del enlace es una decisión de diseño, no una corrección. Va como
decisión abajo.

## 4. Hallazgo 2 — el 503 enumeraba cuentas

Con el transporte roto, antes:

```text
inexistente  -> HTTP 200  {"message":"Si el correo corresponde a una cuenta…"}
pendiente    -> HTTP 503  {"detail":"No pudimos enviar el correo…"}
verificado   -> HTTP 200  {"message":"Si el correo corresponde a una cuenta…"}
```

Después:

```text
inexistente  -> HTTP 200  {"message":"Si el correo corresponde a una cuenta…"}
pendiente    -> HTTP 200  {"message":"Si el correo corresponde a una cuenta…"}
verificado   -> HTTP 200  {"message":"Si el correo corresponde a una cuenta…"}
```

Hay `rollback` y queda `reenvio_de_verificacion_sin_enviar` en el registro
interno, **sin dirección ni token**.

**El alta conserva su 503 con reversión**, como autorizaste: ahí todavía no hay
cuenta que enumerar. Comprobado con el transporte caído: HTTP 503 y los
usuarios quedaron en 15 → 15.

### Cómo se fuerza el transporte roto sin ensuciar el producto

No agregué ningún interruptor de fallo: sería una puerta trasera permanente.
Tampoco rompo la carpeta del outbox, porque bajo Docker es un montaje del host
y cambiarla afuera no rompe nada adentro. El caso llama al **endpoint real**
con `TestClient`, en el proceso de la aplicación, sustituyendo sólo el
transporte, y compara código y cuerpo de los tres estados.

## 5. Hallazgo 3 — el vencido en navegador

Tenías razón: el 37 abría un enlace **invalidado por reenvío**, no vencido.
Ahora emite otro, lo envejece por SQL 24 h y 1 segundo, abre el enlace y exige
el mensaje de vencimiento y el formulario de reenvío. Los dos estados quedan
cubiertos y son distintos.

## 6. Los tres rojos, antes del verde

```text
[FAIL] 37 — el token quedó en la barra:
  http://localhost:5173/verificar-correo?token=s0GBs01fhCWgvQeoncfm2D-…
     (con replaceState desactivado)

[FAIL] 35 — con el transporte caído los estados difieren: 200, 503, 200
     (con el 503 del reenvío reintroducido)

[FAIL] 37 — el vencido no se anuncia como tal:
  "Listo, Nav Smoke. Ya podés iniciar sesión."
     (sin envejecer el token: el enlace todavía servía)
```

El tercero es el que más me importa: prueba que el caso llega a un token
**realmente vencido** y no a otro estado parecido.

## 7. Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **37/37** |
| `npm run a11y -- --todas` | **44 de 44**, 0 de cualquier impacto |
| `npm run contraste` | **36 de 36**, 0 textos fuera de umbral |
| `npm run build`, `alembic check` | verdes |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

Corrí la suite **sin `.env.local`**, o sea con el frontend hablando por el
proxy y todo del mismo origen. Es la configuración donde el `Referer` filtraba,
así que es la que había que probar.

## 8. Desvíos

**Sin desvíos.** El `meta referrer` es un archivo más de los que anunciaste,
pero es la otra mitad del hallazgo 1 y sin él el arreglo quedaba a medias.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

## 9. DECISIÓN SOLICITADA

**Una sola: el token en el fragmento del enlace.** Beneficio: desaparece la
última aparición del token en un registro de servidor, la del `GET` del
documento. Esfuerzo: cuatro líneas. Riesgo: cambia el formato del enlace que
recibe la gente y hay que actualizar el caso 37; no vi clientes de correo que
rompan un fragmento, pero es un cambio de forma. Fase: ahora, mientras la pieza
está fresca. **Recomiendo hacerlo**, porque el registro de acceso del frontend
es un lugar donde nadie va a buscar un token y donde va a quedar por meses.

El entorno local sigue levantado.
