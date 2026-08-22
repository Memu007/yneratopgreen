"""
Modelo de Usuario - Sistema de autenticación y perfiles
"""
from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, JSON, Numeric, String, Text, false
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class UserRole(str, enum.Enum):
    """Roles de usuario en el sistema"""
    ADMIN = "admin"
    USER = "user"  # Usuario normal (puede comprar y vender)


class User(Base):
    __tablename__ = "users"

    # Identificación
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    whatsapp = Column(String(50), nullable=True)
    
    # Autenticación
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Perfil adicional
    avatar_url = Column(String(500), nullable=True)
    bio = Column(String(500), nullable=True)
    location = Column(String(255), nullable=True)
    cbu = Column(String(64), nullable=True)
    alias_bancario = Column(String(100), nullable=True)

    # Perfil de transportista (un tipo especial de proveedor, no un rol).
    is_carrier = Column(Boolean, default=False, server_default=false(), nullable=False)
    carrier_base_locality_id = Column(
        String(20),
        ForeignKey("localities.id"),
        nullable=True,
        index=True,
    )
    carrier_transport = Column(String(255), nullable=True)

    # Los tres datos que antes viajaban mezclados adentro de `carrier_transport`
    # o directamente no existían. Los tres son OPCIONALES: un perfil que ya
    # estaba cargado sigue siendo válido sin completar ninguno.
    #
    # `carrier_vehicle_model` es público: sirve para comparar antes de elegir.
    carrier_vehicle_model = Column(String(120), nullable=True)
    # `carrier_plate` es PRIVADO. No sale en el directorio, ni en la respuesta
    # de candidatos, ni en el catálogo: aparece junto con el contacto y recién
    # después de que el comprador seleccionó a este transportista. Lo que lo
    # mantiene afuera no es un cuidado al escribir cada respuesta, es que el
    # esquema de candidato no lo tiene.
    carrier_plate = Column(String(20), nullable=True)
    # Qué declara transportar. Es una DECLARACIÓN y no un filtro: no decide
    # quién aparece en una búsqueda ni en qué orden. Se guardan las claves del
    # catálogo cerrado —no las etiquetas— para que un cambio de redacción no
    # tenga que reescribir filas.
    # `none_as_null` no es un detalle: sin él, «no declaró nada» se guarda como
    # el `null` de JSON, que en SQL **no es NULL**. Una consulta que preguntara
    # `IS NULL` no encontraría a nadie y el que la escribió no se enteraría.
    carrier_cargo_types = Column(JSON(none_as_null=True), nullable=True)
    # El detalle de «Otra», que sólo tiene sentido mientras «otra» esté entre
    # las declaradas.
    carrier_cargo_other = Column(String(120), nullable=True)

    carrier_transport_certified = Column(
        Boolean,
        default=False,
        server_default=false(),
        nullable=False,
    )
    # La habilitación es una DECLARACIÓN del transportista, no una
    # verificación de TopGreen: el detalle lo escribe él y la fecha la pone el
    # servidor cuando la declara o la cambia.
    carrier_certification_detail = Column(String(500), nullable=True)
    carrier_certification_declared_at = Column(DateTime, nullable=True)
    carrier_coverage_radius_km = Column(Numeric(10, 2), nullable=True)
    carrier_capacity = Column(String(255), nullable=True)
    
    # Reputación y estadísticas
    rating_average = Column(Numeric(3, 2), default=0.0, nullable=False)  # Promedio de calificaciones (0 = sin calificaciones)
    rating_count = Column(Integer, default=0, nullable=False)  # Cantidad de calificaciones recibidas
    sales_count = Column(Integer, default=0, nullable=False)  # Ventas completadas
    purchases_count = Column(Integer, default=0, nullable=False)  # Compras completadas
    
    # Mercado Pago - Vinculación de cuenta de vendedor (OAuth)
    # Las credenciales son del vendedor, no nuestras: se guardan cifradas
    # (app/core/cifrado.py) y no hay forma de leerlas sin la clave, que vive
    # fuera del repositorio. Nada de esto sale nunca en una respuesta.
    mp_user_id = Column(String(50), nullable=True, unique=True)  # Cuenta de MP vinculada
    mp_access_token_cifrado = Column(Text, nullable=True)  # Token de cobro, cifrado
    mp_refresh_token_cifrado = Column(Text, nullable=True)  # Token de renovación, cifrado
    mp_token_expires_at = Column(DateTime, nullable=True)  # Expiración del access_token
    mp_linked_at = Column(DateTime, nullable=True)  # Fecha de vinculación de cuenta MP
    # Se enciende cuando Mercado Pago rechaza las credenciales o cuando lo
    # guardado dejó de abrir. El vendedor ve «reconectar» y puede resolverlo
    # solo; el sistema no vuelve a intentar con algo que ya sabe que no sirve.
    mp_requiere_reconexion = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Relaciones
    products = relationship("Product", back_populates="seller", cascade="all, delete-orphan")
    carts = relationship("Cart", back_populates="user", cascade="all, delete-orphan")
    orders_as_buyer = relationship("Order", foreign_keys="Order.buyer_id", back_populates="buyer")
    orders_as_seller = relationship("Order", foreign_keys="Order.seller_id", back_populates="seller")
    audit_logs = relationship("AuditLog", back_populates="user")
    carrier_base_locality = relationship("Locality")
    documentacion = relationship(
        "DocumentacionDeVendedor",
        foreign_keys="DocumentacionDeVendedor.user_id",
        back_populates="usuario",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # La API devuelve el identificador de la localidad base, que no se puede
    # mostrar en pantalla. Estos tres derivados vienen del padrón por la
    # relación de arriba: son de sólo lectura y no agregan columnas.
    @property
    def carrier_base_locality_name(self):
        return self.carrier_base_locality.name if self.carrier_base_locality else None

    @property
    def carrier_base_province_id(self):
        return self.carrier_base_locality.province_id if self.carrier_base_locality else None

    @property
    def carrier_base_province_name(self):
        return self.carrier_base_locality.province_name if self.carrier_base_locality else None

    # Lo único de la revisión documental que sale a una respuesta pública. Es
    # un derivado del estado actual —no una columna— para que retirar el
    # distintivo al reemplazar la documentación no dependa de acordarse de
    # apagar una marca en otro lado.
    @property
    def documentacion_revisada(self) -> bool:
        from app.models.documentacion import EstadoDeDocumentacion

        documentacion = self.documentacion
        return bool(
            documentacion
            and documentacion.estado == EstadoDeDocumentacion.APROBADA
        )

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
