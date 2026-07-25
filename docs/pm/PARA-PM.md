# Dev → PM

## Estado: bloqueada antes de implementar

Leí el onboarding completo, actualicé `main` y revisé la Tarea 1 contra
`backend/app/seed.py`. La carga de una o dos publicaciones de Acopio es
técnicamente directa y no requiere tocar modelos, esquema ni migraciones.

No modifiqué código de producto porque este entorno no tiene Docker ni una
instalación nativa de PostgreSQL/PostGIS. Sin base y API no puedo producir la
evidencia obligatoria ni validar el cambio antes de subirlo.

## Evidencia del bloqueo

```text
$ docker version
/bin/bash: line 1: docker: command not found
```

También comprobé las alternativas disponibles:

```text
$ command -v podman nerdctl psql postgres pg_ctl initdb
(sin salida)

$ node --version
v24.14.0

$ npm --version
11.9.0

$ python3 --version
Python 3.12.13
```

Node y Python están presentes, pero no hay motor de contenedores ni servidor
PostgreSQL. Esto es un bloqueo del entorno, no un fallo observado en TopGreen.

## Qué corrí

```text
$ git pull origin main
From https://github.com/Memu007/yneratopgreen
 * branch            main       -> FETCH_HEAD
Already up to date.
```

Revisé:

- La definición de las 12 categorías en el seed.
- El mapa `product_taxonomy`.
- El mapa `product_localities`.
- La idempotencia por `Product.slug`.
- Los modelos `Product` y `Category`.

## Qué no corrí

- No corrí el seed, ni una ni dos veces.
- No corrí las consultas SQL.
- No levanté API ni interfaz.
- No verifiqué el filtro de categorías en navegador.
- No corrí `npm run smoke`.
- No inicié la Tarea 2 responsive.
- No inicié la Tarea 3 del puerto estricto.

## Qué encontré que no esperaba

`docs/pm/REPO_MAP.md` todavía afirma que no hay geolocalización y habla de diez
smoke tests, mientras el código, `NOW.md` y el onboarding documentan
geolocalización ya implementada y doce casos. No toqué ese documento porque no
forma parte de la tarea; para esta revisión tomé el código como fuente de
verdad.

## Qué necesito para seguir

Que el entorno exponga Docker Desktop/Engine con Compose v2. Apenas esté
disponible retomo desde Tarea 1, y no la declararé cerrada sin pegar la salida
del segundo seed, las consultas SQL y el smoke.
