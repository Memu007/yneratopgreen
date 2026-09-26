# Reproducción PM — USER-GUIDE-1

Fecha: 2026-09-26. Base `ff0d70f` (asignación) y `82df8b2` (decisión PM sobre
las órdenes).

- Caso 205: `134aa86`.
- Consulta Dev: `efa6038`.
- Corrección de las órdenes: `6e344bf`.
- Caso 206: `ec51026`.
- Guía y README: `1c58751`.
- Programa y negativos: `d6b21a1`.
- Informe: `5a197bf`.

`main` está en `238d113`. **Aceptada en rama**, sin integración ni
despliegue.

## Qué cambia

- **`docs/USER_MANUAL.md` reescrita** como guía de uso de AgroBoeda, en 22
  pasos:
  - quien compra, pasos 1 a 12;
  - quien vende, pasos 13 a 19;
  - quien transporta, pasos 20 a 22.

  Empieza con lo que la plataforma no hace. Marca como PENDIENTE lo que el
  sitio publicado todavía no tiene: el correo y el pago con Mercado Pago. No
  tiene credenciales.
- **`scripts/guia-usuario.mjs`** la recorre en el navegador, en escritorio y
  en celular, con el molde de `guia-admin.mjs`. Controla las citas, 131 y
  133 frases de resultado atadas a una comprobación, el inventario de
  controles y 12 frases declaradas sin comprobar.
- **Órdenes.** Hay un solo armado para abrir y recargar «Mis Compras» y «Mis
  Ventas». Después de una acción ya no se pierden el traslado, los datos de
  la transferencia ni «Calificar Vendedor». Defecto encontrado por la guía,
  decisión PM `82df8b2`.
- **Caso 205:** el modelo se encuentra con el buscador. Cierra el hueco de
  cobertura de la parte 2.
- **Cuentas de prueba locales:** pasaron del manual al README. Son las de la
  siembra, que no corre en producción.

## Resultados PM

Base PostGIS Docker recién creada, API nativa, frontend de desarrollo y
configuración local inventada.

| Verificación | Resultado |
|---|---|
| Casos 205 y 206 | **2/2** |
| `guia-usuario.mjs` | «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |
| Negativos de la Dev: modelo fuera del buscador, recarga sin traslado, sin transferencia, sin calificar; frase falsa, cita ausente, control sin nombrar | **siete rojos esperados**, cada uno por su motivo; «src, backend y la guía después: como estaban» |
| **Negativo PM: se rompe el producto y no la guía.** Aprobar el comprobante deja de descontar el stock (`orders.py`) | **rojo** en el paso 17: «las unidades vendidas se descuentan de tu stock» y «el stock pasó de 50 a 50». Caen también los pasos 7 y 16, que arman su publicación agotada con una venta. El programa controla lo que la guía afirma del producto, no sólo su texto |
| `grep` de credenciales en `docs/USER_MANUAL.md` | sin salida |
| Suite completa desde base recién creada | **205/206**; sólo cae el **169**, de entorno; el 191 pasa |
| a11y `--todas` / contraste / auditoría móvil | **80/80**, **88/88**, **12/12** sin desbordes |
| `guia-admin.mjs` y `guia-usuario.mjs` después de la suite | 26 pasos y 22 pasos coinciden, en los dos anchos |
| Build, tipos, lint, `compileall`, `alembic check`, diff-check con `cr-at-eol` | verdes |

## Decisiones PM sobre el informe

La guía encontró dos defectos del producto. La Dev no los tocó y la guía no
los promete: están declarados al final como no comprobados.

1. **«Características del Producto» y «Etiquetas» no se guardan.** Se
   escriben al publicar y se pierden: no viajan a la API y la base no tiene
   dónde guardarlas. Quien publica pierde trabajo sin aviso. **Decisión PM:
   sacar los dos bloques del formulario** (opción A de la Dev). Guardarlos
   sería otro hito con API y base.
2. **La marca no se ve para quien compra, y «Editar» no la deja cambiar.**
   **Decisión PM: mostrarla en la ficha, junto al modelo, y sumarla a
   «Editar».** La API ya la devuelve y la acepta.

Los dos van a la próxima pieza, `PUBLISH-FIELDS-1`.

**P3 sin tarea:**

- «Contactar por WhatsApp» aparece aunque no haya teléfono cargado. Depende
  de la regla del teléfono, PENDIENTE de Emi.
- Los rótulos del checkout no tienen `for`.
- `guia-usuario.mjs` repite unas 250 líneas de `guia-admin.mjs`.

No se tocó `main`, Railway ni datos reales.
