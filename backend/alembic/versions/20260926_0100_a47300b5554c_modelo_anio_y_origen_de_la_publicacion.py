"""Modelo, año y origen de la publicación

Lo que quien vende declara además del tipo (ATRIBUTOS-RUBRO-1, parte 2):
modelo y año donde la categoría pide marca, y el origen —«Agencia /
Concesionaria» o «Dueño directo»— en cualquier producto. Ver
`app/services/atributos.py`.

Es aditiva:

- `products.model`: texto, nulo.
- `products.year`: número, nulo. La base sostiene el piso de 1950; el techo
  es el año próximo, corre con el calendario y lo valida la API.
- `products.origin`: uno de los dos valores, o nulo.

Las tres nacen NULAS y no se rellenan: nadie puede saber hoy de qué año era
aquel tractor ni quién lo vendía sin adivinarle la descripción. Ninguna fila
existente cambia de valor, y no hay lista que cargar: los dos orígenes viven
en el código.

La vuelta atrás borra las tres columnas. Es segura: ninguna otra tabla las
referencia, y ningún cálculo de precio, stock, orden ni cobro las lee. Lo que
se pierde es lo declarado después de subir, que es lo que se agregó.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a47300b5554c'
down_revision = '01ff14043124'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('model', sa.String(length=80), nullable=True))

    op.add_column('products', sa.Column('year', sa.Integer(), nullable=True))
    op.create_check_constraint('ck_products_year_desde_1950', 'products', 'year IS NULL OR year >= 1950')
    op.create_index('ix_products_year', 'products', ['year'])

    op.add_column('products', sa.Column('origin', sa.String(length=20), nullable=True))
    op.create_check_constraint(
        'ck_products_origin_valido', 'products',
        "origin IS NULL OR origin IN ('concesionaria', 'dueno_directo')",
    )
    op.create_index('ix_products_origin', 'products', ['origin'])


def downgrade() -> None:
    op.drop_index('ix_products_origin', table_name='products')
    op.drop_constraint('ck_products_origin_valido', 'products', type_='check')
    op.drop_column('products', 'origin')

    op.drop_index('ix_products_year', table_name='products')
    op.drop_constraint('ck_products_year_desde_1950', 'products', type_='check')
    op.drop_column('products', 'year')

    op.drop_column('products', 'model')
