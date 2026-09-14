# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones
hasta el cierre. La historia anterior permanece en Git; la instantánea previa
a esta poda está en `0f89e78`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-13 — POST-INTEGRATION-CLEAR-1

`BACKUP-RESTORE-1` quedó aceptada en `52ba294`/`b8223b1` e integrada en
`fbd6caf`. PM reprodujo el ciclo y los negativos con Docker real. Ésta es ahora
la única tarea activa.

### Problema reproducido

Cuando `handleCheckout` confirma que la sesión ya no vale, conserva el carrito
local y baja la identidad correctamente. Sin embargo, `Header.tsx` sólo muestra
el botón **Carrito** dentro de la rama autenticada. Si la persona cancela el
Login, los ítems siguen guardados pero ya no tiene cómo reabrirlos desde la
cabecera.

Además, la FAQ «¿Cuáles son las formas de pago?» sólo nombra transferencias,
aunque el producto también contempla Mercado Pago de forma opcional por
vendedor.

### Alcance mínimo

1. Si el carrito tiene contenido, la cabecera debe ofrecer **Carrito** aunque
   no haya sesión. Ese control abre el mismo carrito conservado.
2. Continuar compra sin sesión sigue abriendo el Login existente. Cancelarlo
   vuelve al carrito con los mismos ítems; autenticarse permite continuar por
   el flujo vigente. No existe checkout anónimo.
3. Una salida explícita conserva la regla actual: vacía el carrito. Con cero
   ítems y sin sesión, no agregues un botón de carrito vacío.
4. En Contacto, la respuesta de la FAQ debe decir que se puede pagar por
   transferencia directa al vendedor y por Mercado Pago **cuando ese vendedor
   lo tenga habilitado**. No prometas ambos medios para todos ni agregues
   comisiones, planes o custodia de fondos.

Reutilizá el estado y los flujos existentes; no agregues routing, estado
paralelo, dependencias ni cambios de backend para resolver dos condiciones de
interfaz.

### Regresión exigida

Agregá el siguiente caso disponible del smoke para medir, como mínimo:

- carrito con ítems + sesión confirmada inválida → identidad fuera y carrito
  todavía accesible desde cabecera;
- cerrar el Login → mismos ítems y carrito reabierto;
- salida explícita → carrito vacío;
- la FAQ nombra transferencia y Mercado Pago con su condición por vendedor.

El caso debe fallar contra `fbd6caf` por el acceso perdido al carrito y pasar
con la corrección. No afirmes comportamiento sólo leyendo el fuente.

### Compuertas

- caso focal nuevo contra base limpia;
- suite smoke completa desde base limpia;
- build, lint, `diff-check`, a11y y contraste;
- revisión explícita en escritorio y celular de la cabecera sin sesión, sin
  deformar marca, navegación ni foco.

### Fuera de alcance

- No habilitar ni homologar Mercado Pago, no tocar credenciales, Railway,
  datos remotos, backups ni configuración productiva.
- No cambiar la regla de vaciado en logout explícito.
- No rediseñar cabecera, Login, carrito, checkout o Contacto.
- No empezar `CAT-PAGE-1` ni otra tarea.
- No integrar ni desplegar.

### Entrega

Entregá rama, SHA base, SHA candidato, diff completo, comandos y resultados.
Reemplazá `PARA-PM.md` con un informe breve y frená para revisión PM.

---

## 2026-09-13 — Devolución R1 sobre `eb62d3d`

El cambio de producto no necesita otra vuelta por ahora. PM reprodujo:

- caso 170 sobre `eb62d3d`: **1/1**;
- el mismo caso sobre `2d8ecfd`: **0/1**, rojo exacto porque la cabecera no
  ofrece el carrito conservado;
- build, lint y `git diff --check`: verdes;
- a11y: **70/70**, cero bloqueantes;
- contraste: **78/78**, cero incumplimientos.

La entrega queda **NO ACEPTADA TODAVÍA** por dos faltantes de la compuerta:

1. `PARA-PM.md` sigue conteniendo el informe de `BACKUP-RESTORE-1 R4`.
   Reemplazalo por el informe de `POST-INTEGRATION-CLEAR-1`, con base
   `2d8ecfd`, candidato `eb62d3d` —o un SHA nuevo sólo si hace falta corregir
   algo—, diff y resultados exactos.
2. Entregá la suite smoke completa desde base Docker limpia, con los 170 casos.
   El focal no la sustituye porque esta pieza toca sesión/autenticación. Corré
   la limpieza sólo en un entorno local descartable y autorizado; no uses
   producción ni datos reales. Si no contás con ese entorno, declaralo en el
   informe y frená.

No cambies producto sólo para producir un commit nuevo. Si la suite completa
queda verde, alcanza con agregar el informe documental sobre `eb62d3d`. Si da
rojo, corregí únicamente la regresión, repetí las puertas afectadas y entregá
un nuevo candidato. Sigue prohibido integrar, desplegar o empezar
`CAT-PAGE-1`.
