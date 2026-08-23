# Revisión PM independiente — extensión comercial `0a05a0a`

Fecha: 2026-08-23
Veredicto: **apta para implementación UX-2C; no apta todavía para publicación**.

## Qué queda aceptado

- A — Mercado a cielo abierto resuelve la devolución visual: elimina la masa
  índigo y el overlay, da protagonismo a territorio/producto y mantiene una
  jerarquía de marketplace en Inicio, Servicios y Mercado.
- La A/B de esta extensión no reabre B — Mesa de negocios: aquella decisión
  define la identidad; ésta define temperatura, fotografía y acción comercial.
- El handoff separa prototipo de producto, obliga a consumir datos reales y
  prohíbe copiar conteos, publicaciones o fotografías conceptuales.
- Los cuatro WebP permitidos coinciden con los hashes documentados, tienen las
  dimensiones declaradas y no exponen EXIF/GPS. Las fuentes originales existen
  en `public/`.
- La tarea UX-2C conserva Backend, pagos, flujos y cuatro anatomías; no autoriza
  nuevas funciones ni despliegue.

## Límites que siguen abiertos

1. Antes de publicación pública, Emi/cliente debe confirmar por escrito la
   autoría o cesión comercial de `DJI_0079.JPG` y
   `relevamiento-inundacion.jpg`.
2. La fotografía de Servicios es interina y no demuestra un prestador en
   acción. Sirve para implementar el MVP, pero debe reemplazarse para el cierre
   visual final.
3. Los `30` y las cards de los HTML son sólo composición. En producto deben
   venir de API/componentes reales; cualquier copia hardcodeada rechaza la
   entrega.
4. El axe 9/9 corresponde a prototipos. Dev debe repetir accesibilidad,
   contraste, responsive y suite sobre el producto implementado.

## Puerta siguiente

Dev puede comenzar UX-2C desde el último bloque de `PARA-DEV.md`, trabajar en
commits auditables y frenar sin desplegar. PM y Emi revisan la implementación
real antes de habilitar el entorno descartable.
