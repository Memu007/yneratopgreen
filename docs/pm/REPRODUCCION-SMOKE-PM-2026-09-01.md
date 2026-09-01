# Reproducción PM — TEST-HARNESS-MAC-1R

Fecha: 2026-09-01.
Base revisada: `501c7e0`; corrección de arnés: `33e5200`.
Equipo: macOS con Docker Desktop 28.1.1.

## Veredicto

La devolución no cierra la puerta. La corrida oficial desde base limpia dio
**97/140**. El caso 131 quedó verde, pero dos de las tres raíces de la
devolución siguen abiertas: la URL pública del doble MP no es resoluble desde
macOS y el volumen documental continúa sin permisos para `appuser`.

No se ejecutó una segunda corrida completa: repetir diez minutos con dos raíces
deterministas ya reproducidas no podía satisfacer la puerta. Después de la
corrección deben ejecutarse dos corridas completas nuevas desde base limpia.

## Corrida oficial

Comando: `npm run smoke`.

Resultado: **97/140**. Primeros fallos:

- 62–66: `fetch failed` al abrir la autorización del doble;
- 70 y 75–100: bloque Mercado Pago arrastrado por la misma separación de URL;
- 101–109 y 116–117: documentación/cookie todavía rojas;
- 131: verde en Alpine.

El Frontend construyó, DB/API levantaron saludables, migraciones y seed
terminaron, y 97 casos pasaron. La corrida fue contra contenedores y volúmenes
nuevos. Corrección posterior de PM: el lanzador limpia Docker al comienzo de
cada corrida y deja DB/API activas al salir; la corrida siguiente retiró esa
base antes de crear otra. No correspondía afirmar que el cleanup final la
había retirado.

## Raíz 1 — se mezcló la URL del navegador con la URL interna

`docker-compose.yml` pisa hoy ambas variables con
`http://host.docker.internal:8099`:

- `MP_AUTH_BASE_URL` se usa en `mp_vinculo.url_de_autorizacion()` y su valor se
  devuelve al navegador/runner;
- `MP_API_BASE_URL` se usa para el intercambio servidor-a-servidor.

Prueba focal con el doble real de `scripts/lib/mp-doble.mjs` escuchando en
`0.0.0.0:8099`:

- host → `127.0.0.1:8099/oauth/token`: HTTP 401 esperado;
- contenedor → `host.docker.internal:8099/oauth/token`: HTTP 401 esperado,
  tanto con el DNS nativo de Docker Desktop como con `host-gateway`;
- host → `host.docker.internal`: no resuelve DNS.

El puente contenedor→host funciona. El defecto es que la URL interna se filtra
a quien navega. La corrección mínima es conservar en el contenedor
`MP_AUTH_BASE_URL=http://127.0.0.1:8099` desde el `.env` de smoke y sobrescribir
sólo `MP_API_BASE_URL` con `host.docker.internal`. No se cambia producto ni la
configuración real de Mercado Pago.

## Raíz 2 — el volumen documental sigue siendo de root

Prueba focal con un volumen nuevo y la imagen construida por la suite:

```text
uid 1000
PermissionError: [Errno 13] Permission denied: '/data/documentos/prueba-pm.txt'
```

Control equivalente montado en `/data/uploads`:

```text
uid 1000
ok
```

La imagen crea y entrega `/data/uploads` a `appuser`, pero no prepara
`/data/documentos`; el volumen vacío montado en ese destino nace propiedad de
root. La corrección mínima esperada es crear también `/data/documentos` antes
del `chown -R appuser:appuser /data` del Dockerfile, o una solución equivalente
sin `chmod 777`. Debe probarse con un volumen realmente nuevo.

Los dos volúmenes focales fueron retirados y el doble local fue detenido al
terminar. No se desplegó ni se tocaron Railway, producción o datos remotos.

## Puerta que sigue pendiente

1. Host abre la URL de autorización devuelta y el contenedor completa el
   intercambio interno contra el mismo doble.
2. `appuser` crea, lee y elimina una constancia en un volumen documental nuevo.
3. Caso 131 permanece verde y rechaza variables vacías.
4. `npm run smoke` oficial da **140/140 dos veces**, cada vez desde base limpia
   en la Mac de PM.

## Cierre final — TEST-HARNESS-MAC-1S aceptada

Base revisada: informe `d24fece`; corrección `78972cf`.

PM reconstruyó la imagen y montó un volumen documental nuevo. El proceso de la
aplicación informó UID 1000, creó, leyó y borró `/data/documentos/prueba-pm.txt`
sin elevar permisos. El volumen focal se retiró al terminar.

Después se ejecutó `npm run smoke` dos veces en esta Mac:

- corrida 1: **140/140**, 0 fallos, salida 0;
- corrida 2: **140/140**, 0 fallos, salida 0.

Cada ejecución comenzó con `docker compose down -v --remove-orphans`, eliminó
la base y los volúmenes de la anterior y levantó una base nueva. Los casos de
Mercado Pago 62–100 recorrieron la separación host/contenedor sin `fetch
failed`; los casos documentales 101–110 y 116–117 quedaron verdes; el caso 131
conservó sus rechazos de configuración. Las líneas de clave duplicada y bloqueo
de fila fueron efectos esperados de las pruebas adversariales y no fallos del
runner.

El arnés deja DB/API locales activas al salir por diseño; eso no modifica la
condición de base limpia de la próxima corrida, porque el descarte ocurre al
inicio. No se desplegó ni se tocaron Railway, secretos o datos remotos.

**Veredicto final:** TEST-HARNESS-MAC-1S queda aceptada. La siguiente pieza es
TRANSFER-REC-1.
