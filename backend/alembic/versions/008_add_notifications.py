"""add notifications table

Revision ID: 008_add_notifications
Revises: 007_form_options
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_add_notifications'
down_revision = '007_form_options'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('type', sa.String(50), nullable=False, index=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('order_id', sa.String(36), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('is_read', sa.Boolean(), default=False, nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, index=True),
        sa.Column('read_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('notifications')
