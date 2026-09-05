# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## FORM-CONSISTENCY-1 — un formulario no se contradice ni esconde su error

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `6837af1` — «FORM-CONSISTENCY-1: un formulario no se
  contradice ni esconde su error»
- La suite pasa a **151 casos**.

Los cinco bordes existían los cinco. Los medí uno por uno sobre la interfaz
real antes de tocar nada.

---

### 1. El rojo, medido contra `83dba0a`

```
B1 label «Email»       -> el clic no enfoca nada; htmlFor=null en los dos labels
B1 label «Contraseña»  -> idem
B2 error del registro  -> role=null, top=-381 en una ventana de 400 de alto
                          (fuera de vista), foco en «Crear cuenta»;
                          los valores escritos sí quedaban intactos
B3 edición del precio  -> guardó precio=0 en un servicio con pricing_type
                          «por_hora»; el alta no deja publicar eso
B4 imagen rechazada    -> 1 subida rechazada con 413 y el aviso fue
                          «Producto actualizado exitosamente»;
                          0 imágenes, 1 publicación, metadatos guardados
B5 tipos de carga      -> 1 pedido fallido; el grupo «Cargas que transportás»
                          quedó con 0 casillas, texto vacío y sin reintento
```

Y el caso 151 completo, contra el mismo árbol:

```
[FAIL] 151 … — el clic en el label «Email» dejo el foco en <div> «Ingresar»
```

### 2. Lo que cambié, por borde

**Login (B1).** `id`/`htmlFor` en Email y Contraseña. Nada más: no toqué el
copy ni abrí recuperación de contraseña.

**Registro (B2).** El error —propio o de la API— se anuncia con `role="alert"`,
se lleva a la vista y **recibe el foco**. Elegí enfocar la caja del error y no
el campo responsable: el error vive arriba del formulario y enfocar el campo lo
volvería a sacar de la pantalla, que es justo el defecto. Con la alerta enfocada
se ve y se anuncia, y de ahí se tabula al formulario. Lo escrito no se toca:
medido, nombre y contraseña siguen ahí.

**Precio (B3).** Una sola regla, en `src/publicaciones/precio.ts`:

```
producto                    -> precio explícito, mayor a cero
servicio (no «a convenir»)  -> precio explícito, mayor a cero
servicio «a convenir»       -> puede ir vacío o en cero
```

La aplican el alta y la edición, y el mensaje es uno solo para que no digan
cosas distintas por lo mismo. No cambié el contrato del Backend ni toqué la
doble fuente de ubicación de F6.

Una precisión honesta: en el **alta** el navegador llega primero. El campo de
precio es `type="number"` con `required`, así que un servicio «por hora» sin
precio ni siquiera envía el formulario, y `value={formData.price || ''}` hace
que un cero se dibuje vacío. La regla compartida es la segunda línea, y es la
que decide de verdad en la **edición**, donde el campo es `type="text"` y sin
`required`. Lo que el caso 151 comprueba es **la decisión** —publica / no
publica, guarda / no guarda—, no qué capa la tomó.

**Imagen parcial (B4).** El alta ya lo hacía bien —el caso 10 lo cerró— y la
edición no miraba `response.ok`. No inventé un criterio nuevo: moví el del alta
a `src/publicaciones/imagenes.ts` y ahora las dos pantallas usan el mismo
código y dan el mismo motivo. La edición informa:

```
La publicación se actualizó, pero no se pudo subir la imagen:
consistencia-151.png: La imagen supera el tamaño permitido.
Los demás cambios quedaron guardados.
```

No dice «exitosamente», no crea otra publicación y no revierte lo que ya se
persistió: medido, la descripción nueva quedó guardada, con cero imágenes y una
sola publicación.

**Tipos de carga (B5).** Sigue siendo opcional, pero el fallo se explica con el
motivo que devolvió el servidor y ofrece **Reintentar**. El grupo ya no se
dibuja rotulado y vacío. Con la API recuperada, un clic trae las opciones sin
cerrar ni reiniciar el registro: medido, 7 casillas y el nombre escrito seguía
ahí.

### 3. Un agregado que no me pediste

En la edición, una imagen **que no se pudo quitar** entraba a un
`console.error` y el aviso seguía siendo «actualizado exitosamente». Es la
misma mentira que la del punto anterior, así que entra en el mismo aviso
parcial. El caso 151 no lo mide —vos pediste el borde de la imagen nueva— y te
lo marco para que decidas si querés una regresión propia.

### 4. El caso 151

Autónomo, sobre la UI real, sin esperas fijas, y cubre los cinco bordes:

- clic en cada label del Login y contraste de `document.activeElement`;
- registro en una ventana de 1200×400: enviar desde el final deja el error
  anunciado, **dentro de la ventana**, enfocado y con los valores intactos;
- misma decisión de precio en las dos pantallas: la edición rechaza el cero
  «por hora» y lo acepta con «a convenir»; el alta no publica el servicio «por
  hora» sin precio y sí lo publica con «a convenir»;
- subida de imagen interceptada con 413: el aviso trae el motivo, no dice
  «exitosamente», y en la base quedan una publicación, cero imágenes y la
  descripción nueva;
- `/logistics/cargo-types` interceptado con 503: no hay grupo rotulado y vacío,
  la pantalla explica el motivo, hay Reintentar, y con la API sana el reintento
  trae las casillas sin perder lo escrito.

Para probar que el alta **no** publica sin esperar «a que no pase nada», el
caso espera una señal positiva: el foco que el navegador deja en el campo que
falta, y después comprueba en SQL que no se creó la publicación.

### 5. Puertas

```
base limpia + SMOKE_CASOS=151                   1/1
base limpia + suite completa                    150/151   (131 rojo)
  controles                                     10, 22 y 113 en verde
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
npm run a11y -- --todas                         64/64 pantallas, 0 bloqueantes
git -c core.whitespace=cr-at-eol diff --check   limpio
```

**Contraste no lo corrí**, como pediste: no cambié colores ni estilos. La caja
de error del registro reutiliza la clase `error` que ya existía y ya estaba
medida; no agregué ni un token nuevo.

El **131** es el ambiental de siempre: mi puente traduce `docker exec` y esa
receta necesita `docker run --rm -v … alpine:3`.

### 6. Hashes

```
src/publicaciones/precio.ts                     7e9ba7ed6fb397bb
src/publicaciones/imagenes.ts                   9b2c429679ae557e
src/components/Auth/LoginModal.tsx              e96862d58564a68b
src/components/Auth/RegisterModal.tsx           64e1d014f0c88e79
src/components/AddProduct/AddProductModal.tsx   8988c62dcc8ab1e6
src/components/UserDashboard/UserDashboard.tsx  3cd06953151d31f8
scripts/smoke.mjs                               072c11954abdeaf3
```

(SHA-256 truncado a 16, del árbol en `6837af1`.)

### 7. Riesgos residuales

1. **El foco va a la alerta y no al campo.** Es deliberado por lo que expliqué,
   pero significa un Tab más para volver al formulario. Si preferís el campo
   responsable cuando es inequívoco, es un cambio chico y el 151 lo mediría
   igual con otro control esperado.
2. **La matriz de precio no valida moneda ni máximos.** Sólo decide obligatorio
   contra opcional y mayor a cero. Un precio absurdo sigue siendo posible.
3. **El Backend no está atado a esta matriz.** No lo toqué, como pediste; si
   mañana la API aceptara un servicio «por hora» en cero por otra vía, la UI ya
   no lo dejaría pasar pero la regla seguiría viviendo sólo en el Frontend.
4. **El reintento de cargas depende de que el catálogo vuelva.** No hay
   reintento automático ni límite de intentos: es un botón y nada más.
5. El caso 151 deja tres publicaciones del vendedor en la base —el servicio, el
   producto y el servicio publicado desde el alta—, como el 145, el 147, el 148,
   el 149 y el 150 dejan las suyas.

### 8. Frenos

No toqué F6/ubicación, rechazo de comprobante, rating, copy general,
recuperación de contraseña, Backend, API, modelos, migraciones, seed, pagos,
navegación, la política de suciedad/capas, BOEDA, Railway ni datos remotos. No
desplegué. No agregué librería de formularios, ni otro sistema de alertas, ni
puertas traseras de prueba. `PRE_FIRMA.md` sigue fuera del versionado y lo
confirmé antes de empujar.

Freno acá y te pido revisión.
