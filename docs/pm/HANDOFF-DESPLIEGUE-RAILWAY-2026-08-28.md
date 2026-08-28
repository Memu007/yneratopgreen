# Handoff PM — desplegar `main` en Railway descartable

Fecha: 2026-08-28.

## Autorización y objetivo

Emi autorizó expresamente este ensayo en el proyecto Railway descartable de
TopGreen. La ejecución debe hacerse desde un chat nuevo con acceso a la sesión
de Brave de su escritorio.

Objetivo único: desplegar exactamente el `main` vigente en Backend y Frontend y
demostrar que GitHub y ambos servicios publican el mismo SHA completo. Esto no
autoriza producción, pagos, seed, cambios de datos, variables, secretos ni una
tarea nueva para Dev.

## Puesta al día obligatoria

1. Trabajá sólo sobre `Memu007/yneratopgreen`.
2. Revisá `git status`; no pises cambios locales.
3. Actualizá `main` y leé `AGENTS.md`, `docs/pm/ONBOARDING-PM.md`,
   `docs/pm/NOW.md`, este archivo y `RAILWAY.md`.
4. Guardá como `SHA_ESPERADO` el resultado completo de:

   ```bash
   git fetch origin main
   git rev-parse origin/main
   ```

5. Si Brave no está disponible como navegador controlable, frená. No sustituyas
   silenciosamente la sesión pedida por Chrome remoto.

## Entorno autorizado

- Proyecto Railway: `strong-playfulness`.
- Backend: `https://backend-production-ba84.up.railway.app`.
- Frontend: `https://ynerav.up.railway.app`.
- Servicios: `Backend`, `Frontend` y `PostGIS`.
- `PostGIS` no se redespliega ni se modifica.
- `MP_CHECKOUT_HABILITADO` debe permanecer en `false`.

No copies secretos ni valores sensibles al chat, a Git o a la salida de
evidencia.

## Ejecución

1. Abrí en Brave el proyecto y confirmá por nombre que sea
   `strong-playfulness`.
2. Confirmá que `MP_CHECKOUT_HABILITADO=false`; no edites ninguna variable.
3. Desplegá primero `Backend` desde el último commit de `main`. Antes de la
   confirmación final, comprobá que Railway muestre `SHA_ESPERADO` como commit
   fuente. Esperá `SUCCESS` y health HTTP 200.
4. Desplegá después `Frontend` con el mismo control de commit. Esperá `SUCCESS`,
   `/health` HTTP 200 y `/` HTTP 200.
5. No ejecutes seed, consola SQL, reinicios, `railway down`, pagos ni acciones
   sobre usuarios u órdenes. Las migraciones automáticas del entrypoint del
   Backend sí forman parte del despliegue esperado.

Si Railway sólo ofrece redesplegar un artefacto viejo, el SHA no es visible, una
migración falla o un healthcheck no queda verde, frená y reportá la evidencia.
No improvises una corrección ni hagas rollback manual.

## Verificación obligatoria

Ejecutá desde el clon:

```bash
git fetch origin main >/dev/null 2>&1
main=$(git rev-parse origin/main)
backend=$(curl -fsS "https://backend-production-ba84.up.railway.app/api/health" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["revision"])')
frontend=$(curl -fsS "https://ynerav.up.railway.app/" \
  | grep -o '<meta name="topgreen:revision" content="[^"]*"' \
  | sed 's/.*content="//; s/"$//')
printf 'main      %s\nbackend   %s\nfrontend  %s\n' "$main" "$backend" "$frontend"
[ "$main" = "$backend" ] && [ "$main" = "$frontend" ] \
  && echo "OK: los tres son el mismo commit" \
  || { echo "NO coinciden: hay un servicio atrasado"; exit 1; }
```

Sólo se aprueba si los tres valores son idénticos, tienen 40 caracteres
hexadecimales y ninguno dice `sin-revision-local`. Confirmá además:

- los dos despliegues en `SUCCESS`;
- Backend y Frontend respondiendo HTTP 200;
- `MP_CHECKOUT_HABILITADO=false` sin cambios;
- ningún servicio o volumen adicional creado.

## Cierre

Informale a Emi: SHA exacto, identificadores de ambos despliegues, estados,
resultado de la comparación y cualquier límite. No muestres secretos.

No hagas un commit de cierre después del despliegue: movería `main` y rompería
de inmediato la igualdad recién probada. La Dev permanece pausada y no recibe
otra tarea.

