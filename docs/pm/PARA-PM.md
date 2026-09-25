# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ATRIBUTOS-RUBRO-1, parte 1: entregada en rama

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `86fc0da` (tu decisión) |
| código | `e624831`: tipo y potencia en alta, edición, ficha, filtro y siembra |
| arnés | `8dce24b`: casos 194 a 196, negativos, y 55 y 58 en copia de la base |
| auditorías | `3594363`: a11y y contraste miden los filtros nuevos |
| arreglo | `4eac0f7`: el caso 179 baja su migración en una copia |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.**

- **Listas:** 33 listas con 122 tipos, más la potencia de Tractores.
- **Casos y negativos:** 194, 195 y 196 en verde. Los tres negativos dan
  rojo, cada uno por su motivo.
- **Suite completa desde una base nueva:** 195 de 196. El único rojo es el
  131, de entorno.
- **Auditorías:**
  - a11y: 78 de 78.
  - Contraste: 86 de 86.
  - Auditoría móvil: 12 de 12 recorridos, sin hallazgos.
  - Guía del panel: los 26 pasos coinciden, en escritorio y en celular.

**Para decidir vos (ninguna es bloqueante).**

1. **Dos nombres completos que no aprobaste.** Hice con Cosecha y con Cercas
   lo que aprobaste en Fertilización.
   - Cosecha: «cosechadoras de granos, forrajes…» quedó «Cosechadoras de
     granos», «Cosechadoras de forrajes»…
   - Cercas y bebederos: «eléctricas, portátiles» quedó «Cercas eléctricas»,
     «Cercas portátiles».

   Solas, «Forrajes» o «Portátiles» no dicen qué se vende. **Recomiendo
   dejarlo así.** Si no, se cambia en `tipos.py` sin migración.
2. **Dos defectos que ya estaban, fuera del alcance.** Recomiendo
   corregirlos en la parte 2 (ver abajo, «Visto de paso»).

## Qué se cargó por subrubro

Vive en `backend/app/services/tipos.py`, y la siembra lo carga. Sin tipo
quedan las 4 «Mejoras» de Tierras, las 5 de una sola opción y Tractores, que
va por potencia.

| rubro | subrubro | tipos |
|---|---|---|
| Maquinaria agrícola | Preparación del suelo | Arados · Rastras · Cultivadores · Subsoladores · Otros |
|  | Siembra y plantación | Sembradoras de granos gruesos · Sembradoras de granos finos · Sembradoras de hortalizas · Otras |
|  | Fertilización y protección | Pulverizadoras autopropulsadas · Pulverizadoras de arrastre · Fertilizadoras centrífugas · Fertilizadoras de disco · Aviones · Drones · Otros |
|  | Cosecha | Cosechadoras de granos · Cosechadoras de forrajes · Cosechadoras de algodón · Cosechadoras de caña · Cosechadoras de café · Cosechadoras de frutales · Cosechadoras de hortalizas · Otros |
|  | Postcosecha | Limpiadoras · Secadoras · Ensacadoras · Silos · Otros |
|  | Forrajes y ganadería | Picadoras · Embolsadoras · Enfardadoras · Mezcladoras · Otros |
| Riego y drenaje | Riego por aspersión | Pivotes · Cañones · Laterales |
|  | Riego localizado | Goteo · Microaspersión · Cintas |
|  | Riego superficial y subterráneo | Superficial · Subterráneo |
|  | Bombas, motobombas y accesorios hidráulicos | Bombas centrífugas · Motobombas · Accesorios hidráulicos |
|  | Drenaje y control hídrico | Drenaje subsuperficial · Canales · Control de nivel |
| Insumos agrícolas | Semillas y plántulas | Cultivos extensivos · Hortícolas · Forrajeras · Forestales |
|  | Fertilizantes | Orgánicos · Minerales |
|  | Correctivos | Cal · Yeso · Enmiendas |
|  | Agroinsumos biológicos | Biofertilizantes · Biocontroladores · Microorganismos |
|  | Agroquímicos | Herbicidas · Insecticidas · Fungicidas · Acaricidas |
|  | Sustratos y coberturas | Sustratos · Mulch · Mallas · Films |
| Ganadería y forrajes | Cercas y bebederos | Cercas eléctricas · Cercas portátiles · Hidrantes · Bebederos |
|  | Manejo animal | Corrales · Mangas · Balanzas · Caravanas |
|  | Ordeño y sanidad | Ordeñadoras mecánicas · Tanques de leche · Equipos de baño |
|  | Suplementación | Comederos · Tolvas · Silos de grano |
| Repuestos y mantenimiento | Neumáticos y cámaras | Neumáticos agrícolas · Cámaras |
|  | Filtros, correas, cuchillas, cadenas | Filtros · Correas · Cuchillas · Cadenas |
|  | Sistemas hidráulicos | Mangueras · Racores · Bombas hidráulicas |
|  | Sistemas electrónicos y sensores | Monitores · GPS · Piloto automático |
|  | Lubricantes y baterías | Lubricantes · Baterías |
| Agricultura de precisión y tecnología | Sistemas de guiado y GNSS | Antenas · Pantallas · Corrección por señal |
|  | Sensores de cultivo | Clorofila · Humedad · Temperatura |
|  | Drones y VANTs | Multiespectrales · Térmicos · Aplicadores |
|  | Software y plataformas | Gestión de flota · Prescripción variable · Rendimiento |
| Tierras y parcelas | Compra-venta definitiva | Campo agrícola · Campo ganadero · Parcela hortícola/frutícola · Campo mixto · Otros |
|  | Alquiler por campaña (1-12 meses) | Siembra directa · Siembra convencional · Otros |
|  | Alquiler por uso transitorio | Pastoreo rotativo · Ensayos agrícolas · Producción estacional · Agricultura regenerativa · Agricultura experimental · Otros |

**Tractores:** la potencia en HP va de 1 a 1000. El filtro ofrece tres
rangos: compacto hasta 59, estándar de 60 a 120 y alta desde 121. Los bordes
60 y 120 caen en estándar.

**Siembra de ejemplo:** 14 publicaciones demo con tipo, y el tractor Pauny
con 180 HP, porque su descripción ya lo dice. El kit de filtros queda sin
tipo a propósito, para probar el nulo.

## Casos

Salida de la suite completa.

- **194, alta y edición.**
  - Rechaza 8 altas inválidas sin guardar ninguna fila:
    - un tipo de otro subrubro, uno inventado, uno sin subrubro, y uno en un
      subrubro sin lista;
    - una potencia negativa, una de 0, una de 1001 HP, y una fuera de
      Tractores.
  - En la pantalla, el formulario ofrece la lista del subrubro y la suelta al
    cambiarlo. Guarda «Arados», y en Tractores 95 HP.
  - La ficha dice «Tipo: Arados» y «Potencia: 95 HP».
  - La edición lo cambia a «Subsoladores» y 130.
  - Por la API, un tipo ajeno se rechaza sin tocar la fila, cambiar de
    subrubro suelta el tipo, y `null` lo quita.
- **195, filtro.**
  - Con 14 arados sembrados (5 compactos, 11 estándar, 9 de alta), la API y
    la pantalla cuentan lo mismo que la base.
  - Lo que no declaró el dato no entra.
  - Cambiar un filtro vuelve a la página 1.
  - La barra lleva `subtype` y `power`, y Atrás desde la ficha y desde Inicio
    los devuelve.
  - Un tipo ajeno al subrubro se descarta.
  - «neumática», escrita en una descripción, se encuentra con el buscador.
- **196, migración.**
  - En una copia de la base: baja y sube, y las publicaciones quedan
    idénticas.
  - La tabla nace vacía y las columnas nacen nulas.
  - La base rechaza una potencia de -1, y `alembic check` queda limpio.

```
[PASS] 194 El tipo y la potencia se declaran al publicar, se validan, se ven en la ficha y se editan — 8 altas inválidas rechazadas con su motivo y ninguna fila guardada (tipo de otro subrubro, inventado, sin subrubro, en un subrubro sin lista; potencia -5, 0, 1001 y fuera de Tractores); el formulario de alta ofrece la lista del subrubro, la suelta al cambiarlo y guarda «arados»; en Tractores ofrece sólo la potencia y guarda 95 HP; la ficha dice «Tipo: Arados» y «Potencia: 95 HP», y sin dato no dibuja la fila; el panel abre la edición con el tipo y la potencia guardados y los cambia: «subsoladores» y 130 HP; por la API, un tipo ajeno se rechaza sin tocar la fila, cambiar de subrubro suelta el tipo y la potencia que ya no corresponden, y null los quita (6225 ms)
[PASS] 195 Filtrar por tipo y por potencia cuenta en el servidor, deja afuera lo no declarado y vive en la URL — la API cuenta en el servidor —14 arados; 5 compacto, 11 estandar, 9 alta— y el total y las páginas coinciden con la base; 60 y 120 HP son estándar; las 10 sin tipo y el tractor sin potencia no entran en ningún filtro; «neumática» se encuentra con el buscador; en la pantalla, elegir tipo o potencia vuelve a la página 1, el conteo es el de la base, no se cuela ninguna sin tipo, Atrás desde la ficha y desde Inicio devuelve el filtro, cambiar de subrubro lo suelta, lo ajeno se descarta de la barra, sin subrubro no hay filtro, y «neumática» se encuentra con el buscador (4645 ms)
[PASS] 196 La migración del tipo y la potencia es aditiva, vuelve atrás y deja intactas las publicaciones — bajar a b6d3f12a8e94 borra la tabla y las dos columnas y deja las 294 publicaciones iguales (huella 5e3ca104c60f…); subir crea la tabla vacía y las dos columnas en nulo para todas: no le inventa un dato a nadie, y el resto de cada fila queda igual; la base rechaza una potencia negativa aunque se escriba por fuera de la API; `alembic check` no encuentra diferencias entre el modelo y el esquema. Todo en una copia de la base (3751 ms)
```

## Negativos

`python3 scripts/sabotajes_atributos_rubro_1.py` rompe el catálogo de tres
maneras y comprueba que el 195 falle por la que corresponde. Al terminar deja
`src` y `backend` como estaban.

| negativo | qué rompe | el 195 dice |
|---|---|---|
| `despues-de-contar` | el servidor filtra después de contar | 12 problemas; por ejemplo, «API, tipo «arados»: el total dice 27 y en la base hay 14» |
| `en-el-navegador` | el servidor ignora el filtro y el Mercado filtra la página que bajó | 17 problemas, entre ellos «pantalla, con «Arados»: dice 27 operaciones y en la base hay 14» |
| `acepta-nulos` | el servidor suma lo que no declaró el dato | 15 problemas; por ejemplo, «API, tipo «arados»: trajo 10 que no declararon el dato o no corresponden» y «pantalla: con «Arados» se ven 10 sin tipo» |

Los tres dieron `[ROJO ESPERADO]`, y cierran con «src y backend después:
como estaban».

## Migración

`c8e41f2a7d90`, que viene después de `b6d3f12a8e94`. Es aditiva:

- **La tabla `subcategory_types`** nace vacía y la llena la siembra.
- **`products.subcategory_type_id`** nace nula y no se rellena. Si se borra
  un tipo, la publicación queda sin tipo.
- **`products.power_hp`** nace nula, y la base sólo acepta valores
  positivos.

La bajada borra la tabla y las dos columnas. La probé en una copia (caso
196), no en la base compartida. Ninguna fila existente cambia de valor.

**Lo que destapó en el arnés.** Tres casos bajaban su migración en la base
compartida. Al llegar esta migración, esas bajadas borraban las listas de
tipos de toda la suite.

- **55 y 58:** bajan en una copia y por revisión nombrada. Es el P3 que
  habías registrado.
- **179:** su `downgrade -1` en la base compartida dejó de bajar su propia
  migración y pasó a bajar esta. En la primera suite completa dejó en rojo
  el 179, el 194, el 195 y el 196.
  - Ahora baja y sube en una copia.
  - Lo único que necesita la API, el listado con la imagen duplicada, se mide
    en la base compartida. Para eso el caso retira el índice con la misma
    sentencia de su `downgrade`, y después lo repone con su definición
    exacta.
  - Negativo: con la migración de la imagen alterada para conservar la
    principal equivocada, el 179 da `[FAIL] 179 … la migración conservó
    [...] y tenía que conservar la de menor display_order`.

## Puertas

| puerta | resultado |
|---|---|
| tipos, lint, build | verdes (`built in 2.00s`) |
| `compileall` backend y alembic, `node --check`, `py_compile` | verdes |
| diff-check con `cr-at-eol` | limpio |
| a11y `--todas` | 78 de 78 (antes 76: suma la superficie de los filtros del subrubro) |
| contraste | 86 de 86 (antes 84) |
| auditoría móvil | 12 de 12 recorridos, 39 pantallas: 0 desbordes, 0 recortes, 0 errores de consola, 0 respuestas 4xx/5xx |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| suite completa desde base nueva | «195/196 pasaron; 1 fallaron»: el 131, de entorno |

## Riesgos

- **Producción.** Las listas llegan con la siembra, como las categorías y
  las marcas, y la migración crea la tabla vacía. Pero correr la siembra en
  producción también crea usuarios y publicaciones demo. Se decide al
  desplegar, con Emi.
- **La tarjeta no muestra el tipo;** sólo lo muestra la ficha. No lo
  pediste, y la tarjeta ya está justa a 360 px.
- **Tierras sigue abierta.** Tiene tres listas cargadas, pero si entra en
  esta etapa sigue sin decidirse.

## Visto de paso (fuera del alcance, no lo toqué)

1. **La marca sigue cargada en la publicación siguiente.** Al publicar o al
   cerrar el formulario, `limpiarFormulario` suelta el tipo y la potencia,
   pero no suelta la marca (`AddProductModal.tsx:212`). Si alguien publica
   un John Deere y después otra máquina, el selector ya aparece en John
   Deere, y se guarda así si no lo cambia. Lo confirmé en el código; en el
   navegador no lo reproduje.
2. **«Mercado» dentro del Mercado saca de la barra la condición, el orden y
   la marca.** Es así porque `PARAMETROS_DEL_MERCADO` (`politica.ts:74`) no
   los incluye. La pantalla sigue filtrando, pero la barra ya no lo dice, y
   al recargar el filtro se pierde. El tipo y la potencia sí sobreviven.
   Medido en el navegador:

   ```
   al abrir:        barra=…&subtype=arados&condition=usado  tipo=arados  condición=usado
   tras «Mercado»:  barra=…&subtype=arados                  tipo=arados  condición=usado
   tras recargar:   barra=…&subtype=arados                  tipo=arados  condición=
   ```

   Con `condition=nuevo&sort=price-asc`, «Mercado» deja la barra en
   `?section=marketplace`, y al recargar vuelven «Cualquiera» y «Más
   recientes».

Los dos son P2: el problema es recuperable y ninguno pierde una publicación.
**Recomiendo corregirlos en la parte 2**, cada uno con su caso y su
negativo. Es poco trabajo, y la parte 2 toca el mismo formulario y los
mismos filtros.

## Para verificar, lo mínimo

```
./scripts/entorno_nativo.sh --recrear
SMOKE_CASOS=179,194,195,196 node scripts/smoke.mjs   → 4/4 pasaron; 0 fallaron
python3 scripts/sabotajes_atributos_rubro_1.py       → tres [ROJO ESPERADO] y «todos dieron el rojo esperado»
```

El negativo del 179:

```
M=backend/alembic/versions/20260921_0100_b6d3f12a8e94_una_sola_imagen_principal.py
sed -i 's/ORDER BY product_id, display_order, id/ORDER BY product_id, display_order DESC, id/' $M
SMOKE_CASOS=179 node scripts/smoke.mjs   → [FAIL] 179 … la migración conservó [...] y tenía que conservar la de menor display_order
git checkout -- $M
```

**Advertencias del entorno:**

- El entorno se cae cuando queda inactivo; se levanta con
  `./scripts/entorno_nativo.sh`.
- El 131 falla siempre acá, porque el puente de Docker no traduce
  `docker run`.
- El script de negativos reinicia la API.

Estos comandos los corrí tal cual y dieron eso.

No toqué `main`, Railway ni datos reales, y no desplegué.
