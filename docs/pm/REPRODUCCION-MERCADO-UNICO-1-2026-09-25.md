# Reproducción PM — MERCADO-UNICO-1

Fecha: 2026-09-25. Base `c37ce91`. Producto `29ea2ec`, arnés y caso 193
`2b71709`, informe Dev `0aeb0b6`. `main` está en `e9cf4c6`. **Aceptada en
rama**, sin integración ni despliegue.

## Qué cambia

Es la devolución de la clienta #7, decidida por Emi el 25/09. Servicios deja
de ser una sección aparte.

- La cabecera ofrece Inicio, Mercado, Quiénes somos y Contacto.
- `?section=services`, una entrada vieja del historial y «Servicios» del pie
  llevan al Mercado con `type=servicios`, reescribiendo la barra sin agregar
  entradas al historial.
- Los servicios que mostraba la página encabezan la grilla, logística
  incluida.
- Se retira el contenido propio de la página, sin reemplazo.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local de `entorno_nativo.sh`.

| Verificación | Resultado |
|---|---|
| Suite completa | **191/193**: falla el 169 (entorno de PM) y el 191, con 401 «Token inválido o expirado» en `PATCH /admin/products/…`. El 191 solo da **1/1** |
| Caso 193 | **1/1** |
| Negativos de Dev (cabecera, enlace viejo y pie de la base) | **tres rojos esperados**; `src` quedó como estaba |
| Negativo PM: la reescritura con `pushState` en lugar de `replaceState` | **rojo**: «D2, Atrás: … la barra dice “/?section=services”» |
| Negativo PM: sin reescribir al volver por el historial | **rojo**: «D3, Atrás hasta la entrada vieja: la barra dice “/?section=services”» |
| 193 después de restaurar | **1/1** |
| a11y `--todas` / contraste / auditoría móvil | **76/76** / todo OK / **12/12** sin desbordes |
| `guia-admin.mjs` | **26/26** en escritorio y celular |
| Build, tipos, diff-check con `cr-at-eol` | verdes |

## Decisiones PM

- **Advertencia de responsabilidad:** la página Servicios no tenía ninguna,
  así que no hay nada que mudar. Agregar un aviso nuevo sobre servicios es
  texto con peso legal: queda fuera de esta pieza y se consulta a Emi si hace
  falta.
- **Cabecera en celular y tablet:** dos filas de dos en celular, cuatro
  columnas en tablet. Se acepta.
- Las fotos que quedaron sin uso
  (`public/media/comercial/servicios-relevamiento-hero-960*.webp`) se
  conservan por ahora.

## Registrado para la tarea siguiente (P3 del arnés)

El 191 cayó con el token de administración vencido en la suite completa,
aunque `43f3b20` ya renovaba el de `tokenDeAdmin`. Algún camino del 191 usa
un token guardado sin renovar.

No se tocó `main`, Railway ni datos reales.
