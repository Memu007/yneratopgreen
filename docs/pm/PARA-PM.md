# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-27. Vigésimo séptimo informe: **SEC-1, la credencial deja de
escribirse en la consola**.

Un commit de producto y este informe.

| Commit | Qué trae |
|---|---|
| `d8ce32a` | Los logs que exponían, retirados; el caso 129 que lo vigila |
| este | Este informe: el commit inmediatamente posterior a `d8ce32a` en `main` |

Pediste los dos hashes. El del producto es `d8ce32a`. El de este informe no lo
puedo escribir adentro de sí mismo —cualquier valor que ponga cambia el hash
que lo contiene—, así que lo digo por su lugar: es el siguiente en `main`, y va
en el mismo empujón.

---

## 1. Qué estaba expuesto

`src/contexts/AuthContext.tsx`, en el `login`, escribía cuatro líneas seguidas:

```
console.log('🔄 Intentando login con:', email);
console.log('✅ Respuesta del backend:', response);
console.log('✅ Usuario transformado:', frontendUser);
console.log('✅ Login exitoso');
```

La segunda es la grave: `response` es la respuesta entera de `/auth/login`, con
`access_token`, `refresh_token`, `token_type` y el usuario completo. La primera
escribe el correo con el que se entra —también cuando el ingreso se rechaza—.
La tercera vuelve a escribir el usuario ya mapeado: teléfono, WhatsApp,
ubicación, CBU y alias bancario.

Eso lo lee cualquier cosa que corra en la misma página: una extensión del
navegador, un script de terceros, alguien parado atrás de la pantalla del
soporte técnico. No es un riesgo teórico y por eso no espera a la Fase 5.

La contraseña **no** estaba en la consola: no se registra en ningún punto.

## 2. Qué relevé antes de tocar

Los 60 `console.*` del frontend, uno por uno. El resultado:

- **Los cinco del `login`** en `AuthContext.tsx` son los que exponen.
- **`LoginModal.tsx:37`** registraba el objeto `err` del ingreso fallido. Hoy
  ese objeto es un `Error` con el mensaje que se le muestra a la persona
  —`apiFetch` lanza `new Error(mensaje)` y nunca adjunta el cuerpo de la
  respuesta—, así que no expone nada. Igual lo endurecí: es la misma línea de
  código en el mismo flujo y cuesta una línea dejar de arrastrar el objeto.
- **Los otros 54** son `console.error('...:', error)` de pantallas de catálogo,
  panel y administración. Registran errores, no credenciales, y son logs
  operativos: no los toqué.
- Quedan dos `console.log` en `App.tsx` —el término buscado y el formulario de
  una publicación nueva— que son rastro de depuración pero no llevan
  credenciales ni datos de cuenta. Los dejo anotados y sin tocar: la orden pide
  el mínimo para este hallazgo, no una auditoría general.

Revisé también el flujo completo: `loadCurrentUser`, `register`, el refresh
automático de `api.ts` y el `logout` no escriben nada. Y de paso miré el
backend: no hay ningún `logger` que imprima tokens ni contraseñas.

## 3. Qué cambié

Tres archivos, nada más.

| Archivo | Cambio |
|---|---|
| `src/contexts/AuthContext.tsx` | Se van las cuatro líneas del `login`. El `console.error` del fallo se queda pero registra el **mensaje** y no el objeto. |
| `src/components/Auth/LoginModal.tsx` | Mismo criterio: el mensaje, no el objeto. |
| `scripts/smoke.mjs` | Caso 129, nuevo. |

No moví tokens fuera de `localStorage`, no toqué cookies, CSRF, OAuth,
expiraciones, endpoints ni contratos. El modelo Bearer/localStorage del cierre
`6ece3fb` queda como está. Ninguna dependencia nueva. Ningún cambio visual.

## 4. La regresión: cómo mira

Escuchar el evento `console` de Playwright **no alcanza**: cuando el argumento
es un objeto, el evento entrega `JSHandle@object` y el token no aparece. Con
eso, la fuga habría pasado desapercibida.

El caso 129 espía la consola **desde adentro de la página**: envuelve
`log`, `info`, `debug`, `warn`, `error`, `trace`, `table` y `dir` antes de que
corra cualquier script, serializa cada argumento —incluidos los `Error`, que
`JSON.stringify` deja en `{}`— y guarda el texto. Es exactamente lo que ve
quien está en el mismo documento. El evento de Playwright se mira igual, como
segunda red.

Después de un ingreso real, exige que no aparezca ninguno de estos valores, en
ningún nivel: el **access token** y el **refresh token** que quedaron
guardados, la **contraseña**, el **correo de ingreso** y el **identificador de
la cuenta** —que es la huella del objeto usuario, esté en la forma del backend
o en la del frontend—. Y por forma: ninguna de las claves `access_token`,
`refresh_token` o `token_type`.

Además comprueba que nada de esto se arregló rompiendo la autenticación:

1. el ingreso deja el par de tokens y la cuenta en la cabecera;
2. una pantalla protegida —el panel— abre con la sesión;
3. **el refresh automático sigue vivo**: se rompe a propósito el access token
   guardado, se pide algo protegido que no sea de `/auth/`, y el caso exige que
   el token se renueve solo, que la sesión no se caiga y que el token nuevo
   tampoco aparezca en la consola;
4. `Salir` borra el par y devuelve `Ingresar`;
5. un **ingreso rechazado** no escribe el correo ni la contraseña que se
   intentaron, y no guarda ningún token.

## 5. Rojo y verde

**En rojo**, con el árbol sin tocar —sólo el caso agregado—:

```
$ SMOKE_CASOS=129 node scripts/smoke.mjs
[FAIL] 129 El ingreso no deja la credencial escrita en la consola del navegador
  — el access token quedó impreso en la consola; el refresh token quedó impreso
    en la consola; el correo de ingreso quedó impreso en la consola; el
    identificador de la cuenta quedó impreso en la consola; la consola imprimió
    la respuesta de autenticación
--- consola ---
log: 🔄 Intentando login con: cliente@ejemplo.com
log: ✅ Respuesta del backend: {"user":{"id":"a6823944-…","email":"cliente@ejemplo.com",
     "full_name":"María Cliente","phone":"+54 11 9876-5432",…
0/1 pasaron; 1 fallaron
```

Cinco de las seis afirmaciones fallan. La sexta —la contraseña— pasa desde el
primer día porque nunca se registró.

Restauré el árbol antes de implementar: la rotura no está versionada en ningún
commit.

**En verde**, después del cambio:

```
$ SMOKE_CASOS=129 node scripts/smoke.mjs
[PASS] 129 El ingreso no deja la credencial escrita en la consola del navegador
1/1 pasaron; 0 fallaron
```

## 6. Puertas, desde base limpia

Base recreada —migraciones y seed— y después las puertas, encadenadas sobre
esa misma base.

| Comando | Resultado |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | 0 errores, 0 advertencias (`--max-warnings 0`) |
| `node scripts/smoke.mjs` | **129/129**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

No corrí contraste, a11y ni hito: este cambio no toca una sola línea de estilo
ni de marcado, y sus tres archivos no aparecen en el alcance de esas puertas.
Si las querés igual, las corro.

## 7. Riesgos que quedan

Digo lo que **no** cierra esto, para que no quede la sensación de que el tema
está resuelto:

1. **Los tokens siguen en `localStorage`.** Cualquier script que corra en la
   página los lee de ahí, con consola o sin consola. Sacar el log angosta la
   exposición —ya no quedan escritos en un lugar que se copia y se pega en un
   ticket de soporte— pero no la elimina. El modelo Bearer/localStorage es el
   aceptado en `6ece3fb` y la orden dice explícitamente no rediseñarlo.
2. **La prueba mira la consola, no la red.** El par de tokens sigue viajando en
   la respuesta de `/auth/login`, que es donde tiene que estar, y se ve en la
   pestaña de red del navegador como en cualquier aplicación. Eso no es una
   fuga; lo aclaro para que la prueba no se lea como más de lo que prueba.
3. **Quedan los dos `console.log` de `App.tsx`.** No llevan credenciales. Si
   querés que se vayan, es una línea y otro commit.
4. **La prueba cubre el flujo del navegador.** No mira los logs del servidor
   —los revisé a mano y están limpios— ni el almacenamiento del navegador.

## 8. Freno

No hubo nada que me obligara a frenar: la fuga se cerró sin tocar el modelo de
sesión, no encontré secretos emitidos por el backend ni por una dependencia, y
la prueba se escribió con la infraestructura que ya estaba.

La aceptación visual de UX-2D.1 sigue pendiente de Emi y esta pieza no la toca.
No desplegué.
