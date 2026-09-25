# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## COPY-AGRO-1 — entregada

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `e9cf4c6` |
| candidato | `a1b4acd` (el texto, más el título que afirmaba el caso 156) y `2b92988` (caso 192 y negativos) |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.**

- El sitio dice «agropecuario» en las **once** apariciones de «agro» que
  tenía, repartidas en cinco archivos.
- El caso 192 del smoke falla si vuelve a aparecer «agro» como palabra suelta,
  tanto en la fuente como en la pantalla. Tiene tres negativos.
- Nada desborda a 360 px.

**Para decidir vos (no bloqueante).** La bajada de la portada cambia a 320 y
360 px: pasa de un renglón a dos, y el «·» queda al final del primero. Desde
390 px entra en un renglón, como antes, y en ningún ancho desborda. Así se ve
a 360 px:

```
— MERCADO AGROPECUARIO ·
  ARGENTINA
```

1. **Dejarla así.** Es lo que recomiendo: no toca el diseño y sólo pasa en
   los celulares más angostos.
2. **Pedir otra redacción**, por ejemplo «Mercado agropecuario argentino»,
   sin el punto medio. Es un cambio de texto que la clienta no pidió.

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --recrear
SMOKE_CASOS=192 node scripts/smoke.mjs
  → [PASS] 192 El sitio nombra el sector «agropecuario», … — ninguna «agro» suelta (183 archivos …)
python3 scripts/sabotajes_copy_agro_1.py
  → tres [ROJO ESPERADO]
  → src, backend e index.html después: como estaban
  → todos dieron el rojo esperado
```

**Antes de correrlo:**

- Los negativos modifican cinco archivos del frontend mientras el servidor de
  desarrollo los sirve, y los restauran al final.
- No los corras en paralelo con otra corrida del smoke.
- El 192 guarda seis capturas en `SMOKE_CAPTURAS`; si no lo definís, van a
  una carpeta temporal nueva.

## El inventario

| # | archivo:línea | dónde se ve | antes | ahora |
|---|---|---|---|---|
| 1 | `src/components/Pages/HomePage.tsx:83` | Inicio, margen vertical (desde 1024 px) | Mercado agro · Argentina | Mercado agropecuario · Argentina |
| 2 | `HomePage.tsx:86` | Inicio, bajada sobre el título | Mercado agro · Argentina | Mercado agropecuario · Argentina |
| 3 | `src/components/Footer/Footer.tsx:45` | el pie, en todas las páginas | Mercado agro: productos, servicios y logística. | Mercado agropecuario: productos, servicios y logística. |
| 4 | `src/components/Pages/ServicesPage.tsx:189` | Servicios, título del cierre | ¿Prestás un servicio para el agro? | ¿Prestás un servicio para el sector agropecuario? |
| 5 | `src/components/Pages/AboutPage.tsx:148` | Quiénes somos, texto del cierre | …soluciones tecnológicas para el agro | …soluciones tecnológicas para el sector agropecuario |
| 6 | `index.html:16` | título de la pestaña | AgroBoeda — Mercado agro | AgroBoeda — Mercado agropecuario |
| 7–8 | `index.html:24` y `:29` | título al compartir (`og:title`, `twitter:title`) | AgroBoeda — Mercado agro | AgroBoeda — Mercado agropecuario |
| 9–11 | `index.html:14`, `:25` y `:30` | descripción para buscadores y al compartir | AgroBoeda, mercado agro argentino: … | AgroBoeda, mercado agropecuario argentino: … |

**Dónde más busqué, sin encontrar «agro».** No aparece en:

- ningún correo, aviso ni notificación;
- los datos que siembra el backend;
- las migraciones.

**El 5 está dentro del bloque del punto #14.**

- Es el bloque de «¿Listo para transformar tu producción?».
- Cambié sólo la palabra: el título y la promesa quedan para cuando se
  resuelva el #14.
- Si preferís no tocar ese bloque hasta entonces, alcanza con revertir una
  línea, pero el caso 192 necesitaría una excepción.

**Lo que queda a propósito.** En ninguna de estas apariciones «agro» es una
palabra suelta:

| texto | dónde | por qué queda |
|---|---|---|
| AgroBoeda | cabecera, pie, correos, avisos | es la marca |
| AgroMarket | no aparece en ningún texto visible; sólo en el nombre del paquete (`agromarket`) | espera la decisión #10, y además no se ve |
| Agroquímicos, Agroinsumos biológicos | subcategorías de Insumos agrícolas (`backend/app/seed.py:321-322`) | taxonomía de la clienta |
| Agroquímicos | tipo de carga que declara quien transporta (`backend/app/services/cargas.py:22`) | nombra un producto, no el sector |
| agropecuaria, Agropecuaria | Quiénes somos, líneas 51, 90, 101 y 130 | ya es la palabra pedida |
| agronómico, agronómica | descripciones de publicaciones demo (`seed.py:397`, `:1024` y `:1112`) | es otra palabra, y es correcta |
| Agronomist… | crédito de una foto demo, que se ve en la ficha (`src/utils/fotosDemo.ts:227`) | es el título original de la obra, en inglés; una atribución no se traduce |
| Agronomía, Almagro | localidades del padrón | son nombres propios |
| `agroquimicos`, `cat_agroquimicos` | identificadores del código | no se ven |

## La comprobación: caso 192

**Qué busca.**

- La palabra «agro» suelta, sin distinguir mayúsculas.
- No la disparan otras palabras que la contienen: «AgroBoeda», «AgroMarket»,
  «agropecuario», «agronómico», «Agroquímicos» y «Almagro».
- Pegada a un guion sí la dispara: «agro-industria».
- Antes de empezar, el caso prueba la regla contra doce formas: las que tiene
  que marcar y las que tiene que dejar pasar.

**Dónde mira.** En dos lados, porque cada uno ve lo que el otro no:

- **En la fuente.**
  - Lee 183 archivos: `src`, `backend/app`, `backend/alembic`, `public`,
    `index.html` y las plantillas de entorno.
  - Eso cubre correos, avisos y pantallas a las que el navegador del caso no
    llega.
  - Lee también los comentarios: un comentario que diga «agro» hace fallar
    el caso, y se reescribe.
- **En la pantalla**, a 1440 y a 360 px.
  - Lee el texto tal como lo dibuja el navegador, más los atributos que se
    leen o se anuncian, como `placeholder`, `aria-label`, `alt` y `title`.
  - Recorre la pestaña, los metadatos, Inicio, Mercado, Servicios, Quiénes
    somos, Contacto, Ingresar y Registro.
  - Deja afuera las tarjetas de publicaciones: lo que escribe quien publica
    no es texto de la plataforma.

**Qué mide.**

- A 360 px, que los cuatro textos que se alargaron no salgan de la pantalla
  ni la ensanchen.
- Que el margen vertical de la portada entre en su alto a 1024 y a 1440 px:
  ocupa 300 de 560 px.

**Un arreglo del propio caso.** La primera versión leía el texto nodo por
nodo. El negativo de la pantalla mostró que así no ve una palabra armada en
pedazos: React la parte en «Mercado | agro | :». Ahora lee el texto como lo
dibuja el navegador.

## Los negativos

`python3 scripts/sabotajes_copy_agro_1.py`, sobre `2b92988`. Salida:

```
=== textos-de-la-base: el 192 nombra las once del inventario en la fuente y las ve en la pantalla ===
[ROJO ESPERADO]
  [FAIL] 192 … — «agro» suelta, 40 vez/veces:
    fuente, src/components/Footer/Footer.tsx:45: «<p className={styles.bajada}>Mercado agro: productos, servicios y logística.</p>»
    fuente, src/components/Pages/AboutPage.tsx:148: «mejores soluciones tecnológicas para el agro</p>»
    fuente, src/components/Pages/HomePage.tsx:83: «<span>Mercado agro · Argentina</span>»
    fuente, src/components/Pages/HomePage.tsx:86: «<p className="tg-eyebrow">Mercado agro · Argentina</p>»
    fuente, src/components/Pages/ServicesPage.tsx:189: «o-ofrecer">¿Prestás un servicio para el agro?</h2>»
    fuente, index.html:14 / :16 / :24 / :25 / :29 / :30   (una línea cada una)
    pantalla, escritorio 1440 px, Inicio: «… | MERCADO AGRO · ARGENTINA | MERCADO AGRO · ARGENTINA | Equipos, insumos y servic»
    pantalla, escritorio 1440 px, pestaña: «AgroBoeda — Mercado agro»
    pantalla, escritorio 1440 px, meta description / og:title / og:description / twitter:title / twitter:description
    pantalla, escritorio 1440 px, Servicios: «n datos. | ¿Prestás un servicio para el agro? | Indicá cobertura, modalidad y respon»
    pantalla, escritorio 1440 px, Quiénes somos: «mejores soluciones tecnológicas para el agro | Comenzar a Vender | Explorar Producto»
    pantalla, … el pie en Inicio, Mercado, Servicios, Quiénes somos y Contacto, y todo lo anterior también a 360 px
  y además:
    … la pestaña dice «AgroBoeda — Mercado agro»; faltan los cuatro textos nuevos a 360 px y el margen nuevo a 1024 y 1440

=== solo-en-la-pantalla: el 192 la ve en la pantalla aunque la fuente no la escriba ===
[ROJO ESPERADO]
  [FAIL] 192 … — «agro» suelta, 10 vez/veces:
    pantalla, escritorio 1440 px, Inicio: «| Ver el mercado | AgroBoeda | Mercado agro: productos, servicios y logística. | Me»
    … las cinco páginas en los dos anchos; ninguna línea «fuente,»

=== solo-en-el-correo: el 192 la ve en la fuente de un correo que ninguna pantalla muestra ===
[ROJO ESPERADO]
  [FAIL] 192 … — «agro» suelta, 1 vez/veces:
    fuente, backend/app/services/verificacion.py:105: «tu correo en AgroBoeda, el mercado del agro",»

src, backend e index.html después: como estaban
todos dieron el rojo esperado
```

Los tres negativos:

- **`textos-de-la-base`** devuelve los cinco archivos a como estaban en la
  base. Exige ver las once apariciones en la fuente y cada texto en la
  pantalla, en los dos anchos.
- **`solo-en-la-pantalla`** arma la palabra en el pie con
  `{'ag' + 'ro'}`. Exige que la vea la pantalla y que la fuente **no** la
  nombre.
- **`solo-en-el-correo`** pone «agro» en el asunto del correo de
  verificación. Exige que la vea la fuente y que la pantalla **no**. No hace
  falta reiniciar la API, porque el caso lee el archivo.

## Sin desbordes

```
npm run a11y -- --todas     76 de 76 pantallas exigidas; 0 violaciones serious o critical;
                            SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA
npm run contraste           ✓ las 84 mediciones exigidas se hicieron; TODO OK, COBERTURA COMPLETA
mobile-audit.mjs            12 de 12 recorridos completos; 39 pantallas a 360, 390 y 768 px,
                            0 con desborde de página; 0 controles tapados; 0 errores de consola; 0 respuestas 4xx/5xx
```

En las 39 pantallas, la única tabla que se desplaza a lo ancho es la de
publicaciones del panel de administración. Lo hace dentro de su propia caja,
como ya estaba clasificado, y no la toqué.

**Los textos que cambian de largo.** Contrasté el texto viejo y el nuevo
sobre la misma página, en cada ancho. Los números son renglones, antes →
ahora:

```
ancho  portada  pie   servicios  quiénes somos
 320    1→2     2→2     2→3        4→5
 360    1→2     1→2     2→2        3→4
 390    1→1     1→2     2→2        3→3
 412    1→1     1→1     2→2        3→3
 768    1→1     1→2     2→3        1→2
1024    1→1     2→2     1→2        1→1
1440    1→1     1→1     1→1        1→1
```

- En ningún ancho hay desborde.
- Los títulos y los párrafos que ganan un renglón lo hacen con el corte
  normal del texto.
- La única que cambia de forma es la bajada de la portada: es lo que tenés
  que decidir arriba.
- Miré las capturas a 360 px: bajada de la portada, pie, cierre de
  Servicios y cierre de Quiénes somos. También el margen a 1024 y 1440 px.

## Sin regresiones

Elegí los casos del smoke que recorren Inicio, Servicios o Quiénes somos, el
pie o `index.html`. Los encontré buscando esas secciones y sus selectores en
el archivo. Eran 25; saqué el 131, que en mi entorno falla por el puente de
Docker (`docker run`), como en informes anteriores.

El único que afirmaba un texto que cambió es el 156: el título de la pestaña.
Lo actualicé en `a1b4acd`.

```
SMOKE_CASOS=122,123,124,125,126,128,136,139,140,147,148,155,156,158,159,161,163,166,167,168,170,183,191,192
24/24 pasaron; 0 fallaron
```

No corrí la suite completa porque el cambio es de texto: la tarea pide los
casos que verifican textos públicos. Tampoco corrí la guía del panel admin,
porque no cambió ningún texto del panel.

## Puertas

Sobre el candidato:

```
npx tsc --noEmit                                  sin salida (verde)
npm run lint                                      sin advertencias (--max-warnings 0)
npm run build                                     ✓ built in 1.84s
node --check scripts/smoke.mjs                    verde
python3 -m py_compile sabotajes_copy_agro_1.py    verde
git -c core.whitespace=cr-at-eol diff --check     verde
```

`AboutPage.tsx` tiene finales de línea mezclados, CRLF y LF. Los conservé:
`git diff --stat` da lo mismo con `--ignore-cr-at-eol` que sin esa opción.

## Fuera del alcance, visto de paso

- **Tuteo en Quiénes somos (P3).** La misma línea 148 tutea: «Únete a
  AgroBoeda y accede…», en un sitio que vosea. El caso 168 no la tiene en su
  lista. Es del bloque del #14 y no la toqué.

No toqué `main`, Railway ni datos reales, y no desplegué.
