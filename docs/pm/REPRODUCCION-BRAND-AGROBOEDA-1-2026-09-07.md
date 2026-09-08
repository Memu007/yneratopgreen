# Reproducción PM — BRAND-AGROBOEDA-1

Fecha: 2026-09-07  
Producto/regresión: `f0913a7`  
Informe Dev: `c61b8b9`  
Resultado: **devuelta como BRAND-AGROBOEDA-1R**

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
