"""La marca de la publicacion

El buscador que pidio la clienta ofrece elegir una MARCA despues de la
categoria y la subcategoria. El esquema no tenia donde guardarla: la marca
vivia suelta adentro del nombre o de la descripcion, donde no se puede filtrar
ni contar.

Se agregan dos columnas, y la segunda es la que evita el defecto:

- `products.brand`: la marca declarada. Nace NULA y no se rellena. Nadie puede
  saber hoy si aquel tractor era un Zanello sin adivinarle el titulo, y escribir
  una marca por omision seria afirmar algo que el vendedor no dijo.
- `categories.usa_marca`: si esa categoria ofrece marca. **No alcanza con
  decidirlo por anatomia.** La anatomia `activo` incluye «Tierras y parcelas» y
  «Bienes y Ganado», asi que ofrecer marca a todo activo pondria una lista de
  marcas de tractor sobre un campo y sobre un ternero. Un campo no tiene marca.

Arranca en verdadero SOLO para «Maquinaria agricola», que es la unica categoria
para la que hay una lista de marcas cargada. Ofrecer esa lista —marcas de
tractor— dentro de «Insumos agricolas» seria el mismo defecto al reves: un
herbicida tiene marca, pero no es ninguna de estas. Ampliarla a otra categoria
es cargar la lista de esa categoria, y es otra decision.

La vuelta atras borra las dos columnas. Es segura: ninguna otra tabla las
referencia, y ningun calculo de precio, stock, orden ni cobro las lee.
"""
from alembic import op
import sqlalchemy as sa


revision = 'e4a72c9b1f35'
down_revision = 'a91c47e2b6d8'
branch_labels = None
depends_on = None


# Las categorias que ofrecen marca, por slug. Repetida a proposito respecto del
# codigo de la aplicacion: una migracion tiene que poder correr aunque ese
# codigo cambie despues, y esto queda como el registro de lo que se escribio.
CATEGORIAS_CON_MARCA = ('maquinaria-agricola',)


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column('brand', sa.String(length=60), nullable=True),
    )
    op.add_column(
        'categories',
        sa.Column('usa_marca', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )

    # El indice lo declara el modelo (`Product.brand`, index=True) y por eso
    # tiene que crearlo la migracion: si no, el esquema y el modelo quedan
    # distintos y `alembic check` lo marca. Sirve para el dia que la marca sea
    # un filtro, que es para lo que se guarda.
    op.create_index('ix_products_brand', 'products', ['brand'])

    conexion = op.get_bind()
    for slug in CATEGORIAS_CON_MARCA:
        conexion.execute(
            sa.text(
                "UPDATE categories SET usa_marca = true "
                "WHERE slug = :slug AND is_service = false"
            ),
            {'slug': slug},
        )

    # Una categoria de servicio no ofrece marca nunca: un asesoramiento no la
    # tiene. Se deja escrito aunque hoy ninguna este en la lista, porque la
    # lista la puede editar la clienta desde el panel.
    conexion.execute(sa.text(
        "UPDATE categories SET usa_marca = false WHERE is_service = true"
    ))


def downgrade() -> None:
    op.drop_column('categories', 'usa_marca')
    op.drop_index('ix_products_brand', table_name='products')
    op.drop_column('products', 'brand')
