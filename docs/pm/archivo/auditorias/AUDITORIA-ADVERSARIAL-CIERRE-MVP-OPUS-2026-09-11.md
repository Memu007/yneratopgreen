# Auditoría adversarial de cierre MVP — encargo a Opus

Fecha: 2026-09-11

## Rol

Actuá como **Dev/auditor adversarial de la PM**. Esta pieza no es para darle la razón a la PM ni para implementar su plan: es para intentar **refutarlo con evidencia del repositorio**.

No cambies producto, ramas de despliegue, Railway, Mercado Pago, datos ni secretos. No integres nada. Esta tarea es sólo análisis y reporte.

## Qué hizo la PM antes de este encargo

La PM volvió a evaluar el MVP usando `docs/pm/CONTRATO.md` como fuente contractual principal, en vez de inferir el alcance desde el roadmap interno. Su lectura fue:

1. Comprador/vendedor, catálogo, carrito, transferencia, PostGIS y logística están esencialmente cubiertos.
2. Mercado Pago tiene mucho código construido, pero la homologación real sigue incompleta; el pago aprobado + Webhook/estado no quedó demostrado de punta a punta.
3. El contrato habla de un checkout básico de Mercado Pago y no exige split payments, OAuth de vendedores ni comisión del marketplace; por eso la PM propuso no usar toda la sofisticación interna como criterio contractual de cierre.
4. Detectó una posible desviación de infraestructura: `CONTRATO.md` menciona AWS o Supabase/Render, mientras hoy existe Railway. La PM propuso no migrar por reflejo, sino confirmar si Railway es aceptable contractual/comercialmente.
5. Detectó que `main` y la rama Dev acumularon divergencia y entregas aceptadas fuera de `main`; propuso una integración excepcional, luego suite completa sobre la composición integrada.
6. Propuso priorizar el cierre contractual por encima de pulido no obligatorio: integración → suite limpia → Mercado Pago mínimo real → decisión/aceptación de infraestructura → SMTP/backups/storage/secretos/deploy → capacitación/documentación/accesos.
7. En consecuencia, la PM cuestionó si conviene seguir gastando tiempo en tareas editoriales/pulido como `COPY-CLEAR-1` antes de cerrar esas puertas.

## Tu trabajo: intentar demostrar que esa lectura está equivocada

Revisá como mínimo:

- `docs/pm/CONTRATO.md`
- `CRONOGRAMA.md`
- `docs/pm/NOW.md`
- `docs/pm/ROADMAP-CIERRE-MVP-2026-08-31.md` si sigue vigente
- `docs/pm/ALCANCE-Y-LIMITES.md`
- `RAILWAY.md`
- evidencias de MP-D y reproducciones relacionadas
- código real de checkout, Mercado Pago, transferencia, auth/correo, logística y despliegue
- estado real de `main` y `claude/dev-role-repo-3l0kp3`

### Ataques obligatorios

1. **Fuente de verdad.** ¿`CONTRATO.md` realmente gobierna todo el MVP actual o hubo decisiones posteriores aceptadas por Emi/clienta que modificaron el alcance? No aceptes `CRONOGRAMA.md` si contradice el contrato sin explicar por qué.
2. **Mercado Pago.** Atacá la tesis de la PM de que basta cerrar un checkout básico. Determiná qué es estrictamente necesario para considerar Fase 4 entregable y qué parte de OAuth, Webhook, reconciliación, reservas e idempotencia es requisito real, requisito técnico inevitable o sobreconstrucción.
3. **Railway.** Atacá la conclusión de que usar Railway es una desviación contractual relevante. Determiná si la lista AWS/Supabase/Render era vinculante, ejemplificativa o una decisión de stack que puede sustituirse sin afectar el entregable. Si hace falta aceptación del cliente, decilo; si no, explicá por qué no.
4. **Integración.** Verificá con commits/refs la divergencia real entre `main` y Dev. Buscá una alternativa más segura o más barata que la integración excepcional + suite completa propuesta por PM. Si la PM tiene razón, justificá por qué.
5. **COPY-CLEAR-1.** Decidí si frenarla ahora reduce riesgo/tiempo o si terminarla antes es objetivamente mejor porque ya está iniciada, es requisito de calidad/cliente o abarata la futura suite.
6. **Correo/producción.** Separá con precisión qué falta porque el contrato lo exige y qué falta sólo por buenas prácticas de producción. No conviertas hardening deseable en requisito contractual sin evidencia.
7. **Fecha y camino crítico.** Construí el camino mínimo real para llegar al hito final sin degradar seguridad ni incumplir contrato. Marcá dependencias humanas externas (Mercado Pago, cliente, dominio/infra) separadas de trabajo de código.
8. **Sobreingeniería.** Buscá trabajo ya hecho o planeado que pueda eliminarse del camino crítico sin afectar el contrato.

## Reglas de evidencia

- No respondas por intuición: cada conclusión importante debe apuntar a archivo, commit, código o evidencia reproducible.
- Distinguir: **contractual**, **decisión posterior de Emi**, **requisito técnico para operar**, **hardening**, **nice-to-have**.
- Si dos fuentes del repo se contradicen, no elijas silenciosamente: mostrales el conflicto y decidí cuál tiene precedencia y por qué.
- No uses porcentajes globales vagos como argumento.
- No implementes nada en esta tarea.

## Entrega esperada

Respondé en `docs/pm/PARA-PM.md` con una sección titulada:

`AUDITORIA-ADVERSARIAL-CIERRE-MVP-1`

Debe contener:

1. **Veredicto sobre la PM:** `CONFIRMADA`, `PARCIALMENTE REFUTADA` o `REFUTADA`.
2. Una tabla con cada afirmación de la PM → evidencia a favor → evidencia en contra → conclusión.
3. Los **5 bloqueos reales** para el hito final, ordenados por camino crítico.
4. Qué tareas actuales se deben **seguir / pausar / eliminar del camino crítico**.
5. Un plan mínimo de cierre en orden, con gates objetivos.
6. Cualquier error factual o de prioridad cometido por la PM, dicho de forma explícita.

Al terminar, frená. No cambies producto ni empieces la siguiente tarea hasta que la PM revise tu devolución.
