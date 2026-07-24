"""Add ratings table

Revision ID: 010
Revises: 009
Create Date: 2026-03-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crear tabla de calificaciones
    op.create_table(
        'ratings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('order_id', sa.String(36), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reviewer_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reviewed_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('score', sa.Integer, nullable=False),
        sa.Column('comment', sa.Text, nullable=True),
        sa.Column('rating_type', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('score >= 1 AND score <= 5', name='check_score_range'),
    )
    
    # Índices
    op.create_index('ix_ratings_order_id', 'ratings', ['order_id'])
    op.create_index('ix_ratings_reviewer_id', 'ratings', ['reviewer_id'])
    op.create_index('ix_ratings_reviewed_id', 'ratings', ['reviewed_id'])
    
    # Agregar campos de reputación a users si no existen
    try:
        op.add_column('users', sa.Column('rating_average', sa.Numeric(3, 2), server_default='0', nullable=True))
        op.add_column('users', sa.Column('rating_count', sa.Integer, server_default='0', nullable=True))
    except:
        pass  # Columnas ya existen


def downgrade() -> None:
    op.drop_table('ratings')
    try:
        op.drop_column('users', 'rating_average')
        op.drop_column('users', 'rating_count')
    except:
        pass
