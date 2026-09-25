"""El tipo y la potencia de la publicacion

El tercer nivel de la taxonomia de la clienta es un atributo de la
publicacion, no un nivel mas de categorias (decidido el 15/09): cada subrubro
tiene una lista cerrada de tipos y quien publica elige uno. Tractores no
lleva lista: lleva la potencia en HP, y el filtro la agrupa en tres rangos.

Es aditiva:

- `subcategory_types`: la lista de cada subrubro. Nace VACIA. La carga la
  siembra desde `app/services/tipos.py`, como las categorias y las marcas.
- `products.subcategory_type_id`: el tipo declarado. Nace NULO y no se
  rellena: nadie puede saber hoy si aquella maquina era un arado o una rastra
  sin adivinarle el titulo, y un tipo por omision afirmaria algo que el
  vendedor no dijo. Si un tipo se borra, la publicacion queda sin tipo.
- `products.power_hp`: la potencia declarada, positiva o nula.

Ninguna fila existente cambia de valor.

La vuelta atras borra las dos columnas y la tabla. Es segura: ninguna otra
tabla las referencia, y ningun calculo de precio, stock, orden ni cobro las
lee. Lo que se pierde es lo declarado despues de subir, que es lo que se
agrego.
"""
from alembic import op
import sqlalchemy as sa


revision = 'c8e41f2a7d90'
down_revision = 'b6d3f12a8e94'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'subcategory_types',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column(
            'subcategory_id', sa.String(length=36),
            sa.ForeignKey('subcategories.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('slug', sa.String(length=80), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint('subcategory_id', 'slug', name='uq_subcategory_types_subrubro_slug'),
    )
    op.create_index('ix_subcategory_types_subcategory_id', 'subcategory_types', ['subcategory_id'])

    op.add_column('products', sa.Column('subcategory_type_id', sa.String(length=36), nullable=True))
    op.create_foreign_key(
        'fk_products_subcategory_type_id', 'products', 'subcategory_types',
        ['subcategory_type_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index('ix_products_subcategory_type_id', 'products', ['subcategory_type_id'])

    op.add_column('products', sa.Column('power_hp', sa.Integer(), nullable=True))
    op.create_check_constraint(
        'ck_products_power_hp_positiva', 'products', 'power_hp IS NULL OR power_hp > 0',
    )
    op.create_index('ix_products_power_hp', 'products', ['power_hp'])


def downgrade() -> None:
    op.drop_index('ix_products_power_hp', table_name='products')
    op.drop_constraint('ck_products_power_hp_positiva', 'products', type_='check')
    op.drop_column('products', 'power_hp')

    op.drop_index('ix_products_subcategory_type_id', table_name='products')
    op.drop_constraint('fk_products_subcategory_type_id', 'products', type_='foreignkey')
    op.drop_column('products', 'subcategory_type_id')

    op.drop_index('ix_subcategory_types_subcategory_id', table_name='subcategory_types')
    op.drop_table('subcategory_types')
