# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en `docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones hasta el cierre. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-12 — INTEGRATION-CANDIDATE-1

`COPY-CLEAR-1` queda **aceptada** en `9f25d59`, con informe `ee166b4`. Se abre una tarea de integración, no una función nueva.

La PM reprodujo 156+160+168 en 3/3, 134+167+168 en 3/3 y 165+166 en 2/2, todos desde bases Docker limpias. La a11y dio el mismo rojo heredado en entrega y padre: 64/64 pantallas y seis violaciones `serious` de contraste en paneles. La suite completa PM dio 163/168; los cinco rojos quedaron separados de COPY por las focales y por el agotamiento/caducidad de recursos del arnés. Lint, TypeScript, sintaxis y `diff-check` quedaron verdes.

### Objetivo

En `claude/dev-role-repo-3l0kp3`, incorporá el `main` vigente a tu rama y prepará una única composición candidata que conserve todo el producto aceptado de tu HEAD `ee166b4` y los documentos canónicos podados de `main`. No resetees ni reescribas `main`, no hagas un push a `main` y no reintroduzcas historia en `NOW.md`, `PARA-DEV.md` o auditorías. Tu nuevo `PARA-PM.md` debe ser un informe corto de esta entrega.

El merge en seco no mostró conflictos textuales, pero eso no prueba compatibilidad funcional. Revisá especialmente contrato Backend/Frontend de Administración, navegación/continuaciones, fotos, cuenta, calificaciones, cotización, filtros y COPY.

### Dos correcciones de puerta dentro de la candidata

1. Corregí las seis violaciones heredadas de contraste en los paneles con el cambio visual mínimo. `a11y` y contraste deben quedar verdes; no rediseñes.
2. Aislá el arnés para que 165/166 no dependan de un JWT vencido por la duración de la suite y 167/168 no hereden el presupuesto antifuerza-bruta consumido por otros casos. La corrección vive en el arnés o en su orquestación: **no aumentes TTL, no relajes ni desactives el rate-limit de producción, no agregues bypass de test al producto**.

Si 114, 131, 143 u otro caso queda rojo, reproducilo aislado y clasificá con evidencia; no lo tapes como «conocido» ni cambies producto sólo para silenciarlo.

### Entrega y puertas

- Commits separados cuando corresponda: composición, corrección visual/arnés e informe.
- Entregá un **SHA final único**. Desde base Docker limpia corré la suite completa de 168 casos sobre ese SHA y guardá log recuperable.
- Corré lint, TypeScript, `node --check scripts/smoke.mjs`, a11y, contraste y `diff-check`.
- Informá base exacta, commits incluidos, diff final, resultados y cualquier rojo con su reproducción focal.
- No desplegues, no toques Railway, datos remotos, secretos o pagos y no empieces `CAT-PAGE-1`. Frená al entregar: la PM repetirá la suite completa desde otra base limpia sobre el mismo SHA.

Railway queda fuera de esta tarea: hoy Frontend y Backend siguen `main` con auto-deploy y sin esperar CI, publican SHAs distintos y no tienen backups. Por eso la candidata no puede subir a `main` todavía.
