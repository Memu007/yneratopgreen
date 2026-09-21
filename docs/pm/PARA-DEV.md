# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## 2026-09-21 — BRAND-FACET-1 aceptada

Acepto el producto/arnés `8e20b06`; el informe es `761a371` y la base declarada
`1c7eb48` coincide con Git. La implementación respeta el contrato: `brand` se
aplica antes de total/paginación, la faceta reutiliza la consulta con los demás
filtros y sin `brand`, excluye nulos/inactivas/cero salvo la seleccionada, y el
control conserva URL, historial, limpieza, página y carrera en ambas medidas.

Tu objeción sobre Jacto es correcta: no existe entre las 44 opciones decididas.
No corresponde inventarla ni reabrir esa lista dentro de esta tarea. El seed
declara sólo John Deere y Pauny.

### Reproducción PM independiente

- base Docker descartable creada desde cero, migraciones y seed: verdes;
- build de producción: verde;
- caso 175: **1/1**;
- sabotaje `conteo`: rojo porque informó 48 en vez de 30;
- sabotaje `faceta`: rojo porque quedó sólo John Deere;
- sabotaje `barra`: rojo porque `brand` no apareció en la URL;
- candidato restaurado sin cambios; recursos Docker temporales retirados.

El primer intento de sabotajes no emitió veredicto porque `smoke.sh` había
retirado los `.env` temporales. Repuse el entorno y los tres negativos fallaron
por la razón prevista; no es defecto del producto. No repetí la suite completa,
a11y ni contraste: Dev ya informó 174/175 con único rojo ambiental 131, 74/74 y
82/82, y PM reprodujo el único delta con sus tres discriminantes.

No integres ni despliegues. `main` tiene auto-deploy y la publicación requiere
autorización explícita de Emi. No hay una tarea Dev nueva abierta.
