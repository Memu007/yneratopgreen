# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en `docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones hasta el cierre. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## Sin tarea activa para Dev

`INTEGRATION-CANDIDATE-1` quedó **aceptada** en `c565e6e`, con informe
`ad914a3`. La PM reprodujo el caso 169 con Docker real en **1/1** y verificó que
el delta desde `e0cdfe9` se limita a ese caso; la corrida completa previa conserva
la evidencia de los casos 1–168.

No integres, no despliegues y no empieces `CAT-PAGE-1`. La candidata queda
congelada mientras Emi/PM resuelven backups y el cambio controlado de
ramas/deploy.
