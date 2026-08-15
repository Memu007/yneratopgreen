"""Validaciones y guardado privado de la documentación fiscal del vendedor.

Tres cosas viven acá y ninguna en la ruta: qué es un CUIT aceptable, qué es un
PDF aceptable y dónde termina el archivo. La ruta decide permisos y estados;
esto decide si el dato entra.

El orden importa y es deliberado: **primero se valida todo, después se escribe
el archivo, y el archivo se escribe antes del commit pero se borra si el commit
falla**. Escribir antes de validar deja archivos huérfanos de una fila que
nunca existió, que es exactamente lo que la aceptación prohíbe.
"""
from pathlib import Path
import logging
import re
import unicodedata
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)


class DocumentoInvalido(ValueError):
    """Lo presentado no entra. El mensaje es para mostrárselo a la persona."""


# ==============================================================================
# CUIT
# ==============================================================================

# Pesos del dígito verificador del CUIT, en orden, sobre los diez primeros
# dígitos.
_PESOS_CUIT = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)


def normalizar_cuit(valor: str) -> str:
    """Devuelve los once dígitos del CUIT o explica por qué no lo es.

    Acepta los separadores con los que la gente lo escribe —`20-12345678-9`,
    `20 12345678 9`— y guarda siempre los once dígitos pelados, para que dos
    presentaciones del mismo CUIT no queden distintas por un guion.

    La validación es **formal**: largo, dígitos y verificador. No se le
    pregunta a ningún organismo si ese CUIT existe ni a quién pertenece; eso
    está explícitamente fuera de esta pieza, y prometerlo sería prometer una
    comprobación que no se hace.
    """
    if valor is None:
        raise DocumentoInvalido("El CUIT es obligatorio")

    digitos = re.sub(r"[\s.\-]", "", valor.strip())
    if not digitos:
        raise DocumentoInvalido("El CUIT es obligatorio")
    if not digitos.isdigit():
        raise DocumentoInvalido("El CUIT tiene que ser numérico, con o sin guiones")
    if len(digitos) != 11:
        raise DocumentoInvalido(
            f"El CUIT tiene que tener 11 dígitos y tiene {len(digitos)}"
        )

    suma = sum(int(d) * p for d, p in zip(digitos[:10], _PESOS_CUIT))
    esperado = 11 - (suma % 11)
    if esperado == 11:
        esperado = 0
    elif esperado == 10:
        esperado = 9

    if int(digitos[10]) != esperado:
        raise DocumentoInvalido(
            "El CUIT no es válido: el dígito verificador no coincide"
        )

    return digitos


def formatear_cuit(digitos: str) -> str:
    """`20123456789` → `20-12345678-9`, sólo para mostrar."""
    if not digitos or len(digitos) != 11:
        return digitos or ""
    return f"{digitos[:2]}-{digitos[2:10]}-{digitos[10]}"


# ==============================================================================
# El archivo
# ==============================================================================

TIPO_PDF = "application/pdf"

# Un PDF empieza con esta firma. Es lo que hace fallar a un JPEG renombrado a
# .pdf: la extensión y el tipo declarado los elige quien sube, la firma no.
_FIRMA_PDF = b"%PDF-"

# Y termina con este marcador. Se lo busca en la cola porque un archivo puede
# traer basura después; lo que no puede es no tenerlo.
_FIN_PDF = b"%%EOF"


def sanear_nombre(nombre: str) -> str:
    """Un nombre mostrable, sin ruta, sin acentos raros y sin sorpresas.

    Nunca es el nombre en disco —ese es aleatorio—, pero igual se sanea: viaja
    en una cabecera `Content-Disposition` y se muestra en pantalla, así que un
    nombre con comillas o saltos de línea es una inyección esperando.
    """
    base = Path(nombre or "").name
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode()
    base = re.sub(r"[^A-Za-z0-9._\- ]", "_", base).strip()
    base = re.sub(r"_{2,}", "_", base)
    if not base or base in {".", ".."}:
        base = "constancia.pdf"
    if not base.lower().endswith(".pdf"):
        base = f"{Path(base).stem or 'constancia'}.pdf"
    return base[:255]


def limite_de_bytes() -> int:
    return settings.MAX_DOCUMENTO_SIZE_MB * 1024 * 1024


def validar_pdf(nombre: str, tipo_declarado: str | None, contenido: bytes) -> None:
    """Las cuatro puertas del archivo, en orden de lo barato a lo caro.

    Extensión y tipo declarado los elige quien sube y por eso no alcanzan: se
    comprueban igual porque descartan el error honesto sin leer nada. La firma
    es la que descarta el archivo disfrazado.
    """
    if not Path(nombre or "").name.lower().endswith(".pdf"):
        raise DocumentoInvalido("La constancia tiene que ser un archivo PDF")

    if (tipo_declarado or "").split(";")[0].strip().lower() != TIPO_PDF:
        raise DocumentoInvalido(
            "La constancia tiene que enviarse como PDF (application/pdf)"
        )

    if not contenido:
        raise DocumentoInvalido("El archivo llegó vacío")

    limite = limite_de_bytes()
    if len(contenido) > limite:
        raise DocumentoInvalido(
            f"La constancia supera el máximo de {settings.MAX_DOCUMENTO_SIZE_MB} MB"
        )

    if not contenido.startswith(_FIRMA_PDF):
        raise DocumentoInvalido(
            "El archivo no es un PDF: no tiene la firma de un PDF aunque se llame así"
        )

    # El marcador de fin se busca sólo en la cola: recorrer un archivo de
    # megabytes entero para esto no aporta nada.
    if _FIN_PDF not in contenido[-2048:]:
        raise DocumentoInvalido("El PDF está incompleto o dañado")


def carpeta_privada() -> Path:
    """La carpeta donde viven los PDF. Se crea al vuelo y no es la pública."""
    carpeta = Path(settings.DOCUMENTOS_DIR)
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def guardar(contenido: bytes) -> str:
    """Escribe el PDF con un nombre aleatorio y devuelve su ruta relativa.

    El nombre en disco es un UUID y no deriva del usuario, del CUIT ni del
    nombre original: un nombre predecible convierte cualquier lectura de
    carpeta —o un descuido de configuración— en documentación ajena.
    """
    nombre_en_disco = f"{uuid.uuid4().hex}.pdf"
    destino = carpeta_privada() / nombre_en_disco
    destino.write_bytes(contenido)
    # 0600: en una instalación nativa el proceso puede compartir usuario con
    # otras cosas. No cuesta nada y acota el accidente.
    destino.chmod(0o600)
    return nombre_en_disco


def ruta_de(relativa: str) -> Path:
    """Resuelve una ruta guardada y se niega a salir de la carpeta privada."""
    carpeta = Path(settings.DOCUMENTOS_DIR).resolve()
    destino = (carpeta / relativa).resolve()
    if destino != carpeta and carpeta not in destino.parents:
        raise DocumentoInvalido("Ruta de documento fuera de la carpeta privada")
    return destino


def borrar(relativa: str | None) -> bool:
    """Borra un PDF anterior. Que ya no esté no es un error."""
    if not relativa:
        return False
    try:
        destino = ruta_de(relativa)
    except DocumentoInvalido:
        logger.error("Ruta de documento inesperada al borrar: %r", relativa)
        return False
    try:
        destino.unlink()
        return True
    except FileNotFoundError:
        return False
    except OSError as error:
        logger.error("No se pudo borrar el documento %s: %s", relativa, error)
        return False
