---
name: revisar-entrega
description: PM. Revisar la entrega pendiente de la Dev en PARA-PM.md, reproducirla con las herramientas de PM y escribir el veredicto en PARA-DEV.md. Usalo cuando Emi diga «respondió».
---

# /revisar-entrega — revisar lo que entregó la Dev

Sólo PM. El método y sus porqués están en `docs/pm/ONBOARDING-PM.md`
(«Revisión y aceptación», «Método de revisión que funciona» y «Herramientas
de PM»). Acá va sólo el orden.

## 1. ¿Hay una entrega nueva?

```bash
git ls-remote origin refs/heads/<rama Dev>          # la rama está en NOW.md
git fetch -q origin +refs/heads/<rama Dev>:refs/remotes/origin/<rama Dev>
git log --oneline HEAD..origin/<rama Dev>
```

Si `PARA-PM.md` no cambió desde tu último veredicto, no hay entrega: decíselo
a Emi en una línea y terminá. Si cambió, integrá con `merge --ff-only` (o
`merge` si también escribiste vos) y seguí.

## 2. Leer el informe desde la rama

SHAs, lo que decidís (D1, D2…), supuestos de la Dev y los comandos copiables.
Mirá el diff fuera de `docs/pm` vos misma: `git diff <base> <SHA> --stat`.

## 3. Reproducir

1. `docs/pm/herramientas/levantar.sh <SHA>`, separado del turno (ver
   «Herramientas de PM»).
2. Los casos del informe; los negativos de la Dev; uno o dos negativos tuyos
   (`negativos-pm.sh`) que ataquen otro borde.
3. `suite-y-puertas.sh <base> <SHA>` cuando corresponde.
4. Si la pieza toca dinero, sesión, permisos, datos o es transversal: un
   subagente adversarial, con contexto nuevo («Subagentes» en
   `ONBOARDING-PM.md`).
5. Lo que dé distinto del informe se reproduce y se clasifica antes de
   aceptar. Un rojo intermitente necesita causa, no una repetición verde.

## 4. Veredicto

- `docs/pm/REPRODUCCION-<PIEZA>-<fecha>.md` con la evidencia.
- Arriba de `PARA-DEV.md`: aceptada, rechazada o con devolución, sobre qué
  SHA, y las respuestas a cada D con su número.
- Lo que se le suma a la siguiente tarea queda escrito antes de activarla.
- `NOW.md`, `ROADMAP-…` y `DECISIONS.md` si corresponde.
- Commits sólo en `docs/pm`. Push a la rama Dev.

## 5. Emi

Una línea sólo si tiene que decidir algo: publicar (con el SHA), producto,
costo o riesgo, siempre con una recomendación. Nada se publica sin su
autorización explícita para ese SHA («Publicar» en `ONBOARDING-PM.md`).
