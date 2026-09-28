"""Tomar una fila sin frenar al resto de la API.

La API corre en un solo proceso, con un solo bucle de eventos, y la sesión de
base de datos es síncrona. Un `SELECT ... FOR UPDATE` común, adentro de un
`async def`, espera el candado **frenando el bucle entero**: mientras espera no
se atiende ninguna otra petición.

Y eso cuelga la API para siempre cuando quien tiene la fila es otra petición
del mismo proceso que está esperando algo con `await`, porque para soltarla
necesita que el bucle siga. El cobro lo hace así a propósito: el aviso de
Mercado Pago, la vuelta de quien compra, «Cancelar» y «Rechazar» esperan a
Mercado Pago con la fila de la orden tomada, porque apagar el link con la fila
suelta dejaría entrar otro pago por el mismo link. Medido: tres confirmaciones
a la vez del mismo pago dejaban la API sin responder hasta reiniciarla.

Acá la espera no frena a nadie. Se pide la fila con `NOWAIT` adentro de un
savepoint: si está tomada, la base contesta en el acto, el savepoint se deshace
—la transacción sigue sana— y se vuelve a probar después de un
`await asyncio.sleep`, que le devuelve el bucle a los demás. Quien tiene la
fila termina, la suelta, y el siguiente intento la consigue.

Y tiene tope. Si en `SEGUNDOS_DE_TOPE` no se consiguió, sale `FilaOcupada`, y
cada camino responde algo que se puede reintentar en vez de quedarse esperando.

Lo que se leyó antes de conseguir la fila puede estar viejo: mientras se
esperaba, quien la tenía pudo escribir. La fila que se toma vuelve releída;
lo demás lo relee quien llama.
"""
from __future__ import annotations

import asyncio
import time

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Query, Session

# Mucho más que lo que tarda Mercado Pago en contestar una llamada normal, y
# corto para quien espera. Quien lo cumple no pierde nada: el aviso vuelve con
# 503 y Mercado Pago lo reintenta, la vuelta dice «en proceso» y «Cancelar» o
# «Rechazar» piden probar de nuevo.
SEGUNDOS_DE_TOPE = 10.0

# Entre un intento y el siguiente: empieza corto, porque lo común es que la
# fila se suelte enseguida, y se estira hasta medio segundo para no martillar
# la base mientras quien la tiene espera a Mercado Pago.
PRIMERA_ESPERA = 0.05
ESPERA_MAXIMA = 0.5

# `lock_not_available`: lo que contesta PostgreSQL a un `NOWAIT` que encuentra
# la fila tomada.
FILA_TOMADA = "55P03"


class FilaOcupada(Exception):
    """La fila la tiene otra transacción y no se soltó antes del tope."""


def _es_fila_tomada(error: OperationalError) -> bool:
    original = getattr(error, "orig", None)
    codigo = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
    return codigo == FILA_TOMADA


async def tomar(db: Session, consulta: Query, tope: float = SEGUNDOS_DE_TOPE):
    """Toma con `FOR UPDATE` la fila de `consulta` y la devuelve releída.

    Devuelve `None` si la consulta no encuentra ninguna, igual que `.first()`.
    Levanta `FilaOcupada` si no la consiguió en `tope` segundos. El candado
    queda en la transacción de `db` hasta su `commit` o `rollback`, como uno
    común: soltar el savepoint no lo suelta.
    """
    hasta = time.monotonic() + tope
    espera = PRIMERA_ESPERA
    while True:
        try:
            with db.begin_nested():
                return consulta.with_for_update(nowait=True).populate_existing().first()
        except OperationalError as error:
            if not _es_fila_tomada(error):
                raise
        queda = hasta - time.monotonic()
        if queda <= 0:
            raise FilaOcupada()
        await asyncio.sleep(min(espera, queda))
        espera = min(espera * 2, ESPERA_MAXIMA)
