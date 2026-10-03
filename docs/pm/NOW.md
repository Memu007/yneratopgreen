# Estado actual

Actualizado: 2026-10-03.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Relevo de PM (03/10, D10):** la PM sigue en una sesión nueva, abierta sobre este repositorio. Un solo PM escribe `PARA-DEV.md`. Arrancar por `ONBOARDING-PM.md`: las herramientas de PM están en `docs/pm/herramientas/` y los comandos en `.claude/skills/` (`/revisar-entrega`, `/como-venimos`). PM no deja loop: retoma con el «respondió» de Emi (confirmado por Emi, 03/10). **D9 decidido (Emi, 03/10: «lo que vos digas»):** la auditoría de seguridad final la hace un revisor distinto de la PM y la Dev (otro modelo o Astra), como dice `PLAN-RED-TEAM-CIERRE-MVP.md`. En piezas de dinero, sesión, permisos o datos, un subagente adversarial («Subagentes adversariales» en `ONBOARDING-PM.md`).
- **Espera a Emi (03/10), en orden de urgencia:**
  1. verificar en el celular lo publicado en `e5d592e` («¿Te interesa alguno?» al final de Inicio);
  2. UptimeRobot (lo crea Emi, sin código);
  3. Mercado Pago, etapa 1 (`PASOS-MERCADO-PAGO-2026-09-30.md`);
  4. mostrarle a la clienta la maqueta v3 de Inicio y hacer la reunión: categorías, «Producción», «Origen y Destino», clasificación automática fuera del MVP;
  5. crear la cuenta de la clienta, el teléfono de contacto (abajo), el correo (#15), `FRONTEND_URL`, backups en producción y Railway antes del 01/12 (abajo).
- **Próximo control de PM: 15/10.** Si la Dev no entregó al menos hasta `FILTROS-VISUAL-1`, la cola va atrasada para el congelamiento (~27/10): proponerle a Emi un segundo dev sólo para lo visual, o pasar `CUENTA-VISUAL-1` a después del lanzamiento. Lanzamiento: 12/11.
- **Fase contractual:** Fase 3 — Buscador y catálogo, semanas 6–8 (25/09–15/10). La puerta de la Fase 2 quedó verificada el 23/09 (`REPRODUCCION-FASE-2-2026-09-23.md`). La puerta de la Fase 3 y el hito intermedio ya se aceptaron por adelantado con `npm run hito` (cierre `3580faa`, ver `MATRIZ.md`). Presentarlo a la clienta y facturarlo es decisión comercial de Emi. Las fechas no cambian.
- **`main`:** `e5d592e`, publicado el 03/10 con autorización de Emi («Te autorizo»), por fast-forward desde `4085a9a`. Suma `INICIO-CIERRE-CELULAR-1` (en el celular, «¿Te interesa alguno?» cierra Inicio) y el agregado de `MARCAS-PANEL-1` («Editar» muestra el nombre de una marca dada de baja; `/products/my` suma `brand_label`). Sin migraciones. La verificación previa fue sobre el mismo código (`6a96b0d`, que difiere sólo en `docs/pm`): suite 238/240 (169 de entorno y 204 por una carrera del caso), veinte negativos en rojo, puertas verdes, sin secretos ni archivos prohibidos. **Falta que Emi lo verifique en el celular.** Antes, `4085a9a` sumó `MARCAS-PANEL-1`, verificado por Emi (02/10).
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`. `CAMBIAR-CONTRASENA-1` está publicada en `c21fb9d`. `SESIONES-AL-CAMBIAR-1` está publicada en `d6fa79b`. `FILTROS-DE-PUBLICACIONES-1` está publicada en `dc377d9`. `MARCAS-PANEL-1` está publicada en `4085a9a`. `INICIO-CIERRE-CELULAR-1` está publicada en `e5d592e`.
- **Última decisión PM:** `INICIO-CIERRE-CELULAR-1` y el agregado de `MARCAS-PANEL-1` **ACEPTADOS EN RAMA** (03/10, `6a96b0d`). En el celular, «¿Te interesa alguno?» cierra Inicio y el crédito queda junto a las tarjetas; en la computadora no cambia. «Editar» muestra el nombre de una marca dada de baja. Caso 240; veinte negativos en rojo (dos de PM); suite 238/240 (169 de entorno y 204 por una carrera del caso, ya en `main`); puertas verdes. Evidencia en `REPRODUCCION-INICIO-CIERRE-CELULAR-1-2026-10-02.md`.
- **Tarea activa:** `AVISOS-1`, con un agregado chico (la espera del 204 y el paso 28 de la guía del panel). En cola: `CONTROLES-AUTOMATICOS-1`, `CONFIABILIDAD-API-1`, `FILTROS-VISUAL-1`, `VENDER-SIN-SESION-1`, `PRODUCCION-ANIMAL-1`, `BUSCADOR-SINONIMOS-1`, `MERCADO-FICHA-VISUAL-1`, `CUENTA-VISUAL-1` y `OBSERVABILIDAD-1`. **En espera de la clienta:** la maqueta v3 de Inicio.
- **Proceso (03/10, Emi con la Dev):** la Dev usa `/respondio`, `/entregar` (con revisión independiente del diff) y un loop de espera de ~30 min. **Emi decidió (03/10):** PM no deja loop y sigue con su «respondió» (1A, por costo); y sí a los controles automáticos rápidos en GitHub en cada push (2A, D7), sin la suite completa semanal: es `CONTROLES-AUTOMATICOS-1`. **Emi (03/10):** PM corre con Opus 5.5 en esfuerzo alto y la Dev con Opus 5.5 en esfuerzo medio. Las dos le avisan cuándo compactar, con el `/compact` y lo que hay que conservar; se cambia de chat cuando, aun compactando, se pierde contexto. La regla va a `AGENTS.md`, «Eficiencia de chats», pedida a la Dev en `PARA-DEV.md`. **Subagentes (Emi, 03/10, opción 1):** sólo en piezas de dinero, sesión, permisos o datos; el adversarial de PM corre con Opus o Sonnet según la tarea; Fable no se usa para subagentes. La Dev sigue con el suyo antes de entregar, como autorrevisión. Regla en `ONBOARDING-PM.md`, «Subagentes adversariales».
- **Mercado Pago:** `LINK-ABIERTO-DEVUELTO-1`, que iba antes de la prueba, está publicada (01/10). **Mercado Pago (Emi, 30/09): se prueba en el sitio publicado, con cuentas de prueba.** Los pasos están en `PASOS-MERCADO-PAGO-2026-09-30.md`: etapa 1, preparar (Emi, en Railway y en el panel de Mercado Pago); etapa 2, probar, guiada por PM. Los valores secretos van directo a Railway, nunca al chat. **Hipótesis por confirmar en la prueba:** vincular una cuenta de Mercado Pago necesita una cookie del Backend, y con el sitio y el Backend en dos direcciones de `up.railway.app`, Safari, Brave y Firefox no la mandan. Si se confirma, el lanzamiento real necesita un dominio propio. Emi aprobó el costo del Reconciliador el 29/09.
- **Corrección de método PM (25/09):** las aceptaciones de la marca no verificaron la carga de datos en producción. Desde ahora, toda pieza que agrega una lista o un catálogo tiene que decir cómo llega a producción, y PM lo comprueba con un caso sobre una base sin siembra.
- **#9, atributos por rubro: absorbido (decisión de Emi, 25/09).** Tercer nivel de la taxonomía de la clienta como filtro en todos los rubros, potencia de tractores, modelo y año en maquinaria, y origen declarado por quien vende. «Inversores» queda afuera. Va después de `MERCADO-UNICO-1` y antes de las guías de uso.
- **Devolución de la clienta del 01/10 (por Emi), sobre el buscador.** Su prototipo está en `originales/BUSCADOR-AGROMARKET-CLIENTA-2026-10-01.html`.
  - **Marcas:** en Tractores el filtro ofrece todas las marcas, también las que no tienen publicaciones. Ella quiere que el filtro salga de las publicaciones: sólo las marcas que alguien publicó, y una marca nueva que alguien escriba tiene que aparecer sola. Esto contradice la decisión de Emi del 25/09, «el filtro muestra las 44».
  - **«Tecnologizar»** en «Cómo funciona» va «Tecnificar».
  - **Categorías:** «Bienes y Ganado» no va, según ella, pero está en el contrato firmado el 28/07. La hacienda puede ser de cualquier especie. Pide distinguir el tipo de producción, agrícola o pecuaria, y revisar «Origen y Destino» en «Producción». **Lo quiere ver en una reunión.**
  - **Emi (01/10):** las marcas y «Tecnificar» van sin reunión, en `FILTROS-DE-PUBLICACIONES-1`, después de `SESIONES-AL-CAMBIAR-1`. Las categorías y «Origen y Destino» esperan la reunión.
- **Emi, 02/10, sobre «Mi cuenta»:** «No me gustan los efectos de UX cuando cambian. No me gusta el diseño. Está muy genérico.» PM coincide: «Mi cuenta» es la parte más vieja del sitio. Son cajas apiladas con encabezados de colores, y Mercado Pago va en azul. No usa el lenguaje de Inicio. PM propone una maqueta antes de programar. Emi precisó (02/10) que lo que le molesta son los avisos: «Esas notificaciones están feas». PM armó `maquetas/AVISOS-V1-2026-10-02.html` (y `.jpg`), con la comparación de hoy y la propuesta, Emi rechazó la v1 («siguen siendo genéricas»). PM investigó cómo se usan hoy (Sonner, Vercel, Linear) y armó `maquetas/AVISOS-V2-2026-10-02.html`, con dos opciones: A, píldora verde de la marca, y B, tarjeta casi negra. **Emi eligió la A** (02/10), y es `AVISOS-1`. Pidió lo mismo para los filtros: la maqueta `maquetas/FILTROS-V1-2026-10-02.html` **la aprobó Emi (02/10)**, y es `FILTROS-VISUAL-1`. Emi pidió el mismo trabajo en todo lo que se ve genérico («hagamos las otras, que llegamos»). PM armó `maquetas/MERCADO-FICHA-V1-2026-10-02` (tarjetas y página de la publicación) y `maquetas/CUENTA-V1-2026-10-02` (ingresar, carrito y Mi cuenta), y **Emi las aprobó (02/10)**: son `MERCADO-FICHA-VISUAL-1` y `CUENTA-VISUAL-1`. Ninguna suma funciones.
- **Documento de la clienta «indexación» (02/10, por Emi).** Está en `originales/INDEXACION-CLIENTA-2026-10-02.docx`. Lectura de PM:
  - **Compatible con lo hecho:** «Producción animal» en lugar de «Bienes y Ganado», con especies. Es la misma familia del contrato, más amplia. También los filtros que salen de lo publicado (`FILTROS-DE-PUBLICACIONES-1`) y el formulario estándar con campos por rubro.
  - **Fuera del MVP:**
    - publicar sin elegir categoría;
    - la clasificación automática y la búsqueda que «interpreta» frases, que piden inteligencia artificial, costo y moderación;
    - los tipos «Compra» y «Disponibilidad»;
    - la familia «Producción» con vegetal, forestal y acuícola. El contrato pide filtros por categoría y ubicación.
  - **Puente barato propuesto:** un buscador de texto que entienda acentos, plurales y sinónimos, por ejemplo que «colmena» encuentre «apicultura».
  - **Emi (02/10):** van ahora `PRODUCCION-ANIMAL-1` y `BUSCADOR-SINONIMOS-1`. Lo de afuera del MVP se cotiza aparte. «Producción» va a la reunión.
- **Devolución de la clienta del 30/09, después de la presentación (por Emi):** quedó muy contenta. Pidió:
  - **sacar «Quiénes somos»** (el menú, el pie y la página); con eso también dejan de hacer falta misión y visión (#12) y lo que quedaba de «Nuestro equipo»;
  - **que Inicio muestre el ecosistema y no sólo el mercado:** los servicios que van más allá del Mercado —trazabilidad, noticias del agro, charlas, entre otros—, aunque muchos queden fuera del MVP, para que se entienda el proyecto. Es la decisión #10, que Emi había dejado para más adelante el 27/09;
  - **usar el texto de su prototipo** (`originales/PROTOTIPO-AGROCORE-V3_1-2026-09-30.html`) en vez del de hoy.
  PM propuso mostrar lo que viene como «Próximamente», separado de lo que funciona hoy: el texto del prototipo describe funciones que el sitio no tiene, y la clienta ya había marcado «promete de más» (#14). **Emi eligió eso (30/09)**, con todos los servicios que vienen después del MVP, porque se van a hacer y la clienta quiere mostrarlos. La propuesta de texto de PM es un documento para que Emi se lo muestre a la clienta: «Inicio de AgroBoeda: propuesta de texto» (https://claude.ai/code/artifact/77d55a7a-7fe9-4e84-810a-2cfa3c30a3eb). Cuando la clienta responda sus cuatro preguntas, va a la Dev como una pieza, junto con sacar «Quiénes somos».
  **Versión 2 (30/09), por pedido de Emi** («sigue quedando primero lo otro», «algo más tipo Agrofy»): el ecosistema va primero, una tarjeta con foto por servicio, y el Mercado es una más, la única «Disponible hoy»; sale el bloque aparte del Mercado. Sigue lo que decidió la clienta el 20/09: Inicio no muestra publicaciones, sólo cuántas hay. El documento quedó en versión 2, con las mismas cuatro preguntas salvo Mercado Pago, que se cambió por las fotos. La maqueta está en `maquetas/INICIO-ECOSISTEMA-V2-2026-09-30.html` y usa las fotos y fuentes de `public/`. Dos fotos son CC BY 2.0 (`muestreo-suelo-recomendacion-fertilizacion`, `sensores-humedad-suelo-iot`): si quedan, la tarea tiene que pedir el crédito.
  **Emi la aprobó y pidió programarla (30/09), sin esperar las respuestas de la clienta:** es `INICIO-ECOSISTEMA-1`, con crédito para las dos fotos CC BY. Si la clienta pide cambios, van en una pieza chica aparte.
- **Devolución de la clienta del 20/09 — estado (27/09):**
  - publicados: #1, #7, #8 y #9; y el 27/09 (`a7e2237`), #2, #3, #4, #6, #11a, #13, #14 y sin «comisión» visible;
  - **respuestas de Emi (27/09, en `DECISIONS.md`):** #5 lo habla Emi con la clienta; #10 no se trabaja por ahora; #12 espera el texto de la clienta; #11b, retener fondos no se hace y ya se le explicó. Cómo se explica que AgroBoeda cobra sigue sin decidir; hoy el sitio no lo menciona;
  - **logística en los filtros:** Emi quiere mejorarla; la pieza está por definir. **Publicaciones de prueba (opción 1, Emi, 27/09):** se cargan a mano en el sitio publicado, sin fotos, con cuentas creadas desde el panel. La lista y lo que tiene que mostrar cada filtro están en `PUBLICACIONES-DE-PRUEBA-2026-09-27.md`. La parte del transportista espera el correo, porque un transportista sólo se crea registrándose. Hoy la logística vive en dos lugares que no se conectan: la publicación de logística y la cuenta de transportista que se elige al comprar;
  - **#15, el correo:** Emi propone empezar con una cuenta de Gmail propia mientras la clienta arma la casilla en DonWeb. El código lo admite sin cambios (SMTP con STARTTLS en el 587). Dos trabas de Railway, que valen también para DonWeb: según su documentación, el SMTP saliente sólo está habilitado en el plan Pro (PM no pudo abrir la página: lo vio en el buscador y en el foro de Railway). Emi dice que su plan es el de unos 20 USD, que es el Pro; la prueba de registro lo confirma, y el 13/09 `FRONTEND_URL` apuntaba al dominio viejo, así que el enlace no llevaría al sitio. Según ese inventario el sitio usa `outbox`: dice que mandó el correo y no lo manda. Mientras tanto, una cuenta creada desde el panel entra sin confirmar el correo.

  El #3 quedó sin asignar entre el 20/09 y el 27/09 por un descuido de PM.
- **Escalado a Emi:** la regla «el teléfono no sale de la API sin suscripción activa» choca con la decisión del 05/08, que pasó suscripciones y candados por plan a Fase 6. Hoy el teléfono no se publica en el Mercado ni en las fichas, pero sí lo ven las dos partes de una orden y quien compra al elegir transportista, sin suscripción. El transportista no recibe el de quien compra.

## Aceptaciones anteriores

Cada pieza tiene su evidencia en `docs/pm/REPRODUCCION-<PIEZA>-<fecha>.md` y
su fila en `ROADMAP-CIERRE-MVP-2026-08-31.md`. No se transcriben acá. Los
riesgos que dejaron abiertos están en «Pendientes canónicos adoptados».

| Pieza | Estado | Evidencia |
|---|---|---|
| `INICIO-CIERRE-CELULAR-1` y agregado de `MARCAS-PANEL-1` | publicadas en `e5d592e` | `REPRODUCCION-INICIO-CIERRE-CELULAR-1-2026-10-02.md` |
| `MARCAS-PANEL-1` | publicada en `4085a9a` | `REPRODUCCION-MARCAS-PANEL-1-2026-10-02.md` |
| `FILTROS-DE-PUBLICACIONES-1` | publicada en `dc377d9` | `REPRODUCCION-FILTROS-DE-PUBLICACIONES-1-2026-10-02.md` |
| `SESIONES-AL-CAMBIAR-1` | publicada en `d6fa79b` | `REPRODUCCION-SESIONES-AL-CAMBIAR-1-2026-10-02.md` |
| `CAMBIAR-CONTRASENA-1` | publicada en `c21fb9d` | `REPRODUCCION-CAMBIAR-CONTRASENA-1-2026-10-01.md` |
| `INICIO-ECOSISTEMA-1` | publicada en `30f9791` | `REPRODUCCION-INICIO-ECOSISTEMA-1-2026-10-01.md` |
| `PAGO-ORDEN-CERRADA-1` | publicada en `65457cc` | `REPRODUCCION-PAGO-ORDEN-CERRADA-1-2026-09-28.md` |
| `COBRO-CONCURRENTE-1` | publicada en `58bb62b` | `REPRODUCCION-COBRO-CONCURRENTE-1-2026-09-28.md` |
| `AVISOS-DE-PAGO-1` | publicada en `a7e2237` | `REPRODUCCION-AVISOS-DE-PAGO-1-2026-09-27.md` |
| `NOTIF-TEXTOS-1` | publicada en `a7e2237` | `REPRODUCCION-NOTIF-TEXTOS-1-2026-09-27.md` |
| `PUBLISH-FIELDS-1` y `REV1-PENDIENTES-1` | publicadas en `a7e2237` | `REPRODUCCION-PUBLISH-FIELDS-1-Y-REV1-PENDIENTES-1-2026-09-27.md` |
| `USER-GUIDE-1` | publicada en `c92c0d7` | `REPRODUCCION-USER-GUIDE-1-2026-09-26.md` |
| `ATRIBUTOS-RUBRO-1` parte 2 | publicada en `c92c0d7` | `REPRODUCCION-ATRIBUTOS-RUBRO-1-P2-2026-09-26.md` |
| `PROD-LISTS-1` | publicada en `238d113` | `REPRODUCCION-PROD-LISTS-1-2026-09-26.md` |
| `ATRIBUTOS-RUBRO-1` parte 1 | publicada en `792d709` | `REPRODUCCION-ATRIBUTOS-RUBRO-1-P1-2026-09-25.md` |
| `MERCADO-UNICO-1` | publicada en `792d709` | `REPRODUCCION-MERCADO-UNICO-1-2026-09-25.md` |
| `COPY-AGRO-1` | publicada en `792d709` | `REPRODUCCION-COPY-AGRO-1-2026-09-25.md` |
| `BRAND-LOSS-1` | publicada en `e9cf4c6` | `REPRODUCCION-BRAND-LOSS-1-2026-09-25.md` |
| `ADMIN-PANEL-DEFECTS-1` | aceptada en rama | `REPRODUCCION-ADMIN-PANEL-DEFECTS-1-2026-09-24.md` |
| `ADMIN-GUIDE-1` | aceptada en rama | `REPRODUCCION-ADMIN-GUIDE-1-2026-09-24.md` |
| `LOCALITY-LABEL-DISPLAY-1` | aceptada en rama | `REPRODUCCION-LOCALITY-LABEL-DISPLAY-1-2026-09-24.md` |
| `LOCALITY-DEDUP-1` | aceptada en rama | `REPRODUCCION-LOCALITY-DEDUP-1-2026-09-24.md` |
| `FILTER-COLLAPSE-FOCUS-1` | aceptada en rama | `REPRODUCCION-FILTER-COLLAPSE-FOCUS-1-2026-09-24.md` |
| `PRODUCT-DETAIL-BACK-SEARCH-1` | aceptada en rama | `REPRODUCCION-PRODUCT-DETAIL-BACK-SEARCH-1-2026-09-23.md` |
| `FICHA-MOBILE-WIDTH-1` | aceptada en rama | `REPRODUCCION-FICHA-MOBILE-WIDTH-1-2026-09-23.md` |
| `MOBILE-CHECKOUT-1` | aceptada en rama | `REPRODUCCION-MOBILE-CHECKOUT-1-2026-09-23.md` |
| `MOBILE-AUDIT-FLOW-1` | aceptada en rama | `REPRODUCCION-MOBILE-AUDIT-FLOW-1-2026-09-23.md` |
| `PRODUCT-DETAIL-PAGE-1` | aceptada en rama | `REPRODUCCION-PRODUCT-DETAIL-PAGE-1-2026-09-23.md` |
| `ADMIN-MOBILE-ACCESS-1` | aceptada en rama | `REPRODUCCION-ADMIN-MOBILE-ACCESS-1-2026-09-23.md` |
| `CART-PRODUCT-QUERY-1` | aceptada en rama | `REPRODUCCION-CART-PRODUCT-QUERY-1-2026-09-22.md` |
| `CART-IMG-QUERY-1` | aceptada en rama | `REPRODUCCION-CART-IMG-QUERY-1-2026-09-22.md` |
| `PRIMARY-IMAGE-INTEGRITY-1` | aceptada en rama; trae migración, espera la puerta de recuperación | `REPRODUCCION-PRIMARY-IMAGE-INTEGRITY-1-2026-09-22.md` |
| `RISK-REC-1` | publicada en `0bd7fbc` | `REPRODUCCION-RISK-REC-1-2026-09-21.md` |
| `CAT-PAGE-1` | publicada | `REPRODUCCION-CAT-PAGE-1-2026-09-14.md` |
| `POST-INTEGRATION-CLEAR-1` | publicada | `REPRODUCCION-POST-INTEGRATION-CLEAR-1-2026-09-14.md` |
| `INTEGRATION-CANDIDATE-1` | integrada por `b8447a3` con autorización de Emi del 13/09 | la sección siguiente |

## Estado de integración

La composición candidata queda **aceptada** en `c565e6e`. La evidencia independiente PM se compone sin ocultar los SHA:

- suite completa desde base Docker limpia sobre `e0cdfe9`: **168/169**; 114, 131, 167 y 168 pasaron, y el único rojo fue el caso 169 por exigir una API nativa simultánea;
- durante esa suite, después del 134, `topgreen-api` cambió de PID `65908` a `89335` y de `StartedAt=2026-09-13T12:49:48.468708656Z` a `2026-09-13T13:02:32.238270514Z`; el reinicio Docker fue real;
- Git demuestra que `c565e6e` sólo cambia el caso 169 respecto de `e0cdfe9`; no toca producto ni los casos 1–168. `ad914a3` agrega únicamente el informe;
- focal 169 PM sobre `c565e6e`, desde otra base Docker limpia: **1/1**. Los tres negativos rechazaron identidad sin cambio, servicio no identificable y puerto servido por otro proceso; el camino real cambió `topgreen-api` de PID `45076` a `45360` y también cambió `StartedAt`;
- sintaxis de `smoke.mjs` y `diff-check`: verdes. A11y y contraste ya habían quedado verdes en `e0cdfe9` y no se repitieron porque el delta R3 sólo toca el caso 169.

La suma de la corrida completa y el focal sobre el único delta cubre los **169
casos** de la candidata final. La evidencia durable son los SHA, resultados y
negativos anteriores; los logs locales fueron apoyo de revisión y no son una
dependencia recuperable del cierre.

La composición aceptada quedó cerrada en `4c8569d`, que combina `main` `615619c`
con la candidata `8e20b06` sin abrir alcance nuevo. El `diff-check` y el build de
producción quedaron verdes antes del push.

`main` continúa conectado al auto-deploy de ambos servicios sin esperar CI. Emi
autorizó la publicación de `0bd7fbc` el 2026-09-21 y Frontend/Backend
convergieron saludables en esa revisión. Esto acepta el despliegue demostrativo,
no el lanzamiento contractual: siguen pendientes la separación
`main = integración aceptada` / `release = producción`, backups, SMTP,
secretos, pagos y recuperación.

## Operación de marcas y filtros — estado

Las decisiones están firmadas en `PROPUESTA-BUSQUEDA-FACETADA.md`. PM reprodujo
la composición `34e7ebf` en Docker y cerró la revisión independiente:

- **Etapa 1** (condición nuevo/usado): `da69fe4`/`e798c85`, **aceptada**.
- **Etapa 2** (la marca como dato, con migración): `ed3e39f`/`4bdfc71`,
  **aceptada**.
- **Lista de marcas:** decidida por PM en 44. Se fusionan Fiat/Fiat
  Someca/Someca y Chery/Chery Bylion; Case/Case IH y Deutz/Deutz-Fahr quedan
  separadas. `chery` es el superviviente decidido por Emi. Implementada en
  `89b20aa`/`020e907` y aceptada.
- **Etapa 3** (la marca como filtro y faceta): aceptada en `8e20b06`; caso 175 PM **1/1** y tres negativos discriminantes rojos. Jacto no se agregó porque no existe entre las 44 marcas decididas; el seed declara sólo John Deere y Pauny.

Evidencia: `REPRODUCCION-FILTROS-MARCAS-2026-09-20.md`.

## Pendientes canónicos adoptados

- **Relevo:** cerrado en `b8447a3`; `main` contiene el disparador consolidado y
  la regla local de eficiencia de chats.
- **Carrito conservado y FAQ de pagos:** cerrados en `eb62d3d`/`a7ed544`,
  integración local `c973c6f`, incluidos en `4c8569d` y presentes en el runtime
  convergente `0bd7fbc`.
- **Backup/restauración local:** `BACKUP-RESTORE-1` quedó aceptada en
  `52ba294`/`b8223b1` e integrada por `fbd6caf`. El ensayo Docker real recuperó
  base, `uploads`, `documentos` y `outbox` en un destino aislado; una alteración
  fue detectada y recursos homónimos sin las dos etiquetas sobrevivieron. Esto
  cierra el procedimiento local, no crea todavía una copia administrada o
  externa de producción ni habilita migraciones riesgosas.
  Evidencia: `REPRODUCCION-BACKUP-RESTORE-1-2026-09-13.md`.
- **Índice único parcial sobre la imagen primaria:** aceptado en rama con
  `PRIMARY-IMAGE-INTEGRITY-1`; no integrado ni desplegado. La migración limpia
  duplicados de forma determinista y PostgreSQL impide recrearlos.
- **N+1 de imágenes del carrito:** aceptado en rama con
  `CART-IMG-QUERY-1`; GET y sync leen `product_images` una vez por petición.
- **N+1 de publicaciones del carrito:** `CART-PRODUCT-QUERY-1` aceptada en
  rama; el caso 181 comprueba una lectura de `products` por petición en GET,
  sync con carrito y sync que lo crea. No integrada ni desplegada.
- **`categories.usa_marca` no se edita desde el panel:** viaja sólo de salida.
  Ampliar la marca a otra categoría es hoy SQL o migración, no una acción de la
  clienta, y el encabezado de `marcas.py` afirma lo contrario. Además el panel
  deja cambiar `is_service` sin apagar `usa_marca`, y la guarda que lo impide
  es de semilla, no de runtime. Sin bloqueo; queda registrado.
- **Señal estable de cuenta sin confirmar:** el Login ofrece el reenvío hoy,
  pero reconoce una frase del rechazo. No se amplía Auth dentro de
  `RISK-REC-1`; el caso 177 vigila la dependencia hasta que se abra una decisión
  propia.
- **P1 — Mercado Pago cuelga la API con tres confirmaciones a la vez:** el
  webhook y la vuelta de quien compra toman la fila de la orden con
  `FOR UPDATE` y esperan a Mercado Pago con la fila tomada; otra confirmación
  pide la misma fila con una llamada síncrona y frena el único proceso de la
  API. PM lo reprodujo sobre `c6792ff` y sobre el producto de `2e86854`
  (caso 213). **Resuelto por `COBRO-CONCURRENTE-1`, publicado en
  `58bb62b` el 28/09.** Queda un P2: si Mercado Pago falla dos veces en el
  mismo barrido, el reconciliador reintenta apagar el link con la fila de la
  publicación tomada, y una compra de esa publicación puede frenar la API
  hasta 15 s. Va con la pieza del pago a una orden cerrada.
- **Seguridad — contraseñas escritas en chats (28/09):** la de administración
  de Emi y la de `prueba@example.com` quedaron en el chat de PM y en el de la
  Dev. Cambiarlas queda pendiente por decisión de Emi: la suya con el programa
  de la consola que PM probó en local, y la de prueba desde el panel con
  «Restablecer contraseña».
- **Seguridad — credenciales de prueba de Mercado Pago en el chat (30/09):**
  Emi pegó en el chat de PM el Access Token de las credenciales de prueba, y
  su captura del panel mostraba parte de la contraseña del usuario de prueba.
  No se guardaron en ningún lado. Son de prueba: no mueven plata. El código no
  usa ese token (`MP_ACCESS_TOKEN` no se lee fuera de la configuración): cobra
  con la cuenta de cada vendedor, vinculada por OAuth. Las credenciales de
  producción no pasan nunca por un chat.
- **Railway — Config as Code en desuso, con corte el 01/12/2026:** según la
  documentación de Railway (confirmado por el buscador, sin que PM ni la Dev
  lleguen a la página), `/railway.toml` (Frontend) y `/backend/railway.toml`
  (Backend) dejan de aplicarse el 01/12/2026. Ahí están el Dockerfile, la
  migración antes de desplegar, el chequeo de salud y las rutas vigiladas. El
  reemplazo es `.railway/railway.ts` (`railway config migrate`) o cargarlo en
  el panel. **Pieza propia antes de esa fecha**, y alguien que llegue a
  `docs.railway.com` la confirma. El buscador suma (29/09, de issues de
  terceros, no de la documentación): un servicio nuevo ignora el archivo y
  Railway rechaza fijarle la ruta; sin migrar, en el despliegue siguiente al
  corte se pierden el comando de inicio, el chequeo de salud y la política
  de reinicio. El reconciliador ya va sin archivo.
- **Antes de habilitar Mercado Pago — orden de un vendedor desvinculado
  (PM, 29/09; resuelto en rama por `DESVINCULAR-CON-COBROS-1` el 30/09, sin publicar):** si un vendedor desvincula su cuenta con una orden de
  Mercado Pago abierta, la orden queda reservada hasta que vuelva a
  vincular. El reconciliador no puede preguntarle a Mercado Pago sin el
  token, y `/mp-oauth/unlink` no pregunta por órdenes abiertas. Viene de
  antes; en la base local quedaron 7 así. Se decide antes de encender el
  cobro.
- **Antes de habilitar Mercado Pago — link abierto de un pago devuelto (PM, 30/09):**
  un pago devuelto o con contracargo cuyo link no se pudo apagar queda fuera
  del criterio de cobros en curso y del reconciliador, y el link queda
  abierto. Pide dos fallas seguidas al apagarlo; leído en el código por la
  Dev, sin reproducir. Pieza chica: que el link abierto mire los cuatro
  estados con cobro.
- **P3 — contraseñas (PM, 28/09):**
  - ingresar con una contraseña de más de 72 bytes da un error 500 en vez de
    «contraseña incorrecta», porque bcrypt no acepta más;
  - nadie puede cambiar su propia contraseña desde la pantalla. La API tiene
    `/auth/change-password`, pero ninguna pantalla lo usa, y el panel no deja
    restablecer la propia.
- **Pago que llega a una orden ya cerrada:** resuelto por
  `PAGO-ORDEN-CERRADA-1`, publicado en `65457cc` el 29/09.
- **P1 para habilitar Mercado Pago — el reconciliador no está programado:**
  lo dice `reconciliar.py`, y no figura en `RAILWAY.md`. Sin barridos, las
  reservas de las órdenes que nadie paga no vencen. Además, el link que no se
  pudo apagar queda abierto: desde `PAGO-ORDEN-CERRADA-1`, apagarlo se
  reintenta sólo en el barrido siguiente. Programarlo es un cambio de Railway:
  pide tarea explícita y autorización de Emi.
- **Devolución concurrente de stock:** cancelar o rechazar una orden pagada aún
  usa lectura y escritura en Python. Dev no reprodujo pérdida en 6 rondas porque
  esos endpoints hoy se ejecutan sin intercalarse; queda como riesgo de diseño,
  no como bug confirmado ni tarea abierta.

## Producción — cuentas (28/09)

- La primera cuenta de administración la creó Emi el 28/09, con un programa en
  la consola del Backend que PM probó antes en local. En la misma pasada creó
  la cuenta de prueba `prueba@example.com`, rol usuario y ya confirmada.
- Con la cuenta de administración, Emi puede crear cuentas desde el panel, y
  esas cuentas entran sin confirmar el correo. Así la clienta puede hacer su
  segunda revisión sin esperar al #15.
- La Dev vio producción respondiendo `revision 58bb62b` el 28/09: el
  despliegue de `COBRO-CONCURRENTE-1` llegó.

## Railway — inventario actualizado 2026-09-13 y deuda viva

Inventario de sólo lectura del proyecto `strong-playfulness`, entorno `production`:

- servicios en línea: Frontend `yneratopgreen`, Backend `Backend` y base `PostGIS`;
- Frontend y Backend toman `Memu007/yneratopgreen`, rama `main`, con auto-deploy activo y `Wait for CI` apagado;
- Frontend público `https://yneratopgreen-production.up.railway.app` y Backend público `https://backend-production-ba84.up.railway.app` convergieron en `0bd7fbc` el 2026-09-21; ambos respondieron saludables después del recambio;
- los watch paths siguen separados (`src/public/...` para Frontend y `backend/**` para Backend), por lo que Railway puede publicar composiciones parciales en cambios futuros aunque esta publicación haya convergido;
- `VITE_API_URL` y `VITE_IMAGES_URL` apuntan al Backend vigente;
- CORS contiene el dominio histórico y el dominio público actual, pero `FRONTEND_URL` todavía apunta al dominio histórico `ynerav.up.railway.app`; queda como deuda de configuración, sin corregir en este inventario;
- Backend usa almacenamiento local con volumen `backend-volume` de 5 GB montado en `/data`; `UPLOAD_DIR=/data/uploads` y `EMAIL_OUTBOX_DIR=/data/outbox` quedan persistentes allí;
- PostGIS tiene `postgis-volume` de 5 GB montado en `/var/lib/postgresql/data`;
- no hay backups/PITR activos sobre la base productiva. La restauración local ya fue ejercitada con datos sintéticos mediante `BACKUP-RESTORE-1`; falta elegir y activar una copia externa o administrada antes de tratar el entorno como producción aceptada o hacer una migración riesgosa;
- `MP_CHECKOUT_HABILITADO=false`, verificado sin exponer secretos.

Este inventario de configuración es del 13/09; el runtime se verificó por
última vez el 21/09. El 23/09, el CLI de Railway respondió `Unauthorized`, así
que los backups y ajustes actuales requieren una nueva lectura autenticada.
La propuesta PM para la migración aceptada está en
`PROPUESTA-RECUPERACION-PRE-MIGRACION-2026-09-23.md`, pendiente de decisión de
Emi. No se infiere el costo real desde el tamaño nominal de los volúmenes.

El 2026-09-11 se corrigió el incidente CORS que producía `Failed to fetch`; el inventario confirma que el dominio actual sigue permitido. No se cambió Railway, código, datos ni pagos durante esta revisión.

Runtime no es sólo SHA: CORS, SMTP, dominios y variables pueden romper una composición correcta. Todo cambio operativo debe quedar registrado sin secretos.

## Mercado Pago — pendiente externo

El código de checkout existe, pero la homologación real no está cerrada.

Dos intentos controlados anteriores no demostraron el flujo porque el OAuth enlazó un usuario real de Emi en lugar de un vendedor de prueba. No se ejecutó pago.

Falta demostrar, con **vendedor de prueba correcto + comprador de prueba**:

- pago aprobado;
- webhook firmado;
- decremento de stock exactamente una vez;
- rechazo/cancelación segura;
- reconciliación/expiración según el flujo definido.

Adquirir las cuentas/credenciales de prueba es dependencia humana. No enlazar OAuth, habilitar la bandera ni ejecutar pagos hasta que la PM abra formalmente esa ejecución y Emi autorice el paso correspondiente.

## Producción — puertas pendientes

De la puerta contractual completa, hoy siguen vivos estos bloqueos:

- política de ramas/deploy que separe integración aceptada de producción;
- una copia externa o administrada de producción y su política de retención; el procedimiento de restauración local ya fue ensayado, pero persistencia y un script sin copias programadas no sustituyen backup;
- SMTP real para el flujo de validación por correo; `outbox` no satisface producción;
- configuración y secretos revisados sin exponer valores;
- homologación Mercado Pago con cuentas de prueba correctas;
- red-team final, retiro/rotación de datos y credenciales demo, y convergencia de Frontend/Backend en el SHA de release;
- documentación de despliegue, capacitación, accesos administrativos y propiedad/pago de Railway y dominio acordados.

Después de una migración de esquema no se hace rollback ciego sólo de código. La recuperación normal es forward-fix; un downgrade necesita procedimiento probado y backup recuperable.

## Medición de subagentes

Desde el 03/10 (Emi). La regla está en `ONBOARDING-PM.md`, «Subagentes
adversariales». Antecedente sin subagente de PM: en la entrega de
`INICIO-CIERRE-CELULAR-1`, la autorrevisión de la Dev encontró 9 hallazgos,
adoptó 5 y uno era un error real (P2 de «Editar»).

| Pieza | Modelo | Hallazgos | Reproducidos | Nadie más los vio |
|---|---|---|---|---|
| Cobro MP publicado (prueba, 03/10) | Sonnet | 8 | 6 (+1 parcial) | 6 |
| Sesiones publicadas (prueba, 03/10) | Opus | 7 | 4 | 4 |
| Marcas publicadas (prueba, 03/10) | Sonnet | 7 | 6 | 6 |

Evidencia de la prueba: `REPRODUCCION-SUBAGENTES-2026-10-03.md`. Qué se
hace con los hallazgos lo decide Emi (pendiente).

## Restricciones operativas

- PM sólo modifica `docs/pm/` durante el flujo normal; no implementa producto.
- Dev no integra ni despliega sin tarea explícita.
- El alcance y sus límites se consultan en `CONTRATO.md`, `ALCANCE-Y-LIMITES.md` y `DECISIONS.md`; no se duplican en este estado vivo.
- Auditorías externas son consultivas; la PM decide qué adopta.
- Un documento de auditoría no se convierte en una fuente de verdad paralela.
- `docs/PROJECT_STATUS.md` es histórico y no se usa como estado.
- Los fósiles `docs/PM_ROADMAP.md` y `docs/PM_DEV_GUIDE.md` se retiraron en la poda documental; su historia sigue en Git.
- No copiar secretos ni credenciales a documentación.

## Próxima secuencia

1. **Hecho (29/09):** Emi verificó en incógnito la ficha del John Deere de prueba (marca, modelo 5090E, año 2018, 90 HP, usado y «Dueño directo») y el Mercado: 16 con «prueba» y 5 con «Servicios». Con eso quedan verificados en producción los filtros de #7 y #9. De la devolución de la clienta quedan abiertos #15 (correo), #5 (Inicio, charla de Emi) y #12 (texto de la clienta), y la mejora de logística, por definir.
2. **Mercado Pago en el sitio publicado:** Emi hace la etapa 1 de `PASOS-MERCADO-PAGO-2026-09-30.md`; `LINK-ABIERTO-DEVUELTO-1` está publicada (01/10, `77d3d2c`); cuando Emi termine la etapa 1, sigue la etapa 2. La Dev trabaja `INICIO-ECOSISTEMA-1`. Dependen de Emi: cambiar las dos contraseñas, crearle la cuenta a la clienta desde el panel, la regla del teléfono, el correo (#15), backups y las respuestas de la clienta sobre Inicio. Después de cada publicación, Emi verifica en el sitio lo que la pieza cambió.
3. Backup: no se exige mientras Railway sea demostrativo (decisión del 25/09). Es condición del lanzamiento real.
4. Resolver SMTP del entorno antes de pedir otra revisión a la clienta: hoy no pudo registrarse y sólo revisó superficies públicas.
5. Antes de cargar datos reales o de lanzar, Emi elige el backup administrado y su costo.
6. Los atributos por rubro ya tienen datos y decisión (25/09); Inicio (#5) es `INICIO-ECOSISTEMA-1`; AgroMarket como módulo (#10) no se trabaja por ahora (27/09); Servicios (#7) quedó decidido el 25/09. La mejora de logística está por definir.
7. Mercado Pago, red-team y producción contractual permanecen en la secuencia acordada. Mercado Pago no se habilita sin programar el reconciliador; `PAGO-ORDEN-CERRADA-1` ya está publicado.
