# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** El token ya no aparece en **ninguna** petición: ni en la del
documento. El caso 37 lo exige sobre el total, no sólo sobre la API.

El cambio destapó un defecto de producto que sólo se ve en el navegador. Está
abajo, en desvíos.

## 2. Commit y alcance real

`ccc0794`, este informe aparte. Cuatro archivos, los que indicaste.

| Archivo | Qué |
|---|---|
| `backend/app/services/verificacion.py` | el enlace pasa a `/verificar-correo#token=…` |
| `src/components/Pages/VerifyEmailPage.tsx` | lee el fragmento, lo limpia antes de llamar, y atiende el cambio de fragmento |
| `index.html` | fuera el `meta referrer`; el archivo quedó igual a como estaba en `cb6d888` |
| `scripts/smoke.mjs` | lector del correo y vigilancia total del token |

El cuerpo del `POST /auth/verify-email` no cambió: el token sigue viajando ahí
y no aparece en respuestas ni en registros.

## 3. Evidencia

### Antes y después, medido

Con el token vigilado en el caso 37:

```text
CON QUERY (la pieza anterior, revertida a propósito):
  [FAIL] 37 — 4 peticiones llevaron el token:
    http://localhost:5173/verificar-correo?token=c3QGbHcnloGcuDRQQakqqE_…
    http://localhost:5173/@vite/client              [en Referer]
    http://localhost:5173/src/main.tsx?t=…          [en Referer]
    http://localhost:5173/@react-refresh            [en Referer]

CON FRAGMENTO:
  [PASS] 37 — … 0 peticiones con el token, ni la del documento; barra limpia
    tras confirmar, recargar y salir al login
```

Las cuatro desaparecen. Para aislar la comprobación tuve que revertir la pieza
entera al query —enlace, lector y expresión del correo—, porque revirtiendo
sólo el enlace el caso fallaba antes, al no encontrar token en el fragmento.

El correo sale así: `http://localhost:5173/verificar-correo#token=LsZecbGn…`

### El `meta referrer`

Retirado. `index.html` quedó **idéntico** a como estaba antes de que yo lo
tocara. Tenías razón: con el token fuera del query no protegía ningún token, y
una política global redundante es efecto lateral sin beneficio.

## 4. Desvío — un defecto que el fragmento introduce

**Abrir un segundo enlace estando ya en esa pantalla no recarga la página.**
Cambia sólo el fragmento, así que React no vuelve a montar, el efecto no
corre y la vista sigue mostrando **el resultado del enlace anterior**.

No es un problema de la prueba: le pasa a cualquiera que abra un enlace, se
quede en la pantalla y abra después el que le llegó por el reenvío. Vería el
rechazo del primero y creería que el segundo tampoco sirve.

El caso 37 lo agarró apenas cambié el formato:

```text
[FAIL] 37 — el vencido no se anuncia como tal:
  "El enlace no es válido. Pedí uno nuevo desde el ingreso."
```

Ese texto era la respuesta del enlace **anterior**. Lo cerré escuchando
`hashchange` y llevando el control de un solo uso a «último token procesado»
en vez de un booleano, así que un token distinto se procesa y el mismo no se
gasta dos veces. Está dentro de los cuatro archivos.

## 5. Estado final

| Comprobación | Resultado |
|---|---|
| Suite oficial, base recreada desde cero | **37/37** |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |
| `npm run a11y -- --todas` | **44 de 44**, 0 de cualquier impacto |
| `npm run contraste` | **36 de 36**, 0 fuera de umbral |

Las dos últimas no hacían falta según tu nota, pero el texto de esa pantalla
cambia según el estado y preferí no declararlas verdes de memoria.

## 6. Un detalle menor que dejo señalado

`a11y.mjs` y `contraste.mjs` abren esa vista con `?token=enlace-invalido-…`.
Con el lector nuevo eso ya no es un token inválido sino un **enlace sin
token**, así que las dos puertas miden el estado «incompleto» en vez del
«inválido». Las dos siguen verdes porque el marcador y los colores son los
mismos, pero dejaron de ejercitar el estado que decían ejercitar.

Son dos líneas —cambiar `?` por `#`—, y quedan fuera de los cuatro archivos que
autorizaste. **No las toqué.** Decime si las alineo ahora o si va con la
próxima pieza que toque esos guiones.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado.
