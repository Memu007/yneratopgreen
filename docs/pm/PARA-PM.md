# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-11.

## 1. Resultado

**Terminado.** El commit de producto es **`c5d2caa`**; este informe va aparte y
su hash te lo digo abajo. La suite pasa de 39 a **40 casos** y el barrido de
accesibilidad de 44 a **46 pantallas**.

Antes que nada: **tenés razón con el hash.** El informe anterior decía
`d4623b4` porque escribí el número antes de rebasar sobre tu commit, y el
rebase lo reescribió a `c484513`. Es un error mío de procedimiento, no una
confusión de contenido. Desde ahora anoto el hash después de rebasar.

## 2. Causa

El formulario del panel nunca leía la cuenta. Arrancaba con constantes:

```ts
phone: '+54 9 11 5555-4444',
whatsapp: '+54 9 11 5555-4444',
province: 'Buenos Aires', city: 'CABA', address: 'Av. Corrientes 1234',
```

y guardaba `location` como `` `${address}, ${city}, ${province}` ``. De ahí
salen los tres defectos, que son el mismo:

1. abrir edición y guardar **escribía datos falsos** sobre una cuenta real;
2. una ubicación que no tuviera exactamente tres partes **no sobrevivía**:
   `"Rosario, Santa Fe"` se convertía en `"Av. Corrientes 1234, CABA, Buenos
   Aires"`;
3. el email y el WhatsApp eran controles que **aparentaban guardar** y el
   envío ignoraba.

## 3. Qué hice

**Una sola función arma el formulario** desde la cuenta y desde nada más. Lo
que no está guardado empieza vacío. La usan la hidratación y el cancelar, así
que no pueden divergir: cancelar devuelve **todos** los campos —generales y de
transporte— al último estado guardado.

**La ubicación pasa a ser un campo de texto libre que se conserva tal cual.**
Es la única representación reversible con el dato de hoy: `users.location` es
un `String(255)` libre, y cualquier partición en tres pierde información en
cuanto el texto tiene dos partes, cuatro, o una coma dentro de la calle. Sin
padrón nuevo, sin campos nuevos y sin migración. **No cambié el formato de lo
ya guardado**: el consumidor que parte por comas para mostrar la ubicación del
vendedor sigue viendo exactamente la misma cadena.

**El email queda de sólo lectura.** No existe endpoint que lo cambie, y
cambiarlo exigiría reconfirmarlo: es una pieza propia, no un campo. **El
WhatsApp sí se envía ahora**, que era el arreglo correcto para ese otro control
ignorado.

**Un cambio chico en el backend que hacía falta.** `PATCH /auth/me` guardaba la
cadena vacía tal cual. Entonces una cuenta sin teléfono que abría y guardaba
sin tocar nada pasaba de "sin dato" a "cadena vacía": mismo dibujo, otro valor
en base y otra respuesta de la API. Ahora un texto vacío se guarda como
ausente en teléfono, WhatsApp, biografía y ubicación, **igual que ya se hacía
con CBU y alias**. Sin eso no se puede cumplir "conservar exactamente el valor
persistido, incluso si está vacío".

## 4. El barrido encontró algo apenas se lo abrió

Incorporé el modo edición al barrido en las dos medidas, con marcador propio
(`#perfil-nombre`) y comprobando además la vuelta a lectura. En la primera
corrida, esto:

```text
[serious] color-contrast
  2 elementos en: escritorio/panel: edición de perfil, celular/panel: edición
  · ._cancelButton_…  <button>Cancelar</button>
```

El botón **Cancelar** usaba `#666` sobre `#f0f0f0`: 5,04:1, que pasa. Pero el
puntero queda encima del botón apenas se entra en edición, y sobre el fondo del
hover —`#e0e0e0`— da **4,34:1**. Lo pasé a `#555`: **6,54:1** en reposo y
**5,65:1** en hover, así cumple en los dos estados. Es exactamente lo que
anticipaste: la pantalla podía quedar verde sin abrirse nunca.

**Probé que la puerta falla si no abre.** Rompí la navegación a edición a
propósito y el comando cortó, sin declararla medida:

```text
Error: No llegué a «panel: edición de perfil» en escritorio: el marcador de la
pantalla no apareció. La puerta no puede medir lo que no abrió.
```

Restauré el guion. La rotura no está versionada.

De paso, ya que tocaba este archivo, **alineé el marcador `?token=` a
fragmento**, como pediste que se hiciera cuando estos guiones se volvieran a
tocar. El de `contraste.mjs` sigue igual: no lo toqué en esta pieza.

## 5. La regresión

Caso **40**:

```text
[PASS] 40 El perfil no inventa datos y guardar sin cambios no pisa nada —
  sin constantes de ejemplo; "Rosario, Santa Fe" intacta al guardar sin
  cambios; cuenta vacía sigue nula en API y SQL; cancelar no reaparece
```

Dos cuentas reales, por el panel:

| Comprobación | Cuenta con datos | Cuenta sin datos |
|---|---|---|
| Lectura sin constantes de ejemplo | sí | sí |
| Los campos abren con lo guardado | los cuatro, exactos | los tres, **vacíos** |
| Guardar sin cambios | nombre, teléfono, WhatsApp y ubicación idénticos | siguen **nulos** en `/auth/me` y en SQL |
| No hay control de email | comprobado | — |
| Cancelar tras editar dos campos | vuelve a lo guardado y no reaparece al guardar | — |
| Cambio explícito de ubicación | guardado y contrastado con SQL | — |

La ubicación de prueba tiene **dos** partes a propósito: es el caso que se
perdía.

**Rojo forzado.** Devolví las constantes al formulario y el caso falló nombrando
el dato inventado:

```text
[FAIL] 40 — #perfil-telefono abrió con "+54 9 11 5555-4444" y no con
  "+54 341 555 0101"
```

Con eso corta antes de llegar a las comprobaciones de ubicación; aclaro el
alcance de ese rojo para no venderlo como más de lo que prueba: demuestra la
hidratación inventada, y la pérdida de la ubicación queda demostrada por la
comprobación verde de que `"Rosario, Santa Fe"` sobrevive, que con el guardado
anterior era imposible por construcción.

## 6. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada | **40/40** |
| Caso 40 con el formulario anterior | rojo, nombrando el dato inventado |
| `npm run a11y -- --todas` | **46/46** pantallas, 0 violaciones de cualquier impacto |
| Puerta de accesibilidad con la navegación rota | corta y no declara la pantalla |
| `npm run contraste` | 36/36 mediciones, 0 textos fuera de umbral |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

Corrí contraste sin que lo pidieras porque toqué un color; no repetí nada de
pagos, catálogo ni Railway.

**Sigue el bloqueo de Docker** de la entrega anterior: no hay imágenes en el
entorno y el registro devuelve `Forbidden`. La suite corrió sobre la
instalación nativa con el mismo puente en el `PATH` que te describí, sin
modificar `smoke.mjs`.

## 7. Riesgos y lo que queda afuera

**Un riesgo de producto, chico y consciente.** La ubicación es ahora un solo
campo libre. Se gana que nunca se pierda lo guardado; se pierde la sugerencia
visual de que hay que cargar provincia y ciudad. El texto de ejemplo del campo
la mantiene. Si querés ubicación estructurada de verdad, eso es padrón y
migración, y es una pieza aparte que hay que decidir.

**El bloque de transportista no entra al barrido.** Las tres cuentas del seed
no son transportistas, así que la pantalla medida es la de un usuario común y
mis controles nuevos de transporte quedan fuera. No lo resolví por mi cuenta
porque la salida limpia es un cuarto usuario demo transportista en el seed, y
eso es dato de producto. Decime si lo agrego.

**Nada más quedó abierto en esta pieza.** No toqué modelo de usuario, campos de
ubicación, directorio, pagos, catálogo ni Railway.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
