# Feedback visual de Emi — Mercado y Registro

Fecha: 2026-09-06.
Estado: **decidido y en cola; no interrumpe `TRANSFER-REVIEW-1`.**

## Evidencia recibida

Emi revisó cuatro capturas del entorno descartable
`https://ynerav.up.railway.app`. Las imágenes no prueban qué SHA está
desplegado y no autorizan un despliegue, pero los dos problemas señalados
también existen en el código actual `7ff8c8a`:

- en Mercado, `ProductCard.module.css` hace que todo `activo` ocupe la fila
  completa y cambie a composición horizontal, mientras servicios, logística e
  insumos permanecen en columnas. Por eso ordenar no sólo cambia el orden:
  cambia drásticamente la geometría que domina la pantalla;
- en Registro, `passwordGroup` es relativo pero no ocupa el ancho disponible.
  El input queda corto y el botón `Mostrar` aparece flotando lejos del campo.
  El resto de la composición conserva una jerarquía genérica e inconsistente
  con el sistema visual aprobado.

La marca `TopGreen` visible en las capturas corresponde a ese entorno. La
decisión vigente de marca pública BOEDA se mantiene, pero su migración no se
mezcla con estas dos correcciones ni se infiere un estado de despliegue.

## Decisión de producto

### 1. `REGISTER-POLISH-1` — primero

El alta es una puerta de confianza y conversión. Debe sentirse parte del mismo
producto que Mercado, no un formulario genérico agregado encima.

Cierre mínimo:

1. Campos, selects y grupos ocupan y alinean el ancho correcto. Mostrar/Ocultar
   pertenece visual y operativamente al campo de contraseña, con área táctil y
   nombre accesible; no flota en el espacio.
2. Título, introducción breve, etiquetas, opcionales, requeridos, separadores,
   espaciado, foco, error, carga y éxito forman una jerarquía deliberada con los
   tokens existentes de Mesa de negocios / Mercado nacional B. No se crea otro
   sistema visual.
3. La opción transportista se entiende como una ampliación del alta. Desmarcada
   no alarga el formulario; marcada agrupa sus datos sin perder valores,
   validaciones, ayudas privadas ni el catálogo real de cargas.
4. El alta base se verifica en escritorio y `390x844`; la expansión de
   transportista puede desplazarse dentro de la capa, sin desbordes ni controles
   inaccesibles. Teclado, zoom 200 %, contraste y ciclo modal se conservan.
5. Se corrige sólo el copy visible de esta superficie a es-AR coherente —por
   ejemplo, `Crear cuenta`, `¿Ya tenés cuenta?`, `Iniciá sesión`— sin abrir la
   pasada global de `COPY-CLEAR-1`.
6. El contrato de registro, confirmación por correo, validaciones, errores de
   API, reenvío y datos enviados no cambia. Si se tocan estilos compartidos, se
   demuestra que Login no retrocedió.

No entra: OAuth, registro por pasos, términos o páginas legales nuevas,
ilustraciones, dependencia nueva, cambio de Backend o migración de marca.

Regresión reservada: **caso 154**, sobre alta base, error y expansión de
transportista; conserva como controles 148, 150 y 151. Dev corre la suite
completa. PM hace focal, build/lint y puerta visual; sólo repite la suite si el
diff deja de ser visual/aislado o aparece otro disparador del onboarding.

### 2. `MARKET-VIEWS-1` — después

Mercado tendrá exactamente dos presentaciones elegidas por la persona:

- **Cuadrícula:** tarjetas de huella uniforme y lectura cuadrada. En escritorio
  y tablet comparten ancho y alto por fila; ningún activo toma una fila entera.
- **Lista:** una operación por renglón, en rectángulos horizontales de estructura
  uniforme.

Cierre mínimo:

1. Un control visible, rotulado, accesible y operable por teclado permite
   alternar `Cuadrícula` / `Lista` junto al ordenamiento. El estado elegido es
   inequívoco.
2. Ordenar, buscar o filtrar cambia contenido u orden, nunca el modo de vista.
   Abrir/cerrar detalle tampoco lo reinicia durante la permanencia en Mercado.
3. Activo, insumo, servicio y logística conservan datos, color de anatomía y
   acción propios, pero no imponen otra geometría exterior. Se elimina el tercer
   comportamiento implícito de “activo destacado”.
4. En cada modo se alinean títulos, precios, vendedor y acciones; foto válida,
   ausente o rota conserva su espacio previsto. Un texto largo no estira una
   tarjeta aislada ni tapa controles. El detalle mantiene el contenido completo.
5. En `390x844` ambas opciones siguen siendo utilizables y distintas, sin
   forzar una relación 1:1 que recorte contenido o genere overflow.
6. Inicio y Servicios conservan sus previews compactas. No cambian API,
   paginación, filtros, ordenamiento, acciones, detalle, carrito ni Backend.

No entra: tercer modo destacado, personalización persistente entre dispositivos,
rediseño del detalle, fotos nuevas, algoritmo de relevancia o paginación.

Regresión reservada: **caso 155**, con mezcla real de las cuatro anatomías,
los cinco órdenes y tres viewports. Dev corre la suite completa. PM hace focal,
build/lint, contraste/a11y y comparación visual; la suite PM se amortiza con el
lote salvo que el diff cruce navegación o recorridos fuera de Mercado.

## Orden y límites

1. Terminar y revisar `TRANSFER-REVIEW-1`.
2. Ejecutar `REGISTER-POLISH-1`.
3. Ejecutar `MARKET-VIEWS-1`.
4. Retomar `ADMIN-TRUTH-1` y el resto del roadmap.

Las dos piezas son correcciones de calidad del MVP ya existente. No habilitan
Railway, Mercado Pago, datos remotos ni red-team profundo.
