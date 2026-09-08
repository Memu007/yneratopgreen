# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-TRUTH-1 — el panel dice lo que pasa

**Resultado: terminado.**

- Producto/regresión: `aaa51ce`
- La suite pasa a **160 casos**.
- Alcance real: `backend/app/api/admin.py` (contrato del dashboard),
  `src/utils/estados.ts` (nuevo, el diccionario compartido),
  `AdminPanel.tsx` + su CSS, y los casos 160, 145 y 146 en `scripts/smoke.mjs`.
- **En mi rama, no en `main`.** No integré, no desplegué y no toqué Railway,
  datos remotos, pagos ni secretos. Sin migración, dependencia, rediseño,
  confirmaciones, reset de clave ni paginación nueva.

---

### 1. Los cuatro puntos

**El contrato.** La pantalla pedía `total_sellers` y `total_customers`, que el
servidor nunca mandó: dos tarjetas dibujaban `undefined`, y TypeScript no se
entera porque cree lo que dice la interfaz y la respuesta no se valida. Ahora
las claves son las reales y las tarjetas dicen Total de usuarios, Usuarios
comunes y Administradores.

`pending_orders` → `orders_in_process`, con los seis estados abiertos y los
cuatro terminales afuera. Contaba dos de diez: las que esperan o revisan
comprobante, las pagadas y las enviadas quedaban invisibles **justo para quien
mira el panel para saber qué tiene pendiente**.

`total_revenue` → `sold_volume`. Se calcula igual —pagadas, enviadas,
entregadas—; lo que cambia es que ya no se rotula «Ingresos», que decía que
AgroBoeda cobra algo que no cobra.

**Los estados.** Un diccionario en `src/utils/estados.ts` con los catorce, y lo
leen la fila **y** el filtro, así que no pueden discrepar. No tiene rama
«otros»: si mañana aparece un estado sin traducir, el badge lo dice en vez de
disimularlo en gris. Los cinco tonos son los colores que el panel ya usaba; no
agregué ninguno.

**Las cinco cargas.** El fallo es un estado por sección; mientras está puesto no
se dibujan filas. El aviso lleva `role="alert"`, dice qué recurso no cargó y
trae `Reintentar`, que repite la consulta con los filtros vigentes porque la
función de carga los lee del estado.

**El alta.** Frena antes del POST si falta un requerido o la clave no llega a
seis —el mínimo es del Backend, `Field(..., min_length=6)`— y muestra el detalle
real del servidor al lado del formulario, que conserva lo escrito.

### 2. Una corrección de diseño a mitad de camino, que me marcó el 145

Mi primera versión **reemplazaba** la tabla por el mensaje de vacío. El caso 145
se puso rojo, y tenía razón: con cero resultados el pie ya decía la verdad
—«Total: 0 usuarios», «Página 1 de 1», navegación deshabilitada— y sacarlo
perdía información en vez de sumarla. Ahora el vacío **acompaña** a la tabla.

Lo cuento porque es la parte de la pieza que no salió del enunciado sino de una
prueba vieja que sabía algo que yo no.

### 3. El rojo, contra `3370284`, en dos pasos

```
1. sin el diccionario ni el panel nuevo
   [FAIL] 160 … — ENOENT: no such file or directory, open 'src/utils/estados.ts'
2. con el diccionario puesto y el panel y el Backend viejos
   [FAIL] 160 … — el panel dice orders_in_process=undefined y la base dice 6
```

El segundo es el que importa: es el contrato roto, medido contra SQL.

### 4. El verde

```
[PASS] 160 … 10 estados de orden y 4 de producto, todos traducidos; 10 órdenes
reales, una por estado; dashboard contra SQL: 86 en curso, 21 terminales,
volumen 1621491.5; el dashboard dibuja los cinco rótulos nuevos con los valores
de la base; badges verificados en 13 estados (active=20, paused=2, sold_out=2,
deleted=13, placed=17, confirmed=2, paid=15, shipped=1, delivered=2,
cancelled=10, rejected=8, awaiting_transfer_receipt=20,
transfer_receipt_submitted=5); Dashboard: 500 → aviso con «el resumen del
panel» y reintento; Usuarios: 500 → aviso con «la lista de usuarios» y
reintento; Publicaciones: 500 → aviso con «la lista de publicaciones» y
reintento; Órdenes: 500 → aviso con «la lista de órdenes» y reintento;
Documentación: 500 → aviso con «la cola de documentación» y reintento; alta:
la clave corta no sale al servidor y el duplicado vuelve con su detalle
```

Las diez órdenes se crean por el checkout real y sólo el estado se pone en la
base descartable, que es donde el arranque dice que se fabrica lo que la API no
ofrece. Sin las diez, «excluye los terminales» no probaría nada: el caso exige
que haya órdenes terminales y que en curso + terminales dé el total.

### 5. Los casos 145 y 146

Los rompió mi cambio, y era esperable: los dos comparaban el badge contra el
token crudo (`active`, `awaiting_transfer_receipt`, `paused`). Los actualicé en
cuatro lugares, pero **no copiándoles el texto nuevo**: saqué un lector
`textosDeEstado()` que lee `src/utils/estados.ts`, así que los tres casos
comparan contra el mismo diccionario que dibuja la pantalla. Si mañana cambia un
texto, cambia en un lugar.

### 6. Lo que corrí y lo que no

```
SMOKE_CASOS=160 contra 3370284                  rojo, en dos pasos
SMOKE_CASOS=145,146,160 desde base limpia       3/3
suite completa desde base limpia                159/160
npm run build                                   verde
npm run lint                                    verde, 0 avisos
npx tsc --noEmit                                verde
node --check scripts/smoke.mjs                  verde
python -m compileall backend/app                verde
python -m pip check                             No broken requirements found
git -c core.whitespace=cr-at-eol diff --check   limpio
```

**El único rojo de la suite es el 131**, el ambiental conocido: pide `alpine:3`
por el puente de Docker, que este contenedor no tiene. No lo toqué y no lo trae
esta pieza. **No declaro 160/160: declaro 159/160 con ese rojo nombrado.**

No corrí `a11y` ni `contraste` totales, como pediste: el 160 cubre la
accesibilidad de los avisos —`role="alert"` y el botón de reintento— y el resto
del panel no cambió de forma.

### 7. Deuda que sigue abierta, sin tocar

- `--tg-color-focus` sigue valiendo `#1e4a34`, el mismo que `--tg-color-brand`:
  cualquier superficie nueva con el verde de marca nace con el foco invisible.
  Anotado desde `FOOTER-FOCUS-1`.
- Categorías y Configuración siguen avisando por toast, como dejaste dicho. No
  las toqué.

---

## CONTACTO-MARCA-1 — la landing deja de escribir la dirección vieja

**Pieza corta pedida por Emi, fuera de la tarea activa.** La informo acá para
que la veas antes de aceptar `ADMIN-TRUTH-1`; si preferís que espere o que se
revise aparte, decilo y la separo.

- Producto/regresión: `69e9eaf`
- La suite pasa a **161 casos**.
- Alcance: `Footer.tsx`, `ContactPage.tsx` y el caso 161. **En la rama, no en
  `main`.** No desplegué ni toqué nada remoto.

### Qué pidió y qué le contesté

Emi vio `info@topgreen.com.ar` en el pie y pidió que dijera
`info@agroboeda.com`. **Frené antes de hacerlo** y le pregunté una sola cosa: si
esa casilla existe. No existe.

Por eso no la puse, y no es una interpretación mía: es lo que ya decía
`IDENTIDAD-AGROBOEDA-CLIENTE`, que las direcciones heredadas «no deben
reemplazarse por una cuenta inexistente». Medido, además, hay un motivo más
concreto: el formulario de Contacto **abre el cliente de correo con
`destinationEmail`**, así que apuntarlo a una casilla que no recibe convertiría
el formulario en un buzón roto sin que nadie se entere.

Consultado, Emi eligió **ocultar la dirección sin tocar el canal**.

### Qué quedó

El pie y Contacto dicen «Escribinos». El `mailto:` sigue llevando a la casilla
que funciona y el destino del formulario no se toca. El visitante deja de leer
la marca vieja; la dirección aparece recién en su propio cliente al hacer clic.

El día que exista `info@agroboeda.com` se cambian los dos `mailto:` y el
destino, y esta vuelta atrás sobra. **La deuda no se cierra: cambia de forma.**
Sigue anotada.

### El caso 161

No fija ninguna dirección, a propósito: fijarla obligaría a editar la prueba el
día que la casilla cambie. Fija dos propiedades que valen antes y después:

1. ninguna pantalla pública **escribe** una dirección de correo a la vista;
2. la del enlace es **exactamente la misma** a la que manda el formulario. Si
   alguien cambia una y olvida la otra, la página diría una cosa y el correo
   iría a otra.

```
rojo contra 21aa17e   escritorio/Inicio: la pantalla escribe la dirección
                      «info@topgreen.com.ar» a la vista
verde                 SMOKE_CASOS=156,161 → 2/2
```

Corrí el **156** además del focal porque su lista de apariciones técnicas nombra
esos dos archivos: el `mailto:` conserva la dirección, así que sigue verde. No
repetí la suite completa: es un cambio de copy en dos nodos, y el 160 y el resto
no lo tocan. Build, lint, tsc, `node --check` y `diff-check`, verdes.
