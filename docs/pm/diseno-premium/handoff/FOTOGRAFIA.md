# Manual de fotografía y fallbacks

## Rol

La fotografía prueba condición, escala y contexto. No es un fondo emocional ni
un reemplazo de la ficha técnica. Una publicación debe seguir siendo legible y
confiable sin fotografía.

## Dirección

- Luz natural o industrial neutra; color realista, sin virados verdes/dorados.
- Punto de vista humano y documental; horizontes rectos y escala comprensible.
- Equipos completos en la toma principal y detalles críticos en las siguientes.
- Personas sólo en actividad real, con consentimiento y elementos de seguridad.
- Campo, planta o depósito como contexto operativo, no como paisaje aspiracional.
- Evitar gran angular extremo, HDR, bokeh artificial y cielos reemplazados.

## Set mínimo por tipo

| Tipo | Principal | Evidencia adicional |
|---|---|---|
| Activo de alto valor | Vista tres cuartos, equipo completo | Laterales, cabina, motor, horas, serie, desgaste, accesorios. |
| Insumo | Envase o lote identificable | Etiqueta, vencimiento/lote, estado de embalaje, escala. |
| Servicio | Trabajo real en contexto | Equipo, proceso, alcance territorial; no apretón de manos. |
| Logística | Unidad completa y configuración | Caja/cisterna/acoplado, capacidad, habilitaciones visibles cuando correspondan. |

No publicar datos personales, patentes ni documentación sensible sin tratamiento
legal y consentimiento.

## Formatos y recorte

- Principal: relación preferida `4:3`, mínimo 1600×1200 px.
- Destacada horizontal: `16:9`, mínimo 1920×1080 px.
- Miniaturas: derivadas `4:3`; nunca estirar.
- Perfil de color: sRGB. Producción: WebP/AVIF con fallback según soporte.
- Objetivo de peso: hasta 500 KB principal y 160 KB miniatura, sujeto a prueba
  perceptual; el original se conserva fuera del frontend.
- Mantener 10 % de zona segura alrededor del sujeto.
- Si un recorte elimina información material, usar `object-fit: contain` con
  fondo porcelana; no completar bordes con IA.
- No reencuadrar una imagen vertical como horizontal cortando el equipo: admitir
  bandas neutras y mostrar el original en galería.

## Calidad y verdad

- No generar maquinaria, cultivos, etiquetas, matrículas ni documentación con
  IA para publicaciones reales.
- No clonar, borrar o añadir desgaste, piezas, cargas o personas.
- Correcciones permitidas: exposición, balance de blancos y contraste moderado,
  siempre sin alterar condición aparente.
- Marcas de agua de terceros y fotos tomadas de fabricantes requieren licencia
  expresa y deben distinguirse de fotos del activo ofrecido.

## Fallback final

El sistema distingue dos estados con activos propios:

- `assets/no-photo.svg`: el vendedor no aportó una imagen. Copy:
  `Sin fotografía`.
- `assets/photo-broken.svg`: había una URL pero falló. Copy:
  `No pudimos cargar la imagen` y, cuando corresponda, acción `Reintentar`.

Ambos son deliberadamente neutros. No mostrar ilustraciones repetidas por
categoría: producen inventario ficticio y hacen que distintas publicaciones
parezcan el mismo bien. El fallback nunca debe ocupar más jerarquía que título,
precio o condición.

## Inventario de demo y licencias

No se entrega fotografía demo. No existe todavía un set aprobado que combine
representatividad, procedencia y licencia trazable. Las imágenes conceptuales de
Puerta 2 no son producción y quedan fuera del paquete.

Antes de sumar una imagen, `ACTIVOS.md` debe registrar: archivo, autor/fuente,
URL de origen, licencia, alcance, fecha de descarga, transformaciones y
responsable de aprobación. Una captura web no constituye permiso de uso.

## Rechazos automáticos

- Hojas, manos con tierra, sol de amanecer, dron genérico de cultivos.
- Apretón de manos, ejecutivo con tablet o tractor impecable de banco de stock.
- Logos o modelos inventados por IA.
- Mezcla de estaciones, regiones o prácticas productivas incoherentes.
- Overlay verde, tipografía sobre zonas variables o carrusel sin propósito.
