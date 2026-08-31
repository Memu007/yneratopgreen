# Identidad BOEDA y triage del material de cliente

Fecha: 2026-08-31.

Fuentes revisadas completas:

- `AgroMarket_Manual_Producto_AGM-08_v1.1.docx`;
- `BOEDA_Guia_Comunicacion_Interareas.pdf`;
- `Manual-01.png`.

## Decisión ejecutiva

La marca pública del producto deja de ser **TopGreen** y pasa a ser **BOEDA**.
La lámina `Manual-01.png` es la autoridad visual provista por la cliente para
orientar el producto. Los manuales de producto y comunicación son insumos de
visión y lenguaje: no modifican por sí solos el contrato, el cronograma ni el
MVP vigente.

Esta decisión no abre una tarea paralela para Dev. La migración visual se
programa como una pieza propia después de cerrar el arnés vigente y
`TRANSFER-REC-1`, antes del cierre visual/responsive final.

## Sistema de marca recibido

- Nombre y wordmark: **BOEDA**.
- Descriptor: **Ecosistema agropecuario conectado.**
- Territorios de comunicación:
  - **Nodo — Tecnología / Red:** «El agro es una red.»
  - **Territorio — Agro / Origen:** «Todo tiene un origen.»
  - **Conexión — Ecosistema / Negocio:** «Conectar es generar valor.»
- Cualidades: tecnológica, sistémica, precisa, territorial, productiva,
  auténtica, conectada, colaborativa y generadora de valor.
- Paleta declarada:
  - bosque profundo `#18352A`;
  - verde lima `#A8D94A`;
  - marfil cálido `#F4F1E8`;
  - beige tierra `#B9A982`;
  - verde casi negro `#17211D`.
- Lenguaje visual: fotografía real del territorio y la cadena agroindustrial,
  luz cálida, redes/nodos y trazabilidad como recursos secundarios.

## Traducción al producto

Se conserva del diseño ya aprobado la jerarquía, densidad informativa,
anatomías y comportamiento. Se reemplaza la identidad pública: nombre,
wordmark, tokens cromáticos, fotografía, voz y recursos gráficos.

Reglas:

1. BOEDA debe sentirse como una plataforma operativa agropecuaria, no como un
   diario, una fintech genérica ni una plantilla de IA.
2. El verde bosque domina; el lima es acento de estado o acción y no un fondo
   indiscriminado. Marfil y beige construyen el plano de lectura.
3. Las fotos deben mostrar territorio, maquinaria, logística, producción o
   intercambio reales. No se usan paisajes decorativos sin relación con la
   operación.
4. Los nodos y líneas sirven para explicar conexión, origen o trazabilidad en
   superficies institucionales. No se superponen sobre cada tarjeta ni se
   convierten en ruido ornamental.
5. Se mantiene lenguaje directo y verificable: ubicación, condición,
   responsable y próximo paso. No se promete trazabilidad, contratación,
   custodia o certificación que el MVP todavía no ejecuta.
6. El logo de la lámina no se recorta como activo final. Antes de implementar
   se solicita a la cliente el original vectorial (`SVG`, `AI` o PDF vector) y
   una versión `PNG` transparente, junto con variantes clara, oscura y
   monocromática si existen.

## Límite de la migración de nombre

Se cambia a BOEDA todo lo visible o emitido para usuarios: interfaz, emails,
documentos exportados, metadatos, textos legales, asunto/remitente visible y
activos de marca.

No se hace un reemplazo global de `topgreen` en el repositorio. Repo, paquetes,
contenedores, variables, nombres de base, servicios Railway y otros
identificadores internos pueden conservar el nombre técnico actual. Migrarlos
sin necesidad contractual agrega riesgo operativo y no aporta valor al usuario.

## Triage adversarial del manual de producto

### Compatible o útil para el MVP vigente

- Confianza basada en evidencia y estados visibles, no en afirmaciones vagas.
- Visibilidad de datos según rol y momento del recorrido.
- Ubicación, actor, condición comercial y evidencia estructurada.
- Ciclo de operación legible y reputación ligada a operaciones reales.
- Normalizar primero la información del negocio y luego elegir mecanismos
  técnicos o legales.

Estos principios orientan UX y copy, pero sólo se implementan hasta donde llega
el alcance ya aprobado.

### Visión posterior; no entra automáticamente al MVP

- Mensajería estructurada, negociación y contraofertas.
- Contratos digitales y un libro completo e inmutable de eventos.
- Arquitectura multirrol por actor y nuevos roles separados: acopios,
  cooperativas, corredores, exportadores, laboratorios o certificadores.
- Publicaciones de demanda y tableros para pools/inversores.
- Reputación calculada que reemplace el sistema vigente.
- Monitoreo en tiempo real, inteligencia de mercado y analítica avanzada.
- Financiamiento, seguros, blockchain/DLT, smart contracts y tokenización.

Cada punto requiere decisión, estimación, tratamiento legal/de datos y cambio
de alcance. Que aparezca bajo el título «MVP» en el documento de la cliente no
lo vuelve parte del MVP contractual.

### Contradicción que no debe colarse

El manual propone bloquear la publicación hasta verificar identidad. La
decisión vigente de cortesía es revisión manual informativa de documentación;
no bloquea la publicación. Cambiar esta regla afecta operación, soporte,
responsabilidad y alcance, por lo que necesita una decisión explícita nueva.

## Fuente conceptual de comunicación interáreas

La guía BOEDA aporta una regla sana: primero describir el objeto agropecuario,
sus estados, evidencias, derechos y validaciones; después decidir si necesita
un instrumento legal, tecnológico o comercial. También deja claro que
tokenizar no es el punto de partida. Se adopta como criterio de conversación,
no como backlog de funcionalidades.

## Próxima pieza futura: BRAND-BOEDA-1

Entrada mínima:

- activos originales del logo;
- confirmación de variantes permitidas y descriptor;
- inventario de superficies públicas que todavía dicen TopGreen;
- capturas desktop y mobile del producto vigente.

Salida exigida:

- tokens BOEDA accesibles;
- sustitución del nombre visible sin renombrado técnico masivo;
- aplicación coherente en Inicio, Mercado, Servicios, autenticación, paneles,
  emails y documentos visibles;
- fotografías y fallbacks consistentes;
- build, lint, contraste, responsive y recorridos vigentes en verde;
- revisión visual explícita de Emi antes de desplegar.

No se inicia hasta que PM la active como única tarea.
