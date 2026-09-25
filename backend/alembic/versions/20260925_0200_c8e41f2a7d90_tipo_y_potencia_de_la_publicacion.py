"""El tipo y la potencia de la publicación

El tercer nivel de la taxonomía de la clienta es un atributo de la
publicación, no un nivel más de categorías (decidido el 15/09): cada subrubro
tiene una lista cerrada de tipos y quien publica elige uno. Tractores no
lleva lista: lleva la potencia en HP, y el filtro la agrupa en tres rangos.

Es aditiva:

- `subcategory_types`: la lista de cada subrubro. Se crea y se carga acá, con
  la copia de abajo, para los subrubros que ya existen en la base. En
  producción la siembra no corre (`RAILWAY.md`) y el panel no edita estas
  listas: si la migración no las trajera, nadie las cargaría y el filtro no
  aparecería. En una base recién creada todavía no hay subrubros, así que no
  carga nada y la siembra hace el resto.
- `products.subcategory_type_id`: el tipo declarado. Nace NULO y no se
  rellena: nadie puede saber hoy si aquella máquina era un arado o una rastra
  sin adivinarle el título, y un tipo por omisión afirmaría algo que el
  vendedor no dijo. Si un tipo se borra, la publicación queda sin tipo.
- `products.power_hp`: la potencia declarada, positiva o nula.

Ninguna fila existente cambia de valor.

La vuelta atrás borra las dos columnas y la tabla. Es segura: ninguna otra
tabla las referencia, y ningún cálculo de precio, stock, orden ni cobro las
lee. Lo que se pierde es lo declarado después de subir, que es lo que se
agregó.
"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = 'c8e41f2a7d90'
down_revision = 'b6d3f12a8e94'
branch_labels = None
depends_on = None

# Las listas, por (slug de la categoría, slug del subrubro). Es una COPIA
# congelada de `app/services/tipos.py` al escribir esta migración, repetida a
# propósito: una migración no puede cambiar lo que hace porque cambió el código
# de la aplicación. Cambiar una lista después es otra migración.
LISTAS = {
    ('maquinaria-agricola', 'preparacion-suelo'): (
        ('arados', 'Arados'),
        ('rastras', 'Rastras'),
        ('cultivadores', 'Cultivadores'),
        ('subsoladores', 'Subsoladores'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'siembra-plantacion'): (
        ('sembradoras-de-granos-gruesos', 'Sembradoras de granos gruesos'),
        ('sembradoras-de-granos-finos', 'Sembradoras de granos finos'),
        ('sembradoras-de-hortalizas', 'Sembradoras de hortalizas'),
        ('otras', 'Otras'),
    ),
    ('maquinaria-agricola', 'fertilizacion-proteccion'): (
        ('pulverizadoras-autopropulsadas', 'Pulverizadoras autopropulsadas'),
        ('pulverizadoras-de-arrastre', 'Pulverizadoras de arrastre'),
        ('fertilizadoras-centrifugas', 'Fertilizadoras centrífugas'),
        ('fertilizadoras-de-disco', 'Fertilizadoras de disco'),
        ('aviones', 'Aviones'),
        ('drones', 'Drones'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'cosecha'): (
        ('cosechadoras-de-granos', 'Cosechadoras de granos'),
        ('cosechadoras-de-forrajes', 'Cosechadoras de forrajes'),
        ('cosechadoras-de-algodon', 'Cosechadoras de algodón'),
        ('cosechadoras-de-cana', 'Cosechadoras de caña'),
        ('cosechadoras-de-cafe', 'Cosechadoras de café'),
        ('cosechadoras-de-frutales', 'Cosechadoras de frutales'),
        ('cosechadoras-de-hortalizas', 'Cosechadoras de hortalizas'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'postcosecha'): (
        ('limpiadoras', 'Limpiadoras'),
        ('secadoras', 'Secadoras'),
        ('ensacadoras', 'Ensacadoras'),
        ('silos', 'Silos'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'forrajes-ganaderia'): (
        ('picadoras', 'Picadoras'),
        ('embolsadoras', 'Embolsadoras'),
        ('enfardadoras', 'Enfardadoras'),
        ('mezcladoras', 'Mezcladoras'),
        ('otros', 'Otros'),
    ),
    ('riego-drenaje', 'riego-aspersion'): (
        ('pivotes', 'Pivotes'),
        ('canones', 'Cañones'),
        ('laterales', 'Laterales'),
    ),
    ('riego-drenaje', 'riego-localizado'): (
        ('goteo', 'Goteo'),
        ('microaspersion', 'Microaspersión'),
        ('cintas', 'Cintas'),
    ),
    ('riego-drenaje', 'riego-superficial-subterraneo'): (
        ('superficial', 'Superficial'),
        ('subterraneo', 'Subterráneo'),
    ),
    ('riego-drenaje', 'bombas-motobombas-accesorios'): (
        ('bombas-centrifugas', 'Bombas centrífugas'),
        ('motobombas', 'Motobombas'),
        ('accesorios-hidraulicos', 'Accesorios hidráulicos'),
    ),
    ('riego-drenaje', 'drenaje-control-hidrico'): (
        ('drenaje-subsuperficial', 'Drenaje subsuperficial'),
        ('canales', 'Canales'),
        ('control-de-nivel', 'Control de nivel'),
    ),
    ('insumos-agricolas', 'semillas-plantulas'): (
        ('cultivos-extensivos', 'Cultivos extensivos'),
        ('horticolas', 'Hortícolas'),
        ('forrajeras', 'Forrajeras'),
        ('forestales', 'Forestales'),
    ),
    ('insumos-agricolas', 'fertilizantes'): (
        ('organicos', 'Orgánicos'),
        ('minerales', 'Minerales'),
    ),
    ('insumos-agricolas', 'correctivos'): (
        ('cal', 'Cal'),
        ('yeso', 'Yeso'),
        ('enmiendas', 'Enmiendas'),
    ),
    ('insumos-agricolas', 'agroinsumos-biologicos'): (
        ('biofertilizantes', 'Biofertilizantes'),
        ('biocontroladores', 'Biocontroladores'),
        ('microorganismos', 'Microorganismos'),
    ),
    ('insumos-agricolas', 'agroquimicos'): (
        ('herbicidas', 'Herbicidas'),
        ('insecticidas', 'Insecticidas'),
        ('fungicidas', 'Fungicidas'),
        ('acaricidas', 'Acaricidas'),
    ),
    ('insumos-agricolas', 'sustratos-coberturas'): (
        ('sustratos', 'Sustratos'),
        ('mulch', 'Mulch'),
        ('mallas', 'Mallas'),
        ('films', 'Films'),
    ),
    ('ganaderia-forrajes', 'cercas-bebederos'): (
        ('cercas-electricas', 'Cercas eléctricas'),
        ('cercas-portatiles', 'Cercas portátiles'),
        ('hidrantes', 'Hidrantes'),
        ('bebederos', 'Bebederos'),
    ),
    ('ganaderia-forrajes', 'manejo-animal'): (
        ('corrales', 'Corrales'),
        ('mangas', 'Mangas'),
        ('balanzas', 'Balanzas'),
        ('caravanas', 'Caravanas'),
    ),
    ('ganaderia-forrajes', 'ordeno-sanidad'): (
        ('ordenadoras-mecanicas', 'Ordeñadoras mecánicas'),
        ('tanques-de-leche', 'Tanques de leche'),
        ('equipos-de-bano', 'Equipos de baño'),
    ),
    ('ganaderia-forrajes', 'suplementacion'): (
        ('comederos', 'Comederos'),
        ('tolvas', 'Tolvas'),
        ('silos-de-grano', 'Silos de grano'),
    ),
    ('repuestos-mantenimiento', 'neumaticos-camaras'): (
        ('neumaticos-agricolas', 'Neumáticos agrícolas'),
        ('camaras', 'Cámaras'),
    ),
    ('repuestos-mantenimiento', 'filtros-correas-cuchillas-cadenas'): (
        ('filtros', 'Filtros'),
        ('correas', 'Correas'),
        ('cuchillas', 'Cuchillas'),
        ('cadenas', 'Cadenas'),
    ),
    ('repuestos-mantenimiento', 'sistemas-hidraulicos'): (
        ('mangueras', 'Mangueras'),
        ('racores', 'Racores'),
        ('bombas-hidraulicas', 'Bombas hidráulicas'),
    ),
    ('repuestos-mantenimiento', 'sistemas-electronicos-sensores'): (
        ('monitores', 'Monitores'),
        ('gps', 'GPS'),
        ('piloto-automatico', 'Piloto automático'),
    ),
    ('repuestos-mantenimiento', 'lubricantes-baterias'): (
        ('lubricantes', 'Lubricantes'),
        ('baterias', 'Baterías'),
    ),
    ('agricultura-precision-tecnologia', 'sistemas-guiado-gnss'): (
        ('antenas', 'Antenas'),
        ('pantallas', 'Pantallas'),
        ('correccion-por-senal', 'Corrección por señal'),
    ),
    ('agricultura-precision-tecnologia', 'sensores-cultivo'): (
        ('clorofila', 'Clorofila'),
        ('humedad', 'Humedad'),
        ('temperatura', 'Temperatura'),
    ),
    ('agricultura-precision-tecnologia', 'drones-vants'): (
        ('multiespectrales', 'Multiespectrales'),
        ('termicos', 'Térmicos'),
        ('aplicadores', 'Aplicadores'),
    ),
    ('agricultura-precision-tecnologia', 'software-plataformas'): (
        ('gestion-de-flota', 'Gestión de flota'),
        ('prescripcion-variable', 'Prescripción variable'),
        ('rendimiento', 'Rendimiento'),
    ),
    ('tierras-parcelas', 'compra-venta-definitiva'): (
        ('campo-agricola', 'Campo agrícola'),
        ('campo-ganadero', 'Campo ganadero'),
        ('parcela-horticola-fruticola', 'Parcela hortícola/frutícola'),
        ('campo-mixto', 'Campo mixto'),
        ('otros', 'Otros'),
    ),
    ('tierras-parcelas', 'alquiler-campana'): (
        ('siembra-directa', 'Siembra directa'),
        ('siembra-convencional', 'Siembra convencional'),
        ('otros', 'Otros'),
    ),
    ('tierras-parcelas', 'alquiler-uso-transitorio'): (
        ('pastoreo-rotativo', 'Pastoreo rotativo'),
        ('ensayos-agricolas', 'Ensayos agrícolas'),
        ('produccion-estacional', 'Producción estacional'),
        ('agricultura-regenerativa', 'Agricultura regenerativa'),
        ('agricultura-experimental', 'Agricultura experimental'),
        ('otros', 'Otros'),
    ),
}


def upgrade() -> None:
    op.create_table(
        'subcategory_types',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column(
            'subcategory_id', sa.String(length=36),
            sa.ForeignKey('subcategories.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('slug', sa.String(length=80), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint('subcategory_id', 'slug', name='uq_subcategory_types_subrubro_slug'),
    )
    op.create_index('ix_subcategory_types_subcategory_id', 'subcategory_types', ['subcategory_id'])

    subrubros = {
        (categoria, subrubro): id_
        for id_, categoria, subrubro in op.get_bind().execute(sa.text(
            "SELECT s.id, c.slug, s.slug FROM subcategories s "
            "JOIN categories c ON c.id = s.category_id"
        ))
    }
    tipos = sa.table(
        'subcategory_types',
        sa.column('id', sa.String), sa.column('subcategory_id', sa.String),
        sa.column('slug', sa.String), sa.column('name', sa.String),
        sa.column('display_order', sa.Integer), sa.column('is_active', sa.Boolean),
    )
    filas = [
        {
            'id': str(uuid.uuid4()), 'subcategory_id': subrubros[clave], 'slug': slug,
            'name': nombre, 'display_order': orden, 'is_active': True,
        }
        for clave, lista in LISTAS.items() if clave in subrubros
        for orden, (slug, nombre) in enumerate(lista, start=1)
    ]
    if filas:
        op.bulk_insert(tipos, filas)

    op.add_column('products', sa.Column('subcategory_type_id', sa.String(length=36), nullable=True))
    op.create_foreign_key(
        'fk_products_subcategory_type_id', 'products', 'subcategory_types',
        ['subcategory_type_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index('ix_products_subcategory_type_id', 'products', ['subcategory_type_id'])

    op.add_column('products', sa.Column('power_hp', sa.Integer(), nullable=True))
    op.create_check_constraint(
        'ck_products_power_hp_positiva', 'products', 'power_hp IS NULL OR power_hp > 0',
    )
    op.create_index('ix_products_power_hp', 'products', ['power_hp'])


def downgrade() -> None:
    op.drop_index('ix_products_power_hp', table_name='products')
    op.drop_constraint('ck_products_power_hp_positiva', 'products', type_='check')
    op.drop_column('products', 'power_hp')

    op.drop_index('ix_products_subcategory_type_id', table_name='products')
    op.drop_constraint('fk_products_subcategory_type_id', 'products', type_='foreignkey')
    op.drop_column('products', 'subcategory_type_id')

    op.drop_index('ix_subcategory_types_subcategory_id', table_name='subcategory_types')
    op.drop_table('subcategory_types')
