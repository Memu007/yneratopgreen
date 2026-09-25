"""El tercer nivel de la taxonomía: el «tipo» de cada subrubro, y la potencia.

La clienta mandó, para cada uno de sus 43 subrubros, una lista de tercer
nivel (`docs/pm/TAXONOMIA-CLIENTE.md`). Se decidió el 15/09 que NO es un
nivel más de categorías sino un atributo de la publicación: quien publica
elige uno de la lista de su subrubro, y es opcional. Una publicación sin tipo
sigue siendo válida, y el filtro positivo no la trae: pedir «Arados» no
devuelve las que no dicen qué son.

**Esta tabla es la fuente.** La siembra la carga en `subcategory_types`, igual
que las categorías: se agrega, se renombra o se da de baja acá y se vuelve a
sembrar. No se edita desde el panel.

En producción la siembra no corre. Ahí las listas las trae la migración
`c8e41f2a7d90`, con una copia congelada de esta tabla, así que cambiar una
lista después también pide una migración. El caso 196 compara las dos cargas
tipo por tipo.

Lo que decidió la PM el 25/09 sobre la transcripción (`PARA-DEV.md`):

- 29 listas claras se cargan como las escribió la clienta, con los nombres
  que ella abrevia escritos enteros («de arrastre» → «Pulverizadoras de
  arrastre»).
- 4 listas mezclaban dos cosas en una y quedan con una sola dimensión:
  Siembra y plantación (para qué cultivo, no cómo dosifica), Fertilizantes
  (origen, no forma), Compra-venta definitiva (sin los paréntesis) y Alquiler
  por campaña (sin «con/sin mejora de suelos»). Lo que sale del filtro se
  sigue encontrando con el buscador de texto.
- «Cercas y bebederos» suma «Bebederos» y «Sustratos y coberturas» suma
  «Sustratos»: el nombre del subrubro los nombra.
- Sin tipo: las cuatro «Mejoras» de Tierras (describen el campo, y un campo
  tiene varias a la vez) y las cinco de una sola opción —los cuatro «Otros» y
  «Alquiler con opción a compra»—, porque un filtro de una opción no separa
  nada.
- Tractores no lleva lista: lleva potencia. Ver abajo.

Las claves son (slug de la categoría, slug del subrubro): hay cuatro
subrubros que se llaman «Otros» y un nombre solo no los distingue. Cada tipo
es (slug, rótulo); el slug es lo que viaja en la URL y en la API.
"""
from typing import Dict, List, Optional, Tuple

Clave = Tuple[str, str]

TIPOS_POR_SUBRUBRO: Dict[Clave, Tuple[Tuple[str, str], ...]] = {
    # --- maquinaria-agricola ---
    ('maquinaria-agricola', 'preparacion-suelo'): (  # Preparación del suelo
        ('arados', 'Arados'),
        ('rastras', 'Rastras'),
        ('cultivadores', 'Cultivadores'),
        ('subsoladores', 'Subsoladores'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'siembra-plantacion'): (  # Siembra y plantación
        ('sembradoras-de-granos-gruesos', 'Sembradoras de granos gruesos'),
        ('sembradoras-de-granos-finos', 'Sembradoras de granos finos'),
        ('sembradoras-de-hortalizas', 'Sembradoras de hortalizas'),
        ('otras', 'Otras'),
    ),
    ('maquinaria-agricola', 'fertilizacion-proteccion'): (  # Fertilización y protección
        ('pulverizadoras-autopropulsadas', 'Pulverizadoras autopropulsadas'),
        ('pulverizadoras-de-arrastre', 'Pulverizadoras de arrastre'),
        ('fertilizadoras-centrifugas', 'Fertilizadoras centrífugas'),
        ('fertilizadoras-de-disco', 'Fertilizadoras de disco'),
        ('aviones', 'Aviones'),
        ('drones', 'Drones'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'cosecha'): (  # Cosecha
        ('cosechadoras-de-granos', 'Cosechadoras de granos'),
        ('cosechadoras-de-forrajes', 'Cosechadoras de forrajes'),
        ('cosechadoras-de-algodon', 'Cosechadoras de algodón'),
        ('cosechadoras-de-cana', 'Cosechadoras de caña'),
        ('cosechadoras-de-cafe', 'Cosechadoras de café'),
        ('cosechadoras-de-frutales', 'Cosechadoras de frutales'),
        ('cosechadoras-de-hortalizas', 'Cosechadoras de hortalizas'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'postcosecha'): (  # Postcosecha
        ('limpiadoras', 'Limpiadoras'),
        ('secadoras', 'Secadoras'),
        ('ensacadoras', 'Ensacadoras'),
        ('silos', 'Silos'),
        ('otros', 'Otros'),
    ),
    ('maquinaria-agricola', 'forrajes-ganaderia'): (  # Forrajes y ganadería
        ('picadoras', 'Picadoras'),
        ('embolsadoras', 'Embolsadoras'),
        ('enfardadoras', 'Enfardadoras'),
        ('mezcladoras', 'Mezcladoras'),
        ('otros', 'Otros'),
    ),
    # --- riego-drenaje ---
    ('riego-drenaje', 'riego-aspersion'): (  # Riego por aspersión
        ('pivotes', 'Pivotes'),
        ('canones', 'Cañones'),
        ('laterales', 'Laterales'),
    ),
    ('riego-drenaje', 'riego-localizado'): (  # Riego localizado
        ('goteo', 'Goteo'),
        ('microaspersion', 'Microaspersión'),
        ('cintas', 'Cintas'),
    ),
    ('riego-drenaje', 'riego-superficial-subterraneo'): (  # Riego superficial y subterráneo
        ('superficial', 'Superficial'),
        ('subterraneo', 'Subterráneo'),
    ),
    ('riego-drenaje', 'bombas-motobombas-accesorios'): (  # Bombas, motobombas y accesorios hidráulicos
        ('bombas-centrifugas', 'Bombas centrífugas'),
        ('motobombas', 'Motobombas'),
        ('accesorios-hidraulicos', 'Accesorios hidráulicos'),
    ),
    ('riego-drenaje', 'drenaje-control-hidrico'): (  # Drenaje y control hídrico
        ('drenaje-subsuperficial', 'Drenaje subsuperficial'),
        ('canales', 'Canales'),
        ('control-de-nivel', 'Control de nivel'),
    ),
    # --- insumos-agricolas ---
    ('insumos-agricolas', 'semillas-plantulas'): (  # Semillas y plántulas
        ('cultivos-extensivos', 'Cultivos extensivos'),
        ('horticolas', 'Hortícolas'),
        ('forrajeras', 'Forrajeras'),
        ('forestales', 'Forestales'),
    ),
    ('insumos-agricolas', 'fertilizantes'): (  # Fertilizantes
        ('organicos', 'Orgánicos'),
        ('minerales', 'Minerales'),
    ),
    ('insumos-agricolas', 'correctivos'): (  # Correctivos
        ('cal', 'Cal'),
        ('yeso', 'Yeso'),
        ('enmiendas', 'Enmiendas'),
    ),
    ('insumos-agricolas', 'agroinsumos-biologicos'): (  # Agroinsumos biológicos
        ('biofertilizantes', 'Biofertilizantes'),
        ('biocontroladores', 'Biocontroladores'),
        ('microorganismos', 'Microorganismos'),
    ),
    ('insumos-agricolas', 'agroquimicos'): (  # Agroquímicos
        ('herbicidas', 'Herbicidas'),
        ('insecticidas', 'Insecticidas'),
        ('fungicidas', 'Fungicidas'),
        ('acaricidas', 'Acaricidas'),
    ),
    ('insumos-agricolas', 'sustratos-coberturas'): (  # Sustratos y coberturas
        ('sustratos', 'Sustratos'),
        ('mulch', 'Mulch'),
        ('mallas', 'Mallas'),
        ('films', 'Films'),
    ),
    # --- ganaderia-forrajes ---
    ('ganaderia-forrajes', 'cercas-bebederos'): (  # Cercas y bebederos
        ('cercas-electricas', 'Cercas eléctricas'),
        ('cercas-portatiles', 'Cercas portátiles'),
        ('hidrantes', 'Hidrantes'),
        ('bebederos', 'Bebederos'),
    ),
    ('ganaderia-forrajes', 'manejo-animal'): (  # Manejo animal
        ('corrales', 'Corrales'),
        ('mangas', 'Mangas'),
        ('balanzas', 'Balanzas'),
        ('caravanas', 'Caravanas'),
    ),
    ('ganaderia-forrajes', 'ordeno-sanidad'): (  # Ordeño y sanidad
        ('ordenadoras-mecanicas', 'Ordeñadoras mecánicas'),
        ('tanques-de-leche', 'Tanques de leche'),
        ('equipos-de-bano', 'Equipos de baño'),
    ),
    ('ganaderia-forrajes', 'suplementacion'): (  # Suplementación
        ('comederos', 'Comederos'),
        ('tolvas', 'Tolvas'),
        ('silos-de-grano', 'Silos de grano'),
    ),
    # --- repuestos-mantenimiento ---
    ('repuestos-mantenimiento', 'neumaticos-camaras'): (  # Neumáticos y cámaras
        ('neumaticos-agricolas', 'Neumáticos agrícolas'),
        ('camaras', 'Cámaras'),
    ),
    ('repuestos-mantenimiento', 'filtros-correas-cuchillas-cadenas'): (  # Filtros, correas, cuchillas, cadenas
        ('filtros', 'Filtros'),
        ('correas', 'Correas'),
        ('cuchillas', 'Cuchillas'),
        ('cadenas', 'Cadenas'),
    ),
    ('repuestos-mantenimiento', 'sistemas-hidraulicos'): (  # Sistemas hidráulicos
        ('mangueras', 'Mangueras'),
        ('racores', 'Racores'),
        ('bombas-hidraulicas', 'Bombas hidráulicas'),
    ),
    ('repuestos-mantenimiento', 'sistemas-electronicos-sensores'): (  # Sistemas electrónicos y sensores
        ('monitores', 'Monitores'),
        ('gps', 'GPS'),
        ('piloto-automatico', 'Piloto automático'),
    ),
    ('repuestos-mantenimiento', 'lubricantes-baterias'): (  # Lubricantes y baterías
        ('lubricantes', 'Lubricantes'),
        ('baterias', 'Baterías'),
    ),
    # --- agricultura-precision-tecnologia ---
    ('agricultura-precision-tecnologia', 'sistemas-guiado-gnss'): (  # Sistemas de guiado y GNSS
        ('antenas', 'Antenas'),
        ('pantallas', 'Pantallas'),
        ('correccion-por-senal', 'Corrección por señal'),
    ),
    ('agricultura-precision-tecnologia', 'sensores-cultivo'): (  # Sensores de cultivo
        ('clorofila', 'Clorofila'),
        ('humedad', 'Humedad'),
        ('temperatura', 'Temperatura'),
    ),
    ('agricultura-precision-tecnologia', 'drones-vants'): (  # Drones y VANTs
        ('multiespectrales', 'Multiespectrales'),
        ('termicos', 'Térmicos'),
        ('aplicadores', 'Aplicadores'),
    ),
    ('agricultura-precision-tecnologia', 'software-plataformas'): (  # Software y plataformas
        ('gestion-de-flota', 'Gestión de flota'),
        ('prescripcion-variable', 'Prescripción variable'),
        ('rendimiento', 'Rendimiento'),
    ),
    # --- tierras-parcelas ---
    ('tierras-parcelas', 'compra-venta-definitiva'): (  # Compra-venta definitiva
        ('campo-agricola', 'Campo agrícola'),
        ('campo-ganadero', 'Campo ganadero'),
        ('parcela-horticola-fruticola', 'Parcela hortícola/frutícola'),
        ('campo-mixto', 'Campo mixto'),
        ('otros', 'Otros'),
    ),
    ('tierras-parcelas', 'alquiler-campana'): (  # Alquiler por campaña (1-12 meses)
        ('siembra-directa', 'Siembra directa'),
        ('siembra-convencional', 'Siembra convencional'),
        ('otros', 'Otros'),
    ),
    ('tierras-parcelas', 'alquiler-uso-transitorio'): (  # Alquiler por uso transitorio
        ('pastoreo-rotativo', 'Pastoreo rotativo'),
        ('ensayos-agricolas', 'Ensayos agrícolas'),
        ('produccion-estacional', 'Producción estacional'),
        ('agricultura-regenerativa', 'Agricultura regenerativa'),
        ('agricultura-experimental', 'Agricultura experimental'),
        ('otros', 'Otros'),
    ),
}


# === La potencia ==========================================================
#
# El tercer nivel de Tractores son rangos de potencia. Quien publica no elige
# un rango: carga los HP, que es el dato, y el rango se calcula. Así un tractor
# de 60 HP no depende de que su vendedor sepa dónde empieza «estándar».

SUBRUBROS_CON_POTENCIA = frozenset({
    ('maquinaria-agricola', 'tractores'),
})

POTENCIA_MINIMA = 1
POTENCIA_MAXIMA = 1000

# Los tres rangos de la clienta: compacto (<60), estándar (60–120) y alta
# (>120). Los dos bordes son de «estándar»: 60 y 120 HP son estándar.
RANGOS_DE_POTENCIA: Tuple[Tuple[str, str, Optional[int], Optional[int]], ...] = (
    # (valor, rótulo, desde inclusive, hasta inclusive)
    ('compacto', 'Compacto (menos de 60 HP)', None, 59),
    ('estandar', 'Estándar (60 a 120 HP)', 60, 120),
    ('alta', 'Alta (más de 120 HP)', 121, None),
)
VALORES_DE_RANGO = tuple(valor for valor, *_ in RANGOS_DE_POTENCIA)


def tipos_de(slug_de_categoria: Optional[str], slug_de_subrubro: Optional[str]) -> List[Tuple[str, str]]:
    """La lista de tipos de un subrubro, o vacía si no tiene."""
    return list(TIPOS_POR_SUBRUBRO.get((slug_de_categoria or '', slug_de_subrubro or ''), ()))


def usa_potencia(slug_de_categoria: Optional[str], slug_de_subrubro: Optional[str]) -> bool:
    """¿Este subrubro lleva potencia en HP?"""
    return (slug_de_categoria or '', slug_de_subrubro or '') in SUBRUBROS_CON_POTENCIA


def rango(valor: str) -> Tuple[Optional[int], Optional[int]]:
    """Los bordes inclusivos de un rango de potencia. Falla si no existe."""
    for nombre, _rotulo, desde, hasta in RANGOS_DE_POTENCIA:
        if nombre == valor:
            return desde, hasta
    raise ValueError(f'rango de potencia desconocido: {valor}')
