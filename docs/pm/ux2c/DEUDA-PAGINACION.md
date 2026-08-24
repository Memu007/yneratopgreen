# Deuda registrada: el mercado muestra como máximo 100 por consulta

Fecha: 2026-08-24. La registra Dev a pedido de PM, en el ciclo del borde de
escala de UX-2C.

## Qué queda abierto

`GET /api/catalog/products` pagina con un tope de `page_size = 100`, y el
mercado pide **una** página: `page: 1, page_size: 100`. Con el filtro por tipo
en la base —lo que se corrigió en este ciclo— la lista que baja ya viene
filtrada, así que pedir «servicios» encuentra servicios aunque haya miles de
productos más nuevos. Lo que sigue sin existir es **la página 2**: si un filtro
tiene más de cien resultados, la pantalla muestra los cien más nuevos y no dice
que hay más.

Hoy no se nota: el conteo del mercado dice cuántas hay en total según la API, y
ese número sí es el verdadero. Pero el usuario no tiene forma de llegar a la
publicación 101.

## Por qué no se resolvió acá

La orden de PM lo excluye por escrito: «No agregues paginación UI general en
este ciclo; registrá por separado que el Mercado continúa mostrando como máximo
100 resultados por consulta».

## Qué haría falta

- Decidir la forma: paginado con números, «ver más» acumulativo o scroll
  infinito. No es una decisión de Dev: cambia cómo se lee el catálogo.
- El backend ya devuelve `page`, `pages`, `has_next` y `has_prev`: no hace falta
  tocar el contrato.
- El estado del mercado tendría que llevar la página actual y volver a pedir al
  cambiarla, con el mismo cuidado que se le puso al tipo: la página es
  dependencia del efecto.
- Una regresión que cree más de cien publicaciones de un mismo filtro y
  compruebe que la 101 se puede alcanzar.

## Lo que sí quedó cerrado en este ciclo

- El filtro por tipo viaja a la consulta y se aplica **antes** del conteo y de
  la paginación.
- El total del endpoint filtrado es el del conjunto pedido.
- La vista previa de Servicios pide `publication_type=servicio` y sólo tres
  publicaciones, en vez de bajar cien y filtrarlas en el navegador.
- El caso 126 de la suite fabrica el escenario que el seed no alcanza: un
  servicio tapado por 101 publicaciones más nuevas, que la vista previa y el
  mercado filtrado tienen que encontrar igual.
