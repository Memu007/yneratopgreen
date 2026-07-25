"""
Script para crear datos iniciales (seed data)
Ejecutar: python -m app.seed
"""
import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.db.base import SessionLocal
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.form_option import FormOption
from app.core.security import hash_password
from app.seed_localities import seed_localities
from datetime import datetime


def create_seed_data():
    """Crear datos iniciales en la base de datos"""
    
    db = SessionLocal()
    
    try:
        print("🌱 Iniciando seed de datos...")

        # === LOCALIDADES === #
        print("\n📍 Sembrando localidades oficiales...")
        seed_localities(db)
        
        # === USUARIOS === #
        print("\n👤 Creando usuarios...")
        
        # Admin
        admin = db.query(User).filter(User.email == "admin@topgreen.com").first()
        if not admin:
            admin = User(
                email="admin@topgreen.com",
                password_hash=hash_password("admin123"),
                full_name="Administrador TopGreen",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                location="Buenos Aires, Argentina"
            )
            db.add(admin)
            print("  ✅ Admin creado: admin@topgreen.com / admin123")
        else:
            print("  ⏭️  Admin ya existe")
        
        # Vendedor demo
        seller = db.query(User).filter(User.email == "vendedor@ejemplo.com").first()
        if not seller:
            seller = User(
                email="vendedor@ejemplo.com",
                password_hash=hash_password("vendedor123"),
                full_name="Juan Vendedor",
                phone="+54 11 1234-5678",
                role=UserRole.USER,
                is_active=True,
                is_verified=True,
                location="Córdoba, Argentina",
                bio="Productor agrícola con 10 años de experiencia"
            )
            db.add(seller)
            print("  ✅ Vendedor creado: vendedor@ejemplo.com / vendedor123")
        else:
            print("  ⏭️  Vendedor ya existe")
        
        # Cliente demo
        customer = db.query(User).filter(User.email == "cliente@ejemplo.com").first()
        if not customer:
            customer = User(
                email="cliente@ejemplo.com",
                password_hash=hash_password("cliente123"),
                full_name="María Cliente",
                phone="+54 11 9876-5432",
                role=UserRole.USER,
                is_active=True,
                is_verified=True,
                location="Rosario, Argentina"
            )
            db.add(customer)
            print("  ✅ Cliente creado: cliente@ejemplo.com / cliente123")
        else:
            print("  ⏭️  Cliente ya existe")
        
        db.commit()
        
        # === CATEGORÍAS === #
        print("\n📦 Creando categorías...")
        
        categories_data = [
            {
                "name": "Semillas",
                "slug": "semillas",
                "description": "Semillas de alta calidad para todo tipo de cultivos",
                "icon": "🌱",
                "display_order": "1"
            },
            {
                "name": "Fertilizantes",
                "slug": "fertilizantes",
                "description": "Fertilizantes orgánicos e inorgánicos para mejorar el rendimiento",
                "icon": "🧪",
                "display_order": "2"
            },
            {
                "name": "Herramientas",
                "slug": "herramientas",
                "description": "Herramientas manuales y eléctricas para el trabajo agrícola",
                "icon": "🔨",
                "display_order": "3"
            },
            {
                "name": "Maquinaria",
                "slug": "maquinaria",
                "description": "Tractores, cosechadoras y maquinaria pesada",
                "icon": "🚜",
                "display_order": "4"
            },
            {
                "name": "Agroquímicos",
                "slug": "agroquimicos",
                "description": "Productos para protección de cultivos",
                "icon": "🧫",
                "display_order": "5"
            },
            {
                "name": "Bienes y Ganado",
                "slug": "bienes-ganado",
                "description": "Animales de cría y comerciales: bovinos, porcinos, ovinos y más",
                "icon": "🐄",
                "display_order": "6"
            },
            {
                "name": "Tecnología para el Cultivo",
                "slug": "tecnologia-cultivo",
                "description": "Drones, sensores IoT, software de gestión de campo y tecnología agrícola",
                "icon": "🛰️",
                "display_order": "7"
            },
            # Categorías de Servicios
            {
                "name": "Laboreo",
                "slug": "laboreo",
                "description": "Servicios de siembra, cosecha, fumigación y trabajo de campo",
                "icon": "🚜",
                "display_order": "10",
                "is_service": True
            },
            {
                "name": "Transporte y Logística",
                "slug": "transporte-logistica",
                "description": "Servicios de transporte de granos, insumos y maquinaria",
                "icon": "🚚",
                "display_order": "11",
                "is_service": True
            },
            {
                "name": "Asesoramiento",
                "slug": "asesoramiento",
                "description": "Asesoramiento agronómico, técnico y financiero",
                "icon": "📋",
                "display_order": "12",
                "is_service": True
            },
            {
                "name": "Mantenimiento",
                "slug": "mantenimiento",
                "description": "Reparación y mantenimiento de maquinaria agrícola",
                "icon": "🔧",
                "display_order": "13",
                "is_service": True
            },
            {
                "name": "Otros Servicios",
                "slug": "otros-servicios",
                "description": "Otros servicios agrícolas",
                "icon": "⚙️",
                "display_order": "14",
                "is_service": True
            }
        ]
        
        for cat_data in categories_data:
            existing_cat = db.query(Category).filter(Category.slug == cat_data["slug"]).first()
            if not existing_cat:
                category = Category(**cat_data)
                db.add(category)
                print(f"  ✅ Categoría creada: {cat_data['name']}")
            else:
                print(f"  ⏭️  Categoría '{cat_data['name']}' ya existe")
        
        db.commit()

        # === OPCIONES DE FORMULARIO === #
        # Las provincias/localidades se siembran desde Georef, no se duplican aquí.
        print("\n⚙️  Creando opciones de formulario...")

        form_options_data = {
            "unit": [
                ("kg", "Kilogramo"),
                ("ton", "Tonelada"),
                ("litros", "Litros"),
                ("unidad", "Unidad"),
                ("bolsa", "Bolsa"),
                ("pack", "Pack"),
                ("ha", "Hectárea"),
            ],
            "pricing_type": [
                ("por_hora", "Por hora"),
                ("por_hectarea", "Por hectárea"),
                ("por_trabajo", "Por trabajo/servicio"),
                ("a_convenir", "A convenir"),
            ],
            "availability": [
                ("inmediata", "Disponibilidad inmediata"),
                ("programar", "A programar"),
                ("temporada", "Solo en temporada"),
            ],
            "response_time": [
                ("inmediato", "Inmediato"),
                ("24hs", "Dentro de 24hs"),
                ("48hs", "Dentro de 48hs"),
                ("1_semana", "Dentro de 1 semana"),
            ],
        }

        for option_type, options in form_options_data.items():
            for display_order, (value, label) in enumerate(options):
                existing_option = db.query(FormOption).filter(
                    FormOption.option_type == option_type,
                    FormOption.value == value,
                ).first()
                if not existing_option:
                    db.add(FormOption(
                        option_type=option_type,
                        value=value,
                        label=label,
                        display_order=display_order,
                        is_active=True,
                    ))

        db.commit()
        print("  ✅ Opciones creadas/actualizadas (sin provincias)")
        
        # === PRODUCTOS === #
        print("\n📦 Creando productos de ejemplo...")
        
        from app.models.product import Product, ProductStatus
        from app.models.product_image import ProductImage
        
        # Obtener categorías y usuarios
        cat_semillas = db.query(Category).filter(Category.slug == "semillas").first()
        cat_fertilizantes = db.query(Category).filter(Category.slug == "fertilizantes").first()
        cat_herramientas = db.query(Category).filter(Category.slug == "herramientas").first()
        cat_maquinaria = db.query(Category).filter(Category.slug == "maquinaria").first()
        cat_laboreo = db.query(Category).filter(Category.slug == "laboreo").first()
        cat_transporte = db.query(Category).filter(Category.slug == "transporte-logistica").first()
        cat_asesoramiento = db.query(Category).filter(Category.slug == "asesoramiento").first()
        cat_mantenimiento = db.query(Category).filter(Category.slug == "mantenimiento").first()
        cat_otros_servicios = db.query(Category).filter(Category.slug == "otros-servicios").first()
        cat_agroquimicos = db.query(Category).filter(Category.slug == "agroquimicos").first()
        cat_bienes_ganado = db.query(Category).filter(Category.slug == "bienes-ganado").first()
        cat_tecnologia = db.query(Category).filter(Category.slug == "tecnologia-cultivo").first()
        
        admin = db.query(User).filter(User.email == "admin@topgreen.com").first()
        seller = db.query(User).filter(User.email == "vendedor@ejemplo.com").first()
        
        productos = [
            {
                "name": "Semillas de Maíz DK Premium",
                "slug": "semillas-maiz-dk-premium",
                "description": "Semillas de maíz híbrido de alta calidad, resistente a sequía. Rendimiento promedio 12-14 ton/ha. Ciclo 130 días. Ideal para zona núcleo.",
                "category_id": cat_semillas.id,
                "price": 45000.0,
                "currency": "ARS",
                "stock": 500,
                "unit": "bolsa 20kg",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/maiz1/800/600", "filename": "maiz1.jpg", "display_order": 1, "is_primary": True},
                    {"url": "https://picsum.photos/seed/maiz2/800/600", "filename": "maiz2.jpg", "display_order": 2, "is_primary": False}
                ]
            },
            {
                "name": "Fertilizante Triple 15 - NPK",
                "slug": "fertilizante-triple-15",
                "description": "Fertilizante balanceado NPK 15-15-15 para todo tipo de cultivos. Bolsa de 50kg. Aplicación en siembra o cobertura.",
                "category_id": cat_fertilizantes.id,
                "price": 28500.0,
                "currency": "ARS",
                "stock": 1200,
                "unit": "bolsa 50kg",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/fertilizante1/800/600", "filename": "fertilizante1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Pulverizadora Jacto 600L",
                "slug": "pulverizadora-jacto-600",
                "description": "Pulverizadora de arrastre marca Jacto, capacidad 600 litros. Barra de 12 metros con picos regulables. Excelente estado, 2 años de uso.",
                "category_id": cat_herramientas.id,
                "price": 1850000.0,
                "currency": "ARS",
                "stock": 3,
                "unit": "unidad",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/pulveri1/800/600", "filename": "pulveri1.jpg", "display_order": 1, "is_primary": True},
                    {"url": "https://picsum.photos/seed/pulveri2/800/600", "filename": "pulveri2.jpg", "display_order": 2, "is_primary": False},
                    {"url": "https://picsum.photos/seed/pulveri3/800/600", "filename": "pulveri3.jpg", "display_order": 3, "is_primary": False}
                ]
            },
            {
                "name": "Semillas de Soja RR Intacta",
                "slug": "semillas-soja-rr-intacta",
                "description": "Soja RR2 Intacta de alto rendimiento. Resistencia a lepidópteros y tolerancia a glifosato. Grupo de madurez VI corto. Densidad recomendada: 28-32 pl/m2.",
                "category_id": cat_semillas.id,
                "price": 52000.0,
                "currency": "ARS",
                "stock": 800,
                "unit": "bolsa 40kg",
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/soja1/800/600", "filename": "soja1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Cosechadora John Deere 9750",
                "slug": "cosechadora-john-deere-9750",
                "description": "Cosechadora John Deere 9750 STS, año 2018. 1200 horas de uso. Motor 6090H de 350HP. Cabezal maicero y plataforma draper incluidos. Service al día.",
                "category_id": cat_maquinaria.id,
                "price": 125000000.0,
                "currency": "ARS",
                "stock": 1,
                "unit": "unidad",
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/cosecha1/800/600", "filename": "cosecha1.jpg", "display_order": 1, "is_primary": True},
                    {"url": "https://picsum.photos/seed/cosecha2/800/600", "filename": "cosecha2.jpg", "display_order": 2, "is_primary": False}
                ]
            },
            {
                "name": "Herbicida Glifosato 66% - 20L",
                "slug": "herbicida-glifosato-20l",
                "description": "Glifosato sal potásica 66% concentración. Bidón de 20 litros. Amplio espectro de malezas. Registro SENASA vigente.",
                "category_id": cat_agroquimicos.id,
                "price": 35000.0,
                "currency": "ARS",
                "stock": 450,
                "unit": "bidón 20L",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/glifosato1/800/600", "filename": "glifosato1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Servicio de Siembra con GPS",
                "slug": "servicio-siembra-gps",
                "description": "Servicio profesional de siembra de precisión con tecnología GPS RTK. Sembradoras de última generación. Incluye monitoreo y mapeo de superficie. Precio por hectárea.",
                "category_id": cat_laboreo.id,
                "price": 8500.0,
                "currency": "ARS",
                "stock": 10000,
                "unit": "hectárea",
                "publication_type": "servicio",
                "pricing_type": "por_hectarea",
                "availability": "programar",
                "response_time": "24hs",
                "experience_years": 12,
                "has_equipment": True,
                "coverage_zones": ["Buenos Aires"],
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/siembra1/800/600", "filename": "siembra1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Rastra de Discos 24 Platos",
                "slug": "rastra-discos-24-platos",
                "description": "Rastra de discos excéntricos, 24 platos de 26 pulgadas. Ancho de labor 3.60m. Estructura reforzada. Ideal para preparación de suelo.",
                "category_id": cat_herramientas.id,
                "price": 2450000.0,
                "currency": "ARS",
                "stock": 5,
                "unit": "unidad",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/rastra1/800/600", "filename": "rastra1.jpg", "display_order": 1, "is_primary": True},
                    {"url": "https://picsum.photos/seed/rastra2/800/600", "filename": "rastra2.jpg", "display_order": 2, "is_primary": False}
                ]
            },
            {
                "name": "Terneros Angus - Lote 20 cabezas",
                "slug": "terneros-angus-lote-20",
                "description": "Lote de 20 terneros Angus destetados, 7-8 meses, peso promedio 180kg. Sanidad al día: vacunación Aftosa, Brucelosis y Carbunclo. Genética verificada, padre registrado. Entrega inmediata.",
                "category_id": cat_bienes_ganado.id,
                "price": 3200000.0,
                "currency": "ARS",
                "stock": 1,
                "unit": "lote 20 cabezas",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/terneros1/800/600", "filename": "terneros1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Vaquillonas Braford Preñadas",
                "slug": "vaquillonas-braford-prenadas",
                "description": "Vaquillonas Braford preñadas de 18 meses, inseminadas con toro Angus. 5 meses de gestación. Lote de 10 cabezas. Sanidad completa, trazabilidad SIRA al día.",
                "category_id": cat_bienes_ganado.id,
                "price": 5800000.0,
                "currency": "ARS",
                "stock": 1,
                "unit": "lote 10 cabezas",
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/vaquillonas1/800/600", "filename": "vaquillonas1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Dron Pulverizador Agrícola 20L",
                "slug": "dron-pulverizador-agricola-20l",
                "description": "Dron agrícola pulverizador con tanque de 20 litros. Autonomía 15 minutos por batería. Cobertura 10 ha/hora. Incluye 2 baterías, control remoto y software de mapeo. Compatible con APP de vuelo autónomo.",
                "category_id": cat_tecnologia.id,
                "price": 8500000.0,
                "currency": "ARS",
                "stock": 4,
                "unit": "unidad",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/dron1/800/600", "filename": "dron1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Sensores de Humedad de Suelo IoT",
                "slug": "sensores-humedad-suelo-iot",
                "description": "Kit de 5 sensores de humedad de suelo con conectividad IoT LoRaWAN. Medición de humedad, temperatura y conductividad a 30cm de profundidad. Batería solar, autonomía 3 años. Dashboard web incluido.",
                "category_id": cat_tecnologia.id,
                "price": 920000.0,
                "currency": "ARS",
                "stock": 15,
                "unit": "kit 5 sensores",
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/sensores1/800/600", "filename": "sensores1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Urea Granulada 46% Nitrógeno",
                "slug": "urea-granulada-46-nitrogeno",
                "description": "Urea granulada de uso agrícola con 46% de nitrógeno. Presentación en bolsa de 50 kg, apta para aplicaciones de base y cobertura.",
                "category_id": cat_fertilizantes.id,
                "price": 39000.0,
                "currency": "ARS",
                "stock": 900,
                "unit": "bolsa 50kg",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/urea1/800/600", "filename": "urea1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Tractor Pauny 280A Doble Tracción",
                "slug": "tractor-pauny-280a-doble-traccion",
                "description": "Tractor Pauny 280A de 180 HP, doble tracción, año 2019 y 3.400 horas. Cubiertas al 70%, hidráulico y toma de fuerza operativos.",
                "category_id": cat_maquinaria.id,
                "price": 98000000.0,
                "currency": "ARS",
                "stock": 1,
                "unit": "unidad",
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/tractor-pauny1/800/600", "filename": "tractor-pauny1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Insecticida Lambda Cihalotrina 1L",
                "slug": "insecticida-lambda-cihalotrina-1l",
                "description": "Insecticida piretroide de amplio espectro para soja, maíz y girasol. Envase de un litro, lote trazable y registro SENASA vigente.",
                "category_id": cat_agroquimicos.id,
                "price": 18500.0,
                "currency": "ARS",
                "stock": 240,
                "unit": "litro",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/insecticida1/800/600", "filename": "insecticida1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Servicio de Cosecha con Monitor de Rendimiento",
                "slug": "servicio-cosecha-monitor-rendimiento",
                "description": "Cosecha de soja, maíz y trigo con monitor de rendimiento y entrega de mapa por lote. Equipo propio y operador especializado.",
                "category_id": cat_laboreo.id,
                "price": 95000.0,
                "currency": "ARS",
                "stock": 5000,
                "unit": "hectárea",
                "publication_type": "servicio",
                "pricing_type": "por_hectarea",
                "availability": "temporada",
                "response_time": "24hs",
                "experience_years": 15,
                "has_equipment": True,
                "coverage_zones": ["Salta", "Jujuy", "Tucumán"],
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/cosecha-servicio1/800/600", "filename": "cosecha-servicio1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Transporte de Granos a Puerto",
                "slug": "transporte-granos-a-puerto",
                "description": "Flete de soja, maíz y trigo en equipos batea habilitados. Retiro en campo, seguimiento del viaje y entrega en terminal portuaria.",
                "category_id": cat_transporte.id,
                "price": 1800.0,
                "currency": "ARS",
                "stock": 10000,
                "unit": "tonelada",
                "publication_type": "servicio",
                "pricing_type": "por_trabajo",
                "availability": "programar",
                "response_time": "24hs",
                "experience_years": 9,
                "has_equipment": True,
                "coverage_zones": ["Santa Fe", "Entre Ríos", "Buenos Aires"],
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/transporte-granos1/800/600", "filename": "transporte-granos1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Flete de Maquinaria Agrícola con Carretón",
                "slug": "flete-maquinaria-agricola-carreton",
                "description": "Traslado de tractores, sembradoras y cosechadoras en carretón de cama baja. Permisos, seguro de carga y coordinación de ruta incluidos.",
                "category_id": cat_transporte.id,
                "price": 0.0,
                "currency": "ARS",
                "stock": 1000,
                "unit": "viaje",
                "publication_type": "servicio",
                "pricing_type": "a_convenir",
                "availability": "programar",
                "response_time": "48hs",
                "experience_years": 11,
                "has_equipment": True,
                "coverage_zones": ["Mendoza", "San Juan", "San Luis"],
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/carreton1/800/600", "filename": "carreton1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Asesoramiento en Manejo Integrado de Cultivos",
                "slug": "asesoramiento-manejo-integrado-cultivos",
                "description": "Seguimiento agronómico por ambiente, monitoreo de plagas y planificación de aplicaciones para cultivos extensivos.",
                "category_id": cat_asesoramiento.id,
                "price": 12000.0,
                "currency": "ARS",
                "stock": 5000,
                "unit": "hectárea",
                "publication_type": "servicio",
                "pricing_type": "por_hectarea",
                "availability": "programar",
                "response_time": "24hs",
                "experience_years": 8,
                "has_equipment": True,
                "coverage_zones": ["Buenos Aires", "Santa Fe"],
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/asesoramiento-cultivos1/800/600", "filename": "asesoramiento-cultivos1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Planificación de Riego y Fertirriego",
                "slug": "planificacion-riego-fertirriego",
                "description": "Diseño y ajuste de riego presurizado para viñedos, frutales y horticultura. Incluye balance hídrico y plan de fertirriego.",
                "category_id": cat_asesoramiento.id,
                "price": 280000.0,
                "currency": "ARS",
                "stock": 50,
                "unit": "proyecto",
                "publication_type": "servicio",
                "pricing_type": "por_trabajo",
                "availability": "programar",
                "response_time": "48hs",
                "experience_years": 10,
                "has_equipment": False,
                "coverage_zones": ["Mendoza", "San Juan"],
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/riego1/800/600", "filename": "riego1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Mantenimiento Preventivo de Cosechadoras",
                "slug": "mantenimiento-preventivo-cosechadoras",
                "description": "Revisión de motor, transmisión, sistema de trilla, correas y electrónica antes de campaña. Informe de estado y repuestos sugeridos.",
                "category_id": cat_mantenimiento.id,
                "price": 650000.0,
                "currency": "ARS",
                "stock": 30,
                "unit": "equipo",
                "publication_type": "servicio",
                "pricing_type": "por_trabajo",
                "availability": "programar",
                "response_time": "48hs",
                "experience_years": 14,
                "has_equipment": True,
                "coverage_zones": ["La Pampa", "Córdoba"],
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/mantenimiento-cosechadora1/800/600", "filename": "mantenimiento-cosechadora1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Reparación Hidráulica de Maquinaria Agrícola",
                "slug": "reparacion-hidraulica-maquinaria-agricola",
                "description": "Diagnóstico y reparación de bombas, cilindros, válvulas y mangueras hidráulicas. Servicio en taller o a campo.",
                "category_id": cat_mantenimiento.id,
                "price": 0.0,
                "currency": "ARS",
                "stock": 100,
                "unit": "servicio",
                "publication_type": "servicio",
                "pricing_type": "a_convenir",
                "availability": "inmediata",
                "response_time": "inmediato",
                "experience_years": 16,
                "has_equipment": True,
                "coverage_zones": ["Chaco", "Corrientes"],
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/hidraulica1/800/600", "filename": "hidraulica1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Muestreo de Suelo y Recomendación de Fertilización",
                "slug": "muestreo-suelo-recomendacion-fertilizacion",
                "description": "Muestreo georreferenciado por ambientes, envío a laboratorio e interpretación agronómica con recomendación de fertilización.",
                "category_id": cat_otros_servicios.id,
                "price": 7500.0,
                "currency": "ARS",
                "stock": 3000,
                "unit": "hectárea",
                "publication_type": "servicio",
                "pricing_type": "por_hectarea",
                "availability": "programar",
                "response_time": "24hs",
                "experience_years": 7,
                "has_equipment": True,
                "coverage_zones": ["Tucumán", "Santiago del Estero"],
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/muestreo-suelo1/800/600", "filename": "muestreo-suelo1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Instalación y Reparación de Alambrados Rurales",
                "slug": "instalacion-reparacion-alambrados-rurales",
                "description": "Construcción de alambrados tradicionales y eléctricos, reparación de líneas y colocación de tranqueras para establecimientos ganaderos.",
                "category_id": cat_otros_servicios.id,
                "price": 0.0,
                "currency": "ARS",
                "stock": 10000,
                "unit": "metro",
                "publication_type": "servicio",
                "pricing_type": "a_convenir",
                "availability": "programar",
                "response_time": "48hs",
                "experience_years": 13,
                "has_equipment": True,
                "coverage_zones": ["Salta", "Jujuy"],
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/alambrados1/800/600", "filename": "alambrados1.jpg", "display_order": 1, "is_primary": True}
                ]
            }
        ]

        product_localities = {
            "semillas-maiz-dk-premium": ("14014010", "Córdoba, Córdoba"),
            "fertilizante-triple-15": ("06623100", "Pergamino, Buenos Aires"),
            "pulverizadora-jacto-600": ("14098230", "Río Cuarto, Córdoba"),
            "semillas-soja-rr-intacta": ("82084270", "Rosario, Santa Fe"),
            "cosechadora-john-deere-9750": ("06063010", "Balcarce, Buenos Aires"),
            "herbicida-glifosato-20l": ("82042290", "Venado Tuerto, Santa Fe"),
            "servicio-siembra-gps": ("06791050", "Tandil, Buenos Aires"),
            "rastra-discos-24-platos": ("06063010", "Balcarce, Buenos Aires"),
            "terneros-angus-lote-20": ("82084270", "Rosario, Santa Fe"),
            "vaquillonas-braford-prenadas": ("14098230", "Río Cuarto, Córdoba"),
            "dron-pulverizador-agricola-20l": ("06623100", "Pergamino, Buenos Aires"),
            "sensores-humedad-suelo-iot": ("06791050", "Tandil, Buenos Aires"),
            "urea-granulada-46-nitrogeno": ("30084160", "Paraná, Entre Ríos"),
            "tractor-pauny-280a-doble-traccion": ("42105030", "General Pico, La Pampa"),
            "insecticida-lambda-cihalotrina-1l": ("22140060", "Resistencia, Chaco"),
            "servicio-cosecha-monitor-rendimiento": ("66028050", "Salta, Salta"),
            "transporte-granos-a-puerto": ("82084270", "Rosario, Santa Fe"),
            "flete-maquinaria-agricola-carreton": ("50007010", "Mendoza, Mendoza"),
            "asesoramiento-manejo-integrado-cultivos": ("06623100", "Pergamino, Buenos Aires"),
            "planificacion-riego-fertirriego": ("50007010", "Mendoza, Mendoza"),
            "mantenimiento-preventivo-cosechadoras": ("42105030", "General Pico, La Pampa"),
            "reparacion-hidraulica-maquinaria-agricola": ("22140060", "Resistencia, Chaco"),
            "muestreo-suelo-recomendacion-fertilizacion": ("90084010", "San Miguel de Tucumán, Tucumán"),
            "instalacion-reparacion-alambrados-rurales": ("66028050", "Salta, Salta"),
        }
        
        for prod_data in productos:
            product_values = prod_data.copy()
            images_data = product_values.pop("images", [])
            locality_id, location = product_localities[product_values["slug"]]
            product_values["locality_id"] = locality_id
            product_values["location"] = location

            # Verificar si el producto ya existe
            existing_prod = db.query(Product).filter(
                Product.slug == product_values["slug"]
            ).first()
            if not existing_prod:
                # Crear producto
                product = Product(**product_values)
                product.published_at = datetime.utcnow()
                db.add(product)
                db.flush()  # Para obtener el ID del producto
                
                # Crear imágenes
                for img_data in images_data:
                    img = ProductImage(
                        product_id=product.id,
                        **img_data
                    )
                    db.add(img)
                
                print(f"  ✅ Producto creado: {product.name}")
            else:
                existing_prod.locality_id = locality_id
                existing_prod.location = location
                print(f"  ⏭️  Producto '{product_values['name']}' ya existe")
        
        db.commit()
        
        print("\n✨ Seed completado exitosamente!")
        print("\n📝 Credenciales de acceso:")
        print("  Admin:    admin@topgreen.com / admin123")
        print("  Vendedor: vendedor@ejemplo.com / vendedor123")
        print("  Cliente:  cliente@ejemplo.com / cliente123")
        print(f"\n📦 {len(productos)} productos de ejemplo disponibles")
        
    except Exception as e:
        print(f"\n❌ Error durante el seed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_seed_data()
