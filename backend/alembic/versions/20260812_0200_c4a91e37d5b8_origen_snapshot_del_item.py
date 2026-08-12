"""origen oficial de cada item de orden, congelado al confirmar

El nombre y el precio del producto ya se guardaban como snapshot en
`order_items`: la orden tiene que seguir diciendo lo mismo aunque la
publicacion cambie despues. El ORIGEN no estaba, y se leia de la localidad
ACTUAL de la publicacion. Un vendedor que editaba su publicacion despues de la
compra le cambiaba el punto de retiro al transportista.

Tres columnas nuevas en `order_items`, todas NULL para lo historico:

1. `origin_locality_id`: la localidad del padron usada al confirmar.
2. `origin_locality_name` y `origin_province_name`: el mismo dato en texto,
   para que la operacion se siga leyendo aunque el padron cambie de nombre.

Los items anteriores quedan sin snapshot y eso significa "origen no informado".
NO se rellenan con la localidad actual de la publicacion: seria inventar un
dato del pasado con informacion del presente, que es exactamente el problema
que esta migracion cierra.

Revision ID: c4a91e37d5b8
Revises: b2f7a04d9c31
Create Date: 2026-08-12
"""
from alembic import op
import sqlalchemy as sa


revision = 'c4a91e37d5b8'
down_revision = 'b2f7a04d9c31'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'order_items',
        sa.Column('origin_locality_id', sa.String(length=20), nullable=True),
    )
    op.add_column(
        'order_items',
        sa.Column('origin_locality_name', sa.String(length=200), nullable=True),
    )
    op.add_column(
        'order_items',
        sa.Column('origin_province_name', sa.String(length=100), nullable=True),
    )
    op.create_foreign_key(
        'fk_order_items_origin_locality_id_localities',
        'order_items',
        'localities',
        ['origin_locality_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_order_items_origin_locality_id_localities',
        'order_items',
        type_='foreignkey',
    )
    op.drop_column('order_items', 'origin_province_name')
    op.drop_column('order_items', 'origin_locality_name')
    op.drop_column('order_items', 'origin_locality_id')
