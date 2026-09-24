# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — BRAND-LOSS-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre la entrega anterior

`ADMIN-PANEL-DEFECTS-1` quedó **aceptada en rama** sobre `10f1bd6`.

- Caso 191 en 1/1.
- Tu negativo da rojo y nombra los seis cruces.
- Mi negativo, una regla que rechaza sólo las eliminadas, da rojo y nombra
  pausada y agotada.
- 190 en 1/1 y la guía en 26/26 y 26/26.

Corrí la suite completa sobre una base recién creada: **171/191**.

- El 169 falla en mi entorno. Sin ese reinicio real, el límite de ingresos no
  se limpia y los casos 167, 168 y 170 a 185 caen con 429. Repetidos después
  de reiniciar la API, dan 18/18.
- El 131 pasó.
- El 187 falló porque faltaban las marcas. Solo, con las marcas repuestas, da
  1/1.

Evidencia en `REPRODUCCION-ADMIN-PANEL-DEFECTS-1-2026-09-24.md`.

### Problema y prioridad

Las dos publicaciones de la siembra que tienen marca, «Cosechadora John
Deere 9750» y «Tractor Pauny 280A Doble Tracción», **pierden la marca a mitad
de la suite completa**.

- Pasó en 3 de 5 corridas: 1 de 3 tuyas y 2 de 2 mías. Ya no es una
  rareza.
- En mi segunda corrida, `brand` quedó en `NULL` y las filas cambiaron a las
  **22:10:05** y **22:11:08 UTC**. Por los tiempos acumulados, eso cae cerca
  de los casos 157 a 162, pero la estimación puede estar corrida hasta unos
  40 s.
- Descarté tres cosas:
  - repetir la siembra no borra la marca;
  - un `PATCH` que sólo cambia el precio o el estado tampoco;
  - los casos 155 a 163 corridos de a uno, tampoco.
- Ojo: la respuesta del `PATCH` no incluye `brand`. No la tomes como prueba
  de que se borró.

Si la causa es un caso del arnés que toca publicaciones de la siembra, es un
problema de aislamiento (P3). **Si es una vía del producto, es pérdida de
datos** y hay que corregirla antes de publicar. Por eso va ahora.

### Alcance

1. Encontrar **qué borra la marca**: el caso, la petición y la línea de
   código. Tu sonda con disparador sirve, en un esquema aparte como la
   dejaste.
2. **Si es del producto:** corregirlo con un caso que lo reproduzca y un
   negativo.
3. **Si es del arnés:** que ese caso no toque publicaciones de la siembra, o
   que las deje como estaban. Y que el 187 no dependa de que otro caso las
   haya dejado intactas.
4. **P3 del script de la guía:** «Volumen vendido» con centavos. Después de
   la suite, el paso 2 leyó 16268903 contra 1626890,3. El script tiene que
   leer bien los importes con decimales.

### Fuera de alcance

- Cambiar las reglas de marca por categoría.
- Otros casos inestables que no estén relacionados.
- Integración y despliegue.

### Aceptación verificable

1. La causa, nombrada con evidencia: la salida de la sonda o el registro que
   la muestra.
2. **Dos suites completas seguidas** desde una base recién creada, con las
   marcas intactas al terminar cada una: la consulta SQL de las dos filas,
   antes y después. El 187 pasa en las dos.
3. Si hubo cambio de producto: caso nuevo más un negativo que dé rojo con el
   código de la base.
4. La guía pasa después de una suite completa, con la base llena de órdenes
   con centavos.
5. Build, lint, tipos, `compileall` y diff-check con `cr-at-eol`.

### Frená y consultá

- Si la causa exige cambiar qué publicaciones pueden tener marca o cómo se
  edita una publicación desde la pantalla.

### Entrega en `PARA-PM.md`

- SHA;
- la causa;
- el arreglo;
- las dos suites con la consulta de marcas;
- riesgos.

No integres ni despliegues.
