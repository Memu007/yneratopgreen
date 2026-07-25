"""
Schemas para carrito de compras
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime


class CartItemCreateRequest(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0)


class CartItemUpdateRequest(BaseModel):
    quantity: int = Field(..., gt=0)


class CartItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    product_price: float
    product_image: Optional[str]
    quantity: int
    subtotal: float
    
    model_config = ConfigDict(from_attributes=True)


class CartResponse(BaseModel):
    id: UUID
    items: List[CartItemResponse]
    total_items: int
    total_amount: float
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
