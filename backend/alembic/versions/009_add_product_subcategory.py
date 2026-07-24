"""Add subcategory_id to products table

Revision ID: 009_add_product_subcategory
Revises: 008_add_notifications
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '009_add_product_subcategory'
down_revision = '008_add_notifications'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna subcategory_id a la tabla products
    op.add_column('products', sa.Column('subcategory_id', sa.String(36), nullable=True))
    
    # Crear foreign key constraint
    op.create_foreign_key(
        'fk_products_subcategory_id',
        'products', 'subcategories',
        ['subcategory_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Crear índice para mejor rendimiento
    op.create_index('ix_products_subcategory_id', 'products', ['subcategory_id'])


def downgrade() -> None:
    # Eliminar índice
    op.drop_index('ix_products_subcategory_id', table_name='products')
    
    # Eliminar foreign key
    op.drop_constraint('fk_products_subcategory_id', 'products', type_='foreignkey')
    
    # Eliminar columna
    op.drop_column('products', 'subcategory_id')
