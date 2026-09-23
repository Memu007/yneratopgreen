# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-MOBILE-ACCESS-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `d4ce965` |
| candidato (CSS + caso 182 + negativos) | `b2a3ba4` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** Se reproducía. En 360 y 390 de ancho, Categorías, Documentación
y Configuración quedaban detrás de un desplazamiento horizontal; las siete
secciones medían 38 px de alto y Cerrar 35 × 35. Ahora las siete se ven, en
dos renglones, con 44 px de alto como mínimo, y Cerrar mide 44 × 44. El cambio
es sólo CSS del panel, hasta 768 px; escritorio queda igual.

**Nada tuyo que decidir para aceptarla.** Una cosa para que sepas: el Cerrar
del **detalle de una orden** usa la misma clase y, además, un título largo lo
apretaba a 37,7 px de ancho. Lo incluí —es una línea, `flex-shrink: 0`—
porque es un Cerrar del mismo panel y tu criterio pide que Cerrar no baje de 44.

## Para verificar, lo mínimo

```
SMOKE_CASOS=182 node scripts/smoke.mjs
  → 1/1: «360 × 800: 7/7 a la vista, secciones de 44 px de alto como mínimo,
    Cerrar 44×44; 390 × 844: …; 768 × 1024: …; cada sección se activa con el
    dedo y con el teclado, con foco visible, y el detalle de una orden devuelve
    sección, filtro y posición»

python3 scripts/sabotajes_admin_mobile_access_1.py desplazamiento
  → [FAIL] «360 × 800: la barra desborda 295 px y deja fuera de la vista
    ["Categorías","Documentación","Configuración"]…»; deja el árbol como estaba
```

El segundo repone el comportamiento de antes en la barra. El script no toca
la base ni la API: espera a que el frontend de desarrollo sirva el CSS roto
—una condición, no un tiempo— y corre el caso. Trae otros tres negativos
(abajo). Lo demás ya lo corrí sobre `b2a3ba4`.

## Antes y después, medido en el navegador

```
                     antes                                  después (b2a3ba4)
360 × 800    barra 655 px en 360; 3 fuera de la vista      barra 360 en 360; 0 fuera
             secciones 38 de alto; Cerrar 35 × 35           secciones 44; Cerrar 44 × 44
390 × 844    barra 655 px en 390; 3 fuera de la vista      barra 390 en 390; 0 fuera
             secciones 38 de alto; Cerrar 35 × 35           secciones 44; Cerrar 44 × 44
768 × 1024   7 a la vista; secciones 43; Cerrar 40 × 40     7 a la vista; secciones 44; Cerrar 44 × 44
1440 × 900   secciones 52; Cerrar 40 × 40                   igual, sin cambio
```

En las cuatro medidas: la página no desborda a lo ancho y cero errores de
consola, antes y después. Las capturas quedaron en mi entorno; las trazas de
arriba son las del navegador, no del CSS.

El costo: en 360 y 390 la barra pasa de un renglón a dos, unos 50 px más de
alto. En 768 sigue entrando en uno.

## Qué cambió

`src/components/AdminPanel/AdminPanel.module.css` (+14 −4), dentro de la
regla de hasta 768 px:

- la barra pasa a otro renglón (`flex-wrap`) en vez de desplazarse de costado;
- cada sección ocupa el ancho que le toca en su renglón y mide al menos 44 de
  alto;
- Cerrar mide 44 × 44 y no se encoge; se quitó la regla de 480 px que lo
  achicaba a 35.

Nombres, orden, sección activa, contenido, capas, permisos y teclado no se
tocaron. Sin cambios de TSX, de tokens ni de otros paneles.

## Lo que corrí, sobre el árbol de `b2a3ba4`

Todo corrió sobre ese mismo contenido: entre las corridas y el commit no cambió
ningún archivo. La traza de «después» es sobre el commit ya hecho.

```
caso 182                                               1/1
caso 182 con el CSS anterior                           0/1: «la barra desborda 295 px…»
sabotajes desplazamiento / altura / cerrar / apretado  4/4 rojos, uno por cada parte
1–6, 21, 108, 144, 145, 146, 148, 160, 182             14/14, desde base limpia
a11y --todas                                           74/74, sin violaciones
contraste                                              82/82 mediciones, sin fallas
build · lint · tsc --noEmit · node --check             verdes
diff-check compatible con CRLF                         sin avisos
```

Los cuatro rojos: `altura` → «secciones con un blanco táctil menor a 44 × 44:
Dashboard 95×38, …»; `cerrar` → «Cerrar mide 40 × 40»; `apretado` → «el
Cerrar del detalle mide … "width":37.7». Suite completa no corrida: el cambio
no sale del alcance y no apareció ningún rojo inesperado.

Dos cosas que el caso espera, y por qué: el subrayado de la sección activa y
el anillo de foco entran con una transición de 0,2 s (`transition: all` que
ya tenía la pestaña), y el detalle de una orden entra con una escala de 0,95.
El caso espera a que terminen —condición con tope— antes de medir; sin eso
medía a mitad de camino.

## Visto y no tocado

- Dentro de Configuración, la barra de tipos de opción entra entera, pero sus
  cuatro botones miden 26 px de alto. No es la navegación de las siete
  secciones; si lo querés, es la misma solución.
- En escritorio Cerrar sigue en 40 × 40, con puntero. Llevarlo a 44 es una
  línea.
- Otros controles del panel —selects, «Ver» de cada orden, paginación— no los
  medí todos.

No toqué `main`, Railway ni datos, y no desplegué. Freno acá.
