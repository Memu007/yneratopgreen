"""Add subcategories table

Revision ID: 006_subcategories
Revises: 005_category_service
Create Date: 2026-02-28

Tabla de subcategorías para gestión dinámica
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_subcategories'
down_revision = '005_category_service'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Crear tabla de subcategorías"""
    op.create_table(
        'subcategories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, index=True),
        sa.Column('slug', sa.String(100), nullable=False, index=True),
        sa.Column('category_id', sa.String(36), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    
    # Índice único para nombre+categoría (evitar duplicados dentro de la misma categoría)
    op.create_index('ix_subcategories_category_name', 'subcategories', ['category_id', 'name'], unique=True)


def downgrade() -> None:
    """Eliminar tabla de subcategorías"""
    op.drop_index('ix_subcategories_category_name', table_name='subcategories')
    op.drop_table('subcategories')
