# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-15. Undécimo informe: **los dos bordes de la revisión documental**.

Leído `d11f45f`. Los dos hallazgos son correctos y los dos eran reales. Corregí
sólo esos dos y no toqué nada más. No abrí otra función, ni MP-D, ni Railway.

## 1. Aprobar un papel que nadie abrió

Tenías razón y el agujero es peor de lo que parece escrito: no hace falta mala
fe ni una carrera rara. Alcanza con que administración abra la cola, se
distraiga, y el vendedor mientras tanto corrija su constancia. El botón de la
pantalla vieja aprueba la nueva.

La decisión ahora lleva **el `presentado_el` que la cola mostró** y se compara
exacto. Si la presentación cambió, 409 con el motivo escrito: «el vendedor
reemplazó su documentación después de que la abriste».

Dos detalles del cómo:

- La comprobación va **antes** que la del estado. Si lo que se revisó ya no
  está, en qué quedó la fila no importa; contestar «ya fue revisada» sería
  contestar sobre otra cosa.
- El campo es **obligatorio**. Una decisión sin discriminante ya no se puede
  mandar, ni por descuido ni por un cliente viejo: falla cerrado.

No expuse `archivo_ruta` ni agregué historial de PDF, como pediste. La cola ya
devolvía `presentado_el`, así que el discriminante no agrega ni un dato nuevo a
la respuesta.

Del lado de la interfaz, el panel manda el `presentado_el` **de la fila que se
está mirando**, no uno que vuelve a pedir: pedirlo de nuevo al apretar el botón
volvería a leer la presentación actual y taparía el mismo problema.

## 2. La privacidad ya no depende de escribir bien una variable

También correcto, y es el que más me interesa haber cerrado: era una falla que
**no rompe nada**. Con `DOCUMENTOS_DIR` adentro de `UPLOAD_DIR`, la aplicación
guarda bien, sirve bien, las pruebas pasan y las constancias fiscales quedan
descargables por cualquiera que adivine una URL. Nada avisa.

Ahora `Settings` se niega a arrancar si la carpeta privada resuelta es igual a
`UPLOAD_DIR` o desciende de ella. El mensaje nombra las dos variables, dice
dónde termina publicándose y propone dónde poner la carpeta:

> DOCUMENTOS_DIR (…/uploads/constancias) está dentro de UPLOAD_DIR (…/uploads),
> que se publica entero en /uploads. Las constancias fiscales quedarían
> descargables por cualquiera. Poné DOCUMENTOS_DIR en una carpeta aparte, por
> ejemplo 'documentos' al lado de 'uploads' o /data/documentos junto a
> /data/uploads.

Los valores de desarrollo y producción no cambiaron.

## 3. Los dos rojos, discriminantes

Cada rotura voltea **sólo** su caso. Lo verifiqué en las dos direcciones, y la
primera vez me salió mal: dejé el proceso viejo corriendo y el 109 falló por eso
y no por el rojo. Lo rehice reiniciando la API con un solo borde vivo.

| Rotura temporal, sobre lo aceptado en `b8fee0e` | 109 | 110 |
|---|---|---|
| La decisión no compara la presentación | **FAIL** | PASS |
| La configuración acepta la carpeta adentro de uploads | PASS | **FAIL** |

**Caso 109.** Una cuenta nueva presenta A; administración lo abre de verdad
—`GET .../archivo`, HTTP 200— y se guarda lo que la cola mostró; el titular
presenta B; la aprobación llega con A. Afirma: 409, estado sigue pendiente, sin
revisor ni fecha, **sin transición auditada** y distintivo apagado. Después
recarga la cola, aprueba la presentación actual y comprueba que el aprobado es B
y que quedó exactamente una transición.

**Caso 110.** Cuatro configuraciones peligrosas rechazadas al arrancar: la misma
carpeta, una subcarpeta, una que da la vuelta con `..` y una con rutas
absolutas. Afirma además que el motivo nombra las dos variables, y que **las dos
plantillas versionadas siguen cargando**: una comprobación nueva que rompe la
configuración que se entrega no sirve de nada.

## 4. Puertas

| Puerta | Resultado |
|---|---|
| Suite completa desde base limpia | **110 de 110**, 0 fallas |
| Migración: ida, vuelta con datos, ida | verde |
| `alembic check` | sin diferencias |
| `npm run build` | verde |
| `git -c core.whitespace=cr-at-eol diff --check` | limpio |

La vuelta atrás la hice con 5 presentaciones, 41 usuarios y 49 publicaciones
adentro: borra la tabla y deja intacto todo lo demás, y la ida la recrea vacía.

**Accesibilidad y contraste no los repetí, y digo por qué:** el único cambio de
interfaz es un campo más en el cuerpo de una petición. No hay un nodo, un texto
ni un color distinto en pantalla. Si preferís la corrida igual, la corro.

## 5. Uno más que encontré al escribir el caso 110

El ayudante `cargarConSettings` de la suite filtra el traceback para quedarse
con el motivo, y su filtro no contemplaba las líneas «Value error», que es la
forma que toma un rechazo escrito a mano en un validador. Resultado: el motivo
se perdía entero y la prueba sólo podía afirmar «no cargó», no por qué. Agregué
esa forma al filtro. Es el mismo tipo de cosa que el recorte de `querySql` del
informe anterior: ayudantes que esconden justo lo que la prueba tiene que mirar.

## 6. Lo que sigue sin cambiar

El modelo informativo, los permisos, el almacenamiento privado, la interfaz, el
distintivo exacto y los casos 101–108 quedaron como los aceptaste. No agregué
dependencias, no toqué pagos ni stock, y esto sigue sin verificar identidad.

Vuelvo a PM. No abro otra función antes de la firma.
