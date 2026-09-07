# Identidad AgroBoeda y custodia del logo oficial

Fecha: 2026-09-07.
Estado: **decisión vigente; implementación en cola inmediata después de
`MARKET-VIEWS-1`.**

## Autoridad recibida

Emi fijó el nombre público exacto **AgroBoeda**. Se escribe junto, con A y B
mayúsculas. `TopGreen` es el nombre viejo; `BOEDA` a secas fue una decisión
intermedia y queda sustituida.

Emi entregó `/Users/Emi/Downloads/pokemon/LOGO.png`. PM preservó una copia
binaria idéntica en:

```text
docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png
```

Comprobación:

```text
SHA-256: 5606077c429b20edecb62986d6b7500c7142c6a6230c006fdfb33c4978b206cf
Medida: 1536 × 1024
Formato: PNG RGB de 8 bits, sin canal alfa
Contenido: monograma AB marfil/lima sobre fondo verde oscuro
```

La fuente se conserva sin recortar, recomprimir, recolorear ni servir desde
`public/`. Es material de cliente y autoridad de forma/color, no un archivo ya
optimizado para todas las superficies.

## Lectura correcta del activo

El PNG contiene el monograma **AB**, no el nombre completo AgroBoeda. Por eso:

- no se lo describe como wordmark completo;
- cabecera y footer deben acompañarlo con `AgroBoeda` visible cuando haya
  espacio;
- favicon o superficies compactas pueden usar el monograma, con nombre
  accesible `AgroBoeda`;
- no se inventan letras, símbolos ni una reconstrucción generativa del logo;
- cualquier recorte, reducción o variante debe conservar proporciones, formas,
  colores y contraste de la fuente, y quedar trazado por SHA.

El fondo es opaco y el archivo tiene relación 3:2 con bastante margen. Dev debe
derivar sólo los tamaños/cortes necesarios para producto, sin hacer una
eliminación de fondo automática que deje halos. Una variante opaca sobre la
misma familia de verde es válida si resulta más fiel que fingir transparencia.

## Próxima pieza: BRAND-AGROBOEDA-1

La migración será una pieza propia después de aceptar `MARKET-VIEWS-1`. Antes
de tocar producto, Dev inventariará con `rg` las apariciones y clasificará cada
una como visible, emitida o técnica.

Debe cambiar lo que ve o recibe una persona:

- nombre y marca de Header, Footer, Inicio, Mercado, Servicios, autenticación y
  paneles;
- favicon, título, descripción, metadatos sociales y textos alternativos;
- emails, asunto/remitente visible, documentos o mensajes emitidos por el
  producto;
- nombres demo visibles que todavía presentan «Administrador TopGreen», si no
  son identificadores técnicos.

Debe conservar sin reemplazo masivo:

- repo `Memu007/yneratopgreen`, rutas y nombres de paquetes;
- base, usuarios técnicos, variables, contenedores y servicios Railway;
- aplicación externa `TopGreen Agro Argentina` de Mercado Pago hasta una
  migración operativa autorizada;
- IDs, secretos, URLs, historial y documentos que describen evidencia pasada.

La pieza entrega fuente intacta más derivados optimizados en `public/`, mapa de
superficies, regresión discriminante, capturas 1440 × 900 / 768 × 1024 /
390 × 844, build, lint, contraste, a11y y suite completa. La migración no
habilita Railway, no toca pagos ni datos remotos y requiere revisión visual de
Emi antes de cualquier despliegue.

## Orden de trabajo

1. Terminar y revisar `MARKET-VIEWS-1` sin mezclar identidad.
2. Activar `BRAND-AGROBOEDA-1` como única tarea Dev.
3. Revisar fidelidad del monograma, nombre visible y superficies emitidas.
4. Sólo después continuar el resto del roadmap.
