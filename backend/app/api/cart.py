"""
API Router para carrito de compras
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from app.db.base import get_db
from app.models.cart import Cart, CartItem, CartStatus
from app.models.product import Product, ProductStatus
from app.models.product_image import ProductImage
from app.models.category import Category
from app.core.dependencies import get_current_user
from decimal import Decimal
from app.core.montos import validar_precio_unitario, validar_total
from app.models.user import User
from app.schemas.cart import (
    CartItemCreateRequest,
    CartItemUpdateRequest,
    CartResponse,
    CartItemResponse
)

router = APIRouter(prefix="/cart", tags=["cart"])


def get_or_create_cart(db: Session, user_id: str) -> Cart:
    """Obtener o crear carrito activo del usuario"""
    cart = db.query(Cart).filter(
        Cart.user_id == user_id,
        Cart.status == CartStatus.ACTIVE
    ).first()
    
    if not cart:
        cart = Cart(user_id=user_id, status=CartStatus.ACTIVE)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    
    return cart


def validar_total_prospectivo(cart: Cart, producto, cantidad_final: int,
                              fila_reemplazada=None) -> None:
    """Total que tendria el vendedor del producto si la fila quedara en
    `cantidad_final`.

    Se calcula ANTES de tocar el modelo y antes del commit: si no entra en el
    contrato monetario se responde 400 y el carrito queda exactamente como
    estaba. Sin esto, el carrito aceptaba guardar un estado que el checkout
    despues rechazaba.

    `fila_reemplazada` es la fila concreta cuya cantidad se esta cambiando; se
    omite por identidad y no por product_id, porque un carrito heredado puede
    tener dos filas del mismo producto y las otras siguen sumando.
    """
    unitario = Decimal(str(producto.price))
    linea = unitario * cantidad_final
    validar_total(linea, f"El importe de «{producto.name}»")

    total = linea
    for otro in cart.items:
        if fila_reemplazada is not None and otro is fila_reemplazada:
            continue  # ya contada con la cantidad nueva
        if fila_reemplazada is None and otro.product_id == producto.id:
            continue  # alta de un producto que ya estaba: idem
        if otro.product is None or otro.product.seller_id != producto.seller_id:
            continue  # cada vendedor es una orden distinta
        total += Decimal(str(otro.product.price)) * otro.quantity
    validar_total(total, "El total del carrito para este vendedor")


@router.get("", response_model=CartResponse)
def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener carrito actual del usuario"""
    cart = get_or_create_cart(db, current_user.id)
    
    # Calcular totales
    items_response = []
    total_amount = Decimal("0")
    
    for item in cart.items:
        # Obtener imagen primaria del producto
        primary_image = db.query(ProductImage.url).filter(
            ProductImage.product_id == item.product_id,
            ProductImage.is_primary == True
        ).first()
        
        subtotal = item.product.price * item.quantity
        total_amount += subtotal
        
        items_response.append(CartItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name,
            product_price=float(item.product.price),
            product_image=primary_image[0] if primary_image else None,
            quantity=item.quantity,
            subtotal=subtotal
        ))
    
    return CartResponse(
        id=cart.id,
        items=items_response,
        total_items=len(items_response),
        total_amount=total_amount,
        created_at=cart.created_at
    )


@router.post("/items", response_model=CartItemResponse)
def add_to_cart(
    item_data: CartItemCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Agregar producto al carrito"""
    # Verificar que el producto exista y esté activo
    product = db.query(Product).filter(
        Product.id == item_data.product_id,
        Product.status == ProductStatus.ACTIVE
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Verificar stock (solo para productos, no servicios)
    is_service = product.category.is_service if product.category else False
    if not is_service and (product.stock or 0) < item_data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente. Disponible: {product.stock}"
        )
    
    # el precio unitario tiene que entrar en el snapshot del carrito
    validar_precio_unitario(product.price)

    # Obtener o crear carrito
    cart = get_or_create_cart(db, current_user.id)
    
    # Verificar si el producto ya está en el carrito
    existing_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == item_data.product_id
    ).first()
    
    if existing_item:
        # Actualizar cantidad
        new_quantity = existing_item.quantity + item_data.quantity
        if not is_service and (product.stock or 0) < new_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente. Disponible: {product.stock}"
            )
        validar_total_prospectivo(cart, product, new_quantity, existing_item)
        existing_item.quantity = new_quantity
        existing_item.unit_price_snapshot = product.price
        db.commit()
        db.refresh(existing_item)
        cart_item = existing_item
    else:
        # Crear nuevo item
        validar_total_prospectivo(cart, product, item_data.quantity)
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price_snapshot=product.price
        )
        db.add(cart_item)
        db.commit()
        db.refresh(cart_item)
    
    # Obtener imagen primaria
    primary_image = db.query(ProductImage.url).filter(
        ProductImage.product_id == item_data.product_id,
        ProductImage.is_primary == True
    ).first()
    
    return CartItemResponse(
        id=cart_item.id,
        product_id=cart_item.product_id,
        product_name=product.name,
        product_price=float(product.price),
        product_image=primary_image[0] if primary_image else None,
        quantity=cart_item.quantity,
        subtotal=float(product.price) * cart_item.quantity
    )


@router.put("/items/{product_id}", response_model=CartItemResponse)
def update_cart_item_by_product(
    product_id: str,
    item_data: CartItemUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualizar cantidad de un item del carrito por product_id"""
    # Obtener carrito del usuario
    cart = get_or_create_cart(db, current_user.id)
    
    # Buscar el item por product_id en el carrito del usuario
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == str(product_id)
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Producto no encontrado en el carrito")
    
    # Verificar stock (solo para productos, no servicios)
    is_service = cart_item.product.category.is_service if cart_item.product.category else False
    if not is_service and (cart_item.product.stock or 0) < item_data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente. Disponible: {cart_item.product.stock}"
        )
    
    validar_total_prospectivo(cart_item.cart, cart_item.product,
                              item_data.quantity, cart_item)
    cart_item.quantity = item_data.quantity
    db.commit()
    db.refresh(cart_item)
    
    # Obtener imagen primaria
    primary_image = db.query(ProductImage.url).filter(
        ProductImage.product_id == cart_item.product_id,
        ProductImage.is_primary == True
    ).first()
    
    return CartItemResponse(
        id=cart_item.id,
        product_id=cart_item.product_id,
        product_name=cart_item.product.name,
        product_price=float(cart_item.product.price),
        product_image=primary_image[0] if primary_image else None,
        quantity=cart_item.quantity,
        subtotal=float(cart_item.product.price) * cart_item.quantity
    )


@router.patch("/items/{item_id}", response_model=CartItemResponse)
def update_cart_item(
    item_id: str,
    item_data: CartItemUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualizar cantidad de un item del carrito"""
    cart_item = db.query(CartItem).filter(CartItem.id == item_id).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    # Verificar que el item pertenece al usuario
    if cart_item.cart.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    
    # Verificar stock (solo para productos, no servicios)
    is_service = cart_item.product.category.is_service if cart_item.product.category else False
    if not is_service and (cart_item.product.stock or 0) < item_data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente. Disponible: {cart_item.product.stock}"
        )
    
    validar_total_prospectivo(cart_item.cart, cart_item.product,
                              item_data.quantity, cart_item)
    cart_item.quantity = item_data.quantity
    db.commit()
    db.refresh(cart_item)
    
    # Obtener imagen primaria
    primary_image = db.query(ProductImage.url).filter(
        ProductImage.product_id == cart_item.product_id,
        ProductImage.is_primary == True
    ).first()
    
    return CartItemResponse(
        id=cart_item.id,
        product_id=cart_item.product_id,
        product_name=cart_item.product.name,
        product_price=float(cart_item.product.price),
        product_image=primary_image[0] if primary_image else None,
        quantity=cart_item.quantity,
        subtotal=float(cart_item.product.price) * cart_item.quantity
    )


@router.delete("/items/{item_id}")
def remove_from_cart(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remover item del carrito"""
    cart_item = db.query(CartItem).filter(CartItem.id == item_id).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    # Verificar que el item pertenece al usuario
    if cart_item.cart.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    
    db.delete(cart_item)
    db.commit()
    
    return {"message": "Item removido del carrito"}


@router.delete("")
def clear_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Vaciar el carrito"""
    cart = db.query(Cart).filter(
        Cart.user_id == current_user.id,
        Cart.status == CartStatus.ACTIVE
    ).first()
    
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        db.commit()
    
    return {"message": "Carrito vaciado"}


from pydantic import BaseModel, Field
from typing import List

class SyncItemRequest(BaseModel):
    product_id: str
    # una cantidad no positiva no es un carrito valido: se rechaza en la
    # entrada y no se corrige en silencio
    quantity: int = Field(..., gt=0)

class SyncCartRequest(BaseModel):
    items: List[SyncItemRequest]


@router.post("/sync", response_model=CartResponse)
def sync_cart(
    sync_data: SyncCartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar carrito local con el backend.

    Reemplaza completamente el carrito del backend con los items proporcionados.
    Útil cuando el frontend maneja el carrito en localStorage y necesita
    sincronizarlo antes del checkout.
    """
    # Obtener o crear carrito
    cart = get_or_create_cart(db, current_user.id)

    # === PRIMERA PASADA: resolver y validar SIN ESCRIBIR ================== #
    # El carrito viejo no se toca hasta que el reemplazo entero esté validado.
    # Antes se borraba primero y se validaba linea por linea contra un carrito
    # ya vacio, asi que dos lineas del mismo vendedor que juntas se pasaban del
    # techo entraban igual.
    efectivos: dict = {}   # product_id -> {"producto", "cantidad"}
    orden: list = []       # conserva el orden de llegada del payload

    for item_data in sync_data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()

        # Nada se saltea en silencio: si el carrito local trae algo que ya no se
        # puede comprar, el usuario tiene que enterarse y decidir. Antes esto se
        # descartaba y la orden salia con menos de lo que la persona creia.
        if not product:
            raise HTTPException(
                status_code=400,
                detail="Una de las publicaciones de tu carrito ya no existe. "
                       "Quitala del carrito para continuar.",
            )
        if product.status != ProductStatus.ACTIVE:
            raise HTTPException(
                status_code=400,
                detail=f"«{product.name}» ya no está disponible. "
                       "Quitala del carrito para continuar.",
            )

        # Un mismo product_id repetido se normaliza a UNA sola linea sumando
        # cantidades: dos filas del mismo producto dejarian el calculo ambiguo.
        if product.id in efectivos:
            efectivos[product.id]["cantidad"] += item_data.quantity
        else:
            efectivos[product.id] = {"producto": product, "cantidad": item_data.quantity}
            orden.append(product.id)

    # La regla de stock se aplica sobre la cantidad YA acumulada, y tampoco
    # recorta: si no alcanza, se rechaza diciendo cuanto hay.
    for product_id in orden:
        entrada = efectivos[product_id]
        product = entrada["producto"]
        is_service = product.category.is_service if product.category else False
        if is_service:
            continue
        disponible = product.stock or 0
        if disponible <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"«{product.name}» se quedó sin stock. "
                       "Quitala del carrito para continuar.",
            )
        if entrada["cantidad"] > disponible:
            raise HTTPException(
                status_code=400,
                detail=f"«{product.name}»: pediste {entrada['cantidad']} y "
                       f"quedan {disponible}. Ajustá la cantidad para continuar.",
            )

    # Contrato monetario: cada linea y el TOTAL AGREGADO de cada vendedor.
    por_vendedor: dict = {}
    for product_id in orden:
        product = efectivos[product_id]["producto"]
        cantidad = efectivos[product_id]["cantidad"]
        linea = Decimal(str(product.price)) * cantidad
        validar_total(linea, f"El importe de «{product.name}»")
        por_vendedor[product.seller_id] = por_vendedor.get(product.seller_id, Decimal(0)) + linea
    for total_vendedor in por_vendedor.values():
        validar_total(total_vendedor, "El total del carrito para este vendedor")

    # === SEGUNDA PASADA: recién ahora se reemplaza ======================== #
    db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()

    items_response = []
    total_amount = 0.0

    for product_id in orden:
        product = efectivos[product_id]["producto"]
        quantity = efectivos[product_id]["cantidad"]

        cart_item = CartItem(
            cart_id=cart.id,
            product_id=product.id,
            quantity=quantity,
            unit_price_snapshot=product.price
        )
        db.add(cart_item)
        db.flush()

        # Obtener imagen primaria
        primary_image = db.query(ProductImage.url).filter(
            ProductImage.product_id == product.id,
            ProductImage.is_primary == True
        ).first()

        subtotal = float(product.price) * quantity
        total_amount += subtotal

        items_response.append(CartItemResponse(
            id=cart_item.id,
            product_id=product.id,
            product_name=product.name,
            product_price=float(product.price),
            product_image=primary_image[0] if primary_image else None,
            quantity=quantity,
            subtotal=subtotal
        ))

    db.commit()

    return CartResponse(
        id=cart.id,
        items=items_response,
        total_items=len(items_response),
        total_amount=total_amount,
        created_at=cart.created_at
    )
