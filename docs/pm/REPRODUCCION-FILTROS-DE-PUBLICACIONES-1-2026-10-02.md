# Reproducción PM — FILTROS-DE-PUBLICACIONES-1

Fecha: 2026-10-02. Base `263198d`, más los commits PM hasta `d6fa79b`
integrados por la Dev.

- Código: `11c6069` y `353cf94`.
- Casos 237 y 238, negativos y guías: `aa77846`.
- Caso 174: `896a418`.
- Informe: `e41a31f`.
- Commit PM sobre el que se revisó: `f5051b8`.

`main` está en `d6fa79b`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

- **Los filtros del Mercado ofrecen sólo lo publicado**, con su cantidad: la
  marca, el tipo, la potencia, la condición y el origen.
  - Cada lista se cuenta con todos los filtros menos el suyo.
  - La opción elegida sigue a la vista con «(0)».
  - Revierte la decisión del 25/09.
- **«Otra marca» al publicar y en «Editar».**
  - Si coincide con una marca que existe, sin importar mayúsculas, acentos,
    espacios, guiones ni puntos, usa esa.
  - Si no, crea una marca activa en la misma lista.
  - Sin migración.
- **«Tecnificar»** en «Cómo funciona».
- **La Dev encontró y corrigió en su propio código un congelamiento de la
  API** (`353cf94`). Pasaba con dos altas con «Otra marca» a la vez, una de
  ellas rechazada. El caso 238 lo mide.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada, sobre `f5051b8`.

| Verificación | Resultado |
|---|---|
| Casos 173, 174, 175, 195, 198, 207, 232, 237 y 238 | **9/9** |
| Los 14 negativos de la Dev | **catorce rojos esperados**; «src y backend después: como estaban» |
| Negativo PM 1: la comparación de marcas ya no saca acentos | **rojo** en el 238: ««Editar» con «Agrómec» guardó «agr-mec»» y ««Agrómec» creó otra marca» |
| Negativo PM 2: el filtro ofrece marcas dadas de baja | **rojo** en el 198: «con «pauny» dada de baja ofrece 2 marcas, ella incluida» |
| Negativo PM 3: la condición se cuenta sin el filtro de marca | **rojo** en el 237: «con «Zoomlion»: «condicion» ofrece [… "Usado (2)"] y en la base es [… "Nuevo (1)"]», en los dos anchos |
| Suite completa desde base recién creada | **237/238**; sólo cae el **169**, de entorno; pasan el 131 y el 191 |
| a11y `--todas` / contraste / auditoría móvil | **78/78**, **82/82**, **12/12** sin desbordes |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 26 pasos y 23 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check` (sin migración), diff-check `6265cc2..f5051b8` con `cr-at-eol` | verdes |

**Método.** El contenedor de PM se reinició dos veces entre turnos. La
primera corrida de los casos falló entera porque Docker no estaba arriba.
PM lo volvió a levantar con `revivir.sh` (Docker, base nueva, API y
frontend) y repitió todo. Sólo cuentan las repeticiones.

## Decisiones PM

- **Se acepta guardar la marca escrita en la misma lista.** No necesita
  migración, y el filtro, la ficha y el alta la tratan igual que a las
  demás.
- **Se acepta que una marca dada de baja no vuelva desde un alta.**
- **El riesgo que declaró la Dev** es que una marca escrita no se puede
  corregir desde el sitio. Va como `MARCAS-PANEL-1`, la tarea siguiente
  (Emi, 02/10).
- **La nota del candado se acepta.** Con un proceso de API no se nota, y
  cuida el día en que haya dos.

No se tocó `main`, Railway ni datos reales.
