"""Modelo, año y origen: lo que quien vende declara además del tipo.

La clienta lo pidió en su devolución #9: «cuantos más datos aporta el vendedor
mayor probabilidad de aparecer al filtrar». Las decisiones son de la PM
(ATRIBUTOS-RUBRO-1, parte 2):

- **Modelo y año**, sólo en maquinaria. Van donde va la marca: la categoría que
  declara `usa_marca` (hoy, Maquinaria agrícola). Se toma esa bandera y no un
  slug escrito acá porque el panel cambia el slug al renombrar una categoría.
  El modelo es texto libre y se encuentra con el buscador; el año es un número
  entre 1950 y el año próximo, y se filtra por rango.
- **Origen**, «Agencia / Concesionaria» o «Dueño directo». Opcional y sólo para
  productos: un servicio no tiene concesionaria. Es lo que DECLARA quien
  vende, y toda pantalla lo rotula así; nunca tiene el aspecto del distintivo
  de documentación revisada, que sí es algo que la plataforma comprobó.

Ninguno es una lista de la base: viven en el código y llegan a producción con
el despliegue, sin nada que sembrar.
"""
from datetime import datetime, timezone
from typing import Optional, Tuple

ANIO_MINIMO = 1950

ORIGENES: Tuple[Tuple[str, str], ...] = (
    ("concesionaria", "Agencia / Concesionaria"),
    ("dueno_directo", "Dueño directo"),
)
VALORES_DE_ORIGEN = frozenset(valor for valor, _ in ORIGENES)
LARGO_DEL_MODELO = 80


def anio_maximo() -> int:
    """El año próximo: una máquina 2027 se vende desde mediados de 2026."""
    return datetime.now(timezone.utc).year + 1


def validar_anio(anio: Optional[int]) -> Optional[int]:
    """El año, si está en el rango; si no, un error que dice cuál es."""
    if anio is None:
        return None
    if not ANIO_MINIMO <= anio <= anio_maximo():
        raise ValueError(f"El año tiene que estar entre {ANIO_MINIMO} y {anio_maximo()}.")
    return anio


def usa_modelo_y_anio(categoria) -> bool:
    """¿Esta categoría pide modelo y año? Los pide donde pide marca."""
    return bool(getattr(categoria, "usa_marca", False))
