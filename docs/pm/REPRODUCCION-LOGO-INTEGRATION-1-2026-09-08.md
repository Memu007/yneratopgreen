# Reproducción PM — LOGO-INTEGRATION-1

Fecha: 2026-09-08.

## Estado

Resultado visual aprobado. Entrega devuelta por una puerta de reproducibilidad
falsa y un comentario de producto obsoleto.

- Base PM: `8a0d28c`.
- Producto/regresión: `d252a0c`.
- Informe Dev: `e2b5dbc`.
- Integración en `main`: `712f98b`.

## Evidencia funcional y visual PM

PM revisó el delta y ejecutó desde `main`, con Docker local descartable:

```text
PASS 156 La identidad pública es AgroBoeda, sin renombrar lo que no es marca
PASS 159 El monograma se integra con la banda: sin placa, sin halo y sin mover nada
2/2 pasaron; 0 fallaron
```

El build de producción incluido pasó. También quedaron verdes lint,
`node --check`, `python3 scripts/derivar_marca.py --verificar` y
`git diff --check`. Log persistente:
`/private/tmp/topgreen-pm-logo-156-159.log`.

PM inspeccionó a tamaño real Header y Footer en 1440×900, 768×1024 y 390×844.
El AB aparece integrado en la banda, sin placa rectangular ni halo oscuro; las
letras conservan forma y proporción y no desplazan navegación o texto. Capturas
persistentes: `/private/tmp/topgreen-pm-logo-159/159-*.png`.

El nuevo activo es PNG RGBA 320×197, SHA-256
`837bb0feb7b2531694c605e2885931c3bc58c0e6033add133e1118d468c70958`.
La fuente oficial, el favicon y el monograma opaco conservaron sus hashes. No se
desplegó ni se tocaron Railway, datos remotos, pagos o secretos.

## Motivo de devolución

En modo `--verificar`, `derivar_marca.py` calcula la derivación pero no codifica
ni compara ese resultado con los archivos versionados. Para cada salida toma el
hash del propio archivo existente y lo imprime. El caso 159 obtiene el hash del
mismo archivo y sólo exige verlo en esa línea: ambos lados provienen de la misma
fuente, no de una comparación entre esperado y actual. La afirmación de que el
comando “reproduce” los archivos queda sin demostrar.

Además, el comentario de `Header.tsx` todavía describe el monograma como opaco
y niega la transparencia que carga la línea siguiente. La corrección debe hacer
real la comparación, demostrar un negativo con una copia temporal alterada y
actualizar ese comentario. El activo visual ya aprobado no cambia y no se
repiten sus capturas.
