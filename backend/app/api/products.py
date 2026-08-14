"""
API Router para gestión de productos y servicios (crear, editar, eliminar)
Requiere autenticación
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import os
from io import BytesIO

from app.db.base import get_db
from app.models.product import Product, ProductStatus
from app.models.product_image import ProductImage
from app.models.category import Category
from app.models.locality import Locality
from app.core.dependencies import get_current_user
from app.core.montos import validar_precio_unitario
from app.models.user import User, UserRole
from app.schemas.products import ProductCreateRequest, ProductUpdateRequest, ProductResponse
from app.core.config import settings
from app.services.storage import get_storage

router = APIRouter(prefix="/products", tags=["products"])


def slugify(text: str) -> str:
    """Convertir texto a slug URL-friendly"""
    import re
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')


@router.post("", response_model=ProductResponse)
async def create_product(
    product_data: ProductCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crear un nuevo producto o servicio.
    Solo usuarios con rol seller o admin pueden crear productos/servicios.
    """
    # Verificar que el usuario sea seller o admin
    if current_user.role not in [UserRole.USER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=403,
            detail="Solo vendedores y administradores pueden crear productos"
        )
    
    # Verificar que la categoría exista
    category = db.query(Category).filter(Category.id == product_data.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    locality = db.query(Locality).filter(Locality.id == product_data.locality_id).first()
    if not locality:
        raise HTTPException(status_code=404, detail="Localidad no encontrada")
    
    # Generar slug único
    base_slug = slugify(product_data.name)
    slug = base_slug
    counter = 1
    while db.query(Product).filter(Product.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Determinar tipo de publicación
    validar_precio_unitario(product_data.price)

    pub_type = product_data.publication_type  # "producto" o "servicio"
    is_service = pub_type == "servicio"
    
    # Crear producto/servicio
    new_product = Product(
        name=product_data.name,
        slug=slug,
        description=product_data.description,
        category_id=product_data.category_id,
        subcategory_id=product_data.subcategory_id,  # Subcategoría opcional
        price=product_data.price,
        stock=product_data.stock if not is_service else None,
        unit=product_data.unit,
        locality_id=locality.id,
        location=f"{locality.name}, {locality.province_name}",
        seller_id=current_user.id,
        status=ProductStatus.ACTIVE,
        publication_type=pub_type,
        # Campos de servicio
        pricing_type=product_data.pricing_type if is_service else None,
        availability=product_data.availability if is_service else None,
        response_time=product_data.response_time if is_service else None,
        experience_years=product_data.experience_years if is_service else None,
        has_equipment=product_data.has_equipment if is_service else None,
        coverage_zones=product_data.coverage_zones if is_service else None,
    )
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    tipo_msg = "Servicio" if is_service else "Producto"
    return ProductResponse(
        id=new_product.id,
        name=new_product.name,
        slug=new_product.slug,
        publication_type=product_data.publication_type,
        message=f"{tipo_msg} '{new_product.name}' creado exitosamente"
    )


@router.post("/{product_id}/images")
async def upload_product_images(
    product_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Subir imágenes para un producto.
    Solo el dueño del producto o un admin pueden subir imágenes.
    """
    # Verificar que el producto exista
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Verificar permisos
    if product.seller_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para modificar este producto"
        )
    
    # Verificar límite de imágenes por producto (máximo 3)
    MAX_IMAGES_PER_PRODUCT = 3
    existing_images_count = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).count()
    
    if existing_images_count >= MAX_IMAGES_PER_PRODUCT:
        raise HTTPException(
            status_code=400,
            detail=f"El producto ya tiene el máximo de {MAX_IMAGES_PER_PRODUCT} imágenes permitidas"
        )
    
    # Calcular cuántas imágenes podemos agregar
    available_slots = MAX_IMAGES_PER_PRODUCT - existing_images_count
    if len(files) > available_slots:
        raise HTTPException(
            status_code=400,
            detail=f"Solo puedes agregar {available_slots} imagen(es) más. Máximo {MAX_IMAGES_PER_PRODUCT} por producto"
        )
    
    # Validar archivos
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
    max_file_size = 5 * 1024 * 1024  # 5MB
    
    uploaded_images = []
    
    for file in files:
        # Validar extensión
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Formato de archivo no permitido: {file_ext}. Use: {', '.join(allowed_extensions)}"
            )
        
        # Leer contenido para validar tamaño
        content = await file.read()
        if len(content) > max_file_size:
            raise HTTPException(
                status_code=400,
                detail=f"Archivo {file.filename} excede el tamaño máximo de 5MB"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Subir archivo usando el servicio de storage (local/S3/Cloudinary)
        storage = get_storage()
        file_url = await storage.upload(
            file=BytesIO(content),
            filename=file.filename,
            folder="products",
            content_type=file.content_type
        )
        
        # Extraer nombre del archivo de la URL
        unique_filename = file_url.split('/')[-1]
        
        # Determinar si es la primera imagen (será la principal)
        is_first = len(uploaded_images) == 0
        existing_images = db.query(ProductImage).filter(
            ProductImage.product_id == product_id
        ).count()
        is_primary = existing_images == 0 and is_first
        
        # Crear registro en base de datos
        product_image = ProductImage(
            product_id=product_id,
            url=file_url,  # URL del storage (local o cloud)
            filename=unique_filename,
            file_size=len(content),
            is_primary=is_primary,
            display_order=existing_images + len(uploaded_images)
        )
        
        db.add(product_image)
        uploaded_images.append({
            "filename": file.filename,
            "url": product_image.url,
            "is_primary": is_primary
        })
    
    db.commit()
    
    return {
        "message": f"{len(uploaded_images)} imagen(es) subida(s) exitosamente",
        "images": uploaded_images
    }


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product_data: ProductUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Actualizar un producto existente.
    Solo el dueño o un admin pueden actualizar.
    """
    # La fila se bloquea desde el principio, y eso es parte de la correccion,
    # no una precaucion generica: editar el stock y reservarlo compiten por el
    # mismo numero. La reserva del checkout es un UPDATE condicional sobre esta
    # misma fila, asi que tomarla con FOR UPDATE ordena a las dos: o la reserva
    # entra antes y la edicion la ve, o la edicion entra antes y la reserva se
    # calcula sobre el stock nuevo. Sin candado, las dos leen el mismo numero y
    # la ultima en escribir borra a la otra.
    product = db.query(Product).filter(
        Product.id == product_id
    ).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Verificar permisos
    if product.seller_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para modificar este producto"
        )
    
    # Actualizar campos
    update_data = product_data.model_dump(exclude_unset=True)

    # El stock no puede bajar de lo que ya esta comprometido.
    #
    # Habia compras en curso que reservaron unidades de este producto y todavia
    # esperan que se acredite el pago. Si el vendedor pone un stock menor que
    # esas unidades, la resta queda en negativo y la consolidacion del pago la
    # recorta a cero: la falta no explota, se esconde, y alguien se queda sin
    # la mercaderia que ya habia pagado. Se rechaza con el numero a la vista
    # para que el vendedor sepa cual es el piso y por que.
    reservado = product.stock_reservado or 0
    if update_data.get("stock") is not None and int(update_data["stock"]) < reservado:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No podes dejar el stock en {int(update_data['stock'])}: hay "
                f"{reservado} unidad(es) reservadas por compras en curso que "
                "todavia esperan el pago. Ese es el minimo hasta que se "
                "resuelvan."
            ),
        )

    # El precio se valida ANTES de tocar el modelo: por la ruta de edicion,
    # un valor fuera de NUMERIC(12,2) terminaba en un 500 de base.
    if update_data.get("price") is not None:
        validar_precio_unitario(update_data["price"])
    
    # Si cambia el nombre, regenerar slug
    if "name" in update_data:
        base_slug = slugify(update_data["name"])
        slug = base_slug
        counter = 1
        while db.query(Product).filter(
            Product.slug == slug,
            Product.id != product_id
        ).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
        update_data["slug"] = slug
    
    # Convertir status string a enum si viene
    if "status" in update_data:
        try:
            update_data["status"] = ProductStatus(update_data["status"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {update_data['status']}")

    if "locality_id" in update_data:
        locality = db.query(Locality).filter(Locality.id == update_data["locality_id"]).first()
        if not locality:
            raise HTTPException(status_code=404, detail="Localidad no encontrada")
        update_data["location"] = f"{locality.name}, {locality.province_name}"
    
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    
    return ProductResponse(
        id=product.id,
        name=product.name,
        slug=product.slug,
        message="Producto actualizado exitosamente"
    )


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Eliminar un producto (soft delete, cambia status a DELETED).
    Solo el dueño o un admin pueden eliminar.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Verificar permisos
    if product.seller_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para eliminar este producto"
        )
    
    # Soft delete
    product.status = ProductStatus.DELETED
    db.commit()
    
    return {"message": "Producto eliminado exitosamente"}


@router.delete("/{product_id}/images/{image_id}")
async def delete_product_image(
    product_id: str,
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Eliminar una imagen específica de un producto.
    Elimina del storage (local/cloud) y de la base de datos.
    """
    # Verificar producto
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Verificar permisos
    if product.seller_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="No tienes permiso para modificar este producto")
    
    # Buscar imagen
    image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()
    
    if not image:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    
    # Eliminar del storage
    storage = get_storage()
    await storage.delete(image.url)
    
    # Si era la imagen principal, asignar otra como principal
    was_primary = image.is_primary
    
    # Eliminar de la base de datos
    db.delete(image)
    db.commit()
    
    # Si era principal, asignar la primera imagen disponible como nueva principal
    if was_primary:
        first_image = db.query(ProductImage).filter(
            ProductImage.product_id == product_id
        ).first()
        if first_image:
            first_image.is_primary = True
            db.commit()
    
    return {"message": "Imagen eliminada exitosamente"}


@router.get("/my")
async def get_my_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener productos del usuario actual con imágenes, categoría y subcategoría.
    """
    from sqlalchemy.orm import joinedload
    from app.models.subcategory import Subcategory
    
    products = db.query(Product).options(
        joinedload(Product.images),
        joinedload(Product.category),
        joinedload(Product.subcategory)
    ).filter(
        Product.seller_id == current_user.id,
        Product.status != ProductStatus.DELETED  # Excluir productos eliminados
    ).order_by(Product.created_at.desc()).all()
    
    # Construir respuesta con los datos necesarios
    result = []
    for product in products:
        product_dict = {
            "id": str(product.id),
            "name": product.name,
            "slug": product.slug,
            "description": product.description,
            "price": product.price,
            "currency": product.currency,
            "stock": product.stock,
            "unit": product.unit,
            "location": product.location,
            "status": product.status.value if hasattr(product.status, 'value') else product.status,
            "views_count": product.views_count,
            "likes_count": product.likes_count,
            "sales_count": product.sales_count,
            "created_at": product.created_at.isoformat() if product.created_at else None,
            "publication_type": product.publication_type or "producto",
            "category_id": str(product.category_id) if product.category_id else None,
            "category": {
                "id": str(product.category.id),
                "name": product.category.name
            } if product.category else None,
            "subcategory_id": str(product.subcategory_id) if product.subcategory_id else None,
            "subcategory": {
                "id": str(product.subcategory.id),
                "name": product.subcategory.name
            } if product.subcategory else None,
            "images": [
                {
                    "id": str(img.id),
                    "url": img.url,
                    "is_primary": img.is_primary
                } for img in product.images
            ] if product.images else [],
            # Campos de servicio
            "pricing_type": product.pricing_type,
            "availability": product.availability,
            "response_time": product.response_time,
            "experience_years": product.experience_years,
            "has_equipment": product.has_equipment,
            "coverage_zones": product.coverage_zones,
        }
        result.append(product_dict)
    
    return {
        "products": result,
        "total": len(result)
    }
