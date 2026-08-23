# Diccionario de copy y formato

## Voz

TopGreen habla como una contraparte comercial informada: precisa, sobria y
directa. Explica condiciones y próximos pasos sin grandilocuencia.

- Preferir verbos concretos: `Agregar`, `Publicar`, `Revisar`, `Continuar`.
- Nombrar el objeto: `Ver condiciones`, no `Conocer más`.
- Describir el estado, no interpretar al usuario: `No pudimos cargar…`, no
  `¡Ups! Algo salió mal`.
- Usar voseo rioplatense en instrucciones: `Ingresá`, `Elegí`, `Revisá`.
- Evitar exclamaciones, diminutivos, emojis y humor en una operación.

## Acciones por anatomía

| Caso | Acción primaria | Secundaria | Regla funcional |
|---|---|---|---|
| Activo de alto valor con precio | `Iniciar operación` | `Ver condiciones` | La primaria conserva carrito y checkout actuales; no abre chat ni negociación. |
| Insumo con stock | `Agregar` | `Ver detalle` | Requiere cantidad cuando corresponda. |
| Insumo sin stock | `Sin stock` | `Ver detalle` | Primaria deshabilitada, sin urgencia artificial. |
| Servicio | `Solicitar cotización` | `Ver alcance` | En esta versión deriva a Contacto; no promete una solicitud ligada a la publicación. |
| Logística pública | `Solicitar cotización` | `Ver cobertura` | Describe el servicio publicado. |
| Logística en checkout | `Elegir transportista` | `Traslado por cuenta propia` | Sólo después de destino y carrito sincronizado. |

`Ver transportistas` queda deshabilitado fuera del checkout con la ayuda:
`Disponible al definir el destino de entrega.` No existe hoy un directorio
público de transportistas.

## Navegación y búsqueda

- Nombre de sección: `Mercado` en navegación; `Marketplace agro` puede seguir
  como contexto accesible durante la migración, pero no como headline.
- Buscador: `Buscar producto, servicio o ubicación`.
- Botón: `Buscar`.
- Filtros: `Tipo de publicación`, `Categoría`, `Provincia`, `Localidad`,
  `Precio`, `Disponibilidad`, `Calificación del vendedor`.
- Localidad bloqueada: `Elegí una provincia primero`.
- Orden: `Ordenar por` + `Más relevantes`, `Menor precio`, `Mayor precio`.
- Conteo: `30 operaciones` o `1 operación`; evitar `items` y, para el conjunto
  mixto, evitar `productos`.
- Aplicación mobile: `Ver 30 resultados`.
- Limpieza: `Limpiar filtros`.

No sumar valores de filtro que la API no entregue. El prototipo muestra la
estructura y no autoriza a hardcodear opciones.

## Precio, stock y estados

| Estado | Copy aprobado |
|---|---|
| Precio publicado | `$ 98.000.000` |
| Precio no publicado | `A cotizar` |
| Stock singular | `1 disponible` |
| Stock plural | `25 disponibles` |
| Sin stock | `Sin stock` |
| Pausada | `Publicación pausada` |
| Sin fotografía | `Sin fotografía` |
| Imagen fallida | `No pudimos cargar la imagen` |
| Sin calificaciones | `Sin calificaciones aún` |
| Carga | `Cargando operaciones` |
| Vacío filtrado | `No hay operaciones con estos filtros.` |
| Error | `No pudimos cargar el mercado.` |
| Sin conexión | `Sin conexión. Revisá tu red e intentá de nuevo.` |

No mostrar `$ 0` para servicios o publicaciones sin precio: usar `A cotizar`.

## Evidencia y confianza

Permitido sólo cuando existe el dato correspondiente:

- `Documentación presentada` para una presentación registrada.
- `Documentación revisada` exclusivamente cuando el booleano real sea
  verdadero.
- `4,8 · 26 calificaciones` si existen ambas magnitudes.
- `12 ventas` si el backend expone esa cantidad.
- `Sin calificaciones aún` cuando no hay ninguna.

Claims prohibidos sin un proceso y dato auditables:

- `Vendedor verificado`, `Operación segura`, `Compra protegida`.
- `Garantizado por TopGreen`, `Precio validado`, `Documentación aprobada`.
- `Mejor precio`, `Oferta única`, `Última oportunidad`.
- Contadores de interesados, visitas o escasez simulados.

## Formato inicial — Argentina

- Moneda: símbolo y miles con punto, sin decimales para ARS:
  `$ 98.000.000`. Si hay moneda extranjera: `USD 120.000`.
- Cantidad + unidad: espacio duro visual entre ambas: `250 kg`, `1.200 km`.
- Decimales: coma (`4,8`).
- Fecha corta: `22 ago 2026`; evitar fechas ambiguas como `08/09/26`.
- Hora: `14:30`.
- Ubicación: `Localidad, Provincia`; país cuando cruza frontera:
  `Ribeirão Preto, São Paulo, Brasil`.
- Teléfono y datos de contacto mantienen privacidad actual y se comparten sólo
  en el punto funcional vigente.

## Internacionalización

La implementación debe usar `Intl.NumberFormat`, `Intl.DateTimeFormat` y
catálogo de unidades; no concatenar símbolos. Moneda, locale, país y sistema de
unidades son parámetros. El orden del domicilio debe poder cambiar por locale.
Los botones admiten hasta 30 % más de longitud sin truncarse. Las fuentes
incluidas cubren alfabeto latino; ampliar subset antes de abrir idiomas que
requieran otros scripts.

## Lenguaje que no crea producto

- `Mesa de negocios` es dirección conceptual, no nombre público ni ruta.
- `Iniciar operación` no significa chat, reserva, tasación ni escrow.
- `Solicitar cotización` no implica hoy una solicitud asociada a la publicación.
- `Ver transportistas` no habilita búsqueda pública: pertenece al checkout.
- No usar `seleccionado`, `recomendado por TopGreen` o `verificado` como sellos.
