# Dev → PM

Sol: este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-05. Entrega de la tarea única: **prototipo navegable del flujo
de logística**. Commit `778f6ab`, pusheado a `main`.

---

## 1. Qué hay y cómo se abre

```bash
xdg-open docs/ux/logistica/index.html
```

`file://`, sin API, sin base, sin servidor y **sin una sola dependencia
nueva**: un HTML, un CSS y un JavaScript.

| Archivo | Qué |
|---|---|
| `docs/ux/logistica/index.html` | Las nueve pantallas y la barra del prototipo |
| `docs/ux/logistica/prototipo.css` | Tokens copiados de `src/index.css` |
| `docs/ux/logistica/prototipo.js` | Estado, datos ficticios y navegación |
| `docs/ux/logistica/README.md` | Cómo recorrerlo y qué **no** es |
| `docs/ux/logistica/capturas/` | 19 capturas, 1440×900 y 390×844 |

**Sin tocar `backend/`, migraciones, modelos, endpoints ni el frontend
productivo de `src/`.** El commit entero vive dentro de `docs/ux/`.

La barra negra de arriba es del prototipo, no del producto: cambia de perfil,
salta a cualquier paso y **fuerza los cuatro estados de búsqueda** sin
esperar a que ocurran.

---

## 2. Tus nueve criterios, uno por uno

Verificado con navegador real en las dos medidas. Salida completa:

```text
=== escritorio 1440x900 ===        === movil 390x844 ===
  ✓ el checkout muestra 2 pedidos    ✓ el checkout muestra 2 pedidos
  ✓ sin desborde horizontal en checkout / búsqueda / resumen / mis compras /
    perfil transportista / venta
  ✓ el contacto NO aparece antes de seleccionar
  ✓ se explica que el contacto aparece al seleccionar
  ✓ la tarjeta aclara que TopGreen no verifica
  ✓ aclara distancia en línea recta
  ✓ estado "carga" visible
  ✓ estado "vacio" visible
  ✓ estado "error" visible
  ✓ el contacto SÍ aparece después de seleccionar
  ✓ cada pedido conserva su propio transportista
  ✓ el resumen aclara que el flete no entra en el total
  ✓ se puede quitar la selección
  ✓ Mis compras muestra transportista y contacto
  ✓ la tarjeta del viaje no trae precios de productos, comprobantes ni
    datos bancarios
  ✓ el prototipo deja explícito que esos datos quedan ocultos
  ✓ no usa "certificado por TopGreen" / "tarifa calculada" / "ruta óptima" /
    "entrega garantizada"
  ✓ controles táctiles ≥44px (todos)
  ✓ sin errores de consola (ninguno)

=== teclado ===
  ✓ se llega a los botones con Tab
  ✓ se llega a los controles con Tab
  ✓ el foco de teclado se ve (BUTTON: 3px solid)

TODO OK
```

| Criterio | Estado |
|---|---|
| 1. Camino completo con clics, y volver a cambiar o quitar | ✅ recorrido de punta a punta en las dos medidas |
| 2. Transportista y vendedor sin editar la URL | ✅ desde la barra, con `role="tab"` |
| 3. Los cuatro estados visibles por control | ✅ selector "Estado de la búsqueda" |
| 4. Contacto oculto antes, visible después | ✅ verificado buscando el teléfono en el DOM |
| 5. Compra con dos vendedores, selección por orden | ✅ pedido A y pedido B con transportistas distintos |
| 6. 1440×900 y 390×844, sin desborde, táctiles 44 px | ✅ medido, no estimado |
| 7. Teclado, foco, etiquetas y contraste | ✅ ver abajo |
| 8. `npm run build` verde y `git diff --check` limpio | ✅ build en verde; `--check` sin salida |
| 9. Capturas de ambos tamaños e informe | ✅ 19 capturas y esto |

**Sobre el criterio 7**, para que sepas qué medí y qué no: verifiqué
navegación por `Tab`, que el foco de teclado se ve con un contorno de 3 px, y
que todos los campos tienen `label` asociado. **El contraste no lo medí con
herramienta**: los colores salen de `src/index.css` sin cambiarlos, así que
el prototipo no mejora ni empeora lo que ya tiene la aplicación.

---

## 3. Lo que decidí y quiero que revises

Cinco cosas que la especificación no fijaba y tuve que resolver para que el
prototipo se pudiera recorrer. **Ninguna es irreversible, todas son tuyas.**

**1. La elección de flete no es obligatoria para continuar.** Se puede pasar
al resumen sin decidir, y ahí dice *«Todavía no dijiste cómo se traslada este
pedido»* con un botón para volver. Lo hice permisivo porque bloquear el
checkout por una decisión logística es agregar fricción a una compra que hoy
se completa sin ella. **Si preferís que sea obligatorio, es un cambio chico.**

**2. Elegir "Necesito flete" no muestra resultados solo**: hay un botón
explícito de buscar. Evita disparar una búsqueda que quizá el comprador no
quería, y deja el estado de carga como algo que él provocó.

**3. Cambiar de destino es una lista cerrada de localidades**, no texto libre.
Es coherente con el padrón: hoy `products.locality_id` es obligatorio contra
las 4.028 localidades. Texto libre nos dejaría destinos que después no se
pueden geolocalizar.

**4. La distancia se muestra por transportista** —"aprox. 180 km en línea
recta"— y no como un orden ni un ranking. No dice "el más cercano" ni ordena
por conveniencia, porque eso ya sería una recomendación de la plataforma.

**5. El bloque del vendedor cuando el comprador coordina solo** dice
exactamente eso y nada más. Sin acciones, sin estado, sin cotización.

---

## 4. Dos cosas que la especificación pide y el sistema hoy no tiene

Estas son las que de verdad quiero que mires.

### 4.1 No existe el "nombre comercial"

Tu punto 5 pide que la tarjeta muestre **nombre comercial**. En el modelo hay
un solo campo de nombre:

```python
full_name = Column(String(255), nullable=False)   # models/user.py:25
```

No hay razón social, ni nombre de fantasía, ni nada parecido. Hoy un
transportista se registra como *"Juan Pérez"*, y así aparecería en la tarjeta.

En el prototipo usé nombres de empresa —"Transportes La Carreta"— porque es lo
que pediste y es lo que un comprador espera ver. **Pero eso es una promesa que
el sistema todavía no puede cumplir.**

Las salidas, y es decisión tuya:

- **Aceptar el nombre personal** y que la tarjeta diga "Juan Pérez". Cero
  trabajo, peor presentación.
- **Agregar un campo de nombre comercial** en el perfil de transportista.
  Entra natural en la Fase 2, que ya tiene que hacer editable ese perfil.

**No lo di por resuelto ni cambié el esquema.** Lo dejo acá porque, si se
decide en Fase 2, sale gratis; si se decide en Fase 3, hay que rehacer la
tarjeta.

### 4.2 El contacto queda visible para cualquiera

El prototipo muestra el contacto al seleccionar, tal como pediste. Y está
bien para el alcance contractual.

**Anoto dónde va a chocar:** las suscripciones se movieron a Fase 6, y el
candado de contacto es justamente lo que ellas venden. **Esta pantalla —la
tarjeta después de seleccionar— es el único lugar donde ese candado va a
entrar.** Si en Fase 6 aparece, esta pantalla cambia; si no aparece, no cambia
nada.

No es un problema hoy. Es para que cuando llegue Fase 6 nadie se sorprenda de
que hay que volver acá.

---

## 5. Decisiones que no tomé

1. **No implementé búsqueda real.** Los resultados están escritos a mano en
   `prototipo.js`, a la vista. La cercanía con PostGIS es Fase 3.
2. **No toqué el frontend productivo.** El prototipo es una copia visual, no
   un componente reutilizable. Cuando se implemente de verdad, se escribe en
   React; esto queda como referencia y se puede borrar.
3. **No inventé una regla comercial nueva.** Un transportista por pedido, sin
   cotización, sin tarifa y sin estados de negociación, que es lo que dice el
   contrato: directorio, no motor.
4. **No agregué peso ni volumen a las publicaciones.** La vista del
   transportista dice "aproximadamente 2.000 kg" como dato declarado por el
   vendedor, y aclara que el sistema no lo calcula ni lo verifica. **Ese campo
   hoy no existe**; si la Pieza B lo necesita, es una decisión de Fase 3.
5. **Nada de lo que pusiste fuera de alcance**: sin PostGIS, sin endpoints,
   sin mapas, sin tarifas, sin Carta de Porte, sin mensajería, sin
   suscripciones, sin Mercado Pago, sin Railway, y sin cambios visuales al
   resto del marketplace.

---

## 6. Riesgos

**El prototipo se va a desactualizar.** Es un archivo suelto que nadie compila
ni prueba en la suite. En cuanto la implementación real arranque, esto y el
producto empiezan a divergir en silencio. Mi recomendación: **borrarlo cuando
la Pieza B esté hecha**, y que las capturas queden como registro.

**Copié los tokens de `src/index.css` a mano.** Si mañana cambia la paleta de
la aplicación, el prototipo queda con la vieja. Es aceptable para algo que
dura semanas, y es la única forma de abrirlo sin compilar nada.

**Lo verifiqué con Chromium únicamente.** No probé Firefox ni Safari.

---

## 7. Lo que necesito de vos

1. **Las dos definiciones del punto 4**: nombre comercial sí o no, y si el
   candado de contacto de Fase 6 va a caer sobre esta pantalla.
2. **Las cinco decisiones del punto 3**, aunque sea con un "así está bien".
3. **El enunciado de la próxima pieza.** Según el cronograma, la Fase 1
   cierra el 20/08 y esto era lo que faltaba.

Y siguen abiertas de antes, sin apuro: la pieza chica del reembolso heredado
—que vos misma dejaste para Fase 4—, y `carrier_transport_certified`, que
ahora tiene una forma concreta en el prototipo: **declaración con detalle y
fecha**, con el texto de atribución al lado. Si te gusta como quedó, eso baja
la decisión de esquema a algo ya dibujado.

El entorno local sigue levantado por si querés que verifique algo más.
