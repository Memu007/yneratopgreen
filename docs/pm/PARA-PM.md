# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## INTEGRATION-CANDIDATE-1 R3 — el caso 169 en los dos entornos

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **HEAD de este informe** | el commit que trae este archivo, o sea la punta de la rama |
| **SHA candidato — producto y arnés** | `c565e6e` |
| **SHA efectivamente probado** | `c565e6e` (focal 169; el resto lo conserva tu corrida sobre `e0cdfe9`) |
| **Resultado** | focal **169 verde** en los dos entornos: API nativa y contenedor emulado. Y rojo con el comando anterior en los dos |
| **Delta desde `e0cdfe9`** | un solo hunk, dentro del caso 169: `git diff e0cdfe9 c565e6e -- . ':!docs/'` toca sólo `scripts/smoke.mjs` y sólo ese caso. Después de `c565e6e`, sólo este documento |
| **Base** | `main` en `7a898ef`, ya incorporado |
| **Estado** | en mi rama. No integré, no desplegué, no toqué Railway, datos remotos, secretos ni pagos. No empecé otra tarea |

Como pediste, **no repetí la suite completa, ni `a11y`, ni `contraste`**: el
delta es el caso 169 y este informe.

---

### Qué estaba mal

El caso exigía una API nativa en marcha —«este caso necesita una API nativa en
marcha para comprobar que no la tocan»— antes de armar sus dos escenarios de la
rama nativa. Con el lanzador oficial la API vive en un contenedor y no hay
ningún uvicorn de anfitrión, así que el caso se caía en esa línea sin llegar a
probar nada. El error es mío y es del mismo tipo que los otros tres de esta
tarea: el caso heredaba una condición del entorno en vez de fabricarla.

### Qué hace ahora

El escenario lo fijan los dobles, no la máquina:

1. **Contenedor que contesta y no se reinicia** — ya era independiente del
   entorno: el doble de `docker` informa una identidad fija, `restart` dice que
   sí, y el comando tiene que ver que `Pid`/`StartedAt` no se movieron.
2. **Nadie identificable** — el doble de `docker` ahora dice **que no hay
   contenedor**, así el comando toma su rama nativa corra donde corra, y el
   doble de `ps` le esconde cualquier uvicorn.
3. **El puerto lo atiende otro** — mismo doble de `docker`, y el de `ps` le
   presenta un proceso descartable como si fuera la API. El comando lo mata, el
   puerto sigue contestando, y eso es el rojo.
4. **El reinicio real**, con el entorno tal cual es: tiene que **cambiar la
   identidad de quien sirva la API** —`Pid` y `StartedAt` si es contenedor, los
   PID si es uvicorn nativo—.

«No tocó nada» también se mide así ahora: contra quien sirva la API, y no contra
una lista de PID que en Docker está vacía por definición.

Dos detalles de portabilidad que estaban mal para tu máquina: el doble de `ps`
**agrega** su línea mientras el descartable siga vivo y no sea zombi, en vez de
reescribir una línea del `ps` real —así no depende de que `ps` liste un proceso
sin terminal—, y las lecturas piden `-Ao` y no `-eo`, porque en BSD `-e` no
significa «todos los procesos».

### Lo medido

| Entorno | Comando nuevo | Comando anterior |
| --- | --- | --- |
| API nativa | **verde**; el reinicio real pasó de `[647]` a `[1116]` | **rojo**: «salió con 0 y anunció éxito» |
| Contenedor (emulado) | **verde**; informa «con la API en contenedor topgreen-api» y ve la identidad pasar de `[true 1000 …]` a `[true 1001 …]` | **rojo**: mismo síntoma |

**Qué es «emulado» y qué no prueba.** Acá no hay demonio de Docker, así que puse
en el PATH un `docker` que responde `inspect` y `restart` como un contenedor real
—la identidad cambia sólo cuando se lo reinicia— y delega todo lo demás en el
puente del repositorio. Eso prueba que el caso **se ejecuta y discrimina** cuando
quien sirve la API es un contenedor, que es lo que se rompía. **No** prueba que
`docker restart topgreen-api` mueva `Pid` y `StartedAt` de verdad: eso ya lo
demostró tu corrida sobre `e0cdfe9`, con `65908 → 89335`.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| Focal 169, API nativa | verde |
| Focal 169, contenedor emulado | verde |
| Focal 169 contra el comando anterior, en los dos | rojo, con el síntoma exacto |
| `node --check scripts/smoke.mjs` · `diff-check` | verdes |
| Suite completa, `a11y`, `contraste` | **no las repetí**, por tu instrucción; valen las de `e0cdfe9` |

### Lo que queda dicho

- La FAQ de Contacto dice «Aceptamos transferencias bancarias directas al
  vendedor» y el producto también cobra por Mercado Pago. Sigue sin tocar.
- Sigue esperando tu palabra lo del carrito sin sesión.
