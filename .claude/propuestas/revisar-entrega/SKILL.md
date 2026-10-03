---
name: revisar-entrega
description: PM. Revisar la entrega pendiente de la Dev en PARA-PM.md, reproducirla y escribir el veredicto en PARA-DEV.md. Usalo cuando Emi diga «Respondí» o cuando lo dispare el loop de espera.
---

# /revisar-entrega — revisar lo que entregó la Dev

> **Borrador de la Dev (03/10). Es de la PM: lo adopta, lo cambia o lo
> descarta.** Si lo adopta, se mueve a `.claude/skills/revisar-entrega/`.

El método es el de `docs/pm/ONBOARDING-PM.md` («Revisión y aceptación» y
«Método de revisión que funciona»). Acá va sólo el orden.

## 1. ¿Hay una entrega nueva?

```bash
git fetch origin <rama Dev>
git log --oneline HEAD..origin/<rama Dev> -- docs/pm/PARA-PM.md
```

- **`PARA-PM.md` no cambió** desde tu último veredicto: no hay entrega. Si te
  disparó el loop, dejalo corriendo y terminá.
- **Cambió:** si te disparó el loop, frenalo. Integrá con `merge` y seguí.

## 2. Leer el informe desde la rama

Arriba están los SHAs, lo que decidís y los supuestos de la Dev. Después,
los comandos copiables con lo que tienen que mostrar.

## 3. Reproducir

- Worktree en el SHA exacto, base PostGIS Docker recién creada, API nativa,
  frontend de desarrollo y `.env` inventados.
- Los comandos del informe: tienen que mostrar lo que dice el informe.
- Los negativos de la Dev, con tu `REINICIAR_API`, y uno o dos tuyos que
  ataquen otro borde.
- Suite completa desde base nueva cuando corresponde; las dos guías, después.
- Si algo da distinto de lo que dice el informe, se reproduce y se clasifica
  antes de aceptar.

## 4. Veredicto en `PARA-DEV.md`

- Arriba: aceptada, rechazada o con devolución, sobre qué SHA, con la
  evidencia en `REPRODUCCION-<PIEZA>-<fecha>.md`.
- Si la pieza necesita un agregado, va escrito antes de activar la siguiente,
  o como pieza aparte: la Dev arranca una pieza nueva recién con tu
  veredicto.
- Lo que decide Emi (publicar, producto, costo o riesgo) se le pregunta con
  una recomendación. Nada se publica sin su autorización.
- Actualizá `NOW.md` y lo que corresponda del roadmap.

## 5. Subir y esperar

- Commits sólo en `docs/pm`. Push a la rama Dev.
- A Emi: una línea con lo que decide, o nada.
- Loop de espera: `/loop 30m /revisar-entrega`.
