# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev lo lee y no
lo edita.

Para responder, la dev escribe en `docs/pm/PARA-PM.md` y pushea. Ese
archivo es suyo y la PM no lo toca.

**Antes de cada tarea:**

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Este archivo cambió de manos el 2026-08-04

**La PM ahora es Sol.** Lo que sigue lo escribió la PM anterior; queda
porque **todavía está pendiente**, no por historia. Sol: leé
`ONBOARDING-PM.md` primero, después esto.

El historial cerrado —423 líneas de tareas ya aprobadas— se archivó
verbatim en `docs/pm/archivo/PARA-DEV-historico.md`. Nada se borró.

**Lo vigente, en orden:**

| Sección | Qué pide | Estado |
|---|---|---|
| Dos cosas que encontré corriendo la aplicación | Seed sin CBU/alias + error equivocado en pago | Sin empezar |
| El camino de instalación sin Docker está roto | `.env.example` y proxy de Vite | Sin empezar |
| Antes de seguir: hay órdenes que quedan muertas | Los cuatro arreglos de transferencia | Sin empezar |
| Pieza A: aprobada con dos objeciones | Perfil editable + campo de certificación | Sin resolver |
| Cómo trabajamos la Tarea 6 | El método, no una tarea | Vigente |
| Tarea 6: el módulo de transportistas | Piezas B y C, y las cuatro preguntas de diseño | B y C sin empezar |

Falta escribir la tarea de **suscripciones**. El alcance está decidido y
documentado en `DECISIONS.md` y `PROJECT.md`; el enunciado no existe.

---

## Dos cosas que encontré corriendo la aplicación de verdad

Levanté el proyecto entero y recorrí el camino de compra. Estas dos no las
detecta la suite, y una es grave para una demostración.

### 1. Ningún usuario del seed tiene CBU ni alias

Verificado por consulta:

```
admin@topgreen.com     · sin CBU · sin alias
vendedor@ejemplo.com   · sin CBU · sin alias
cliente@ejemplo.com    · sin CBU · sin alias
```

Consecuencia: **sobre una instalación limpia, el pago por transferencia no
se puede usar.** La API responde, correctamente,
`"Administrador TopGreen no configuró CBU ni alias bancario"`.

La suite no lo detecta porque el caso 13 configura los datos bancarios él
mismo antes de probar. Está bien que lo haga —prueba la regla—, pero deja
un hueco: **nadie prueba el estado en que queda el sistema recién
instalado.**

**Cargá CBU y alias en el seed** para el vendedor y para el administrador,
con valores de ejemplo evidentes. Y agregá un caso que verifique que,
después de sembrar, el recorrido de transferencia se puede completar sin
tocar nada a mano.

### 2. La pantalla muestra un error que no es el que ocurrió

En esa misma situación, la API devuelve el motivo correcto, pero la
pantalla de pago muestra:

> ⚠️ Producto no encontrado en el carrito

El producto estaba en el carrito. El problema era el CBU faltante. El
mensaje manda a buscar el problema al lugar equivocado.

Revisá el manejo de errores de esa pantalla: **que muestre el motivo que
devuelve la API**, no un mensaje genérico propio. Si la API ya explica qué
pasó, taparlo es perder información.

---

## El camino de instalación sin Docker está roto

Levanté el proyecto entero en una máquina limpia **sin Docker**, siguiendo
el "Camino B" de `README_LOCAL_SETUP.md`. Funciona, pero no como está
documentado: hay dos cosas que lo frenan y las dos son de configuración.

**1. `backend/.env.example` no se puede usar tal cual.** Tiene claves que
`Settings` rechaza, porque el modelo no admite campos extra:

```
DB_HOST · DB_PORT · DB_NAME · DB_USER · DB_PASSWORD · BASE_URL
```

Copiar el ejemplo y completarlo, que es lo que dice la guía, termina en un
error de validación de Pydantic antes de que arranque nada. Hay que
borrar esas seis líneas a mano para que levante.

**2. El proxy de Vite apunta a un puerto que sólo existe con nginx.** En
`vite.config.ts` el destino es `http://localhost`, o sea el puerto 80. Eso
es el nginx del perfil `fullstack` de Docker. Sin ese contenedor, **todas
las llamadas a la API fallan** con `ECONNREFUSED 127.0.0.1:80` y la
aplicación queda vacía, sin decir por qué.

Lo resolví con un `.env.local` con `VITE_API_URL=http://localhost:8000/api`,
que el código ya soporta.

### Qué te pido

- Que `backend/.env.example` levante **sin editarlo**, salvo las
  contraseñas.
- Que el camino sin Docker funcione siguiendo la guía al pie, sin trucos.
  Elegí vos cómo: cambiar el destino del proxy, documentar el
  `VITE_API_URL`, o las dos.
- Corregí `README_LOCAL_SETUP.md` con lo que quede.

**Por qué me importa más de lo que parece.** Es exactamente la clase de
problema que encontramos al recibir este proyecto: una guía de
instalación que no instala. Cuando esto se entregue, alguien va a seguir
ese documento sin nosotros al lado.

Es chico y va junto con lo de las órdenes colgadas.

---

## Antes de seguir: hay órdenes que quedan muertas

**Leé `docs/pm/PAGOS-TRANSFERENCIA.md`.** Sale de una duda del dueño del
proyecto sobre si la transferencia era demasiado frágil. Tenía razón, y el
problema es más concreto de lo que él sospechaba.

Lo verifiqué en el código:

- El vendedor **no puede decidir** si no hay comprobante: el estado
  requerido es *comprobante enviado*.
- La cancelación **no acepta** los dos estados nuevos de transferencia.
  Sólo `PLACED`, `CONFIRMED` y `PAID`.

Entonces si el comprador transfiere y no sube el comprobante, **nadie
puede hacer nada con esa orden nunca más.** Queda colgada en su lista de
compras y en la de ventas del vendedor, sin salida.

No te lo cuento como reproche: la cancelación se escribió antes de que
existieran esos estados. Es la clase de agujero que aparece al agregar
estados a una máquina que ya existía, y por eso conviene revisarla cada
vez.

### Las cuatro tareas, en este orden

Están detalladas en el análisis. Resumidas:

1. **Cancelación válida en los dos estados nuevos**, para comprador y
   vendedor.
2. **Referencia de pago visible** en la pantalla de transferencia, con la
   instrucción de usarla como concepto. Esta es la más valiosa de las
   cuatro y es casi un texto: hoy un vendedor con diez ventas abiertas
   mira su resumen bancario y **no tiene cómo saber qué transferencia
   corresponde a qué orden.**
3. **El vendedor puede confirmar o rechazar sin comprobante.** El
   comprobante no verifica nada, así que exigirlo es fricción sin
   beneficio. Pasa a ser opcional; la posibilidad de adjuntar sigue
   existiendo y el requisito contractual también.
4. **Vencimiento** con liberación de stock. Los días los define la
   clienta; hacela configurable y dejá siete por defecto.

**El criterio que más me importa:** el caso de la suite que cubre la orden
colgada tiene que **fallar contra el código de hoy** antes de que lo
arregles. Si pasa en verde desde el principio, el caso está mal escrito y
no está probando nada.

### Prioridad

**Esto va antes de las Piezas B y C de transportistas.** Es un error en
algo que ya entregamos y que se muestra el jueves, contra una función que
todavía no existe.

Las cuatro preguntas de diseño del transportista siguen pendientes y las
podés contestar mientras, porque son escribir, no construir.

---

## Pieza A: aprobada con dos objeciones, y una disculpa mía

El modelado está bien y es consistente: columnas planas en `users` con
`is_carrier`, igual que `cbu` y `alias_bancario`. Migración aditiva,
cadena intacta, clave foránea al padrón e índice. Y validás las cuatro
cosas obligatorias en el esquema con `model_validator`, más `gt=0` en el
radio. Bien.

**Primero, mi error.** Te dije "la Pieza A arrancala ya, no tiene nada
discutible" y en la misma tanda te pedí discutir dónde vive el
transportista. Dónde vive **es** la Pieza A. La instrucción se
contradecía y la resolviste razonablemente. No hay nada que rehacer.

### Objeción 1: el perfil no se puede editar

`UserUpdateRequest` no incluye ninguno de los campos de transportista.
Consecuencias:

- Un fletero **no puede cambiar su radio de cobertura** nunca más.
- No puede mover su localidad base si se muda.
- Un vendedor que además quiere ofrecer transporte **tiene que crearse
  una segunda cuenta**.

Un radio que no se puede cambiar no sirve: es el dato que un transportista
real ajusta según la temporada y el combustible.

**Agregá los campos al camino de actualización**, con la misma validación
que en el registro: si queda `is_carrier` en verdadero, las cuatro cosas
tienen que seguir estando. Y que un usuario existente pueda volverse
transportista.

Ojo con el caso inverso: si alguien **deja** de ser transportista con una
orden asignada, no lo resuelvas por tu cuenta. Contame qué ves.

### Objeción 2: `carrier_transport_certified` obligatorio en verdadero no es un dato

Lo hiciste obligatorio y tiene que valer verdadero para poder
registrarse. Entonces **todas las filas van a tener verdadero**, y una
columna que sólo puede tener un valor no informa nada. Es una casilla de
aceptación disfrazada de campo.

Y hay un efecto de producto que no decidiste vos ni yo: un transportista
sin certificación **no puede registrarse en absoluto**.

Dos salidas coherentes, y quiero tu opinión antes de tocarlo:

- **Informativa**: opcional, y el listado muestra quién declara estar
  habilitado. El comprador decide. Se parece a cómo tratamos la capacidad
  de carga.
- **Declaración**: si es una condición para participar, se modela como lo
  que es —una aceptación con fecha— y no como una característica del
  transporte.

Mi preferencia es la primera, porque nadie verifica esa certificación
contra ningún organismo y presentarla como requisito cumplido nos hace
afirmar algo que no comprobamos. Pero decime si ves algo que se me escapa.

### Y lo que falta del acuerdo

**No actualizaste `PARA-PM.md`.** Sigue el informe de los pagos. Alguien
que abra el canal hoy no se entera de que existe la Pieza A. Es la segunda
vez que pasa en el proyecto.

**Y no contestaste las cuatro preguntas de diseño ni hiciste la auditoría
de por dónde sale el contacto del comprador.** Eso era la condición para
empezar B y C. La pregunta 2 quedó contestada por el código, y está bien;
faltan las otras tres y el mapa.

**No arranques B ni C hasta eso.** Es lo único que te estoy pidiendo
esperar en todo el proyecto, y es porque el candado de suscripción se
saltea solo si el teléfono sale por otro endpoint.

### Aviso: `NOW.md` estaba mal en `main`, y era mi culpa

Tres de mis commits fueron a mi rama en vez de a `main`. Durante unas
horas `NOW.md` decía 49 % y que transportistas estaba bloqueado esperando
a la clienta, cuando `PARA-DEV.md` decía lo contrario.

Ya está corregido. Si trabajaste con esa contradicción a la vista y
seguiste `PARA-DEV.md`, elegiste bien: **entre dos documentos míos que se
contradicen, gana el que tiene tu tarea.**

---

## Cómo trabajamos la Tarea 6: la diseñamos entre las dos

Este módulo es 25 % del contrato y es el diferencial del producto. Es
demasiado grande para que yo baje una especificación y vos la ejecutes.

Así que va distinto:

- **La Pieza A arrancala ya**, sin esperarme. No tiene nada discutible.
- **Las Piezas B y C no las escribas todavía.** Abajo está mi propuesta.
  Quiero que la leas, la discutas, y me contestes en `PARA-PM.md` antes de
  escribir código. Después arrancás.

No es burocracia: es que en las últimas dos vueltas encontraste dos cosas
que yo no había visto —los pagos alcanzables y que la orden no guardaba
los datos bancarios—, y las dos eran de diseño. Prefiero gastar una vuelta
en discutirlo que tres en rehacerlo.

### Lo que necesito que audites primero

Ya encontré una: **`OrderResponse` devuelve `buyer_phone` y
`buyer_address`**, y `GET /orders/{id}` los entrega a quien sea comprador o
vendedor de esa orden.

Cuando el transportista quede asociado a una orden, si puede leerla **se
saltea el candado de suscripción sin proponérselo**. El candado en un
endpoint nuevo no sirve de nada si el teléfono sale por otro lado.

**Mapeame por dónde sale hoy el contacto del comprador**: qué endpoints lo
devuelven, con qué permiso, y qué pasaría si el transportista tuviera
acceso a la orden. Con eso decidimos dónde va el control, y quiero tu
recomendación, no sólo el mapa.

### Las cuatro cosas que quiero discutir con vos

**1. La semántica de la coincidencia.** Mi propuesta está abajo: el
transportista sirve si **origen y destino** caen dentro de su radio. Es la
lectura estricta. ¿Te cierra? ¿O tiene más sentido medir contra el origen
solamente, o contra el punto medio? Si el radio es chico y el viaje largo,
mi versión puede no devolver a nadie nunca.

**2. Dónde vive el transportista.** ¿Una marca en `users` más una tabla de
perfil? ¿Otra cosa? El contrato dice "tipo especial de proveedor", no un
rol nuevo, pero la forma concreta es tu decisión.

**3. Dónde se aplica el candado.** ¿Una dependencia única que envuelva
todo lo que devuelva contacto? ¿Un armado de respuesta que quite los
campos? Quiero **un solo lugar donde se decida**, no una condición
repetida en cada endpoint. Cómo lograrlo es tu terreno.

**4. Qué ve el transportista de la orden.** Mi instinto es que **no**
debería leer la orden completa: no necesita el total, ni los precios, ni
el comprobante de transferencia. Necesita origen, destino, y el contacto
si pagó. ¿Coincidís en armarle una vista propia en vez de darle acceso a
`OrderResponse`?

Si en algo de esto te parece que estoy complicando algo simple, decilo.

---

## Tarea 6: el módulo de transportistas. Arranca ahora

**Es el bloque grande que falta: 25 % del contrato, hoy en cero.** Y es el
diferencial del producto.

### Estaba mal trabado, y el error era mío

Yo venía diciendo que no arrancaba hasta que la clienta definiera si la
cobertura iba por zonas declaradas o por radio en kilómetros. **Fui a leer
el contrato y ya está definido:**

> *"El transportista se registra detallando: ubicación base, transporte
> habilitado certificado, **zona de cobertura (radio en km)** y capacidad
> de carga."*

Radio en kilómetros. Las zonas declaradas eran una idea mía, mejor en
algunos casos, pero **no es lo contratado**. Si la clienta las quiere
después, es un cambio que se cotiza.

Otra cosa que el contrato deja clara y conviene tener presente:

> *"En lugar de un complejo algoritmo automatizado de ruteo, se propone un
> modelo de **Directorio** de Logística por Geolocalización."*

**Es un directorio, no un motor de ruteo.** No calcules rutas, no estimes
tiempos, no optimices nada. Filtrás por distancia y listás.

### Hacelo en tres piezas, con commit e informe entre cada una

**Pieza A — el transportista existe.**

No es un rol nuevo: el contrato dice *"un tipo especial de proveedor"*.
Extendé lo que ya hay en vez de inventar una jerarquía nueva.

Declara cuatro cosas:

1. **Ubicación base.** Del padrón, igual que las publicaciones. Ya tenés
   el mecanismo hecho.
2. **Transporte habilitado certificado.** Un texto y una marca de
   habilitación. **No construyas verificación de certificados**: el
   contrato no la pide y no la vamos a validar contra ningún organismo.
3. **Radio de cobertura en km.** Un número.
4. **Capacidad de carga.** Texto libre, como el ejemplo del contrato:
   *"hasta 40 toneladas de semillas"*.

**Pieza B — la coincidencia por distancia.**

Dada una compra, listar transportistas cuya cobertura alcance el
recorrido.

**Mi interpretación, y quiero que la discutas si no te cierra:** el
transportista cubre un círculo de radio R alrededor de su base, y sirve
para un viaje si **tanto el origen como el destino** caen dentro de ese
círculo. Es la lectura estricta: prefiero no ofrecer un transportista que
después no pueda hacer el viaje.

Usá `ST_DWithin` sobre `localities.coordinates`, que ya tiene índice GIST.
No calcules distancias en Python.

**La capacidad de carga no filtra**: se muestra como dato y el comprador
decide. El contrato dice "que coincidan con los requerimientos del
producto", pero no hay campo de peso en las publicaciones y no lo vamos a
agregar.

**Pieza C — elegirlo, incluirlo, y el candado de contacto.**

El contrato da dos caminos y hay que ofrecer los dos: *"seleccionar el
transportista e incluirlo en la transacción"*, o *"coordinar el envío
directo con los datos de contacto provistos"*.

**Los datos de contacto se muestran recién después de seleccionarlo**, no
en el listado.

### El candado por suscripción

Definición nueva del dueño del proyecto: **el teléfono del comprador se ve
sólo si hay suscripción paga.** Es el modelo de negocio de la clienta —
el transportista paga para recibir contactos.

**Construí el candado, no el sistema de suscripciones.** La diferencia es
todo:

**Lo que sí:**

- Un campo en el usuario que indique si su suscripción está activa, con
  fecha de vencimiento anulable.
- Que el administrador lo pueda activar y desactivar a mano, igual que el
  vendedor valida un comprobante de transferencia. Ya tenemos ese patrón.
- **La verificación en el backend**, en el endpoint que devuelve datos de
  contacto. Sin suscripción activa, la respuesta **no trae el teléfono**.
  No lo mandes y lo tapes en la interfaz: no lo mandes.

**Lo que no, y es importante que no lo hagas:**

- Nada de cobro, renovación automática, avisos de vencimiento, planes,
  niveles ni prorrateo.
- Nada de integrar un medio de pago para la suscripción.

Eso es un módulo entero, no está en el contrato y se cotiza aparte. El
candado son horas; el sistema son semanas.

### Por qué el candado va ahora y no después

Es el mismo argumento que usamos con la privacidad de los datos de
contacto: **quién puede ver qué es la forma del módulo, no una capa que se
agrega arriba.** Si los endpoints se construyen devolviendo el teléfono
siempre, ponerle el candado después es tocar todos.

Definido de entrada es un `if` en un lugar.

### Criterio de aceptación del candado

1. Sin suscripción activa, la respuesta de la API **no contiene** el
   teléfono. Verificado contra el JSON, no contra la pantalla.
2. Con suscripción activa, sí.
3. Con suscripción **vencida por fecha**, no. Ese es el caso que se
   olvida.
4. La interfaz explica por qué no lo ve, en vez de mostrar un campo vacío.
5. Casos en la suite para los tres estados: sin suscripción, activa y
   vencida.

El punto 3 es el que más me importa. Una suscripción que no vence no es
una suscripción.

### Criterios de aceptación

Por pieza, y relacionales:

1. Un transportista se registra con las cuatro cosas y aparece en la
   base. Ninguna es opcional salvo el texto de capacidad.
2. **El listado de compatibles coincide con la consulta SQL equivalente**
   usando `ST_DWithin`. Ese es el criterio, no una cantidad fija.
3. Un caso donde un transportista queda **fuera** por poco y otro
   **dentro** por poco. Los bordes son donde esto se rompe.
4. Los datos de contacto **no** aparecen en el listado, verificado por
   API: que la respuesta del listado no los traiga, no que el frontend no
   los muestre.
5. Casos nuevos en la suite para las tres piezas.
6. `npm run smoke` en verde.

El punto 4 es de privacidad: son teléfonos y direcciones de gente real.

### Aprobación de esquema

**Autorizada** para las cuatro cosas del transportista y para asociar un
transportista a una orden. Migración aditiva, generada desde los modelos,
con `alembic check` limpio después.

### Frená y preguntá si

- La distancia entre localidades da resultados que no tienen sentido.
- Tenés que agregar peso o volumen a las publicaciones.
- El flujo te obliga a cambiar el checkout de transferencia que acabás de
  terminar.

### Sobre el jueves

**No apuntes a mostrarlo.** Faltan cuatro días y esto es un módulo entero.
La Pieza A sola no se muestra: un formulario de registro sin el listado no
dice nada. Si llegan las tres, lo reevalúo.

Lo que se muestra el jueves ya está decidido y está en `DEMO.md`.

> **Nota del 2026-08-04:** este párrafo quedó viejo. La demostración fue y
> el proyecto está aprobado. Lo que sigue vigente de esta sección son las
> **Piezas B y C** y las **cuatro preguntas de diseño**, que nadie
> respondió.

---
