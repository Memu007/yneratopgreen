# Prototipo del flujo de logística

Prototipo de **diseño y navegación** para cerrar la puerta de UX/UI de la
Fase 1. No es la aplicación y no se conecta a ella.

## Cómo abrirlo

```bash
# desde cualquier lado, con doble clic o:
xdg-open docs/ux/logistica/index.html
```

Se abre con `file://`, **sin API, sin base de datos y sin servidor**. No
tiene dependencias: son un HTML, un CSS y un JavaScript.

## Cómo recorrerlo

La barra negra de arriba es del prototipo, no del producto. Sirve para:

- **Vista**: saltar entre comprador, transportista y vendedor sin tocar la URL.
- **Paso**: ir directo a cualquier pantalla del perfil elegido.
- **Estado de la búsqueda**: forzar los cuatro estados —resultados, cargando,
  sin resultados y error— sin esperar a que ocurran.
- **Reiniciar prototipo**: volver todo al principio.

El recorrido completo del comprador es: envío → buscar flete → seleccionar →
resumen → pago → mis compras. Desde el resumen se puede volver a cambiar o
quitar la selección.

## Qué es y qué no es

**Es** un acuerdo sobre pantallas, estados, qué información se muestra en cada
momento y con qué palabras.

**No es** ninguna de estas cosas, y ninguna está implementada acá:

- búsqueda real por cercanía con PostGIS — eso es Fase 3;
- endpoints, persistencia ni migraciones;
- mapas, ruteo, GPS ni distancia por caminos;
- cotización, tarifa, cálculo de peso o volumen, ni pago del flete;
- Carta de Porte ni verificación contra ningún organismo.

## Dos detalles que se decidieron a propósito

**Los nombres de los transportistas son nombres de persona**, porque hoy el
sistema tiene un solo campo, `full_name`, y no existe un nombre comercial.
El prototipo no promete un dato que el producto no guarda.

**Cada tarjeta muestra dos distancias, no una**: de la base del transportista
al origen y de su base al destino, las dos en línea recta. Las dos tienen que
caer dentro del radio declarado, que es la regla aprobada. No hay orden por
cercanía ni recomendación de "el mejor".

## Los datos son ficticios

Todos los transportistas, teléfonos, correos y números de habilitación están
inventados y viven en `prototipo.js`, a la vista. Los dominios de correo
terminan en `.test`, que está reservado justamente para esto.

## Las tres frases que no se negocian

Aparecen tal cual en las pantallas donde corresponde:

- «Declarado por el transportista el [fecha]. TopGreen no verifica esta
  habilitación.»
- «Distancias estimadas en línea recta.»
- «La coordinación y el precio del flete se acuerdan directamente.»

Y no se usa, en ninguna parte: «certificado por TopGreen», «tarifa calculada»,
«ruta óptima» ni «entrega garantizada».

## Capturas

En `capturas/`, a 1440×900 y 390×844. El nombre indica medida y pantalla.
