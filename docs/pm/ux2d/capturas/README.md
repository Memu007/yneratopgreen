# Capturas UX-2D — B, Mercado nacional

Salen del código de este commit, contra la base recreada desde cero
(migraciones + seed, 30 publicaciones) y con la API y el frontend locales. No
hay retoques: son lo que dibuja el navegador.

## Pantallas

| Archivo | Qué muestra |
|---|---|
| `inicio-1440x900.png` | Inicio completo en escritorio. |
| `inicio-768x1024.png` | Inicio completo en tablet. |
| `inicio-390x844.png` | Inicio completo en celular. |
| `servicios-1440x900.png` | Servicios completo en escritorio. |
| `servicios-768x1024.png` | Servicios completo en tablet. |
| `servicios-390x844.png` | Servicios completo en celular. |
| `mercado-1440x900.png` | Mercado en escritorio, recortado a 1900 px de alto. |
| `mercado-768x1024.png` | Mercado en tablet, recortado a 1900 px de alto. |
| `mercado-390x844.png` | Mercado en celular, recortado a 2600 px de alto. |

El Mercado es una lista larga —treinta publicaciones son unos doce mil píxeles
de alto en celular— y lo que hay que revisar es la cabecera de dos bandas, el
panel de filtros, la barra de resultados y las primeras filas de tarjetas. El
resto es la misma tarjeta repetida.

## Cabecera por rol

| Archivo | Rol | Celdas de sesión |
|---|---|---|
| `cabecera-anonimo-1440.png` / `-390.png` | sin sesión | `Ingresar` |
| `cabecera-comprador-1440.png` / `-390.png` | María Cliente | `Vender`, carrito, cuenta, `Salir` |
| `cabecera-vendedor-1440.png` / `-390.png` | Juan Vendedor | `Vender`, carrito, cuenta, `Salir` |
| `cabecera-admin-1440.png` / `-390.png` | Administrador TopGreen | `Admin`, `Vender`, carrito, cuenta, `Salir` |

Las cuatro están tomadas en el Mercado, que es donde la cabecera usa sus dos
bandas: la de marca con el buscador y las celdas de sesión, y la blanca con los
cinco destinos.

Comprador y vendedor muestran las mismas celdas y no es un error de la captura:
en el producto no existe un rol «vendedor». Cualquier cuenta con sesión puede
publicar, así que `Vender` aparece para las dos. Está explicado en el informe.
