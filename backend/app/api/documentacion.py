"""Documentación fiscal del vendedor: presentarla, revisarla y mostrar el sello.

Dos mitades con reglas distintas de acceso:

- `/documentacion/...` es del **titular**. Presenta, reemplaza, ve su estado y
  descarga lo suyo. Nunca ve quién revisó.
- `/admin/documentacion/...` es de **administración**. Ve la cola, abre
  cualquier PDF y decide.

Y una regla que atraviesa las dos: el PDF no tiene URL pública. Se sirve por un
endpoint que primero decide si esta persona puede verlo. El nombre en disco es
aleatorio para que ni siquiera adivinarlo sirva.

Nada de esto bloquea nada. Un vendedor sin presentar, pendiente o rechazado
publica, cobra y vende igual: la única consecuencia de una aprobación es el
distintivo «Documentación revisada».
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging

from app.core.config import settings
from app.db.base import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.audit import AuditLog
from app.models.documentacion import DocumentacionDeVendedor, EstadoDeDocumentacion
from app.models.user import User
from app.services import documentacion as servicio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documentacion", tags=["documentacion"])
router_admin = APIRouter(prefix="/admin/documentacion", tags=["documentacion"])

# El cuarto estado del producto, el que no tiene fila.
SIN_PRESENTACION = "sin_presentacion"


# ==============================================================================
# Respuestas
# ==============================================================================

class MiDocumentacion(BaseModel):
    """Lo que ve el titular. Sin identidad de quien revisó: la decisión es de
    TopGreen como plataforma, no de una persona a la que reclamarle."""

    estado: str
    cuit: Optional[str] = None
    razon_social: Optional[str] = None
    archivo_nombre: Optional[str] = None
    motivo_de_rechazo: Optional[str] = None
    presentado_el: Optional[datetime] = None
    revisado_el: Optional[datetime] = None


class DocumentacionEnCola(BaseModel):
    """Lo que ve administración: agrega a quién pertenece y quién decidió."""

    id: str
    user_id: str
    user_nombre: str
    user_email: str
    estado: str
    cuit: str
    razon_social: str
    archivo_nombre: str
    archivo_bytes: int
    motivo_de_rechazo: Optional[str] = None
    revisado_por_nombre: Optional[str] = None
    revisado_el: Optional[datetime] = None
    presentado_el: datetime


class ColaDeDocumentacion(BaseModel):
    items: List[DocumentacionEnCola]
    total: int
    pendientes: int


class Decision(BaseModel):
    decision: str = Field(..., description="aprobada o rechazada")
    motivo: Optional[str] = Field(None, max_length=500)
    # Cuál presentación se revisó. Es obligatorio y no una comodidad: la fila
    # sobrevive al reemplazo, así que sin esto una decisión tomada mirando un
    # PDF puede caer sobre otro que lo reemplazó mientras tanto. Se copia tal
    # cual lo devuelve la cola.
    presentado_el: datetime = Field(
        ..., description="El presentado_el de la presentación que se revisó"
    )


def _mia(documentacion: Optional[DocumentacionDeVendedor]) -> MiDocumentacion:
    if documentacion is None:
        return MiDocumentacion(estado=SIN_PRESENTACION)
    return MiDocumentacion(
        estado=documentacion.estado.value,
        cuit=servicio.formatear_cuit(documentacion.cuit),
        razon_social=documentacion.razon_social,
        archivo_nombre=documentacion.archivo_nombre,
        # El motivo sólo tiene sentido mientras el rechazo esté vigente. Si
        # volvió a presentar, mostrarlo confundiría un estado con el anterior.
        motivo_de_rechazo=(
            documentacion.motivo_de_rechazo
            if documentacion.estado == EstadoDeDocumentacion.RECHAZADA
            else None
        ),
        presentado_el=documentacion.presentado_el,
        revisado_el=documentacion.revisado_el,
    )


def _en_cola(documentacion: DocumentacionDeVendedor) -> DocumentacionEnCola:
    return DocumentacionEnCola(
        id=documentacion.id,
        user_id=documentacion.user_id,
        user_nombre=documentacion.usuario.full_name,
        user_email=documentacion.usuario.email,
        estado=documentacion.estado.value,
        cuit=servicio.formatear_cuit(documentacion.cuit),
        razon_social=documentacion.razon_social,
        archivo_nombre=documentacion.archivo_nombre,
        archivo_bytes=documentacion.archivo_bytes,
        motivo_de_rechazo=documentacion.motivo_de_rechazo,
        revisado_por_nombre=(
            documentacion.revisado_por.full_name
            if documentacion.revisado_por
            else None
        ),
        revisado_el=documentacion.revisado_el,
        presentado_el=documentacion.presentado_el,
    )


def _pdf(documentacion: DocumentacionDeVendedor) -> Response:
    """Devuelve el PDF con cabeceras que no lo dejan quedar en ningún cache.

    `Content-Disposition` lleva el nombre saneado; se sirve `inline` para que
    quien revisa lo mire sin bajarlo a su máquina.
    """
    try:
        ruta = servicio.ruta_de(documentacion.archivo_ruta)
        contenido = ruta.read_bytes()
    except (servicio.DocumentoInvalido, OSError) as error:
        logger.error(
            "No se pudo leer la constancia %s: %s", documentacion.id, error
        )
        raise HTTPException(
            status_code=404, detail="La constancia ya no está disponible"
        )

    return Response(
        content=contenido,
        media_type=servicio.TIPO_PDF,
        headers={
            "Content-Disposition": f'inline; filename="{documentacion.archivo_nombre}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


def _auditar(
    db: Session,
    actor: User,
    accion: str,
    documentacion: DocumentacionDeVendedor,
    datos: dict,
) -> None:
    """Deja la transición en la auditoría que ya existe.

    Nunca guarda el CUIT, la razón social ni la ruta del archivo: la auditoría
    responde quién hizo qué y cuándo, no repite el dato fiscal en una segunda
    tabla que después hay que cuidar igual que la primera.
    """
    db.add(
        AuditLog(
            user_id=actor.id,
            action=accion,
            entity="documentacion_de_vendedor",
            entity_id=documentacion.id,
            metadata_json=datos,
        )
    )


# ==============================================================================
# Titular
# ==============================================================================

@router.get("", response_model=MiDocumentacion)
def mi_documentacion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El estado de la documentación propia. Sin presentar también es un estado."""
    documentacion = (
        db.query(DocumentacionDeVendedor)
        .filter(DocumentacionDeVendedor.user_id == current_user.id)
        .first()
    )
    return _mia(documentacion)


@router.post("", response_model=MiDocumentacion, status_code=201)
async def presentar_documentacion(
    cuit: str = Form(...),
    razon_social: str = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Presenta o reemplaza la documentación. Siempre queda pendiente.

    Reemplazar una aprobada **retira el distintivo**, y eso no es un efecto
    lateral: lo revisado fue el papel anterior, así que la aprobación no se
    hereda al que lo sustituye.
    """
    razon = (razon_social or "").strip()
    if not razon:
        raise HTTPException(status_code=400, detail="La razón social es obligatoria")
    if len(razon) > 255:
        raise HTTPException(
            status_code=400, detail="La razón social no puede superar 255 caracteres"
        )

    try:
        cuit_normalizado = servicio.normalizar_cuit(cuit)
    except servicio.DocumentoInvalido as error:
        raise HTTPException(status_code=400, detail=str(error))

    # Se lee con un byte de más que el límite: alcanza para saber que se pasó
    # sin cargar en memoria un archivo de cualquier tamaño.
    limite = servicio.limite_de_bytes()
    contenido = await archivo.read(limite + 1)
    if len(contenido) > limite:
        raise HTTPException(
            status_code=400,
            detail=(
                "La constancia supera el máximo de "
                f"{settings.MAX_DOCUMENTO_SIZE_MB} MB"
            ),
        )

    nombre = servicio.sanear_nombre(archivo.filename)
    try:
        servicio.validar_pdf(archivo.filename or "", archivo.content_type, contenido)
    except servicio.DocumentoInvalido as error:
        raise HTTPException(status_code=400, detail=str(error))

    documentacion = (
        db.query(DocumentacionDeVendedor)
        .filter(DocumentacionDeVendedor.user_id == current_user.id)
        .with_for_update()
        .first()
    )

    # Recién acá se escribe: todo lo que podía rechazar ya rechazó, así que no
    # queda un archivo de una fila que nunca existió.
    ruta_anterior = documentacion.archivo_ruta if documentacion else None
    ruta_nueva = servicio.guardar(contenido)

    try:
        if documentacion is None:
            documentacion = DocumentacionDeVendedor(user_id=current_user.id)
            db.add(documentacion)

        documentacion.cuit = cuit_normalizado
        documentacion.razon_social = razon
        documentacion.archivo_nombre = nombre
        documentacion.archivo_ruta = ruta_nueva
        documentacion.archivo_bytes = len(contenido)
        documentacion.estado = EstadoDeDocumentacion.PENDIENTE
        documentacion.motivo_de_rechazo = None
        documentacion.revisado_por_id = None
        documentacion.revisado_el = None
        documentacion.presentado_el = datetime.utcnow()

        db.flush()
        _auditar(
            db,
            current_user,
            "documentacion_presentada",
            documentacion,
            {"reemplazo": ruta_anterior is not None},
        )
        db.commit()
    except IntegrityError:
        # Dos presentaciones del mismo titular a la vez: la fila es única por
        # usuario, así que la segunda choca contra el índice en vez de crear
        # una segunda documentación. Es un choque legítimo, no un error del
        # servidor.
        db.rollback()
        servicio.borrar(ruta_nueva)
        raise HTTPException(
            status_code=409,
            detail="Ya se estaba registrando otra presentación tuya. Probá de nuevo.",
        )
    except Exception:
        db.rollback()
        # El archivo nuevo no tiene fila que lo reclame: se va con ella.
        servicio.borrar(ruta_nueva)
        raise

    # El anterior deja de existir recién cuando el reemplazo está confirmado.
    # Al revés, un commit fallido dejaría al vendedor sin ninguno de los dos.
    if ruta_anterior and ruta_anterior != ruta_nueva:
        servicio.borrar(ruta_anterior)

    db.refresh(documentacion)
    return _mia(documentacion)


@router.get("/archivo")
def mi_constancia(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El PDF propio. El titular puede releer lo que presentó."""
    documentacion = (
        db.query(DocumentacionDeVendedor)
        .filter(DocumentacionDeVendedor.user_id == current_user.id)
        .first()
    )
    if documentacion is None:
        raise HTTPException(status_code=404, detail="No presentaste documentación")
    return _pdf(documentacion)


# ==============================================================================
# Administración
# ==============================================================================

@router_admin.get("", response_model=ColaDeDocumentacion)
def cola(
    estado: Optional[str] = Query(
        None, description="pendiente, aprobada o rechazada; vacío trae todas"
    ),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """La cola de revisión, filtrable por estado."""
    # Las dos personas de cada fila —de quién es y quién decidió— vienen en la
    # misma consulta: sin esto, armar la respuesta pide dos consultas más por
    # cada fila de la cola.
    consulta = db.query(DocumentacionDeVendedor).join(
        User, DocumentacionDeVendedor.user_id == User.id
    ).options(
        joinedload(DocumentacionDeVendedor.usuario),
        joinedload(DocumentacionDeVendedor.revisado_por),
    )

    if estado:
        try:
            filtro = EstadoDeDocumentacion(estado.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Estado inválido: pendiente, aprobada o rechazada",
            )
        consulta = consulta.filter(DocumentacionDeVendedor.estado == filtro)

    filas = consulta.order_by(DocumentacionDeVendedor.presentado_el.desc()).all()

    pendientes = (
        db.query(DocumentacionDeVendedor)
        .filter(DocumentacionDeVendedor.estado == EstadoDeDocumentacion.PENDIENTE)
        .count()
    )

    return ColaDeDocumentacion(
        items=[_en_cola(fila) for fila in filas],
        total=len(filas),
        pendientes=pendientes,
    )


@router_admin.get("/{documentacion_id}/archivo")
def constancia(
    documentacion_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """El PDF de cualquier presentación, para poder revisarla."""
    documentacion = (
        db.query(DocumentacionDeVendedor)
        .filter(DocumentacionDeVendedor.id == documentacion_id)
        .first()
    )
    if documentacion is None:
        raise HTTPException(status_code=404, detail="Documentación no encontrada")
    return _pdf(documentacion)


@router_admin.post("/{documentacion_id}/decidir", response_model=DocumentacionEnCola)
def decidir(
    documentacion_id: str,
    cuerpo: Decision,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Aprueba o rechaza **la presentación que se revisó**, no la que haya.

    Hay dos carreras distintas acá y cada una tiene su respuesta.

    La primera son dos administradores decidiendo a la vez, que es el caso
    esperable y no el raro: la cola es compartida y se mira en simultáneo. La
    fila se toma con `FOR UPDATE`, así que el segundo espera al primero y
    encuentra un estado que ya no es pendiente; ahí devuelve 409 en vez de
    pisar la decisión ajena.

    La segunda es más silenciosa y es la que arreglan estas líneas: la fila y
    su `id` **sobreviven al reemplazo**. Alguien abre el PDF A, el titular
    presenta B mientras tanto, y la aprobación llega con el mismo `id`. Sin un
    discriminante, aprueba B con la revisión de A: un papel que nadie miró
    queda aprobado y la auditoría dice que se revisó. Por eso la decisión trae
    el `presentado_el` que la cola mostró y se compara exacto.
    """
    try:
        decision = EstadoDeDocumentacion(cuerpo.decision.lower())
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400, detail="La decisión es «aprobada» o «rechazada»"
        )

    if decision not in (
        EstadoDeDocumentacion.APROBADA,
        EstadoDeDocumentacion.RECHAZADA,
    ):
        raise HTTPException(
            status_code=400, detail="La decisión es «aprobada» o «rechazada»"
        )

    motivo = (cuerpo.motivo or "").strip()
    if decision == EstadoDeDocumentacion.RECHAZADA and not motivo:
        raise HTTPException(
            status_code=400,
            detail="Para rechazar hace falta un motivo que el vendedor pueda accionar",
        )

    documentacion = (
        db.query(DocumentacionDeVendedor)
        .filter(DocumentacionDeVendedor.id == documentacion_id)
        .with_for_update()
        .first()
    )
    if documentacion is None:
        raise HTTPException(status_code=404, detail="Documentación no encontrada")

    # Antes que el estado: si la presentación cambió, ni siquiera importa en
    # qué quedó. Lo que se revisó ya no está.
    if documentacion.presentado_el != cuerpo.presentado_el:
        raise HTTPException(
            status_code=409,
            detail=(
                "El vendedor reemplazó su documentación después de que la "
                "abriste. Actualizá la cola y revisá la presentación actual "
                "antes de decidir."
            ),
        )

    if documentacion.estado != EstadoDeDocumentacion.PENDIENTE:
        raise HTTPException(
            status_code=409,
            detail=(
                "Esta documentación ya fue revisada y quedó "
                f"«{documentacion.estado.value}». Actualizá la cola."
            ),
        )

    anterior = documentacion.estado.value
    documentacion.estado = decision
    documentacion.motivo_de_rechazo = (
        motivo if decision == EstadoDeDocumentacion.RECHAZADA else None
    )
    documentacion.revisado_por_id = admin.id
    documentacion.revisado_el = datetime.utcnow()

    _auditar(
        db,
        admin,
        "documentacion_revisada",
        documentacion,
        {"de": anterior, "a": decision.value, "vendedor_id": documentacion.user_id},
    )
    db.commit()
    db.refresh(documentacion)
    return _en_cola(documentacion)
