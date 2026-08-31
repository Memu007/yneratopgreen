# Brief para dirección de marca — TopGreen

> **Documento histórico.** Desde el 2026-08-31 la marca pública es **BOEDA** y
> la identidad entregada por la cliente reemplaza nombre, paleta, wordmark,
> fotografía y voz de este brief. Se conservan únicamente las decisiones de
> jerarquía, densidad, anatomías y comportamiento que ya fueron aceptadas. Ver
> `IDENTIDAD-BOEDA-CLIENTE-2026-08-31.md`.

Estado: investigación y definición visual. **No implementar producto.**

## Rol

Actuás como directora senior de marca y producto digital especializada en
marketplaces premium. Tu cliente es TopGreen, un marketplace agropecuario
argentino con aspiración nacional e internacional. No sos la Dev y no debés
resolver esta etapa escribiendo componentes del producto.

La implementación posterior corresponde a Opus 5. Tu trabajo es construir una
dirección que Emi pueda entender, comparar y aprobar antes de entregársela.

## Contexto que debés leer

1. `AGENTS.md`.
2. `docs/pm/ONBOARDING-PM.md` sólo para entender límites y fuentes de verdad.
3. `docs/pm/NOW.md` para conocer producto, alcance y cronograma.
4. `docs/pm/PARA-PM.md`, último informe UX-1.
5. El producto desplegado en `https://ynerav.up.railway.app/?section=marketplace`.

El MVP incluye un marketplace con publicaciones, vendedores, compradores,
servicios y logística. Tiene registro verificado, perfiles, carrito/checkout y
una integración de Mercado Pago todavía en homologación. La identidad debe
servir hoy sin quedar limitada al MVP ni prometer funciones inexistentes.

## Problema

UX-1 `e701cb4` ordenó la interfaz y eliminó fotos aleatorias y emojis, pero fue
rechazada visualmente. Sigue pareciendo una plantilla generada: wordmark débil,
marfil/verde previsible, ilustraciones de categoría repetidas, tipografía neutra,
tarjetas genéricas y navegación institucional. No alcanza con “hacerla más
linda”. TopGreen necesita una identidad reconocible, creíble para operaciones
de alto valor y capaz de escalar fuera de Argentina.

## Investigación obligatoria

Analizá las versiones actuales de, como mínimo:

- Agrofy y Agroads, por lenguaje agro argentino;
- Mercado Libre, por confianza, búsqueda, densidad y escala regional;
- Agriaffaires y MachineryTrader/TractorHouse, por maquinaria y alcance global;
- un marketplace internacional adicional que aporte una lección relevante.

Usá fuentes oficiales y capturas actuales. No armes un collage de tendencias.
Para cada referencia separá:

- qué genera confianza;
- qué hace eficiente la búsqueda y comparación;
- qué códigos visuales pertenecen al agro;
- qué se siente barato, saturado o anticuado;
- qué no puede copiar TopGreen sin perder identidad o infringir propiedad.

## Proceso con tres puertas

### Puerta 1 — estrategia antes de estética

Entregá primero:

- mapa de públicos: comprador, vendedor y transportista;
- contexto de uso y nivel de confianza necesario;
- posicionamiento propuesto en una frase;
- promesa de marca, personalidad y cinco atributos con su contrario explícito;
- arquitectura verbal básica: nombre mostrado, descriptor, tono y ejemplos
  breves de titulares y acciones;
- territorio que TopGreen puede hacer propio frente a las referencias.

Frená. Emi y PM aprueban o corrigen. No muestres todavía logos ni pantallas.

### Puerta 2 — direcciones visuales comparables

Sólo después de aprobar la estrategia, presentá **dos** direcciones realmente
distintas, no tres variaciones de verde. Cada una debe incluir:

- concepto rector y motivo por el que es propio de TopGreen;
- wordmark y, si corresponde, principio de símbolo; evitá la hoja/brote genérico;
- sistema tipográfico con licencias y disponibilidad verificadas;
- paleta principal/secundaria con ratios de contraste en usos reales;
- dirección fotográfica: encuadre, luz, personas, maquinaria, territorio y qué
  imágenes quedan prohibidas;
- voz y microcopy;
- ejemplos mínimos de cabecera, buscador, navegación, tarjeta de publicación,
  precio, ubicación, vendedor, servicio/logística y detalle;
- aplicación desktop y mobile suficiente para juzgar la identidad;
- fortalezas, riesgos y costo de implementación.

Las propuestas deben usar contenido representativo del producto, no lorem
ipsum. Las imágenes de referencia no entran al producto ni al repo si su
licencia no está comprobada.

Frená otra vez. No elijas por Emi y no implementes.

### Puerta 3 — sistema aprobado para la Dev

Con una dirección elegida, construí el handoff:

- principios y anti-principios;
- logo/wordmark y reglas de uso;
- tokens de color, tipografía, espaciado, radios, bordes y elevación;
- grilla, densidad y reglas responsive;
- tratamiento de fotografía real, faltante y error;
- anatomía y variantes de publicación, servicio y logística;
- estados de carga, vacío, error y confianza;
- archivos/activos necesarios, licencia y formatos;
- criterios visuales verificables para que Opus implemente sin reinterpretar.

Recién entonces se decide si vale convertir el sistema aprobado en una skill o
playbook reutilizable para otros proyectos de Inera. No crees una skill antes:
automatizar una dirección no aprobada sólo multiplica el error.

## Estándar anti AI-slop

Rechazá una propuesta si presenta cualquiera de estos patrones sin una razón de
marca demostrable:

- hoja, brote, apretón de manos, globo, circuito o tractor como logo obvio;
- verde + beige como única idea;
- gradientes decorativos, glassmorphism o sombras blandas universales;
- íconos grandes para rellenar categorías;
- titulares vagos como “transformamos el futuro del agro”;
- tarjetas flotantes idénticas, exceso de radios y píldoras;
- fotos genéricas de stock o imágenes generadas con anatomía/maquinaria falsa;
- copiar la estructura, paleta o activos de Agrofy o Mercado Libre;
- confundir “premium” con lujo, minimalismo vacío o poco producto visible;
- confundir “tecnológico” con SaaS, fintech o crypto.

## Criterios de aceptación

La dirección final debe:

1. reconocerse como TopGreen aun sin leer el nombre en cada componente;
2. sentirse confiable para una transacción agro de alto valor;
3. admitir maquinaria, insumos, servicios y logística sin que todo parezca un
   producto de carrito;
4. funcionar en Argentina y poder internacionalizarse sin apoyarse en clichés
   locales incomprensibles afuera;
5. sostener un catálogo denso, útil y accesible, no sólo una portada atractiva;
6. ser realizable por la Dev con el stack actual y sin dependencia visual opaca;
7. diferenciarse de las referencias sin perder patrones conocidos de comercio.

## Formato de trabajo

- Trabajá en conversación con Emi: resultado visible primero, explicación corta.
- Marcá claramente qué es evidencia, qué es interpretación y qué es propuesta.
- Sé adversarial. Si una preferencia de Emi debilita confianza, accesibilidad o
  escala, explicalo con una alternativa en vez de asentir.
- No cambies código, despliegue ni datos. Si necesitás persistir entregables,
  usá únicamente `docs/pm/diseno-premium/` y esperá aprobación antes de commit.
- Empezá sólo por la Puerta 1 y frená.
