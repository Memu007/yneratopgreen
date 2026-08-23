# Checklist de paridad diseño ↔ implementación

La aprobación de screenshots no alcanza. Cada ítem debe quedar marcado por
diseño y desarrollo con evidencia reproducible.

## Identidad y fundamentos

- [ ] Wordmark correcto por fondo, sin deformación y con área de seguridad.
- [ ] Newsreader y Work Sans self-hosted, pesos reales y fallbacks activos.
- [ ] Colores, espacios, radios, bordes, foco y motion consumen tokens.
- [ ] No aparecen verde/beige/hoja, degradado, glass, sombra de tarjetas o
  iconografía genérica fuera del sistema aprobado.
- [ ] Contrastes mantienen AA; foco y borde de control alcanzan 3:1.

## Contenido y confianza

- [ ] Precio, moneda, unidades, fecha y ubicación pasan por formatters de locale.
- [ ] `A cotizar` reemplaza precio inexistente/0 cuando corresponda.
- [ ] Calificaciones, ventas y documentación reflejan datos reales, incluido 0.
- [ ] Ningún claim prohibido de `COPY.md` aparece en UI, fixtures o metadata.
- [ ] Título largo, ubicación larga y botones traducidos no se truncan de forma
  engañosa ni generan overflow.

## Cuatro anatomías

- [ ] Activo de alto valor prioriza condición y usa `Iniciar operación`.
- [ ] Insumo permite cantidad/stock y usa `Agregar` sólo cuando procede.
- [ ] Servicio muestra alcance/modalidad y cotización sin simular compra cerrada.
- [ ] Logística muestra equipo/capacidad/cobertura; transportistas compatibles
  sólo aparecen en checkout después del destino.
- [ ] La regla que asigna anatomía está en dominio/datos, no sólo en CSS/precio.

## Componentes y estados

- [ ] Header anónimo, comprador, vendedor y admin preserva acciones y sesión.
- [ ] Filtros dependen de API; provincia/localidad y limpiar funcionan.
- [ ] Inputs, selects, checkboxes, radios, textarea y upload tienen label, ayuda,
  validación y estados disabled/error.
- [ ] Modal/drawer atrapa y restaura foco; cierra por Escape cuando corresponde.
- [ ] Tabs y tablas tienen semántica; tablas no rompen mobile.
- [ ] Toasts se anuncian y no dependen del color.
- [ ] Loading, vacío, error, offline, disabled, sin stock, pausado, sin foto,
  imagen rota, título largo y sin precio están implementados.

## Responsive y acceso

- [ ] 1440×900 coincide en jerarquía y densidad con la referencia.
- [ ] 768×1024 cambia filtros y grilla según `RESPONSIVE.md`.
- [ ] 390×844 conserva contenido/acción y no tiene overflow horizontal.
- [ ] Orden DOM y tabulación es lógico; no se usa CSS para alterar lectura.
- [ ] Acciones y controles principales tienen targets ≥44×44 px.
- [ ] Enlaces textuales, breadcrumbs, tablero y pie cumplen WCAG 2.5.8 por
  target ≥24×24 px, separación suficiente o excepción inline documentada.
- [ ] Ningún flujo depende de hover.
- [ ] Zoom 200 % y texto aumentado siguen operables.
- [ ] `prefers-reduced-motion` evita movimiento no esencial.

## Imágenes y activos

- [ ] Foto real conserva relación, alt y evidencia; no se deforma ni se completa
  con IA.
- [ ] Ausencia de URL usa `no-photo.svg`; error usa `photo-broken.svg`.
- [ ] Todo asset nuevo tiene fuente, licencia y aprobación en `ACTIVOS.md`.
- [ ] Las capturas y referencias conceptuales no se empaquetan como producción.

## Función preservada

- [ ] Rutas/secciones, búsqueda, filtros, detalle, carrito, checkout y sesión
  mantienen comportamiento.
- [ ] Publicar, editar, upload, perfil, operaciones, traslado, documentación,
  administración, contacto y pagos no pierden estados ni validaciones.
- [ ] No se agregó chat, escrow, tasación, directorio público, verificación ni
  solicitud por publicación sin alcance aprobado.
- [ ] `build`, `lint`, `contraste`, `a11y` y `hito` pasan.
- [ ] `smoke` pasa en entorno aislado y sin arriesgar datos.

## Evidencia de aceptación

- [ ] Comparativa visual de catálogo, detalle y estados en los tres viewports.
- [ ] Registro de diferencias intencionales con responsable y fecha.
- [ ] Revisión de Emi: nombre, fecha y resultado.
- [ ] Revisión de PM: nombre, fecha y resultado.
- [ ] Sólo después de ambas aprobaciones se autoriza entrega a Opus.
