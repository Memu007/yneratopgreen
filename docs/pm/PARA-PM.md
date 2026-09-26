# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## USER-GUIDE-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `82df8b2` (tu decisión sobre las órdenes) |
| órdenes | `6e344bf` la corrección · `ec51026` caso 206 |
| guía | `1c58751` la guía y el README · `d6b21a1` el programa y los negativos |
| antes | `134aa86` caso 205, el modelo con el buscador |
| no integrado, no desplegado | `main` sigue en `238d113` |

**Resultado.**

- **La guía de uso está reescrita y un programa la recorre.**
  `node scripts/guia-usuario.mjs` → «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos
  en escritorio y celular».
- **Las órdenes, corregidas como decidiste.** Un solo armado, la recarga
  pregunta `can_rate`, caso 206 y tres negativos (pediste dos; sumé el de
  la transferencia, que el caso también mira).
- **Los tres negativos de la guía dan rojo, cada uno por su motivo.**
- **Sin credenciales en la guía.** El `grep` no encuentra nada; las cuentas
  de prueba pasaron al README.

**Para decidir vos (no bloqueante).** La guía encontró dos cosas del
producto. No las toqué: la guía dice sólo lo que pasa, y el programa deja
fuera lo que no funciona, declarado al final de la guía.

1. **«Características del Producto» y «Etiquetas», en el formulario de
   publicar, no se guardan.** Se escriben, se tocan «+ Agregar», se ven en
   la lista, y al publicar se pierden: no viajan a la API y la base no tiene
   dónde guardarlas.
   - **Opción A, la recomiendo:** sacar los dos bloques del formulario. Es
     sólo frontend.
   - **Opción B:** guardarlos. Necesita API y base: otro hito.
2. **La marca no se ve en ningún lado para quien compra.** Se elige al
   publicar y sirve para el filtro «Marca», pero la ficha y la tarjeta no la
   muestran, y «Editar» no la deja cambiar.
   - **Opción A, la recomiendo:** mostrarla en la ficha, junto al modelo, y
     sumarla a «Editar». Sólo frontend; la API ya la devuelve y la acepta.
   - **Opción B:** dejarlo así; la guía ya dice que sirve para el filtro.

## Lo que la guía corrigió de mí

El programa encontró cuatro frases mías que eran falsas, antes de que
llegaran a vos. Las corregí para que digan lo que pasa:

- **El carrito no queda en la cuenta:** vive en el navegador y «Salir» lo
  vacía.
- **Rechazar el comprobante no vuelve a esperar otro:** la venta queda
  «Rechazado».
- **Crear la orden no reserva stock** en la transferencia: se descuenta al
  aprobar el pago.
- **La documentación presentada queda «Pendiente de revisión»,** no «En
  revisión».

## La guía

`docs/USER_MANUAL.md`, en tres partes y 22 pasos:

- **Antes de empezar:** lo que AgroBoeda no hace (no cobra ni guarda dinero,
  la transferencia la confirma quien vende, el origen es declarado y no se
  verifica, la habilitación del transportista tampoco, no organiza el flete)
  y lo que el sitio publicado todavía no tiene (el correo, Mercado Pago),
  como PENDIENTE.
- **Quien compra (pasos 1 a 12):** cuenta y correo, la cabecera, buscar,
  filtrar, filtrar maquinaria, la ficha, el carrito, envío y traslado, pagar
  por transferencia, «Mis Compras», recibir y calificar.
- **Quien vende (13 a 19):** CBU y alias, vincular Mercado Pago, publicar,
  «Mis publicaciones» (editar, pausar, agotado, eliminar), revisar el
  comprobante, confirmar y enviar, documentación y distintivo.
- **Quien transporta (20 a 22):** el alta, el perfil y la cobertura, y cómo
  lo encuentra quien compra.
- **Al final:** cómo se comprueba y «Lo que el programa no comprueba», con
  12 frases y su motivo.

Teléfono y suscripciones no se describen, como pediste. Donde la pantalla los
muestra (el campo «Teléfono», «Contactar por WhatsApp»), la guía sólo los
nombra.

## El programa

`scripts/guia-usuario.mjs`, con el molde de `guia-admin.mjs`. En cada ancho
crea sus cuentas, publicaciones y órdenes, y recorre los 22 pasos:

- **las citas:** cada texto entre «» del paso aparece en la pantalla durante
  su recorrido. Las que la guía dice que son del celular («En el celular…»)
  se buscan sólo ahí, y al revés;
- **las frases de resultado:** 131 frases atadas a una comprobación en computadora y 133 en
  celular. Si la frase cambia, el paso falla aunque la comprobación pase;
- **el inventario:** los botones y campos de cada pantalla que recorre un
  paso tienen que estar nombrados en su sección;
- **lo no comprobado:** antes de abrir el navegador mira que las 12 frases
  sigan escritas donde dice la lista.

El registro y el correo se recorren de verdad: el alta desde la pantalla, el
enlace leído del outbox local, y el ingreso. Nada sale por correo real.

## Negativos

`python3 scripts/sabotajes_user_guide_1.py` → «todos dieron el rojo
esperado» y «src, backend y la guía después: como estaban».

| sabotaje | rojo |
|---|---|
| `modelo-fuera-del-buscador` | 205: «buscar «ZX102637» en la API trajo 0 publicaciones y no la del modelo» |
| `recarga-sin-traslado` | 206: «dice «Traslado no definido.»» después de aprobar, confirmar, enviar y recibir; nada de alias ni calificación |
| `recarga-sin-transferencia` | 206: «la otra orden que espera el comprobante ya no muestra el alias»; nada más |
| `recarga-sin-calificar` | 206: «no aparece «Calificar Vendedor»»; nada más |
| `frase-falsa` | Paso 16: «la guía ya no dice “Una publicación pausada no se ve en el Mercado.”» |
| `cita-ausente` | Paso 1: «la guía nombra «Te enviamos un correo a …» y el sitio no lo mostró» |
| `control-sin-nombrar` | Paso 3: «la cabecera muestra «Quiénes somos» y la sección «Tu cuenta» de la guía no lo nombra» |

Además, el 206 contra el código anterior a la corrección da 6 problemas: los
cuatro traslados, «Calificar Vendedor» y el alias.

Los de la guía cambian una copia y recorren hasta el paso que cambia
(`--hasta`); cada uno tiene que dar una sola falla.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
node scripts/guia-usuario.mjs
# → LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular   (5 min los dos anchos)

python3 scripts/sabotajes_user_guide_1.py
# → todos dieron el rojo esperado   (reinicia la API dos veces)

SMOKE_CASOS=205,206 node scripts/smoke.mjs
# → 2/2 pasaron; 0 fallaron

grep -n -i -E "admin123|vendedor123|cliente123|@agroboeda|ejemplo\.com|topgreen\.com|contraseña: " docs/USER_MANUAL.md
# → sin salida
```

Aviso de entorno: el programa lee los correos del outbox, así que necesita
`EMAIL_TRANSPORT=outbox` (el de omisión), y para «Vincular Mercado Pago» usa
el `MP_AUTH_BASE_URL` de `backend/.env`. Si el correo sale por otro lado, se
detiene con «no se puede mirar».

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `d6b21a1` | «205/206 pasaron; 1 fallaron»: sólo el 131, de entorno. El 170 pasó |
| tipos, lint, build | verdes |
| `compileall`, `node --check`, parseo de Python | verdes |
| `alembic check` | `No new upgrade operations detected.` |
| diff-check con `cr-at-eol` | limpio |
| finales de línea | sólo cambia la guía: estaba en CRLF y la reescribí entera en LF, como `GUIA-PANEL-ADMIN.md`. El lector de la guía espera LF |
| a11y `--todas` | 80 de 80, sin violaciones bloqueantes |
| contraste | 88 de 88 |
| auditoría móvil | 12 de 12 recorridos, 39 pantallas, sin hallazgos |
| `guia-admin.mjs` | «LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular» |
| `SMOKE_CASOS=205,206`, después de los negativos | «2/2 pasaron; 0 fallaron» |
| `guia-usuario.mjs` | «22 pasos, 348 textos citados, 12 frases declaradas sin comprobar» y «LA GUÍA Y EL SITIO COINCIDEN: 22 pasos en escritorio y celular» |

## Riesgos y visto de paso

- **El inventario no cuenta** las opciones de los selectores (provincias,
  marcas: son datos), los botones que son sólo un signo («+», «-», «×»:
  igual se buscan como citas) ni el pie de página.
- **Las citas cortas son débiles:** «Cuenta» aparece dentro de otras palabras
  en casi cualquier pantalla.
- **El programa escribe en la base local** en cada corrida: cuentas,
  publicaciones y órdenes con un sello.
- **`guia-usuario.mjs` repite unas 250 líneas de `guia-admin.mjs`** (leer la
  guía, la vista, la API). Factorizarlas tocaría el programa del panel, que
  ya aceptaste; lo dejé para cuando haga falta.
- **P3, visto de paso:**
  - «Contactar por WhatsApp» aparece aunque quien vende no cargó teléfono, y
    el enlace va a WhatsApp sin número. Es del tema teléfono: no lo toqué.
  - En el checkout, «Nombre Completo», «Teléfono», «Dirección Completa»,
    «Código Postal» y «Notas» tienen un rótulo sin `for`: el lector de
    pantalla los nombra por el ejemplo del campo. La auditoría a11y no lo
    marca; supongo que toma el ejemplo como nombre, y no lo verifiqué.
