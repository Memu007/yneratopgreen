# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## PRODUCT-DETAIL-PAGE-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `3508d48` |
| candidato (producto + caso 183 + negativos + casos adaptados) | `087fa2c` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** La ficha de una publicación es una página:
`/?section=product&id=ID`. Se abre desde el Mercado, Inicio y Servicios con
enlaces de verdad; recargada o pegada en otra pestaña, se busca por su ID con
la API existente. Atrás y Adelante la recorren como cualquier otra página, y
volver deja el origen como estaba: filtros, orden, página, vista Cuadrícula o
Lista y el punto hasta donde se había bajado, con el foco en el enlace que la
abrió. Por enlace directo ofrece «Ir al Mercado». Compra, cantidad, stock,
cotización, perfil del vendedor e ingreso hacen lo mismo que antes; ingresar
deja a la persona en la misma ficha y no agrega nada solo.

**Una cosa para que decidas, no bloquea.** Abrir la ficha ahora consulta la
API, y el endpoint de detalle suma una vista (`views_count`) en cada consulta;
el vendedor ve ese número en Mi cuenta. Con el modal no se consultaba y no se
sumaba nada. Ahora cuentan las aperturas reales —también recargar y volver
con Adelante—. Recomiendo dejarlo así: el número pasa a significar algo. Si
preferís no contar recargas, es otra pieza y toca backend.

## Para verificar, lo mínimo

```
SMOKE_CASOS=183 node scripts/smoke.mjs
  → 1/1: «la ficha es una página con URL propia. Mercado página 2, orden por
    precio, búsqueda y vista Lista: la ficha tiene su URL, y Atrás vuelve a
    «/?section=marketplace&q=…&sort=price-asc&page=2» a N px con el foco en
    el enlace; …»

python3 scripts/sabotajes_product_detail_page_1.py modal
  → [FAIL] «ficha abierta desde el Mercado: la ficha de «…insumo 35» tiene la
    barra en «/?section=marketplace&…» y no en su URL «/?section=product&id=…»:
    no se puede compartir ni recargar»; deja el árbol como estaba
```

El segundo es el negativo que pediste: pone todo `src/` como estaba en la base
—el detalle como capa— y el 183 da rojo por la URL. Necesita el frontend de
desarrollo en 5173, como el de la pieza anterior: espera a que sirva el
cambio antes de correr. Lo demás ya lo corrí; abajo, con su resultado.

## Qué cambió

- **Política y navegación** (`src/navegacion/`): `product` es una sección más,
  con el ID en la URL; sin ID es Inicio. Abrirla anota en la entrada de
  origen el punto y el enlace, y agrega una sola entrada. Sigue habiendo un
  único oyente de `popstate`. La capa se retiró: nada más la usaba.
- **La página** (`ProductDetail/ProductDetailPage.tsx`, antes el modal): el
  mismo contenido y las mismas acciones, con título h1 y foco en él al
  llegar. Mientras busca, lo dice; con 404 —no existe o no está activa— dice
  que no está disponible; sin respuesta, lo anuncia y ofrece reintentar. Nunca
  muestra lo que decía la tarjeta.
- **La tarjeta**: el título y «Ver detalle» son enlaces con `href`, así se
  pueden abrir en otra pestaña y el insumo comprable —que no tiene «Ver
  detalle»— también se abre con el teclado. El anillo de foco del título se
  dibuja hacia adentro del enlace: el recorte a dos renglones cortaba el de
  afuera.
- **App**: mientras la ficha está arriba, la pantalla de origen sigue activa
  para sus cargas. Así, al volver, el Mercado no se pide de nuevo ni rehace
  sus tarjetas —que es lo que perdía el foco—. La vista Cuadrícula/Lista pasó
  de la grilla a App para sobrevivir a la ficha; salir del Mercado la sigue
  reiniciando.

Sin backend, sin migración, sin dependencia, sin permisos nuevos.

## Casos que asumían la capa

Adapté trece y las tres auditorías. Donde cambió el contrato y no sólo el
selector, te lo digo:

- **147, parte E**: exigía «el detalle es una capa, no una ubicación». Ahora
  exige lo contrario: URL propia, sin celda marcada en la cabecera, Adelante
  y recarga, y Atrás o «Volver al Mercado» sin entrada fantasma.
- **148, partes A y B**: Escape, X y fondo ya no cierran la ficha —es una
  página—. Lo que se mide es lo mismo que pedía: al volver, el foco está en
  SU «Ver detalle». El perfil del vendedor sigue siendo una capa sobre la
  ficha, y un Escape sin capa no saca de la página.
- 138–140, 152, 155 y 162: la ficha se busca como página y se deja con Atrás.
  El 155 sigue exigiendo que volver conserve la vista Lista, y la conserva.
- 21, 108, 121 y 166: buscaban el título de nivel 2 o el diálogo; ahora, el
  h1 de la página. Se me habían pasado en la revisión y los encontró la
  primera suite completa.
- **123 me marcó un defecto.** Exige que el elemento enfocado tenga su
  anillo, y yo lo había pasado a la tarjeta. Lo devolví al enlace en vez de
  aflojar esa exigencia. Lo único que cambié del caso es su paso por la
  ficha, que esperaba el diálogo: ahora espera la página y sale con Atrás.
  Mide lo mismo.
- a11y, contraste y auditoría móvil miden la ficha cuando terminó de cargar.

## Lo que corrí

```
suite completa desde base limpia, sobre cca660c   181/183
  rojos: 123 —su paso por la ficha esperaba el diálogo; lo corrige
  087fa2c, que sólo cambia eso— y 131 —ambiental: pide Docker, acá no hay—
123 y 183, sobre 087fa2c                          2/2
183 antes                                         1/1, cinco corridas
sabotajes modal / sin-url / sin-regreso /
  recarga-del-origen, sobre 087fa2c               4/4 rojos, árbol intacto después
a11y --todas                                      74/74 pantallas, 0 serious o
                                                  critical, 0 minor o moderate
contraste                                         82/82 mediciones, TODO OK
build · lint · tsc --noEmit · node --check        verdes
diff-check compatible con CRLF                    sin avisos
```

La primera suite completa, sobre el commit anterior del candidato, dio
176/183. Encontró los cuatro casos que se me habían pasado, el defecto del
123 y el 46, que cayó en cascada del 21 y volvió a verde solo.

Los otros tres rojos: `sin-url` → el mismo texto de la URL; `sin-regreso` →
«al volver el foco está en (el documento) y no en el enlace que abrió la
ficha»; `recarga-del-origen` → «al volver la vista dejó de ser Lista».

Corrí la suite completa aunque pediste no hacerlo sólo por volumen: el
cambio toca la navegación de todo el sitio, los efectos de carga de App y
cada tarjeta. Encontró cinco cosas que la revisión no.

**Un rojo de arnés que medí y corregí.** Con dos escrituras seguidas sobre el
mismo archivo, el vigilante del frontend de desarrollo puede perder la
segunda: quedó sirviendo la versión saboteada con el archivo ya restaurado, y
el 183 sobre la candidata dio el rojo exacto de `sin-regreso`. No era el
producto. El script ahora vuelve a escribir el archivo si en 5 s no se sirve el
cambio, y espera a que deje de servirse la versión rota antes de seguir.

## Visto y no tocado

- El navegador también restaura el punto por su cuenta; por eso el negativo
  que discrimina el regreso es el del foco, no el del punto.
- **La auditoría móvil no llega a la ficha, y ya no llegaba antes.** Se
  corta antes, en el Mercado: el clic en «Limpiar filtros» lo tapa el panel
  plegable de filtros. Con `src/` y el script de la base `3508d48` se corta
  en el mismo clic, así que no es de esta pieza y no la toqué. La ficha en
  celular la cubren el 183, parte E, y a11y en celular. Además, al correr
  pisa dos capturas versionadas en `docs/pm/evidence/`; las devolví a como
  estaban.
- La cabecera no marca ninguna sección en la ficha.
- El título de la pestaña no cambia en la ficha; ninguna pantalla lo cambia hoy.
- Un dato para tu registro: en tu reproducción de ADMIN-MOBILE-ACCESS-1 dice
  que mi push omitió `44d5d5d` y que lo reaplicaste como `7b45ea1`. En la rama
  `44d5d5d` entró por el merge `aab4e62`, y `7b45ea1` no está en la historia.

No toqué `main`, Railway, backend ni datos, y no desplegué. Freno acá.
