"""credenciales de Mercado Pago cifradas y state de OAuth con dueno

Las columnas heredadas `users.mp_access_token` y `users.mp_refresh_token`
guardaban en CLARO la credencial con la que un vendedor cobra en su cuenta.
Cualquier volcado de la base, backup o SELECT de mas alcanzaba para cobrar en
nombre de otro. Se van, y en su lugar quedan dos columnas cifradas.

No se migra el contenido. Un token en claro no se "convierte" en un token
seguro: ya estuvo expuesto, y ademas los vinculos que existian venian del
endpoint `manual-link`, que era pegar un token a mano y que esta pieza elimina.
Lo que habia se invalida entero -tokens, cuenta y fecha- y el vendedor
revincula por OAuth. Es una molestia de un minuto contra una credencial de
tercero que no podemos garantizar.

FRENO: si la base trae tokens no nulos, `upgrade()` se detiene y no borra
nada. Puede haber una cuenta real detras. Quien opere decide, los revisa, y
recien despues confirma el descarte con
`MP_MIGRACION_DESCARTAR_TOKENS=1 alembic upgrade head`.

Lo que se agrega:

1. `mp_access_token_cifrado` y `mp_refresh_token_cifrado` (TEXT): Fernet, con
   clave fuera del repositorio. Son mas largas que las viejas porque el texto
   cifrado ocupa mas que el original.
2. `mp_requiere_reconexion`: se enciende cuando MP rechaza las credenciales o
   cuando lo guardado deja de abrir. Es lo que hace que el vendedor vea
   "reconectar" en vez de un error.
3. Indice unico sobre `mp_user_id`: una cuenta de Mercado Pago no puede estar
   cobrando para dos vendedores de TopGreen a la vez.
4. Tabla `mp_oauth_states`: el `state` de OAuth deja de ser un JWT autonomo y
   pasa a ser una fila con dueno, vencimiento y marca de uso. Se guarda el
   SHA-256 del state, no el state: el valor viaja en una URL y termina en el
   historial y en los logs del proxy.

Revision ID: d8e35b71c9a2
Revises: c4a91e37d5b8
Create Date: 2026-08-12
"""
import os

from alembic import op
import sqlalchemy as sa


revision = 'd8e35b71c9a2'
down_revision = 'c4a91e37d5b8'
branch_labels = None
depends_on = None


COLUMNAS_EN_CLARO = ('mp_access_token', 'mp_refresh_token')


def _columnas_existentes(conexion):
    filas = conexion.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'users'"
    )).fetchall()
    return {fila[0] for fila in filas}


def upgrade() -> None:
    conexion = op.get_bind()
    existentes = _columnas_existentes(conexion)
    heredadas = [c for c in COLUMNAS_EN_CLARO if c in existentes]

    if heredadas:
        condicion = ' OR '.join(f'{c} IS NOT NULL' for c in heredadas)
        con_token = conexion.execute(sa.text(
            f'SELECT count(*) FROM users WHERE {condicion}'
        )).scalar_one()

        if con_token and not os.environ.get('MP_MIGRACION_DESCARTAR_TOKENS'):
            # Se informa cuantos, nunca cuales ni de quien.
            raise RuntimeError(
                f'Hay {con_token} usuario(s) con credenciales de Mercado Pago '
                'en claro. Esta migracion las descarta y no hay forma de '
                'recuperarlas despues. Revisalas antes: si son de prueba, '
                'confirma con MP_MIGRACION_DESCARTAR_TOKENS=1; si alguna es '
                'real, avisale a esa persona que va a tener que revincular.'
            )

    # Se invalida el vinculo completo, no solo el token: dejar el mp_user_id
    # sin credencial usable seria mostrar "conectado" sobre algo que no cobra.
    op.execute(
        'UPDATE users SET mp_user_id = NULL, mp_token_expires_at = NULL, '
        'mp_linked_at = NULL WHERE mp_user_id IS NOT NULL'
    )

    for columna in heredadas:
        op.drop_column('users', columna)

    op.add_column('users', sa.Column('mp_access_token_cifrado', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('mp_refresh_token_cifrado', sa.Text(), nullable=True))
    op.add_column('users', sa.Column(
        'mp_requiere_reconexion',
        sa.Boolean(),
        nullable=False,
        server_default=sa.false(),
    ))
    op.create_unique_constraint('uq_users_mp_user_id', 'users', ['mp_user_id'])

    op.create_table(
        'mp_oauth_states',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('state_hash', sa.String(length=64), nullable=False),
        sa.Column('creado_el', sa.DateTime(), nullable=False),
        sa.Column('expira_el', sa.DateTime(), nullable=False),
        sa.Column('usado_el', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('state_hash', name='uq_mp_oauth_states_state_hash'),
    )
    op.create_index('ix_mp_oauth_states_user_id', 'mp_oauth_states', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_mp_oauth_states_user_id', table_name='mp_oauth_states')
    op.drop_table('mp_oauth_states')

    op.drop_constraint('uq_users_mp_user_id', 'users', type_='unique')
    op.drop_column('users', 'mp_requiere_reconexion')
    op.drop_column('users', 'mp_refresh_token_cifrado')
    op.drop_column('users', 'mp_access_token_cifrado')

    # Vuelven vacias, y esta bien que asi sea: lo cifrado no se puede devolver
    # a claro sin la clave, y volver atras no deberia reponer una credencial
    # legible en la base.
    op.add_column('users', sa.Column('mp_access_token', sa.String(length=500), nullable=True))
    op.add_column('users', sa.Column('mp_refresh_token', sa.String(length=500), nullable=True))
