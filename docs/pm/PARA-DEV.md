# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## 2026-09-21 — RISK-REC-1

### Problema y prioridad

Es el siguiente bloque del roadmap de cierre del MVP. Hay tres riesgos
registrados por auditoría que no se convierten en trabajo por lectura estática:

- **R1:** el stock visible puede quedar viejo entre dos sesiones y el checkout
  debe seguir teniendo al Backend como autoridad;
- **R4:** el reenvío de verificación puede depender de reconocer texto de error;
- **R5:** un grupo de checkout sin medio de pago puede exigir salir para poder
  retirarlo.

La tarea es de reproducción adversarial y corrección mínima sólo cuando el rojo
sea real. No es permiso para rediseñar checkout, auth ni pagos.

### Base y alcance

- **Base operativa:** composición integrada `4c8569d`.
- **Rama de trabajo:** `claude/dev-role-repo-3l0kp3`; si no parte de `4c8569d`,
  informalo antes de tocar producto y no fuerces `main`.
- Reproducí los tres recorridos contra el endpoint/interfaz real y registrá el
  estado observable, no sólo lo que sugiere el código.
- Si un riesgo es falso, dejalo cerrado como falso con evidencia y sin cambio.
- Si es real, hacé la corrección mínima, agregá una regresión discriminante y
  explicá por qué no amplía el contrato.

### Criterios de aceptación ejecutables

1. **R1 — concurrencia de stock:** dos sesiones intentan comprar una cantidad
   que deja al segundo sin stock disponible. Debe existir un rojo reproducible
   contra la base si la UI permite confirmar algo que el Backend rechaza o si
   la reserva/descuento puede duplicarse; el camino correcto conserva la
   autoridad del Backend, no vende stock negativo y deja la UI en un estado
   recuperable.
2. **R4 — reenvío:** ejercitá vencimiento, reenvío y login con transporte de
   correo fallido o respuesta equivalente. Verificá que la UI no dependa de una
   frase frágil para ofrecer el reenvío. Si no hay defecto observable, cerralo
   como falso; si lo hay, usá una señal estable sin ampliar el contrato de
   Auth ni enumerar cuentas.
3. **R5 — grupo sin medio de pago:** fabricá un checkout con al menos un grupo
   sin medio disponible. La persona debe poder identificarlo, retirarlo o
   recuperarse sin perder grupos válidos ni abandonar el checkout por sorpresa.
   No agregues medios, planes, mensajería ni promesas de Mercado Pago.
4. Agregá los casos focales siguientes disponibles —previstos como 176, 177 y
   178— o documentá si un caso existente ya discrimina exactamente cada borde.
   Cada caso debe tener un negativo claro y no afirmar un resultado por leer el
   fuente.

### Compuertas

- rojo contra la base y verde en la candidata para cada defecto que se corrija;
- casos focales de R1/R4/R5 y suite smoke completa desde base limpia;
- build, lint, `tsc --noEmit`, `node --check`, `compileall`, `pip check` y
  `git diff --check`;
- a11y/contraste sólo si la corrección cambia una superficie visible;
- no se acepta un informe que convierta un comportamiento esperado o un rojo
  ambiental en defecto de producto.

### Fuera de alcance y freno

- No habilites Mercado Pago real, no uses credenciales reales y no cambies la
  bandera productiva.
- No hagas migraciones, cambios de esquema, rediseño de checkout, nuevo flujo
  de autenticación ni modificación de políticas de stock sin consultar.
- No toques Railway, datos remotos ni `main`.
- Frená si el rojo exige decidir una política comercial, un vencimiento de
  reserva, una señal nueva de API o una migración.

### Entrega

Respondé en `docs/pm/PARA-PM.md` con rama, SHA base, SHA candidato, diff,
reproducción de cada riesgo, rojos/verdes, pruebas, riesgos adyacentes y la
lista explícita de riesgos cerrados como falsos. Frená después de entregar.
