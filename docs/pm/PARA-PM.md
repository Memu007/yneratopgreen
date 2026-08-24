# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-24. Vigésimo cuarto informe: **UX-2C, el borde de escala
corregido**.

Un commit de producto y este informe. Tenías razón: el defecto existía y el
seed no podía encontrarlo.

| Commit | Qué trae |
|---|---|
| `35eaf30` | El filtro por tipo en la base, la preview y el mercado que lo usan, y el caso 126 |
| este | Este informe |

---

## 1. Qué estaba mal, dicho sin adornos

`useVistaPrevia({ soloServicios: true })` pedía las cien publicaciones más
nuevas y se quedaba con las que fueran servicio. El mercado hacía lo mismo:
`selectedType` no viajaba a la consulta y ni siquiera era dependencia del
efecto, así que filtraba lo que ya estuviera descargado y no volvía a preguntar
al cambiar de tipo.

Con treinta filas anda. Con mil miente: si las cien más nuevas son productos,
las dos pantallas afirman que no hay servicios publicados aunque haya
doscientos más atrás. Y era exactamente el caso que la orden anterior me pedía
frenar y consultar —«si la preview real exige cambiar API o contratos, frená y
traé la mínima opción»— y no lo frené: lo resolví con un filtro del lado del
navegador que parecía suficiente porque el seed entra en una página.

---

## 2. Lo que hice

- **`GET /api/catalog/products` acepta `publication_type`**, `producto` o
  `servicio`, validado por patrón como el resto de los parámetros del endpoint,
  y aplicado **antes del conteo y de la paginación**. El `total` que devuelve
  es el del conjunto pedido. Sin migración ni cambio de esquema.
- **`getProducts` expone el parámetro.**
- **La vista previa de Servicios** pide `publication_type=servicio` y sólo tres
  publicaciones. Ya no descarga cien ni filtra una página parcial. Conservé la
  defensa de dominio del frontend: si alguna vez volviera algo que no es de
  servicio, la pantalla no lo muestra como si lo fuera.
- **El mercado** manda el filtro cuando el tipo es `productos` o `servicios`, y
  `selectedType` pasó a ser dependencia del efecto.

Una nota sobre por qué el filtro es por `publication_type` y no por anatomía:
desde la corrección de UX-2B, el alta y la edición rechazan las tres
combinaciones cruzadas entre `publication_type` y `categories.is_service`, y el
caso 119 exige que ninguna fila de la base quede cruzada. Filtrar por una u
otra columna devuelve exactamente lo mismo, y `publication_type` es una columna
indexada de `products`.

---

## 3. El caso 126, que discrimina

Publica un servicio, lo tapa con **101 publicaciones más nuevas** —una más que
la página que el mercado descarga, porque con cien exactas el defecto viejo
podía sobrevivir— y exige cuatro cosas:

1. el endpoint filtrado devuelve **sólo** publicaciones de servicio;
2. su total es el filtrado —16 de 359 publicaciones activas en la corrida— y no
   el del catálogo entero;
3. un tipo inválido responde **422** nombrando el parámetro;
4. la vista previa de Servicios **y** el mercado filtrado encuentran el
   servicio tapado.

Lo corrí en rojo antes de darlo por bueno: sin el filtro en la base, el endpoint
devuelve `insumo, insumo, insumo`.

**Un ajuste que conviene que sepas:** la respuesta pública del catálogo no
incluye `publication_type`, y no se lo agregué por una prueba —sería ampliar el
contrato para que una aserción sea más cómoda—. El caso comprueba por
`operation_kind`, que es la misma regla de dominio y ya viaja en la respuesta.

---

## 4. Puertas

| Puerta | Resultado |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | **0 errores, 0 avisos** |
| `npm run contraste` | **52/52** mediciones exigidas, **0** incumplimientos |
| `npm run a11y` | **64/64** pantallas, **0** violaciones |
| `npm run hito` | **6/6** pasos encadenados |
| suite completa desde base limpia | **126/126**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

Sin migración: el esquema no cambió. Los casos 124 y 125 quedaron intactos y no
se rebajó ninguna aserción anterior.

---

## 5. La deuda que pediste registrar aparte

`docs/pm/ux2c/DEUDA-PAGINACION.md`. El resumen: el mercado sigue pidiendo una
sola página de cien resultados. Con el filtro en la base eso ya no esconde
categorías enteras —pedir servicios devuelve servicios—, pero **la página 2 no
existe**: si un filtro tiene más de cien resultados, se ven los cien más nuevos
y no hay forma de llegar al ciento uno. El conteo sí dice el total verdadero.

Ahí está también lo que haría falta para cerrarla: decidir la forma —paginado,
«ver más» o scroll—, que es decisión de ustedes y no mía; el backend ya devuelve
`page`, `pages`, `has_next` y `has_prev`, así que no hace falta tocar el
contrato; y una regresión que compruebe que la publicación 101 se alcanza.

---

## 6. Lo que no toqué

Composición, tokens, activos, anatomías y el movimiento de originales quedaron
como los aceptaste. No agregué paginación de interfaz, ni dependencias, ni
cambios en pagos, logística o auth. No desplegué.

Vuelvo a PM.
