"""modo de traslado de la orden y transportista elegido

Hasta ahora la orden sabia a donde iba pero no como. La Pieza C exige que el
comprador resuelva cada futura orden con una de dos decisiones: eligio un
transportista compatible, o coordina el traslado por su cuenta.

Dos columnas nuevas en `orders`:

1. `shipping_mode`: 'carrier' o 'self'. Queda NULL en las ordenes historicas, y
   ese NULL significa "traslado no definido". NO se reinterpreta como cuenta
   propia: nadie declaro eso.
2. `carrier_id`: el transportista elegido, por relacion real contra `users`.
   Solo tiene valor cuando el modo es 'carrier'.

La relacion se guarda aunque despues el perfil del transportista quede
incompleto o inactivo: una asignacion historica se sigue leyendo. Que no sea
elegible para operaciones nuevas es asunto de la consulta de compatibilidad,
no de esta tabla.

Revision ID: b2f7a04d9c31
Revises: e5b8c31d0af4
Create Date: 2026-08-12
"""
from alembic import op
import sqlalchemy as sa


revision = 'b2f7a04d9c31'
down_revision = 'e5b8c31d0af4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'orders',
        sa.Column('shipping_mode', sa.String(length=20), nullable=True),
    )
    op.add_column(
        'orders',
        sa.Column('carrier_id', sa.String(length=36), nullable=True),
    )
    op.create_index('ix_orders_carrier_id', 'orders', ['carrier_id'])
    op.create_foreign_key(
        'fk_orders_carrier_id_users',
        'orders',
        'users',
        ['carrier_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_orders_carrier_id_users', 'orders', type_='foreignkey')
    op.drop_index('ix_orders_carrier_id', table_name='orders')
    op.drop_column('orders', 'carrier_id')
    op.drop_column('orders', 'shipping_mode')
