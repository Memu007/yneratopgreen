# Fuentes self-hosted

Las dos familias del sistema visual aprobado —dirección **B, Mercado
nacional**—, servidas desde acá y **no desde Google Fonts en tiempo de
ejecución**: una tipografía pedida a un tercero en cada visita cuenta al
visitante ante ese tercero, y además ata el render a que ese servicio esté
arriba.

| Archivo | Familia | Ejes | Licencia |
|---|---|---|---|
| `InterTight.woff2` | Inter Tight | `wght 100–900` | SIL OFL 1.1 — `OFL-InterTight.txt` |
| `Inter.woff2` | Inter | `wght 100–900` | SIL OFL 1.1 — `OFL-Inter.txt` |

Inter Tight lleva los títulos y los datos que se comparan entre filas; Inter
lleva el cuerpo y los controles. No hay una tercera familia y no hay serif.

## De dónde salen

Del paquete visual aprobado
`docs/pm/diseno-premium/mercado-nacional-b/assets/fonts/`, copiados sin
recomprimir ni volver a subsetear. Los archivos de acá son byte a byte los del
paquete, con el nombre que consume `tokens.css`:

    c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4  Inter.woff2
    83d548cd73ef2e039167db3adb5ea9d7a7870466ffc8a162c9820bc348938aaf  InterTight.woff2

Repositorios de origen: <https://github.com/rsms/inter> y
<https://github.com/rsms/inter-tight>.

## Repertorio

Ambas cubren latín básico, el suplemento Latin-1 completo —acentos, `ñ`, `¿`,
`¡`, comillas angulares—, la puntuación tipográfica y los símbolos de moneda,
y traen `tnum`: los precios y las tablas se alinean por columna.

**Antes de abrir un idioma que use otro alfabeto hay que ampliar el subset**:
los archivos de acá no tienen cirílico, griego ni vietnamita.

Pesos: Inter 48.432 B e Inter Tight 44.916 B, contra los máximos de producción
de 170 KB y 140 KB que fija `../../docs/pm/diseno-premium/handoff/ACTIVOS.md`.

## Las anteriores

Newsreader y Work Sans —las familias de la pieza «Mesa de negocios» y de la
extensión A— se retiraron con UX-2D: nada las carga y dejarlas serviría dos
sistemas tipográficos a la vez. Sus originales siguen versionados en
`docs/pm/diseno-premium/handoff/assets/fonts/`.
