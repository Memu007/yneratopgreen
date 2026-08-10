"""ampliar columnas monetarias del flujo carrito, orden y pago

El catalogo aceptaba publicar hasta NUMERIC(12,2) en products.price, pero los
snapshots y los totales estaban en NUMERIC(10,2): cualquier precio de cien
millones o mas hacia estallar el INSERT con "numeric field overflow" y la API
devolvia 500. El seed publica dos articulos por encima de ese techo.

Contrato monetario que fija esta migracion:

  precio unitario y sus snapshots   NUMERIC(12,2)   hasta 9.999.999.999,99
  totales, subtotales y envio       NUMERIC(14,2)   hasta 999.999.999.999,99
  montos de pago                    NUMERIC(14,2)   idem, para no arrastrar
                                                    la misma incompatibilidad
                                                    a la Fase 4

commission_percent queda en NUMERIC(5,2): es un porcentaje, no un monto.

Revision ID: a1c4f7e9b2d3
Revises: 23ff06b57d6d
Create Date: 2026-08-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1c4f7e9b2d3'
down_revision = '23ff06b57d6d'
branch_labels = None
depends_on = None


# (tabla, columna, precision nueva, precision vieja, admite nulo)
COLUMNAS = [
    # precios unitarios: tienen que poder guardar cualquier products.price
    ('cart_items', 'unit_price_snapshot', 12, 10, False),
    ('order_items', 'unit_price_snapshot', 12, 10, False),
    # totales derivados: precio unitario por cantidad, y sumas de esos totales
    ('order_items', 'total_price', 14, 10, False),
    ('orders', 'subtotal', 14, 10, False),
    ('orders', 'shipping_cost', 14, 10, False),
    ('orders', 'total_amount', 14, 10, False),
    # pagos: hoy no estan montados, pero el contrato tiene que cerrar igual
    ('payments', 'total_amount', 14, 12, False),
    ('payments', 'commission_amount', 14, 12, False),
    ('payments', 'seller_amount', 14, 12, False),
    ('payments', 'refund_amount', 14, 12, True),
]


def upgrade() -> None:
    for tabla, columna, nueva, _vieja, nullable in COLUMNAS:
        op.alter_column(
            tabla,
            columna,
            type_=sa.Numeric(precision=nueva, scale=2),
            existing_type=sa.Numeric(precision=_vieja, scale=2),
            existing_nullable=nullable,
        )


def downgrade() -> None:
    # Volver atras puede perder datos si ya se guardaron montos grandes; se deja
    # el camino disponible pero es responsabilidad de quien lo corra.
    for tabla, columna, nueva, vieja, nullable in reversed(COLUMNAS):
        op.alter_column(
            tabla,
            columna,
            type_=sa.Numeric(precision=vieja, scale=2),
            existing_type=sa.Numeric(precision=nueva, scale=2),
            existing_nullable=nullable,
        )
