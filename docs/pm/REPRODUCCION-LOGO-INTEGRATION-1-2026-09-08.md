# Reproducción PM — LOGO-INTEGRATION-1

Fecha: 2026-09-08.

## Estado

Aceptada técnicamente en rama. Integración retenida para no disparar el
despliegue automático de Railway.

- Base PM: `8a0d28c`.
- Producto/regresión: `d252a0c`.
- Informe Dev: `e2b5dbc`.
- Integración en `main`: `712f98b`.
- Corrección en rama: `3370284`.
- Informe de corrección: `79a8494`.

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

## Cierre de la corrección

PM revisó `3370284`: `--verificar` compara cada archivo contra bytes derivados,
sale distinto de cero si falta o difiere y no escribe producto. El caso 159
sustituye el alfa por el opaco sólo en una copia temporal, exige el error sobre
ese archivo y comprueba que los otros dos no sean acusados. El comentario de
Header quedó coherente y los tres PNG conservaron exactamente sus hashes.

PM ejecutó desde el informe `79a8494`:

```text
PASS 159 El monograma se integra con la banda: sin placa, sin halo y sin mover nada
1/1 pasaron; 0 fallaron
```

También quedaron verdes el `--verificar` positivo, lint, `node --check` y
`diff-check`. Log persistente:
`/private/tmp/topgreen-pm-logo-1r-159.log`.

No se repitieron 156, suite completa ni inspección visual: el activo no cambió.
La corrección queda aceptada en la rama Dev y no se integra a `main` mientras
esa acción implique un despliegue no autorizado.
