"""El vocabulario de cargas declaradas, y qué se acepta como declaración.

Es un catálogo **cerrado y del código**, no una tabla configurable, y la razón
es concreta: las claves quedan guardadas en los perfiles. Si alguien pudiera
borrar una opción desde una pantalla de administración, las declaraciones ya
hechas pasarían a referirse a algo que no existe sin que nadie las tocara.

Y es una **declaración**, no un filtro. Nada de acá entra en la regla de
compatibilidad: quién aparece en una búsqueda y en qué orden lo siguen
decidiendo la localidad base y el radio, como antes. Filtrar por carga haría
desaparecer del directorio a todo el que no completó un campo nuevo, que es
confundir «no lo declaró» con «no lo lleva».
"""
from typing import List, Optional, Tuple

# Clave guardada → etiqueta que se muestra. Las claves no cambian; las
# etiquetas sí pueden, y por eso no son lo que se guarda.
CARGAS = (
    ("granos_a_granel", "Granos a granel"),
    ("bolsones", "Bolsones y big bags"),
    ("maquinaria", "Maquinaria agrícola"),
    ("agroquimicos", "Agroquímicos"),
    ("hacienda", "Hacienda en pie"),
    ("refrigerada", "Carga refrigerada"),
    ("otra", "Otra"),
)

CLAVE_OTRA = "otra"
ETIQUETAS = dict(CARGAS)
CLAVES = [clave for clave, _ in CARGAS]

# Los límites, explícitos y en un solo lugar. Se anuncian con el número en el
# mensaje: un rechazo que no dice cuánto entra obliga a adivinar.
MAXIMO_DECLARADAS = len(CLAVES)
MAXIMO_DETALLE = 120
MAXIMO_MODELO = 120
MAXIMO_DOMINIO = 20


class CargaInvalida(ValueError):
    """Lo declarado no entra. El mensaje se le muestra a la persona."""


def normalizar(
    declaradas: Optional[List[str]],
    detalle: Optional[str],
) -> Tuple[Optional[List[str]], Optional[str]]:
    """Devuelve la declaración lista para guardar, o explica por qué no.

    Qué hace, y por qué cada cosa:

    - recorta espacios y pasa a minúsculas, porque `" Granos_a_granel "` y
      `granos_a_granel` son la misma declaración escrita distinto;
    - descarta repetidas y ordena por el catálogo, así dos perfiles que
      declaran lo mismo se muestran igual y el orden no depende de en qué
      orden tildó las casillas cada uno;
    - rechaza lo que no está en el catálogo diciendo qué se acepta, en vez de
      guardarlo y que aparezca en pantalla un valor que nadie puede leer;
    - **suelta el detalle si «Otra» no quedó declarada**: un detalle sin su
      opción es un texto que se mostraría solo, sin nada que lo explique.
    """
    if declaradas is None:
        # No se envió el campo: no hay nada que normalizar. El detalle se
        # resuelve igual, porque puede venir solo.
        limpio = _detalle(detalle)
        return None, limpio

    if len(declaradas) > MAXIMO_DECLARADAS:
        raise CargaInvalida(
            f"Se pueden declarar hasta {MAXIMO_DECLARADAS} tipos de carga"
        )

    vistas = set()
    for cruda in declaradas:
        if not isinstance(cruda, str):
            raise CargaInvalida("Las cargas declaradas se envían como texto")
        clave = cruda.strip().lower()
        if not clave:
            continue
        if clave not in ETIQUETAS:
            raise CargaInvalida(
                f"«{cruda.strip()}» no es un tipo de carga válido. "
                f"Los válidos son: {', '.join(CLAVES)}"
            )
        vistas.add(clave)

    limpias = [clave for clave in CLAVES if clave in vistas]
    limpio = _detalle(detalle)

    if CLAVE_OTRA in vistas and not limpio:
        raise CargaInvalida(
            "Elegiste «Otra»: contá en una línea qué transportás"
        )
    if CLAVE_OTRA not in vistas:
        limpio = None

    return (limpias or None), limpio


def _detalle(detalle: Optional[str]) -> Optional[str]:
    if detalle is None:
        return None
    limpio = " ".join(detalle.split())
    if not limpio:
        return None
    if len(limpio) > MAXIMO_DETALLE:
        raise CargaInvalida(
            f"El detalle de «Otra» no puede superar {MAXIMO_DETALLE} caracteres"
        )
    return limpio


def declaradas_de(guardadas: Optional[List[str]], detalle: Optional[str]) -> List[str]:
    """Lo declarado, ya en texto mostrable.

    Se resuelve en el servidor y no en cada pantalla: la lista sale igual en el
    listado de candidatos, en el bloque del elegido y en el traslado de la
    orden, sin que tres lugares tengan que conocer el catálogo. Y se recorre el
    catálogo, no lo guardado, así el orden es siempre el mismo aunque una fila
    vieja tenga las claves en otro orden.
    """
    presentes = set(guardadas or [])
    salida = []
    for clave in CLAVES:
        if clave not in presentes:
            continue
        if clave == CLAVE_OTRA:
            limpio = (detalle or "").strip()
            salida.append(f"Otra: {limpio}" if limpio else ETIQUETAS[clave])
        else:
            salida.append(ETIQUETAS[clave])
    return salida


def declaradas(usuario) -> List[str]:
    """Lo mismo, para cuando se tiene el usuario y no las dos columnas."""
    return declaradas_de(usuario.carrier_cargo_types, usuario.carrier_cargo_other)


def texto_acotado(valor: Optional[str], maximo: int, etiqueta: str) -> Optional[str]:
    """Recorta espacios de más y comprueba el largo que se anuncia.

    Los espacios internos se colapsan porque `AB   123  CD` y `AB 123 CD` son
    lo mismo escrito distinto, y guardar las dos formas haría que el mismo
    dominio se lea de dos maneras según quién lo cargó.
    """
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    if not limpio:
        return None
    if len(limpio) > maximo:
        raise CargaInvalida(f"{etiqueta} no puede superar {maximo} caracteres")
    return limpio
