---
name: entregar
description: Dev. Cerrar una pieza de la tarea activa - revisión independiente, negativos, puertas, commits separados, informe en PARA-PM.md, push y loop de espera. Usalo cuando el código y los casos de la tarea ya están.
---

# /entregar — cerrar una pieza

Qué es una entrega lo dicen `CLAUDE.md` §4 y `docs/pm/ONBOARDING-DEV.md`
(«Calidad mínima de una entrega», «Informe Dev → PM»). Acá va el orden y los
comandos.

## 1. Antes de darla por terminada

- **Auto-revisión:** leé `git diff <base>..HEAD` completo y sacá lo que la
  tarea no pide. Lo que agregaste sin que se pidiera va en el informe como
  supuesto reversible, para que la PM pueda rechazarlo.
- **Revisión independiente:** corré `/code-review high` sobre lo que cambió
  la rama desde la base. Lo confirmado dentro de la tarea se arregla, con su
  rojo antes. Lo que quede afuera va al informe como riesgo, con su
  severidad. Si la pieza toca dinero, sesión, permisos, órdenes, stock,
  migraciones o datos, corré también `/security-review`.
- **Negativos:** cada caso nuevo o cambiado tiene su sabotaje discriminante
  en `scripts/sabotajes_<pieza>.py`, uno por motivo, con lo que el rojo tiene
  que decir y lo que no. Los de backend reinician la API con `REINICIAR_API`.
  Ningún sabotaje toca datos de la siembra (marcas de la lista, usuarios
  demo): el caso trabaja sobre lo que crea y retira.

## 2. Commits

- El producto en un commit; los casos, el arnés y los negativos en otro; el
  informe en otro.
- **Finales de línea** (hay archivos CRLF y mezclados):
  - contá las líneas con CR por archivo contra la base:
    `grep -c $'\r$' <archivo>` y `git show <base>:<archivo> | grep -c $'\r$'`;
  - `git -c core.whitespace=cr-at-eol diff --check <base>..HEAD` tiene que
    salir limpio;
  - `diff <(git diff --stat <base>..HEAD) <(git diff --stat --ignore-cr-at-eol <base>..HEAD)`
    no tiene que mostrar nada.
  - La herramienta de edición normaliza CRLF: en esos archivos, reemplazos
    binarios que conserven el final de la zona.

## 3. Puertas, sobre el SHA que se entrega

```bash
./scripts/entorno_nativo.sh --recrear && node scripts/smoke.mjs
node scripts/a11y.mjs --todas
node scripts/contraste.mjs
node scripts/mobile-audit.mjs
node scripts/guia-admin.mjs
node scripts/guia-usuario.mjs
npm run lint && npm run build
# si tocó backend, con el entorno arriba:
python3 -m compileall -q backend/app && (cd backend && ./.venv/bin/alembic check)
```

- En el contenedor remoto el 131 cae por entorno (el puente de `docker`).
  Cualquier otro rojo se diagnostica; no se repite hasta que pase.
- La auditoría móvil deja `docs/pm/evidence/mobile-*`: se borra, no se
  versiona.

## 4. Informe en `docs/pm/PARA-PM.md`

- Reemplazá todo el cuerpo. Conservá el encabezado `# Dev → PM` y «Este
  archivo es mío y vos no lo tocás. Acá te informo.».
- Arriba: tabla de SHAs, el resultado y lo que decide la PM, o «Nada para
  decidir» con los supuestos.
- Un bloque corto de comandos copiables, cada uno con lo que tiene que
  mostrar.
- Tabla de puertas con la salida exacta, tabla de CR por archivo, riesgos.
- Los textos de cada rojo se copian de la salida, no de memoria. Antes de
  commitear, releé cada número del informe contra su log.

## 5. Subir

```bash
git fetch origin <rama Dev> && git log --oneline HEAD..origin/<rama Dev>
```

- Si la PM escribió mientras tanto: integrá con `merge` y releé
  `PARA-DEV.md`. Puede haber cambiado la tarea activa.
- `git ls-files | grep -ci pre_firma` → `0`. Si no da 0, no subas.
- `git push -u origin <rama Dev>`; sólo por fallas de red, reintentá a los
  2, 4, 8 y 16 s.
- A Emi: «Respondí» y, como mucho, una línea con lo que tiene que decidir.
- Arrancá el loop de espera: `/loop 30m /respondio`. Lo frena `/respondio`
  cuando la PM contesta.
