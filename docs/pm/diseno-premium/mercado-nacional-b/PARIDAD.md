# Puerta de paridad UX-2D

Dev completa cada casilla con archivo, captura o salida reproducible. Parecido
visual sin funcionamiento real no cierra la tarea.

> Completado por Dev el 2026-08-26 contra el commit de producto de UX-2D. Las
> capturas están en `../../ux2d/capturas/`, las mediciones de color en
> `../../ux2d/TOKENS-Y-CONTRASTE.md` y las diferencias justificadas contra este
> handoff en `../../ux2d/DIFERENCIAS.md`. Las puertas se corrieron desde base
> limpia: base recreada, migraciones y seed antes de medir.

## Fundación y marca

- [x] Inter Tight/Inter se sirven localmente con sus OFL y sin requests externos.
      `public/fuentes/{Inter,InterTight}.woff2` + `OFL-Inter.txt` y
      `OFL-InterTight.txt`, copiados byte a byte del paquete (SHA-256 en
      `public/fuentes/README.md`). Medido en el navegador: las dos únicas
      peticiones de fuente son `/fuentes/Inter.woff2` y
      `/fuentes/InterTight.woff2`, ambas `loaded`, y cero dominios externos.
- [x] Existe una sola capa de tokens; no conviven activamente A y B.
      69 declaraciones `--tg-*`, todas en `src/tokens.css`; ninguna otra hoja
      declara un `--tg-*`. `src/index.css` sólo tiene alias sin valor propio.
      Búsqueda de residuos de A y de «Mesa de negocios» en `src/`, `public/` e
      `index.html`: cero coincidencias de `#17213d`, `#b93424`, `#f4f1ea`,
      `#8f281d`, `Newsreader` y `Work Sans` fuera de comentarios.
- [x] Paleta y roles coinciden con `HANDOFF-DEV.md`; semánticos no se mezclan.
      Los diez valores del handoff están en `src/tokens.css` con esos nombres.
      Éxito, error, advertencia e información se conservan y siguen midiendo;
      el cereal no suplanta a advertencia y el verde de marca no suplanta a
      éxito. Matriz completa en `TOKENS-Y-CONTRASTE.md`.
- [x] Los cuatro SVG finales se ven proporcionados en desktop/mobile y a 24 px.
      `capturas/marca-cuatro-tamanos.png`: los cuatro archivos a 40, 30, 24 y
      16 px, cada uno sobre el fondo que le toca. `viewBox` 555×110 y 555×136,
      los del paquete final.
- [x] El símbolo se usa tal cual; no hay hoja, tractor, ícono genérico agregado ni redibujo Dev.
      Los cuatro archivos de `public/marca/` son copia exacta de
      `assets/marca/`; sólo cambia el nombre del archivo para no tocar los
      `import` del producto.
- [x] Cero Newsreader/serif dominante, rojo óxido de acción o masa índigo pública residual.
      Además de la búsqueda de arriba: se sacó el único índigo escrito a mano
      que quedaba en una superficie pública, `rgba(30,58,95,.85)` en
      `AboutPage.module.css`, que pintaba encima del color de marca.

## Header

- [x] Anónimo, comprador, vendedor y admin preservan todas las acciones reales.
      Caso 128 de la suite: 12 combinaciones de rol × ancho; exige cada celda
      del rol —`Salir` incluido— con 44 px de alto. Prueba en rojo: quitando el
      botón `Salir` el caso falla con «comprador/escritorio: falta la acción
      «Salir»». Capturas `capturas/cabecera-*-1440.png` y `-390.png`.
- [x] Desktop usa nombre real; mobile usa `Cuenta` sin cortar datos variables.
      Caso 128 lo compara literal: en celular la celda dice exactamente
      «Cuenta»; en escritorio y tablet dice el nombre de la cuenta. El nombre
      accesible es `Mi cuenta` en los tres anchos.
- [x] Mercado usa buscador + segunda banda; otras páginas usan una banda.
      `Header.tsx` sigue siendo un solo componente con `headerMercado` y
      `headerCompacto`. Ver `capturas/mercado-*` contra `capturas/inicio-*`.
- [x] Cinco destinos visibles en 3+2 a 390, sin scroll ni menú escondido.
      Caso 128 exige `isVisible()` de los cinco destinos en los tres anchos y
      `scrollWidth <= clientWidth`. Captura `capturas/cabecera-anonimo-390.png`.
- [x] `Salir`, panel, carrito, vender, admin y callback MP siguen funcionando.
      Caso 128 para la presencia; la suite completa para el comportamiento
      —panel, carrito, publicación, administración y la vuelta de Mercado Pago
      tienen sus propios casos y siguen en verde—.
- [x] Placeholder Mercado dice `Buscar` en mobile y es descriptivo en desktop.
      Caso 128 lee el atributo `placeholder` en cada ancho. La etiqueta del
      campo —«Buscar en el mercado», que es lo que se anuncia— no cambia, y las
      tres puertas de navegador ahora localizan el campo por esa etiqueta y no
      por un texto que depende del ancho.

## Inicio

- [x] Hero, banda fotográfica, medidor y libro mayor coinciden con la referencia.
      `capturas/inicio-1440x900.png` contra `frames/inicio-desktop.html`: hero
      47/53, margen vertical con el rótulo girado, ojo de buey con marca cereal
      y regla, medidor con cifra tabular, rótulo en versalitas y regla dentada,
      banda de registro verde bajo la foto y libro mayor de cuatro renglones
      numerados `01`–`04` a sangre de página.
- [x] Foto no tiene overlay y conserva los WebP existentes.
      Mismos cuatro archivos de `public/media/comercial/`; los SHA-256 coinciden
      con los del paquete y no se copiaron ni recomprimieron. La banda de
      registro va DEBAJO de la foto, no encima.
- [x] Conteo usa `response.total` y trata 0/1/N; nunca `30` hardcodeado.
      `HomePage.tsx` dibuja el medidor sólo cuando `total !== null`, y el texto
      cambia entre «Operación» y «Operaciones». En las capturas dice `30`
      porque el seed tiene 30 publicaciones activas, no porque esté escrito.
- [x] Preview reutiliza `ProductCard` y datos/acciones reales.
      `HomePage.tsx` monta `ProductCard` con `variante="compacta"`; misma
      anatomía, mismos formatos y mismas acciones que el catálogo.
- [x] Taxonomía sigue siendo contenido, no un filtro falso.
      Los cuatro renglones son `div`, sin `onClick` ni `role`: no hay ningún
      control que prometa un filtro que no existe.
- [x] Loading, vacío, error y offline conservan mensajes/acciones reales.
      Sin cambios de comportamiento: los mismos textos y el mismo `Reintentar`
      de UX-2C. Casos 122 y 124 de la suite.

## Servicios

- [x] Hero y registro coinciden con B en desktop/tablet/mobile.
      `capturas/servicios-*.png` contra `frames/servicios-*.html`: 53/47 en
      escritorio con la foto a la izquierda y su banda de registro en grafito;
      en celular la foto va primero, por orden de DOM y no con `order`.
- [x] Preview pide `publication_type=servicio`; no filtra una página parcial.
      `useVistaPrevia` con `soloServicios`. Caso 126: con 101 publicaciones más
      nuevas encima, la vista previa y el Mercado filtrado siguen encontrando
      el servicio tapado.
- [x] Cards muestran cobertura/modalidad/responsable reales y no inventan foto.
      `capturas/servicios-1440x900.png`: cada tarjeta trae los datos que
      declara su publicación y ninguna dibuja imagen. Caso 120 exige que un
      servicio no tenga `img` ni `[role="img"]` en su tarjeta.
- [x] Ver/publicar conserva filtro, navegación y autenticación.
      `verServiciosPublicados` fija el tipo y navega; publicar sin sesión sigue
      avisando y abriendo el ingreso. Caso 126 comprueba que el filtro del
      Mercado queda en `servicios`.
- [x] No reaparecen claims de IA, satélite, garantía o verificación sin dato.
      Búsqueda en las páginas públicas: cero coincidencias fuera de comentarios.

## Mercado

- [x] Búsqueda, tipo, categoría, provincia/localidad, orden y limpiar conservan estado/URL.
      Sin cambios de lógica: `App.tsx` y `useProductFilters` siguen igual salvo
      el total. `Limpiar filtros` cambió de lugar dentro del panel —al final de
      los controles, como en la lámina— y sigue llamando a `onResetFilters`.
      La URL conserva `?section=marketplace`.
- [x] Grilla 3/2/1 y sidebar/control mobile funcionan sin perder resultados.
      Panel de 256 px en escritorio; en tablet y celular el mismo DOM plegado,
      sin esconder ningún filtro. Capturas `mercado-1440x900.png`,
      `mercado-768x1024.png` y `mercado-390x844.png`.
- [x] Total visible sale de API; no confunde página cargada con total disponible.
      Caso 127, nuevo: con 155 publicaciones activas y una página de 100, la
      barra dice «100 de 155 operaciones»; al filtrar por servicios el número
      pasa al del conjunto pedido. Prueba en rojo contra el código anterior:
      decía «100 operaciones». La deuda de paginación mayor a 100 sigue abierta
      y sin tocar, en `docs/pm/ux2c/DEUDA-PAGINACION.md`.
- [x] Cuatro anatomías mantienen datos, precios, stock/modalidad y CTA correctos.
      Regla superior por anatomía: activo verde, insumo cereal, servicio acero,
      logística grafito. Los datos y las acciones son los de UX-2C. Casos 119 y
      120 siguen en verde.
- [x] Foto válida, ausente y rota funcionan; fallback dice `Sin registro fotográfico`.
      La placa entregada (`no-photo-b.svg`) es ahora el respaldo, con su leyenda
      dibujada y el nombre accesible «Sin registro fotográfico. <título>». La
      imagen rota conserva su propio dibujo y su rótulo escrito. Casos 121 y el
      de imágenes de relleno exigen las dos cosas y además que la placa esté
      efectivamente pintada.
- [x] Detalle, carrito, checkout, cotización y logística no tienen regresión.
      Suite completa en verde desde base limpia.

## Superficies no rediseñadas

- [x] About, Contacto, Auth, detalle, carrito, publicación, paneles y admin conservan composición/flujo.
      No se movió ninguna estructura. Los únicos cambios en esas pantallas son
      de fundación: los tokens nuevos, el índigo escrito a mano de About, el
      bloque de logística del detalle —que pasó de tinte de información a
      superficie neutra con filete grafito, que es su anatomía— y un corte de
      palabra en el panel del vendedor.
- [x] Los nuevos tokens no reducen contraste ni rompen modales, tablas o formularios.
      `npm run contraste`: 52 de 52 mediciones exigidas, 6.664 textos medidos,
      0 incumplimientos. `npm run a11y -- --todas`: 64 de 64 pantallas, 0
      violaciones de cualquier severidad.
- [x] No se inventó una pantalla B sin referencia aprobada.
      Las tres pantallas con referencia son las tres que cambiaron de
      composición.

## Responsive y acceso

- [x] Capturas Inicio/Servicios/Mercado en 1440×900, 768×1024 y 390×844.
      Nueve archivos en `capturas/`.
- [x] Capturas del Header por rol en desktop y mobile.
      Ocho archivos `capturas/cabecera-*`.
- [x] `scrollWidth === clientWidth` en las superficies afectadas.
      Medido en las cinco secciones públicas a 1440, 768 y 390, y otra vez con
      el texto al 130 %: 15 y 15 mediciones, todas sin desborde. `npm run
      contraste` lo vuelve a medir en las 52 pantallas de su inventario.
- [x] Zoom 200 %, teclado, foco, reduced motion y copy +30 % siguen operables.
      Zoom: las cinco secciones a 720×450 y 384×512 —el 200 % de los dos anchos
      contractuales— y a 320×256, que es el piso de reflujo de WCAG; 15
      mediciones sin desborde. Texto al 130 %: otras 15. Movimiento reducido:
      cero elementos con transición o animación mayor a 1 ms y cero videos.
      Teclado y foco: caso 123 de la suite.
- [x] Acciones principales `>=44×44`; axe sin serious/critical.
      Caso 128 mide el alto real de cada celda de la cabecera. `axe` sin
      violaciones de ninguna severidad en 64 pantallas.
- [x] Cero error de consola, recurso fallido o fuente remota.
      Barrido de las cinco secciones públicas en los tres anchos y de ocho
      superficies con sesión: 0 errores de consola, 0 `pageerror`, 0 pedidos
      fallidos, 0 dominios externos.

## Puertas del repo

- [x] `npm run build` — limpio.
- [x] `npm run lint` — 0 errores, 0 advertencias (`--max-warnings 0`).
- [x] `npm run contraste` — 52/52, 6.664 textos, 0 incumplimientos.
- [x] `npm run a11y -- --todas` — 64/64, 0 violaciones.
- [x] `npm run hito` — 6/6 pasos.
- [x] suite completa desde base limpia — 128/128, 0 fallos.
- [x] `git -c core.whitespace=cr-at-eol diff --check` — limpio.

No rebajar inventarios, omitir pantallas ni regrabar pruebas para obtener verde.

## Cierre

- [x] Lista exacta de archivos y diferencias justificadas contra el handoff.
      En `docs/pm/PARA-PM.md` y en `docs/pm/ux2d/DIFERENCIAS.md`.
- [x] Commit de producto separado del informe en `PARA-PM.md`.
- [x] Push completo y árbol limpio.
- [x] Sin despliegue — no se desplegó nada.
- [ ] Revisión PM y puerta visual final de Emi pendientes.
