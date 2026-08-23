"""Qué clase de operación es una publicación.

El diseño aprobado pide cuatro anatomías —activo de alto valor, insumo,
servicio y logística— y cada una muestra datos distintos y ofrece una acción
distinta. El producto no tenía con qué elegir entre ellas: `publication_type`
sólo separa producto de servicio, y adivinar el resto por el precio, el título
o el largo de la unidad habría metido una regla invisible en el frontend que
nadie podría corregir después.

Así que la anatomía se declara y se guarda: `products.operation_kind`. Es un
dato de la publicación, no una lectura de la interfaz.

Dos reglas la sostienen:

1. **No contradice al cobro.** Quién paga stock y quién no lo decide desde
   siempre `category.is_service`, y eso no se toca. La anatomía tiene que
   coincidir: `servicio` y `logistica` sólo viven en categorías de servicio, y
   `activo` e `insumo` sólo fuera de ellas. Una publicación que quiera cruzar
   ese límite se rechaza en el alta, no se corrige en silencio.

2. **Nunca queda vacía.** Cada categoría declara su anatomía por omisión, que
   es lo que usa la migración para los registros que ya existían y lo que trae
   preseleccionado el formulario. Es una omisión declarada, no un
   descubrimiento: el dato viejo no distingue una cosechadora de una bolsa de
   urea, y el vendedor puede corregirlo editando la publicación.
"""
from __future__ import annotations

from typing import Optional

# Las cuatro y no hay una quinta.
ACTIVO = "activo"
INSUMO = "insumo"
SERVICIO = "servicio"
LOGISTICA = "logistica"

ANATOMIAS = (ACTIVO, INSUMO, SERVICIO, LOGISTICA)

# Las dos que exigen una categoría de servicio. El complemento exige lo
# contrario: es el mismo límite mirado desde el otro lado.
DE_SERVICIO = (SERVICIO, LOGISTICA)

# Cómo se llaman para un humano. El backend no arma texto de interfaz, pero el
# alta necesita explicar qué está eligiendo el vendedor.
ETIQUETAS = {
    ACTIVO: "Activo de alto valor",
    INSUMO: "Insumo estandarizado",
    SERVICIO: "Servicio",
    LOGISTICA: "Logística",
}

# La anatomía por omisión de cada categoría del catálogo. Se elige por el
# objeto principal de la categoría, no por sus publicaciones de hoy:
# «Repuestos» vende piezas estandarizadas aunque una valga un millón, y
# «Riego y drenaje» vende equipos aunque el envase diga kit.
DEFAULT_POR_CATEGORIA = {
    "maquinaria-agricola": ACTIVO,
    "tierras-parcelas": ACTIVO,
    "bienes-ganado": ACTIVO,
    "ganaderia-forrajes": ACTIVO,
    "riego-drenaje": ACTIVO,
    "agricultura-precision-tecnologia": ACTIVO,
    "insumos-agricolas": INSUMO,
    "repuestos-mantenimiento": INSUMO,
    "asesoramiento": SERVICIO,
    "contratistas": SERVICIO,
    "acopio": SERVICIO,
    "logistica": LOGISTICA,
}


def es_de_servicio(anatomia: Optional[str]) -> bool:
    """¿Esta anatomía vive del lado de los servicios?"""
    return anatomia in DE_SERVICIO


def compatible(anatomia: Optional[str], categoria_es_servicio: bool) -> bool:
    """¿La anatomía cae del mismo lado que la categoría?

    Es la regla que impide que la interfaz prometa una cosa y el cobro haga
    otra: un `insumo` en una categoría de servicio mostraría stock y un botón
    de agregar sobre algo que nunca reserva unidades.
    """
    if anatomia not in ANATOMIAS:
        return False
    return es_de_servicio(anatomia) == bool(categoria_es_servicio)


def por_omision(slug_de_categoria: Optional[str], categoria_es_servicio: bool) -> str:
    """La anatomía que le corresponde a una categoría cuando nadie la declaró.

    Para una categoría que no está en la tabla —una que cree la clienta más
    adelante— se elige la opción que **no cambia el comportamiento actual**:
    hoy toda publicación de producto muestra stock y «Agregar», que es
    exactamente `insumo`; y todo servicio se comporta como `servicio`.
    """
    declarada = DEFAULT_POR_CATEGORIA.get(slug_de_categoria or "")
    if declarada is not None and compatible(declarada, categoria_es_servicio):
        return declarada
    return SERVICIO if categoria_es_servicio else INSUMO


# --- Condición del activo -------------------------------------------------
#
# La anatomía de activo de alto valor pide condición, y el esquema no la tenía:
# «usado» vivía suelto adentro de la descripción, donde no se puede filtrar ni
# comparar. Es obligatoria para publicar un activo nuevo y queda vacía en los
# que ya existían, porque nadie puede saber hoy si aquel tractor era usado sin
# leerle la descripción y adivinar. Donde falta, la ficha omite la fila en vez
# de inventar «nuevo».
NUEVO = "nuevo"
USADO = "usado"

CONDICIONES = (NUEVO, USADO)

ETIQUETA_DE_CONDICION = {
    NUEVO: "Nuevo",
    USADO: "Usado",
}


def condicion_valida(condicion: Optional[str]) -> bool:
    return condicion in CONDICIONES


def usa_condicion(anatomia: Optional[str]) -> bool:
    """¿Esta anatomía muestra condición?

    Sólo el activo de alto valor: un insumo no se compra por su desgaste.

    **No es obligatoria, y eso es una decisión, no un olvido.** `ANATOMIAS.md`
    la pide obligatoria para el activo, pero el catálogo aprobado tiene dos
    categorías de activo donde «nuevo o usado» no significa nada: «Bienes y
    Ganado» —un ternero no es ninguna de las dos— y «Tierras y parcelas».
    Forzarla ahí obligaría al vendedor a elegir una respuesta falsa para poder
    publicar, que es peor que no tener el dato. Se ofrece, se valida si viene,
    y la ficha omite la fila cuando falta.
    """
    return anatomia == ACTIVO
