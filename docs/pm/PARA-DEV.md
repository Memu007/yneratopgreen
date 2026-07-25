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

## Si es tu primer día

Leé **`docs/pm/ONBOARDING-DEV.md`** antes que esto. Está todo: los roles,
cómo levantar el proyecto, las trampas conocidas, las reglas y el estado
real de lo construido. Son diez minutos y te ahorran una semana.

Después volvé acá.

---

## Contexto de esta semana

**El jueves 30 de julio hay demostración con la clienta y se firma el
contrato.** Todo lo de esta semana apunta a esa reunión.

La dev anterior perdió el contexto y no dejó informe. Lo que sigue es lo
que **yo verifiqué contra el código**, no lo que dijo nadie.

---

## Tarea 1: aprobada

Evidencia completa y contrastada. Los doce casos en verde, las
subcategorías dan 7/6/7/5/6/4/8, ninguna publicación sin categoría,
ninguna categoría vacía, Acopio con sus dos publicaciones visibles en la
interfaz, y el seed corrido dos veces sin duplicar nada.

**Lo mejor del informe no son los números: es que explicaste el que no
cerraba.** Las consultas dan 32 publicaciones y el seed son 30, y en vez
de dejarlo pasar aclaraste que las dos de más las crea el propio smoke.
Ese es el reflejo que hace que pueda confiar en el resto sin repetir todo.

### Arrancá la Tarea 2 ahora, sin esperarme

Escribiste que quedabas a la espera de la próxima instrucción. **No hace
falta.** La Tarea 2 ya está acá abajo, con sus criterios: eso es lo que
significa que esté escrita en este archivo.

La regla de "una tarea por vez" es para que no mezcles trabajo en un mismo
commit, no para pedir permiso entre tarea y tarea. Terminás, commiteás,
informás y **seguís con lo próximo que esté escrito**. Frenás sólo si algo
se rompe o si tenés que tomar una decisión que es mía.

Leé abajo lo de las skills y los tres criterios nuevos de la Tarea 2 antes
de empezar.

---

## Respuesta a tu informe del bloqueo

Buen primer informe. Los dos hallazgos son correctos y los verifiqué.

### El contenedor: destruilo, tenés autorización

`topgreen-db` pertenece a un checkout viejo de Codex que **ya no está en
uso**: esa dev perdió el contexto y por eso entraste vos. No hay trabajo
activo ahí.

**Que no lo borraras por tu cuenta fue lo correcto.** Ante la duda de
destruir datos de otro, frenar y preguntar es exactamente lo que quiero.
Pero en este caso no se pierde nada, y por diseño:

Esa base **no contiene nada que exista sólo ahí**. Se reconstruye entera
con `alembic upgrade head` más `python -m app.seed`, que es idempotente y
está verificado. Que la base sea desechable fue una decisión explícita del
proyecto, justamente para que nadie quede rehén de un contenedor.

Adelante:

```bash
docker rm -f topgreen-db topgreen-api
```

Y si quedan volúmenes colgados, `docker volume ls` y borrá los de
`topgreen`. Después corré el smoke desde cero.

### Tenías razón sobre `REPO_MAP.md`

Decía "no hay geolocalización todavía, ninguna tabla tiene coordenadas".
Es falso: `localities` tiene `Geography(POINT, 4326)` con índice GIST y
4.028 registros del padrón, y `products.locality_id` referencia ese
padrón. **Ya lo corregí**, con el detalle de cómo está implementado.

Hiciste bien en no editarlo: `docs/pm/` es mío. Reportarlo es lo que
correspondía, y es la regla 6 funcionando —cuando el código y la
documentación se contradicen, gana el código y hay un documento que
arreglar—.

### Sobre la Tarea 1

Revisé tus dos publicaciones de Acopio contra el código: están completas.
Ambas figuran en `product_taxonomy` y en `product_localities`, con slugs
propios y localidades del padrón. Bien resuelto.

Y valoro que declararas que el chequeo de sintaxis con `ast.parse` es
sólo eso, en vez de venderlo como prueba de que funciona. Todavía falta
la evidencia real; ahora la vas a poder generar.

### Tarea 1.3, nueva y chica

El smoke se rompió por un conflicto de nombre de contenedor y no te dio
un mensaje útil. Va a volver a pasar.

En `scripts/smoke.sh`, donde hace la limpieza previa, agregá un
`docker rm -f topgreen-db topgreen-api` tolerante a fallo antes de
levantar. Que la suite se limpie sola en vez de morir con un error de
Docker. **No cambies nada más del script.**

**Ya la hiciste** mientras yo escribía esto, commit `ddde564`. Una línea,
tolerante a fallo, en el lugar correcto y sin tocar nada más. Así.

---

## Sobre instalar skills de agente: no, y qué tomamos igual

Se evaluó instalarte un paquete de skills de agente. **Decisión: ninguna
antes del jueves.**

Motivo: faltan tres días para la demostración y la firma. Cambiar cómo
trabajás y cerrar las tareas pendientes al mismo tiempo es mover dos
variables a la vez, justo cuando menos margen hay para depurar si algo
sale raro. No es un juicio sobre tu forma de trabajar: estás yendo bien.

Y hay una familia que queda descartada siempre: las de especificación,
planificación y registro de decisiones. Eso es literalmente lo que hace
`docs/pm/`. Instalarlas crearía una segunda fuente de verdad, manejada
desde el lado del código y sin el contrato ni la clienta a la vista.

**Pero sí adopto tres cosas concretas**, y valen para la Tarea 2. Están
más abajo, integradas en los criterios.

---

## Estado de la taxonomía

Se cargó la taxonomía real de la clienta en `backend/app/seed.py`, commit
`43911d7`. **Lo verifiqué nombre por nombre y está bien hecho:**

- Los conteos dan exacto: 7 / 6 / 7 / 5 / 6 / 4 / 8 = **43
  subcategorías**, con los nombres literales de la clienta.
- Las cuatro subcategorías "Otros" usan clave compuesta
  `category_id + slug`. Confirmé en el modelo que `Subcategory.slug` no
  tiene índice único global, así que no se pisan entre sí.
- **28 publicaciones, ninguna huérfana.** Todas con categoría y localidad.

**Pero la tarea no está cerrada.** Faltan dos cosas, y son la Tarea 1.

---

## Tarea 1: cerrar la taxonomía

Corta. Sirve además para confirmar que tenés el entorno andando.

### 1.1 Acopio quedó vacío

De las cuatro categorías de servicio, hay publicaciones en Asesoramiento
(3), Contratistas (5) y Logística (2). **Acopio tiene cero.**

En la demostración la clienta va a hacer clic ahí, porque el acopio es un
servicio central del negocio agrícola, y va a ver una categoría vacía.

Agregá **una o dos publicaciones verosímiles** del rubro: recepción y
acondicionamiento de granos, guarda en silo bolsa, secado. Con localidad
del padrón, como todas las demás.

### 1.2 No hay evidencia de que el seed se haya corrido

Es lo que más me importa. Necesito, con la salida pegada en tu informe:

1. **El seed corrido dos veces seguidas**, con la salida de la segunda:
   no se tiene que duplicar nada.
2. **Consulta SQL: subcategorías por categoría.** Tiene que dar
   7/6/7/5/6/4/8 en las siete de la clienta. Acá el número fijo vale,
   porque es la especificación y no un dato que crece con el seed.
3. **Consulta SQL: publicaciones por categoría.** Ninguna en cero.
4. **Consulta SQL: publicaciones sin categoría.** Tiene que dar cero.
5. **`npm run smoke` en verde.**
6. En la interfaz, el filtro de categorías muestra la taxonomía nueva.

Si algo de esto falla, **frená y contame**. Es mejor saberlo hoy que el
jueves.

### El campo de 120 hectáreas: dejalo como está

Vas a ver en Tierras y parcelas una publicación de un campo de
$950.000.000 con botón de agregar al carrito. Sí, es absurdo. **Es una
decisión mía y está en el guión de la demostración a propósito.**

No lo toques, no lo borres, no intentes arreglarlo.

---

## Tarea 2: verificar y arreglar la vista en celular

Después de la Tarea 1.

La clienta es del sector agro: **va a abrir el sitio en el teléfono**, en
la reunión o apenas salga. El contrato pide "plataforma web responsive" y
"diseño optimizado para dispositivos móviles", y nadie lo verificó nunca
en una pantalla chica.

**Tratá esto como no hecho.** La dev anterior dijo haber revisado
catálogo, filtros, detalle, carrito y checkout en 390×844 sin desbordes,
pero no dejó capturas ni informe. Puede servirte como pista de dónde
probablemente **no** están los problemas; no como trabajo hecho.

**Lo que más me preocupa:** los filtros son el centro de la demostración.
El de localidades tiene miles de opciones y el de categorías ahora tiene
12 categorías con 43 subcategorías colgando. En pantalla chica eso puede
volverse una lista impracticable.

### Qué verificar

Con Playwright emulando un teléfono, y si podés también en uno real.
Tamaños: 390×844 (iPhone), 360×800 (Android) y una tableta.

Recorrido completo en cada tamaño:

1. Pantalla inicial y navegación al catálogo.
2. **El panel de filtros**: ¿se ve? ¿se abre y se cierra? ¿provincia,
   localidad y categoría se pueden usar con el dedo?
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

### Las tres cosas que adopto del material de skills

Son las únicas que se pisan con trabajo real pendiente. No hace falta
instalar nada: van acá como criterio.

**1. La consola tiene que quedar limpia.** En cada pantalla que visites,
mirá la consola del navegador y anotá errores **y advertencias**. Hoy no
tenemos ni idea de qué tira la aplicación en ejecución, porque nadie
miró nunca.

No arregles las advertencias en esta tarea: **anotalas**. Yo decido qué
se toca. Pero un error de consola en el recorrido de la demostración sí
se arregla, porque es lo que deja pantalla en blanco.

La razón de fondo, que es la historia de este repositorio: *"analizar el
código no reemplaza abrirlo en un navegador"*. Acá se documentó durante
meses funcionalidad que nunca había corrido.

**2. Las peticiones de red también se miran.** Mientras recorrés, mirá
los códigos de estado. Cualquier `4xx` o `5xx` que aparezca sin que la
interfaz avise, anotalo: es un fallo silencioso. Ya tuvimos uno —la
subida de imágenes fallaba sin decir nada— y apareció así.

Cuidado especial con CORS: si ves fallos de origen cruzado, lo más
probable es que Vite se haya corrido de puerto. Es el problema de la
Tarea 3, no un bug nuevo.

**3. Capturas de antes y después, no sólo del resultado.** De cada cosa
que arregles, quiero el par. Sirve para dos cosas: que yo pueda juzgar si
valió la pena tocarlo, y tener material de la reunión del jueves.

### Lo que NO adoptamos, para que quede claro

**Nada de métricas de rendimiento.** LCP, CLS, INP, trazas: fuera de
alcance. No están en el contrato, no se ven en una demostración y abren
un pozo sin fondo a tres días de la firma.

Si notás algo groseramente lento, decilo en una línea y seguí.

### Criterio de aceptación

1. El recorrido completo se puede hacer en 390×844 sin quedarse trabado.
2. **Ningún desborde horizontal** en ninguna pantalla.
3. Los filtros de provincia, localidad y categoría se pueden usar con el
   dedo.
4. Capturas de las siete pantallas en el tamaño más chico, más los pares
   antes/después de cada arreglo.
5. **Inventario de consola**: errores y advertencias por pantalla. Los
   errores del recorrido de la demostración, resueltos.
6. **Inventario de red**: cualquier `4xx` o `5xx` que la interfaz no
   avise.
7. Lista de lo que estaba roto, lo que arreglaste y lo que dejaste feo a
   propósito.
8. `npm run smoke` sigue en verde.

### Si encontrás mucho roto

**Frená y reportá antes de arreglar.** Si son tres detalles, arreglalos.
Si es un rediseño, esa decisión es mía y la tomo con lo que me cuentes.

---

## Tarea 3, si te queda tiempo

En `package.json`, el script `dev` es `vite` a secas. Si el puerto 5173
está ocupado, Vite se corre solo a otro y el backend lo rechaza por CORS,
con errores que no dicen nada. Ya nos pasó.

Cambialo a `vite --port 5173 --strictPort`, para que falle con un mensaje
claro en vez de arrancar en un puerto que no funciona. **No toques la
configuración de CORS del backend.**

---

## Lo que no encaje: se aparca, no se fuerza

Hay preguntas abiertas con la clienta. Si al trabajar encontrás algo que
no entra claro en ninguna categoría:

**No lo fuerces a "Otros" ni inventes una categoría para que entre.**

Dejalo donde está, que la aplicación siga funcionando, y anotalo en tu
informe en una lista aparte: "pendiente de definición". Yo la sumo a las
preguntas para la clienta.

Una lista corta de pendientes explícitos vale más que un mapeo completo
con decisiones inventadas.

---

## Las reglas, en corto

El detalle está en `ONBOARDING-DEV.md`. Lo mínimo:

1. **Si no lo corriste, decí que no lo corriste.** Un "probado" sin salida
   pegada cuenta como no probado.
2. **Una tarea por vez.** Terminás, commiteás, pusheás, informás.
3. **Commit y push apenas termina cada pieza**, antes del informe.
4. **Sos adversarial.** Si te pido algo técnicamente mal, decilo antes de
   hacerlo.
5. **Empezar no necesita permiso.** Lo que está acá ya está aprobado.
6. **Gana el código** cuando la documentación lo contradice. Y avisá.

**Qué no tocar:** el esquema de la base, modelos y migraciones sin
aprobación; funcionalidad que no se pidió; credenciales reales de Mercado
Pago; `docs/PROJECT_STATUS.md`.
