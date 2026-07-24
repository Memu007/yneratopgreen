"""Add payments table for Mercado Pago integration

Revision ID: 002_payments
Revises: 001_initial
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_payments'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### payments table ###
    op.create_table('payments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('order_id', sa.String(length=36), nullable=False),
        
        # Datos de Mercado Pago
        sa.Column('mp_preference_id', sa.String(length=100), nullable=True),
        sa.Column('mp_payment_id', sa.String(length=100), nullable=True),
        sa.Column('mp_merchant_order_id', sa.String(length=100), nullable=True),
        sa.Column('mp_external_reference', sa.String(length=100), nullable=True),
        
        # Estado
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        
        # Montos
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('commission_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('commission_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('seller_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        
        # Datos del pagador
        sa.Column('payer_email', sa.String(length=255), nullable=True),
        sa.Column('payer_name', sa.String(length=255), nullable=True),
        
        # Método de pago
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('payment_type', sa.String(length=50), nullable=True),
        
        # URL
        sa.Column('init_point', sa.String(length=500), nullable=True),
        
        # Datos adicionales de MP (JSON)
        sa.Column('mp_response', sa.Text(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('GETDATE()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('GETDATE()')),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        
        # Foreign keys
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Índices
    op.create_index('ix_payments_order_id', 'payments', ['order_id'], unique=False)
    op.create_index('ix_payments_mp_preference_id', 'payments', ['mp_preference_id'], unique=False)
    op.create_index('ix_payments_mp_payment_id', 'payments', ['mp_payment_id'], unique=False)
    op.create_index('ix_payments_mp_external_reference', 'payments', ['mp_external_reference'], unique=False)
    op.create_index('ix_payments_status', 'payments', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_payments_status', table_name='payments')
    op.drop_index('ix_payments_mp_external_reference', table_name='payments')
    op.drop_index('ix_payments_mp_payment_id', table_name='payments')
    op.drop_index('ix_payments_mp_preference_id', table_name='payments')
    op.drop_index('ix_payments_order_id', table_name='payments')
    op.drop_table('payments')
