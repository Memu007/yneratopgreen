# PM → Dev

Canal de la PM hacia la dev. **Solo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-08-06 — Corrección logística `823c3fe`: aceptada

La puerta de UX/UI de logística de Fase 1 queda cerrada con `823c3fe` y su
informe `a2e5abb`.

Verificación independiente de PM:

- el conjunto visible sale del origen y destino actuales;
- las 12 combinaciones de pedido y destino producen 22 tarjetas coherentes;
- ninguna distancia a origen ni a destino supera el radio;
- cambiar destino fuerza `elegido = null` y `necesitaFlete = true`;
- por eso desaparece el contacto y el checkout vuelve a bloquear.

La frase del informe que dice que el pedido B no muestra a Ledesma es
incorrecta: la tabla sí lo muestra en cinco destinos. Es un error narrativo
menor, no del prototipo, y no reabre la entrega.

No vuelvas a tocar el prototipo salvo una devolución nueva. Cuando la Pieza B
productiva lo reemplace, se decidirá si se conserva como evidencia o se elimina.

---

## 2026-08-06 — Contraste `10b830f`: base aceptada, pieza abierta

La dev hizo bien en frenar y reportar: la orden decía explícitamente no ampliar
el alcance si la medición encontraba una deuda mayor. Se aceptan los cambios de
`10b830f` como base correcta —tokens de texto, gradiente primario y 12 usos—,
pero **la tarea no queda cerrada** porque el criterio 1 sigue incumplido.

Decisión de PM sobre las dos paletas: **opción 2**. No se unifican ni se
rediseña la marca, y tampoco se difiere la deuda visible a Fase 5. Se corrigen
sólo las parejas texto/fondo que fallan, conservando la paleta emerald global y
la paleta oliva de los componentes.

---

## Tarea activa única: cerrar el contraste del tema claro

Continuá sobre `10b830f` y corregí los aproximadamente treinta selectores
fallidos que ya identificaste en los ocho componentes.

### Alcance

- Sólo los selectores visibles que el barrido confirmó por debajo de **4,5:1**
  para texto normal o **3:1** para texto grande e iconos informativos.
- Conservá las dos familias cromáticas. Elegí, para cada caso, el tono más
  cercano de la misma familia que cumpla; en gradientes podés oscurecer el
  extremo claro o reforzar el overlay sin cambiar layout ni composición.
- Las estrellas que comunican calificación deben alcanzar 3:1 contra el fondo.
  Si alguna marca es puramente decorativa, documentala como tal y no la cuentes
  como información.
- Para texto sobre foto, medí el overlay efectivo y verificá visualmente los
  extremos claros y oscuros de la imagen; no declares aprobado un caso que el
  medidor no puede resolver.
- Reutilizá los tokens creados donde corresponda. No hace falta convertir toda
  la paleta oliva en tokens para cerrar esta pieza.

### Fuera de alcance

- Sin rediseño, unificación de paletas, cambio de layout ni tema oscuro.
- Sin backend, seed, API, logística, dependencias nuevas ni `axe` todavía.
- No normalices CRLF ni abras un diff masivo de higiene.
- No corrijas colores de bordes o decoración si no fallan como texto o control.

### Criterios de aceptación

1. El mismo recorrido principal medido en **1440×900 y 390×844** termina con
   cero textos visibles por debajo del mínimo. Los casos sobre imagen que no
   puedan automatizarse quedan verificados y explicados uno por uno.
2. Gradientes y overlays cumplen en todo su recorrido, no sólo en un extremo.
3. No aparecen desbordes nuevos, pérdida de foco, errores de consola ni cambios
   de jerarquía visual.
4. El informe trae cantidad de selectores fallidos antes/después y una tabla
   breve por selector/uso con texto, fondo y ratio final.
5. `npm run build`, la suite **25/25** y
   `git -c core.whitespace=cr-at-eol diff --check` quedan en verde.
6. Un commit de código y otro separado con el informe en `PARA-PM.md`.

Cuando esto quede aceptado, la pieza siguiente será incorporar
`@axe-core/playwright` como control automático separado, tal como quedó
registrado en `CRONOGRAMA.md`.

---

## 2026-08-09 — Contraste `918c4b9`: aceptado

La corrección de contraste queda cerrada con el código `918c4b9` y el informe
`0d1f1b5`.

Verificación independiente de PM desde el estado publicado en GitHub:

- el diff queda limitado a 18 archivos visuales, sin backend ni cambio de flujo;
- la compilación de TypeScript y Vite termina en verde;
- `git -c core.whitespace=cr-at-eol diff --check` no encuentra errores;
- la suite oficial recreada desde una base local limpia termina **25/25**;
- el filtro combinado por provincia y localidad vuelve a coincidir con SQL;
- las estrellas ya no dependen sólo del color: usan forma llena y vacía.

Se acepta dejar los controles deshabilitados con su aspecto actual: oscurecerlos
haría que parecieran disponibles y WCAG no exige contraste mínimo para ese
estado. También se confirma una deuda distinta, no de contraste: hay cuatro
apariciones visibles, en tres contextos, que todavía llaman `AgroMarket` a un
producto cuya marca es TopGreen. Se corrige en la pieza siguiente antes de
cualquier demostración.

---

## Tarea activa única: puerta automática de accesibilidad e identidad visible

Es una pieza mínima de cierre de Fase 1. No abras desarrollo de las Fases 2 a 5.

### Alcance

1. Cambiá sólo las cuatro apariciones visibles de `AgroMarket` por `TopGreen`:
   las dos variantes del encabezado y los textos comerciales de inicio y panel.
   El nombre técnico del paquete y el comentario histórico pueden quedar como
   están; no hagas una migración de nombres internos.
2. Incorporá `@axe-core/playwright` sobre el Playwright ya existente y agregá
   un comando dedicado y documentado, por ejemplo `npm run a11y`.
3. Medí en 1440x900 y 390x844 las rutas principales públicas y autenticadas:
   inicio/catálogo, ingreso, registro, detalle, carrito/checkout y los paneles
   de comprador, vendedor y administración.
4. El control debe fallar ante violaciones `serious` o `critical` y reportar
   regla, ruta y elemento afectado. No reemplaza el barrido de contraste ni la
   suite funcional.

### Límite adversarial

Primero medí. Si aparecen más de diez familias distintas de fallas o alguna
corrección exige rediseño, backend o cambio de flujo, frená y traé el inventario
a PM antes de ampliar el alcance. Dentro de ese límite, corregí sólo problemas
semánticos pequeños y evidentes. Sin dependencias adicionales, salvo
`@axe-core/playwright`; sin tema oscuro ni retoques cosméticos.

### Criterios de aceptación

1. Ningún texto visible de la interfaz dice `AgroMarket`; la marca mostrada es
   `TopGreen` y no cambia el layout.
2. El comando de accesibilidad es reproducible, cubre las dos medidas y termina
   con cero violaciones `serious` o `critical` en el recorrido acordado.
3. `npm run build`, `npm run a11y`, la suite oficial **25/25** y
   `git -c core.whitespace=cr-at-eol diff --check` quedan en verde.
4. Un commit de código y otro separado con el informe en `PARA-PM.md`. El
   informe lista rutas/medidas, resultado antes/después y cualquier regla menor
   que se haya decidido no bloquear.
