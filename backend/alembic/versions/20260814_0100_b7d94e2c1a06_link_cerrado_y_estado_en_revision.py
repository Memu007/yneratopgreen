"""Si el link de pago quedo apagado, y el estado para dos cobros

Dos cosas que faltaban para que una preferencia ya cobrada no siga viva.

`payments.link_cerrado` dice si la preferencia de esa orden ya se apago del
lado de Mercado Pago. Un link de Checkout Pro **no se muere cuando se cobra**:
sigue sirviendo, y se puede volver a pagar. Ahora se lo vence apenas entra el
primer pago acreditado, pero esa es una llamada a Mercado Pago y puede fallar,
asi que hace falta saber si quedo hecha. Mientras esto sea falso con un cobro
acreditado, el reconciliador lo reintenta.

Nace en `false` para todas las filas y eso es lo correcto, no una comodidad:
de las que ya estan cobradas no sabemos si su link sigue abierto, y suponer
que si —y volver a apagarlo— es barato y seguro; suponer que no seria dejar
links vivos sin que nadie los mire nunca mas.

Y el valor `EN_REVISION` del enum de estados, para cuando una misma orden
junta mas de un pago aprobado distinto. No es un error teorico: dos intentos
en vuelo pueden acreditarse los dos aunque el link se apague al primero.
Resumir eso como "aprobado" contaria una venta donde hay dos cobros.

La vuelta atras quita la columna. El valor del enum **no se saca**: PostgreSQL
no permite quitar valores de un tipo enumerado sin recrearlo, y recrear un tipo
del que dependen filas vivas es mucho mas peligroso que dejar un valor sin usar.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b7d94e2c1a06'
down_revision = 'f1a63d0e7b45'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # El valor del enum va primero y fuera de la transaccion de los DDL de
    # tabla: PostgreSQL no deja usar un valor de enum recien agregado dentro de
    # la misma transaccion que lo agrego.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE paymentstatus ADD VALUE IF NOT EXISTS 'EN_REVISION'")

    op.add_column(
        'payments',
        sa.Column(
            'link_cerrado',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column('payments', 'link_cerrado')
