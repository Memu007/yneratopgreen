"""Add is_service field to categories table

Revision ID: 005_category_service
Revises: 004_service_fields
Create Date: 2026-02-28

Campo para identificar categorías de servicios
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_category_service'
down_revision = '004_service_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Agregar campo is_service a la tabla categories"""
    # Agregar columna con default 0 y nullable
    op.add_column('categories', sa.Column('is_service', sa.Boolean(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Remover campo is_service"""
    op.drop_column('categories', 'is_service')
