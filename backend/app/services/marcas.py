"""Que categorias declaran marca, y cual es la lista.

**No se deduce de la anatomia.** `activo` incluye «Tierras y parcelas» y
«Bienes y Ganado», y ni un campo ni un ternero tienen marca. Tampoco alcanza
con «vende cosas fabricadas»: un herbicida tiene marca, pero no es ninguna de
las que hay cargadas, que son de maquinaria. Ofrecer esta lista dentro de
«Insumos agricolas» seria el mismo defecto que ofrecerla para un campo.

Por eso arranca en una sola categoria. Ampliarla a otra es cargar la lista de
esa otra categoria, y es una decision de producto, no un renglon mas aca.

Este modulo decide el valor POR OMISION que escribe la semilla. Lo que manda en
caliente es `categories.usa_marca`, que la clienta edita desde el panel.
"""
from typing import Optional


CATEGORIAS_CON_MARCA = frozenset({
    "maquinaria-agricola",
})


def usa_marca_por_categoria(
    slug_de_categoria: Optional[str],
    categoria_es_servicio: bool,
) -> bool:
    """¿Esta categoria ofrece marca?

    Una categoria de servicio no la ofrece nunca: un asesoramiento no tiene
    marca. Se comprueba aunque hoy ninguna figure en la lista, porque la lista
    se edita y un error ahi no puede convertir un servicio en una maquina.
    """
    if categoria_es_servicio:
        return False
    return slug_de_categoria in CATEGORIAS_CON_MARCA
