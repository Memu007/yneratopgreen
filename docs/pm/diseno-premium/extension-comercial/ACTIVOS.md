# Activos — producción, concepto y faltantes

## Permitidos para producción

Los cuatro archivos siguientes son derivados web sin EXIF/GPS de material ya
existente del cliente. Emi aprobó la dirección A el 2026-08-23. PM debe conservar
la confirmación de autoría/cesión antes de salida pública.

| Archivo | Medida | Peso | Uso | Fuente / límite |
|---|---:|---:|---|---|
| `assets/produccion/home-cosecha-hero-1920.webp` | 1920×1080 | 327.862 B | Home desktop/tablet | Derivado de `public/DJI_0079.JPG`; crop 16:9; sin metadatos. |
| `assets/produccion/home-cosecha-hero-1200.webp` | 1200×900 | 113.770 B | Home mobile | Misma fuente; 4:3; sin metadatos. |
| `assets/produccion/servicios-relevamiento-hero-960.webp` | 960×540 | 27.750 B | Servicios desktop/tablet | Derivado de `public/relevamiento-inundacion.jpg`; interino, no ampliar. |
| `assets/produccion/servicios-relevamiento-hero-960-4x3.webp` | 960×720 | 32.512 B | Servicios mobile | Misma fuente; interino, no ampliar. |

La Dev copia estos archivos a `public/media/comercial/` o un path equivalente,
sin renombrarlos de forma que pierdan trazabilidad. Los JPG fuente no deben
servirse: `DJI_0079.JPG` pesa 5,9 MB y contiene GPS/EXIF.

## Integridad SHA-256

```text
80eb96fccf4a5da67e5d5911135f8b99ea5834f97e22264d5b822d5c66430605  home-cosecha-hero-1200.webp
6f3254d86ae2413344390cf0e9b6272a78a13944c2ef75b576d676f1332be66b  home-cosecha-hero-1920.webp
ae305f430197459c798c7f5f785e15eba3708b712a72cf3eaf64fc2a0c24128c  servicios-relevamiento-hero-960-4x3.webp
7c734e251c4acb683aafcb5e99217625e6b83474a3fbd2ab5c5f7169bb2201a4  servicios-relevamiento-hero-960.webp
```

## Sólo concepto — prohibidos en producto

| Archivo | Motivo |
|---|---|
| `assets/hero-campo-concepto.webp` | Imagen generada para comparar dirección. |
| `assets/tractor-listing-concepto.webp` | No representa una publicación real. |
| `assets/insumo-listing-concepto.webp` | No representa stock, marca ni lote reales. |
| `assets/servicio-taller-concepto.webp` | No representa un prestador real. |

Hashes para detectar una copia accidental:

```text
9eee93ccd4d329a57bc340ea9073c03f8ca7fbbf936b63917b2322c61c810640  hero-campo-concepto.webp
9b9f4928a6b207142ccb11e276977ed56fbc8bd1aa0a2f135819318aaed71358  tractor-listing-concepto.webp
47fa08fe2e3585e005079dfc63e334d6f14f49637a4cd27c0029c244bab51841  insumo-listing-concepto.webp
025e98808f01eaed9bcc499166c86a89cc86e2893a9c4b1f759709c6bd476e1b  servicio-taller-concepto.webp
```

Las capturas y láminas también son evidencia, no assets.

## Heredados sin cambio

- wordmarks y licencias: `../handoff/ACTIVOS.md`;
- fuentes self-hosted: `public/fuentes/`;
- estados `Sin fotografía` y `No pudimos cargar la imagen`:
  `public/estados/`;
- fotos reales de publicaciones: vendedor/API, con el tratamiento y privacidad
  de `../handoff/FOTOGRAFIA.md`.

## Compra/producción pendiente

El activo más urgente es `servicios/hero-asistencia-final`: una toma 16:9 y una
4:3 del mismo trabajo real, con operador/técnico, maquinaria completa, EPP,
releases comerciales, licencia mundial y sin vencimiento. Mínimo 2400×1600
original; no overlay ni pose a cámara.

El pack demo de 19 fotografías de publicaciones y sus criterios están en
`SISTEMA-FOTOGRAFICO.md`. Hasta obtenerlo, la demo usa imágenes reales del seed
o fallbacks; nunca las cuatro conceptuales.
