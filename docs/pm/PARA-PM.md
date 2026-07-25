# Dev → PM

## Estado: bloqueada antes de implementar

No modifiqué `backend/app/seed.py`.

La tarea pide cargar las 43 subcategorías “tal como figuran en el análisis”,
pero `docs/pm/TAXONOMIA-CLIENTE.md` no enumera sus nombres. El archivo sólo
contiene esta tabla:

```text
Maquinaria agrícola                         7
Riego y drenaje                             6
Insumos agrícolas                           7
Ganadería y forrajes                        5
Repuestos y mantenimiento                   6
Agricultura de precisión y tecnología       4
Tierras y parcelas                          8
```

Los únicos nombres de subcategoría recuperables del material versionado son
los mencionados incidentalmente en el mapeo:

```text
Semillas y plántulas
Fertilizantes
Agroquímicos
Fertilización y protección
Cosecha
Preparación del suelo
Drones y VANTs
Sensores de cultivo
```

Eso no alcanza para reconstruir las 43 sin inventar datos.

## Búsqueda realizada

Busqué archivos de taxonomía, prototipo, HTML, JSON y CSV dentro de `docs/` y
`backend/`. No está versionado el prototipo original ni otra fuente con la
lista.

También busqué los nombres conocidos y las expresiones “43 subcategorías” y
“Maquinaria agrícola” en todo el repositorio. Los únicos resultados
pertinentes están en:

```text
docs/pm/PARA-DEV.md
docs/pm/TAXONOMIA-CLIENTE.md
```

`backend/app/data/georef_localidades.csv` es el único CSV del repositorio y
contiene localidades, no taxonomía.

## Por qué frené

Hay dos instrucciones incompatibles con el material disponible:

1. Cargar exactamente las 43 subcategorías enviadas por la clienta.
2. No inventar ni forzar lo que no encaje.

Además, el criterio de aceptación exige que las categorías existan “con sus
subcategorías”. Cargar sólo las ocho conocidas daría una entrega
deliberadamente incompleta; completar las demás por criterio propio cambiaría
la taxonomía de la clienta.

## Qué necesito para continuar

Una de estas dos cosas:

- El prototipo HTML original que recibió la PM.
- Una lista `categoría → subcategorías` con los 43 nombres.

Con cualquiera de las dos puedo continuar de forma mecánica con el seed, el
mapeo de los 24 productos, la doble ejecución, las consultas SQL, la
verificación de interfaz y `npm run smoke`.

## Qué no corrí

- No corrí el seed ni pruebas de esta tarea porque no hubo una implementación
  válida que verificar.
- No inicié la tarea responsive: la PM indicó expresamente que va después de
  la taxonomía.
- No toqué modelos, migraciones, esquema ni credenciales.
