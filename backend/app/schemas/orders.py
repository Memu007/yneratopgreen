"""
Schemas para órdenes de compra
"""
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime


class OrderItemResponse(BaseModel):
    id: UUID
    product_name_snapshot: str
    unit_price_snapshot: float
    quantity: int
    subtotal: float
    product_image_snapshot: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: UUID
    order_number: str
    status: str
    subtotal: float
    shipping_cost: float
    total_amount: float
    items: List[OrderItemResponse]
    created_at: datetime
    # Información del comprador (para vendedor)
    buyer_name: Optional[str] = None
    buyer_phone: Optional[str] = None
    buyer_address: Optional[str] = None
    # Información del vendedor (para comprador)
    seller_name: Optional[str] = None
    seller_phone: Optional[str] = None
    seller_whatsapp: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class CheckoutRequest(BaseModel):
    shipping_address: str
    shipping_city: str
    shipping_province: str
    shipping_postal_code: str
    notes: Optional[str] = None
