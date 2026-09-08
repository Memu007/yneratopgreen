# Reproducción PM — BRAND-AGROBOEDA-1

Fecha: 2026-09-07  
Producto/regresión: `f0913a7`  
Informe Dev: `c61b8b9`  
Resultado: base devuelta; corrección **técnicamente conforme, pendiente de integración**

## Revisión de BRAND-AGROBOEDA-1R

La Dev corrigió el borde en `21526bb` y documentó en `879d79f`, ambos sobre la
rama remota `origin/claude/dev-role-repo-3l0kp3`. El delta contra `f2f4ecc`
toca únicamente Footer TSX, Footer CSS y el bloque del caso 156.

- La marca completa del Footer es un botón que reutiliza
  `handleNavigate('home')`; monograma decorativo y texto producen un solo nombre
  accesible.
- El caso 156 localiza exactamente un botón `AgroBoeda` dentro de `footer`,
  parte desde Quiénes somos, llega tabulando, mide contraste del foco, activa
  con Enter y comprueba Inicio con scroll en cero en los tres viewports.
- Dev informó rojo contra `f0913a7`: cero controles de marca dentro del Footer.
- PM ejecutó 147+156 sobre base Docker local nueva desde `21526bb`: **2/2**.
  El primer intento se detuvo antes de probar por dependencias ausentes en la
  copia temporal y no cuenta; el reintento reutilizó las dependencias locales y
  quedó guardado en
  `/private/tmp/topgreen-pm-brand1r-147-156-reintento.log`.
- Build dentro del recorrido, lint con cero avisos, `node --check` y
  `git -c core.whitespace=cr-at-eol diff --check`: verdes.
- Se inspeccionaron Footer 1440×900 y 390×844: el botón no altera la
  composición. El foco medido por el caso queda en 3,9:1.
- No se repitieron suite completa, contraste, a11y total, Backend ni derivación,
  según la devolución focal.

La corrección no puede cerrarse todavía porque `origin/main` no contiene esos
dos commits. Se pide integración exacta, sin nueva prueba. El hallazgo de foco
1,0:1 en los demás enlaces del Footer queda como `FOOTER-FOCUS-1`, no
bloqueante y posterior a `DEMO-USER-1`.

## Verificación realizada

- Árbol limpio y `main` sincronizado con GitHub en `c61b8b9` antes de revisar.
- Diff completo revisado: 46 archivos, contenido acotado a migración de marca,
  activos derivados y caso 156. No se aceptó por volumen ni por informe.
- Fuente oficial intacta:
  `5606077c429b20edecb62986d6b7500c7142c6a6230c006fdfb33c4978b206cf`.
- Derivados reproducibles y coincidentes:
  - monograma 320×197:
    `697178b4873dc7fe9dbccf4fae19ab2517e6a3354df240656f569ac4a50558e2`;
  - favicon 64×64:
    `1e1da0e55abf72cdd99aedd3882d67bf649ae1603807ef6d0d7b5bcf7237b96f`.
- `python3 scripts/derivar_marca.py --verificar`: verde, sin escritura.
- Caso 156 independiente desde base Docker local nueva: **1/1**. La salida
  recuperable quedó en `/tmp/topgreen-pm-brand-156.log` y las capturas en la
  carpeta temporal informada por la ejecución.
- `node --check scripts/smoke.mjs`: verde.
- `git -c core.whitespace=cr-at-eol diff --check f0913a7^..f0913a7`: limpio.
- Dev informó suite **155/156**, con único rojo 131 atribuido a falta de Docker;
  PM no atribuye esa suite como propia ni declara 156/156.

## Inspección visual

Se inspeccionaron las nueve capturas generadas por la reproducción PM:
Header, Footer y Registro en 1440×900, 768×1024 y 390×844. Monograma y nombre
son legibles y consistentes, no hay desborde, el Header se adapta a las tres
medidas y el Registro conserva jerarquía y presentación profesional. La placa
opaca del monograma es fiel a la fuente entregada; no se exige una transparencia
inventada. `info@topgreen.com.ar` queda como deuda operativa declarada, no como
nombre de marca.

## Incumplimiento y falso verde

En `src/components/Footer/Footer.tsx`, el bloque visual de marca es un `div`.
No tiene `href`, rol interactivo ni manejador de navegación. El Header sí usa un
botón `AgroBoeda` que navega a `home`.

El caso 156 comprueba en el Footer que estén el texto y la imagen, pero después
activa el primer botón accesible llamado `AgroBoeda`; ese control pertenece al
Header. Por eso el caso pasa aunque el requisito «Header y Footer enlazan a
Inicio» esté incumplido.

## Decisión

No se acepta todavía `BRAND-AGROBOEDA-1`. Se devuelve una corrección mínima:
hacer de la marca completa del Footer un único control accesible hacia Inicio y
ampliar 156 para probar ese control dentro de `footer` desde otra sección. No se
rehacen activos, inventario, Backend, copy ni suite completa. `DEMO-USER-1`
permanece en cola.
