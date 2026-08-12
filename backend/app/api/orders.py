"""
API Router para órdenes de compra
"""
from fastapi import APIRouter, Depends, HTTPException, Body, File, UploadFile
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from io import BytesIO
import os
import secrets
from decimal import Decimal

from app.db.base import get_db
from app.models.order import Order, OrderItem, OrderStatus
from app.models.cart import Cart, CartStatus
from app.models.locality import Locality
from app.models.product import Product
from app.core.dependencies import get_current_user
from app.core.montos import validar_total
from app.models.user import User
from app.schemas.logistics import OrderShipping
from app.schemas.orders import (
    BankTransferCheckoutResponse,
    BankTransferDecisionRequest,
    BankTransferOption,
    BankTransferOrderResponse,
    CheckoutRequest,
    OrderItemResponse,
    OrderResponse,
)
from app.services.logistica import (
    MODO_PROPIO,
    MODO_TRANSPORTISTA,
    carrito_activo,
    grupos_del_carrito,
    resolver_decisiones,
    resolver_destino,
)
from app.services.storage import get_storage
from app.api.notifications import (
    notify_order_placed, notify_order_received, notify_order_confirmed,
    notify_order_shipped, notify_order_delivered, notify_order_cancelled
)
# Import lazy para evitar circular imports
def get_refund_processor():
    from app.api.payments import process_refund
    return process_refund

router = APIRouter(prefix="/orders", tags=["orders"])


def generate_order_number() -> str:
    """Generar número de orden único"""
    timestamp = datetime.now().strftime("%Y%m%d")
    random = secrets.token_hex(4).upper()
    return f"ORD-{timestamp}-{random}"


@router.post("/checkout", response_model=OrderResponse)
def checkout(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crear orden desde el carrito actual.
    Convierte el carrito en orden y descuenta stock.
    """
    cart = carrito_activo(db, current_user)

    # Antes de escribir nada: el destino tiene que existir en el padrón.
    destino = resolver_destino(db, checkout_data.shipping_locality_id)

    # Los grupos los deriva el servidor del carrito, no el cliente. Cada uno
    # tiene que traer su decisión de traslado, y cada transportista elegido
    # se revalida contra este destino y estos orígenes antes de la primera
    # fila: si una decisión falla, no se crea ninguna orden.
    grupos = grupos_del_carrito(cart)
    elegidos = resolver_decisiones(
        db, destino, grupos, checkout_data.shipping_decisions
    )
    items_by_seller = {
        seller_id: grupo.items for seller_id, grupo in grupos.items()
    }

    # Validar TODOS los totales antes de escribir: si alguno no entra en el
    # contrato monetario, la respuesta es 4xx y no queda una orden a medias.
    for _seller_id, _items in items_by_seller.items():
        for _item in _items:
            validar_total(
                Decimal(str(_item.product.price)) * _item.quantity,
                f"El importe de «{_item.product.name}»",
            )
        validar_total(
            sum((Decimal(str(x.product.price)) * x.quantity for x in _items), Decimal(0)),
            "El total de la orden",
        )

    created_orders = []
    
    # Crear una orden por cada vendedor
    for seller_id, items in items_by_seller.items():
        # Calcular totales
        subtotal = sum(float(item.product.price) * item.quantity for item in items)
        shipping_cost = 0.0
        total_amount = subtotal + shipping_cost
        
        # Crear orden
        order = Order(
            order_number=generate_order_number(),
            buyer_id=current_user.id,
            seller_id=seller_id,
            status=OrderStatus.PLACED,
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            total_amount=total_amount,
            shipping_address_json={
                "address": checkout_data.shipping_address,
                "city": destino.name,
                "province": destino.province_name,
                "postal_code": checkout_data.shipping_postal_code,
                "locality_id": destino.id,
            },
            shipping_locality_id=destino.id,
            shipping_mode=(
                MODO_TRANSPORTISTA if elegidos[seller_id] else MODO_PROPIO
            ),
            carrier_id=elegidos[seller_id].id if elegidos[seller_id] else None,
            buyer_notes=checkout_data.notes
        )
        
        db.add(order)
        db.flush()  # Para obtener el ID de la orden
        
        # Crear items de la orden
        order_items = []
        for cart_item in items:
            product = cart_item.product
            
            # Verificar stock nuevamente (solo para productos, no servicios)
            is_service = product.category.is_service if product.category else False
            if not is_service and (product.stock or 0) < cart_item.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {product.name}"
                )
            
            # Obtener imagen primaria
            primary_image = None
            if product.images:
                for img in product.images:
                    if img.is_primary:
                        primary_image = img.url
                        break
            
            # Crear item de orden (con snapshot de datos)
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name_snapshot=product.name,
                product_image_snapshot=primary_image,
                unit_price_snapshot=float(product.price),
                quantity=cart_item.quantity,
                total_price=float(product.price) * cart_item.quantity,
                **origen_de(product),
            )
            
            db.add(order_item)
            order_items.append(order_item)
            
            # NOTA: El stock se descuenta cuando el pago es aprobado (en payments.py webhook)
            # No descontar aquí porque el usuario puede abandonar el pago
        
        # Guardar datos para response antes del commit
        created_orders.append({
            "order": order,
            "order_items": order_items[:]
        })
    
    # Limpiar carrito antes del commit único
    cart.status = CartStatus.CONVERTED
    
    # Commit único al final
    db.commit()
    
    # Enviar notificaciones para cada orden creada
    for order_data in created_orders:
        order = order_data["order"]
        try:
            notify_order_placed(db, order)   # Al comprador
            notify_order_received(db, order) # Al vendedor
        except Exception as e:
            # No fallar si las notificaciones fallan
            print(f"Error enviando notificación: {e}")
    
    # Preparar responses después del commit
    order_responses = []
    for order_data in created_orders:
        order = order_data["order"]
        order_items = order_data["order_items"]
        db.refresh(order)
        
        items_response = [
            OrderItemResponse(
                id=item.id,
                product_name_snapshot=item.product_name_snapshot,
                unit_price_snapshot=item.unit_price_snapshot,
                quantity=item.quantity,
                subtotal=item.unit_price_snapshot * item.quantity
            )
            for item in order_items
        ]
        
        order_responses.append(OrderResponse(
            id=order.id,
            order_number=order.order_number,
            status=order.status.value,
            subtotal=float(order.subtotal),
            shipping_cost=float(order.shipping_cost),
            total_amount=float(order.total_amount),
            items=items_response,
            created_at=order.created_at
        ))
    
    # Retornar la primera orden (o podrías retornar todas)
    return order_responses[0] if order_responses else None


def _get_transfer_groups(db: Session, current_user: User):
    cart = db.query(Cart).filter(
        Cart.user_id == current_user.id,
        Cart.status == CartStatus.ACTIVE,
    ).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío")

    groups = {}
    for item in cart.items:
        seller = item.product.seller
        if not seller.cbu and not seller.alias_bancario:
            raise HTTPException(
                status_code=400,
                detail=f"{seller.full_name} no configuró CBU ni alias bancario",
            )
        groups.setdefault(seller.id, {"seller": seller, "items": []})["items"].append(item)

    return cart, list(groups.values())


@router.get("/transfer-options", response_model=list[BankTransferOption])
def get_transfer_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Datos bancarios y monto por vendedor para el carrito activo."""
    _, groups = _get_transfer_groups(db, current_user)
    return [
        BankTransferOption(
            seller_id=group["seller"].id,
            seller_name=group["seller"].full_name,
            cbu=group["seller"].cbu,
            alias_bancario=group["seller"].alias_bancario,
            amount=sum(float(item.product.price) * item.quantity for item in group["items"]),
        )
        for group in groups
    ]


@router.post("/checkout/transfer", response_model=BankTransferCheckoutResponse)
def checkout_bank_transfer(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear una orden por vendedor, sin modificar el checkout de Mercado Pago."""
    cart, groups = _get_transfer_groups(db, current_user)

    # Antes de escribir nada: el destino tiene que existir en el padrón.
    destino = resolver_destino(db, checkout_data.shipping_locality_id)

    # Y las decisiones de traslado, TODAS, antes de la primera fila. Si una
    # falla no se crea ninguna orden ni se toca stock.
    elegidos = resolver_decisiones(
        db, destino, grupos_del_carrito(cart), checkout_data.shipping_decisions
    )

    # Mismo control que el checkout comun, y por el mismo motivo: antes de
    # que exista una sola fila.
    for group in groups:
        for item in group["items"]:
            validar_total(
                Decimal(str(item.product.price)) * item.quantity,
                f"El importe de «{item.product.name}»",
            )
        validar_total(
            sum((Decimal(str(i.product.price)) * i.quantity
                 for i in group["items"]), Decimal(0)),
            "El total de la orden",
        )

    created = []

    for group in groups:
        seller = group["seller"]
        items = group["items"]
        subtotal = sum(float(item.product.price) * item.quantity for item in items)
        order = Order(
            order_number=generate_order_number(),
            buyer_id=current_user.id,
            seller_id=seller.id,
            status=OrderStatus.AWAITING_TRANSFER_RECEIPT,
            subtotal=subtotal,
            shipping_cost=0,
            total_amount=subtotal,
            transfer_cbu=seller.cbu,
            transfer_alias_bancario=seller.alias_bancario,
            transfer_account_holder=seller.full_name,
            shipping_address_json={
                "address": checkout_data.shipping_address,
                "city": destino.name,
                "province": destino.province_name,
                "postal_code": checkout_data.shipping_postal_code,
                "locality_id": destino.id,
            },
            shipping_locality_id=destino.id,
            shipping_mode=(
                MODO_TRANSPORTISTA if elegidos[seller.id] else MODO_PROPIO
            ),
            carrier_id=elegidos[seller.id].id if elegidos[seller.id] else None,
            buyer_notes=checkout_data.notes,
        )
        db.add(order)
        db.flush()

        for cart_item in items:
            product = cart_item.product
            is_service = product.category.is_service if product.category else False
            if not is_service and (product.stock or 0) < cart_item.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {product.name}",
                )
            primary_image = next(
                (image.url for image in product.images if image.is_primary),
                None,
            )
            db.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name_snapshot=product.name,
                product_image_snapshot=primary_image,
                unit_price_snapshot=float(product.price),
                quantity=cart_item.quantity,
                total_price=float(product.price) * cart_item.quantity,
                **origen_de(product),
            ))

        created.append((order, seller))

    cart.status = CartStatus.CONVERTED
    db.commit()

    for order, _ in created:
        db.refresh(order)
        try:
            notify_order_placed(db, order)
            notify_order_received(db, order)
        except Exception as error:
            print(f"Error enviando notificación: {error}")

    return BankTransferCheckoutResponse(orders=[
        BankTransferOrderResponse(
            order_id=order.id,
            order_number=order.order_number,
            status=order.status.value,
            seller_id=seller.id,
            seller_name=order.transfer_account_holder,
            cbu=order.transfer_cbu,
            alias_bancario=order.transfer_alias_bancario,
            amount=float(order.total_amount),
        )
        for order, seller in created
    ])


@router.post("/{order_id}/transfer-receipt", response_model=BankTransferOrderResponse)
async def upload_transfer_receipt(
    order_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(
        (Order.id == order_id) | (Order.order_number == order_id)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para adjuntar este comprobante")
    if order.status != OrderStatus.AWAITING_TRANSFER_RECEIPT:
        raise HTTPException(status_code=400, detail="La orden no está esperando comprobante")

    extension = os.path.splitext(file.filename or "")[1].lower()
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de archivo no permitido: {extension}. Use: {', '.join(sorted(allowed_extensions))}",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El comprobante está vacío")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Archivo {file.filename} excede el tamaño máximo de 5MB")

    order.transfer_receipt_url = await get_storage().upload(
        file=BytesIO(content),
        filename=file.filename,
        folder="transfer_receipts",
        content_type=file.content_type,
    )
    order.status = OrderStatus.TRANSFER_RECEIPT_SUBMITTED
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)

    return BankTransferOrderResponse(
        order_id=order.id,
        order_number=order.order_number,
        status=order.status.value,
        seller_id=order.seller.id,
        seller_name=order.transfer_account_holder,
        cbu=order.transfer_cbu,
        alias_bancario=order.transfer_alias_bancario,
        amount=float(order.total_amount),
        transfer_receipt_url=order.transfer_receipt_url,
    )


@router.patch("/{order_id}/transfer-receipt", response_model=BankTransferOrderResponse)
def decide_transfer_receipt(
    order_id: str,
    decision_data: BankTransferDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Bloqueo de fila: dos decisiones simultáneas sobre la misma orden se
    # serializan, así el stock nunca se descuenta dos veces.
    order = db.query(Order).filter(
        (Order.id == order_id) | (Order.order_number == order_id)
    ).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para validar este comprobante")
    # El vendedor decide aunque el comprador no haya adjuntado nada: es él quien
    # ve la acreditación en su cuenta bancaria.
    if order.status not in (
        OrderStatus.AWAITING_TRANSFER_RECEIPT,
        OrderStatus.TRANSFER_RECEIPT_SUBMITTED,
    ):
        raise HTTPException(status_code=400, detail="La orden no tiene una transferencia pendiente de decisión")

    if decision_data.decision == "reject":
        reason = (decision_data.reason or "").strip()
        if not reason:
            raise HTTPException(status_code=400, detail="El motivo de rechazo es obligatorio")
        order.status = OrderStatus.REJECTED
        order.cancellation_reason = reason
    else:
        for item in order.items:
            product = item.product
            is_service = product.category.is_service if product and product.category else False
            if product and not is_service and (product.stock or 0) < item.quantity:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para {product.name}")
        for item in order.items:
            product = item.product
            is_service = product.category.is_service if product and product.category else False
            if product and not is_service:
                product.stock = (product.stock or 0) - item.quantity
                product.sales_count = (product.sales_count or 0) + item.quantity
        order.status = OrderStatus.PAID
        order.cancellation_reason = None

    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return BankTransferOrderResponse(
        order_id=order.id,
        order_number=order.order_number,
        status=order.status.value,
        seller_id=order.seller.id,
        seller_name=order.transfer_account_holder,
        cbu=order.transfer_cbu,
        alias_bancario=order.transfer_alias_bancario,
        amount=float(order.total_amount),
        transfer_receipt_url=order.transfer_receipt_url,
    )


def origen_de(product) -> dict:
    """El origen oficial de una publicación, congelado para la orden.

    Se guarda el id y también el texto: el id conserva la relación con el
    padrón y el texto deja la operación legible aunque el padrón cambie.
    Sin localidad oficial no se inventa nada: quedan los tres en None.
    """
    localidad = product.locality if product.locality_id else None
    if localidad is None:
        return {
            "origin_locality_id": None,
            "origin_locality_name": None,
            "origin_province_name": None,
        }
    return {
        "origin_locality_id": localidad.id,
        "origin_locality_name": localidad.name,
        "origin_province_name": localidad.province_name,
    }


def traslado_de(order: Order) -> OrderShipping:
    """El traslado de una orden, para comprador y vendedor.

    Sin modo es una orden anterior a la logística: queda «no definido» y no
    se convierte en cuenta propia. Con transportista se devuelve su
    contacto, que es el punto de haberlo elegido; sigue apareciendo aunque
    su perfil haya quedado incompleto o inactivo después, porque la
    asignación ya ocurrió.
    """
    if order.shipping_mode != MODO_TRANSPORTISTA or order.carrier is None:
        return OrderShipping(mode=order.shipping_mode)

    carrier = order.carrier
    base = carrier.carrier_base_locality
    return OrderShipping(
        mode=MODO_TRANSPORTISTA,
        carrier_name=carrier.full_name,
        carrier_base=(
            f"{base.name}, {base.province_name}" if base is not None else None
        ),
        carrier_transport=carrier.carrier_transport,
        carrier_capacity=carrier.carrier_capacity,
        carrier_certification_detail=carrier.carrier_certification_detail,
        carrier_certification_declared_at=carrier.carrier_certification_declared_at,
        carrier_email=carrier.email,
        carrier_phone=carrier.phone,
        carrier_whatsapp=carrier.whatsapp,
    )


@router.get("/my", response_model=list[OrderResponse])
def get_my_orders(
    as_role: str = "buyer",  # "buyer" o "seller"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener órdenes del usuario.
    as_role=buyer: órdenes como comprador
    as_role=seller: órdenes como vendedor
    """
    if as_role == "seller":
        orders = db.query(Order).filter(
            Order.seller_id == current_user.id
        ).order_by(Order.created_at.desc()).all()
    else:
        orders = db.query(Order).filter(
            Order.buyer_id == current_user.id
        ).order_by(Order.created_at.desc()).all()
    
    result = []
    for order in orders:
        items_response = [
            OrderItemResponse(
                id=item.id,
                product_name_snapshot=item.product_name_snapshot,
                unit_price_snapshot=item.unit_price_snapshot,
                quantity=item.quantity,
                subtotal=item.unit_price_snapshot * item.quantity,
                product_image_snapshot=item.product_image_snapshot
            )
            for item in order.items
        ]
        
        # Preparar información del buyer/seller según el rol
        buyer_name = None
        buyer_phone = None
        buyer_address = None
        seller_name = None
        seller_phone = None
        seller_whatsapp = None
        
        if as_role == "seller" and order.buyer:
            # El vendedor ve datos del comprador
            buyer_name = order.buyer.full_name
            buyer_phone = order.buyer.phone
            # Extraer dirección del shipping_address_json
            if order.shipping_address_json:
                addr = order.shipping_address_json
                buyer_address = f"{addr.get('address', '')}, {addr.get('city', '')}, {addr.get('province', '')}"
        
        if as_role == "buyer" and order.seller:
            # El comprador ve datos del vendedor
            seller_name = order.seller.full_name
            seller_phone = order.seller.phone
            seller_whatsapp = order.seller.whatsapp or order.seller.phone
        
        result.append(OrderResponse(
            id=order.id,
            order_number=order.order_number,
            status=order.status.value,
            subtotal=float(order.subtotal),
            shipping_cost=float(order.shipping_cost),
            total_amount=float(order.total_amount),
            items=items_response,
            created_at=order.created_at,
            buyer_name=buyer_name,
            buyer_phone=buyer_phone,
            buyer_address=buyer_address,
            seller_name=seller_name,
            seller_phone=seller_phone,
            seller_whatsapp=seller_whatsapp,
            seller_cbu=order.transfer_cbu,
            seller_alias_bancario=order.transfer_alias_bancario,
            seller_bank_holder=order.transfer_account_holder,
            transfer_receipt_url=order.transfer_receipt_url,
            rejection_reason=order.cancellation_reason,
            shipping=traslado_de(order),
        ))
    
    return result


@router.get("/{order_id}", response_model=OrderResponse)
def get_order_detail(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle de una orden específica"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Verificar permisos
    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta orden")
    
    items_response = [
        OrderItemResponse(
            id=item.id,
            product_name_snapshot=item.product_name_snapshot,
            unit_price_snapshot=item.unit_price_snapshot,
            quantity=item.quantity,
            subtotal=item.unit_price_snapshot * item.quantity
        )
        for item in order.items
    ]
    
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status.value,
        subtotal=float(order.subtotal),
        shipping_cost=float(order.shipping_cost),
        total_amount=float(order.total_amount),
        items=items_response,
        created_at=order.created_at,
        seller_cbu=order.transfer_cbu,
        seller_alias_bancario=order.transfer_alias_bancario,
        seller_bank_holder=order.transfer_account_holder,
        transfer_receipt_url=order.transfer_receipt_url,
        rejection_reason=order.cancellation_reason,
        shipping=traslado_de(order),
    )


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: str,
    status_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Actualizar estado de una orden.
    
    Transiciones permitidas:
    - Vendedor: PLACED -> CONFIRMED, CONFIRMED -> SHIPPED, PLACED -> REJECTED
    - Comprador: SHIPPED -> DELIVERED, PLACED -> CANCELLED
    """
    # Buscar por UUID o por order_number
    order = db.query(Order).filter(
        (Order.id == order_id) | (Order.order_number == order_id)
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    new_status_str = status_data.get("status")
    if not new_status_str:
        raise HTTPException(status_code=400, detail="Estado requerido")
    
    try:
        new_status = OrderStatus(new_status_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Estado inválido: {new_status_str}")
    
    # Validar permisos y transiciones según rol
    is_seller = order.seller_id == current_user.id
    is_buyer = order.buyer_id == current_user.id
    
    if not is_seller and not is_buyer:
        raise HTTPException(status_code=403, detail="No tienes permiso para modificar esta orden")
    
    current_status = order.status
    
    # Transiciones permitidas para vendedor
    seller_transitions = {
        OrderStatus.PLACED: [OrderStatus.CONFIRMED, OrderStatus.REJECTED],
        OrderStatus.CONFIRMED: [OrderStatus.SHIPPED],
        OrderStatus.PAID: [OrderStatus.CONFIRMED, OrderStatus.SHIPPED],
    }
    
    # Transiciones permitidas para comprador
    buyer_transitions = {
        OrderStatus.PLACED: [OrderStatus.CANCELLED],
        OrderStatus.SHIPPED: [OrderStatus.DELIVERED],
    }
    
    allowed_transitions = []
    if is_seller:
        allowed_transitions = seller_transitions.get(current_status, [])
    if is_buyer:
        allowed_transitions = buyer_transitions.get(current_status, [])
    
    if new_status not in allowed_transitions:
        raise HTTPException(
            status_code=400, 
            detail=f"No puedes cambiar de {current_status.value} a {new_status.value}"
        )
    
    # Actualizar estado
    order.status = new_status
    order.updated_at = datetime.now()
    
    # Actualizar timestamps específicos
    if new_status == OrderStatus.CONFIRMED:
        order.confirmed_at = datetime.now()
    elif new_status == OrderStatus.SHIPPED:
        order.shipped_at = datetime.now()
    elif new_status == OrderStatus.DELIVERED:
        order.delivered_at = datetime.now()
    elif new_status in [OrderStatus.CANCELLED, OrderStatus.REJECTED]:
        order.cancellation_reason = status_data.get("reason", "")
        # Restaurar stock si se cancela (solo si fue pagada/confirmada y solo para productos)
        if old_status in [OrderStatus.PAID, OrderStatus.CONFIRMED]:
            for item in order.items:
                product = item.product
                is_service = product.category.is_service if product and product.category else False
                if product and not is_service:
                    product.stock = (product.stock or 0) + item.quantity
                    product.sales_count = max(0, (product.sales_count or 0) - item.quantity)
                    print(f"📦 Stock restaurado para {product.name}: +{item.quantity}")
        
        # Procesar reembolso si la orden fue pagada
        if old_status in [OrderStatus.PAID, OrderStatus.CONFIRMED]:
            try:
                process_refund = get_refund_processor()
                
                # Siempre reembolso TOTAL (100%) sin importar quién cancela
                refund_result = process_refund(db, order, full_refund=True)
                print(f"🔄 Reembolso TOTAL procesado")
                
                if refund_result["success"]:
                    print(f"✅ Reembolso procesado: {refund_result}")
                else:
                    print(f"⚠️ No se pudo reembolsar: {refund_result['message']}")
            except Exception as e:
                print(f"❌ Error en reembolso: {e}")
    
    db.commit()
    
    # Enviar notificaciones según el nuevo estado
    try:
        if new_status == OrderStatus.CONFIRMED:
            notify_order_confirmed(db, order)
        elif new_status == OrderStatus.SHIPPED:
            notify_order_shipped(db, order)
        elif new_status == OrderStatus.DELIVERED:
            notify_order_delivered(db, order)
        elif new_status == OrderStatus.CANCELLED:
            notify_order_cancelled(db, order, cancelled_by_buyer=is_buyer)
        elif new_status == OrderStatus.REJECTED:
            notify_order_cancelled(db, order, cancelled_by_buyer=False)
    except Exception as e:
        print(f"Error enviando notificación: {e}")
    
    return {
        "message": f"Orden actualizada a {new_status.value}",
        "order_id": str(order.id),
        "new_status": new_status.value
    }


@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: str,
    cancel_data: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancelar una orden (comprador o vendedor según el estado)"""
    # Buscar por UUID o por order_number, con bloqueo de fila para que dos
    # cancelaciones simultáneas no dejen estados incompatibles.
    order = db.query(Order).filter(
        (Order.id == order_id) | (Order.order_number == order_id)
    ).with_for_update().first()

    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    is_seller = order.seller_id == current_user.id
    is_buyer = order.buyer_id == current_user.id

    if not is_seller and not is_buyer:
        raise HTTPException(status_code=403, detail="No tienes permiso")

    if order.status in (OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PAID):
        pass
    elif order.status == OrderStatus.AWAITING_TRANSFER_RECEIPT:
        # Nadie transfirió todavía: cualquiera de los dos puede abandonar.
        pass
    elif order.status == OrderStatus.TRANSFER_RECEIPT_SUBMITTED:
        # El comprador ya declaró haber pagado. Sólo el vendedor, que es quien
        # ve su cuenta bancaria, decide si esa orden se cae.
        if not is_seller:
            raise HTTPException(
                status_code=400,
                detail="El comprobante ya fue enviado: sólo el vendedor puede cancelar esta orden",
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden cancelar órdenes pendientes, pagadas o confirmadas"
        )

    # Restaurar stock SOLO si la orden ya fue pagada (el stock se descontó al aprobar el pago)
    # Solo para productos, no servicios
    if order.status in [OrderStatus.PAID, OrderStatus.CONFIRMED]:
        for item in order.items:
            product = item.product
            is_service = product.category.is_service if product and product.category else False
            if product and not is_service:
                product.stock = (product.stock or 0) + item.quantity
                product.sales_count = max(0, (product.sales_count or 0) - item.quantity)
                print(f"📦 Stock restaurado para {product.name}: +{item.quantity}")
    
    # Guardar el estado previo para el reembolso
    previous_status = order.status
    order.status = OrderStatus.CANCELLED if is_buyer else OrderStatus.REJECTED
    order.cancellation_reason = cancel_data.get("reason", "") if cancel_data else ""
    order.updated_at = datetime.now()
    
    db.commit()
    
    # Procesar reembolso si la orden estaba pagada.
    # Las órdenes por transferencia bancaria quedan afuera: el dinero fue de
    # cuenta a cuenta y TopGreen no lo administra, así que no hay nada que
    # devolver desde acá. Cualquier reintegro lo arreglan comprador y vendedor.
    es_transferencia = bool(order.transfer_cbu or order.transfer_alias_bancario)
    refund_result = None
    if not es_transferencia and order.status in [OrderStatus.CANCELLED, OrderStatus.REJECTED]:
        try:
            process_refund = get_refund_processor()
            # Siempre reembolso TOTAL (100%) sin importar quién cancela
            print(f"🔄 Procesando reembolso TOTAL (100%)")
            refund_result = process_refund(db, order, full_refund=True)
            if refund_result:
                print(f"✅ Reembolso procesado: {refund_result}")
            else:
                print(f"⚠️ No se pudo procesar reembolso (puede que no haya pago)")
        except Exception as e:
            print(f"❌ Error al procesar reembolso: {e}")
            import traceback
            traceback.print_exc()
    
    # Enviar notificación de cancelación
    try:
        notify_order_cancelled(db, order, cancelled_by_buyer=is_buyer)
    except Exception as e:
        print(f"Error enviando notificación: {e}")
    
    return {"message": "Orden cancelada", "order_id": str(order.id), "refund": refund_result}
