# Reproducción PM — TEST-SUITE-167S — 2026-09-11

## Veredicto

**Aceptada en rama Dev.** El 139 ya no hereda publicaciones ajenas: crea un
activo y un servicio comprables, los localiza por título exacto y los retira al
terminar. El 143 conserva la base como precondición y espera además el estado y
la acción inversa visibles después del PATCH/GET.

- Arnés Dev: `d7e17f9`.
- Informe Dev: `40131de`.
- Dev informó 139+143 desde base limpia en **2/2**, más rojos viejos y
  negativos discriminantes.
- PM revisó el diff completo: 167 altas y 19 bajas sólo en
  `scripts/smoke.mjs`; `src/` y `backend/` quedaron vacíos.
- Sintaxis y `diff-check`: verdes.

## Reproducción independiente

PM ejecutó 139+143 juntos desde una base Docker local recreada. Resultado:

| Puerta | Resultado |
|---|---:|
| Caso 139 | **PASS** — publicaciones propias, tres pantallas y retiro final |
| Caso 143 | **PASS** — pausa/reactivación/edición/recarga visibles |
| Corrida focal | **2/2**, 0 fallos, salida 0 |
| Build incluido por smoke | verde |

Log persistente: `/private/tmp/topgreen-pm-test-suite-167s.log`.

El primer lanzamiento quedó detenido antes de ejecutar casos, durante la
verificación redundante de Chromium, y fue cancelado: no cuenta. Un segundo
intento terminó antes de recrear la base por permisos locales de Docker: salida
1 y tampoco cuenta. La corrida final reutilizó el Chromium ya instalado,
recreó sólo el entorno Docker local y produjo el resultado recuperable citado.

## Revisión adversarial

- El 139 busca el activo propio en Inicio/Mercado y el servicio propio en
  Servicios; no usa posición, seed ni una tarjeta de otro caso. Comprueba la
  baja lógica de ambas filas al finalizar.
- El 143 espera condiciones consultadas cada 50 ms con límite de 20 s; no
  reemplazó el defecto por una espera fija ni quitó anatomía, modalidad, stock
  o control agotado.
- Los sabotajes informados vuelven rojo el 139 si desaparece la puerta de
  ingreso y el 143 si una publicación pausada pierde «Activar».
- No se ejecutó ni se atribuye una suite completa PM. La tarea era sólo arnés y
  ordenaba no repetirla.

Quedan fuera de esta pieza el residuo histórico del 143 y otros casos que aún
usan una primera tarjeta. No se demostró que estén rotos y no se amplía el
alcance sin un rojo. `COPY-CLEAR-1` queda habilitada como siguiente tarea.
