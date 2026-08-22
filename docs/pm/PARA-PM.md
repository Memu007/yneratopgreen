# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-22. Decimocuarto informe: **datos logísticos validados en producto**.

Commit de producto `3aa6d32`. Los tres datos entraron con **tres reglas
distintas**, y esa diferencia es la pieza:

| Dato | Regla | Dónde se decide |
|---|---|---|
| Marca y modelo | público | se ve en la tarjeta, para comparar antes de elegir |
| **Dominio** | **privado** | no está en el esquema del candidato: aparece con el contacto |
| Cargas declaradas | público, **no filtra** | es declaración; no decide quién aparece ni en qué orden |

## 1. La migración

`d5b21e8f4c73`, sobre `c3f81a5d0e47`. Agrega cuatro columnas nulables a
`users` y nada más: no toca las existentes, no reescribe filas y no tiene
`server_default`, así que un perfil ya cargado sigue siendo válido sin
completar ninguna.

Ida y vuelta con datos adentro, con los tres estados que puede tener una
declaración:

| Fila | Antes | Después de bajar | Después de volver a subir |
|---|---|---|---|
| declaración del catálogo | `["granos_a_granel","maquinaria"]` | columnas ausentes; transporte, radio y base intactos | columnas presentes, en `NULL` |
| «Otra» con detalle | `["otra"]` + «Bidones de 200 litros» | ídem | ídem |
| sin declarar | `NULL` de SQL | ídem | ídem |

Filas totales antes y después: **10 usuarios, 1 orden, 30 publicaciones**.
`alembic check`: *No new upgrade operations detected*.

**Lo digo sin adornarlo: bajar la migración pierde los tres datos.** Es lo que
significa quitar una columna, y por eso el downgrade no intenta guardarlos en
ningún lado. Lo que la vuelta garantiza es que **el resto del perfil no se
toca**: transporte, habilitación, radio y localidad base salieron iguales.

Seed repetido: corrió **dos veces seguidas sobre una base que ya tenía datos**
y las dos veces terminó en 10 usuarios y 30 publicaciones, con el transportista
demo en `Scania R450 · DEMO 01 · granos_a_granel, maquinaria`. Rellena sólo lo
que está vacío: no pisa un valor cargado a mano.

## 2. Superficies, dato por dato

| Superficie | Marca | Cargas | Dominio |
|---|:---:|:---:|:---:|
| Alta (`POST /auth/register`) | escribe | escribe | escribe |
| Perfil propio (`UserResponse`) | sí | sí | **sí, sólo su titular** |
| **Listado de candidatos** (`CarrierCandidate`) | sí | sí | **no está en el esquema** |
| Consulta SQL del directorio | se trae | se trae | **no se selecciona** |
| Catálogo `GET /logistics/cargo-types` | — | vocabulario | no |
| Tras seleccionar (`SelectedCarrier`) | sí | sí | **sí, con el contacto** |
| Traslado de la orden (`OrderShipping`) | sí | sí | sí |

Dos cosas que quiero que mires y no que descubras después:

1. **El dominio queda afuera por ausencia, no por prudencia.** No hay un lugar
   donde se decida «acá no lo mando»: el tipo `CarrierCandidate` no tiene el
   campo y la consulta del directorio no lo trae. Un descuido futuro al
   escribir una respuesta no puede filtrarlo, porque no hay de dónde.
2. **En la orden ya creada, el dominio lo ve también el vendedor.** La selección
   ya ocurrió y el vendedor es parte de esa operación —es su mercadería la que
   se mueve—, así que lo tomé como dentro de la reserva. Si querés que sea sólo
   del comprador, decilo y lo acoto: es un campo en `traslado_de`.

## 3. Evidencia

**Suite completa desde base limpia: 114/114, 0 fallas.** Cuatro casos nuevos y
uno ampliado:

| Caso | Qué prueba |
|---|---|
| 111 | el dominio no existe antes de elegir y aparece al elegir; una selección nueva no arrastra la anterior |
| 112 | agregar, vaciar y estrenar declaraciones deja **los mismos candidatos en el mismo orden** |
| 113 | normalización, «Otra» con detalle obligatorio, límites anunciados y permisos |
| 114 | en el navegador: se comparan marca y cargas, el dominio recién al elegir |
| 22 (ampliado) | el **alta** manda los tres datos y quedan normalizados en la base |

### Contra el commit anterior

Como pediste, los cinco corren contra `6d6b985` y **los cinco caen**, cada uno
por su propiedad:

| Caso | Cómo cae en el commit anterior |
|---|---|
| 111 | «la marca no llegó al listado» |
| 112 | «sin declarar nada la lista tendría que venir vacía» |
| 113 | «un alta sin los datos nuevos no los deja vacíos» |
| 114 | «el titular no ve su marca y modelo» |
| 22 | el campo del alta no existe: **cae por tiempo de espera, no por una afirmación** |

Ese último es más flojo que los otros cuatro y lo marco yo: un tiempo de espera
agotado prueba que el campo no está, no *por qué* tiene que estar.

### Roturas controladas sobre el código de hoy

Por eso hice además tres roturas dirigidas, que son la evidencia más filosa
porque el resto del sistema sigue funcionando:

| Rotura | Cae | Con qué mensaje |
|---|---|---|
| el dominio entra al esquema del candidato | 111 | el listado lo trae antes de elegir |
| las cargas deciden quién aparece | 112 y 111 | un filtro por carga borra al que no declara |
| el alta tilda las casillas pero no las manda | 22 | `cargas SQL en otro orden o con otro contenido: ` |
| el orden guardado es el de los clics | 22 y 113 | `["otra", "granos_a_granel"]` en vez del catálogo |

Esa última es la que me importa: la afirmación no comprueba pertenencia, sino
**orden de catálogo**, así que dos perfiles que declaran lo mismo se leen igual
aunque hayan tildado en distinto orden.

### Puertas

| Puerta | Resultado |
|---|---|
| Suite completa desde base limpia | **114/114** |
| Puerta del hito | 6/6 pasos encadenados |
| `alembic check` | sin diferencias |
| Ida y vuelta de la migración | arriba |
| Build | limpio, `tsc` sin errores |
| Accesibilidad, escritorio y 390×844 | **64/64 pantallas, 0 violaciones** |
| Contraste, escritorio y 390×844 | **52/52 mediciones, 0 incumplimientos** |

## 4. Dos cosas que encontré, y que no eran la tarea

**Una: la columna JSON guardaba el `null` de JSON, no `NULL` de SQL.** Lo
encontré porque mi primera rotura no volteaba el caso: la consulta que armé
para excluir a los que no declaran nada no excluía a nadie, y el caso pasaba
sin haber probado nada. Quedó con `none_as_null=True`. Si no lo agarraba ahí,
lo agarrábamos el día que alguien escribiera un informe con `IS NULL` y le
diera cero.

**Dos: el radio de cobertura del alta no tiene etiqueta asociada.** Lo encontró
la puerta de accesibilidad **la primera vez que alguien midió esa pantalla**:
el inventario nunca tildaba la casilla de transportista, así que media pantalla
del alta jamás se había medido. Los demás campos zafaban por tener marcador de
posición —que desaparece al escribir y no es una etiqueta—; el radio, que es
numérico y no tiene marcador, se quedaba sin nombre accesible: `critical`.

Agregué esa pantalla al inventario de las dos puertas, junto con el perfil del
transportista en lectura y en edición. Son seis mediciones nuevas.

## 5. Alcance que agregué por mi cuenta

Te lo digo explícito porque no me lo pediste:

1. **Asocié las etiquetas de todo el alta**, no sólo la del radio. Arreglar un
   solo campo dejaba la misma falla a un marcador de posición de distancia. Son
   `id` y `htmlFor`: no cambia comportamiento, y ahora hacer clic en la etiqueta
   enfoca el campo.
2. **Las cargas también se declaran en el alta**, no sólo en el perfil. Cuando
   revisé el inventario me encontré con que el alta pedía marca y dominio pero
   no cargas, y no hay ninguna razón que sostenga esa línea: los tres son
   opcionales, ninguno filtra nada y el catálogo es público. Si me decís que el
   alta ya es larga, lo saco de ahí — pero entonces saco los tres, no dos.

## 6. Riesgos

1. **El downgrade pierde los tres datos.** Dicho arriba; es inherente.
2. **`git diff --check` no sirve como puerta absoluta en este repo.** Señala
   como «trailing whitespace» el retorno de carro de **cada línea agregada** en
   los archivos que ya vienen con CRLF. No es algo de esta pieza: `git show
   --check` sobre el commit de documentación que aceptaste señala **1803**
   líneas por lo mismo. Leído como corresponde para un repo con archivos CRLF
   —`core.whitespace=cr-at-eol`— mi diff sale **limpio**: cero espacios al
   final, cero tabulaciones. El riesgo real es que el repo tiene fines de línea
   mezclados y eso ensucia cualquier diff futuro. Es una limpieza aparte y no
   la abro sin que la pidas.
3. **El dominio no se valida.** Está fuera de alcance por tu orden, y lo
   respeto. Queda dicho que `DEMO 01` o `cualquier cosa` entran igual: sólo se
   recortan espacios y se corta en 20 caracteres.
4. **«Otra» es texto libre de 120 caracteres y se muestra a compradores.** Se
   normaliza el espaciado, pero lo que escriba el transportista se lee tal
   cual. Si en algún momento querés moderación ahí, es alcance nuevo.

## 7. Lo que sigue abierto de la pieza anterior

Las cuatro decisiones del prototipo quedaron resueltas por tu orden del
2026-08-15, salvo una que no cerraste y sigue viva: **el límite del MVP**. Si
aparece necesidad de cotización, pago o seguimiento adentro de TopGreen, es
alcance nuevo y contractual.

Vuelvo a PM. No abro otra mejora.
