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

## Tarea activa única: contraste del frontend productivo

Corregí la deuda de contraste ya observada en la aplicación real. Es una pieza
chica de Fase 1 y no habilita adelantar Fase 2 o 3.

### Alcance

- Frontend productivo actual, principalmente el sistema global de estilos en
  `src/index.css` y sólo los componentes estrictamente necesarios.
- Tema claro, que es el único tema alcanzable hoy.
- Sin rediseño, sin cambio de layout, sin dependencias nuevas y sin tocar
  `backend/`, migraciones, API, seed ni el prototipo de logística.

### No alcanza con cambiar el gradiente

La falla confirmada es texto blanco sobre el inicio `#059669` del gradiente
primario: **3,77:1**. Pero el mismo color también aparece como texto en
`.btn-outlined`, `.btn-text` y el hover global de enlaces. No corrijas una
sola variable y declares resuelto el conjunto.

Hacé un inventario corto de los usos reales de color como texto en las
pantallas alcanzables. Medí la pareja efectiva texto/fondo. Bordes, foco,
fondos decorativos y controles deshabilitados no se evalúan como texto normal.

### Criterios de aceptación

1. Todo texto normal visible medido alcanza **4,5:1**; texto grande, **3:1**.
2. El gradiente primario con texto inverso cumple en todo su recorrido, no sólo
   en un extremo.
3. Botones primarios, outlined, de texto y enlaces en hover cumplen sobre sus
   fondos reales.
4. Estados semánticos que usan color como texto —por ejemplo éxito o error—
   se miden y se corrigen sólo si aparecen por debajo del mínimo.
5. Se preservan jerarquía visual, foco visible, estados hover/active y lectura
   de botones deshabilitados. No oscurezcas todos los verdes a ciegas.
6. Verificación real del recorrido principal en **1440×900 y 390×844**, sin
   desborde nuevo ni errores de consola.
7. Reportá una tabla breve con selector/uso, color de texto, fondo, ratio antes
   y ratio después. No hace falta listar cada nodo repetido.
8. `npm run build` y `git diff --check` en verde.

### Entrega

Un commit de código y un commit separado con el informe en `PARA-PM.md`.
Si la medición demuestra que el problema exige tocar muchos componentes o
abrir un rediseño, frená antes de ampliar el alcance y reportalo.
