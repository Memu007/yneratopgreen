"""Una sola imagen principal por publicacion

`product_images` admitia hasta ahora dos filas con `is_primary = true` para la
misma publicacion. La regla de negocio no cambia con esta migracion: siempre
fue cero o una. Lo que cambia es quien la sostiene. Hasta hoy la sostenian, de
a ratos, los caminos de carga y de borrado; ahora la sostiene la base, que es
el unico lugar donde no se puede olvidar.

`QUERY-IMG-1` ya habia hecho que el catalogo TOLERE el dato sucio: el listado
elige una sola primaria por publicacion con una subconsulta determinista, para
que un duplicado no multiplique la fila ni infle el total. Eso sigue como
esta. Tolerar el dato sucio y no dejar que se cree son dos cosas distintas, y
esta es la segunda.

El orden de los dos pasos no es un detalle: **crear el indice sobre datos ya
sucios falla**. Asi que primero se elige, para cada publicacion con mas de una
principal, cual queda, y recien despues se crea la restriccion.

Cual queda: la de menor `display_order` y, a igualdad de orden, la de menor
`id`. Es el mismo criterio con el que el catalogo viene eligiendo desde
`QUERY-IMG-1`, asi que las publicaciones que hoy tienen duplicados no cambian
la foto que ya se les ve. Elegir cualquier otra seria cambiarle la tapa a una
publicacion sin que nadie lo haya pedido.

**No se borra ninguna imagen.** Las que dejan de ser principales siguen en la
galeria, con su orden. Una restriccion de integridad no es motivo para perder
un archivo que el vendedor subio.

La vuelta atras retira la restriccion y nada mas. No reconstruye los duplicados
que habia —no se puede saber cuales eran, y tampoco haria falta: cero o una
principal es valido con o sin indice— y no toca ninguna fila.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b6d3f12a8e94'
down_revision = 'e4a72c9b1f35'
branch_labels = None
depends_on = None


# Lo declara tambien el modelo (`ProductImage.__table_args__`). Tiene que estar
# en los dos lados: si sólo estuviera acá, el esquema y el modelo quedarian
# distintos y `alembic check` lo marcaria.
INDICE = 'uq_product_images_primaria_unica'


def upgrade() -> None:
    conexion = op.get_bind()

    # De cada publicacion con mas de una principal sobrevive una sola. El
    # `DISTINCT ON` con ese orden es exactamente la eleccion que ya hace el
    # catalogo, asi que la foto visible no se mueve.
    conexion.execute(sa.text("""
        UPDATE product_images
        SET is_primary = false
        WHERE is_primary
          AND id NOT IN (
              SELECT DISTINCT ON (product_id) id
              FROM product_images
              WHERE is_primary
              ORDER BY product_id, display_order, id
          )
    """))

    # Parcial a proposito: lo unico que no se puede repetir es la principal.
    # Una publicacion puede tener varias secundarias, y muchas publicaciones
    # pueden no tener ninguna principal.
    op.create_index(
        INDICE,
        'product_images',
        ['product_id'],
        unique=True,
        postgresql_where=sa.text('is_primary'),
    )


def downgrade() -> None:
    op.drop_index(INDICE, table_name='product_images')
