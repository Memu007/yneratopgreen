"""Add service fields to products table

Revision ID: 004_service_fields
Revises: 003_mp_oauth
Create Date: 2026-02-28

Campos para soportar servicios además de productos
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_service_fields'
down_revision = '003_mp_oauth'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Agregar campos de servicios a la tabla products"""
    # Tipo de publicación (producto o servicio)
    op.add_column('products', sa.Column('publication_type', sa.String(20), nullable=True, server_default='producto'))
    
    # Hacer stock nullable para servicios
    op.alter_column('products', 'stock', existing_type=sa.Integer(), nullable=True)
    
    # Campos específicos para servicios
    op.add_column('products', sa.Column('pricing_type', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('availability', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('response_time', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('experience_years', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('has_equipment', sa.Boolean(), nullable=True, server_default='1'))
    op.add_column('products', sa.Column('coverage_zones', sa.Text(), nullable=True))  # JSON como texto para SQL Server
    
    # Índice para búsqueda por tipo de publicación
    op.create_index('ix_products_publication_type', 'products', ['publication_type'], unique=False)
    
    # Actualizar registros existentes para que sean tipo 'producto'
    op.execute("UPDATE products SET publication_type = 'producto' WHERE publication_type IS NULL")


def downgrade() -> None:
    """Remover campos de servicios"""
    op.drop_index('ix_products_publication_type', table_name='products')
    op.drop_column('products', 'coverage_zones')
    op.drop_column('products', 'has_equipment')
    op.drop_column('products', 'experience_years')
    op.drop_column('products', 'response_time')
    op.drop_column('products', 'availability')
    op.drop_column('products', 'pricing_type')
    op.drop_column('products', 'publication_type')
    
    # Restaurar stock como NOT NULL
    op.alter_column('products', 'stock', existing_type=sa.Integer(), nullable=False)
