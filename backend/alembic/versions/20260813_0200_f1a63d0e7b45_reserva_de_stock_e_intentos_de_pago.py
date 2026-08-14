"""reserva de stock, vigencia del link e intentos de pago

Tres cosas, y las tres son la misma: que una venta por Mercado Pago no pueda
prometer mercaderia que no tiene ni perder un pago que si ocurrio.

1. `products.stock_reservado`. Lo comprometido por compras en curso que
   todavia no se cobraron. No baja `stock` -la mercaderia sigue estando- pero
   si baja lo disponible, que es `stock - stock_reservado` y es lo que mira el
   resto del sistema. Arranca en cero para todo lo existente, que es la verdad:
   antes de esta pieza no habia ninguna reserva.

2. `orders.stock_reserva` y `payments.expires_at`. En que anda la reserva de
   cada orden -reservada, consolidada, liberada, cierre_pendiente- y hasta
   cuando vale su link de pago. La primera es lo que hace que consolidar y
   liberar ocurran EXACTAMENTE UNA VEZ: son `UPDATE ... WHERE stock_reserva =
   ...`, y un aviso repetido encuentra la fila ya movida. NULL es "esta orden
   no reserva": transferencia y todo lo anterior.

3. `mp_intentos_de_pago`. Una fila por pago informado por Mercado Pago, con
   `mp_payment_id` UNICO. Por un mismo link se puede intentar pagar varias
   veces, y con un solo estado por orden un rechazo tapaba una aprobacion
   posterior. La unicidad es ademas el candado contra el aviso duplicado.

Y una columna que se va: `payments.refund_id`. La escribia el modulo de cobro
heredado, que devolvia dinero con el token del marketplace. Ese modulo no
existe mas y TopGreen no ejecuta reembolsos: lo que si se registra -cuando MP
informa una devolucion- son `refunded_at` y `refund_amount`, que se quedan.

El enum `paymentstatus` suma `CHARGED_BACK`. Un contracargo no es un
reembolso: no lo hacemos nosotros y no lo revertimos nosotros, y necesita
nombre propio para que el vendedor lo vea y actue.

Revision ID: f1a63d0e7b45
Revises: e4c72a9b1f83
Create Date: 2026-08-13
"""
from alembic import op
import sqlalchemy as sa


revision = 'f1a63d0e7b45'
down_revision = 'e4c72a9b1f83'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column(
            'stock_reservado', sa.Integer(), nullable=False, server_default='0'
        ),
    )

    op.add_column('orders', sa.Column('stock_reserva', sa.String(length=20), nullable=True))
    op.create_index('ix_orders_stock_reserva', 'orders', ['stock_reserva'])

    op.add_column('payments', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.create_index('ix_payments_expires_at', 'payments', ['expires_at'])
    op.drop_column('payments', 'refund_id')

    # El enum de estados vive en la base; sumar un valor es alterarlo. Va antes
    # de la tabla que lo usa por si alguna vez lo usara.
    op.execute("ALTER TYPE paymentstatus ADD VALUE IF NOT EXISTS 'CHARGED_BACK'")

    op.create_table(
        'mp_intentos_de_pago',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('payment_id', sa.String(length=36), sa.ForeignKey('payments.id'), nullable=False),
        sa.Column('mp_payment_id', sa.String(length=100), nullable=False),
        sa.Column('estado', sa.String(length=30), nullable=False),
        sa.Column('monto', sa.Numeric(14, 2), nullable=False),
        sa.Column('moneda', sa.String(length=3), nullable=False),
        sa.Column('mp_actualizado_el', sa.DateTime(), nullable=True),
        sa.Column('mp_aprobado_el', sa.DateTime(), nullable=True),
        sa.Column('creado_el', sa.DateTime(), nullable=False),
        sa.Column('actualizado_el', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_mp_intentos_de_pago_order_id', 'mp_intentos_de_pago', ['order_id'])
    op.create_index('ix_mp_intentos_de_pago_payment_id', 'mp_intentos_de_pago', ['payment_id'])
    op.create_index('ix_mp_intentos_de_pago_estado', 'mp_intentos_de_pago', ['estado'])
    # Unico: es el candado contra el aviso duplicado, no una prolijidad.
    op.create_index(
        'ix_mp_intentos_de_pago_mp_payment_id',
        'mp_intentos_de_pago',
        ['mp_payment_id'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_mp_intentos_de_pago_mp_payment_id', table_name='mp_intentos_de_pago')
    op.drop_index('ix_mp_intentos_de_pago_estado', table_name='mp_intentos_de_pago')
    op.drop_index('ix_mp_intentos_de_pago_payment_id', table_name='mp_intentos_de_pago')
    op.drop_index('ix_mp_intentos_de_pago_order_id', table_name='mp_intentos_de_pago')
    op.drop_table('mp_intentos_de_pago')

    # `CHARGED_BACK` no se saca del enum: PostgreSQL no permite quitar un valor
    # y reconstruir el tipo entero para volver atras es mas riesgoso que dejar
    # un valor de mas sin usar.

    op.add_column('payments', sa.Column('refund_id', sa.String(length=100), nullable=True))
    op.drop_index('ix_payments_expires_at', table_name='payments')
    op.drop_column('payments', 'expires_at')

    op.drop_index('ix_orders_stock_reserva', table_name='orders')
    op.drop_column('orders', 'stock_reserva')

    op.drop_column('products', 'stock_reservado')
