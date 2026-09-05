# Auditorías UX externas de Claude — registro temporal

Fecha: 2026-08-30.  
Base revisada: `main` `7e0b87811642627e17241e117ff78dba8d61159e`.  
Método de la auditora: lectura estática; sin navegador, Docker ni cambios al
repositorio.

Este archivo conserva las tres auditorías externas para que una PM futura no
dependa del chat ni de memoria. **No es una tarea vigente ni una aceptación de
todos los diagnósticos.** La PM contrastó los hallazgos principales con código,
alcance y decisiones; las prioridades corregidas están escritas abajo.

Regla de salida:

- `ORD-SELF-1` sigue siendo la única tarea activa; estas fichas no la
  interrumpen.
- Cada bloque se convierte en tarea sólo cuando la PM lo prioriza en
  `PARA-DEV.md`.
- Un hallazgo se retira de la lista viva cuando producto, regresión e informe
  quedan aceptados por PM. No se mantiene un backlog duplicado: el historial de
  Git conserva esta auditoría.
- Cuando no quede ningún hallazgo accionable, se elimina este archivo y su
  enlace de `NOW.md` en el mismo cierre documental.

## Dictamen PM resumido

Las auditorías son valiosas y contienen evidencia concreta, pero la auditora
infla algunas prioridades y no conoce por completo los límites contractuales.
PM confirmó directamente:

- el problema estructural de historial y rutas de A1/A2/A3/A8;
- la regresión de servicios «Agotado» de F1;
- el callejón sin salida de una transferencia cerrada antes de adjuntar el
  comprobante de F2;
- el cierre destructivo de formularios de F3;
- y que un carrito inválido en `localStorage` de R2 deja la aplicación atrapada
  en el `ErrorBoundary` incluso después de recargar.

PM corrigió tres conclusiones importantes:

- F4, recuperación de contraseña, está expresamente fuera del MVP en
  `ALCANCE-Y-LIMITES.md`; puede agregarse una salida de soporte, no abrir un
  módulo nuevo.
- F6 es una manifestación de la deuda C3 ya registrada, no una raíz nueva.
- R3 queda descartado: `POST /ratings/` acepta tanto número como UUID de orden.

## Auditoría 1 — navegación y claridad

### A1 — navegación del navegador no participa de la aplicación

**Dictamen PM:** cerrado en `bcdd448`/`aeafc13`.  
**Recorrido:** Inicio → Mercado → Servicios → Atrás.  
**Actual:** `handleNavigate` usa `replaceState` para todas las secciones y no
existe un listener de `popstate`; Atrás puede sacar a la persona de TopGreen en
vez de regresar a la sección anterior.  
**Evidencia:** `src/App.tsx`, `src/hooks/useProductFilters.ts`.  
**Cierre:** una política con History API nativa restaura sección, URL y filtros;
PM verificó el caso 147 aislado y la suite completa en **147/147**.

### A2 — pathname especial sobrevive al abandonar pago o verificación

**Dictamen PM:** cerrado en `bcdd448`/`aeafc13`.  
**Recorrido:** entrar en `/payment/*` o `/verificar-correo`, usar la cabecera
para ir al Mercado y recargar.  
**Actual:** `handleNavigate` conserva `window.location.pathname`; la recarga
prioriza la ruta especial y devuelve a pago/verificación.  
**Cierre:** las cuatro rutas de llegada se reemplazan al salir, normalizan `/`
y no reviven al recargar; PM lo reprodujo en el caso 147.

### A3 — Servicios, Quiénes somos y Contacto no tienen URL persistente

**Dictamen PM:** cerrado en `bcdd448`/`aeafc13`.  
**Actual:** sólo Mercado escribe `section=marketplace`; las demás secciones
borran `section`, por lo que recargar o compartir vuelve a Inicio.  
**Cierre:** las cinco secciones tienen URL canónica, enlace directo y recarga;
PM lo reprodujo en el caso 147.

### A4 — Contacto declara éxito sin saber si abrió un cliente de correo

**Dictamen PM:** confirmado, bajar de P1 a P2.  
**Actual:** `ContactPage` ejecuta `window.open(mailto:)`, marca éxito y vacía el
formulario. `window.open` no demuestra que exista un cliente configurado.  
**Cierre mínimo:** copy honesto «Abrir en mi correo» y conservar el texto.

### A5 — solicitar cotización pierde la publicación de origen

**Dictamen PM:** confirmado por cableado, P2.  
**Actual:** el CTA navega a Contacto genérico sin nombre, vendedor, asunto ni
mensaje precargado.  
**Cierre mínimo:** continuidad explícita de la publicación; no crear
mensajería nueva.

### A6 — filtros inválidos en URL producen un vacío falso

**Dictamen PM:** confirmado por las guardas de carga, P2.  
**Actual:** una categoría o provincia inexistente hace `return` antes de
consultar y la grilla puede afirmar que no hay resultados.  
**Cierre mínimo:** descartar el filtro inválido o explicarlo; nunca mostrar un
vacío como si la API hubiese contestado.

### A7 — el wordmark abre Mercado en vez de Inicio

**Dictamen PM:** decisión de producto, P2. PM recomienda adoptar la convención
de volver a Inicio, pero no se impone sin la aprobación de Emi.  
**Evidencia:** `src/components/Header/Header.tsx`.

### A8 — resultado de pago, Atrás y URL quedan desincronizados

**Dictamen PM:** cerrado en `bcdd448`/`aeafc13`.  
**Actual:** `onGoHome` hace `pushState('/')`, pero no hay `popstate`; Atrás puede
cambiar la URL sin cambiar la pantalla. Se cierra y prueba junto con A1/A2.

### A9 — publicar sin sesión no retoma la intención

**Dictamen PM:** confirmado, P2.  
**Actual:** Inicio y Servicios abren un Login sin continuidad; luego de entrar
hay que volver a encontrar la acción. El aviso usa tuteo.  
**Cierre mínimo:** reutilizar la puerta de ingreso con continuidad ya aceptada
y pasar el copy a voseo.

### A10 — promesas/acciones sin efecto

**Dictamen PM:** confirmado, P2 de pulido.  

- El botón Buscar sólo escribe en consola aunque el filtrado sea en vivo.
- La FAQ promete «planes» inexistentes y contradice la comisión cero del MVP.

Debe quitarse la acción/promesa o darle una conducta real, sin inventar planes.

### Vecinos y deudas ya conocidas

- Con más de cien publicaciones, el conteo móvil y el ordenamiento del cliente
  pueden describir sólo la página descargada. Se cierra con
  `ux2c/DEUDA-PAGINACION.md`, no como parche aislado.
- B4 (detalle e historial) quedó cerrado en NAV-URL-1: el primer Atrás cierra
  el detalle y conserva sección/filtros. C1 quedó cerrado en
  MODAL-LIFECYCLE-1: el detalle devuelve foco al disparador exacto en las tres
  superficies y por las tres formas de cierre. C2 (N+1 de imágenes) y C3
  (doble fuente de ubicación) siguen en el inventario `acbf3b6`.

## Auditoría 2 — formularios y recorridos operativos

### F1 — servicios vuelven a «Agotado» después de recargar el panel

**Dictamen PM:** cerrado.
**Cierre:** `a038b56`/`bad5a1b`. PM verificó el caso 143 aislado en 1/1 y la
suite oficial en 143/143 desde bases limpias, además de build y lint. El
mapeador único conserva anatomía, modalidad y estado al cargar, pausar,
reactivar, editar y recargar; el producto real sin stock permanece «Agotado».
Evidencia en `REPRODUCCION-SERVICE-STATE-1-2026-09-02.md`.
**Estado anterior:** confirmado, P1.
**Recorrido:** Mis publicaciones → pausar/activar, editar o eliminar servicio.  
**Actual:** la carga inicial distingue servicios sin stock, pero
`reloadUserProducts` y la recarga posterior a editar aplican `stock === 0`
indistintamente. Además omiten `operationKind`, `unit` y `pricingType`.  
**Evidencia:** tres mapeos distintos en
`src/components/UserDashboard/UserDashboard.tsx`.  
**Cierre mínimo:** un único mapeador `BackendProduct → UserProduct` compartido
por las tres cargas y una regresión de servicio pausado/reactivado.

### F2 — transferencia irrecuperable después de cerrar checkout

**Dictamen PM:** confirmado y contractual, P1 prioritario.  
**Recorrido:** checkout por transferencia → crear orden → cerrar sin adjuntar →
Mis compras.  
**Actual:** Mis compras sólo permite cancelar. No muestra CBU, alias, titular,
referencia ni permite subir el comprobante.  
**Evidencia:** Backend ya devuelve `seller_cbu`, `seller_alias_bancario` y
`seller_bank_holder` y admite `POST /orders/{id}/transfer-receipt`; el mapeo y
la vista de compras los ignoran.  
**Cierre mínimo:** recuperar datos y carga desde la orden pendiente usando la
ruta existente. Una regresión debe cerrar el checkout, reabrir el panel, mostrar
los datos y pasar a «Comprobante a revisar» al adjuntar.

### F3 — formularios largos se pierden por overlay o Escape

**Dictamen PM:** cerrado en `83dba0a`/`db1bb10`. PM reprodujo 149 y 150
aislados y dentro de la suite completa actual; evidencia combinada en
`REPRODUCCION-FORM-DIRTY-1R-2026-09-05.md`.  
**Afecta:** registro de transportista, publicar, editar, checkout y calificar.  
**Cierre mínimo:** cuando el formulario esté sucio, confirmar antes de cerrar;
en la pantalla de orden/transferencia no permitir un cierre accidental que deje
sin salida. No bloquear cierres de formularios intactos.

### F4 — no existe «Olvidé mi contraseña»

**Dictamen PM:** conocido y fuera del MVP; no abrir desarrollo.  
`docs/pm/ALCANCE-Y-LIMITES.md` excluye recuperación de contraseña y
`docs/KNOWN_ISSUES.md` indica reset manual por admin. Antes de entregar puede
agregarse en Login una instrucción honesta para contactar soporte.

### F5 — error de registro fuera de vista y labels de Login

**Dictamen PM:** confirmado por código, P2 de accesibilidad.  
**Cierre mínimo:** `role="alert"`, llevar el error a la vista/foco e IDs con
`htmlFor` en Login.

### F6 — editar Provincia/Ciudad no cambia la ubicación oficial

**Dictamen PM:** efecto real, pero pertenece a C3.  
La edición modifica el `location` legado mientras catálogo usa
`locality_id/publication_location`. Se cierra al eliminar la doble fuente:
selects del padrón que escriban `locality_id` o retiro de campos engañosos.

### F7 — alta y edición validan distinto; imágenes fallidas parecen exitosas

**Dictamen PM:** probable y respaldado por código, P2 alto.  
**Casos:** precio cero con mensajes contradictorios, servicio por hora sin
precio aceptado al editar y subida de imágenes sin comprobar `response.ok`.  
**Cierre mínimo:** compartir reglas de alta/edición, verificar la respuesta de
imagen y no declarar éxito parcial como total.

### F8 — rechazo de comprobante usa `window.prompt`

**Dictamen PM:** confirmado, P2.  
Reemplazar por capa propia con textarea obligatorio y error visible; conservar
la exigencia existente del Backend.

### F9 — estrellas del perfil repiten una cadena vacía

**Dictamen PM:** confirmado, P2 pequeño.  
`''.repeat(...)` no dibuja nada. Mostrar estrellas accesibles sin duplicar el
texto «X de 5» y retirar espacios heredados en rótulos tocados.

### F10 — «Calificar vendedor» reaparece después de recargar

**Dictamen PM:** confirmado por estado sólo en memoria, P2.  
La API o la consulta de calificaciones debe decir si ya se calificó; no hacer
que la persona descubra el estado mediante un error.

### F11 — selector de estrellas de calificación no es accesible

**Dictamen PM:** confirmado por código, P2.  
Los `span onClick` deben convertirse en controles de teclado con nombre y
estado; el modal debe usar la infraestructura de capas ya aceptada.

### F12 — tuteo y voseo mezclados

**Dictamen PM:** confirmado, P2 de cierre editorial.  
Hacer una única pasada final por Login, registro, carrito, alta, panel y errores
visibles. No crear una puerta estática ingenua que marque palabras en contextos
correctos sin revisión humana.

### F13 — tipos de carga vacíos sin aviso

**Dictamen PM:** plausible, P3.  
Si falla el catálogo, el grupo no debe quedar rotulado y vacío; mostrar error y
reintento.

## Riesgos de la segunda auditoría

### R1 — stock del carrito puede quedar viejo

Necesita dos sesiones o cambio concurrente. El Backend debe seguir siendo la
autoridad en checkout; la UI puede anticipar el error, no sustituir esa defensa.

### R2 — carrito inválido rompe cada arranque

**Dictamen PM:** cerrado en `ebb2b20`/`8c29f47`; PM verificó caso 142 aislado y
suite oficial 142/142 desde bases limpias.  
Antes del cierre, `CartContext` hacía `JSON.parse` sin capturar. El
`ErrorBoundary` mostraba «Recargá», pero recargar volvía a leer el mismo valor
inválido y caía otra vez.  
**Cierre mínimo:** validar/recuperar el valor, retirar sólo la copia local
inválida y arrancar con carrito vacío; no borrar un carrito servidor válido.

### R3 — calificación podría enviar identificador equivocado

**Descartado por PM.** `POST /ratings/` busca primero `order_number` y después
UUID. No convertirlo en tarea.

### R4 — reenvío de verificación depende del texto de error

Riesgo P2 a confirmar: Login detecta una frase del Backend. Preferir una señal
estable sólo si puede hacerse sin ampliar el contrato de Auth.

### R5 — grupo sin medio de pago exige salir del checkout para retirarlo

Riesgo UX a reproducir en navegador. No rediseñar antes de medir el recorrido
real y su frecuencia.

### R6 — sesión vencida con carrito abierto no ofrece Login

Borde a reproducir. Si existe, reutilizar la misma puerta de ingreso con
continuidad ya aceptada; no crear otro flujo.

## Auditoría 3 — panel administrativo

Base revisada: `main` `fc4e24c`; ese commit sólo agrega documentación, por lo
que el producto continúa en `7e0b878`. La auditora leyó
`AdminPanel.tsx` y `backend/app/api/admin.py` sin navegador ni Docker.

### ADM-1 — editar categorías y opciones usa el método HTTP equivocado

**Dictamen PM:** confirmado, P1.  
**Actual:** el Frontend llama `PATCH /admin/categories/{id}` y
`PATCH /admin/form-options/{id}`, pero el Backend sólo declara `PUT` para ambas
rutas. FastAPI responde `405`; renombrar, activar o corregir desde el panel es
imposible.  
**Cierre mínimo:** usar el `apiPut` ya existente o aceptar PATCH, no las dos
cosas; regresiones de categoría y opción deben persistir y recargar.

### ADM-2 — las tres tablas administrativas quedan truncadas en veinte filas

**Dictamen PM:** confirmado, P1 antes de operar con volumen.  
**Actual:** Usuarios, Productos y Órdenes consumen la página por omisión de
veinte filas. El Backend ya admite página y filtros; el Frontend no envía
ninguno ni presenta controles, aunque informa el total completo. Todo registro
21 en adelante queda inaccesible desde el panel.  
**Cierre mínimo:** paginación real y búsqueda/filtros mínimos con total y página
coherentes. Es independiente de la deuda de catálogo mayor a cien.

### ADM-3 — métricas vacías y semántica incorrecta del dashboard

**Dictamen PM:** confirmado por contrato de respuesta, P2 alto.  
**Actual:** el Frontend espera `total_sellers` y `total_customers`; el Backend
devuelve `total_normal_users` y `total_admins`. Las dos tarjetas quedan vacías.
Además «Vendedores/Clientes» no son roles separados, varios estados abiertos no
entran en «Pendientes» y «Ingresos» en realidad es volumen transado porque
TopGreen no cobra comisión.  
**Cierre mínimo:** alinear las claves y mostrar usuarios/admins, estados
abiertos completos y «Volumen vendido».

### ADM-4 — estados internos en inglés y estados nuevos sin tratamiento

**Dictamen PM:** confirmado, P2.  
El panel imprime `placed`, `shipped`, `awaiting_transfer_receipt`, etc. y los
estados no contemplados salen grises. Reutilizar una única traducción es-AR y
mantener el mismo significado que ve comprador/vendedor.

### ADM-5 — acciones de edición y eliminación son botones vacíos

**Dictamen PM:** confirmado, P1 de operabilidad y accesibilidad.  
La limpieza de iconos dejó `button` sin contenido para editar/eliminar
categorías y opciones; expandir subcategorías también usa dos cadenas vacías.
Un administrador no puede saber qué hace cada rectángulo y un lector de
pantalla no recibe nombre.  
**Cierre mínimo:** texto visible o activo del sistema con nombre accesible; una
prueba debe enumerar todas las acciones y comprobar nombres no vacíos.

### ADM-6 — acciones sensibles sin confirmación o resultado visible

**Dictamen PM:** confirmado por cableado, P2 alto.  
Cambiar rol se ejecuta al elegir el select; desactivar cuenta o cambiar estado
de publicación no confirma ni muestra éxito. El Backend protege al admin contra
auto-desactivación/degradación, pero la UI ofrece igualmente esas acciones.  
**Cierre mínimo:** confirmación con consecuencia concreta para rol,
desactivación y eliminación; resultado visible. La notificación al vendedor por
moderación debe validarse contra alcance antes de sumarla.

### ADM-7 — eliminaciones usan confirmación nativa

**Dictamen PM:** confirmado, P2.  
Categoría, subcategoría y opción usan `window.confirm`. Migrar a la confirmación
propia sin cambiar reglas de eliminación; cancelar no debe escribir.

### ADM-8 — Escape en detalle de orden cierra el panel completo

**Dictamen PM:** cerrado en `b07ebce`/`83f6985`.  
El detalle de orden reutiliza `useCapaModal` como segunda capa. PM reprodujo el
caso 148 en 1/1: primer Escape conserva panel, filtro, página y scroll y devuelve
foco a la fila exacta; segundo Escape cierra el panel. Evidencia en
`REPRODUCCION-MODAL-LIFECYCLE-1-2026-09-04.md`.

### ADM-9 — el reset manual documentado no es operable desde el panel

**Dictamen PM:** confirmado, P2 y límite de F4.  
El Backend expone `POST /admin/users/{id}/reset-password`; el Frontend no tiene
acción. Como recuperación automática está fuera del MVP, una herramienta
administrativa acotada es la mitigación ya documentada. Requiere confirmación,
contraseña temporal visible una sola vez y guía operativa; no correo ni flujo
nuevo de tokens.

### ADM-10 — fallos de carga silenciosos

**Dictamen PM:** confirmado por los `catch`, P2.  
Dashboard, Usuarios, Productos, Órdenes y Documentación sólo escriben en
consola. Un `500` deja blanco o una tabla vacía indistinguible de cero datos.  
**Cierre mínimo:** error visible, reintento y vacío honesto por pestaña.

### ADM-11 — crear usuario oculta el error real

**Dictamen PM:** confirmado, P3.  
El Frontend sustituye el detalle del Backend por «Error al crear usuario» y no
anticipa la longitud mínima de contraseña. Mostrar el motivo accionable y
validar lo básico antes de enviar.

### Riesgos administrativos que exigen reproducción o decisión

- **ADM-R1:** cambiar el `value` de una opción podría dejar publicaciones
  existentes con el valor viejo. Evaluar inmutabilidad antes de habilitarlo.
- **ADM-R2:** eliminar una subcategoría usada no parece tener la guarda de una
  categoría; reproducir contra la base y observar FK/respuesta.
- **ADM-R3:** cambiar una categoría Producto↔Servicio con publicaciones puede
  reinterpretar stock y anatomía. Al corregir ADM-1 debe bloquearse o advertirse
  con evidencia de `product_count`.
- **ADM-R4:** desactivar una categoría con publicaciones activas puede dejarlas
  visibles pero sin filtro accesible. Reproducir extremo a extremo.
- **ADM-R5:** la configuración de Provincias parece legado frente al padrón
  oficial. Rastrear consumidores antes de retirar o editar.

### Patrón bueno que debe preservarse

La cola de Documentación tiene alcance explicado, filtro, motivo obligatorio,
control de concurrencia con `409`, autor/fecha y vacío honesto. Es el patrón de
operabilidad para el resto del panel; no debe simplificarse al arreglar estas
fichas.

## Cola operativa

La cola dejó de vivir duplicada en este registro. El orden vigente, con piezas
acotadas, relación contractual y puertas hasta lanzamiento, está en
`docs/pm/ROADMAP-CIERRE-MVP-2026-08-31.md`.

Este archivo conserva la evidencia y los dictámenes por código. Cada tarea
nueva sigue requiriendo reproducción o prueba roja, alcance mínimo, suite
completa y aceptación PM; no se despliega una corrección por existir en esta
lista.
