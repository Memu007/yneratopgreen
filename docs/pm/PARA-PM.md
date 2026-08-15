# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-15. Décimo informe: **documentación de vendedores revisada**.

Entregada. Es informativa y no bloquea nada: sin presentar, pendiente, aprobada
o rechazada, el vendedor publica, vende y cobra igual. Lo único que cambia una
aprobación es que aparece el distintivo.

Al día hasta `eec1885`. No investigué MP-D, no toqué Railway, no cambié ninguna
bandera y no abrí ninguna otra función.

## 1. Lo que se guarda, que es lo mínimo

Una fila por usuario en `documentacion_de_vendedores`. Reemplazar no acumula: la
fila es la misma y el archivo anterior deja de existir.

| Se guarda | Para qué |
|---|---|
| `cuit`, once dígitos sin guiones | identificar la presentación |
| `razon_social` | idem |
| `archivo_nombre` | mostrárselo al titular y a quien revisa |
| `archivo_ruta` | dónde está el PDF; el nombre en disco es un UUID |
| `archivo_bytes` | mostrar el peso en la cola |
| `estado` | pendiente, aprobada o rechazada |
| `motivo_de_rechazo` | lo que el titular tiene que corregir |
| `revisado_por_id`, `revisado_el` | quién decidió y cuándo |
| `presentado_el`, `actualizado_el` | fechas |

El PDF **no** va a la base ni a `UPLOAD_DIR`. Va a `DOCUMENTOS_DIR`: carpeta
aparte, ignorada por Git, permisos 0600, nombre de archivo aleatorio. Aparte y
**no una subcarpeta**, y el motivo es concreto: `UPLOAD_DIR` entero está montado
como estático público, así que cualquier cosa que caiga adentro se sirve sin
preguntar quién la pide.

El cuarto estado —«sin presentación»— no es un valor guardado sino la ausencia
de fila. Guardarlo obligaría a distinguir «nunca presentó» de «presentó y se
borró», una diferencia que no le sirve a nadie.

La auditoría existente registra las transiciones —`documentacion_presentada` y
`documentacion_revisada`, con actor, fecha y el par de estados— y **no** repite
el CUIT ni la razón social: duplicar el dato fiscal en otra tabla es duplicar lo
que hay que cuidar.

## 2. Permisos

- Las rutas del titular **no toman a quién pertenece la documentación**: operan
  sobre quien pide. No es una comprobación que se pueda olvidar, es que no hay
  parámetro con el que apuntar a otro.
- Cola, PDF ajeno y decisión exigen administrador: un no administrador recibe
  403 en las tres.
- El PDF no tiene URL pública. Sale por un endpoint que primero decide, con
  `Cache-Control: private, no-store` y `nosniff`. Como el navegador no manda el
  token en un `<a href>`, la interfaz lo pide con sesión y abre lo recibido: no
  queda un enlace que se pueda copiar y pasar.
- A lo público sale **un booleano**. El caso 103 lo afirma buscando el CUIT, la
  razón social y el archivo en la respuesta del detalle y de la reputación, y el
  108 los busca en el texto de la pantalla.

## 3. Archivos borrados

Se conserva **sólo el actual**. Al reemplazar, el anterior se borra del disco
después de que el reemplazo quedó confirmado; al revés, un commit fallido
dejaría al vendedor sin ninguno de los dos. El caso 105 comprueba que la ruta
vieja ya no existe, que la nueva sí, y que la cantidad de archivos en la carpeta
no cambió.

Un rechazo del validador no deja nada, porque el archivo se escribe recién
cuando todo lo que podía rechazar ya rechazó. El caso 102 mide filas y archivos
antes y después de seis rechazos y los dos números quedan iguales.

## 4. El distintivo

Dice exactamente **«Documentación revisada»**. No usé «verificado» en ninguna
parte y el caso 108 falla si esa palabra aparece en el detalle.

Sale de un derivado del estado actual y no de una columna aparte: así retirarlo
al reemplazar no depende de acordarse de apagar una marca en otro lado. Se
muestra en los dos lugares que ya existían —el bloque de vendedor del detalle y
el modal de perfil, que se alimenta de la reputación—. No hay ruta ni perfil
público nuevo.

**Un desvío que quiero que veas.** El modal de detalle no consulta el endpoint
de detalle: se abre con el objeto de la tarjeta del catálogo. Para que el
distintivo llegue al bloque del vendedor hubo que agregarlo también a la
respuesta de la tarjeta, con un `outerjoin` acotado a la documentación aprobada
—que no multiplica filas porque hay una por usuario— en vez de una consulta por
publicación. La grilla **no** lo dibuja: el dato viaja, el cartel no.

## 5. Rol de vendedor: no hizo falta inventarlo

El modelo actual no distingue vendedor, cualquier usuario publica. La
presentación es de la persona y la sección vive en el panel que ya tiene. No
agregué un rol y no queda nada esperando decisión tuya por este lado.

## 6. Pruebas

Ocho casos nuevos, 101 a 108. La suite pasa de 100 a **108**.

Los cuatro que pediste demostrar en rojo los rompí de a uno en el producto,
corrí el caso y restauré. La rotura no se versiona.

| Rotura temporal | Caso | Resultado |
|---|---|---|
| La cola deja de exigir administrador | 101 | **FAIL** — «la API no respondió HTTP 403» |
| No se mira la firma del PDF | 102 | **FAIL** — «la API no respondió HTTP 400» |
| Reemplazar no vuelve a pendiente | 104 y 105 | **FAIL** — «reemplazar dejó "aprobada" y no pendiente» |
| Sin candado de fila ni 409 al decidir | 106 | **FAIL** — «devolvieron [200,200]» |

Antes del rojo de permisos comprobé que la rotura estuviera viva en el proceso
que iba a atender la prueba —un vendedor pidiendo la cola y recibiendo 200—. Esa
comprobación no es ceremonia: más abajo cuento cómo la misma omisión me costó
una corrida entera.

Los ocho en verde cubren tus siete puntos:

| # de tu lista | Caso |
|---|---|
| 1 permisos entre usuarios y de no administradores | 101 |
| 2 CUIT, tamaño, tipo y archivo disfrazado sin fila ni huérfano | 102 |
| 3 pendiente sin distintivo, aprobación con una sola transición auditada | 103 |
| 4 rechazo con motivo, visible al titular, y corrección | 104 |
| 5 reemplazo de una aprobada | 105 |
| 6 dos decisiones concurrentes | 106 |
| 7 publicar y comprar en los cuatro estados | 107 |
| de punta a punta en navegador | 108 |

El 107 recorre los cuatro estados sobre una cuenta estrenada dentro del caso:
reusar la de los casos anteriores habría medido «pendiente» dos veces y dejado
«sin presentación» sin probar **sin que nada fallara**.

## 7. Puertas

| Puerta | Resultado |
|---|---|
| Suite completa desde base limpia | **108 de 108**, 0 fallas |
| Puerta del hito | 6 de 6 pasos, encadenados |
| Migración: ida, vuelta con datos, ida | verde |
| `alembic check` | sin diferencias |
| `npm run build` | verde |
| `npm run a11y -- --todas` | **62 de 62 pantallas**, 0 violaciones de cualquier impacto |
| `npm run contraste` | **46 de 46 mediciones**, 0 textos por debajo del mínimo |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

El inventario de las dos puertas visuales creció con las pantallas nuevas: 62 y
46 son los números exigidos ahora, en las dos medidas.

La migración ida y vuelta la hice con datos adentro: dos presentaciones, 6
usuarios y 30 publicaciones. La vuelta borra la tabla y el tipo enumerado y deja
**intacto todo lo demás**; la ida la recrea vacía. Los PDF en disco no los toca
una migración: se limpian con la carpeta. Conviene saberlo antes de una vuelta
atrás en producción.

## 8. Lo que encontré de paso

**1. `apiUpload` del frontend estaba roto y nadie lo usaba.** Mandaba
`Content-Type: application/json` junto con un `FormData`, así que el multipart
viajaba sin el `boundary` que separa las partes. Lo arreglé en `apiFetch` —si el
cuerpo es `FormData`, el encabezado lo pone el navegador— porque esta pieza es
la primera que sube un archivo desde la interfaz.

**2. `querySql`, el ayudante SQL de las puertas, recorta la salida.** Una
columna vacía al final se pierde y la fila vuelve con menos campos de los que se
pidieron. Me hizo pasar un caso que no probaba lo que decía. No toqué el
ayudante, que lo usan todas las puertas: lo resolví en mi consulta con una
columna fija al final, explicado ahí mismo.

**3. Una deuda vieja de administración, que no toqué.** Las pestañas de
categorías y configuración se dibujan **fuera** del contenedor con desplazamiento
del panel, porque el `div` que lo abre se cierra antes de tiempo. Se ve como un
hueco en blanco y como una sección que se sale del marco. Mi pestaña caía en la
misma trampa por estar al lado; la moví adentro. Las otras dos las dejé como
estaban: arreglarlas es otra pieza y dijiste no rediseñar administración.

## 9. Dos errores míos, y lo que cambié para no repetirlos

Los cuento porque los dos produjeron evidencia falsa.

**Normalicé finales de línea sin querer.** Varios archivos del repositorio
tienen finales mezclados; editarlos los uniformó y el diff pasó a mostrar 2433
líneas cambiadas, la mayoría que yo no toqué. Restauré el final original de cada
línea igual comparando contra `HEAD`. El cambio real es **1672 líneas agregadas
y 19 modificadas**, y `diff --check` queda limpio.

**Corrí una suite entera contra código roto.** Al terminar el cuarto rojo quise
matar la API con `pkill -f "uvicorn app.main:app"`, pero el comando anterior de
la misma línea —`pkill -f "node scripts/smoke.mjs"`— se mató a sí mismo, así que
el segundo `pkill` nunca corrió. La API vieja siguió viva con el candado
removido, la nueva no pudo tomar el puerto y yo no miré el log. Veinte minutos
de corrida contra la versión rota; el caso 106 falló, correctamente, y por un
rato lo tomé por intermitencia. Antes, otras dos corridas se pisaron entre sí
por la misma causa.

Lo que hago desde entonces, y con lo que corrí todo lo que informo acá: **matar
por PID explícito, contar los procesos vivos, mirar el log del arranque y
comprobar el comportamiento contra la API antes de largar nada que tarde.** Los
números de la tabla de puertas salen de corridas hechas así.

## 10. Lo que no hice

Sin RENAPER, ARCA, DNI, biometría, OCR, consulta fiscal automática, alertas de
vencimiento, monitoreo, puntuación de riesgo ni bloqueo de cuentas. **Sin
dependencia nueva**: la firma del PDF se comprueba con los primeros bytes y el
marcador de fin, que alcanza para que un archivo disfrazado falle antes de
guardarse. Sin rediseñar administración. Sin tocar pagos, stock ni la
elegibilidad para vender.

Y una aclaración que dejo escrita porque la pieza invita a confundirla: esto
**no verifica identidad**. Comprueba el formato del CUIT, que el archivo sea un
PDF de verdad, y que una persona lo haya mirado. Que el CUIT exista, que sea de
quien dice y que la constancia sea auténtica no se comprueba en ningún lado. El
texto del distintivo es lo único que la plataforma afirma.

Con esto vuelvo a PM y no abro otra función, como quedó ordenado para antes de
la firma.
