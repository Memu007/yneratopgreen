"""De quién es la publicación, y por qué eso cierra la compra.

Nadie compra lo suyo. Si comprador y vendedor son la misma cuenta, la orden que
saldría tiene `buyer_id = seller_id`, y a partir de ahí todo lo que cuelga de
esa orden queda apuntando a una sola punta: el stock se descuenta y se acredita
al mismo dueño, la transferencia va de una cuenta a sí misma, la calificación
es propia y el aviso de venta le llega a quien compró. No es una preferencia de
pantalla: es un estado de negocio que no existe.

La regla vive acá una sola vez y la aplican los lugares que pueden escribir: el
carrito —antes de guardar la fila—, las formas de pago y el checkout —antes de
la primera orden—. Dos copias de esta regla serían dos reglas que se van a
separar, y la que se olvide es la que toca plata.

Compara **identidades, no roles**. Un administrador o un transportista que
publica es, para esta regla, exactamente un vendedor: el rol declarado no entra
en la cuenta.
"""
from __future__ import annotations

from fastapi import HTTPException

# 409 y no 403: no es un permiso que falte. La misma persona con la misma
# sesión compra sin problema cualquier otra publicación; lo que no existe es
# esta combinación de comprador y publicación. Es un conflicto con el estado de
# las cosas, que es lo que 409 nombra.
CONFLICTO = 409


def es_propia(producto, usuario) -> bool:
    """¿Esta publicación es de quien está queriendo comprarla?"""
    if producto is None or usuario is None:
        return False
    return producto.seller_id == usuario.id


def motivo_de(producto, en_el_carrito: bool = False) -> str:
    """Qué se le dice a la persona, que es quien lee esto.

    Cambia según dónde esté la publicación. Si la está agregando recién, no hay
    nada que sacar y mandarla a «quitala del carrito» sería mandarla a buscar
    algo que no está. Si ya la tiene guardada —el carrito del navegador, o uno
    armado antes de que existiera esta regla—, el paso siguiente sí es sacarla,
    y hay que decírselo: **no se borra sola**. Borrarla en silencio sería
    decidir por ella sobre algo que ella eligió.
    """
    dicho = f"«{producto.name}» es tu propia publicación: no podés comprarla."
    if en_el_carrito:
        return f"{dicho} Quitala del carrito para continuar."
    return dicho


def exigir_que_no_sea_propia(producto, usuario, en_el_carrito: bool = False) -> None:
    """Corta antes de escribir una sola fila."""
    if es_propia(producto, usuario):
        raise HTTPException(
            status_code=CONFLICTO,
            detail=motivo_de(producto, en_el_carrito=en_el_carrito),
        )


def exigir_carrito_sin_publicaciones_propias(cart, usuario) -> None:
    """Corta cuando el carrito guardado ya trae una publicación propia.

    Es el caso del carrito heredado: alguien lo armó antes de que la regla
    existiera. El carrito no se toca y queda activo, para que la persona pueda
    sacar lo que sobra.

    Se nombra la primera publicación propia y no todas: la lista entera no
    agrega nada para el paso siguiente, que es sacar una.
    """
    for item in getattr(cart, "items", []) or []:
        if es_propia(item.product, usuario):
            raise HTTPException(
                status_code=CONFLICTO,
                detail=motivo_de(item.product, en_el_carrito=True),
            )
