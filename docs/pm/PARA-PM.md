# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## Fuera de ciclo — 2026-09-20 — dos documentos nuevos, para que no gastes en leer un `.docx`

No es un informe de tarea y no reemplaza ninguno: `BACKUP-RESTORE-1` R4 ya
quedó aceptada e integrada, y el informe de la tarea activa va a pisar este
texto cuando llegue. Esto es material que dejó Emi y que conviene que esté en
el repositorio, no en un chat.

### 1. `DEVOLUCION-CLIENTA-REVISION-01-2026-09-20.md`

La clienta mandó su devolución de la revisión 01 en un `.docx` de 5,5 MB con
capturas. **Está transcripta entera en ese `.md`, para que no tengas que abrir
el original**; el `.docx` queda versionado en `originales/` con su SHA-256.

Son **15 observaciones**, clasificadas por tipo y tamaño, cada una con lo que
dice la clienta y con el estado real de hoy verificado contra el repositorio.
Lo que importa antes de planificar:

- **No pudo registrarse.** Nunca le llegó el correo, así que **no vio
  registro, publicación, compra, administración ni pago**. Toda su devolución
  es sobre pantallas públicas. Antes de pedirle una segunda revisión, esto hay
  que resolverlo, y es operación, no Dev: SMTP del entorno desplegado, que ya
  figura en los pendientes de `NOW.md`.
- **Dos afirmaciones suyas chocan con reglas vigentes del proyecto**: quiere
  que seamos *agentes de retención* —retener el pago hasta la doble
  conformidad— y dice que AgroBoeda **sí** cobra comisión. Lo primero es
  exactamente lo que el proyecto tiene prohibido —no recibir, no retener y no
  administrar fondos de terceros— y ella misma dice que lo tiene que hablar con
  Laura. Lo segundo contradice lo que está construido: hoy no se manda
  `marketplace_fee` a Mercado Pago, ni un porcentaje ni un cero. **Son
  decisiones, no tareas.** No toqué nada de eso.
- **Tres decisiones conceptuales** que no son de Dev y que condicionan todo el
  copy: qué es Inicio, si Servicios sigue siendo una pestaña aparte —lo objeta
  tres veces— y que AgroMarket se lea como un módulo dentro de un ecosistema
  más amplio.
- **La pieza más grande**: campos por rubro —marca, modelo, año, potencia— que
  se carguen en el alta y alimenten el filtro. Avisa que le va a pasar a Marian
  los datos de filtrado. Conviene esperarlos antes de diseñar: hacerlo dos
  veces cuesta más.

**Nada de esto lo empecé.** Emi fue explícita: es para sumar, no para ahora.

### 2. `ESTADO-DATOS-Y-FILTROS-2026-09-20.md`

El estado real de la base y de los filtros, medido sobre fuentes versionadas
—el padrón, el seed, los modelos, las migraciones y el código—, no sobre una
base levantada para la ocasión. Está para que esto no se vuelva a discutir de
memoria:

- la base existe y se migra: 19 modelos, 17 migraciones, PostGIS en uso real
  para el radio de los fletes;
- el padrón es una copia versionada de **Georef v2** con SHA verificado antes
  de sembrar: **4.028 localidades, 24 provincias**;
- los filtros existen de los dos lados: la API filtra por texto, categoría,
  tipo, provincia, localidad, precio, stock, vendedor y orden; la barra lateral
  ofrece tipo, categoría, subcategoría, provincia, localidad, precio, stock y
  calificación. Y **viven en la URL**: un resultado filtrado se comparte y
  volver atrás devuelve los controles;
- lo que **no** existe todavía es ningún atributo por rubro, que es justamente
  lo que pide la clienta.

Y una medición que te ahorra una discusión: **las «localidades repetidas» que
vio la clienta son dos cosas distintas.** De los 154 pares repetidos,

- **105 sobran de verdad**: Georef lista la localidad y una entidad adentro con
  el mismo nombre —«Mar del Plata» `06357110` y `0635711003`—, y 96 de esas 105
  están a menos de un kilómetro. Se filtran por condición, no a mano;
- **49 no sobran**: son lugares distintos que se llaman igual en departamentos
  distintos. Ahí no falta borrar: falta **mostrar el departamento** para poder
  elegir.

O sea: es una pieza chica y medida, no una limpieza de datos.

### Lo que hice y lo que no

Escribí dos documentos, guardé el original de la clienta en `originales/` con
su SHA y lo anoté en el README de esa carpeta. **No toqué producto, ni arnés,
ni la tarea activa. No desplegué. No cambié datos remotos, pagos, secretos ni
la configuración externa de Mercado Pago.**
