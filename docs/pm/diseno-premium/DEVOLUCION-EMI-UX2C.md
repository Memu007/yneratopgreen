# Devolución visual de Emi — UX-2C

Fecha: 2026-08-24
Estado: **rechazo visual; implementación técnica preservada**.

## Diagnóstico

La estructura comercial de UX-2C funciona, pero la identidad aplicada no se
siente agro. El conjunto se percibe como un diario económico/editorial:

- canvas crema `#F4F1EA` semejante a papel;
- rojo óxido `#B93424` como tinta y subrayado;
- titulares Newsreader muy grandes y dominantes;
- eyebrows en mayúscula, filetes finos y composición de columnas editoriales;
- contraste azul tinta + crema + rojo que remite a prensa, no a operación rural.

No alcanza con cambiar un verde por otro. Color, tipografía y señalética deben
contar la misma historia de producto.

## Qué se conserva

- arquitectura de Inicio, Servicios y Mercado;
- hero dividido sin overlay;
- datos reales, cuatro anatomías, estados y callbacks;
- preview real y filtro `publication_type`;
- responsive, accesibilidad y límites funcionales;
- wordmark mientras no se apruebe otra pieza.

## Dirección a explorar con Emi antes de volver a Dev

**Agro industrial premium**, no postal rural ni eco genérico:

- canvas blanco cálido, no papel amarillento;
- verde campo profundo y grafito como estructura/acción;
- acento cereal/maíz usado con mucha moderación;
- rojo reservado para error o alerta, no como acción de marca;
- Work Sans o una sans técnica para títulos, precios, navegación y controles;
- Newsreader sólo en el wordmark o como acento editorial excepcional;
- jerarquía basada en fotografía, datos, masa y contraste funcional, no en
  filetes y titulares de tapa de diario.

Paleta inicial para prototipar, todavía **no aprobada**:

| Rol | Valor inicial |
|---|---|
| Canvas cálido | `#F7F6F1` |
| Superficie | `#FFFFFF` |
| Verde profundo | `#244A35` |
| Grafito | `#202822` |
| Verde hover | `#183626` |
| Acento cereal | `#C49A43` |
| Borde mineral | `#D4D8D1` |

## Entrega requerida antes de tocar producto

Diseño debe mostrar a Emi el mismo primer viewport de Inicio, Servicios y
Mercado con esta dirección, en desktop y mobile. Debe cambiar color,
tipografía/escala y señalética sobre la estructura existente; no rehacer flujos,
cards ni contenido. La comparación debe incluir la UX-2C actual para comprobar
que desapareció la lectura de “diario”.

La Dev queda pausada hasta aprobación visual explícita. No desplegar UX-2C.
