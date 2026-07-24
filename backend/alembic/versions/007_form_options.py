"""add form_options table

Revision ID: 007_form_options
Revises: 006_subcategories
Create Date: 2026-02-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
import uuid

# revision identifiers, used by Alembic.
revision = '007_form_options'
down_revision = '006_subcategories'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crear tabla form_options
    op.create_table(
        'form_options',
        sa.Column('id', UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4),
        sa.Column('option_type', sa.String(50), nullable=False, index=True),
        sa.Column('value', sa.String(100), nullable=False),
        sa.Column('label', sa.String(200), nullable=False),
        sa.Column('display_order', sa.Integer, default=0),
        sa.Column('is_active', sa.Boolean, default=True, server_default='1'),
    )
    
    # Insertar datos iniciales
    
    # Provincias de Argentina
    provinces = [
        'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut',
        'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy',
        'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
        'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
        'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
    ]
    
    for i, prov in enumerate(provinces):
        op.execute(f"""
            INSERT INTO form_options (id, option_type, value, label, display_order, is_active)
            VALUES (NEWID(), 'province', N'{prov}', N'{prov}', {i}, 1)
        """)
    
    # Unidades de medida
    units = [
        ('kg', 'Kilogramos'),
        ('ton', 'Toneladas'),
        ('litros', 'Litros'),
        ('unidad', 'Unidad'),
        ('bolsa', 'Bolsa'),
        ('pack', 'Pack'),
        ('ha', 'Hectárea'),
        ('m2', 'Metro cuadrado'),
        ('docena', 'Docena'),
    ]
    
    for i, (value, label) in enumerate(units):
        op.execute(f"""
            INSERT INTO form_options (id, option_type, value, label, display_order, is_active)
            VALUES (NEWID(), 'unit', '{value}', N'{label}', {i}, 1)
        """)
    
    # Tipos de cobro para servicios
    pricing_types = [
        ('por_hora', 'Por hora'),
        ('por_hectarea', 'Por hectárea'),
        ('por_trabajo', 'Por trabajo/servicio'),
        ('por_dia', 'Por día'),
        ('por_km', 'Por kilómetro'),
        ('a_convenir', 'A convenir'),
    ]
    
    for i, (value, label) in enumerate(pricing_types):
        op.execute(f"""
            INSERT INTO form_options (id, option_type, value, label, display_order, is_active)
            VALUES (NEWID(), 'pricing_type', '{value}', N'{label}', {i}, 1)
        """)
    
    # Opciones de disponibilidad
    availability_options = [
        ('inmediata', 'Disponibilidad inmediata'),
        ('programar', 'A programar'),
        ('temporada', 'Solo en temporada'),
        ('consultar', 'Consultar disponibilidad'),
    ]
    
    for i, (value, label) in enumerate(availability_options):
        op.execute(f"""
            INSERT INTO form_options (id, option_type, value, label, display_order, is_active)
            VALUES (NEWID(), 'availability', '{value}', N'{label}', {i}, 1)
        """)
    
    # Tiempos de respuesta
    response_times = [
        ('24h', 'Menos de 24 horas'),
        ('48h', 'Entre 24 y 48 horas'),
        ('1semana', 'Dentro de 1 semana'),
        ('acordar', 'A acordar con el cliente'),
    ]
    
    for i, (value, label) in enumerate(response_times):
        op.execute(f"""
            INSERT INTO form_options (id, option_type, value, label, display_order, is_active)
            VALUES (NEWID(), 'response_time', '{value}', N'{label}', {i}, 1)
        """)


def downgrade() -> None:
    op.drop_table('form_options')
