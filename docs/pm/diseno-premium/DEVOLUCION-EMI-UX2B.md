# Devolución visual de Emi — UX-2B

Fecha: 2026-08-23.

## Veredicto

La aceptación técnica de UX-2B se conserva, pero **Emi no acepta todavía el
cierre visual**. La Dev aplicó correctamente el handoff: el problema es que ese
handoff diseñó el mercado y ordenó conservar la composición de Inicio,
Quiénes somos y Servicios. Por eso esas páginas quedaron vestidas con tokens
nuevos sobre una estructura institucional vieja.

La Dev sigue pausada. Esta corrección vuelve primero a Diseño.

## Qué no funciona

- Inicio es una gran placa índigo con texto centrado: se siente corporativo,
  financiero o legal, no un mercado agro que vende.
- La paleta índigo/rojo puede ordenar la operación, pero aplicada como masa
  dominante pierde paisaje, materialidad, producto y trabajo de campo.
- En Servicios, el filtro índigo tapa la fotografía en vez de usarla como
  evidencia. La imagen queda decorativa y casi ilegible.
- La composición es genérica: título, párrafo, tres beneficios y CTA; no cuenta
  qué se compra, quién opera ni por qué TopGreen entiende el sector.
- La navegación y el wordmark tienen más carácter que el cuerpo. El sistema no
  continúa debajo del encabezado.

## Nueva pieza de Diseño: extensión comercial agro

No codificar. Conservar la arquitectura funcional del mercado y las cuatro
anatomías; se puede ajustar la paleta y la dirección fotográfica global si la
extensión demuestra mejor coherencia.

Entregar antes de volver a Dev:

1. Inicio completo en 1440×900 y 390×844.
2. Servicios completo en ambas medidas.
3. Primera pantalla del Mercado con la paleta/fotografía propuesta, para probar
   que las páginas institucionales y el catálogo pertenecen a la misma marca.
4. Una variante controlada de paleta y fotografía sobre el mismo layout; no dos
   sitios distintos.
5. Sistema fotográfico: temas, encuadre, luz, tratamiento, proporciones,
   licencias y lista exacta de activos faltantes.
6. Jerarquía comercial y copy: propuesta concreta, categorías/operaciones
   visibles y CTA real. Sin claims no demostrables.
7. Tokens actualizados con contraste medido y regla precisa de cuánto color
   oscuro puede ocupar una pantalla.

## Referencias y lectura

- Agrofy: lenguaje local y reconocimiento inmediato de la categoría.
- Agriaffaires: densidad, taxonomía y protagonismo del producto.
- Ritchie Bros.: confianza comercial para activos de alto valor.
- Mercado Libre: claridad de búsqueda, precio y próxima acción.

Tomar principios, no componentes ni colores. Evitar verde-hoja automático,
marrón rústico, iconos de espiga, degradados, glass, cards flotantes y fotos de
campo cubiertas por overlays oscuros.

## Skills recomendadas para la diseñadora

- `frontend-design`: composición distintiva y control anti-AI-slop.
- `figma-generate-design`: producir las pantallas comparables.
- `figma-create-design-system-rules` y `figma-generate-library`: convertir la
  dirección aprobada en reglas y componentes transferibles.
- `design-system`: auditar tokens, estados y consistencia.
- `screenshot` o `playwright-interactive`: comparar referencias y verificar los
  tres anchos sin evaluar sólo una lámina.

`theme-factory` no debe decidir la marca: aplica temas, pero no sustituye
estrategia ni dirección de arte. `brand-guidelines` del repositorio de
Anthropic aplica la marca Anthropic y no corresponde a TopGreen.

Cuando Emi apruebe esta extensión, recién entonces conviene usar
`skill-creator` para crear una skill propia `topgreen-agro-marketplace`, con los
mockups aprobados, anti-patrones y checklist de paridad. Crear esa skill antes
volvería reproducible una dirección todavía rechazada.
