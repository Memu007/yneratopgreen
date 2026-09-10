# Reproducción PM — QUOTE-CONTACT-1 — 2026-09-10

## Resultado

Devuelta como `QUOTE-CONTACT-1R`.

- Producto/regresión Dev: `612b57f`.
- Informe Dev: `9493ba0`.
- Dev informó 125+147+155+166 en **4/4** y suite completa **165/166**, con
  único rojo 131 por la limitación ambiental ya documentada.
- PM revisó el delta completo y reprodujo el 166 desde otra base Docker limpia:
  **1/1**, salida 0. El smoke incluyó build.
- Log persistente válido: `/private/tmp/topgreen-pm-quote-166.log`.
- Una ejecución anterior terminó antes de Playwright por `EPERM` sobre su caché
  y no cuenta como resultado.
- No hubo suite completa PM.

## Producto conforme hasta esta puerta

- Tarjeta y detalle transportan publicación y vendedor hasta Contacto.
- Contacto genérico remonta sin la cotización anterior y una intención con otro
  título reemplaza a la previa.
- El botón usa «Abrir en mi correo», abre un único `mailto:`, conserva los
  campos y no interpreta el retorno de `window.open` como éxito o error.
- WhatsApp reutiliza el contexto y el flujo no hace `POST /contact`.
- No hay cambios de Backend, contratos remotos ni dependencias.

## Huecos que invalida el verde

1. El asunto visible sigue siendo genérico y el `subject` del `mailto:` queda
   en «Solicitud de cotización». Publicación y vendedor aparecen sólo en el
   cuerpo, aunque el contrato exige ambos nombres en asunto y mensaje. El caso
   166 comprueba el valor genérico y tampoco inspecciona esos nombres en el
   asunto codificado.
2. La ayuda dice «Preparamos el mensaje en tu aplicación de correo» y «Si no se
   abrió». La comprobación `\bse abrió\b` no detecta esa segunda frase porque
   `\b` no crea el borde esperado después de la `ó`; por eso el caso pasa una
   cadena que pretende excluir. La copia excede además la única ayuda neutral
   admitida: revisar y enviar desde la aplicación de correo.
3. `ContactPage` se remonta con una clave basada sólo en el nombre de la
   publicación. Dos publicaciones distintas pueden compartir título; en ese
   caso la intención nueva no reemplaza de forma confiable los datos previos.
   El caso sólo usa títulos diferentes y no cubre esa condición.
4. `src/types/index.ts` contiene un cambio semántico pequeño, pero sus finales
   de línea hacen aparecer casi todo el archivo como reemplazado.

## Alcance de la corrección

La devolución pide una corrección focal y una extensión del 166: nombres en el
asunto visible y codificado, copia neutral comprobada sin el falso negativo,
e identidad estable ante títulos iguales. No se repiten focales anteriores ni
suite completa; la evidencia base de Dev queda conservada.
