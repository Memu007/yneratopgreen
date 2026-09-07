# Reproducción PM — REGISTER-POLISH-1 — 2026-09-07

## Decisión

**Devuelta sólo por arnés.** Producto/regresión `7ca4fc7`; informe `dd84ee0`.

El resultado visual y funcional queda conforme. Registro usa un ancho interior
común, jerarquía sobria del sistema B, copy es-AR, error visible y expansión de
transportista entendible. Mostrar/Ocultar queda dentro del campo, reserva su
espacio y mide 92 × 44 px. No se pide rehacer CSS, React ni capturas.

## Diff y evidencia Dev

El commit toca Registro, un atributo accesible compartido de Login, CSS
compartido, `scripts/smoke.mjs` y cuatro capturas con README. No hay Backend,
API, contrato, pagos, Railway ni dependencia nueva.

PM reprodujo los hashes informados:

```text
7436cd9bdda7de8419b0d06527fb9d8337aac45731471f0b276b4afaa87a6951  src/components/Auth/AuthModal.module.css
c215e875979aa7d680c805571837ea9eac6182052624acb313879584baa6624f  src/components/Auth/RegisterModal.tsx
a150de10482773a6db1932d3830d181294d91afd9881650ae9fd8b01acc87d7b  src/components/Auth/LoginModal.tsx
b223eae4f3f849ee8ef495c1be23d5af8468a74b7721560aed7f2f6ec7b399ff  scripts/smoke.mjs
```

Dev informó 154 aislado 1/1, controles 148/150/151 en 3/3, contraste 52/52,
a11y 64/64 y suite completa **153/154**, con único rojo ambiental conocido en
131. Esa suite no se atribuye a PM.

## Reproducción y revisión visual PM

PM creó una base PostgreSQL local nueva, aplicó migraciones y seed, levantó API
y Frontend locales con `MP_CHECKOUT_HABILITADO=false` y ejecutó 154 enviando las
capturas a `/private/tmp/boeda-pm-154-capturas`:

```text
PASS 154 El alta de cuenta tiene un solo ancho y controles operables
1/1 pasaron; 0 fallaron
```

Quedaron medidos 432 px de ancho común en desktop y 303 px en móvil, botón de
92 × 44 dentro del campo, cero overflow horizontal, acción alcanzable, error
anunciado/en foco y ocho valores más una carga preservados al cerrar y reabrir
la ampliación. El log recuperable está en
`/private/tmp/boeda-pm-register-154-20260907.log`.

PM inspeccionó las cuatro capturas originales y las regeneradas. La alta base
se ve alineada y deliberada; el grupo de transportista se distingue sin crear
un segundo recuadro, y el desplazamiento ocurre dentro de la capa. Los cambios
compartidos no degradan Login. Build con TypeScript, lint, `node --check` y
`diff-check` quedaron verdes.

## Rojo de higiene de prueba

El propio caso define como salida predeterminada
`docs/pm/capturas-registro/` y llama `page.screenshot` cuatro veces. Las
capturas incluyen datos variables —el correo usa `Date.now()`— y las cuatro
imágenes regeneradas por PM tuvieron hashes distintos de las versionadas. Si
PM no hubiera usado `SMOKE_CAPTURAS`, una reproducción normal habría modificado
cuatro archivos rastreados y roto la condición de árbol limpio.

Además, el encabezado del caso afirma que no usa esperas fijas, pero el control
del fondo llama `page.waitForTimeout(150)` después de la rueda. Es una
contradicción reproducible y un muestreo temporal innecesariamente frágil.

La corrección queda limitada a salida temporal predeterminada, README y
sincronización sin tiempo fijo. Dev debe correr 154 sin `SMOKE_CAPTURAS` y
demostrar que `git status --short` sigue vacío. No corresponde repetir suite,
build, lint, contraste, a11y ni Backend.

La base aislada y los auxiliares se eliminaron; la base habitual `topgreen`
quedó intacta. No hubo despliegue, datos remotos, secretos ni pagos.

## Corrección REGISTER-POLISH-1R — aceptación final

**Aceptada.** Regresión/README `7268958`; informe `64aaf6c`. El producto visual
permanece exactamente en `7ca4fc7`.

El diff correctivo queda limitado a `scripts/smoke.mjs` y el README de las
capturas. Sin `SMOKE_CAPTURAS`, el caso usa `mkdtempSync` bajo el temporal del
sistema; con un destino explícito lo respeta. La espera fija de 150 ms fue
reemplazada por dos cuadros de animación y la aserción de fondo inmóvil no se
aflojó. Las cuatro capturas versionadas quedan como evidencia estática del SHA
visual, no como salida mutable de cada suite.

PM reprodujo los hashes completos:

```text
1270bf3e271cc0dbbd06c107eb146a3d7bf78dd445035df5d738c8f904d05d97  scripts/smoke.mjs
cbe8a9145335b652438d4f34387844b09bf2480ac71890ed8367c147faf9340f  docs/pm/capturas-registro/README.md
```

Desde otra base local nueva, PM ejecutó el caso sin definir destino:

```text
PASS 154 El alta de cuenta tiene un solo ancho y controles operables
1/1 pasaron; 0 fallaron
git status --short: vacío
```

Las cuatro imágenes quedaron en
`/var/folders/w7/htn5pr8s03b65qlsf7903w8c0000gp/T/topgreen-registro-0Ry77q/`
y el log en `/private/tmp/boeda-pm-register-154r-20260907.log`. `node --check`
y `diff-check` están verdes. Conforme a la devolución, PM no repitió build,
lint, contraste, a11y ni suite completa. Dev tampoco los repitió; su evidencia
anterior permanece 153/154 con único rojo ambiental conocido en 131 y no se
atribuye a PM.

Se eliminaron base y auxiliares aislados; `topgreen` quedó intacta. No hubo
despliegue, Railway, datos remotos, secretos ni pagos.
