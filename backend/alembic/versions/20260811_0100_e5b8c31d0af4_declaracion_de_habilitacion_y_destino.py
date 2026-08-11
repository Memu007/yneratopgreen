"""declaracion de habilitacion con detalle y fecha, y destino oficial de la orden

Dos datos que el contrato ya exigia y no existian:

1. La habilitacion del transporte era un booleano suelto. `ALCANCE-Y-LIMITES.md`
   y `DECISIONS.md` piden una DECLARACION con detalle y fecha. La fecha la pone
   el servidor: nadie la escribe ni la retrodata.
2. El destino del envio era texto libre. Para poder calcular compatibilidad
   geografica hace falta una localidad del padron oficial, guardada en la orden.

Las dos columnas de usuario quedan NULL en los perfiles que ya existen: no se
inventa una declaracion que nadie hizo. Un perfil sin detalle queda incompleto
y no aparece como compatible hasta que su titular lo complete.

`orders.shipping_locality_id` tambien es NULL para las ordenes historicas, que
tienen que seguir leyendose.

Revision ID: e5b8c31d0af4
Revises: c7d2e9a4f1b6
Create Date: 2026-08-11
"""
from alembic import op
import sqlalchemy as sa


revision = 'e5b8c31d0af4'
down_revision = 'c7d2e9a4f1b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('carrier_certification_detail', sa.String(length=500), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('carrier_certification_declared_at', sa.DateTime(), nullable=True),
    )

    op.add_column(
        'orders',
        sa.Column('shipping_locality_id', sa.String(length=20), nullable=True),
    )
    op.create_index(
        'ix_orders_shipping_locality_id',
        'orders',
        ['shipping_locality_id'],
    )
    op.create_foreign_key(
        'fk_orders_shipping_locality_id_localities',
        'orders',
        'localities',
        ['shipping_locality_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_orders_shipping_locality_id_localities',
        'orders',
        type_='foreignkey',
    )
    op.drop_index('ix_orders_shipping_locality_id', table_name='orders')
    op.drop_column('orders', 'shipping_locality_id')

    op.drop_column('users', 'carrier_certification_declared_at')
    op.drop_column('users', 'carrier_certification_detail')
