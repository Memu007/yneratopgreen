# Anatomías por tipo de operación

`Obligatorio` significa que la tarjeta no debe publicarse sin resolver el dato.
`Ausente` indica cómo mostrar una falta honesta. Nunca inferir un dato desde el
título o la fotografía.

## 1. Activo de alto valor

### Catálogo

| Dato | Regla |
|---|---|
| Nombre, categoría, ubicación, vendedor | Obligatorios |
| Condición | Obligatoria cuando aplica: nuevo/usado. Puede omitirse cuando el activo no admite esa clasificación —por ejemplo, hacienda o tierra—; nunca forzar un dato falso. |
| Precio o modalidad | Uno obligatorio: valor publicado o `A cotizar`; nunca `$0` |
| Año, horas, potencia | Opcionales; mostrar sólo los presentes, máximo tres comparables |
| Fotografía | Opcional; fallback neutro si falta o falla |
| Documentación | Sólo `Documentación revisada` cuando el booleano real sea `true` |
| Acción con precio | `Iniciar operación`; conserva una unidad y carrito/checkout actuales |
| Acción sin precio | No fingir compra. Requiere decisión de producto; ver `FUTURO-NO-IMPLEMENTAR.md` |

Títulos: hasta tres líneas. Ubicaciones largas pueden ocupar dos. El precio no
se trunca ni comparte línea con un CTA comprimido.

### Detalle

Obligatorios: nombre, categoría, condición, ubicación, vendedor, precio o
modalidad, descripción y CTA válido. Opcionales: operación ID, tabla técnica,
stock, año, horas, potencia, múltiples fotos y reputación real.

Si no hay características estructuradas, no parsear la descripción para crear
una tabla falsa. El prototipo muestra la anatomía deseada; el mapa marca que el
backend hoy entrega `features: {}`.

## 2. Insumo estandarizado

### Catálogo

| Dato | Regla |
|---|---|
| Nombre, categoría, ubicación, vendedor | Obligatorios |
| Precio, moneda y unidad | Obligatorios; ejemplo `$39.000 / bolsa de 50 kg` |
| Stock | Obligatorio y numérico |
| Cantidad | Control mínimo 44 px, rango 1–stock |
| Acción | `Agregar`; disabled con texto `Sin stock` |
| Foto | Opcional; no reemplazar con ilustración de categoría |

### Detalle

Repite precio/unidad/stock junto al selector de cantidad. La descripción y
presentación son datos distintos. Si el stock cambia, el error conserva la
cantidad válida más cercana y explica el límite.

## 3. Servicio

### Catálogo

| Dato | Regla |
|---|---|
| Nombre, categoría, ubicación base, prestador | Obligatorios |
| Cobertura | Obligatoria; zona o lista existente |
| Modalidad | Obligatoria: por hectárea, visita, proyecto u opción real |
| Precio | Valor real o `A cotizar`; nunca `$0` |
| Disponibilidad/tiempo de respuesta | Opcionales; no inventar si faltan |
| Acción con precio | `Contratar`; conserva carrito y checkout actuales, sin prometer mensajería ni reserva. |
| Acción sin precio | `Solicitar cotización` como puente a Contacto existente, sin prometer mensajería ni prefill. |

### Detalle

Prioriza cobertura, modalidad, disponibilidad, equipamiento declarado y
descripción. Un servicio con precio publicado se contrata como una unidad por el
checkout existente y no muestra selector de cantidad. Sin precio, deriva a
Contacto.

## 4. Logística

Hay dos contextos que no deben mezclarse.

### Publicación de un servicio logístico

Obligatorios: prestador, base, tipo de equipo, carga declarada, cobertura/radio,
modalidad y precio o `A cotizar`. Con precio publicado usa `Contratar`; sin
precio usa el puente a Contacto.

### Selección de transportista en checkout

Obligatorios: destino, grupo/vendedor, origen, transportista, base, transporte,
modelo si existe, cargas declaradas, cobertura, distancia y acción de elegir.

`Ver transportistas` sólo está activo cuando:

1. existe carrito sincronizado;
2. el usuario indicó localidad de destino;
3. `/logistics/compatible-carriers` devolvió resultado vigente.

Antes de eso el control se oculta o aparece disabled con explicación. No existe
un directorio público. El dominio del vehículo sólo aparece después de elegir,
tal como implementa hoy el backend.

## Estados transversales

- Obligatorio ausente: impedir envío y explicar el campo.
- Opcional ausente: omitir fila; no mostrar guiones acumulados.
- Foto ausente: `Sin fotografía`.
- Foto rota: `No pudimos cargar la imagen` y mismo acceso al detalle.
- Precio ausente: `A cotizar`.
- Ubicación larga: envolver hasta dos líneas en catálogo, sin ellipsis del país.
- Vendedor largo: envolver; la acción queda en línea propia.
- Publicación pausada: no aparece en catálogo público; sí en panel del vendedor.
