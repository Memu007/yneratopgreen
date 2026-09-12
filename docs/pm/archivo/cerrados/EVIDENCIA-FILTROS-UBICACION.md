# Evidencia — filtros de provincia y localidad

Fecha: 2026-08-05.

## Resultado

**13/13 localidades y 32/32 publicaciones activas coincidieron entre la
interfaz y PostgreSQL.** No hubo localidades de ejemplo vacias, productos de
otra ciudad ni errores visibles.

| Provincia | Localidad | Interfaz | SQL | Resultado |
|---|---|---:|---:|---|
| Buenos Aires | Balcarce | 2 | 2 | Coincide |
| Buenos Aires | Pergamino | 7 | 7 | Coincide |
| Buenos Aires | Tandil | 2 | 2 | Coincide |
| Chaco | Resistencia | 3 | 3 | Coincide |
| Cordoba | Cordoba | 1 | 1 | Coincide |
| Cordoba | Rio Cuarto | 2 | 2 | Coincide |
| Entre Rios | Parana | 1 | 1 | Coincide |
| La Pampa | General Pico | 3 | 3 | Coincide |
| Mendoza | Mendoza | 3 | 3 | Coincide |
| Salta | Salta | 2 | 2 | Coincide |
| Santa Fe | Rosario | 4 | 4 | Coincide |
| Santa Fe | Venado Tuerto | 1 | 1 | Coincide |
| Tucuman | San Miguel de Tucuman | 1 | 1 | Coincide |

## Metodo

1. Se levanto el entorno Docker del repositorio con PostgreSQL + PostGIS y la
   API actual.
2. Se abrio el marketplace real en Vite.
3. Para cada provincia se eligio desde la interfaz cada localidad que tiene
   publicaciones activas.
4. Se registraron el contador, los nombres visibles y los parametros
   `province` + `locality_id` de la URL.
5. Se compararon cantidad y nombres contra una consulta SQL agrupada por la
   localidad oficial de cada publicacion.

El filtro usa el ID oficial de Georef, no el texto mostrado en la tarjeta.

## Limite de esta evidencia

Esto cierra la verificacion de ubicacion del **catalogo de productos**. No
habilita por si solo el segundo pago: el hito intermedio tambien exige la
geolocalizacion funcional de fletes, que todavia no esta implementada.

