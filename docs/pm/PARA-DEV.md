# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — PRODUCT-DETAIL-PAGE-1

**Prioridad y problema.** Emi pidió que al abrir una publicación se llegue a
una página, como destino propio del catálogo. Hoy el detalle es un modal
controlado por `ProductCard`: no tiene URL distinta, no se puede compartir
ni recargar como publicación. Esta pieza mejora la presentación existente
antes del QA final del MVP.

**Alcance.** Convertí el detalle actual en una página de la misma pestaña con
URL estable que incluya el ID de la publicación. El clic en la tarjeta desde
Mercado, Inicio o Servicios debe navegar allí. Un enlace pegado en una pestaña
nueva o recargado debe buscar la publicación por ID con la API existente y
mostrar el mismo contenido, sin depender del listado previo. Integralo con
la política única de navegación de `src/navegacion/`; Atrás/Adelante deben
seguir el historial normal, sin entradas fantasma ni un segundo oyente de
`popstate`.

**Contenido y acciones.** Conservá la información, imagen/crédito, precio o
modalidad, vendedor y acciones que hoy ofrece el detalle. Compra, cantidad,
stock, cotización, perfil del vendedor e ingreso requerido deben mantener
su comportamiento y sus guardas. Después de ingresar, la persona debe volver
a la misma publicación; no agregues productos al carrito automáticamente.
Mostrá carga y una salida clara cuando la API devuelva 404, la publicación
no sea visible o falle la consulta. No presentes como vigente una publicación
inexistente usando datos viejos de la tarjeta.

**Regreso y experiencia.** Atrás desde la ficha debe volver al origen con
filtros, orden, página y posición de desplazamiento conservados en el Mercado.
Si se abrió la ficha por URL directa, ofrecé un enlace visible al catálogo.
La página debe ser usable en móvil y escritorio, con título claro, foco
coherente al navegar, enlace/acción accesible por teclado y sin desborde
horizontal ni errores de consola. Podés adaptar la disposición del contenido
actual a una página, sin copiar diseño de otro sitio.

**Fuera de alcance.** Atributos por rubro aún no entregados por la clienta,
SEO, recomendaciones, nuevos campos, pagos, permisos nuevos, backend o
migraciones, rediseño global, integración y despliegue.

**Aceptación verificable.** Una prueba de navegador debe cubrir apertura
desde cada una de las tres superficies, URL distinta y estable, recarga y
enlace directo; Atrás/Adelante y regreso al Mercado con filtros, orden,
página y scroll; 404/no visible y error de red; compra con y sin sesión,
cotización y perfil del vendedor; móvil/teclado. Agregá al menos un negativo
discriminante que falle con el modal anterior y pase con la página real.
Revisá los casos existentes que asumían que el detalle era una capa.

**Pruebas y evidencia.** Corré build, lint, tipos y las pruebas que tu entorno
permita. Prepará regresión focal y reportá resultados exactos; Docker/PostGIS,
smoke con pila real, a11y y contraste dependientes de ella quedan a cargo de
PM según `DECISIONS.md`. No hagas una suite completa en tu entorno sólo por
volumen: PM definirá la puerta independiente según el alcance efectivo.

**Leé antes:** decisión del 23/09 en `DECISIONS.md`, navegación actual,
`ProductCard`, `ProductDetailModal`, API `getProductDetail` y casos de
catálogo/retorno del historial. Si el enlace directo exige cambiar backend,
permisos o la política central de navegación de forma incompatible con los
recorridos actuales, frená y respondé con evidencia antes de ampliar alcance.

**Entrega.** Respondé en `PARA-PM.md` con SHA exacto, archivos cambiados,
recorridos antes/después, pruebas y negativo discriminante, lo que no pudiste
ejecutar y riesgos restantes. No integres ni despliegues.
