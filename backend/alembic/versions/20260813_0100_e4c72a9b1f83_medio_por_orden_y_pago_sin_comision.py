"""medio de pago por orden, y la fila de pago sin comision que mienta

Dos cosas, las dos del mismo problema: el checkout dejaba de ser uno solo.

1. `orders.payment_method`. Un carrito con varios vendedores puede pagarse por
   Mercado Pago en un grupo y por transferencia en otro, asi que el medio es de
   la orden y no del carrito. Las ordenes anteriores quedan en NULL: "no
   informado", que NO es lo mismo que transferencia. No se rellena con lo que
   parezca, se deja dicho que no se sabe.

   Unica excepcion, y es un dato duro y no una inferencia: las ordenes que
   guardaron CBU o alias del vendedor se marcan como transferencia. Ese
   snapshot solo lo escribe el checkout por transferencia.

2. `payments` pierde cuatro columnas:

   - `commission_amount`, `commission_percent` y `seller_amount` mentian.
     TopGreen no cobra comision por venta, y `seller_amount` guardaba el 100 %
     del total, que no es lo que el vendedor cobra: Mercado Pago le descuenta
     la suya. Un numero que nadie puede sostener es peor que ningun numero.
   - `mp_response` guardaba el cuerpo completo de la respuesta de Mercado Pago.
     Lo que no se guarda no se filtra.

   Y `order_id` pasa a ser UNICA: una orden tiene una intencion de pago y no
   dos. Es lo que hace que reintentar -doble clic, timeout, respuesta perdida-
   reutilice la misma en vez de fabricar otra.

La tabla `payments` esta vacia en cualquier instalacion de este proyecto: el
modulo de cobro nunca estuvo montado. Aun asi el downgrade repone las columnas,
vacias, para que volver atras no falle.

Revision ID: e4c72a9b1f83
Revises: d8e35b71c9a2
Create Date: 2026-08-13
"""
from alembic import op
import sqlalchemy as sa


revision = 'e4c72a9b1f83'
down_revision = 'd8e35b71c9a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('payment_method', sa.String(length=20), nullable=True))
    op.create_index('ix_orders_payment_method', 'orders', ['payment_method'])

    # El snapshot bancario solo lo escribe el checkout por transferencia, asi
    # que es evidencia y no conjetura.
    op.execute(
        "UPDATE orders SET payment_method = 'transfer' "
        "WHERE transfer_cbu IS NOT NULL OR transfer_alias_bancario IS NOT NULL"
    )

    op.drop_column('payments', 'commission_amount')
    op.drop_column('payments', 'commission_percent')
    op.drop_column('payments', 'seller_amount')
    op.drop_column('payments', 'mp_response')
    # El indice que ya existia pasa a ser unico, en vez de sumarle una
    # restriccion aparte: asi la base queda igual a lo que declara el modelo
    # y `alembic check` no encuentra diferencias.
    op.drop_index('ix_payments_order_id', table_name='payments')
    op.create_index('ix_payments_order_id', 'payments', ['order_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_payments_order_id', table_name='payments')
    op.create_index('ix_payments_order_id', 'payments', ['order_id'])
    # Vuelven con default 0 y sin NOT NULL: reponer la forma no repone el
    # sentido, y no vamos a inventar una comision que no existio.
    op.add_column('payments', sa.Column('mp_response', sa.JSON(), nullable=True))
    op.add_column('payments', sa.Column('seller_amount', sa.Numeric(14, 2), nullable=True))
    op.add_column('payments', sa.Column('commission_percent', sa.Numeric(5, 2), nullable=True))
    op.add_column('payments', sa.Column('commission_amount', sa.Numeric(14, 2), nullable=True))

    op.drop_index('ix_orders_payment_method', table_name='orders')
    op.drop_column('orders', 'payment_method')
