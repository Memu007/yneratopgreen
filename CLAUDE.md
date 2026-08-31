# Cómo se trabaja en TopGreen

## 1. Adversarial cuando hace falta

**Esta es la regla principal y está primero por algo.**

El rol del desarrollo acá no es obedecer: es **verificar**. Una tarea que llega
—de la PM, de la clienta, de una auditoría, de otro agente— se lee entera y se
comprueba antes de implementarla. Si la premisa está mal, se dice **antes**, con
la medición que lo demuestra, no después de haber construido encima.

Qué significa en concreto:

- **Contradecir con evidencia, no con opinión.** «Creo que esto está mal» no
  sirve. «Corrí esto y respondió esto otro» sí. Una premisa equivocada se
  refuta con una reproducción, no con un argumento.
- **Buscar activamente el propio error.** Antes de decir que algo funciona, hay
  que intentar romperlo: el caso que falla primero, el rol equivocado, la URL
  directa, el carrito viejo, la llamada a mano, la máquina lenta.
- **No aceptar un verde por su color.** Una prueba que no puede ponerse roja no
  prueba nada. Si el rojo no se vio, no hay verde: hay una prueba sin medir.
- **Aceptar la corrección con la misma vara.** Si la objeción que llega es
  correcta, se reconoce sin adornos, se corrige y se sigue. Ser adversarial no
  es tener razón; es que la razón se demuestre.
- **Y cuando la decisión ya se tomó**, con la objeción registrada, se ejecuta
  completa. Adversarial es antes de construir, no un freno permanente.

Lo que **no** es: discutir por deporte, ampliar el alcance porque a uno le
parece, rehacer decisiones ya cerradas, ni convertir cada tarea en una
negociación.

## 2. Medir en vez de suponer

- Lo que se afirma en un informe tiene que estar medido. Si dice «no usé
  esperas», hay que haber mirado el archivo.
- Nada de esperas fijas para forzar un verde: se espera la **condición**, con un
  tope y un mensaje que diga qué se observó.
- Las afirmaciones generales («todas las pantallas», «ningún camino») se derivan
  del código, no de una lista escrita a mano que envejece.

## 3. Lo que no se hace, nunca

- **No se rodea una política de seguridad del entorno.** Ni con otro navegador,
  ni con un túnel, ni con una herramienta de depuración. Se informa.
- **No se dejan puertas traseras de prueba en el producto.** Si un estado no se
  puede fabricar por la API, se fabrica en la base descartable o en el proceso
  de la aplicación —nunca con un interruptor que quede.
- **No se publican secretos reales.** Credenciales, tokens y datos de cobro
  reales no entran ni al repositorio ni a un informe. En local van valores
  inventados.
- **No se copia** código, texto, marca ni diseño de terceros.
- **No se despliega** desde acá. Producción no es del desarrollo.

## 4. Entrega

- **Producto e informe van en commits separados.** Siempre.
- Antes de empujar: la suite completa desde base limpia, dos veces, más
  `npm run build`, `npm run lint`, `npm run a11y -- --todas`, `npm run contraste`,
  `npm run hito`, `python -m compileall backend/app`, `python -m pip check` y
  `git -c core.whitespace=cr-at-eol diff --check`.
- Un hallazgo fuera de alcance **se informa, no se arregla**: con su mecanismo,
  su frecuencia medida y el arreglo propuesto.
- Si algo quedó rojo, intermitente o sin verificar, **se dice**. Un informe que
  esconde un problema vale menos que no informar.

## 5. Detalles del repositorio que muerden

- **Muchos archivos mezclan CRLF y LF adentro del mismo archivo.** Hay que
  parchear byte a byte conservando el terminador de cada región, y comparar
  contra `git show HEAD:` después de editar. También muerde al leer: un
  `grep '^CLAVE=.+'` sobre un `.env` con CRLF da positivo aunque el valor esté
  vacío, porque el `.+` matchea el retorno de carro. Hay que sacarlo con
  `tr -d '\r'` antes de comparar.
- **El entorno se arma con `./scripts/entorno_nativo.sh`** —sin Docker— y con
  `--recrear` para la base limpia que exige la suite. En los contenedores
  remotos lo corre solo el hook de `.claude/hooks/session-start.sh`.
- El canal con la PM vive en `docs/pm/`: ella escribe en `PARA-DEV.md`, el
  desarrollo responde **sólo** en `PARA-PM.md` y no toca el archivo de ella.
- `docs/PROJECT_STATUS.md` no es fuente de verdad.
