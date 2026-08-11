"""
Schemas para órdenes de compra
"""
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
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
    seller_cbu: Optional[str] = None
    seller_alias_bancario: Optional[str] = None
    seller_bank_holder: Optional[str] = None
    transfer_receipt_url: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class CheckoutRequest(BaseModel):
    shipping_address: str
    # La localidad del padrón es el destino real: de ella salen la ciudad y la
    # provincia que se muestran, y sobre ella se calcula la compatibilidad de
    # fletes. La dirección exacta sigue siendo texto libre y no entra al
    # cálculo.
    shipping_locality_id: str = Field(..., min_length=1, max_length=20)
    shipping_postal_code: str
    notes: Optional[str] = None


class BankTransferOption(BaseModel):
    seller_id: str
    seller_name: str
    cbu: Optional[str] = None
    alias_bancario: Optional[str] = None
    amount: float


class BankTransferOrderResponse(BankTransferOption):
    order_id: str
    order_number: str
    status: str
    transfer_receipt_url: Optional[str] = None


class BankTransferCheckoutResponse(BaseModel):
    orders: List[BankTransferOrderResponse]


class BankTransferDecisionRequest(BaseModel):
    decision: Literal["approve", "reject"]
    reason: Optional[str] = Field(None, max_length=500)
