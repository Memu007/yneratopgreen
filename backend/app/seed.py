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
from app.models.subcategory import Subcategory
from app.models.form_option import FormOption
from app.models.locality import Locality
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

        # Transportista demo. Existe para que el perfil de transportista se
        # pueda abrir y medir en una instalación limpia: sin una cuenta así, esa
        # media pantalla no la ve ninguna puerta automática.
        #
        # La localidad base sale del padrón oficial que se acaba de sembrar. Si
        # no estuviera, se corta acá: un transportista sin localidad es un
        # perfil incompleto que la API rechaza al editarlo, y prefiero que falle
        # el seed antes que dejar una cuenta rota.
        carrier = db.query(User).filter(User.email == "transportista@ejemplo.com").first()
        if not carrier:
            base = db.query(Locality).filter(
                Locality.name == "Pergamino",
                Locality.province_name == "Buenos Aires",
            ).first()
            if not base:
                raise RuntimeError(
                    "El padrón no tiene Pergamino (Buenos Aires): no se puede "
                    "crear el transportista demo con una localidad oficial."
                )
            carrier = User(
                email="transportista@ejemplo.com",
                password_hash=hash_password("transportista123"),
                full_name="Carlos Transportista",
                phone="+54 2477 55-0101",
                role=UserRole.USER,
                is_active=True,
                is_verified=True,
                location="Ruta 8 km 220, Pergamino, Buenos Aires",
                is_carrier=True,
                carrier_base_locality_id=base.id,
                # El tipo, sin el dominio adentro: para eso están ahora los
                # campos propios de acá abajo.
                carrier_transport="Camión con acoplado",
                carrier_transport_certified=True,
                carrier_certification_detail=(
                    "Declaración demo: RUTA habilitación de transporte de "
                    "cargas generales, sin número real"
                ),
                carrier_certification_declared_at=datetime.utcnow(),
                carrier_coverage_radius_km=250,
                carrier_capacity="Hasta 30 toneladas de granos",
                carrier_vehicle_model="Scania R450",
                # Dominio SINTETICO: el formato no corresponde a ninguna patente
                # real emitida. Es privado y sale sólo después de seleccionarlo.
                carrier_plate="DEMO 01",
                carrier_cargo_types=["granos_a_granel", "maquinaria"],
            )
            db.add(carrier)
            print("  ✅ Transportista creado: transportista@ejemplo.com / transportista123")
        else:
            # Los tres datos son nuevos, así que un transportista demo de una
            # instalación anterior los tiene vacíos. Se completan SÓLO si están
            # vacíos, igual que los datos bancarios: repetir el seed nunca pisa
            # algo que alguien haya personalizado.
            completados = []
            if not carrier.carrier_vehicle_model:
                carrier.carrier_vehicle_model = "Scania R450"
                completados.append("marca y modelo")
            if not carrier.carrier_plate:
                carrier.carrier_plate = "DEMO 01"
                completados.append("dominio")
            if not carrier.carrier_cargo_types:
                carrier.carrier_cargo_types = ["granos_a_granel", "maquinaria"]
                completados.append("cargas declaradas")
            if completados:
                print(f"  ✅ Transportista: completado {', '.join(completados)}")
            else:
                print("  ⏭️  Transportista ya existe")


        # === DATOS BANCARIOS DEMO === #
        # Sin CBU ni alias, una instalacion limpia no puede usar la
        # transferencia: los dos usuarios que publican en el catalogo demo
        # tienen que quedar utilizables sin configuracion manual.
        #
        # Son valores SINTETICOS, no corresponden a ninguna cuenta real: el
        # prefijo 000 no es un codigo de banco existente y el alias dice
        # "demo". Solo se completan si el campo esta vacio, asi repetir el
        # seed nunca pisa un dato que alguien haya personalizado.
        bancarios_demo = {
            "admin@topgreen.com": ("0000009000000000000017", "demo.topgreen.admin"),
            "vendedor@ejemplo.com": ("0000009000000000000024", "demo.topgreen.juanv"),
        }
        for usuario in (admin, seller):
            # se usan los objetos que ya estan en memoria y no una consulta:
            # en una base recien creada todavia estan pendientes de volcado
            # -la sesion no tiene autoflush- y una consulta no los encuentra.
            # Ese error dejaba el PRIMER seed sin datos bancarios.
            email = usuario.email
            cbu_demo, alias_demo = bancarios_demo[email]
            completados = []
            if not (usuario.cbu or "").strip():
                usuario.cbu = cbu_demo
                completados.append("CBU")
            if not (usuario.alias_bancario or "").strip():
                usuario.alias_bancario = alias_demo
                completados.append("alias")
            if completados:
                print(f"  \U0001F3E6 {email}: {' y '.join(completados)} demo")
            else:
                print(f"  \u23ED\uFE0F  {email}: ya tenia datos bancarios, no se tocan")

        db.commit()
        
        # === CATEGORÍAS === #
        print("\n📦 Creando categorías...")
        
        categories_data = [
            {
                "name": "Maquinaria agrícola",
                "slug": "maquinaria-agricola",
                "description": "Maquinaria para preparación, siembra, protección, cosecha y postcosecha",
                "icon": "🚜",
                "display_order": "01",
                "subcategories": [
                    ("tractores", "Tractores"),
                    ("preparacion-suelo", "Preparación del suelo"),
                    ("siembra-plantacion", "Siembra y plantación"),
                    ("fertilizacion-proteccion", "Fertilización y protección"),
                    ("cosecha", "Cosecha"),
                    ("postcosecha", "Postcosecha"),
                    ("forrajes-ganaderia", "Forrajes y ganadería"),
                ],
            },
            {
                "name": "Riego y drenaje",
                "slug": "riego-drenaje",
                "description": "Equipos y accesorios para riego, drenaje y control hídrico",
                "icon": "💧",
                "display_order": "02",
                "subcategories": [
                    ("riego-aspersion", "Riego por aspersión"),
                    ("riego-localizado", "Riego localizado"),
                    ("riego-superficial-subterraneo", "Riego superficial y subterráneo"),
                    ("bombas-motobombas-accesorios", "Bombas, motobombas y accesorios hidráulicos"),
                    ("drenaje-control-hidrico", "Drenaje y control hídrico"),
                    ("otros", "Otros"),
                ],
            },
            {
                "name": "Insumos agrícolas",
                "slug": "insumos-agricolas",
                "description": "Semillas, fertilizantes, correctivos y productos para el cultivo",
                "icon": "🌱",
                "display_order": "03",
                "subcategories": [
                    ("semillas-plantulas", "Semillas y plántulas"),
                    ("fertilizantes", "Fertilizantes"),
                    ("correctivos", "Correctivos"),
                    ("agroinsumos-biologicos", "Agroinsumos biológicos"),
                    ("agroquimicos", "Agroquímicos"),
                    ("sustratos-coberturas", "Sustratos y coberturas"),
                    ("otros", "Otros"),
                ],
            },
            {
                "name": "Ganadería y forrajes",
                "slug": "ganaderia-forrajes",
                "description": "Equipamiento para manejo, sanidad y suplementación animal",
                "icon": "🐄",
                "display_order": "04",
                "subcategories": [
                    ("cercas-bebederos", "Cercas y bebederos"),
                    ("manejo-animal", "Manejo animal"),
                    ("ordeno-sanidad", "Ordeño y sanidad"),
                    ("suplementacion", "Suplementación"),
                    ("otros", "Otros"),
                ],
            },
            {
                "name": "Repuestos y mantenimiento",
                "slug": "repuestos-mantenimiento",
                "description": "Repuestos, consumibles y componentes para maquinaria agrícola",
                "icon": "🔧",
                "display_order": "05",
                "subcategories": [
                    ("neumaticos-camaras", "Neumáticos y cámaras"),
                    ("filtros-correas-cuchillas-cadenas", "Filtros, correas, cuchillas, cadenas"),
                    ("sistemas-hidraulicos", "Sistemas hidráulicos"),
                    ("sistemas-electronicos-sensores", "Sistemas electrónicos y sensores"),
                    ("lubricantes-baterias", "Lubricantes y baterías"),
                    ("otros", "Otros"),
                ],
            },
            {
                "name": "Agricultura de precisión y tecnología",
                "slug": "agricultura-precision-tecnologia",
                "description": "Tecnología de guiado, sensores, drones y software agrícola",
                "icon": "🛰️",
                "display_order": "06",
                "subcategories": [
                    ("sistemas-guiado-gnss", "Sistemas de guiado y GNSS"),
                    ("sensores-cultivo", "Sensores de cultivo"),
                    ("drones-vants", "Drones y VANTs"),
                    ("software-plataformas", "Software y plataformas"),
                ],
            },
            {
                "name": "Tierras y parcelas",
                "slug": "tierras-parcelas",
                "description": "Ofertas de compra, alquiler y leasing de tierras rurales",
                "icon": "🌾",
                "display_order": "07",
                "subcategories": [
                    ("compra-venta-definitiva", "Compra-venta definitiva"),
                    ("mejoras-infraestructura-compra", "Mejoras de infraestructura (compra)"),
                    ("alquiler-campana", "Alquiler por campaña (1-12 meses)"),
                    ("mejoras-infraestructura-alquiler", "Mejoras infraestructura (alquiler)"),
                    ("alquiler-uso-transitorio", "Alquiler por uso transitorio"),
                    ("mejoras-alquiler-transitorio", "Mejoras (alquiler transitorio)"),
                    ("alquiler-opcion-compra", "Alquiler con opción a compra"),
                    ("mejoras-leasing", "Mejoras (leasing)"),
                ],
            },
            {
                "name": "Bienes y Ganado",
                "slug": "bienes-ganado",
                "description": "Animales de cría y comerciales, según el alcance contractual",
                "icon": "🐂",
                "display_order": "08",
                "subcategories": [("bovinos", "Bovinos")],
            },
            {
                "name": "Asesoramiento",
                "slug": "asesoramiento",
                "description": "Asesoramiento agronómico y técnico",
                "icon": "📋",
                "display_order": "20",
                "is_service": True,
                "subcategories": [],
            },
            {
                "name": "Contratistas",
                "slug": "contratistas",
                "description": "Labores y mantenimiento agrícola a cargo de contratistas",
                "icon": "🧑‍🌾",
                "display_order": "21",
                "is_service": True,
                "subcategories": [],
            },
            {
                "name": "Logística",
                "slug": "logistica",
                "description": "Transporte de granos, insumos y maquinaria",
                "icon": "🚚",
                "display_order": "22",
                "is_service": True,
                "subcategories": [],
            },
            {
                "name": "Acopio",
                "slug": "acopio",
                "description": "Servicios de recepción, guarda y acondicionamiento de granos",
                "icon": "🏭",
                "display_order": "23",
                "is_service": True,
                "subcategories": [],
            },
        ]

        for cat_data in categories_data:
            category_values = cat_data.copy()
            subcategories = category_values.pop("subcategories")
            existing_cat = db.query(Category).filter(
                Category.slug == category_values["slug"]
            ).first()
            if not existing_cat:
                existing_cat = Category(**category_values)
                db.add(existing_cat)
                db.flush()
                print(f"  ✅ Categoría creada: {category_values['name']}")
            else:
                for field, value in category_values.items():
                    setattr(existing_cat, field, value)
                existing_cat.is_active = True
                print(f"  ⏭️  Categoría '{category_values['name']}' ya existe")

            for display_order, (subcategory_slug, subcategory_name) in enumerate(
                subcategories,
                start=1,
            ):
                existing_subcategory = db.query(Subcategory).filter(
                    Subcategory.category_id == existing_cat.id,
                    Subcategory.slug == subcategory_slug,
                ).first()
                if not existing_subcategory:
                    db.add(Subcategory(
                        name=subcategory_name,
                        slug=subcategory_slug,
                        category_id=existing_cat.id,
                        display_order=display_order,
                        is_active=True,
                    ))
                else:
                    existing_subcategory.name = subcategory_name
                    existing_subcategory.display_order = display_order
                    existing_subcategory.is_active = True
        
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
        categories_by_slug = {
            category.slug: category
            for category in db.query(Category).filter(
                Category.slug.in_([item["slug"] for item in categories_data])
            ).all()
        }

        def category(slug):
            return categories_by_slug[slug]

        def subcategory(category_slug, subcategory_slug):
            return db.query(Subcategory).filter(
                Subcategory.category_id == category(category_slug).id,
                Subcategory.slug == subcategory_slug,
            ).one()

        # Alias usados en las definiciones existentes. El mapa explícito de
        # product_taxonomy de abajo fija la categoría y subcategoría finales.
        cat_semillas = category("insumos-agricolas")
        cat_fertilizantes = category("insumos-agricolas")
        cat_herramientas = category("maquinaria-agricola")
        cat_maquinaria = category("maquinaria-agricola")
        cat_laboreo = category("contratistas")
        cat_transporte = category("logistica")
        cat_acopio = category("acopio")
        cat_asesoramiento = category("asesoramiento")
        cat_mantenimiento = category("contratistas")
        cat_otros_servicios = category("contratistas")
        cat_agroquimicos = category("insumos-agricolas")
        cat_bienes_ganado = category("bienes-ganado")
        cat_tecnologia = category("agricultura-precision-tecnologia")
        
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
                "name": "Recepción, Secado y Acopio de Granos",
                "slug": "recepcion-secado-acopio-granos",
                "description": "Recepción de soja, maíz y trigo con análisis de calidad, secado controlado y guarda en planta. Emisión de comprobantes y coordinación de entrega.",
                "category_id": cat_acopio.id,
                "price": 1850.0,
                "currency": "ARS",
                "stock": 25000,
                "unit": "tonelada",
                "publication_type": "servicio",
                "pricing_type": "por_trabajo",
                "availability": "inmediata",
                "response_time": "24hs",
                "experience_years": 18,
                "has_equipment": True,
                "coverage_zones": ["Santa Fe", "Buenos Aires", "Córdoba"],
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/acopio-granos1/800/600", "filename": "acopio-granos1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Guarda de Granos en Silo Bolsa",
                "slug": "guarda-granos-silo-bolsa",
                "description": "Provisión, llenado y monitoreo de silo bolsa para guarda temporal de granos en el establecimiento. Incluye control periódico de humedad y condición del almacenamiento.",
                "category_id": cat_acopio.id,
                "price": 95000.0,
                "currency": "ARS",
                "stock": 120,
                "unit": "servicio",
                "publication_type": "servicio",
                "pricing_type": "por_trabajo",
                "availability": "programar",
                "response_time": "48hs",
                "experience_years": 12,
                "has_equipment": True,
                "coverage_zones": ["Buenos Aires", "La Pampa"],
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/silo-bolsa1/800/600", "filename": "silo-bolsa1.jpg", "display_order": 1, "is_primary": True}
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
            },
            {
                "name": "Equipo de Riego por Goteo para 10 Hectáreas",
                "slug": "equipo-riego-goteo-10-hectareas",
                "description": "Kit completo para riego por goteo de hasta 10 hectáreas, con cabezal de filtrado, cañería principal, cintas y accesorios de conexión.",
                "category_id": category("riego-drenaje").id,
                "price": 4800000.0,
                "currency": "ARS",
                "stock": 6,
                "unit": "kit",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/riego-goteo1/800/600", "filename": "riego-goteo1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Manga Ganadera con Balanza Electrónica",
                "slug": "manga-ganadera-balanza-electronica",
                "description": "Manga reforzada para manejo bovino con cepo, puertas laterales y balanza electrónica de hasta 1.500 kg. Lista para instalar.",
                "category_id": category("ganaderia-forrajes").id,
                "price": 7600000.0,
                "currency": "ARS",
                "stock": 2,
                "unit": "unidad",
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/manga-ganadera1/800/600", "filename": "manga-ganadera1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Kit de Filtros y Correas para Cosechadora",
                "slug": "kit-filtros-correas-cosechadora",
                "description": "Juego de filtros de aire, combustible y aceite con correas de mando para mantenimiento preventivo de cosechadoras de granos.",
                "category_id": category("repuestos-mantenimiento").id,
                "price": 540000.0,
                "currency": "ARS",
                "stock": 18,
                "unit": "kit",
                "seller_id": seller.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/repuestos-cosechadora1/800/600", "filename": "repuestos-cosechadora1.jpg", "display_order": 1, "is_primary": True}
                ]
            },
            {
                "name": "Campo Agrícola de 120 Hectáreas",
                "slug": "campo-agricola-120-hectareas",
                "description": "Campo agrícola de 120 hectáreas con aptitud para soja, maíz y trigo, acceso consolidado, energía rural y mejoras de trabajo.",
                "category_id": category("tierras-parcelas").id,
                "price": 950000000.0,
                "currency": "ARS",
                "stock": 1,
                "unit": "campo",
                "seller_id": admin.id,
                "status": ProductStatus.ACTIVE,
                "images": [
                    {"url": "https://picsum.photos/seed/campo-agricola1/800/600", "filename": "campo-agricola1.jpg", "display_order": 1, "is_primary": True}
                ]
            }
        ]

        product_taxonomy = {
            "semillas-maiz-dk-premium": ("insumos-agricolas", "semillas-plantulas"),
            "fertilizante-triple-15": ("insumos-agricolas", "fertilizantes"),
            "pulverizadora-jacto-600": ("maquinaria-agricola", "fertilizacion-proteccion"),
            "semillas-soja-rr-intacta": ("insumos-agricolas", "semillas-plantulas"),
            "cosechadora-john-deere-9750": ("maquinaria-agricola", "cosecha"),
            "herbicida-glifosato-20l": ("insumos-agricolas", "agroquimicos"),
            "servicio-siembra-gps": ("contratistas", None),
            "rastra-discos-24-platos": ("maquinaria-agricola", "preparacion-suelo"),
            "terneros-angus-lote-20": ("bienes-ganado", "bovinos"),
            "vaquillonas-braford-prenadas": ("bienes-ganado", "bovinos"),
            "dron-pulverizador-agricola-20l": (
                "agricultura-precision-tecnologia",
                "drones-vants",
            ),
            "sensores-humedad-suelo-iot": (
                "agricultura-precision-tecnologia",
                "sensores-cultivo",
            ),
            "urea-granulada-46-nitrogeno": ("insumos-agricolas", "fertilizantes"),
            "tractor-pauny-280a-doble-traccion": ("maquinaria-agricola", "tractores"),
            "insecticida-lambda-cihalotrina-1l": ("insumos-agricolas", "agroquimicos"),
            "servicio-cosecha-monitor-rendimiento": ("contratistas", None),
            "transporte-granos-a-puerto": ("logistica", None),
            "flete-maquinaria-agricola-carreton": ("logistica", None),
            "recepcion-secado-acopio-granos": ("acopio", None),
            "guarda-granos-silo-bolsa": ("acopio", None),
            "asesoramiento-manejo-integrado-cultivos": ("asesoramiento", None),
            "planificacion-riego-fertirriego": ("asesoramiento", None),
            "mantenimiento-preventivo-cosechadoras": ("contratistas", None),
            "reparacion-hidraulica-maquinaria-agricola": ("contratistas", None),
            "muestreo-suelo-recomendacion-fertilizacion": ("asesoramiento", None),
            "instalacion-reparacion-alambrados-rurales": ("contratistas", None),
            "equipo-riego-goteo-10-hectareas": ("riego-drenaje", "riego-localizado"),
            "manga-ganadera-balanza-electronica": ("ganaderia-forrajes", "manejo-animal"),
            "kit-filtros-correas-cosechadora": (
                "repuestos-mantenimiento",
                "filtros-correas-cuchillas-cadenas",
            ),
            "campo-agricola-120-hectareas": ("tierras-parcelas", "compra-venta-definitiva"),
        }

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
            "recepcion-secado-acopio-granos": ("82084270", "Rosario, Santa Fe"),
            "guarda-granos-silo-bolsa": ("06623100", "Pergamino, Buenos Aires"),
            "asesoramiento-manejo-integrado-cultivos": ("06623100", "Pergamino, Buenos Aires"),
            "planificacion-riego-fertirriego": ("50007010", "Mendoza, Mendoza"),
            "mantenimiento-preventivo-cosechadoras": ("42105030", "General Pico, La Pampa"),
            "reparacion-hidraulica-maquinaria-agricola": ("22140060", "Resistencia, Chaco"),
            "muestreo-suelo-recomendacion-fertilizacion": ("90084010", "San Miguel de Tucumán, Tucumán"),
            "instalacion-reparacion-alambrados-rurales": ("66028050", "Salta, Salta"),
            "equipo-riego-goteo-10-hectareas": ("50007010", "Mendoza, Mendoza"),
            "manga-ganadera-balanza-electronica": ("22140060", "Resistencia, Chaco"),
            "kit-filtros-correas-cosechadora": ("42105030", "General Pico, La Pampa"),
            "campo-agricola-120-hectareas": ("06623100", "Pergamino, Buenos Aires"),
        }
        
        for prod_data in productos:
            product_values = prod_data.copy()
            images_data = product_values.pop("images", [])
            locality_id, location = product_localities[product_values["slug"]]
            category_slug, subcategory_slug = product_taxonomy[product_values["slug"]]
            product_values["category_id"] = category(category_slug).id
            product_values["subcategory_id"] = (
                subcategory(category_slug, subcategory_slug).id
                if subcategory_slug
                else None
            )
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
                existing_prod.category_id = product_values["category_id"]
                existing_prod.subcategory_id = product_values["subcategory_id"]
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
