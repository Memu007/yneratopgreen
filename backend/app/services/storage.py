"""
Servicio de Almacenamiento de Archivos - Abstracción para múltiples backends

Backends soportados:
- local: Almacenamiento en disco local (desarrollo)
- s3: Amazon S3 o compatible (producción)
- cloudinary: Cloudinary CDN (producción)
- azure: Azure Blob Storage (producción)

Para cambiar el backend, modificar STORAGE_BACKEND en .env
"""
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Optional, Tuple
from datetime import datetime
import uuid
import os
import shutil
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    """Interfaz abstracta para backends de almacenamiento"""
    
    @abstractmethod
    async def upload(
        self, 
        file: BinaryIO, 
        filename: str, 
        folder: str = "products",
        content_type: Optional[str] = None
    ) -> str:
        """
        Sube un archivo y retorna la URL pública.
        
        Args:
            file: Archivo binario a subir
            filename: Nombre original del archivo
            folder: Carpeta/prefijo donde guardar (ej: "products", "avatars")
            content_type: MIME type del archivo
            
        Returns:
            URL pública del archivo
        """
        pass
    
    @abstractmethod
    async def delete(self, url: str) -> bool:
        """
        Elimina un archivo por su URL.
        
        Args:
            url: URL del archivo a eliminar
            
        Returns:
            True si se eliminó correctamente
        """
        pass
    
    @abstractmethod
    async def exists(self, url: str) -> bool:
        """Verifica si un archivo existe"""
        pass
    
    def generate_unique_filename(self, original_filename: str) -> str:
        """Genera un nombre único para el archivo"""
        ext = os.path.splitext(original_filename)[1].lower()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"{timestamp}_{unique_id}{ext}"


class LocalStorageBackend(StorageBackend):
    """
    Backend de almacenamiento local (para desarrollo).
    Guarda archivos en el sistema de archivos local.
    """
    
    def __init__(self):
        self.base_path = Path(settings.UPLOAD_DIR)
        self.public_base = settings.PUBLIC_UPLOAD_BASE
        
    async def upload(
        self, 
        file: BinaryIO, 
        filename: str, 
        folder: str = "products",
        content_type: Optional[str] = None
    ) -> str:
        # Crear directorio si no existe
        upload_dir = self.base_path / folder
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generar nombre único
        unique_filename = self.generate_unique_filename(filename)
        file_path = upload_dir / unique_filename
        
        # Guardar archivo
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file, buffer)
        
        # Retornar URL pública
        public_url = f"{self.public_base}/{folder}/{unique_filename}"
        logger.info(f"📁 [LOCAL] Archivo guardado: {public_url}")
        
        return public_url
    
    async def delete(self, url: str) -> bool:
        try:
            # Extraer path del archivo desde la URL
            # URL formato: /uploads/products/filename.jpg
            relative_path = url.replace(self.public_base, "").lstrip("/")
            file_path = self.base_path / relative_path
            
            if file_path.exists():
                file_path.unlink()
                logger.info(f"🗑️ [LOCAL] Archivo eliminado: {url}")
                return True
            return False
        except Exception as e:
            logger.error(f"❌ [LOCAL] Error eliminando archivo: {e}")
            return False
    
    async def exists(self, url: str) -> bool:
        relative_path = url.replace(self.public_base, "").lstrip("/")
        file_path = self.base_path / relative_path
        return file_path.exists()


class S3StorageBackend(StorageBackend):
    """
    Backend de Amazon S3 o compatible (MinIO, DigitalOcean Spaces, etc.)
    
    Requiere en .env:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - AWS_S3_BUCKET
    - AWS_S3_REGION
    - AWS_S3_ENDPOINT (opcional, para S3 compatibles)
    """
    
    def __init__(self):
        # Importar boto3 solo si se usa S3
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise ImportError("Para usar S3, instalar: pip install boto3")
        
        self.bucket = settings.AWS_S3_BUCKET
        self.region = getattr(settings, 'AWS_S3_REGION', 'us-east-1')
        endpoint = getattr(settings, 'AWS_S3_ENDPOINT', None)
        
        config = Config(signature_version='s3v4')
        
        self.client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=self.region,
            endpoint_url=endpoint,
            config=config
        )
        
        # URL base para archivos públicos
        if endpoint:
            self.base_url = f"{endpoint}/{self.bucket}"
        else:
            self.base_url = f"https://{self.bucket}.s3.{self.region}.amazonaws.com"
    
    async def upload(
        self, 
        file: BinaryIO, 
        filename: str, 
        folder: str = "products",
        content_type: Optional[str] = None
    ) -> str:
        unique_filename = self.generate_unique_filename(filename)
        key = f"{folder}/{unique_filename}"
        
        extra_args = {'ACL': 'public-read'}
        if content_type:
            extra_args['ContentType'] = content_type
        
        self.client.upload_fileobj(
            file,
            self.bucket,
            key,
            ExtraArgs=extra_args
        )
        
        public_url = f"{self.base_url}/{key}"
        logger.info(f"☁️ [S3] Archivo subido: {public_url}")
        
        return public_url
    
    async def delete(self, url: str) -> bool:
        try:
            # Extraer key desde URL
            key = url.replace(f"{self.base_url}/", "")
            self.client.delete_object(Bucket=self.bucket, Key=key)
            logger.info(f"🗑️ [S3] Archivo eliminado: {url}")
            return True
        except Exception as e:
            logger.error(f"❌ [S3] Error eliminando: {e}")
            return False
    
    async def exists(self, url: str) -> bool:
        try:
            key = url.replace(f"{self.base_url}/", "")
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except:
            return False


class CloudinaryStorageBackend(StorageBackend):
    """
    Backend de Cloudinary CDN.
    
    Requiere en .env:
    - CLOUDINARY_CLOUD_NAME
    - CLOUDINARY_API_KEY
    - CLOUDINARY_API_SECRET
    """
    
    def __init__(self):
        try:
            import cloudinary
            import cloudinary.uploader
        except ImportError:
            raise ImportError("Para usar Cloudinary, instalar: pip install cloudinary")
        
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )
        
        self.cloudinary = cloudinary
        self.uploader = cloudinary.uploader
    
    async def upload(
        self, 
        file: BinaryIO, 
        filename: str, 
        folder: str = "products",
        content_type: Optional[str] = None
    ) -> str:
        unique_name = self.generate_unique_filename(filename).rsplit('.', 1)[0]
        
        result = self.uploader.upload(
            file,
            folder=f"topgreen/{folder}",
            public_id=unique_name,
            resource_type="image",
            overwrite=True
        )
        
        public_url = result['secure_url']
        logger.info(f"☁️ [CLOUDINARY] Archivo subido: {public_url}")
        
        return public_url
    
    async def delete(self, url: str) -> bool:
        try:
            # Extraer public_id desde URL de Cloudinary
            # URL formato: https://res.cloudinary.com/xxx/image/upload/v123/topgreen/products/filename.jpg
            parts = url.split('/upload/')
            if len(parts) > 1:
                public_id = parts[1].rsplit('.', 1)[0]  # Quitar extensión
                # Quitar version si existe (v123456/)
                if public_id.startswith('v') and '/' in public_id:
                    public_id = '/'.join(public_id.split('/')[1:])
                
                self.uploader.destroy(public_id)
                logger.info(f"🗑️ [CLOUDINARY] Archivo eliminado: {public_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"❌ [CLOUDINARY] Error eliminando: {e}")
            return False
    
    async def exists(self, url: str) -> bool:
        # Cloudinary no tiene una forma directa de verificar existencia
        # Se podría usar la API de recursos, pero es costoso
        return True  # Asumimos que existe


# ==============================================================================
# FACTORY - Obtener el backend según configuración
# ==============================================================================

def get_storage_backend() -> StorageBackend:
    """
    Factory que retorna el backend de almacenamiento según configuración.
    
    Configurable via STORAGE_BACKEND en .env:
    - "local" (default): Almacenamiento en disco
    - "s3": Amazon S3 o compatible
    - "cloudinary": Cloudinary CDN
    """
    backend_type = getattr(settings, 'STORAGE_BACKEND', 'local').lower()
    
    if backend_type == 's3':
        logger.info("📦 Usando backend de almacenamiento: S3")
        return S3StorageBackend()
    
    elif backend_type == 'cloudinary':
        logger.info("📦 Usando backend de almacenamiento: Cloudinary")
        return CloudinaryStorageBackend()
    
    else:
        logger.info("📦 Usando backend de almacenamiento: Local")
        return LocalStorageBackend()


# Singleton del storage backend
_storage_instance: Optional[StorageBackend] = None

def get_storage() -> StorageBackend:
    """Obtiene la instancia singleton del storage backend"""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = get_storage_backend()
    return _storage_instance
