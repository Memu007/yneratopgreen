"""Marca y modelo, dominio privado y cargas declaradas

Tres datos opcionales del perfil de transportista. Hasta ahora el vehiculo
entero viajaba en una sola linea de texto libre —`carrier_transport`, del tipo
"Camion con acoplado, dominio AB 123 CD"—, asi que no se podia comparar entre
transportistas ni mostrar el dominio aparte del resto.

Los tres nacen NULOS y ninguno es obligatorio: un perfil que ya estaba cargado
sigue siendo valido sin completar nada, y el texto libre anterior no se toca ni
se intenta partir automaticamente. Partirlo seria adivinar donde termina la
marca y empieza el dominio en un campo que la gente escribio como quiso.

`carrier_plate` es privado por contrato: no aparece en el directorio ni en la
respuesta de candidatos, y sale junto con el contacto recien despues de una
seleccion valida. La columna no cambia eso por si sola —lo hace el esquema de
salida—, pero conviene que quede dicho donde nace el dato.

`carrier_cargo_types` guarda las CLAVES del catalogo cerrado, no las etiquetas:
cambiar una redaccion no puede obligar a reescribir filas. Es una declaracion y
no un filtro; la compatibilidad sigue siendo unicamente geografica.

La vuelta atras borra las tres columnas. Es segura porque nada mas depende de
ellas: ninguna otra tabla las referencia y la regla de compatibilidad no las
mira.
"""
from alembic import op
import sqlalchemy as sa


revision = 'd5b21e8f4c73'
down_revision = 'c3f81a5d0e47'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('carrier_vehicle_model', sa.String(length=120), nullable=True))
    op.add_column('users', sa.Column('carrier_plate', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('carrier_cargo_types', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('carrier_cargo_other', sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'carrier_cargo_other')
    op.drop_column('users', 'carrier_cargo_types')
    op.drop_column('users', 'carrier_plate')
    op.drop_column('users', 'carrier_vehicle_model')
