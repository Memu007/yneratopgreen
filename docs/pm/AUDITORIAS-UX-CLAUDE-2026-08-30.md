# Auditorías UX externas de Claude — registro temporal

Fecha: 2026-08-30.  
Base revisada: `main` `7e0b87811642627e17241e117ff78dba8d61159e`.  
Método de la auditora: lectura estática; sin navegador, Docker ni cambios al
repositorio.

Este archivo conserva las dos auditorías externas para que una PM futura no
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

**Dictamen PM:** confirmado, P1 dentro de un único cierre de navegación.  
**Recorrido:** Inicio → Mercado → Servicios → Atrás.  
**Actual:** `handleNavigate` usa `replaceState` para todas las secciones y no
existe un listener de `popstate`; Atrás puede sacar a la persona de TopGreen en
vez de regresar a la sección anterior.  
**Evidencia:** `src/App.tsx`, `src/hooks/useProductFilters.ts`.  
**Cierre mínimo:** historial coherente, restauración de sección desde URL y una
regresión con `goBack()`.

### A2 — pathname especial sobrevive al abandonar pago o verificación

**Dictamen PM:** confirmado por código; P1 en el mismo cierre que A1.  
**Recorrido:** entrar en `/payment/*` o `/verificar-correo`, usar la cabecera
para ir al Mercado y recargar.  
**Actual:** `handleNavigate` conserva `window.location.pathname`; la recarga
prioriza la ruta especial y devuelve a pago/verificación.  
**Cierre mínimo:** normalizar a `/` al abandonar una ruta especial y probar
navegación más recarga.

### A3 — Servicios, Quiénes somos y Contacto no tienen URL persistente

**Dictamen PM:** confirmado por código; P1 en el mismo cierre que A1.  
**Actual:** sólo Mercado escribe `section=marketplace`; las demás secciones
borran `section`, por lo que recargar o compartir vuelve a Inicio.  
**Cierre mínimo:** serializar y leer todas las secciones válidas; enlaces
directos y recarga deben conservar la vista.

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

**Dictamen PM:** confirmado por código, duplicado de la raíz A1.  
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
- B4 (detalle e historial), C1 (foco al cerrar), C2 (N+1 de imágenes) y C3
  (doble fuente de ubicación) ya estaban en el inventario `acbf3b6`.

## Auditoría 2 — formularios y recorridos operativos

### F1 — servicios vuelven a «Agotado» después de recargar el panel

**Dictamen PM:** confirmado, P1.  
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

**Dictamen PM:** confirmado. P2 general; P1 sólo para el último paso del
checkout mientras F2 siga abierto.  
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

**Dictamen PM:** confirmado, elevar a P1 pequeño.  
`CartContext` hace `JSON.parse` sin capturar. El `ErrorBoundary` muestra
«Recargá», pero recargar vuelve a leer el mismo valor inválido y cae otra vez.  
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

## Cola recomendada después de `ORD-SELF-1`

La PM no debe entregar todo este archivo como una sola tarea. Orden sugerido:

1. **Recuperación de transferencia:** F2 y protección contra cierre accidental
   en el paso que deja una orden esperando comprobante.
2. **Regresiones pequeñas de estado:** F1 y R2, con regresiones específicas.
3. **Navegación coherente:** A1/A2/A3/A8 junto con B4 y C1; una raíz, una tarea.
4. **Formularios y reputación:** F3 general, F5, F7–F11, en lotes acotados.
5. **Claridad comercial:** A4–A7, A9/A10, F12/F13.
6. **Deuda estructural posterior:** C2, C3 y paginación mayor a cien.

Cada tarea nueva requiere reproducción o prueba roja, alcance mínimo, suite
completa y aceptación PM. No desplegar una corrección por existir en esta lista.
