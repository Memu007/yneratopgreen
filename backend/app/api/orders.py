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
from app.core.montos import SIN_CARGO, importe_de_linea, validar_total
from app.models.user import User
from app.schemas.logistics import OrderShipping
from app.schemas.orders import (
    CheckoutResponse,
    OpcionDePago,
    OrdenCreada,
    BankTransferDecisionRequest,
    BankTransferOrderResponse,
    CheckoutRequest,
    OrderItemResponse,
    OrderResponse,
)
from app.services import mp_preferencia
from app.services.checkout import (
    LISTA,
    MEDIO_MERCADO_PAGO,
    MEDIO_TRANSFERENCIA,
    PENDIENTE_DE_PAGO,
    crear_ordenes,
    es_pagable,
    medios_disponibles,
    motivo_sin_medios,
)
from app.services.checkout import generate_order_number
from app.services.checkout import preparar as preparar_checkout
from app.services.logistica import (
    MODO_PROPIO,
    origen_de,
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

router = APIRouter(prefix="/orders", tags=["orders"])


def _respuesta_de(orden, vendedor, pago=None, motivo=None) -> OrdenCreada:
    """Una orden creada, como la ve el comprador. Sin recalcular nada."""
    es_mp = orden.payment_method == MEDIO_MERCADO_PAGO and es_pagable(orden)
    listo = bool(pago and pago.init_point) if es_mp else True
    return OrdenCreada(
        order_id=orden.id,
        order_number=orden.order_number,
        status=orden.status.value,
        seller_id=orden.seller_id,
        seller_name=vendedor.full_name,
        payment_method=orden.payment_method,
        amount=orden.total_amount,
        preparation=LISTA if listo else PENDIENTE_DE_PAGO,
        reason=motivo,
        cbu=orden.transfer_cbu,
        alias_bancario=orden.transfer_alias_bancario,
        transfer_receipt_url=orden.transfer_receipt_url,
        payment_url=pago.init_point if (es_mp and pago) else None,
    )


def _avisar(db: Session, ordenes) -> None:
    """Los avisos no pueden voltear una compra ya escrita."""
    for orden in ordenes:
        try:
            notify_order_placed(db, orden)
            notify_order_received(db, orden)
        except Exception as error:  # noqa: BLE001
            print(f"Error enviando notificación: {error}")


async def _preparar_pagos(db: Session, ordenes, pedidos) -> list:
    """Deja lista una preferencia por cada orden que se paga con Mercado Pago.

    Las órdenes ya están escritas y son válidas. Si Mercado Pago no contesta,
    esa orden queda «pendiente» con su motivo y se puede reintentar sin crear
    otra: lo que no se hace es borrarla ni cambiarle el medio por atrás.
    """
    por_vendedor = {pedido.seller_id: pedido for pedido in pedidos}
    salida = []
    for orden in ordenes:
        pedido = por_vendedor[orden.seller_id]
        if pedido.medio != MEDIO_MERCADO_PAGO:
            salida.append(_respuesta_de(orden, pedido.seller))
            continue
        try:
            pago = await mp_preferencia.preparar_pago(db, orden, pedido.seller)
            salida.append(_respuesta_de(orden, pedido.seller, pago=pago))
        except mp_preferencia.NoSePudoPreparar as fallo:
            salida.append(_respuesta_de(orden, pedido.seller, motivo=fallo.motivo))
    return salida


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Convierte el carrito en órdenes: una por vendedor.

    Devuelve **todas**. Antes creaba una por vendedor y devolvía sólo la
    primera, así que un carrito de dos vendedores dejaba una orden escrita que
    el comprador no veía y no podía pagar.

    Se valida el carrito entero antes de la primera fila —destino, traslado,
    medio de pago, vínculo del vendedor, precios, cantidades, totales y
    stock—. Si algo no cierra, no se crea ninguna orden y el carrito queda
    activo.
    """
    cart, destino, pedidos = preparar_checkout(db, current_user, checkout_data)
    ordenes = crear_ordenes(db, current_user, cart, destino, pedidos, checkout_data)
    _avisar(db, ordenes)
    return CheckoutResponse(orders=await _preparar_pagos(db, ordenes, pedidos))


@router.post("/{order_id}/payment-link", response_model=OrdenCreada)
async def preparar_link_de_pago(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deja lista —o vuelve a devolver— la preferencia de una orden.

    Es el reintento de `preparation: "pendiente"`. Es idempotente: si la orden
    ya tiene su link, devuelve ese. Nunca crea otra orden ni otra intención de
    pago.
    """
    orden = db.query(Order).filter(
        Order.id == order_id, Order.buyer_id == current_user.id
    ).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if orden.payment_method != MEDIO_MERCADO_PAGO:
        raise HTTPException(
            status_code=400, detail="Esta orden no se paga con Mercado Pago"
        )
    # Y que la orden todavía admita un pago. Comprobar dueño y medio pero no
    # estado dejaba una puerta abierta: una orden cancelada o rechazada volvía
    # a entregar su preferencia, y si no la tenía, la creaba.
    if not es_pagable(orden):
        raise HTTPException(
            status_code=409,
            detail=f"Esta orden está {orden.status.value} y ya no se puede pagar.",
        )

    vendedor = db.query(User).filter(User.id == orden.seller_id).first()
    try:
        pago = await mp_preferencia.preparar_pago(db, orden, vendedor)
    except mp_preferencia.NoSePudoPreparar as fallo:
        return _respuesta_de(orden, vendedor, motivo=fallo.motivo)
    return _respuesta_de(orden, vendedor, pago=pago)


@router.get("/payment-options", response_model=list[OpcionDePago])
def opciones_de_pago(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Con qué se puede pagar cada grupo del carrito, y cuánto.

    Un carrito de dos vendedores se paga en dos pagos, y cada vendedor tiene
    los medios que tiene: uno puede cobrar por Mercado Pago y el otro sólo por
    transferencia. Esto es lo que la pantalla necesita para pedir una decisión
    por grupo, en vez de suponer una sola para todo el carrito.

    Un vendedor sin ningún medio ya no voltea la consulta entera con un 400:
    viene con `methods` vacío y su motivo. Antes, un solo vendedor sin CBU
    dejaba al comprador sin ver los datos de los otros, y con Mercado Pago en
    el medio eso además sería falso: no tener CBU dejó de significar no poder
    cobrar.
    """
    cart = carrito_activo(db, current_user)

    opciones = []
    for seller_id, grupo in grupos_del_carrito(cart).items():
        medios = medios_disponibles(grupo.vendedor)
        hay_transferencia = MEDIO_TRANSFERENCIA in medios
        opciones.append(OpcionDePago(
            seller_id=seller_id,
            seller_name=grupo.vendedor.full_name,
            amount=sum(
                (importe_de_linea(item.product.price, item.quantity)
                 for item in grupo.items),
                Decimal(0),
            ),
            methods=medios,
            reason=None if medios else motivo_sin_medios(grupo.vendedor),
            cbu=grupo.vendedor.cbu if hay_transferencia else None,
            alias_bancario=(
                grupo.vendedor.alias_bancario if hay_transferencia else None
            ),
        ))
    return opciones


@router.post("/checkout/transfer", response_model=CheckoutResponse)
def checkout_bank_transfer(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El mismo checkout, con el medio puesto: todo por transferencia.

    No tiene reglas propias. Antes tenía su copia de los totales, el stock, los
    snapshots y la logística; dos copias de la misma regla son dos reglas que
    se van a separar, y la que se olvide va a ser la que toque plata.
    """
    cart, destino, pedidos = preparar_checkout(
        db, current_user, checkout_data, medio_unico=MEDIO_TRANSFERENCIA
    )
    ordenes = crear_ordenes(db, current_user, cart, destino, pedidos, checkout_data)
    _avisar(db, ordenes)

    por_vendedor = {pedido.seller_id: pedido.seller for pedido in pedidos}
    return CheckoutResponse(orders=[
        _respuesta_de(orden, por_vendedor[orden.seller_id]) for orden in ordenes
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
        amount=order.total_amount,
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
        amount=order.total_amount,
        transfer_receipt_url=order.transfer_receipt_url,
    )


def _pago_del_comprador(db: Session, order: Order) -> dict:
    """Lo que el comprador necesita para terminar de pagar su orden.

    Sólo para él, sólo por Mercado Pago y sólo mientras la orden se pueda
    pagar. Al vendedor y al transportista no les toca: no es información suya y
    pagar no es su acción.
    """
    if order.payment_method != MEDIO_MERCADO_PAGO or not es_pagable(order):
        return {"payment_url": None, "can_pay": False}

    pago = mp_preferencia.pago_de(db, order)
    return {"payment_url": pago.init_point if pago else None, "can_pay": True}


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
            subtotal=order.subtotal,
            shipping_cost=order.shipping_cost,
            total_amount=order.total_amount,
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
            payment_method=order.payment_method,
            **(_pago_del_comprador(db, order) if as_role != "seller"
               else {"payment_url": None, "can_pay": False}),
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
        subtotal=order.subtotal,
        shipping_cost=order.shipping_cost,
        total_amount=order.total_amount,
        items=items_response,
        created_at=order.created_at,
        seller_cbu=order.transfer_cbu,
        seller_alias_bancario=order.transfer_alias_bancario,
        seller_bank_holder=order.transfer_account_holder,
        transfer_receipt_url=order.transfer_receipt_url,
        rejection_reason=order.cancellation_reason,
        shipping=traslado_de(order),
        payment_method=order.payment_method,
        **(_pago_del_comprador(db, order) if order.buyer_id == current_user.id
           else {"payment_url": None, "can_pay": False}),
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
        # La orden terminó: la intención de pago local deja de decir
        # «pendiente» sobre algo que ya no se va a cobrar.
        mp_preferencia.anular_intencion(db, order)
        # Restaurar stock si se cancela: sólo si el estado del que se viene
        # había descontado stock, y sólo para productos.
        #
        # Acá decía `old_status`, que no existe: el estado previo se guarda
        # como `current_status` más arriba. Cualquier cancelación o rechazo por
        # esta ruta terminaba en un 500 antes de escribir el motivo.
        #
        # Con las transiciones de hoy este bloque no llega a restaurar nada:
        # a terminal sólo se entra desde «colocada», y colocar no descuenta
        # stock. Queda escrito con el estado correcto para cuando exista un
        # estado que sí lo descuente.
        if current_status in [OrderStatus.PAID, OrderStatus.CONFIRMED]:
            for item in order.items:
                product = item.product
                is_service = product.category.is_service if product and product.category else False
                if product and not is_service:
                    product.stock = (product.stock or 0) + item.quantity
                    product.sales_count = max(0, (product.sales_count or 0) - item.quantity)
                    print(f"📦 Stock restaurado para {product.name}: +{item.quantity}")
        
        # Acá había una llamada de reembolso al módulo heredado de cobro. No
        # existe más: ese módulo devolvía dinero con el token del marketplace
        # cuando el del vendedor no estaba, y TopGreen no administra plata de
        # terceros. Hoy no hay ninguna orden pagada por la plataforma, así que
        # no hay nada que devolver; cuando exista el cobro confirmado (MP-C),
        # la devolución se diseña con su propia regla.
    
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
    
    order.status = OrderStatus.CANCELLED if is_buyer else OrderStatus.REJECTED
    order.cancellation_reason = cancel_data.get("reason", "") if cancel_data else ""
    order.updated_at = datetime.now()
    # Igual que en el cambio de estado: lo que ya no se puede pagar tampoco
    # sigue figurando como pago pendiente nuestro.
    mp_preferencia.anular_intencion(db, order)
    
    db.commit()
    
    # Cancelar no devuelve dinero, y ahora lo dice en vez de aparentarlo.
    #
    # Por transferencia el dinero fue de cuenta a cuenta y TopGreen no lo
    # administra: el reintegro lo arreglan comprador y vendedor. Por Mercado
    # Pago todavía no hay ningún pago confirmado —eso llega con el webhook—,
    # así que tampoco hay qué devolver. El camino que había acá llamaba al
    # módulo heredado, que reembolsaba con el token del marketplace cuando el
    # del vendedor faltaba; eso es exactamente administrar plata de terceros.
    
    # Enviar notificación de cancelación
    try:
        notify_order_cancelled(db, order, cancelled_by_buyer=is_buyer)
    except Exception as e:
        print(f"Error enviando notificación: {e}")
    
    return {"message": "Orden cancelada", "order_id": str(order.id)}
