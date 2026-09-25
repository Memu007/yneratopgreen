# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## MERCADO-UNICO-1 — entregada

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `c37ce91` |
| candidato | `29ea2ec` (producto) y `2b71709` (arnés: caso 193, negativos y casos que usaban Servicios) |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.**

- Queda un solo Mercado. La cabecera ofrece Inicio, Mercado, Quiénes somos y
  Contacto.
- Tres caminos llevan al Mercado con el filtro de servicios: la URL vieja
  `?section=services`, una entrada vieja del historial y «Servicios» del pie.
- Ahí se ve lo mismo que mostraba la página: sus tres servicios encabezan la
  grilla, y el total es el de todos los servicios activos, logística incluida.
- Atrás y Adelante funcionan en los tres caminos.
- El caso 193 lo prueba, y sus tres negativos dan rojo.
- La suite completa da 192/193; sólo falla el 131, por el entorno.

**Para decidir vos (no bloqueante).**

1. **No había advertencia que mudar.** La página Servicios no tenía ningún
   aviso ni límite de responsabilidad: nada decía, por ejemplo, que AgroBoeda
   no verifica a quien presta el servicio. No mudé nada.
   - Lo más cercano era «Cobertura real: … declarados por quien presta el
     servicio», dentro de «Qué mirar antes de cotizar». Es una guía para
     comparar, no un aviso.
   - Hoy «AgroBoeda no verifica» sólo aparece para la habilitación del
     transportista, en el checkout y en el panel.
   - Si querés ese aviso en el Mercado de servicios, es texto nuevo con peso
     legal. **Recomiendo no agregarlo en esta pieza** y decidirlo con Emi.
2. **La cabecera cambia de forma en celular y en tablet.**
   - En celular, los cuatro destinos van en dos y dos, en lugar de tres y
     dos. La cabecera sigue ocupando dos renglones.
   - En tablet van en cuatro columnas, en lugar de cinco.
   - Es lo mínimo que hace falta al sacar una celda. **Recomiendo dejarla
     así.**

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --recrear
SMOKE_CASOS=193 node scripts/smoke.mjs
  → [PASS] 193 Un solo Mercado: la cabecera no ofrece Servicios y los enlaces viejos llevan al Mercado con el filtro — …
python3 scripts/sabotajes_mercado_unico_1.py
  → tres [ROJO ESPERADO]
  → src después: como estaba
  → todos dieron el rojo esperado
```

**Antes de correrlo:**

- Los negativos cambian un archivo del frontend mientras el servidor de
  desarrollo lo sirve, y lo restauran al terminar. No los corras en paralelo
  con otra corrida del smoke.
- El 193 publica un servicio y una logística propios, y los retira al
  terminar.
- El 131 falla en mi entorno porque el puente de Docker no traduce
  `docker run`, como en informes anteriores.

## El inventario

### Lo que listaba la página, y dónde está ahora

| antes, en Servicios | ahora |
|---|---|
| «Servicios activos»: las tres publicaciones más nuevas de tipo servicio (servicio o logística) | el Mercado con `type=servicios`: todas, paginadas y en el mismo orden. Las tres de la página encabezan la grilla |
| estados de carga, error («No pudimos cargar los servicios.» y Reintentar) y vacío («Todavía no hay servicios publicados.») | los estados del Mercado: esqueleto, error con Reintentar (caso 122) y «No hay operaciones con estos filtros» |

La logística ya salía en la página y sale en el Mercado filtrado: vive en
categorías de servicio. El caso 193 lo mide: 14 servicios activos, 3 de
logística, y el Mercado dice 14.

### El contenido propio de la página: se saca sin reemplazo

| bloque | qué decía |
|---|---|
| foto del encabezado | relevamiento aéreo de un campo inundado, con su epígrafe |
| encabezado | «Servicios publicados» · «Encontrá quién resuelve el trabajo.» · «Muestreo, labores, asistencia técnica y logística con cobertura, modalidad y responsable declarados.» |
| botones | «Ver servicios publicados», «Explorar todos», «Ver servicios» y tres «Publicar un servicio» |
| trío | Cobertura: Zona de trabajo · Modalidad: Precio o cotización · Responsable: Quién presta el servicio |
| «Qué mirar antes de cotizar.» | Cobertura real, Modalidad y Condiciones (ver la decisión 1) |
| cierre | «¿Prestás un servicio para el sector agropecuario?» · «Indicá cobertura, modalidad y responsable para que la propuesta pueda compararse.» |

- **Publicar un servicio.** Se sigue haciendo desde «Vender» en la cabecera
  y desde las llamadas a publicar de Inicio y Quiénes somos. No cambió cómo
  se publica.
- **Las fotos.** Los dos archivos (`public/media/comercial/servicios-relevamiento-hero-960*.webp`)
  quedan sin uso. No los borré porque están registrados como derivados
  autorizados en `docs/pm/diseno-premium`; si querés, se borran.

### Los enlaces

| enlace | antes | ahora |
|---|---|---|
| cabecera | celda «Servicios» | no está |
| URL `?section=services` | la página | se reescribe como `?section=marketplace&type=servicios`, sin agregar una entrada |
| entrada vieja del historial | la página | lo mismo, al llegar con Atrás o Adelante |
| pie, «Servicios» | la página | el Mercado con sólo el filtro de servicios: limpia la búsqueda, los demás filtros y el orden |
| Inicio | no tenía ningún enlace a Servicios | sin cambios. Le quité una propiedad que recibía y no usaba |
| ficha, «Volver a Servicios» | desde la página | no existe. Desde el Mercado de servicios dice «Volver al Mercado» |

## El caso 193

Sobre una base recién creada:

```
[PASS] 193 Un solo Mercado: la cabecera no ofrece Servicios y los enlaces viejos llevan al Mercado con el filtro — un solo Mercado (
  escritorio 1440 px: la cabecera ofrece Inicio, Mercado, Quiénes somos, Contacto en 1 renglón(es), sin Servicios ni desborde;
  tablet 768 px: la cabecera ofrece Inicio, Mercado, Quiénes somos, Contacto en 1 renglón(es), sin Servicios ni desborde;
  celular 360 px: la cabecera ofrece Inicio, Mercado, Quiénes somos, Contacto en 2 renglón(es), sin Servicios ni desborde;
  «?section=services» abre «/?section=marketplace&type=servicios» con el selector en Servicios, la celda Mercado marcada,
    ["Unico193 flete …","Unico193 servicio …","Instalación y Reparación de Alambrados Rurales"] al frente como en la página,
    y el total de 14 servicios activos (3 de logística);
  «Servicios» del pie lleva ahí desde Inicio y desde un Mercado con otra búsqueda, que se limpia; en Inicio es el único control con ese nombre;
  Atrás y Adelante recorren Inicio y el Mercado de servicios desde el pie, desde la URL vieja y desde una entrada vieja del historial,
    sin volver a pasar por «?section=services»)
```

«Lo que mostraba la página» lo calcula el caso con el mismo pedido que hacía
la página: las tres más nuevas de tipo servicio. Además mide que en cada
destino coincidan la barra, el selector de tipo, la celda marcada y la
grilla.

## Los negativos

`python3 scripts/sabotajes_mercado_unico_1.py`, sobre `2b71709`. Cada uno
devuelve un archivo a `c37ce91`; los tres compilan con el resto del código,
así que el rojo es del comportamiento y no de una aplicación rota.

```
=== cabecera-de-la-base: el 193 falla porque la cabecera ofrece Servicios ===
[ROJO ESPERADO]
  [FAIL] 193 … — escritorio: la cabecera ofrece ["Inicio","Mercado","Servicios","Quiénes somos","Contacto"]

=== enlace-viejo-de-la-base: el 193 falla porque la URL vieja no lleva al Mercado de servicios ===
[ROJO ESPERADO]
  [FAIL] 193 … — no pasó a tiempo: la URL vieja: la barra dice «/?section=services» y no «/?section=marketplace&type=servicios»

=== pie-de-la-base: el 193 falla porque «Servicios» del pie no lleva al Mercado de servicios ===
[ROJO ESPERADO]
  [FAIL] 193 … — no pasó a tiempo: «Servicios» del pie, desde Inicio: la barra dice «/» y no «/?section=marketplace&type=servicios»

src después: como estaba
todos dieron el rojo esperado
```

## Regresión

**Por qué corrí la suite completa.** El cambio toca la navegación, que
recorren casi todos los casos de pantalla, así que corrí la suite completa en
vez de elegir casos. Fue sobre `2b71709`, con la base recién creada:

```
192/193 pasaron; 1 fallaron
[FAIL] 131 … puente docker: sólo se traduce 'docker exec'   (entorno, como siempre)
```

**Los casos que afirmaban la pestaña.** Los actualicé y justifico cada uno:

| caso | qué afirmaba | ahora |
|---|---|---|
| 123 | zoom 200 % en la página Servicios | en el Mercado de servicios, al que se llega por el pie |
| 125 | la página: sin claims, publicaciones reales, su foto y su error | lo mismo en el Mercado de servicios; la foto y el error propio se fueron con la página |
| 126 | el servicio tapado en la vista previa y en el Mercado | en el Mercado, entrando por la URL vieja |
| 128 | cabecera igual en Inicio, Mercado y Servicios, con cinco destinos | Inicio, Mercado y Quiénes somos, con cuatro destinos |
| 139 | la puerta de ingreso en tres pantallas con tarjetas | Inicio, Mercado y Mercado de servicios; las pantallas que dibujan tarjetas ahora son dos |
| 140 | las publicaciones propias en Inicio, Mercado y Servicios | lo mismo, con el Mercado de servicios en lugar de la página |
| 147 | cinco secciones en la barra y en el historial; la ficha abierta desde Servicios | cuatro secciones; la ficha se abre desde el Mercado de servicios |
| 148 | el foco al volver de la ficha abierta desde Servicios | lo mismo, desde el Mercado de servicios |
| 155 | la vista previa compacta en Inicio y Servicios | sólo en Inicio. Además, el caso visitaba `/services`, una ruta que nunca dibujó Servicios: medía Inicio dos veces |
| 156 | la marca vieja en las cinco páginas públicas | en las cuatro |
| 163 | salir de Mi cuenta hacia Servicios con trabajo sin guardar | hacia Quiénes somos |
| 167 | los botones para publicar de Servicios | salen de la lista; quedan Inicio y Quiénes somos |
| 170 | las cinco secciones en la cabecera con el carrito | las cuatro |
| 183 | la ficha abierta desde Servicios dice «Volver a Servicios» | desde el Mercado de servicios dice «Volver al Mercado» |
| 192 | «agro» en la página Servicios | la página ya no está; su negativo pasa de once apariciones a diez |

**Las otras corridas:**

- **Guía del panel.** Después de la suite: `node scripts/guia-admin.mjs`
  terminó con salida 0 y dijo «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en
  escritorio y celular».
- **Negativos de COPY-AGRO-1.** Los ajusté y los volví a correr: tres
  `[ROJO ESPERADO]`, y los archivos quedaron como estaban.

## Sin desbordes y accesibilidad

```
npm run a11y -- --todas    76 de 76 pantallas exigidas; 0 violaciones serious o critical;
                           SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA
npm run contraste          84 de 84 mediciones exigidas; TODO OK, COBERTURA COMPLETA
mobile-audit.mjs           12 de 12 recorridos completos; 39 pantallas a 360, 390 y 768 px,
                           0 con desborde de página; 0 controles tapados; 0 errores de consola; 0 respuestas 4xx/5xx
```

**La cobertura no bajó.** En la lista compartida de a11y y contraste, la
superficie «servicios» pasa a ser «catálogo: servicios»: el Mercado filtrado,
con sus tarjetas de servicio y de logística. Es la misma cantidad de
pantallas, medida donde ahora se ven los servicios.

## Puertas

Sobre el candidato:

```
npx tsc --noEmit                                  verde
npm run lint                                      sin advertencias (--max-warnings 0)
npm run build                                     ✓ built in 2.58s
node --check (smoke, a11y, contraste, superficies) verde
python3 -m py_compile (dos scripts de negativos)  verde
git -c core.whitespace=cr-at-eol diff --check     verde
```

**Finales de línea.** `App.tsx` y `AboutPage.tsx` tienen finales mezclados, y
los conservé: `git diff --stat` da lo mismo con `--ignore-cr-at-eol` que sin
esa opción.

No toqué `main`, Railway, el backend ni datos reales, y no desplegué.
