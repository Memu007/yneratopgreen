"""La anatomia declarada de cada publicacion

El diseno aprobado distingue cuatro clases de operacion —activo de alto valor,
insumo, servicio y logistica— y cada una muestra datos distintos y ofrece una
accion distinta. El esquema no tenia con que elegir: `publication_type` solo
separa producto de servicio, y la subcategoria es opcional y esta mezclada.

Se agregan tres columnas:

- `products.operation_kind`: la anatomia de esa publicacion. Es el dato que
  manda, y se declara en el alta.
- `categories.default_operation_kind`: la anatomia por omision de la categoria.
  Es lo que preselecciona el formulario y lo que esta migracion usa para
  rellenar los registros que ya existian.
- `products.condition`: nuevo o usado. La anatomia de activo de alto valor la
  exige y las otras tres no la usan. Nace NULA y no se rellena: nadie puede
  saber hoy si aquel tractor era usado sin adivinarle la descripcion, y
  escribir «nuevo» por omision seria afirmar algo que el vendedor no dijo.
  Donde falta, la ficha omite la fila.

El relleno es una omision declarada, no un descubrimiento. Los datos viejos no
distinguen una cosechadora de una bolsa de urea: ni el precio, ni la unidad, ni
el stock lo dicen sin adivinar —«Kit de Filtros» vale medio millon y se vende de
a kits, «Manga Ganadera» dice unidad igual que un tractor—. Asi que se rellena
con lo que declara la categoria y el vendedor lo corrige editando. La cuenta de
cuantas filas quedaron con la omision esta en el informe.

**No cambia la logica de cobro.** Quien reserva stock y quien no lo decide desde
siempre `categories.is_service`, que esta migracion no toca. La anatomia solo
tiene prohibido contradecirlo: `servicio` y `logistica` unicamente en categorias
de servicio, `activo` e `insumo` unicamente fuera de ellas. Por eso el relleno
se calcula a partir de `is_service` y no al reves.

Para una categoria que no figura en la tabla declarada se elige la opcion que
**no cambia el comportamiento actual**: hoy toda publicacion de producto muestra
stock y «Agregar», que es exactamente `insumo`; todo servicio se comporta como
`servicio`.

La vuelta atras borra las tres columnas. Es segura: ninguna otra tabla las
referencia y ningun calculo de precio, stock, orden ni pago las mira.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a91c47e2b6d8'
down_revision = 'd5b21e8f4c73'
branch_labels = None
depends_on = None


# La misma tabla que `app/services/anatomia.py`, repetida a proposito: una
# migracion tiene que poder correr aunque el codigo de la aplicacion cambie
# despues. Si las dos se separan, manda el modulo para las publicaciones nuevas
# y esto queda como el registro de lo que efectivamente se escribio aquel dia.
DEFAULT_POR_CATEGORIA = {
    'maquinaria-agricola': 'activo',
    'tierras-parcelas': 'activo',
    'bienes-ganado': 'activo',
    'ganaderia-forrajes': 'activo',
    'riego-drenaje': 'activo',
    'agricultura-precision-tecnologia': 'activo',
    'insumos-agricolas': 'insumo',
    'repuestos-mantenimiento': 'insumo',
    'asesoramiento': 'servicio',
    'contratistas': 'servicio',
    'acopio': 'servicio',
    'logistica': 'logistica',
}

DE_SERVICIO = ('servicio', 'logistica')


def upgrade() -> None:
    op.add_column(
        'categories',
        sa.Column('default_operation_kind', sa.String(length=20),
                  nullable=False, server_default='insumo'),
    )
    op.add_column(
        'products',
        sa.Column('operation_kind', sa.String(length=20),
                  nullable=False, server_default='insumo'),
    )
    op.add_column(
        'products',
        sa.Column('condition', sa.String(length=20), nullable=True),
    )

    conexion = op.get_bind()

    # 1. Cada categoria declara la suya. Se escribe una por una y solo si cae
    #    del lado correcto de `is_service`: una tabla mal cargada no puede
    #    dejar un `insumo` dentro de una categoria de servicio.
    for slug, anatomia in DEFAULT_POR_CATEGORIA.items():
        de_servicio = anatomia in DE_SERVICIO
        conexion.execute(
            sa.text(
                "UPDATE categories SET default_operation_kind = :anatomia "
                "WHERE slug = :slug AND is_service = :de_servicio"
            ),
            {'anatomia': anatomia, 'slug': slug, 'de_servicio': de_servicio},
        )

    # 2. Las categorias que no figuran arriba —creadas por la clienta despues—
    #    toman la opcion que conserva el comportamiento de hoy.
    conexion.execute(sa.text(
        "UPDATE categories SET default_operation_kind = 'servicio' "
        "WHERE is_service = true AND default_operation_kind NOT IN ('servicio', 'logistica')"
    ))
    conexion.execute(sa.text(
        "UPDATE categories SET default_operation_kind = 'insumo' "
        "WHERE is_service = false AND default_operation_kind IN ('servicio', 'logistica')"
    ))

    # 3. Cada publicacion hereda la de su categoria. `category_id` es NOT NULL,
    #    asi que despues de esto no queda ninguna sin anatomia ni ninguna que
    #    contradiga a `is_service`.
    conexion.execute(sa.text(
        "UPDATE products SET operation_kind = categories.default_operation_kind "
        "FROM categories WHERE categories.id = products.category_id"
    ))

    op.create_index('ix_products_operation_kind', 'products', ['operation_kind'])


def downgrade() -> None:
    op.drop_index('ix_products_operation_kind', table_name='products')
    op.drop_column('products', 'condition')
    op.drop_column('products', 'operation_kind')
    op.drop_column('categories', 'default_operation_kind')
