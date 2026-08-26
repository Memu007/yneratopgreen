# Puerta de paridad UX-2D

Dev completa cada casilla con archivo, captura o salida reproducible. Parecido
visual sin funcionamiento real no cierra la tarea.

## Fundación y marca

- [ ] Inter Tight/Inter se sirven localmente con sus OFL y sin requests externos.
- [ ] Existe una sola capa de tokens; no conviven activamente A y B.
- [ ] Paleta y roles coinciden con `HANDOFF-DEV.md`; semánticos no se mezclan.
- [ ] Los cuatro SVG finales se ven proporcionados en desktop/mobile y a 24 px.
- [ ] El símbolo se usa tal cual; no hay hoja, tractor, ícono genérico agregado ni redibujo Dev.
- [ ] Cero Newsreader/serif dominante, rojo óxido de acción o masa índigo pública residual.

## Header

- [ ] Anónimo, comprador, vendedor y admin preservan todas las acciones reales.
- [ ] Desktop usa nombre real; mobile usa `Cuenta` sin cortar datos variables.
- [ ] Mercado usa buscador + segunda banda; otras páginas usan una banda.
- [ ] Cinco destinos visibles en 3+2 a 390, sin scroll ni menú escondido.
- [ ] `Salir`, panel, carrito, vender, admin y callback MP siguen funcionando.
- [ ] Placeholder Mercado dice `Buscar` en mobile y es descriptivo en desktop.

## Inicio

- [ ] Hero, banda fotográfica, medidor y libro mayor coinciden con la referencia.
- [ ] Foto no tiene overlay y conserva los WebP existentes.
- [ ] Conteo usa `response.total` y trata 0/1/N; nunca `30` hardcodeado.
- [ ] Preview reutiliza `ProductCard` y datos/acciones reales.
- [ ] Taxonomía sigue siendo contenido, no un filtro falso.
- [ ] Loading, vacío, error y offline conservan mensajes/acciones reales.

## Servicios

- [ ] Hero y registro coinciden con B en desktop/tablet/mobile.
- [ ] Preview pide `publication_type=servicio`; no filtra una página parcial.
- [ ] Cards muestran cobertura/modalidad/responsable reales y no inventan foto.
- [ ] Ver/publicar conserva filtro, navegación y autenticación.
- [ ] No reaparecen claims de IA, satélite, garantía o verificación sin dato.

## Mercado

- [ ] Búsqueda, tipo, categoría, provincia/localidad, orden y limpiar conservan estado/URL.
- [ ] Grilla 3/2/1 y sidebar/control mobile funcionan sin perder resultados.
- [ ] Total visible sale de API; no confunde página cargada con total disponible.
- [ ] Cuatro anatomías mantienen datos, precios, stock/modalidad y CTA correctos.
- [ ] Foto válida, ausente y rota funcionan; fallback dice `Sin registro fotográfico`.
- [ ] Detalle, carrito, checkout, cotización y logística no tienen regresión.

## Superficies no rediseñadas

- [ ] About, Contacto, Auth, detalle, carrito, publicación, paneles y admin conservan composición/flujo.
- [ ] Los nuevos tokens no reducen contraste ni rompen modales, tablas o formularios.
- [ ] No se inventó una pantalla B sin referencia aprobada.

## Responsive y acceso

- [ ] Capturas Inicio/Servicios/Mercado en 1440×900, 768×1024 y 390×844.
- [ ] Capturas del Header por rol en desktop y mobile.
- [ ] `scrollWidth === clientWidth` en las superficies afectadas.
- [ ] Zoom 200 %, teclado, foco, reduced motion y copy +30 % siguen operables.
- [ ] Acciones principales `>=44×44`; axe sin serious/critical.
- [ ] Cero error de consola, recurso fallido o fuente remota.

## Puertas del repo

- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run contraste`
- [ ] `npm run a11y -- --todas`
- [ ] `npm run hito`
- [ ] suite completa desde base limpia
- [ ] `git -c core.whitespace=cr-at-eol diff --check`

No rebajar inventarios, omitir pantallas ni regrabar pruebas para obtener verde.

## Cierre

- [ ] Lista exacta de archivos y diferencias justificadas contra el handoff.
- [ ] Commit de producto separado del informe en `PARA-PM.md`.
- [ ] Push completo y árbol limpio.
- [ ] Sin despliegue.
- [ ] Revisión PM y puerta visual final de Emi pendientes.

