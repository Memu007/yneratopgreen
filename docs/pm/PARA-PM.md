# Dev → PM

Fecha: 2026-07-25

## Estado: Tarea 1 y Tarea 1.3 completas

Implementé y subí las dos publicaciones de Acopio:

- `Recepción, Secado y Acopio de Granos` — Rosario, Santa Fe.
- `Guarda de Granos en Silo Bolsa` — Pergamino, Buenos Aires.

Están en `backend/app/seed.py`, con slugs propios y entradas explícitas en
`product_taxonomy` y `product_localities`. El commit es `814f66b seed:
agregar publicaciones de acopio`.

También agregué la limpieza tolerante de `topgreen-db` y `topgreen-api`
en `scripts/smoke.sh`, inmediatamente después de `docker compose down -v
--remove-orphans` y antes de levantar el stack. El comando no falla si no
existen los contenedores. Commit: `ddde564 test: limpiar contenedores
huérfanos antes del smoke`.

Antes de verificar, eliminé los dos contenedores huérfanos con tu
autorización explícita:

```text
$ docker rm -f topgreen-db topgreen-api
topgreen-db
topgreen-api
```

No toqué el contenedor no relacionado `caca_db`.

## Qué corrí

### Sintaxis y dependencias

```text
$ python3 -c "import ast, pathlib; ast.parse(pathlib.Path('backend/app/seed.py').read_text()); print('seed.py: sintaxis Python válida')"
seed.py: sintaxis Python válida

$ bash -n scripts/smoke.sh
(sin salida; exit 0)

$ npm install
added 205 packages in 4s
```

### Smoke desde instalación limpia

El smoke reconstruyó DB/API, aplicó las migraciones, sembró 4.028
localidades y creó los 30 productos del seed (incluidos los 2 de Acopio).
Resumen completo de la suite:

```text
$ npm run smoke
[PASS] 01 Salud del servicio — HTTP 200, status=ok
[PASS] 02 Registro de usuario — HTTP 201
[PASS] 03 Ingreso y obtención del token — HTTP 200, JWT recibido
[PASS] 04 Catálogo con categoría y precio — HTTP 200, API=1, SQL=1
[PASS] 05 Catálogo con provincia y localidad — provincia HTTP 200, API=9, SQL=9; localidad HTTP 200, API=5, SQL=5
[PASS] 06 Detalle de producto — HTTP 200, "Kit de Filtros y Correas para Cosechadora"
[PASS] 07 Agregar al carrito y verlo — POST 200, GET 200, total_items=1
[PASS] 08 Crear orden desde el carrito — HTTP 200, status=placed
[PASS] 09 Publicar producto como vendedor desde la interfaz — UI + API + DB, imágenes=1
[PASS] 10 Fallo de imagen visible sin perder la publicación — UI + DB, producto visible, aviso="Archivo demasiado grande (prueba controlada)", imágenes=0
[PASS] 11 Ver mis compras y mis ventas — compras HTTP 200 (1), ventas HTTP 200 (1)
[PASS] 12 Administración: usuarios, productos y órdenes — usuarios HTTP 200, API=SQL=4; productos HTTP 200, API=SQL=32; órdenes HTTP 200, API=SQL=1

Resumen smoke tests
-------------------
12/12 pasaron; 0 fallaron
```

### Seed dos veces seguidas

Corrí `docker exec topgreen-api python -m app.seed` dos veces después del
smoke. La segunda ejecución completa fue:

```text
🌱 Iniciando seed de datos...

📍 Sembrando localidades oficiales...
  ✅ 4028 localidades Georef sembradas (sha256: 7743fd6a6af96fce138696680afe297e71fc41f37f8d1986b3763913d0c86197)

👤 Creando usuarios...
  ⏭️  Admin ya existe
  ⏭️  Vendedor ya existe
  ⏭️  Cliente ya existe

📦 Creando categorías...
  ⏭️  Categoría 'Maquinaria agrícola' ya existe
  ⏭️  Categoría 'Riego y drenaje' ya existe
  ⏭️  Categoría 'Insumos agrícolas' ya existe
  ⏭️  Categoría 'Ganadería y forrajes' ya existe
  ⏭️  Categoría 'Repuestos y mantenimiento' ya existe
  ⏭️  Categoría 'Agricultura de precisión y tecnología' ya existe
  ⏭️  Categoría 'Tierras y parcelas' ya existe
  ⏭️  Categoría 'Bienes y Ganado' ya existe
  ⏭️  Categoría 'Asesoramiento' ya existe
  ⏭️  Categoría 'Contratistas' ya existe
  ⏭️  Categoría 'Logística' ya existe
  ⏭️  Categoría 'Acopio' ya existe

⚙️  Creando opciones de formulario...
  ✅ Opciones creadas/actualizadas (sin provincias)

📦 Creando productos de ejemplo...
  ⏭️  Producto 'Semillas de Maíz DK Premium' ya existe
  ⏭️  Producto 'Fertilizante Triple 15 - NPK' ya existe
  ⏭️  Producto 'Pulverizadora Jacto 600L' ya existe
  ⏭️  Producto 'Semillas de Soja RR Intacta' ya existe
  ⏭️  Producto 'Cosechadora John Deere 9750' ya existe
  ⏭️  Producto 'Herbicida Glifosato 66% - 20L' ya existe
  ⏭️  Producto 'Servicio de Siembra con GPS' ya existe
  ⏭️  Producto 'Rastra de Discos 24 Platos' ya existe
  ⏭️  Producto 'Terneros Angus - Lote 20 cabezas' ya existe
  ⏭️  Producto 'Vaquillonas Braford Preñadas' ya existe
  ⏭️  Producto 'Dron Pulverizador Agrícola 20L' ya existe
  ⏭️  Producto 'Sensores de Humedad de Suelo IoT' ya existe
  ⏭️  Producto 'Urea Granulada 46% Nitrógeno' ya existe
  ⏭️  Producto 'Tractor Pauny 280A Doble Tracción' ya existe
  ⏭️  Producto 'Insecticida Lambda Cihalotrina 1L' ya existe
  ⏭️  Producto 'Servicio de Cosecha con Monitor de Rendimiento' ya existe
  ⏭️  Producto 'Transporte de Granos a Puerto' ya existe
  ⏭️  Producto 'Flete de Maquinaria Agrícola con Carretón' ya existe
  ⏭️  Producto 'Recepción, Secado y Acopio de Granos' ya existe
  ⏭️  Producto 'Guarda de Granos en Silo Bolsa' ya existe
  ⏭️  Producto 'Asesoramiento en Manejo Integrado de Cultivos' ya existe
  ⏭️  Producto 'Planificación de Riego y Fertirriego' ya existe
  ⏭️  Producto 'Mantenimiento Preventivo de Cosechadoras' ya existe
  ⏭️  Producto 'Reparación Hidráulica de Maquinaria Agrícola' ya existe
  ⏭️  Producto 'Muestreo de Suelo y Recomendación de Fertilización' ya existe
  ⏭️  Producto 'Instalación y Reparación de Alambrados Rurales' ya existe
  ⏭️  Producto 'Equipo de Riego por Goteo para 10 Hectáreas' ya existe
  ⏭️  Producto 'Manga Ganadera con Balanza Electrónica' ya existe
  ⏭️  Producto 'Kit de Filtros y Correas para Cosechadora' ya existe
  ⏭️  Producto 'Campo Agrícola de 120 Hectáreas' ya existe

✨ Seed completado exitosamente!
📦 30 productos de ejemplo disponibles
```

### Consultas SQL

```text
$ SELECT c.name, COUNT(s.id) AS subcategorias ...
Maquinaria agrícola                   | 7
Riego y drenaje                       | 6
Insumos agrícolas                     | 7
Ganadería y forrajes                  | 5
Repuestos y mantenimiento             | 6
Agricultura de precisión y tecnología | 4
Tierras y parcelas                    | 8
(7 rows)

$ SELECT c.name, COUNT(p.id) AS publicaciones ...
Maquinaria agrícola                   | 4
Riego y drenaje                       | 1
Insumos agrícolas                     | 6
Ganadería y forrajes                  | 1
Repuestos y mantenimiento             | 3
Agricultura de precisión y tecnología | 2
Tierras y parcelas                    | 1
Bienes y Ganado                       | 2
Asesoramiento                         | 3
Contratistas                          | 5
Logística                             | 2
Acopio                                | 2
(12 rows)

$ SELECT COUNT(*) AS publicaciones_sin_categoria FROM products WHERE category_id IS NULL;
publicaciones_sin_categoria
---------------------------
0
(1 row)
```

Los conteos de publicaciones incluyen las dos publicaciones temporales
creadas por el smoke; por eso suman 32 en esa base. El seed propiamente
dicho se mantuvo en 30 y la segunda ejecución no creó ninguna publicación
adicional.

### Interfaz

Levanté Vite en `http://localhost:5173` contra la API local. El selector
**Categoría** mostró las 12 categorías, incluida **Acopio**. Al elegirla,
la interfaz mostró `2 productos encontrados` y exactamente:

```text
Guarda de Granos en Silo Bolsa
Recepción, Secado y Acopio de Granos
```

## Qué no corrí

No inicié la Tarea 2 (revisión y capturas mobile) ni la Tarea 3 (puerto
estricto). La Tarea 1 ya quedó cerrada y la regla acordada es una tarea,
commit, push e informe antes de continuar.

## Hallazgo inesperado

No apareció ningún fallo funcional. El único problema fue el contenedor
huérfano del checkout anterior; quedó cubierto por la limpieza añadida al
smoke y la suite pasó desde cero después de ese cambio.

## Necesito de la PM

Nada para cerrar Tarea 1. Quedo a la espera de la próxima instrucción
antes de arrancar la Tarea 2.
