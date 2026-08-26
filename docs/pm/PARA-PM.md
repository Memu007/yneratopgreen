# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-26. Vigésimo sexto informe: **UX-2D.1, una sola cabecera**.

Un commit de producto y este informe.

| Commit | Qué trae |
|---|---|
| `2a01775` | La banda de identidad estable, el buscador en su propia banda, el caso 128 ampliado y las capturas nuevas |
| este | Este informe |

---

## 1. Emi tenía razón y el defecto era mío

La cabecera cambiaba de estructura al entrar al Mercado: el buscador se metía
en la banda de marca y empujaba los cinco destinos a una barra blanca aparte.
Copié eso de las láminas sin ver el problema. En un prototipo estático es una
lámina por pantalla; en el producto es una cabecera que se transforma justo
cuando uno pasa de mirar a operar, y la identidad de arriba deja de ser un
lugar fijo.

Ahora hay **una sola banda de identidad**, idéntica en Inicio, Mercado y
Servicios: marca a la izquierda, los cinco destinos en el mismo orden, las
acciones reales de sesión y rol a la derecha, a la misma altura. El Mercado no
la toca: le agrega **una segunda banda propia, debajo**, con el buscador.
Fuera del Mercado esa banda no existe.

Comparalo abierto: `capturas/inicio-1440x900.png` contra
`capturas/mercado-1440x900.png`. La parte de arriba es la misma imagen salvo
cuál celda está activa.

## 2. Qué cambié, exactamente

- `Header.tsx` deja de tener dos formas. El buscador sale de la banda de marca
  y pasa a un bloque propio que se dibuja sólo en el Mercado, después de la
  banda. La navegación vuelve a la banda de identidad en todas las secciones.
- La segunda banda es verde, como la primera: es la misma banda con un renglón
  más, no una barra de otro material. La barra blanca era justamente lo que
  hacía que el Mercado se leyera como otra cabecera.
- La marca mide lo mismo en todas las secciones. Antes achicaba de 40 a 34 px
  al entrar al Mercado, que era otra manera de que la banda no fuera la misma.
- El buscador conserva todo: la etiqueta accesible «Buscar en el mercado», el
  `id`, el valor, el submit, los callbacks y los dos textos de `placeholder`
  por ancho. Sigue filtrando el mismo catálogo, ahora desde su banda.
- El panel de filtros se pega 12 px más abajo y el alto mínimo del Mercado se
  corrige, porque la cabecera pasó de 112 a 124 px en escritorio.

## 3. El orden de lectura, que es donde me hiciste pensar

Pediste que en tablet y celular el orden fuera marca/acciones, navegación y,
sólo en Mercado, búsqueda. Estaba dibujado así pero **no escrito así**: en el
documento la navegación venía antes que las acciones y en pantalla la movía una
regla de CSS. Para quien usa teclado o lector de pantalla eso es otro orden que
el que se ve.

Lo di vuelta en el documento: marca, sesión, destinos, búsqueda. Y entonces la
regla vale para los tres anchos, no sólo para los dos que nombraste:

- en **tablet y celular** la banda ocupa dos renglones y lo que se ve es
  exactamente lo que dice el documento;
- en **escritorio** la banda entra en un renglón y los destinos se siguen
  dibujando en el medio, que es la composición aprobada, mientras el recorrido
  del teclado mantiene el mismo orden que en los otros dos anchos.

Medido en los tres: `TopGreen → Ingresar → Inicio → Mercado → Servicios →
Quiénes somos → Contacto → campo → Buscar`, con anillo de foco de 3 px en cada
parada y ninguna parada perdida.

## 4. La regresión

El caso 128 pasó a exigir las dos propiedades, y se llama por lo que prueba:
«La cabecera es la misma en Inicio, Mercado y Servicios, y sólo el Mercado suma
la banda de búsqueda».

Lo que mide, en los tres anchos:

1. **Paridad estructural.** Retrata la banda de identidad de cada sección
   —posición, alto, archivo y alto de la marca, y la lista de celdas en orden—
   y exige que las tres devuelvan lo mismo.
2. **Orden de lectura.** La primera celda es la marca y las últimas cinco son
   los destinos, en orden, en el documento.
3. **El buscador sólo en el Mercado.** No existe en Inicio ni en Servicios; en
   el Mercado arranca por debajo de la banda de identidad, conserva su etiqueta
   y su texto por ancho, y **desde ahí filtra**: buscar una publicación real
   baja el conteo de tarjetas y deja esa publicación en pantalla.
4. Y lo que ya exigía: las acciones de cada rol con 44 px de alto —`Salir`
   incluido—, el nombre real en escritorio y «Cuenta» en celular, y cero
   desborde horizontal.

**Prueba en rojo**, con la cabecera anterior puesta de vuelta: falla con
«escritorio: la banda de identidad de Mercado no es la de Inicio». Es el
defecto que encontró Emi, dicho por la prueba.

## 5. Lo que NO toqué

Anotaste que en el entorno de revisión las publicaciones de Logística aparecen
como `Insumo estandarizado` porque el frontend nuevo está contra el Backend
descartable viejo, cuya respuesta pública omite `operation_kind`,
`pricing_type`, `response_time` y `coverage_zones`.

No lo toqué y no lo voy a inferir en el frontend. Contra el backend de este
repositorio las cuatro anatomías salen bien: `capturas/mercado-1440x900.png`
muestra «Activo de alto valor» y los casos 119 y 120 lo exigen fila por fila.
Poner una inferencia en el navegador para tapar una respuesta incompleta sería
inventar el dato que falta.

Tampoco toqué cards, hero, filtros, anatomías, colores, tipografía ni copy.
Ni backend, seed, migración, API, auth, pagos, logística ni dependencias.

## 6. Puertas, desde base limpia

Base recreada —migraciones y seed— antes de medir, y las siete puertas
encadenadas sobre esa misma base.

| Puerta | Resultado |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | 0 errores, 0 advertencias (`--max-warnings 0`) |
| `npm run contraste` | 52/52 mediciones, 6.630 textos, **0 incumplimientos** |
| `npm run a11y -- --todas` | 64/64 pantallas, **0 violaciones de cualquier severidad** |
| `npm run hito` | 6/6 pasos |
| suite completa | **128/128**, 0 fallos |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

Fuera de las puertas del repositorio, otra vez:

- **zoom 200 %**: las cinco secciones a 720×450 y 384×512 —el 200 % de los dos
  anchos contractuales— y a 320×256, el piso de reflujo de WCAG. 15 mediciones,
  cero desborde.
- **texto al 130 %**: otras 15 mediciones a 1440, 768 y 390. Cero desborde.
- **teclado**: el recorrido completo de la cabecera en los tres anchos, con el
  mismo orden y anillo de foco en todas las paradas.
- **movimiento reducido y tipografía**: sin cambios, cero elementos animados,
  cero videos, cero dominios externos.

## 7. Capturas

Regeneré **todas** las de `docs/pm/ux2d/capturas/` contra el código de hoy: si
la cabecera cambió, las viejas mentían. Se sumaron las seis que pediste con el
rol más cargado —administración, que es el de más celdas— para Inicio y Mercado
en los tres anchos, recortadas al primer viewport, que es donde se ve la
cabecera; el cuerpo de esas páginas ya está en el juego sin sesión.

Las de Inicio sin sesión salieron byte a byte iguales a las anteriores, y es la
comprobación más corta de que esto salió bien: **la cabecera de Inicio no
cambió**. La que cambió fue la del Mercado, que ahora es la misma.

`PARIDAD.md` y `docs/pm/ux2d/DIFERENCIAS.md` quedaron actualizados: la
diferencia contra la lámina del Mercado ahora está escrita como diferencia, con
su motivo.

## 8. Lo que sigue abierto, sin cambios

- La paginación mayor a 100, en `docs/pm/ux2c/DEUDA-PAGINACION.md`.
- Administración no muestra «Vendedores» ni «Clientes»: falta el campo en el
  servidor y es backend.

No desplegué. Freno acá.
