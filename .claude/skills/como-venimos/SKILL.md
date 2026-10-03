---
name: como-venimos
description: Para Emi, en la sesión de la PM o en la de la Dev. Contesta en tres líneas quién tiene la pelota, qué sigue y qué tiene que decidir Emi, leyendo la rama y no la memoria del chat. No cambia nada.
---

# /como-venimos — el estado en tres líneas, para Emi

Sólo lee. No integra, no commitea, no arranca nada.

## 1. Leer, desde la rama Dev

La rama es la que `docs/pm/NOW.md` registra como «Rama Dev».

```bash
git fetch origin <rama Dev>
git log -1 --format='%h %cr' origin/<rama Dev> -- docs/pm/PARA-DEV.md   # lo último de la PM
git log -1 --format='%h %cr' origin/<rama Dev> -- docs/pm/PARA-PM.md    # lo último de la Dev
git show origin/<rama Dev>:docs/pm/PARA-DEV.md | head -40
git show origin/<rama Dev>:docs/pm/PARA-PM.md | head -30
git show origin/<rama Dev>:docs/pm/NOW.md | head -25
```

- Si lo último es de la Dev, la pelota la tiene la PM: revisar esa entrega.
- Si lo último es de la PM, la tiene la Dev: la «Tarea activa» o la
  devolución.
- La tiene Emi si `PARA-DEV.md` o `NOW.md` dicen que algo espera su decisión
  o su autorización para publicar.

## 2. Contestar así, y nada más

- **La pelota la tiene:** PM (revisando …) / Dev (haciendo …) / Emi (decidir …).
- **Sigue:** la próxima pieza de la cola.
- **Vos decidís:** lo pendiente de Emi, o «nada por ahora».

Si dos fuentes no coinciden (por ejemplo, `NOW.md` dice una tarea activa y
`PARA-DEV.md` otra), agregá una cuarta línea que lo diga.
