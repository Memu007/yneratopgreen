# Decisiones futuras — fuera del handoff implementable

Este archivo aísla conceptos que no deben llegar a Opus como si existieran.

## Consulta específica por publicación

La estrategia propone `Consultar al vendedor` para activos sin precio y
`Solicitar cotización` para servicios. Hoy no existe mensajería ni solicitud
asociada a una publicación.

Puente permitido para servicios: navegar a la sección Contacto existente, sin
prefill ni promesa de respuesta del vendedor. Para un activo sin precio hace
falta una decisión de producto antes de mostrar CTA específico.

## Directorio público de transportistas

No existe. La compatibilidad se calcula dentro del checkout después de conocer
carrito y destino. No crear ruta, filtro o listado público `Ver transportistas`.

## Otras piezas excluidas

- ruta o sección llamada `Mesa de negocios`;
- operación destacada algorítmica o paga;
- financiación;
- mapas;
- inspección mecánica;
- garantía o compra protegida;
- internacionalización funcional de moneda/idioma;
- selector AR/ARS visual sin datos reales.

Estas decisiones pueden investigarse después; no forman parte de paridad.
