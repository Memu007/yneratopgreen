# Reproducción PM — INICIO-CIERRE-CELULAR-1 y el agregado de MARCAS-PANEL-1

Fecha: 2026-10-02. Base `4f453a0`, más los commits PM hasta `4b1eee4`
integrados por la Dev.

- INICIO-CIERRE-CELULAR-1: código `666bbf1`; caso 240, 232 ajustado y
  negativos `8fbd0aa`.
- Agregado de MARCAS-PANEL-1: código `1eb819d`; casos y negativos `baa2705`.
- Informe: `4e52746`. Rama publicada: `6a96b0d`.

`main` está en `4085a9a`. **Aceptadas en rama**, sin integración ni
despliegue.

## Qué cambia

- **En el celular (599 px o menos), «¿Te interesa alguno?» cierra Inicio,**
  después de «Principio de AgroBoeda». Tiene los mismos textos y el mismo
  botón.
- **El crédito de las fotos** queda pegado a la tarjeta 07.
- **Desde 600 px no cambia nada:** el bloque sigue como octava pieza de la
  grilla.
- **El bloque se muda en el documento, no sólo en lo que se ve.** Así, el
  lector de pantalla y el Tab lo encuentran donde está. Si se gira el celular
  con el foco en «Escribinos», el foco se conserva.
- **Agregado de MARCAS-PANEL-1:**
  - el 239 comprueba que unir mueve también las pausadas y las eliminadas;
  - el 239 comprueba que Configuración no renombra una marca;
  - «Editar» muestra el nombre de una marca dada de baja («AgroMec») y no su
    valor interno. Para eso, `/products/my` suma `brand_label`, un campo de
    lectura;
  - el 195, el 198, el 238 y el 239 esperan las cantidades del filtro antes
    de leerlo.
- Sin migración.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `6a96b0d`.

| Verificación | Resultado |
|---|---|
| Casos 128, 195, 232, 233, 239 y 240 | **6/6** |
| Los 6 negativos de la Dev de Inicio | **seis rojos esperados**; «src después: como estaba» |
| Los 12 negativos de marcas (8 de antes, mis 2 que sobrevivían y 2 nuevos de la Dev) | **doce rojos esperados**; «src y backend después: como estaban» |
| Negativo PM 1: el corte de celular pasa de 599 a 600 px | **rojo** en el 240: «600: «¿Te interesa alguno?» no es la octava de la grilla: está al final de Inicio», el título queda H2 y el Tab cambia de orden |
| Negativo PM 2: al final, «Escribinos» no lleva a ningún lado (en la grilla sí) | **rojo** en el 233: «390: «Escribinos» dejó la barra en http://localhost:5173/» y «no mostró Contacto» |
| Suite completa desde base recién creada | **238/240**. Cae el **169**, de entorno, y el **204**. Pasan el 131, el 191, el 195, el 232, el 233, el 239 y el 240 |
| El 204 repetido | cae otra vez justo después de la suite, y **pasa** solo, más tarde (1/1) |
| a11y `--todas` / contraste / auditoría móvil | sin violaciones bloqueantes y con cobertura completa / «TODO OK, COBERTURA COMPLETA» / **12/12**, sin desbordes |
| `guia-admin.mjs` después de la suite | **falla un paso en escritorio**: «Paso 28. Dar de baja y de alta: no se pudo hacer: locator.waitFor: Timeout 15000ms exceeded». En celular, 30 pasos coinciden. Repetida: **30 pasos coinciden en los dos anchos** |
| `guia-usuario.mjs` | 23 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check` (sin migración), diff-check `4b1eee4..6a96b0d` con `cr-at-eol` | verdes |

**Método.** El contenedor de PM se reinició a mitad de la primera suite
(iba por el caso 161, sin fallas). PM volvió a levantar el entorno con
`revivir.sh` y repitió la suite entera desde una base nueva. Sólo cuenta la
repetición.

**El 204 es la misma carrera que el 195, en otro caso.** Desde
`FILTROS-DE-PUBLICACIONES-1`, el filtro «Marca» se dibuja recién cuando
llegan las cantidades (`marcasDisponibles.length > 0` en `FilterSidebar`).
El 204 lee el orden del panel apenas aparece el orden de la lista, sin
esperarlas. Si llegan tarde, ve el panel sin «Marca»: «el panel va […
"Potencia","Año" …] y el acordado es [… "Potencia","Marca","Año" …]», en
1440 y en 390. La pantalla está bien. La Dev corrigió esta carrera en el
195, el 198, el 238 y el 239, pero no en el 204, que lee rótulos y no
opciones. El 204 ya está en `main`. P3 del arnés.

**El paso 28 de la guía no se reprodujo.** La espera que venció es la de la
lista de «Marcas» del panel (15 s). El registro de la API no muestra errores
en esa corrida, y en las otras tres pasadas el paso pasó. Va a la Dev para
que lo mire junto con el 204. P3 del arnés.

## Decisiones PM

- **Se aceptan los tres supuestos de la Dev:**
  - al final, el título pasa a nivel 2;
  - las separaciones de 24 y 48 px en el celular;
  - el bloque se muda si cambia el ancho, y conserva el foco.
- **Se acepta el corte en 599 px.** Es el del contrato, y es el único ancho
  donde la grilla tiene una sola columna.
- **Se acepta `brand_label` en `/products/my`.** Es aditivo, de lectura, y
  sólo sobre las publicaciones propias.
- **Mover `useEsMovil` a un archivo compartido** no cambia la cabecera: el
  128 sigue verde.
- **El 204 y el paso 28 de la guía** van a `AVISOS-1` como agregado chico:
  que el 204 espere «Marca» antes de leer el orden, y que la Dev mire por qué
  la lista de «Marcas» pudo tardar más de 15 s en la guía.

No se tocó `main`, Railway ni datos reales.
