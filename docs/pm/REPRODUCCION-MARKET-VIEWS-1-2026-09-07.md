# Reproducción PM — MARKET-VIEWS-1 — 2026-09-07

## Decisión

**Aceptada.** Producto/regresión `b5ee28d`; informe `afbfb95`; corrección del
SHA informado `931a063`.

Mercado ofrece exactamente dos modos elegibles, `Cuadrícula` y `Lista`. La
anatomía ya no determina la huella exterior y ordenar, buscar, filtrar o abrir
detalle no cambia la vista durante la permanencia en Mercado. Inicio y
Servicios conservan sus previas compactas.

## Revisión de diff y evidencia Dev

El producto toca sólo `ProductGrid`, `ProductCard`, sus estilos y el caso 155.
No hay Backend, API, datos, migraciones, pagos, Railway ni dependencia nueva.
PM revisó el diff completo y reprodujo los hashes informados:

```text
a244279a98ac2bfb  src/components/ProductCard/ProductCard.tsx
926d5a6edeb49645  src/components/ProductCard/ProductCard.module.css
1f8ab2379c658f52  src/components/ProductGrid/ProductGrid.tsx
8a1bc44dbcc87c3e  src/components/ProductGrid/ProductGrid.module.css
6550fd713f7392fb  scripts/smoke.mjs
```

Dev informó caso 155 en 1/1, build, lint, TypeScript, contraste 52/52, a11y
64/64 y suite completa **154/155**, con único rojo ambiental en 131. PM no se
atribuye esa suite.

## Reproducción focal y visual PM

Con Docker local ya operativo, PM ejecutó desde bases nuevas:

```text
caso 155  1/1
caso 131  1/1
```

El 155 midió 34 tarjetas en los seis cruces de modo y viewport:

```text
1440×900  Cuadrícula 372×499, 3/fila · Lista 1156×255, 1/fila
768×1024  Cuadrícula 342×499, 2/fila · Lista 704×307, 1/fila
390×844   Cuadrícula 358×519, 1/fila · Lista 358×442, 1/fila
```

No hubo `grid-column` privilegiado ni desborde. Las cuatro anatomías conservaron
rótulo, dato y acción; foto sana, ausente o rota y título largo no alteraron una
tarjeta aislada. Las seis capturas quedaron en
`/var/folders/w7/htn5pr8s03b65qlsf7903w8c0000gp/T/topgreen-mercado-qRXyAV/`
y fueron inspeccionadas por PM. Cuadrícula y Lista se distinguen en los tres
anchos y mantienen controles y acciones alcanzables.

El lanzador incluyó build con TypeScript. Lint, `node --check` y `diff-check`
también quedaron verdes. Logs recuperables:

```text
/tmp/topgreen-pm-market-155.log
/tmp/topgreen-pm-market-131.log
```

## Suite PM y rojo transitorio

Por cierre del lote visual y cadencia del onboarding, PM ejecutó además una
suite completa desde otra base nueva. Dio **154/155**: el caso 122 agotó 30 s
esperando el botón `Reintentar`; 123–155, incluidos 131 y 155, pasaron. La rama
de error de `ProductGrid` y el caso 122 no cambiaron en la entrega.

PM reprodujo 122 inmediatamente desde otra base limpia y pasó **1/1**, cubriendo
caída 500, navegación con error, modo sin red y recuperación. Se clasifica como
rojo transitorio del arnés, no como defecto reproducido de producto. La
evidencia combinada cubre los 155 casos, pero **no se declara una suite PM
155/155**.

```text
/tmp/topgreen-pm-market-suite-155.log
/tmp/topgreen-pm-market-122.log
```

No hubo despliegue, datos remotos, secretos ni pagos. Los contenedores y
volúmenes locales descartables fueron eliminados por el lanzador al terminar.
