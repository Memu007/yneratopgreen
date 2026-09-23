# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PRODUCT-DETAIL-BACK-SEARCH-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `f42c760` |
| candidato (hook + caso 186 + negativo) | `ce0380e` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Primero, una corrección a lo que te informé.** El «8 de 20 pierde la
búsqueda» estaba mal medido. La búsqueda no se perdía para siempre: medido
cuadro a cuadro, el estado final fue correcto 26 de 26 veces. Lo que pasaba,
6 de 6 veces después de recargar, era **un cuadro equivocado al volver**:

- la barra sin `q` y el buscador vacío;
- el Mercado entero, con 24 tarjetas en vez de 1;
- al cuadro siguiente se corregía solo.

Mi sonda miraba la barra apenas aparecía la tarjeta de «Campo Agrícola». Esa
publicación también está en el Mercado sin filtrar, así que la sonda caía
justo en ese cuadro. El defecto era real, pero más chico de lo que te dije:
dura unos 16 ms, no hace perder lo buscado y la persona apenas lo nota. Te
lo aviso porque la prioridad de esta pieza salió de mi número. Si con esto
la reordenás, es tu decisión; la pieza ya está hecha y medida.

**Resultado.** Ahora no hay ningún cuadro sin la búsqueda. En 10 vueltas de
búsqueda → ficha → recarga → Atrás, dentro del mismo recorrido, se miraron
1.495 cuadros:

- ninguna escritura de la barra ni ningún cuadro quedó sin `q`;
- el buscador siempre mostró la búsqueda;
- no apareció ninguna tarjeta ajena.

Con el hook anterior, el mismo caso da rojo en las 10 vueltas. La entrada
directa a la ficha vuelve al Mercado sin inventar búsqueda.

## Causa

Después de recargar la ficha, los filtros arrancan vacíos, porque la barra
de la ficha no los tiene. Al volver al Mercado, dos cosas pasaban en el
mismo commit y en este orden:

1. la relectura de la barra, que estaba en un efecto, programaba los
   filtros de la entrada;
2. la escritura de la barra corría enseguida con los filtros todavía vacíos
   y reemplazaba la URL por `/?section=marketplace`.

En el render siguiente los filtros ya estaban bien y la barra se reescribía
con `q`. Lo vi con `history.replaceState` instrumentado: dos escrituras
seguidas, primero sin `q` y después con `q`. Sin recarga no pasa, porque los
filtros ya estaban cargados.

**La corrección** (sólo `src/hooks/useProductFilters.ts`): la barra se
relee al dibujar, ajustando el estado cuando cambia su versión, y no en un
efecto. Así el commit ya sale con los filtros de la barra, y ahora la barra
se escribe una sola vez, con `q`. El momento y la condición son los de antes:
sólo cuando Atrás o Adelante mueven la barra, y nunca sobre la barra de una
ficha. No cambia el formato de ninguna URL ni la semántica de ningún filtro.

## Para verificar, lo mínimo

```
SMOKE_CASOS=186 node scripts/smoke.mjs
  → [PASS] 186 … 10 vueltas con «Campo Agrícola de 120 Hectáreas» (5 con
    «Volver al Mercado», 5 con el Atrás del navegador), N cuadros mirados:
    ninguna escritura ni cuadro sin `q` … por enlace directo y recargada,
    «Ir al Mercado» abre el Mercado sin búsqueda (24 tarjetas, buscador vacío)

python3 scripts/sabotajes_product_detail_back_search_1.py
  → [ROJO ESPERADO] [FAIL] 186 … 10 de 10 vueltas perdieron la búsqueda al
    volver de la ficha recargada. La primera: vuelta 1 (boton): la barra se
    escribió como «/?section=marketplace»; el cuadro 1 de 147 tenía la barra
    «?section=marketplace», el buscador «» y 24 tarjetas, 23 ajenas
```

Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y la
siembra demo, con «Campo Agrícola de 120 Hectáreas» activa. Espero 24
tarjetas en la entrada directa sobre la base demo limpia; con otros datos
cambia el número, pero el caso sólo exige más de una. El caso tarda unos
45 s y el negativo unos 60.

## El caso 186

- **A:** búsqueda de la publicación demo, ficha, recarga y Atrás, 10 veces;
  5 con «Volver al Mercado» y 5 con el Atrás del navegador. En cada vuelta
  mira cada escritura de la barra y cada cuadro del Mercado durante 2,5 s:
  la barra con `q`, el buscador con el texto y sólo tarjetas de la búsqueda.
  La primera vuelta además prueba Adelante y otra vez Atrás.
- **B:** «Semillas» con tipo productos y orden por precio, con las dos
  formas de volver. Los tres filtros vuelven en cada escritura y en cada
  cuadro.
- **C:** entrada directa a la ficha y recarga. No ofrece «Volver al
  Mercado». «Ir al Mercado» abre el Mercado sin `q` en ninguna escritura ni
  cuadro, con el buscador vacío y el catálogo entero.

## Lo que corrí

```
sobre ce0380e, base limpia
  1–6, 128, 147, 148, 152, 155, 162, 163, 167, 168, 171, 173, 175,
  183, 185, 186                                   21/21
  negativo                                        10 de 10 vueltas rojas,
                                                  src como estaba
antes del commit
  caso 186                                        1/1
  build · lint · tsc --noEmit · node --check · diff-check   verdes
```

Elegí esos casos porque el cambio toca la relectura de la barra: van todos
los que usan Atrás o Adelante, o filtros y búsqueda en la URL. No corrí a11y
ni contraste, porque no cambia nada que se dibuje, ni la suite completa.

## Visto y no tocado

- Después de recargar la ficha, el Mercado de origen se sigue pidiendo en
  segundo plano, sin filtros, porque no hay filtros que conocer. De ahí
  salían las 24 tarjetas del cuadro equivocado. Ahora es un pedido de más
  que no se ve: al volver, el Mercado queda un momento sin tarjetas y
  después muestra la búsqueda. Evitarlo toca cuándo la ficha mantiene
  activa su pantalla de origen, y eso excede esta pieza.

No toqué `main`, Railway, backend ni datos, y no desplegué. Freno acá.
