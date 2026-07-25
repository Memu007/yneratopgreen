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

## Tarea 1: cargar la taxonomía de la clienta

**Es lo primero que hacés.** Cambié el orden: la verificación en celular
pasó a ser la Tarea 2. Motivo: la taxonomía cambia las categorías, que se
ven en el filtro del catálogo, en el formulario de publicación y en las
tarjetas. Verificar en pantalla chica lo que está por cambiar es trabajo
que se tira.

La clienta mandó su taxonomía real. Está analizada en
`docs/pm/TAXONOMIA-CLIENTE.md`, leelo antes de empezar. Reemplaza a las
categorías que veníamos improvisando nosotros.

Todo en `backend/app/seed.py`. **No toques modelos ni migraciones**: la
tabla de subcategorías ya existe.

### Qué cargar

**Las 7 categorías de productos** con sus 43 subcategorías, tal como
figuran en el análisis:

1. Maquinaria agrícola (7 subcategorías)
2. Riego y drenaje (6)
3. Insumos agrícolas (7)
4. Ganadería y forrajes (5)
5. Repuestos y mantenimiento (6)
6. Agricultura de precisión y tecnología (4)
7. Tierras y parcelas (8)

**Más una octava que se conserva:** `Bienes y Ganado`, para vender
animales. La taxonomía de la clienta no tiene dónde poner hacienda, pero
el contrato la exige explícitamente. Hasta que ella lo aclare, manda el
contrato.

**Servicios: cargá sólo cuatro.** Asesoramiento, Contratistas, Logística y
Acopio. **No cargues "Inversores"**: es intermediación financiera, otro
negocio, y no está en el contrato. Si lo cargamos, creamos una expectativa
que no vamos a construir.

### Qué NO cargar

**El tercer nivel.** La taxonomía trae unos 200 ítems bajo las
subcategorías. No los cargues: mezclan tipos de producto con
especificaciones —en Tractores son rangos de potencia, en Preparación del
suelo son arados y rastras— y eso se modela como atributo, no como nivel
de navegación. Es una decisión pendiente.

**Las marcas.** Las 48 tienen duplicados por resolver con la clienta y
además hoy se ofrecen todas para cualquier categoría, lo que produce
combinaciones sin sentido. Queda fuera hasta que se limpie.

### Reasignar los 24 productos existentes

Al cambiar las categorías, los productos actuales quedan huérfanos. Este
es el mapeo, ya resuelto:

| Producto actual | Categoría nueva | Subcategoría |
|---|---|---|
| Semillas de maíz y de soja | Insumos agrícolas | Semillas y plántulas |
| Fertilizante Triple 15 | Insumos agrícolas | Fertilizantes |
| Herbicida Glifosato | Insumos agrícolas | Agroquímicos |
| Pulverizadora Jacto | Maquinaria agrícola | Fertilización y protección |
| Cosechadora John Deere | Maquinaria agrícola | Cosecha |
| Rastra de discos | Maquinaria agrícola | Preparación del suelo |
| Dron pulverizador | Agricultura de precisión | Drones y VANTs |
| Sensores de humedad IoT | Agricultura de precisión | Sensores de cultivo |
| Terneros y vaquillonas | Bienes y Ganado | la que corresponda |

Los demás ubicalos donde mejor encajen. **Cada categoría tiene que quedar
con al menos un producto**, y si alguna queda vacía, agregá una
publicación verosímil del rubro.

### Criterio de aceptación

1. Arranque limpio y seed corrido **dos veces**: no se duplica nada.
2. Consulta SQL con el conteo **por categoría** y otra **por provincia**.
   Pegame las dos.
3. Las 8 categorías de productos y las 4 de servicios existen, con sus
   subcategorías.
4. **Ningún producto sin categoría**, verificado por SQL.
5. Ninguna categoría de producto vacía.
6. `npm run smoke` en verde.
7. En la interfaz, el filtro de categoría muestra la taxonomía nueva.

### Lo que no encaje: se aparca, no se fuerza

Hay preguntas abiertas con la clienta que se responden el lunes. Así que
si al mapear encontrás algo que no entra claro en ninguna categoría:

**No lo fuerces a "Otros" ni inventes una categoría para que entre.**

Dejalo **donde está hoy**, que la aplicación siga funcionando, y anotalo
en tu informe en una lista aparte: "pendiente de definición". Yo la sumo a
las preguntas del lunes.

Vale lo mismo para las subcategorías: si alguna no sabés dónde va,
dejala fuera y anotala. Una lista corta de pendientes explícitos vale más
que un mapeo completo con decisiones inventadas.

---

## Tarea 2: verificar y arreglar la vista en celular

**Después de la taxonomía**, y sobre la taxonomía ya cargada.

El 30 de julio hay demostración con el cliente. Es del sector agro: **va a
abrir el sitio en el teléfono**, en la reunión o apenas salga.

El contrato pide "plataforma web responsive" y "diseño optimizado para
dispositivos móviles". Nadie lo verificó nunca en una pantalla chica.

**Lo que más me preocupa:** los selectores de provincia y localidad que
acabás de construir son el centro de la demostración, y un desplegable con
miles de localidades en un celular es justo lo que se rompe. Ahora se suma
el filtro de categorías, que pasa de 5 a 12 opciones con subcategorías
abajo: en pantalla chica eso puede volverse una lista impracticable.

### Qué verificar

Con Playwright emulando un teléfono, y si podés también en uno real.
Tamaños: 390×844 (iPhone), 360×800 (Android) y una tableta.

Recorrido completo en cada tamaño:

1. Pantalla inicial y navegación al catálogo.
2. **El panel de filtros**: ¿se ve? ¿se puede abrir y cerrar? ¿los
   selectores de provincia, localidad y categoría son usables con el dedo?
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
3. Los filtros de provincia, localidad y categoría se pueden usar con el
   dedo.
4. Capturas de las siete pantallas en el tamaño más chico.
5. Lista de lo que estaba roto, lo que arreglaste y lo que dejaste feo a
   propósito.
6. `npm run smoke` sigue en verde.

### Si encontrás mucho roto

Frená y reportá antes de arreglar. Si son tres detalles, arreglalos. Si es
un rediseño, esa decisión es mía y la tomo con lo que me cuentes.

---

## Después de las dos, si te queda tiempo

Arreglo chico pendiente: en `package.json`, el script `dev` es `vite` a
secas, así que si el puerto 5173 está ocupado Vite se corre a otro y el
backend lo rechaza por CORS. Ya te pasó una vez.

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
