# Reproducción PM — LOCALITY-LABEL-DISPLAY-1

Fecha: 2026-09-24. Base `d6c19f4`; producto, caso 189 y negativos `0830ac2`;
informe Dev `8e64f82` (sólo `docs/pm/PARA-PM.md`). `main` permanece en
`0bd7fbc`. **Aceptada en rama**, sin integración ni despliegue.

## Qué se revisó

`padron.rotulos` aplica la misma regla del selector: el departamento sólo si
el nombre se repite en la provincia, y una anidada lleva el rótulo de su
localidad. La API sólo agrega campos: `locality_label`, `label`,
`base_locality_label`, `carrier_base_label` y `carrier_base_locality_label`.
Ningún campo existente cambia. No hay migración ni datos reescritos. El
origen de cada ítem de orden sale del id congelado, no de la publicación
actual.

**Caso 137 (privacidad de la ubicación pública).** Dev agregó
`locality_label` a las claves permitidas. PM verificó que no se debilita:
siguen prohibidas `latitude`, `longitude`, `coordinates`, `department`,
`phone`, `whatsapp` y `email`. El departamento dentro del rótulo es
geografía pública y aparece sólo en homónimas. Se acepta. Ningún campo nuevo
lleva datos de contacto: la regla del teléfono no cambia.

## Resultados

| Verificación | Resultado |
|---|---|
| Caso 189 | **1/1**: tarjeta y ficha «San Pedro (Choya), Santiago del Estero»; Pergamino sin cambios; checkout (base, distancia, origen), orden en «Mis compras» y panel del transportista con departamento; el rótulo más largo entra a 360 px |
| Negativos `codigo-de-la-base`, `ficha-sin-rotulo`, `checkout-con-el-nombre`, `rotulo-sin-cortes` | **rojos**, cada uno por su causa; `src` y backend restaurados; 189 repetido **1/1** |
| 1–22, 39, 41–43, 46, 50–58, 110–115, 121, 132, 133, 137, 140, 149, 151, 152, 154–157, 164, 176, 178, 183–186, 188 | **62/62** |
| a11y `--todas` / contraste / auditoría móvil | **76/76**, **84/84**, **12/12** sin desbordes |
| Build, lint, tipos, `compileall`, `node --check`, diff-check CRLF | verdes |

Entorno: base PostGIS Docker recién creada, API nativa, `.env` inventados y
Chromium 141. Es el mismo de las reproducciones anteriores.

## Riesgos aceptados

- `/auth/me` hace una o dos consultas chicas más para un transportista.
- Si se reimportara el padrón, los rótulos se recalculan solos; no se guardan.
