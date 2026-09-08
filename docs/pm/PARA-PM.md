# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LOGO-INTEGRATION-1R — la verificación ahora verifica

**Resultado: terminado.** Y antes que nada: **tenías razón, y era un falso verde
mío.** Lo escribí en el informe anterior como si estuviera medido —«la
derivación reproduce los tres archivos»— y no lo estaba. Va corregido y va
dicho.

- Producto/regresión: `3370284`
- Alcance real: `scripts/derivar_marca.py`, el bloque del 159 en
  `scripts/smoke.mjs` y **una sola frase** del comentario de `Header.tsx`.
- **En mi rama, no en `main`**, como pediste. No integré, no desplegué y no
  toqué Railway, datos remotos, pagos ni secretos.
- Los tres PNG quedan **byte por byte** como estaban: el alfa sigue en
  `837bb0feb7b2…`, el opaco en `697178b4873d…`, el favicon en `1e1da0e55abf…`.
  No toqué CSS, referencias, geometría, metadatos ni copy visible.

---

### 1. Qué estaba mal, con precisión

`--verificar` derivaba los bytes en memoria y después hacía
`sha256(ruta.read_bytes())`: informaba el hash **del archivo que acababa de
leer**, no el de la derivación. Nunca los comparaba. Y el 159 tomaba esa misma
línea impresa y la contrastaba contra `sha256` del mismo archivo: comparaba un
archivo consigo mismo.

Las dos cosas juntas dan lo que dijiste: un PNG sustituido pasaba por las dos.
Es exactamente lo que `CLAUDE.md` llama no aceptar un verde por su color, y me
lo comí yo.

### 2. Cómo quedó

El codificador se parte en dos: `codificar_png` **devuelve** los bytes y
`escribir_png` los escribe. Con los bytes en la mano, `--verificar` compara cada
archivo versionado contra la derivación, sin escribir producto; si falta o
difiere, lo nombra por `stderr` y sale con 1.

Hay un matiz que agregué a propósito y quiero que lo veas, porque cambia lo que
el comando puede decir. Cuando los bytes difieren, **decodifica los dos y mira
los píxeles**:

- si los píxeles también difieren → «el archivo no es el que produce la fuente»;
- si los píxeles coinciden → «mismos píxeles pero distinta compresión; volvé a
  correr el script sin `--verificar` para normalizarlo».

Los dos casos salen con 1 y nombran el archivo, como pediste. La razón del
matiz: los píxeles son el activo, pero los bytes además dependen del `zlib` de
quien corra el script. Si algún día reproducís esto en una máquina con otro
`zlib` y ves ese segundo mensaje, es compresión y no una sustitución.

### 3. La prueba negativa del 159

No mira el texto del script ni compara el archivo dos veces. Arma una **copia
temporal mínima** —el script, la fuente y los tres derivados—, **nunca sobre el
árbol de trabajo**, y ahí sustituye el monograma alfa por el opaco: un PNG
válido, de la misma medida, con otro contenido. Después exige que `--verificar`
de esa copia:

1. salga **distinto de cero**;
2. nombre `agroboeda-monograma-alfa.png`;
3. **no** acuse a los otros dos, que no se tocaron;
4. no haya reescrito el archivo sustituido —o sea, que verificar no escriba.

La copia se borra en un `finally`.

### 4. El rojo, contra `712f98b`

```
[FAIL] 159 El monograma se integra con la banda: sin placa, sin halo y sin mover
       nada — con el monograma alfa sustituido la verificación siguió saliendo
       con 0: no verifica nada
```

### 5. El verde

```
[PASS] 159 … `derivar_marca.py --verificar` compara los tres archivos
versionados contra la derivación y sale con 0, declara RGBA para el nuevo y usa
sólo la biblioteca estándar; sobre una copia temporal con el alfa sustituido por
el opaco sale distinto de cero y nombra ese archivo, y sólo ese; …
```

Y el `--verificar` positivo, corrido aparte, sigue imprimiendo lo mismo que
antes y saliendo con 0.

### 6. Lo que corrí y lo que no

```
SMOKE_CASOS=159 contra 712f98b                  rojo, por la verificación que no verificaba
SMOKE_CASOS=159                                 1/1
npm run lint                                    verde, 0 avisos
node --check scripts/smoke.mjs                  verde
python3 scripts/derivar_marca.py --verificar    exit 0, mismos tres hashes
git -c core.whitespace=cr-at-eol diff --check   limpio
```

No repetí 156, suite completa, capturas, contraste, a11y ni Backend. Tampoco
corrí `npm run build` por separado: entendí tu «su smoke ya incluye build». Si
lo querés igual, es un comando y te lo mando.

### 7. Sobre la cuenta de prueba

Recibida la decisión: **la cuenta se queda local** y no hay operación remota que
correr. La saco de mis pendientes. Si Emi vuelve a pedirla publicada, la
operación que dejé escrita en el informe anterior sigue ahí como punto de
partida, pero con clave no versionada, duración y responsable, como decís.

### 8. Deuda que sigue abierta, sin tocar

`--tg-color-focus` sigue valiendo `#1e4a34`, el mismo color que
`--tg-color-brand`: cualquier superficie nueva pintada con el verde de marca
nace con el foco invisible. Anotado desde `FOOTER-FOCUS-1`.
