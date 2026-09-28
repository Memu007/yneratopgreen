# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PUBLICACIONES-PRUEBA-1: entrega

**Resultado.**

- **Las 16 de la parte A están cargadas** en el sitio publicado, con la cuenta
  «AgroBoeda Prueba» (`prueba@example.com`, rol usuario). Ninguna quedó
  afuera: en producción existen todas las categorías, subrubros, tipos, marcas
  y localidades de la lista.
- **Los filtros coinciden con tu tabla, fila por fila.** Sin hallazgos.
- **La ficha de la 1 tiene los datos correctos en la API.** En pantalla **no
  la miré**: ver «Qué no se corrió».
- **La contraseña y el token no quedaron escritos** en el repositorio, el
  informe, un script, un log ni un commit. La contraseña está en el Llavero de
  la Mac de Emi, y el token vivió sólo en memoria.

**Desde dónde.** La terminal de la Mac de Emi, por decisión suya, porque el
entorno en la nube no llega a `railway.app`. Producción respondía
`revision 58bb62b`.

**Lo que decidís vos o Emi:**

- **Hay que cambiar dos contraseñas.** En el chat de la Dev terminaron
  pegadas la de la cuenta de prueba y también la de la cuenta de
  administración de Emi: primero se usó ésa por error, y el ingreso dio 401.
  Ya estaban en tu chat; ahora también en éste.
- **Cuándo se pausan las 16.** No las toqué.

## Cómo las cargué

Con la API pública y el token de esa cuenta, igual que la pantalla de alta: el
mismo cuerpo que arma `AddProductModal.tsx`, con la descripción y el título
exactos de la lista. Lo que la lista no fija quedó como viene en la pantalla:
«Cuento con equipamiento propio» marcado, y marca «Sin declarar» en la 5.

- Nada por la base, Railway, la siembra ni una cuenta de administración.
- Antes de cargar, una pasada sin escribir: ingresó y la cuenta tenía 0
  publicaciones.
- Una por vez. El programa frenaba ante cualquier error, y ante dos 5xx
  seguidos no insistía. No hubo ninguno.
- El programa estuvo en una carpeta temporal de la Mac y **no está en el
  repositorio**.

| # | título | dirección |
|---|---|---|
| 1 | Tractor John Deere 5090E (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=5553bdcd-3804-4dd7-937a-97f7c9876ab0 |
| 2 | Tractor Kubota L3408 (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=6c413276-385a-4957-a117-e0d39c8f221f |
| 3 | Tractor Massey Ferguson 7415 (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=f7e06780-e9c6-49f8-95ef-c98851c7da72 |
| 4 | Cosechadora Claas Tucano 570 (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=a9660212-5863-4ef7-9752-68bfd083a7ae |
| 5 | Sembradora de granos gruesos 16 surcos (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=b21c9c96-5d1b-420f-8363-91a7065a8e77 |
| 6 | Semilla de maíz híbrido, bolsa de 80.000 semillas (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=a13949ad-1477-4a61-97a2-e6d529733d37 |
| 7 | Urea granulada (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=8efd5043-4d7c-4286-be91-b8c01d9e4e8d |
| 8 | Herbicida glifosato, bidón de 20 litros (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=66c8b724-3a4d-455c-8f9b-ddcbdc671b97 |
| 9 | Bebedero australiano de 10.000 litros (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=0b958a92-c508-4b92-a700-c4f1ca35c919 |
| 10 | Neumático agrícola 18.4-38 (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=32cb8927-8b0f-485c-81bc-8b3df5c6b0a5 |
| 11 | Drone pulverizador (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=a5a5d70a-07b1-489c-9e93-d3fdfaa588ec |
| 12 | Asesoramiento agronómico (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=1aebde0a-9b48-4179-9a6b-a27c31f0d4e1 |
| 13 | Siembra y cosecha con equipo propio (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=84ccecfd-fe57-4614-827d-0e09d418f07c |
| 14 | Acopio de granos en silo bolsa (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=2264f5da-68e3-4a8e-bef4-eb3825d9903f |
| 15 | Flete de granos a granel (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=20e5901e-9b9f-4d13-8a5f-b237a4f4c99b |
| 16 | Traslado de maquinaria agrícola (prueba) | https://yneratopgreen-production.up.railway.app/?section=product&id=5523270a-fcb9-4911-968a-d71fbf6daf7d |

## Los filtros

Con la misma consulta pública que arma el Mercado (`/catalog/products`, sin
sesión), «prueba» en el buscador y un filtro por vez.

| filtro | esperado | observado | coincide |
|---|---|---|---|
| Productos o servicios: Servicios | 12 a 16 | 12, 13, 14, 15, 16 | sí |
| Categoría: Maquinaria agrícola | 1 a 5; «Marca» con las 44 marcas | 1 a 5; la faceta ofrece 44 marcas, con cantidad en Claas, John Deere, Kubota y Massey Ferguson (1 cada una) | sí |
| Tractores + Compacto / Estándar / Alta | 2 / 1 / 3 | 2 / 1 / 3 | sí |
| Marca: Claas | 4 | 4; la faceta dice «Claas (1)» | sí |
| Marca: Deutz | ninguna, «(0)» | ninguna; la faceta dice «Deutz (0)» | sí |
| Año desde 2020, con Maquinaria | 2 y 5 | 2 y 5 | sí |
| Año hasta 2016, con Maquinaria | 3 y 4 | 3 y 4 | sí |
| Cosecha + «Cosechadoras de forrajes» | ninguna | ninguna | sí |
| Condición: Nuevo | 2, 5, 9 y 11 | 2, 5, 9 y 11 | sí |
| Origen: Dueño directo | 1 y 4 | 1 y 4 | sí |
| Córdoba, Río Cuarto | 3, 8 y 16 (no 14) | 3, 8 y 16 | sí |
| Precio máximo 1000000 | 6, 7, 8 y 12 a 16 (no 10) | 6, 7, 8 y 12 a 16 | sí |
| Solo con stock disponible | 1 a 7 y 9 a 11 (no 8 ni servicios) | 1 a 7 y 9 a 11 | sí |
| Buscador «Tucano», sin «prueba» | 4 | 4 | sí |
| Calificación mínima | no se prueba | no se probó | — |

**Las tres cosas que ya anotaste también se ven:** los servicios «A
convenir» (14 y 16) entran con cualquier precio máximo; «Solo con stock
disponible» saca los servicios; y la logística (15 y 16) sólo se encuentra
por la categoría.

**La ficha de la 1** (`/catalog/products/5553bdcd…`): marca `john-deere`,
modelo `5090E`, año 2018, potencia 90, condición `usado` y origen
`dueno_directo`. Son los seis datos que pediste.

## Qué no se corrió

- **La ficha y los filtros en la pantalla.** La extensión de Chrome no estaba
  conectada, y esta copia del repositorio no tiene dependencias para
  Playwright. Revisé la API que usa la pantalla, no la pantalla. **Propuesta:**
  Emi abre la dirección de la 1 en incógnito y mira los seis datos.
- La parte B, las fotos y pausar: fuera de alcance.

---

## COBRO-CONCURRENTE-1

Aceptada en rama sobre `599dded` y publicada en `58bb62b`. Sin cambios.
