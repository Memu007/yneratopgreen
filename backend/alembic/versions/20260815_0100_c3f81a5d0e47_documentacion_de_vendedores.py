"""Documentacion fiscal de vendedores revisada a mano

Una fila por usuario con el CUIT, la razon social y el PDF que presento, mas el
estado de la revision manual que hace la administracion.

La unicidad de `user_id` es del contrato, no una comodidad: presentar de nuevo
**reemplaza**, no acumula. Si se pudieran guardar dos filas del mismo vendedor,
el distintivo publico tendria que elegir entre ellas y esa eleccion no existe.

Del archivo se guardan tres cosas: el nombre original saneado —para mostrarlo—,
la ruta relativa dentro de la carpeta privada y el tamano. El PDF **no** vive en
la base ni en la carpeta publica de subidas.

`revisado_por_id` apunta a users y no se borra en cascada: si alguna vez se
desactiva al administrador que decidio, la decision sigue teniendo autor.

La vuelta atras borra la tabla y el tipo enumerado. Es seguro porque el tipo
nace con esta migracion y ninguna otra tabla lo usa; los PDF en disco no los
toca una migracion, se limpian con la carpeta.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'c3f81a5d0e47'
down_revision = 'b7d94e2c1a06'
branch_labels = None
depends_on = None


# El tipo se crea a mano una sola vez. `create_type=False` es lo que evita que
# create_table intente crearlo de nuevo dentro de la misma transaccion y falle
# con "type already exists"; sin eso la migracion no aplica.
estado = postgresql.ENUM(
    'PENDIENTE', 'APROBADA', 'RECHAZADA',
    name='estadodedocumentacion',
    create_type=False,
)


def upgrade() -> None:
    estado.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'documentacion_de_vendedores',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('cuit', sa.String(length=11), nullable=False),
        sa.Column('razon_social', sa.String(length=255), nullable=False),
        sa.Column('archivo_nombre', sa.String(length=255), nullable=False),
        sa.Column('archivo_ruta', sa.String(length=255), nullable=False),
        sa.Column('archivo_bytes', sa.Integer(), nullable=False),
        sa.Column('estado', estado, nullable=False),
        sa.Column('motivo_de_rechazo', sa.String(length=500), nullable=True),
        sa.Column('revisado_por_id', sa.String(length=36), nullable=True),
        sa.Column('revisado_el', sa.DateTime(), nullable=True),
        sa.Column('presentado_el', sa.DateTime(), nullable=False),
        sa.Column('actualizado_el', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['revisado_por_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    # Unico e indice a la vez, en un solo objeto, que es lo que declara el
    # modelo con unique=True e index=True juntos. Dos objetos distintos harian
    # el mismo trabajo dos veces y `alembic check` lo marcaria como diferencia.
    op.create_index(
        'ix_documentacion_de_vendedores_user_id',
        'documentacion_de_vendedores',
        ['user_id'],
        unique=True,
    )
    op.create_index(
        'ix_documentacion_de_vendedores_estado',
        'documentacion_de_vendedores',
        ['estado'],
    )


def downgrade() -> None:
    op.drop_index(
        'ix_documentacion_de_vendedores_estado',
        table_name='documentacion_de_vendedores',
    )
    op.drop_index(
        'ix_documentacion_de_vendedores_user_id',
        table_name='documentacion_de_vendedores',
    )
    op.drop_table('documentacion_de_vendedores')
    estado.drop(op.get_bind(), checkfirst=True)
