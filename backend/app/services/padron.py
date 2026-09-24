"""El padrón de localidades, tal como lo ofrecen los selectores.

Georef lista algunas localidades dos veces: la localidad y, adentro, una
entidad con el mismo nombre. «Mar del Plata» es `06357110` y también
`0635711003`. En el padrón versionado son 105, todas a 2,3 km o menos de su
localidad. Para quien elige de una lista son el mismo lugar dos veces, así
que los selectores no las ofrecen.

No se borran. Una publicación o una cuenta pueden estar guardadas sobre una
de ellas y siguen valiendo tal cual. Al filtrar por la localidad que la
contiene, entran con ella.

Se reconocen por el identificador, sin columna nueva ni datos tocados:

- tienen diez dígitos;
- los ocho primeros son los de una localidad presente;
- repiten su nombre.

Las demás entidades de Georef tienen otro nombre que su localidad —un barrio,
un paraje— y se siguen ofreciendo como lugares propios.

Lo que queda repetido son homónimas de verdad, lugares distintos en
departamentos distintos, como «San Pedro» en cuatro departamentos de Santiago
del Estero. Esas se ofrecen todas, con el departamento en el rótulo para
poder elegir, y se muestran con él donde aparezcan —tarjeta, ficha, base del
transportista—: lo que se eligió se tiene que poder reconocer después.
"""
from collections import Counter
from typing import Dict, Iterable, List, Optional

from sqlalchemy import func, tuple_
from sqlalchemy.orm import Session

from app.models.locality import Locality

_LARGO_DE_LOCALIDAD = 8
_LARGO_DE_ENTIDAD = 10


def contenedora(locality_id: str, nombre: str, nombres_por_id: dict) -> Optional[str]:
    """La localidad que contiene a esta entidad, si es una anidada; si no, None.

    `nombres_por_id` tiene que traer al menos las localidades de su provincia:
    la contenedora comparte los primeros dígitos, y con ellos la provincia.
    """
    if len(locality_id) != _LARGO_DE_ENTIDAD:
        return None
    madre = locality_id[:_LARGO_DE_LOCALIDAD]
    return madre if nombres_por_id.get(madre) == nombre else None


def _rotulo(fila: Locality, homonima: bool) -> str:
    """El nombre, con el departamento sólo si el nombre se repite en la
    provincia. Es la regla del selector y la de todo lugar donde se muestra
    una localidad: lo que se eligió se tiene que poder reconocer después."""
    return f"{fila.name} ({fila.department_name or fila.id})" if homonima else fila.name


def para_el_selector(filas: Iterable[Locality]) -> List[dict]:
    """Las localidades de UNA provincia como se ofrecen para elegir.

    Sin las entidades anidadas. Cada una dice qué anidadas absorbe
    (`nested_ids`), para que un formulario que abre con una de ellas guardada
    muestre su localidad sin cambiar lo guardado. El rótulo es el nombre, con
    el departamento sólo cuando el nombre se repite en la provincia.
    """
    filas = list(filas)
    nombres_por_id = {fila.id: fila.name for fila in filas}
    absorbidas: dict = {}
    visibles = []
    for fila in filas:
        madre = contenedora(fila.id, fila.name, nombres_por_id)
        if madre:
            absorbidas.setdefault(madre, []).append(fila.id)
        else:
            visibles.append(fila)
    repetidos = Counter(fila.name for fila in visibles)
    return [
        {
            "id": fila.id,
            "name": fila.name,
            "label": _rotulo(fila, repetidos[fila.name] > 1),
            "nested_ids": sorted(absorbidas.get(fila.id, [])),
            "province_id": fila.province_id,
            "province_name": fila.province_name,
            "latitude": float(fila.latitude),
            "longitude": float(fila.longitude),
        }
        for fila in visibles
    ]


def rotulos(db: Session, ids: Iterable[Optional[str]]) -> Dict[str, str]:
    """El rótulo de cada localidad pedida, con la misma regla del selector.

    Una entidad anidada lleva el rótulo de su localidad: es el mismo lugar.
    Se mira sólo lo necesario, las localidades que comparten provincia y
    nombre con las pedidas. Un id que no está en el padrón no aparece en la
    respuesta, y quien llama muestra lo que tenía.
    """
    pedidos = {i for i in ids if i}
    if not pedidos:
        return {}
    filas = db.query(Locality).filter(Locality.id.in_(pedidos)).all()
    if not filas:
        return {}
    pares = {(fila.province_id, fila.name) for fila in filas}
    vecinas = db.query(Locality).filter(
        tuple_(Locality.province_id, Locality.name).in_(list(pares))
    ).all()
    # La contenedora de una anidada comparte provincia y nombre: está entre
    # las vecinas.
    nombres_por_id = {fila.id: fila.name for fila in vecinas}
    por_id = {fila.id: fila for fila in vecinas}
    cuantas = Counter(
        (fila.province_id, fila.name) for fila in vecinas
        if not contenedora(fila.id, fila.name, nombres_por_id)
    )
    salida = {}
    for fila in filas:
        madre = contenedora(fila.id, fila.name, nombres_por_id)
        cabeza = por_id[madre] if madre else fila
        salida[fila.id] = _rotulo(cabeza, cuantas[(fila.province_id, fila.name)] > 1)
    return salida


def ids_del_filtro(db: Session, locality_id: str) -> List[str]:
    """Los identificadores que cubre filtrar por una localidad.

    Son la localidad y sus entidades anidadas. Si lo pedido es una anidada
    —un enlace viejo, por ejemplo—, cuenta como su localidad: es el mismo
    lugar. Un identificador que no está en el padrón se filtra tal cual y no
    trae nada.
    """
    pedida = db.get(Locality, locality_id)
    if pedida is None:
        return [locality_id]
    cabeza = pedida
    if len(pedida.id) == _LARGO_DE_ENTIDAD:
        madre = db.get(Locality, pedida.id[:_LARGO_DE_LOCALIDAD])
        if madre is not None and madre.name == pedida.name:
            cabeza = madre
    if len(cabeza.id) != _LARGO_DE_LOCALIDAD:
        return [cabeza.id]
    anidadas = db.query(Locality.id).filter(
        func.length(Locality.id) == _LARGO_DE_ENTIDAD,
        func.left(Locality.id, _LARGO_DE_LOCALIDAD) == cabeza.id,
        Locality.name == cabeza.name,
    )
    return [cabeza.id, *(fila.id for fila in anidadas)]
