"""
Modelos de base de datos - TopGreen Marketplace
Importar todos los modelos aquí para que Alembic los detecte
"""
from app.models.user import User, UserRole
from app.models.email_verification import EmailVerificationToken
from app.models.category import Category
from app.models.subcategory import Subcategory
from app.models.locality import Locality
from app.models.product import Product, ProductStatus
from app.models.product_image import ProductImage
from app.models.cart import Cart, CartItem, CartStatus
from app.models.order import Order, OrderItem, OrderStatus
from app.models.audit import AuditLog
from app.models.contact import ContactMessage
from app.models.payment import Payment, PaymentStatus
from app.models.form_option import FormOption, OptionType
from app.models.rating import Rating
from app.models.notification import Notification, NotificationType
from app.models.mp_oauth_state import MPOAuthState
from app.models.mp_intento import MPIntentoDePago
from app.models.documentacion import DocumentacionDeVendedor, EstadoDeDocumentacion

__all__ = [
    "User",
    "UserRole",
    "EmailVerificationToken",
    "Category",
    "Subcategory",
    "Locality",
    "Product",
    "ProductStatus",
    "ProductImage",
    "Cart",
    "CartItem",
    "CartStatus",
    "Order",
    "OrderItem",
    "OrderStatus",
    "AuditLog",
    "ContactMessage",
    "Payment",
    "PaymentStatus",
    "FormOption",
    "OptionType",
    "Rating",
    "Notification",
    "NotificationType",
    "MPOAuthState",
    "MPIntentoDePago",
    "DocumentacionDeVendedor",
    "EstadoDeDocumentacion",
]

