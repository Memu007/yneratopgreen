"""Las listas que producción necesita y que sólo traía la siembra

En producción la siembra no corre (`RAILWAY.md`): el único paso automático es
`alembic upgrade head`. Todo lo que el producto necesita para publicar o para
filtrar y que sólo cargaba la siembra no llegaba. Esta migración trae dos:

- **Las 44 marcas de maquinaria** (`form_options`, tipo `brand`). Sin ellas el
  selector «Marca» del alta ofrece sólo «Sin declarar», y el filtro y la
  faceta de marca no tienen nada que ofrecer. Lo vio Emi el 25/09 en el sitio
  publicado.
- **Las localidades de Georef** (`localities`). Sin ellas nadie puede
  publicar: la localidad es obligatoria y la API rechaza una que no existe.
  Tampoco hay provincias ni localidades para filtrar.

Es aditiva e idempotente:

- Inserta sólo lo que falta: una marca por (`option_type`, `value`) y una
  localidad por su id de Georef.
- Lo que ya existe no se toca. Una marca que alguien desactivó o renombró desde
  el panel queda como la dejó.

No trae las categorías ni los subrubros aunque también se necesitan para
publicar: producción ya los tiene, y el panel cambia el slug al renombrar
(`api/admin.py`), así que insertar «los que faltan por slug» duplicaría una
categoría renombrada.

**La vuelta atrás no hace nada, a propósito.** No hay forma de distinguir una
fila que insertó esta migración de una igual que insertó la siembra o el
panel. Además, borrar una marca deja a las publicaciones que la declararon con
un valor que la edición ya no acepta, y una localidad referenciada no se puede
borrar. La revisión anterior funciona igual con estas filas adentro: son
datos, no esquema.
"""
import csv
import hashlib
import uuid

from alembic import op
import sqlalchemy as sa


revision = '01ff14043124'
down_revision = 'c8e41f2a7d90'
branch_labels = None
depends_on = None

# Las marcas, en el orden de la siembra: la posición es el `display_order`.
# Es una COPIA congelada de `app/seed.py` al escribir esta migración, repetida
# a propósito: una migración no puede cambiar lo que hace porque cambió el
# código de la aplicación. El caso 197 las compara una por una con la siembra.
MARCAS = (
    ('agrinar', 'Agrinar'),
    ('antonio-carraro', 'Antonio Carraro'),
    ('apache', 'Apache'),
    ('belarus', 'Belarus'),
    ('bronco', 'Bronco'),
    ('case', 'Case'),
    ('case-ih', 'Case IH'),
    ('chery', 'Chery'),
    ('claas', 'Claas'),
    ('deutz', 'Deutz'),
    ('deutz-fahr', 'Deutz-Fahr'),
    ('dongfeng', 'Dongfeng'),
    ('eisen', 'Eisen'),
    ('farmtrac', 'Farmtrac'),
    ('ferrari', 'Ferrari'),
    ('fiat', 'Fiat'),
    ('foton', 'Foton'),
    ('grosspal', 'Grosspal'),
    ('hanomag', 'Hanomag'),
    ('husqvarna', 'Husqvarna'),
    ('jinma', 'Jinma'),
    ('john-deere', 'John Deere'),
    ('kioti', 'Kioti'),
    ('kubota', 'Kubota'),
    ('lamborghini-trattori', 'Lamborghini Trattori'),
    ('landini', 'Landini'),
    ('lovol', 'Lovol'),
    ('mahindra', 'Mahindra'),
    ('massey-ferguson', 'Massey Ferguson'),
    ('mccormick', 'McCormick'),
    ('new-holland', 'New Holland'),
    ('pasquali', 'Pasquali'),
    ('pauny', 'Pauny'),
    ('roland-h', 'Roland H'),
    ('same', 'SAME'),
    ('shibaura', 'Shibaura'),
    ('sonalika', 'Sonalika'),
    ('universal', 'Universal'),
    ('valpadana', 'Valpadana'),
    ('valtra', 'Valtra'),
    ('yanmar', 'Yanmar'),
    ('yard-machines', 'Yard Machines'),
    ('zanello', 'Zanello'),
    ('zoomlion', 'Zoomlion'),
)

# Las localidades se leen de la copia versionada de Georef, la misma que usa
# `app.seed_localities` y con la misma comprobación de integridad. El archivo
# ya es una copia congelada: no se repite acá.
INSERTAR_LOCALIDAD = sa.text(
    """
    INSERT INTO localities (
        id, name, province_id, province_name, department_id, department_name,
        source, latitude, longitude, coordinates
    ) VALUES (
        :id, :name, :province_id, :province_name, :department_id, :department_name,
        :source, :latitude, :longitude,
        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
    )
    ON CONFLICT (id) DO NOTHING
    """
)


def cargar_marcas(conexion) -> None:
    existentes = {
        valor for (valor,) in conexion.execute(sa.text(
            "SELECT value FROM form_options WHERE option_type = 'brand'"
        ))
    }
    opciones = sa.table(
        'form_options',
        sa.column('id', sa.String), sa.column('option_type', sa.String),
        sa.column('value', sa.String), sa.column('label', sa.String),
        sa.column('display_order', sa.Integer), sa.column('is_active', sa.Boolean),
    )
    faltan = [
        {
            'id': str(uuid.uuid4()), 'option_type': 'brand', 'value': valor,
            'label': rotulo, 'display_order': orden, 'is_active': True,
        }
        for orden, (valor, rotulo) in enumerate(MARCAS)
        if valor not in existentes
    ]
    if faltan:
        op.bulk_insert(opciones, faltan)


def cargar_localidades(conexion) -> None:
    from app.seed_localities import DATA_FILE, EXPECTED_SHA256

    datos = DATA_FILE.read_bytes()
    huella = hashlib.sha256(datos).hexdigest()
    if huella != EXPECTED_SHA256:
        raise RuntimeError(
            f"Hash inesperado para {DATA_FILE.name}: {huella} (esperado {EXPECTED_SHA256})"
        )
    tanda = []
    with DATA_FILE.open(encoding="utf-8-sig", newline="") as archivo:
        for fila in csv.DictReader(archivo):
            tanda.append({
                "id": fila["id"],
                "name": fila["nombre"],
                "province_id": fila["provincia_id"],
                "province_name": fila["provincia_nombre"],
                "department_id": fila["departamento_id"] or None,
                "department_name": fila["departamento_nombre"] or None,
                "source": fila["fuente"] or None,
                "latitude": float(fila["centroide_lat"]),
                "longitude": float(fila["centroide_lon"]),
            })
            if len(tanda) >= 500:
                conexion.execute(INSERTAR_LOCALIDAD, tanda)
                tanda.clear()
    if tanda:
        conexion.execute(INSERTAR_LOCALIDAD, tanda)


def upgrade() -> None:
    conexion = op.get_bind()
    cargar_marcas(conexion)
    cargar_localidades(conexion)


def downgrade() -> None:
    # Ver el encabezado: son datos, y no hay cómo saber cuáles puso esta
    # migración. La revisión anterior funciona igual con ellos adentro.
    pass
