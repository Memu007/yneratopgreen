# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Decisión sobre LINK-ABIERTO-DEVUELTO-1 — aceptada

Sobre `cac729d` (producto en `4b02fec`). Tu informe `5af8ccf` difiere sólo en
`docs/pm`. Evidencia en `REPRODUCCION-LINK-ABIERTO-DEVUELTO-1-2026-09-30.md`.

- **El 231:** con el `cobro.py` de la base da rojo con tus 5 problemas; con la
  entrega, verde.
- **Negativos:** tus 2 dan su rojo. También dan rojo los 3 míos:
  - el criterio con devuelto y sin contracargo: el 231 ve el 409 con 1 y el
    link del contracargo vivo;
  - consolidar que vuelve a descontar una reserva ya consolidada: el 231 ve el
    stock movido. Cubre «sin mover stock», que tus negativos no tocaban;
  - el reconciliador que saltea los devueltos: el 231 ve los dos links vivos y
    el 409 del final. El caso mira el barrido, no sólo el criterio.
- **Suite completa desde base nueva:** 230/231. Sólo cae el 131, de entorno.
  La lista de casos que tuvieron que terminar ventas coincide con la tuya.
- **Puertas:** verdes.
- **Los terminadores:** en `smoke.mjs` volvieron las mismas cuatro líneas de
  `0495b31`, y `mp-doble.mjs` quedó sin CR.

**Tus riesgos:** aceptados. Ya pasaban con un pago aprobado, y hoy no hay
ninguna vendedora con un link así.

**Publicada por PM en `77d3d2c` el 01/10**, con autorización de Emi. Vos no
integres ni despliegues.

---

## Tarea activa — INICIO-ECOSISTEMA-1

**Decisión de Emi (30/09):** aprobó la maqueta de Inicio versión 2 y pidió que
se programe. `LINK-ABIERTO-DEVUELTO-1` está aceptada: empezala ahora.

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Qué es

Después de la presentación, la clienta pidió que Inicio muestre el ecosistema y
no sólo el Mercado, con el texto de su prototipo, y que se saque «Quiénes
somos». Inicio pasa a ser la maqueta
`docs/pm/maquetas/INICIO-ECOSISTEMA-V2-2026-09-30.html`. Se abre desde el
repositorio y usa las fuentes y las fotos de `public/`.

- **Los textos de abajo están aprobados** y van tal cual.
- **La forma la da la maqueta; los valores, `tokens.css`.**
- **Lo que no va:** la franja «Maqueta…» de arriba. El 242 es de ejemplo.

### Qué entra

1. **Inicio, de arriba hacia abajo.**
   - **Portada, sobre la banda verde de la marca:**
     - rótulo: «Bienvenido a AgroBoeda»;
     - título: «Producción, mercado, cumplimiento y tecnología en una misma ruta.»;
     - bajada: «La plataforma parte de tu producción y su destino para
       determinar qué registrar, qué validar, qué tecnología realmente
       necesitás y cómo llevar la producción al mercado.»;
     - botones:
       - «Conocé el ecosistema»: lleva a los servicios y deja el foco en su
         título;
       - «Entrar al Mercado»;
     - debajo de los botones: «Hoy funciona el Mercado. El resto del
       ecosistema se suma por etapas.»;
     - la foto de cosecha de hoy, con su banda.
   - **Ecosistema.** Arriba:
     - rótulo: «El ecosistema AgroBoeda»;
     - título: «¿Qué querés hacer?»;
     - bajada: «Definí qué producís y dónde querés colocar la producción.
       AgroBoeda relaciona la ruta productiva con mercado, trazabilidad,
       cumplimiento, certificaciones y tecnología.»

     Después, ocho tarjetas del mismo tamaño:

     | # | Nombre | Texto | Estado |
     |---|---|---|---|
     | 01 | Ruta productiva | Construí una ruta según producción, destino y mercado objetivo. | Próximamente |
     | 02 | Mercado | Buscá productos, maquinaria, insumos, tierras y servicios o publicá una oferta. | Disponible hoy |
     | 03 | Trazabilidad | Generá eventos, datos y evidencias vinculados a la ruta y al lote. | Próximamente |
     | 04 | Cumplimiento y certificaciones | Controlá requisitos, documentos y certificaciones aplicables. | Próximamente |
     | 05 | Tecnología | Separá tecnología necesaria de mejoras opcionales y calculá inversión. | Próximamente |
     | 06 | Noticias del agro | Lo que pasa en el mundo agropecuario, en un solo lugar. | Próximamente |
     | 07 | Charlas y capacitaciones | Encuentros con especialistas para producir y vender mejor. | Próximamente |

     - La del Mercado suma:
       - el número de publicaciones: es el mismo `total` de hoy, y mientras no
         se sabe no se escribe ninguno;
       - «Entrar al Mercado».
     - Las de «Próximamente» no tienen enlace ni botón.
     - La octava cierra el bloque:
       - rótulo: «Por etapas»;
       - título: «¿Te interesa alguno?»;
       - texto: «Cada servicio se suma por etapas, después del Mercado.»;
       - el botón «Escribinos», que lleva a Contacto.
   - **Cómo funciona:**
     - rótulo: «Cómo funciona»;
     - título: «Una misma producción puede seguir distintas rutas.»;
     - bajada: «Cada paso de la ruta tiene su servicio en el ecosistema. El
       último, comercializar, ya funciona en el Mercado.»;
     - los cinco pasos, sobre la línea de la ruta. Sólo el quinto se marca
       disponible.

     | Paso | Texto | Servicio |
     |---|---|---|
     | 01 · Producir | Qué producto, dónde, escala y etapa. | Ruta productiva |
     | 02 · Destinar | Consumo, industria, exportación u otro destino. | Ruta productiva |
     | 03 · Cumplir | Requisitos, documentos, controles y certificaciones. | Trazabilidad y cumplimiento |
     | 04 · Tecnologizar | Lo necesario, recomendable y avanzado. | Tecnología |
     | 05 · Comercializar | Oferta, comprador, logística y operación. | Mercado · Disponible hoy |

   - **Principio:**
     - rótulo: «Principio de AgroBoeda»;
     - frase: «La tecnología se decide por la ruta, no al revés.», con «por la
       ruta» en cereal;
     - texto: «Una materia prima destinada a una industria puede requerir un
       esquema de registros y controles diferente al de una producción
       destinada a consumo humano directo o a un mercado de exportación
       exigente. AgroBoeda va a adaptar la gestión a la ruta seleccionada.»;
     - al lado, el gráfico de los tres niveles:
       - «Registro esencial», con «Ruta industrial»;
       - «Registro ampliado»;
       - «Registro exhaustivo», con «Ruta exportación».

       Las barras son decorativas; los nombres se leen.
   - **Salen de Inicio:**
     - «Publicar una oferta»;
     - los cuatro tipos de publicación;
     - «Lo que muestra cada publicación».
2. **«Quiénes somos» sale del sitio:**
   - del menú, en escritorio y en celular;
   - del pie;
   - la página misma.

   Un enlace viejo (`?section=about`) lleva a Inicio con la barra reescrita,
   como hoy `services` en `NOMBRES_RETIRADOS`. El manual de uso deja de
   nombrarla (`docs/USER_MANUAL.md`, líneas 91 y 539).
3. **Las fotos de las tarjetas** son las de la maqueta, de `public/`:

   | Tarjeta | Archivo | Licencia |
   |---|---|---|
   | Ruta productiva | `catalogo/planificacion-riego-fertirriego.webp` | dominio público |
   | Mercado | `catalogo/servicio-cosecha-monitor-rendimiento.webp` | CC0 |
   | Trazabilidad | `catalogo/terneros-angus-lote-20.webp` | dominio público |
   | Cumplimiento y certificaciones | `catalogo/muestreo-suelo-recomendacion-fertilizacion.webp` | CC BY 2.0 |
   | Tecnología | `catalogo/sensores-humedad-suelo-iot.webp` | CC BY 2.0 |
   | Noticias del agro | `media/comercial/servicios-relevamiento-hero-960.webp` | de la clienta |
   | Charlas y capacitaciones | `catalogo/dron-pulverizador-agricola-20l.webp` | CC0 |

   - Son ilustrativas: van con `alt` vacío, carga diferida, ancho y alto.
   - Ningún texto va encima de una foto: el estado va debajo, como en la
     maqueta.
   - **Las dos CC BY llevan crédito** debajo de las tarjetas, con este texto:
     «Fotos de Cumplimiento y Tecnología: “soil samples”, de photofarmer, y
     “soil-sensors”, de Air Resources Laboratory, con licencia CC BY 2.0.
     Recortadas.»
     - Cada obra y cada autor enlazan a su página de Flickr, y la licencia a
       su texto.
     - Los datos están en `archivo/cerrados/INVENTARIO-FOTOS-CATALOGO-2026-09-09.md`.
4. **En celular, como la maqueta:** los servicios son filas con miniatura y la
   ruta va vertical.

### Casos y negativos

- **Inicio:**
  - los siete servicios van en su orden, y sólo el Mercado dice
    «Disponible hoy»;
  - ninguna tarjeta «Próximamente» tiene enlace ni botón;
  - el número del Mercado, también en singular;
  - «Conocé el ecosistema» deja el foco en «¿Qué querés hacer?»;
  - «Entrar al Mercado» y «Escribinos» llevan adonde dicen;
  - el crédito de las fotos está.
- **Quiénes somos:**
  - no aparece en el menú, ni en escritorio ni en celular, ni en el pie;
  - `?section=about` termina en Inicio sin agregar una entrada al
    historial.
- **Casos de hoy:** `smoke.mjs` nombra «Quiénes somos» 46 veces.
  - Si un caso la usa como una sección más, cambiala por otra.
  - Si prueba algo propio de esa página, retiralo.
  - Lo mismo con los casos que miran el Inicio de hoy.
  - Decí cuáles retiraste y por qué.
- **Negativos, que tienen que dar rojo:**
  - una tarjeta «Próximamente» con enlace;
  - «Quiénes somos» de vuelta en el pie;
  - el crédito de las fotos sacado.

### Aceptación verificable

1. Los casos y los negativos.
2. Capturas de Inicio en 1440 y 390, junto a las de la maqueta en los mismos
   anchos, con lo que difiere y por qué.
3. Suite completa desde una base recién creada.
4. a11y `--todas`, contraste, auditoría móvil y las dos guías.
5. Build, lint, tipos, diff-check con `cr-at-eol` y la cuenta de CR por
   archivo contra la base.

### Frená y consultá

- Si una foto no se puede usar como dice el inventario.
- Si algún texto no entra en 390 sin cortar palabras.
- Si hace falta un color, una medida o un componente que el sistema no tiene.
- Si sacar «Quiénes somos» toca algo más que:
  - el menú, el pie y la página;
  - el manual y sus casos.

### Fuera de esta pieza

- El título de la pestaña, la descripción para buscadores y el lema del pie
  siguen diciendo «Mercado agropecuario».
- Ningún servicio nuevo: los «Próximamente» son sólo tarjetas.

### Entrega en `PARA-PM.md`

- el SHA;
- las capturas y lo que difiere de la maqueta;
- los casos que retiraste o cambiaste;
- los negativos, la suite y las puertas;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

Lo decide la PM. Lo que depende de Emi puede reordenar la cola:

- la parte B de las publicaciones de prueba (el transportista y el flete),
  cuando ande el correo;
- P3:
  - los errores de la API en «tú»;
  - las guías que no nombran los avisos de pago;
  - los tres de `COBRO-CONCURRENTE-1`;
  - los cuatro de `PAGO-ORDEN-CERRADA-1` y los de
    `RECONCILIADOR-PROGRAMADO-1` y `DESVINCULAR-CON-COBROS-1`, en sus
    reproducciones;
  - ingresar con una contraseña de más de 72 bytes da 500 (bcrypt);
  - cambiar la propia contraseña desde la pantalla: la API tiene `/auth/change-password` y ninguna pantalla lo usa;
- **antes del 01/12/2026:** sacar de `railway.toml` la configuración del
  Backend y del Frontend (Railway deja de leerla ese día). Pieza propia;
- una devolución o un contracargo que llega con la cuenta desvinculada no
  se registra: quien compra sigue viendo «pagado» (freno de
  `DESVINCULAR-CON-COBROS-1`);
- **antes del lanzamiento real de Mercado Pago:** si la prueba lo confirma,
  la vinculación en Safari, Brave y Firefox (la cookie del Backend en otro
  sitio). Lo más probable es que alcance con un dominio propio, que es de Emi
  y de Railway, no de código;
- el título de la pestaña, la descripción para buscadores y el lema del pie
  con el ecosistema, cuando la clienta dé el texto;
- el correo (#15);
- las cuentas de prueba de Mercado Pago;
- la mejora de la logística en los filtros, por definir.
