# Reproducción PM — ADMIN-GUIDE-1, ronda 1

Fecha: 2026-09-24. Base de la tarea `238e6f7`; guía, imágenes, script y
negativos `81f40dd`; informe Dev `decbe3e` (sólo `docs/pm/PARA-PM.md`).
`main` permanece en `0bd7fbc`. **Devuelta, ronda 1 de 2**, con una sola
corrección. Sin integración ni despliegue.

## Qué se revisó

- `docs/GUIA-PANEL-ADMIN.md`: siete pestañas, 26 pasos y los límites de la
  plataforma al principio. Suscripciones, **PENDIENTE**.
- `scripts/guia-admin.mjs` comprueba tres cosas: que cada cita entre «»
  aparezca en su paso, los resultados que el recorrido tiene programados y
  un inventario de los controles por pestaña.
- `USER_MANUAL.md` reemplaza su sección de administración por un enlace a
  la guía y quita tres atajos que no existen.
- `git diff 238e6f7 81f40dd -- src backend` está vacío.

## Entorno PM

Es el mismo de las reproducciones del 23 y 24/09:

- copia aislada en `81f40dd`;
- base `postgis/postgis:16-3.4` recién creada en Docker, con siembra demo;
- API nativa y frontend de desarrollo;
- `.env` inventados;
- Chromium 141, distinto del que fija Playwright 1.62 (declarado).

## Resultados

| Verificación | Resultado |
|---|---|
| `node scripts/guia-admin.mjs` | **26/26** en escritorio y **26/26** en celular, salida 0 |
| Negativos Dev (`sabotajes_admin_guide_1.py`) | **dos rojos**: botón inventado en la guía y botón renombrado en el panel; árbol restaurado |
| Negativo PM N3: botón nuevo «Exportar lista» en «Usuarios», sin tocar la guía | **rojo**: «la pestaña «Usuarios» muestra «Exportar lista» y su sección de la guía no lo nombra» |
| Negativo PM N2: el backend deja viva la sesión de una cuenta desactivada | **rojo**: «Paso 5 … la sesión abierta sigue sirviendo: /auth/me respondió 200», y en cascada los pasos 6 y 7 |
| Negativo PM N1: tres afirmaciones falsas **sin comillas** en una copia de la guía | **VERDE, 26/26**: no se detectan (ver hallazgo) |
| Build, `node --check`, `py_compile`, diff-check con `cr-at-eol` | verdes |
| Imágenes | revisadas `ordenes-escritorio` y `usuarios-crear-escritorio`: sin contraseñas; sólo cuentas de la siembra y del script |

Las tres afirmaciones de N1:

1. **Paso 10:** «La publicación deja de verse en el Mercado» pasa a decir
   «sigue viéndose». Contradice un resultado que el propio recorrido
   comprueba.
2. **Paso 3:** «veinte cuentas por página» pasa a decir «cincuenta».
3. **Límites:** «Nadie recibe un aviso» pasa a decir «La persona recibe un
   correo con cada cambio».

## Hallazgo que devuelve la pieza

Del lado del panel, el script es discriminante: un cambio en la pantalla o
en el backend lo hace fallar y nombra el paso.

Del lado de la guía, sólo controla las citas entre «». Los resultados están
programados en el script y no se vinculan con la frase del paso que los
describe. Si alguien cambia esa frase, la guía puede decir lo contrario de
lo que el script comprueba y el script sigue en verde.

Eso no cumple dos criterios de la tarea: el 1, que el script falle y nombre
cualquier paso que no coincida con el panel, y el 2, que una afirmación
falsa deliberada lo haga fallar. También contradice la promesa de la
sección «Cómo se comprueba esta guía».

## Verificado aparte por PM

- **Teléfonos (`orders.py:530-543`, `logistics.py:195-198`):**
  - quien vende ve el teléfono de quien compra en su orden, y quien compra
    el de quien vende;
  - quien compra ve el teléfono del transportista al elegirlo;
  - el transportista no recibe el de quien compra;
  - nada de esto depende de una suscripción.

  Coincide con la guía. La regla vigente de Emi dice que «el teléfono de
  contacto no sale de la API sin una suscripción activa». Choca con la
  decisión del 05/08, que pasó suscripciones y candados por plan a la
  Fase 6. **Se escala a Emi.** La guía queda con el párrafo tal cual, con
  suscripciones marcadas **PENDIENTE**.
- **`admin123` en la guía:** es la cuenta de la siembra demo y ya estaba en
  el código. La siembra no corre con `ENV=production` (`RAILWAY.md`). La
  guía advierte que es pública y que se cambia antes de producción.

## Defectos de producto informados por Dev, registrados sin tarea todavía

| # | Defecto | Severidad |
|---|---|---|
| 1 | «Agotada» avisa «Sigue visible pero no se puede comprar.», pero la publicación sale del Mercado y su enlace da 404 | P2 |
| 2 | Quien vende ve «Activo» una publicación «Agotada» con stock | P2 |
| 3 | El detalle de la orden en el panel sale sin artículos, correo ni dirección de quien compra, y con subtotal y envío en 0 | P2 |
| 4 | Desactivar la cuenta propia muestra un error genérico en vez del motivo | P3 |

Van en la pieza siguiente al cierre de esta. La guía los describe como
están hoy y el script falla cuando se corrijan.

No se tocó `main`, Railway, backend remoto ni datos reales. Contenedor,
copia y procesos temporales se retiran al cerrar la revisión.
