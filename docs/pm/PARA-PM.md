# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## AGENTS-CONSOLIDATION-1

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3-agents` — **nueva**, ver la nota de abajo |
| **Base exacta** | `2e752cb`, o sea `origin/main` vigente. El commit candidato lo tiene como padre |
| **HEAD de este informe** | el commit que trae este archivo, o sea la punta de la rama |
| **SHA candidato** | `6d2b66d` |
| **Diff del candidato** | sólo `AGENTS.md`: 1 archivo. Fuera de `AGENTS.md` y `docs/pm/PARA-PM.md`, vacío |
| **Compuertas** | `diff-check` limpio; los seis enlaces locales del archivo existen |
| **Estado** | candidata documental para tu revisión. No integré, no empujé a `main`, no toqué producto, scripts, dependencias, Railway ni ramas de despliegue |

No empecé `BACKUP-RESTORE-1`, `POST-INTEGRATION-CLEAR-1` ni `CAT-PAGE-1`.

---

### Por qué una rama nueva, y no la mía

Tu criterio 1 pide que el commit tenga como padre `origin/main`. Mi rama
designada, `claude/dev-role-repo-3l0kp3`, tiene arriba la candidata aceptada y
congelada —`c565e6e` con su informe `ad914a3`— y **no hay PR ni ningún otro ref
remoto que la sostenga**: es el único puntero que tiene GitHub a esa entrega.
Resetearla para apoyarme en `main` habría dejado sin referencia una composición
que `NOW.md` y `MATRIZ.md` citan y que todavía hay que integrar.

Así que la pieza va en `claude/dev-role-repo-3l0kp3-agents`, con padre
`origin/main`, y la rama congelada no se movió. Emi autorizó la rama nueva antes
de que empujara. Las dos quedan en el remoto:

- `claude/dev-role-repo-3l0kp3` → `ad914a3` (candidata de producto, congelada);
- `claude/dev-role-repo-3l0kp3-agents` → esta pieza documental.

### Qué quedó en `AGENTS.md`

Es la versión consolidada de `c565e6e` más la regla de Emi al final, y nada más.

- **Disparador breve y enlaces**: `docs/pm/ONBOARDING-PM.md` para el rol PM,
  `CLAUDE.md` + `docs/pm/ONBOARDING-DEV.md` para Dev, y el párrafo de auditoría
  externa.
- **No queda** el procedimiento numerado de ocho pasos ni ninguna lista de
  precedencia: comprobado, el archivo no tiene ninguna línea que empiece con un
  número ni una sección «Precedencia».
- **Las tres reglas mínimas** siguen: el chat no es fuente de verdad;
  `PARA-PM.md` se lee desde la rama Dev cuando la entrega no está integrada; y
  cuando un documento y Git se contradicen sobre lo implementado, manda Git.
- **La sección de eficiencia de chats** quedó al final, bajo el título «Cuándo
  conviene seguir en un chat nuevo», con **tu texto palabra por palabra**: lo
  comparé literal y también normalizando espacios, y coincide en los dos casos.
  No agregué ninguna condición: sigue diciendo que se avisa cuando conviene, que
  no se interrumpe una tarea activa por la longitud del chat y que antes de
  recomendar el cambio el estado tiene que estar guardado en el repositorio.

Una nota sobre esa sección: **nunca estuvo commiteada**. Busqué el texto en todo
el historial de `AGENTS.md` y en las últimas 200 revisiones del repositorio y no
aparece; vivía sólo en el árbol de Emi. La tomé del bloque que citaste en
`PARA-DEV.md`, que es la única copia que hay en Git.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| Diff fuera de `AGENTS.md` y `PARA-PM.md` | vacío |
| Procedimiento numerado / lista de precedencia | ninguno |
| Texto de Emi, literal | coincide |
| Enlaces locales del archivo | los seis existen |
| `diff-check` | limpio |

No corrí suite, `a11y` ni `contraste`: la pieza no toca producto ni arnés.

### Lo que sigue dicho, y que no vive en ningún documento de `main`

Lo repito porque este canal se reemplaza entero en cada entrega y estas dos
cosas sólo están escritas acá:

- sigue esperando tu palabra **el carrito sin sesión**;
- la FAQ de Contacto dice «Aceptamos transferencias bancarias directas al
  vendedor» y el producto también cobra por Mercado Pago
  (`src/components/Pages/ContactPage.tsx:305`). Sin tocar.
