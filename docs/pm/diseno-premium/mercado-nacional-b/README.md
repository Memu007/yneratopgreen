# Handoff aprobado — B / Mercado nacional

Estado: **aprobado por Emi y PM para implementación; no para despliegue**.  
Fecha: 2026-08-25.

Este directorio contiene la fuente visual cerrada de la corrección UX-2D. No es
otro producto ni una invitación a copiar HTML estático dentro de React.

## Orden obligatorio para Dev

1. `HANDOFF-DEV.md`: contrato, precedencia, alcance y secuencia.
2. `MAPA-REACT.md`: correspondencia con el producto real.
3. `PARIDAD.md`: puerta verificable de cierre.
4. `index.html`: tablero offline y explicación de la dirección.
5. `frames/`: referencias exactas de Inicio, Servicios, Mercado y Header.
6. `assets/css/b.css`: geometría y tokens de referencia, no hoja para copiar.

Para revisar el tablero sin dependencias:

```bash
cd docs/pm/diseno-premium/mercado-nacional-b
python3 -m http.server 8138
```

Abrir `http://127.0.0.1:8138/index.html`.

## Qué está cerrado

- Dirección **B — Mercado nacional**.
- Canvas, verde, grafito, cereal, acero y reglas de borde.
- Inter Tight para títulos/datos e Inter para UI/cuerpo.
- Header por contexto y estados anónimo/comprador/vendedor/admin.
- Inicio, Servicios y Mercado en `1440×900` y `390×844`.
- Estado honesto `Sin registro fotográfico`.
- Wordmark y símbolo `parcela activa` como identidad provisional del MVP.
- Fotografías existentes, ya autorizadas y presentes en producto.

El símbolo puede revisarse en una futura etapa de marca, pero **Dev no lo
redibuja ni lo reemplaza** durante UX-2D.

## Qué no está diseñado

No hay composición nueva aprobada para Quiénes somos, Contacto, autenticación,
detalle, carrito/checkout, publicación, paneles ni administración. Esas
superficies conservan estructura y comportamiento y reciben sólo fundaciones
compartidas cuando no rompan contraste, jerarquía ni operación. Dev no inventa
pantallas faltantes.

## Integridad del paquete

- 24 archivos originales de la entrega visual más estos contratos PM.
- Fuentes y licencias SIL OFL incluidas.
- Cero recursos HTTP externos.
- Los cuatro WebP coinciden por SHA-256 con `public/media/comercial/`.
- SVG corregidos y verificados visualmente después del error de exportación.

