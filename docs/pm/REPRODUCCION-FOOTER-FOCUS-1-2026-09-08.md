# Reproducción PM — FOOTER-FOCUS-1

Fecha: 2026-09-08.

## Estado

Implementación técnicamente conforme, pendiente de integración a `main`.

- Base de la entrega: `fc032e9`.
- Producto/regresión revisado: `5d3958a`.
- Informe Dev: `26eb47f`.
- `main` durante la revisión: `e759225`.

## Revisión del delta

El producto cambia sólo `src/components/Footer/Footer.module.css` y el bloque
158 de `scripts/smoke.mjs`. La regla existente de la marca pasa de
`.marca:focus-visible` a `.footer :focus-visible`, conservando el mismo token
visible y el ancho, estilo y desplazamiento globales. No cambia layout,
navegación, textos, destinos ni controles fuera del Footer.

El caso 158 descubre los controles enfocables desde el DOM, llega a ellos con
teclado y mide contraste, geometría y overflow en 1440×900, 768×1024 y
390×844. También conserva el nombre de la marca y comprueba destinos internos
y de contacto. Contra la base, Dev informó rojo discriminante de 1,00:1 en
`Publicaciones`; PM no repitió ese rojo porque el diff y el verde focal lo
hacen suficiente para esta corrección CSS.

## Evidencia PM

Corrida aislada desde un worktree del informe `26eb47f`, con Docker local
descartable:

```text
PASS 156 La identidad pública es AgroBoeda, sin renombrar lo que no es marca
PASS 158 Todo el pie muestra el foco de teclado, y el pie no se mueve al recibirlo
2/2 pasaron; 0 fallaron
```

El 158 encontró nueve controles por viewport y un peor contraste de foco de
3,9:1. El build de producción incluido en smoke pasó. También quedaron verdes
`npm run lint -- --max-warnings 0`, `node --check scripts/smoke.mjs` y
`git diff --check`.

Log persistente local:
`/private/tmp/topgreen-pm-footer-focus-156-158.log`.

No se ejecutó suite completa, contraste general, a11y total ni Backend: la
pieza sólo cambia un color de contorno acotado al Footer. No se desplegó ni se
tocaron Railway, datos remotos, pagos o secretos.

## Pendiente de cierre

`5d3958a` y `26eb47f` están en una rama que parte de `fc032e9`, no en el
`main` vigente `e759225`. La Dev debe integrarlos sin cambios, preservar la
documentación PM más nueva y demostrar que ambos SHA quedaron en la historia
de `origin/main`. No hacen falta nuevas pruebas para esa integración.
