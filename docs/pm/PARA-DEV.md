# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** Vos leelo, no lo
edites.

Para responder, escribí en `docs/pm/PARA-PM.md` y pusheá. Ese archivo es
tuyo y la PM no lo toca.

**Antes de cada tarea:**

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Estado: las dos tareas aprobadas

Verificadas contra el código. La subida de imágenes ahora comprueba el
resultado y avisa el motivo, y el catálogo quedó en 24 productos, dos por
categoría, en nueve provincias.

**Lo que más valoro de esta vuelta:** no arreglaste el bug y listo, le
agregaste un caso permanente a la suite que fuerza el error y exige tres
cosas a la vez. Ese bug ya no puede volver en silencio. No te lo había
pedido.

Y que informaras que tu primera corrida falló por tu propia expresión
regular, en lugar de corregirlo callado, es exactamente la conducta que
hace que confíe en tus informes.

---

## Tarea: verificar y arreglar la vista en celular

El 30 de julio hay demostración con el cliente. Es del sector agro: **va a
abrir el sitio en el teléfono**, en la reunión o apenas salga.

El contrato pide "plataforma web responsive" y "diseño optimizado para
dispositivos móviles". Nadie lo verificó nunca en una pantalla chica.

**Lo que más me preocupa:** los selectores de provincia y localidad que
acabás de construir son el centro de la demostración, y un desplegable con
miles de localidades en un celular es justo lo que se rompe.

### Qué verificar

Con Playwright emulando un teléfono, y si podés también en uno real.
Tamaños: 390×844 (iPhone), 360×800 (Android) y una tableta.

Recorrido completo en cada tamaño:

1. Pantalla inicial y navegación al catálogo.
2. **El panel de filtros**: ¿se ve? ¿se puede abrir y cerrar? ¿los
   selectores de provincia y localidad son usables con el dedo?
3. Catálogo: ¿las tarjetas se acomodan o se desbordan?
4. Detalle de una publicación.
5. Carrito y checkout hasta la pantalla de pago.
6. Formulario de publicación, que es largo.
7. Panel de vendedor y panel de administración.

En cada uno mirá: desbordes horizontales, texto cortado, botones
superpuestos o demasiado chicos para el dedo, y elementos que tapen otros.

### Qué arreglar

**Sólo lo que esté roto o inutilizable.** No rediseñes nada, no cambies
colores ni espaciados por gusto. El criterio es: ¿un usuario puede
completar el recorrido en un teléfono sin frustrarse?

Si algo está feo pero funciona, anotalo y no lo toques.

### Criterio de aceptación

1. El recorrido completo se puede hacer en 390×844 sin quedarse trabado.
2. **Ningún desborde horizontal** en ninguna pantalla.
3. Los filtros de provincia y localidad se pueden usar con el dedo.
4. Capturas de las siete pantallas en el tamaño más chico.
5. Lista de lo que estaba roto, lo que arreglaste y lo que dejaste feo a
   propósito.
6. `npm run smoke` sigue en verde.

### Si encontrás mucho roto

Frená y reportá antes de arreglar. Si son tres detalles, arreglalos. Si es
un rediseño, esa decisión es mía y la tomo con lo que me cuentes.

---

## Después, si te queda tiempo

Arreglo chico que quedó pendiente: en `package.json`, el script `dev` es
`vite` a secas, así que si el puerto 5173 está ocupado Vite se corre a otro
y el backend lo rechaza por CORS. Ya te pasó una vez.

Cambialo a `vite --port 5173 --strictPort`, para que falle con un mensaje
claro en vez de arrancar en un puerto que no funciona. No toques la
configuración de CORS del backend.

---

## Reglas permanentes

1. **Si no lo corriste, decí que no lo corriste.** Un "debería funcionar"
   cuenta como no hecho. Declararlo nunca es problema; ocultarlo sí.
2. **Una tarea por vez.** Terminás, commiteás, pusheás, informás.
3. **Commit y push apenas termina cada pieza**, antes del informe. Ya se
   perdió trabajo por dejarlo sin subir.
4. **Sos adversarial.** Si te pido algo técnicamente mal, decilo antes de
   hacerlo. Si algo no cierra, frená y preguntá.
5. **Cuando la documentación y el código se contradigan, gana el código.**
   Y avisá, porque hay un documento para corregir.

## Empezar no necesita permiso

Lo que está escrito acá ya está aprobado. No preguntes si arrancás:
arrancá. Las condiciones de corte son para cuando algo sale mal en el
medio, no para pedir permiso antes de empezar.

## Cuándo parás y me esperás

1. Un criterio de aceptación no se cumple y no sabés por qué.
2. Aparece un error que no entendés o que te obliga a cambiar algo fuera
   de la tarea.
3. Tendrías que tomar una decisión de diseño.
4. Tendrías que tocar algo de la lista de abajo.
5. Algo que ya funcionaba dejó de funcionar.

En cualquiera de esos casos: commit de lo hecho, escribilo y frená. **No
improvises para destrabarte.**

## Qué no tocar

- El esquema de la base, sin aprobación previa.
- Funcionalidad que no se pidió, por obvia que parezca. El contrato es a
  precio cerrado.
- Credenciales reales de Mercado Pago.
- `docs/PROJECT_STATUS.md`. Tiene ocho afirmaciones verificadas como
  falsas y se reescribe entero más adelante.

## Dónde está el contexto

Todo en `docs/pm/`:

- `NOW.md` — estado y tareas. **Leé sólo esto primero.**
- `CONTRATO.md` — el alcance. Si algo no está ahí, no es requisito.
- `PROJECT.md` — qué se construye y qué queda afuera.
- `REPO_MAP.md` — dónde está cada cosa.
- `DECISIONS.md` — por qué se decidió cada cosa.
