# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 0. Esto no es un informe de pieza

`896386a` quedó aceptado y la validación de correo está arrancada; lo de abajo
va aparte. **Emi me pidió que te trasladara una lectura del proyecto entero que
le di hoy**, porque afecta el orden de trabajo y eso lo decidís vos.

Gracias por correr la prueba Docker. `tgpmcheck`, el upload servido antes y
después de reiniciar la API, y los `topgreen-*` intactos cierran lo único que
me faltaba y no podía ejecutar.

## 1. Lo que retiro antes de empezar

Le dije a Emi que llevábamos una semana entera endureciendo en vez de
construir. **Con la tarea que acabás de abrir eso ya no se sostiene**: la
validación de correo es deuda contractual de Fase 2 y la estás abriendo **once
días antes** de que Fase 2 empiece. Lo digo porque sería injusto dejarte el
reproche escrito y no la corrección.

Lo que sigue de aquella lectura son tres riesgos que no toca esta tarea.

## 2. Riesgo 1 — nunca desplegamos nada, y el primer intento cae en la peor semana

Es el que más me preocupa y el que más barato sale mover.

La preparación de Railway existe desde `382bcbe` y **jamás se ejecutó**. Hoy
nadie sabe si arranca. Si el primer despliegue real ocurre en Fase 5
—16/10 al 29/10—, todas las sorpresas de despliegue caen en las mismas dos
semanas que ya cargan QA, la revisión de seguridad y el lanzamiento. Las
sorpresas de despliegue no son opinables: variables que faltan, migraciones que
corren distinto, uploads que no persisten, CORS del dominio real, arranque en
frío.

Justo hoy vimos en chico exactamente eso: la instalación nativa era
irreproducible y sólo se supo **al ejecutarla**, no al leerla. Railway está en
el mismo estado que estaba esa guía.

**Lo que propongo:** un despliegue de prueba a Railway ahora, en un proyecto
propio y descartable, aunque el producto esté incompleto. No para mostrárselo a
nadie. Para que las sorpresas aparezcan en agosto y no en la semana 11.
Estimo una jornada. No pido adelantar la revisión de seguridad, que sigue
donde está y sigue siendo condición para publicar.

## 3. Riesgo 2 — Mercado Pago depende de algo que no controlamos

Fase 4 arranca el **02/10** y la reconstrucción no puede empezar sin
credenciales de la clienta, que hoy no existen. Crear una aplicación de Mercado
Pago del lado de ella no es inmediato.

Si esas credenciales llegan en octubre, la fase nace muerta y el problema no se
resuelve programando más rápido. **Habría que pedírselas esta semana**, junto
con las dos preguntas de transportistas que ya están anotadas y sin respuesta:
quién ve el teléfono de quién, y zonas declaradas contra radio en km.

## 4. Riesgo 3 — logística es el 25 % del peso y nunca se construyó

Pieza A parcial, B y C en cero. Es el bloque más grande del contrato y el
único que jamás se tocó; entra en Fase 3, el 11/09. No pido adelantarlo: pido
que cuando se abra, se abra con el tiempo completo, porque no hay experiencia
previa sobre ese código y las estimaciones ahí valen menos que en el resto.

Sumo dos que ya conocés y siguen abiertas, para que no se pierdan:

- **el `float` del checkout**, obligatorio antes de Fase 4;
- **`docs/PROJECT_STATUS.md` con ocho afirmaciones falsas verificadas.** El
  repositorio se le entrega a la clienta. Hoy es un documento que le miente a
  quien lo reciba. Es media hora de trabajo y no está agendado.

## 5. Lo que NO estoy diciendo

No estoy diciendo que vayamos atrasados. Vamos **justos**, que es distinto. La
base está bastante más firme que hace dos semanas y todo lo que declaramos
tiene una corrida detrás. Tampoco estoy pidiendo cambiar el cronograma del PDF:
lo que propongo entra en los huecos, no compite con las fases.

## 6. DECISIÓN SOLICITADA

**a) El despliegue de prueba a Railway.** Beneficio: convierte una incógnita de
la semana 11 en un problema de agosto. Esfuerzo: una jornada. Riesgo: ninguno
sobre el producto, va a un proyecto descartable y no se publica nada.
**Recomiendo meterlo apenas cierre la validación de correo**, antes de abrir
otra pieza de Fase 2.

**b) El pedido a la clienta** —credenciales de Mercado Pago y las dos preguntas
de transportistas—. No es mío: decidís vos si sale y en qué forma. Sólo pido
que salga esta semana.

**c) `PROJECT_STATUS.md`.** O se reescribe, o se borra del repositorio
entregable. Cualquiera de las dos es mejor que dejarlo. **Recomiendo borrarlo**
y que su contenido real viva en `NOW.md`, que sí se mantiene.

Mientras tanto arranco la validación de correo. Si alguna de estas decisiones
cambia el orden, avisá y reordeno.

El entorno local sigue levantado.
