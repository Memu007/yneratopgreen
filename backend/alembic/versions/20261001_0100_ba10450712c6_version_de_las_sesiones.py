"""La versión de las sesiones de cada cuenta

Cambiar la contraseña no cerraba ninguna sesión: un token de renovación dura
30 días y cada renovación emite otro, así que una sesión abierta en otro
dispositivo no vencía nunca (SESIONES-AL-CAMBIAR-1).

`users.sesion_version` es un número que viaja en cada token. Cambiar la
contraseña, restablecerla desde el panel o cambiar el estado de la cuenta lo
suben, y un token con otro número deja de servir.

Es aditiva: la columna nace en 0 para todas las cuentas, y un token emitido
antes de esta pieza, que no lleva el número, cuenta como 0. Nadie pierde la
sesión al subir, y no hace falta cambiar `JWT_SECRET`.

La vuelta atrás borra la columna. Lo que se pierde es la cuenta de cambios:
los tokens vuelven a valer mientras no venzan, como antes de esta pieza.
"""
from alembic import op
import sqlalchemy as sa


revision = 'ba10450712c6'
down_revision = 'a47300b5554c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('sesion_version', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('users', 'sesion_version')
