"""La documentación fiscal que un vendedor presenta y la clienta revisa a mano.

Esto **no es una verificación de identidad**. Es una revisión manual: alguien
mira una constancia y decide. Por eso el distintivo público dice
«Documentación revisada» y no «Vendedor verificado»: lo segundo prometería
identidad comprobada, solvencia o ausencia de fraude, y nada de eso se
comprueba acá.

Tampoco bloquea nada. Un vendedor sin presentar, pendiente o rechazado publica,
vende, cobra y usa Mercado Pago exactamente igual. La única consecuencia de una
aprobación es que aparece el distintivo.

Una fila por usuario: la presentación se reemplaza, no se acumula. El archivo
anterior se borra del almacenamiento cuando entra uno nuevo, así que en disco
hay a lo sumo un PDF por vendedor. La ruta guardada es relativa a la carpeta
privada de documentos, que vive **fuera** del montaje público de subidas: el
PDF sólo sale por un endpoint que comprueba quién pregunta.
"""
from sqlalchemy import (
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.db.base import Base


class EstadoDeDocumentacion(str, enum.Enum):
    """Los tres estados que puede tener una presentación existente.

    El cuarto estado del producto —«sin presentación»— no es un valor: es la
    ausencia de fila. Guardar una fila vacía para representarlo obligaría a
    distinguir «nunca presentó» de «presentó y se borró», que es una diferencia
    que nadie necesita.
    """

    PENDIENTE = "pendiente"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"


class DocumentacionDeVendedor(Base):
    __tablename__ = "documentacion_de_vendedores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Única: una presentación por usuario. Reemplazar no crea otra fila.
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Los once dígitos, sin guiones. El formato se valida al presentar; que el
    # CUIT exista de verdad no se consulta a ningún organismo.
    cuit = Column(String(11), nullable=False)
    razon_social = Column(String(255), nullable=False)

    # Nombre original saneado, sólo para mostrárselo al titular y a quien
    # revisa. **No** es el nombre en disco: ese es aleatorio justamente para
    # que no se pueda adivinar.
    archivo_nombre = Column(String(255), nullable=False)
    archivo_ruta = Column(String(255), nullable=False)
    archivo_bytes = Column(Integer, nullable=False)

    estado = Column(
        SQLEnum(EstadoDeDocumentacion),
        nullable=False,
        default=EstadoDeDocumentacion.PENDIENTE,
        index=True,
    )

    # Motivo breve y accionable, obligatorio al rechazar. Lo ve el titular; por
    # eso no lleva notas internas ni identifica a quién decidió.
    motivo_de_rechazo = Column(String(500), nullable=True)

    # Quién decidió y cuándo. El titular no ve esto: sale sólo por la cola de
    # administración y queda además en la auditoría.
    revisado_por_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    revisado_el = Column(DateTime, nullable=True)

    presentado_el = Column(DateTime, default=datetime.utcnow, nullable=False)
    actualizado_el = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    usuario = relationship(
        "User", foreign_keys=[user_id], back_populates="documentacion"
    )
    revisado_por = relationship("User", foreign_keys=[revisado_por_id])

    def __repr__(self):
        return f"<DocumentacionDeVendedor {self.user_id} - {self.estado}>"
