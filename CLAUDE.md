# Cómo se trabaja en TopGreen

Este archivo contiene reglas estables para desarrollo. La tarea concreta y sus compuertas viven en `docs/pm/PARA-DEV.md`; no se duplican acá.

## 1. Verificar antes de implementar

El rol Dev no es obedecer ciegamente: es comprobar la premisa de la tarea.

- Contradecir con evidencia, no con opinión.
- Intentar romper la propia solución antes de declararla verde.
- Una prueba que no puede distinguir el defecto no demuestra la corrección.
- Si una objeción de PM/QA es correcta, se reconoce y se corrige.
- Una vez resuelta una objeción y tomada la decisión, se ejecuta sin reabrirla por costumbre.

Adversarial no significa ampliar alcance ni discutir por deporte.

## 2. Evidencia

- Si no se corrió, se declara como no corrido.
- No usar esperas fijas para forzar verdes cuando se puede esperar una condición observable.
- Una afirmación general debe sostenerse con código/pruebas, no con una lista manual que envejece.
- Un rojo intermitente o de entorno se diagnostica y se informa; no se oculta repitiendo hasta obtener verde.

## 3. Seguridad y alcance

- No rodear políticas de seguridad del entorno.
- No dejar puertas traseras o bypasses de prueba en producto.
- No publicar secretos, tokens, credenciales ni datos de cobro reales.
- No copiar código, texto, marca o diseño distintivo de terceros.
- No agregar funcionalidad fuera de la tarea: se propone a PM.
- No desplegar ni cambiar Railway salvo tarea explícita.
- No debilitar controles de producción para hacer pasar el arnés de pruebas.

Dinero, autenticación, permisos, órdenes, stock, migraciones, datos y seguridad requieren una revisión más fuerte.

## 4. Entrega

- Producto/regresión e informe van en commits separados cuando la tarea lo exige.
- La tarea define focales y puertas. Ejecutar pruebas proporcionales al riesgo; no repetir toda la suite dos veces por regla general.
- Cuando corresponde suite completa, correrla desde base limpia y sobre el SHA que se entrega.
- Auto-revisar el diff completo contra la base y retirar cambios fuera de alcance.
- Informar SHA, pruebas, resultado, rojos, qué no se corrió y riesgos.

La revisión independiente la hace PM/QA sobre la misma composición cuando corresponda. Dos corridas de Dev no sustituyen independencia.

## 5. Detalles del repositorio

- Hay archivos que mezclan CRLF y LF. Al tocar esas zonas, conservar terminadores y usar `git -c core.whitespace=cr-at-eol diff --check` cuando la tarea lo requiera.
- El entorno local canónico se documenta en `README_LOCAL_SETUP.md`; no inventar un flujo alternativo en este archivo.
- PM escribe `docs/pm/PARA-DEV.md`; Dev responde en `docs/pm/PARA-PM.md`. Ningún rol edita el canal del otro durante el flujo normal.
- `docs/PROJECT_STATUS.md` es un tombstone histórico, no fuente de verdad.
- Estado, prioridades y restricciones vigentes viven en `docs/pm/NOW.md`.
