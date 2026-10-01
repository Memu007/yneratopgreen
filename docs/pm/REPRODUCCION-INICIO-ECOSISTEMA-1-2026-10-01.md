# Reproducción PM — INICIO-ECOSISTEMA-1

Fecha: 2026-10-01. Base `5412555` (nota de traspaso, con la tarea de `487114f`).

- Producto: `b5daa24`, más `7d7d808`, la banda de la portada en 390.
- Casos y negativos: `c020222`.
- Capturas: `162e04b` y `7d7d808`.
- Informe: `69068d9`.

La empezó una cuenta de Dev y la cerró otra, que rehízo la evidencia.

`main` está en `77d3d2c`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

- **Inicio es la maqueta v2.** Lleva los textos aprobados por Emi el 30/09:
  - la portada;
  - siete servicios, y sólo el Mercado está «Disponible hoy», con su número;
  - «¿Te interesa alguno?» con «Escribinos»;
  - el crédito de las dos fotos CC BY;
  - «Cómo funciona», en cinco pasos;
  - el principio con sus tres niveles.

  Salen de Inicio «Publicar una oferta», los tipos de publicación y «Lo que
  muestra cada publicación».
- **«Quiénes somos» sale** del menú, del pie y del sitio. `?section=about`
  lleva a Inicio sin sumar una entrada al historial. El manual ya no la
  nombra.
- **Sin migraciones ni cambios en la API.**

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `69068d9`.

| Verificación | Resultado |
|---|---|
| Capturas 1440 y 390 contra la maqueta | coinciden en estructura, textos, estados y orden. Las diferencias son las que declara la Dev: el número real, el crédito, sin la franja de maqueta y algún espacio de `tokens.css` |
| Casos 232, 233 y 234 | **3/3** |
| Negativos de la Dev: «Próximamente» con enlace, «Quiénes somos» en el pie, sin crédito, número provisorio, sin foco, `about` sin retirar | **seis rojos esperados**; «src y backend después: como estaban». El script ya toma `REINICIAR_API` |
| Negativo PM 1: el título aprobado pierde «cumplimiento» | **rojo** en el 232: «el título es «Producción, mercado y tecnología en una misma ruta.»», en los dos anchos |
| Negativo PM 2: Ruta productiva y Trazabilidad cambian de lugar | **rojo** en el 232: «los servicios son ["Trazabilidad","Mercado","Ruta productiva",…]», en los dos anchos |
| Negativo PM 3: las fotos de las tarjetas cargan sin diferir | **rojo** en el 232: «la foto va con alt «», carga eager», foto por foto |
| Suite completa desde base recién creada | **233/234**; sólo cae el **169**, de entorno; pasan el 131, el 191, el 213 y los tres nuevos |
| a11y `--todas` / contraste / auditoría móvil | **78/78**, **82/82**, **12/12** sin desbordes. Bajan de 80 y 88 porque salieron las pantallas de Quiénes somos |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 26 pasos y 22 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check `5412555..69068d9` con `cr-at-eol` | verdes |

**Método.** La primera corrida de las puertas se cortó por el límite de
tiempo de la herramienta, después de terminar la suite (233/234). PM corrió
las auditorías restantes aparte, sobre la misma base, y quedaron verdes.

## Decisiones PM sobre el informe

- **La banda de la portada partida en 390 (`7d7d808`):** se acepta. Es lo
  que hace la maqueta, y antes se cortaba con puntos suspensivos.
- **Casos cambiados y retirados:** se aceptan. Lo que se retiró probaba
  pantallas o botones que salieron con esta pieza.
- **La cabecera en celular en una sola fila:** se acepta, porque es efecto
  de sacar «Quiénes somos».
- **Riesgo de producto, escalado a Emi:** sin sesión no queda ningún botón
  para publicar.
  - «Vender» aparece sólo después de ingresar.
  - La tarjeta del Mercado dice «o publicá una oferta», pero su botón lleva
    al Mercado.
- **P3 sin tarea:** las siete fotos de las tarjetas pesan 1,4 MB en total,
  a 1600 px para tarjetas de unos 350 px. Cargan en diferido, así que no
  frenan la portada. Va a una limpieza de imágenes.

No se tocó `main`, Railway ni datos reales.
