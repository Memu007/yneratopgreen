# Fuentes self-hosted

Las dos familias del sistema visual aprobado, servidas desde acá y **no desde
Google Fonts en tiempo de ejecución**: una tipografía pedida a un tercero en
cada visita cuenta al visitante ante ese tercero, y además ata el render a que
ese servicio esté arriba.

| Archivo | Familia | Ejes | Licencia |
|---|---|---|---|
| `Newsreader.woff2` | Newsreader | `wght 400–600`, `opsz 6–72` | SIL OFL 1.1 — `OFL-Newsreader.txt` |
| `WorkSans.woff2` | Work Sans | `wght 400–700` | SIL OFL 1.1 — `OFL-WorkSans.txt` |

## De dónde salen

De los TTF variables oficiales que vienen en el paquete de diseño
(`docs/pm/diseno-premium/handoff/assets/fonts/`), cuyos SHA-256 están en
`ACTIVOS.md` y se verificaron antes de convertir:

    8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1  Newsreader-Variable.ttf
    f50f61f2ba738e239442d40bf1069adb195c224b6a5a73a581fc2f3ed62a9f63  WorkSans-Variable.ttf

Repositorios de origen: <https://github.com/google/fonts/tree/main/ofl/newsreader>
y <https://github.com/google/fonts/tree/main/ofl/worksans>.

## Cómo se produjeron

Con `fonttools` —herramienta de construcción, no dependencia del producto— en
dos pasos: primero se recorta el eje de peso a lo que el sistema usa, después
se subsetea el repertorio y se convierte a WOFF2.

    python -m fontTools.varLib.instancer Newsreader-Variable.ttf wght=400:600 -o /tmp/Newsreader.ttf
    python -m fontTools.subset /tmp/Newsreader.ttf \
      --unicodes='U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030,U+2032-2033,U+2039-203A,U+20A0-20BF,U+2212' \
      --layout-features='kern,liga,calt,tnum,onum,ccmp,mark,mkmk' \
      --flavor=woff2 --output-file=Newsreader.woff2

Idéntico para Work Sans con `wght=400:700`.

El rango cubre latín básico, el suplemento Latin-1 completo —acentos, `ñ`, `¿`,
`¡`, comillas angulares—, la puntuación tipográfica (rayas, comillas curvas,
puntos suspensivos, punto medio), los símbolos de moneda y el signo menos. Las
`tnum` quedan porque los precios y las tablas se alinean por columna.

**Antes de abrir un idioma que use otro alfabeto hay que ampliar el subset**:
los archivos de acá no tienen cirílico, griego ni vietnamita.

Pesos resultantes: Newsreader 90.896 B y Work Sans 30.996 B, contra los máximos
de producción de 170 KB y 140 KB que fija `ACTIVOS.md`.
