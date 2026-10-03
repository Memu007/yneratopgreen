---
name: respondio
description: Dev. Retomar el ciclo después de que la PM escribió en PARA-DEV.md - traer la rama Dev, integrar sus commits y hacer lo que dice. Usalo cuando Emi diga «Respondió» o cuando lo dispare el loop de espera.
---

# /respondio — retomar después de la PM

Las reglas están en `CLAUDE.md` y `docs/pm/ONBOARDING-DEV.md`. Acá va sólo el
orden.

## 1. ¿Hay algo nuevo?

```bash
git fetch origin <rama Dev>          # la que registra docs/pm/NOW.md
git log --oneline HEAD..origin/<rama Dev>
```

- **Nada nuevo de la PM:** decilo en una línea y terminá. Si te disparó el
  loop de espera, no hagas nada más: el loop vuelve a preguntar.
- **Hay commits:** seguí.

## 2. Integrar

- Con `merge`, nunca `rebase`.
- Los commits de la PM tocan sólo `docs/pm`. Si tocan otra cosa, frená y
  avisale a Emi antes de seguir.

## 3. Leer qué cambió

```bash
git diff <SHA de antes>..HEAD -- docs/pm/PARA-DEV.md
```

- **`PARA-DEV.md` no cambió** (la PM sólo actualizó `NOW.md` u otro
  documento): no hay respuesta todavía. Si te disparó el loop, dejalo
  corriendo y terminá.
- **Cambió:** si te disparó el loop, frenalo ahora. Arriba de `PARA-DEV.md`
  está la decisión sobre tu última entrega. Leé también la «Tarea activa»
  entera: la PM puede haberle sumado un agregado.
- Si tu informe tenía decisiones numeradas (D1, D2…), comprobá que la PM
  contestó cada una. Si falta alguna, preguntala en tu próximo informe; no la
  des por decidida.

## 4. Qué hacer según lo que dice

| La PM dice | Qué hacés |
|---|---|
| Devolución sobre tu entrega (rechazo, agregado, cambio) | Se atiende primero, en la misma pieza, y se vuelve a entregar con `/entregar` |
| Aceptada, con una «Tarea activa» nueva | Arrancala. Una pieza nueva arranca recién con el veredicto de la anterior |
| Aceptada, sin tarea nueva | Avisale a Emi en una línea y no arranques nada |
| Algo que decide Emi (producto, costo, riesgo, publicar) | Preguntale con una recomendación y no sigas en eso |

## 5. Trabajar

- Levantá el entorno: `./scripts/entorno_nativo.sh` (muere entre turnos).
- Rojo antes que verde: el caso nuevo tiene que fallar por el motivo de la
  tarea antes de tocar el producto.
- Cerrá con `/entregar`.

## 6. A Emi

Sólo lo que tiene que decidir o saber, en una línea. El detalle va en
`PARA-PM.md`.
