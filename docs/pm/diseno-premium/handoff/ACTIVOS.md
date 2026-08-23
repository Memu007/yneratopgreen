# Activos, procedencia y licencias

Este inventario es la lista permitida para el handoff. Las capturas son
referencia; no son assets de producción.

## Tipografías

| Archivo | Formato / peso real | Uso | Máximo producción | Procedencia / licencia |
|---|---|---|---|---|
| `assets/fonts/Newsreader-Variable.ttf` | TTF variable · 451.664 B | Display y wordmark | 170 KB WOFF2 subset por script/locale | Repositorio oficial `google/fonts` · `OFL-Newsreader.txt` (SIL OFL 1.1) |
| `assets/fonts/WorkSans-Variable.ttf` | TTF variable · 361.072 B | UI, datos y texto | 140 KB WOFF2 subset por script/locale | Repositorio oficial `google/fonts` · `OFL-WorkSans.txt` (SIL OFL 1.1) |

Fuentes oficiales:

- Newsreader: <https://github.com/google/fonts/tree/main/ofl/newsreader>
- Work Sans: <https://github.com/google/fonts/tree/main/ofl/worksans>

La implementación debe self-hostear sólo los archivos y pesos efectivamente
usados. No cargar desde Google Fonts en runtime y no simular pesos.

## Wordmark

| Archivo | ViewBox / peso | Máximo producción | Uso |
|---|---|---|---|
| `assets/wordmark/topgreen-horizontal.svg` | 896×112 · 55.890 B | 60 KB | Lockup con descriptor. |
| `assets/wordmark/topgreen-compact.svg` | 431×112 · 14.869 B | 18 KB | Cabecera y ancho reducido. |
| `assets/wordmark/topgreen-mono-dark.svg` | 896×112 · 55.880 B | 60 KB | Una tinta sobre fondo claro. |
| `assets/wordmark/topgreen-mono-light.svg` | 896×112 · 55.879 B | 60 KB | Una tinta sobre índigo. |

Los cuatro SVG fueron construidos para TopGreen en este handoff y convertidos a
contornos desde Newsreader incluida. No requieren la fuente en runtime. El
descriptor de la versión horizontal también está convertido a contornos. No
hay isotipo ni favicon aprobado.

## Estados de imagen

| Archivo | ViewBox / peso | Máximo producción | Uso / procedencia |
|---|---|---|---|
| `assets/no-photo.svg` | 800×600 · 587 B | 2 KB | Ausencia de foto · construcción propia. |
| `assets/photo-broken.svg` | 800×600 · 676 B | 2 KB | Error de carga · construcción propia. |

## Integridad — SHA-256

```text
8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1  Newsreader-Variable.ttf
f50f61f2ba738e239442d40bf1069adb195c224b6a5a73a581fc2f3ed62a9f63  WorkSans-Variable.ttf
fde01c1ab258fdc369928b6a3666faf4568fa964f011d639ee4a0617964ff7f4  topgreen-compact.svg
1715c30daa56a8f7be5fdae4cd137130a354b04e659f38e05e8f8b7f68af311b  topgreen-horizontal.svg
f8f3e63da66aa0f28b812f48f154b2c6b7d1abf8a86f71d90e2f04dff03300fd  topgreen-mono-dark.svg
5565286c5340504608cf0116d7c328d0a63443c6095adba5072a69f50bb20965  topgreen-mono-light.svg
20afe2aad5efa6c0535cfa9e32215baabc847b8aaab68bfbaa41ff3f3ca4e7b6  no-photo.svg
ecf1b45a9c722a3505db760569a098a7db3d0e2cb866c5ccfd6b15783ac91171  photo-broken.svg
```

## Lo que deliberadamente no está

- Fotografías de stock o generadas: no hay autorización/licencia aprobada.
- Ilustraciones conceptuales de Puerta 2: no son producción.
- Iconografía de terceros: el sistema se apoya en texto, geometría y símbolos
  HTML conocidos; un set futuro deberá documentar autor y licencia.
- Logos de competidores o fabricantes.

## Control antes de producción

1. Confirmar que cada archivo listado conserva nombre y hash del paquete.
2. Subsetear fuentes sólo después de validar caracteres y licencia.
3. Optimizar SVG sin convertir colores a valores distintos de los tokens.
4. Registrar cualquier activo nuevo con origen, licencia y aprobación.
5. Rechazar assets sin trazabilidad, aunque se vean “premium”.
