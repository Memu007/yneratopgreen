# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LINK-ABIERTO-DEVUELTO-1: entrega

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `487114f` (tu asignación) |
| producto | `4b02fec`: una línea de `cobro.en_curso` y su docstring |
| caso, negativos y terminadores | `cac729d` |
| no integrado, no desplegado | `main` sigue en `2ab0a36` |

**Resultado.**

- **Reproducido con la base.** El 231 arma el pago devuelto y el de
  contracargo, cada uno con el link sin apagar dos veces. Desvincular pasa, y
  **el reconciliador deja los dos links vivos en Mercado Pago** aunque la
  vendedora siga vinculada.
- **El link abierto mira los cuatro estados con cobro** (`CON_COBRO`), en el
  criterio único. Con eso:
  - el reconciliador apaga los dos links. El pago, la orden, la reserva, los
    intentos y el stock quedan como estaban: no hubo que frenar;
  - desvincular frena mientras tanto: 409 con 2;
  - lo que ya barría no cambia. Los 20 casos vecinos de Mercado Pago y la
    suite siguen en verde.
- **Los terminadores, restaurados.** Por archivo, las líneas con CR contra la
  base de mis dos piezas (`0495b31`):

  | archivo | antes de mis piezas | en `777bee1` | ahora |
  |---|---|---|---|
  | `scripts/smoke.mjs` | 4 | 0 | 4 (las mismas, ahora en 36426 a 36429) |
  | `scripts/lib/mp-doble.mjs` | 0 | 3 | 0 |

- **Sin migraciones.**
- **Suite completa desde base nueva, sobre `cac729d`:** 230/231. Sólo cae
  el 131, de entorno. Los casos en que hubo que terminar ventas para
  desvincular son los mismos 14 de la pieza anterior.

**Nada para decidir.**

## Por qué apagar no cambia el pago

Lo leí en el código y el caso lo confirma. En el barrido, la orden pasa por
`sincronizar`:

1. la búsqueda trae el mismo pago, con la misma fecha: el intento no se
   vuelve a escribir;
2. `_apagar_y_aplicar` ve que hubo cobro y apaga el link;
3. `aplicar` resume los intentos: da otra vez `REFUNDED` o `CHARGED_BACK`;
4. consolidar el stock es un `UPDATE` condicional sobre la reserva, que ya
   está consolidada: no mueve nada. La orden ya está pagada: no hay
   transición ni aviso.

## Caso

| caso | qué mira | con el producto de la base |
|---|---|---|
| 231 | Devolución y contracargo, cada uno con el link sin apagar al cobrar y al llegar la novedad. Desvincular da 409 con 2 y no toca las credenciales. El reconciliador apaga los dos links, anotado y vencido en el doble, sin cambiar el estado del pago, la orden, la reserva, los intentos ni el stock. Después desvincula | rojo, 5 problemas |

Con la base, el 231 dijo:

```text
[FAIL] 231 … — 5 problema(s):
  con los dos links abiertos: desvincular respondió 200 y no 409: {"estado":"desconectado",…}
  con los dos links abiertos: el conflicto no dice «cobros_en_curso» y 2: {"estado":"desconectado",…}
  con los dos links abiertos: las credenciales no quedaron como estaban (cuenta 88858322 → null)
  devolución: el reconciliador no apagó el link (sin anotar, vivo en Mercado Pago)
  contracargo: el reconciliador no apagó el link (sin anotar, vivo en Mercado Pago)
```

Después de desvincular, el caso vuelve a vincular la misma cuenta. Por eso
el barrido corre con token, y aun así no apaga.

Con el cambio, en la suite completa:

```text
[PASS] 231 … — con el link sin apagar al cobrar ni al llegar la devolución y el contracargo, desvincular da 409 con 2; el reconciliador apaga los dos links sin cambiar el estado del pago, la orden, la reserva ni el stock, y después desvincula (5583 ms)
```

## Negativos

`python3 scripts/sabotajes_link_abierto_devuelto_1.py`: los dos dan su rojo
en la primera corrida. Dice «todos dieron el rojo esperado» y «src y backend
después: como estaban».

| sabotaje | rojo |
|---|---|
| `criterio-sin-los-estados-nuevos` (vuelve a `APPROVED` y `EN_REVISION`) | 231: «desvincular respondió 200 y no 409», y los dos «el reconciliador no apagó el link». Nada cambia de estado |
| `reconciliador-cambia-el-estado` (al barrer una cobrada, la deja aprobada) | 231: «devolución: pago cambió: REFUNDED → APPROVED» y «contracargo: pago cambió: CHARGED_BACK → APPROVED». Los links se apagan y desvincular frena |

**Aviso de entorno.** El primero deja desvincular, así que cada corrida deja
dos ventas con el link abierto en la base, de una vendedora nueva. Es como
los tres de la pieza anterior: no frenan a ningún otro caso.

## Cómo verificarlo

Con el entorno arriba y la siembra demo:

```bash
SMOKE_CASOS=231 node scripts/smoke.mjs
# → 1/1 pasaron; 0 fallaron   (unos 6 s)

python3 scripts/sabotajes_link_abierto_devuelto_1.py
# → todos dieron el rojo esperado   (menos de un minuto)
# → src y backend después: como estaban

git show 0495b31:scripts/smoke.mjs | grep -c $'\r'; grep -c $'\r' scripts/smoke.mjs
# → 4 y 4
grep -c $'\r' scripts/lib/mp-doble.mjs
# → 0
```

## Puertas

| puerta | resultado |
|---|---|
| suite completa desde base nueva, sobre `cac729d` | 230/231; cae el 131, de entorno |
| lint, `tsc --noEmit`, build | verdes |
| `compileall`, `pip check`, `node --check` | verdes; «No broken requirements found.» |
| `alembic check` | «No new upgrade operations detected.» |
| diff-check con `cr-at-eol` | limpio sobre `487114f..cac729d` |
| CR por archivo contra la base (`487114f`) | cambian sólo los dos que había que restaurar: `smoke.mjs` 0 → 4 y `mp-doble.mjs` 3 → 0. `cobro.py`, igual |
| a11y, contraste, auditoría móvil, guías | **no corridas**: no cambia nada visible |

## Riesgos

- **Si Mercado Pago no deja apagar ese link nunca**, la orden sigue en curso
  y quien vende no puede desvincular. Es lo mismo que ya pasaba con un pago
  aprobado. El reconciliador lo reintenta una vez por barrido.
- **Una vendedora con un link así** hoy puede desvincular, y con el cambio no
  hasta el barrido siguiente. En producción no hay ninguna: Mercado Pago no
  está habilitado.

---

## Los CR de DESVINCULAR-CON-COBROS-1

Restaurados en esta pieza (arriba). La causa eran mis herramientas de
edición, y está corregida.

## DESVINCULAR-CON-COBROS-1

Aceptada sobre `777bee1` y publicada por vos en `2ab0a36`. Sin cambios.
