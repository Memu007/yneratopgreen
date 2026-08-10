# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** `ca23451`, este informe aparte. La suite pasa de 37 a **38 casos**.

Gracias por cerrar Gate B y por traer el defecto con la evidencia puesta: el
diagnóstico que dejaste era exacto y me ahorró la mitad del trabajo.

## 2. Causa

`src/utils/api.ts`, en el manejador común de errores HTTP:

```ts
throw new Error(errorData.detail || `Error ${response.status}: …`);
```

FastAPI devuelve `detail` de dos formas. Para los errores de negocio, una
cadena. Para los de validación del cuerpo, **una lista de objetos**:

```json
{"detail":[{"type":"value_error","loc":["body","email"],
  "msg":"value is not a valid email address: …"}]}
```

`new Error(unaLista)` la convierte a cadena, y una lista de objetos se
convierte en `[object Object]`. No es un problema del registro: es de **todas**
las pantallas, porque ese manejador es el único camino de error de la
aplicación. El registro fue donde apareció porque es el formulario con más
validación.

Reproducido en el navegador antes de tocar nada:

```text
mensaje visible: "[object Object]"
```

## 3. Qué hice

Un normalizador en el cliente, donde estaba el defecto. Cuatro reglas:

| Forma de `detail` | Qué sale |
|---|---|
| cadena | **intacta** — es lo que preserva los mensajes de negocio |
| lista de errores de validación | `msg` de cada uno, con el último tramo de `loc` como nombre del campo |
| objeto suelto | el mismo tratamiento que un elemento de la lista |
| cualquier otra cosa, o vacío | `Error <código>` |

Los tres motivos que una persona puede encontrar desde los formularios
—correo inválido, campo demasiado corto, campo faltante— quedan en castellano.
**El resto conserva el texto de origen**, que es en inglés: preferí eso a
armar una tabla de traducciones que envejezca sin que nadie la mire. Si querés
el mensaje crudo de Pydantic también en esos tres, lo saco en una línea.

No exporté el normalizador: nada más lo usa y no hacía falta agrandar la
superficie del módulo.

**Un solo archivo de producto**: `src/utils/api.ts`. Sin tocar validación de
correo, backend, Railway, perfiles, catálogo ni textos comerciales.

## 4. Las regresiones

Caso **38**, con las dos formas por el mismo camino que usa la aplicación:

```text
[PASS] 38 Un error de validación se lee, no dice [object Object] —
  422 estructurado visible como "El correo no parece una dirección válida.
  Revisalo y probá d"; detalle de texto intacto en "Tu cuenta todavía no
  está confir"
```

- **Estructurado:** el caso comprueba primero que el backend devuelva el 422
  con la lista, y después abre el modal de registro con ese mismo correo y
  exige que el texto visible **no** contenga `[object Object]` y sí hable del
  correo. Para que la petición llegue al backend hay que aflojar el
  `type="email"`, porque si no el navegador corta antes.
- **Cadena:** un login sin confirmar, que responde 403 con `detail` de texto.
  Exige que el mensaje de negocio siga **idéntico**. Ése es el que protege lo
  que pediste conservar.

Con el manejo anterior el caso falla así:

```text
[FAIL] 38 — el registro sigue mostrando el objeto crudo: "[object Object]"
```

## 5. Estado final

| Comprobación | Resultado |
|---|---|
| Caso 38 | verde, y rojo con el código anterior |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |
| Suite completa, base recreada desde cero | **38/38** |

**Corrí la suite entera aunque pediste sólo las regresiones.** El motivo:
`api.ts` es el manejador de errores de **todas** las pantallas, así que el
alcance del cambio no es el registro sino la aplicación completa. Correr sólo
dos casos habría sido medir menos de lo que toqué.

De paso: al probar los casos 30 y 31 aislados fallaron por falta de estado de
casos anteriores, no por el cambio. En la corrida completa están verdes.

## 6. Riesgos

**Uno, y es de criterio.** Los mensajes de validación que no están en la lista
de tres salen con el texto de Pydantic en inglés, precedido por el nombre del
campo en castellano: por ejemplo `La contraseña: String should have at least 6
characters`. Es legible y es estable, pero es mestizo. Las alternativas son
traducir todo —tabla que se desactualiza— o no traducir nada. Elegí el medio;
decime si preferís otro.

**Sin desvíos.** Un commit, un archivo de producto, tres de prueba y conteo.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado.
