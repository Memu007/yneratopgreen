"""Add MercadoPago OAuth fields to users table

Revision ID: 003_mp_oauth
Revises: 002_payments
Create Date: 2026-02-12

Campos para vincular cuentas de vendedores con MercadoPago (Split Payments)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_mp_oauth'
down_revision = '002_payments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Agregar campos de MercadoPago OAuth a la tabla users"""
    # Campos para vincular cuenta de vendedor con MercadoPago
    op.add_column('users', sa.Column('mp_user_id', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('mp_access_token', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('mp_refresh_token', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('mp_token_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('mp_linked_at', sa.DateTime(), nullable=True))
    
    # Índice para búsqueda por mp_user_id
    op.create_index('ix_users_mp_user_id', 'users', ['mp_user_id'], unique=False)


def downgrade() -> None:
    """Remover campos de MercadoPago OAuth"""
    op.drop_index('ix_users_mp_user_id', table_name='users')
    op.drop_column('users', 'mp_linked_at')
    op.drop_column('users', 'mp_token_expires_at')
    op.drop_column('users', 'mp_refresh_token')
    op.drop_column('users', 'mp_access_token')
    op.drop_column('users', 'mp_user_id')
