"""agregar tokens de verificacion de correo

Revision ID: c7d2e9a4f1b6
Revises: a1c4f7e9b2d3
Create Date: 2026-08-10

Crea la tabla de tokens de verificacion. Guarda el hash del token, no el
token: quien lea la tabla no puede verificar cuentas ajenas.

Los usuarios que YA existen quedan verificados. Es una decision explicita:
esta pieza agrega el requisito para las altas nuevas y no puede dejar afuera
a quien ya venia usando la plataforma. Los que se registren desde ahora nacen
sin verificar por el default del modelo.
"""
from alembic import op
import sqlalchemy as sa


revision = 'c7d2e9a4f1b6'
down_revision = 'a1c4f7e9b2d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('consumed_at', sa.DateTime(), nullable=True),
        sa.Column('invalidated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_email_verification_tokens_user_id'),
        'email_verification_tokens',
        ['user_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_email_verification_tokens_token_hash'),
        'email_verification_tokens',
        ['token_hash'],
        unique=True,
    )
    op.create_index(
        'ix_email_verification_tokens_user_pendiente',
        'email_verification_tokens',
        ['user_id', 'consumed_at'],
        unique=False,
    )

    # Las cuentas que ya existian no pueden quedar bloqueadas por un requisito
    # que no existia cuando se registraron.
    op.execute('UPDATE users SET is_verified = true WHERE is_verified = false')


def downgrade() -> None:
    op.drop_index(
        'ix_email_verification_tokens_user_pendiente',
        table_name='email_verification_tokens',
    )
    op.drop_index(
        op.f('ix_email_verification_tokens_token_hash'),
        table_name='email_verification_tokens',
    )
    op.drop_index(
        op.f('ix_email_verification_tokens_user_id'),
        table_name='email_verification_tokens',
    )
    op.drop_table('email_verification_tokens')
