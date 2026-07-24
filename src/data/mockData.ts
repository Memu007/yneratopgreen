import { Product } from '../types';

export const mockProducts: Product[] = [
  // Semillas
  {
    id: '1',
    name: 'Semilla de Maíz Híbrido DK 670',
    category: 'Semillas',
    subcategory: 'Maíz',
    price: 45000,
    currency: 'ARS',
    description: 'Semilla de maíz híbrido de alto rendimiento, ideal para zona pampeana. Excelente comportamiento ante sequía.',
    image: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400',
    location: {
      province: 'Buenos Aires',
      city: 'Pergamino'
    },
    seller: {
      id: 's1',
      name: 'Semillería La Pampa',
      rating: 4.8,
      ratingCount: 0,
      salesCount: 1250,
      address: {
        province: 'Buenos Aires',
        city: 'Pergamino',
        street: 'Av. San Martín 1245'
      }
    },
    stock: 500,
    unit: 'bolsa 20kg',
    features: {
      'Ciclo': '130 días',
      'Rendimiento': '12-14 tn/ha',
      'Densidad': '70.000 plantas/ha'
    },
    tags: ['alto rendimiento', 'resistente sequía', 'híbrido'],
    createdAt: '2026-01-15'
  },
  {
    id: '2',
    name: 'Semilla de Soja DM 4670',
    category: 'Semillas',
    subcategory: 'Soja',
    price: 38000,
    currency: 'ARS',
    description: 'Soja de grupo 4, con excelente sanidad y potencial de rinde. Tecnología RR.',
    image: 'https://images.unsplash.com/photo-1566281796817-93bc94d7dbd2?w=400',
    location: {
      province: 'Santa Fe',
      city: 'Rosario'
    },
    seller: {
      id: 's2',
      name: 'AgroSemillas del Litoral',
      rating: 4.9,
      ratingCount: 0,
      salesCount: 2100,
      address: {
        province: 'Santa Fe',
        city: 'Rosario',
        street: 'Ruta 9 Km 302'
      }
    },
    stock: 800,
    unit: 'bolsa 25kg',
    features: {
      'Grupo de madurez': 'IV corto',
      'Rendimiento': '4.500 kg/ha',
      'Tecnología': 'RR'
    },
    tags: ['soja', 'RR', 'alto rinde'],
    createdAt: '2026-01-14'
  },
  // Fertilizantes
  {
    id: '3',
    name: 'Fertilizante Urea Granulada 46-0-0',
    category: 'Fertilizantes',
    subcategory: 'Nitrogenados',
    price: 28500,
    currency: 'ARS',
    description: 'Urea granulada al 46% de nitrógeno. Ideal para aplicación en cobertura en cultivos de maíz, trigo y pasturas.',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400',
    location: {
      province: 'Córdoba',
      city: 'Río Cuarto'
    },
    seller: {
      id: 's3',
      name: 'Fertilizantes del Centro',
      rating: 4.7,
      ratingCount: 0,
      salesCount: 980,
      address: {
        province: 'Córdoba',
        city: 'Río Cuarto',
        street: 'Bv. Roca 850'
      }
    },
    stock: 1200,
    unit: 'bolsa 50kg',
    features: {
      'Nitrógeno total': '46%',
      'Granulometría': '2-4 mm',
      'Humedad': '<0.5%'
    },
    tags: ['urea', 'nitrógeno', 'cobertura'],
    createdAt: '2026-01-13'
  },
  {
    id: '4',
    name: 'Fosfato Diamónico DAP 18-46-0',
    category: 'Fertilizantes',
    subcategory: 'Fosfatados',
    price: 32000,
    currency: 'ARS',
    description: 'Fertilizante fosfatado de arranque. Ideal para siembra de cultivos extensivos.',
    image: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=400',
    location: {
      province: 'Buenos Aires',
      city: 'Bahía Blanca'
    },
    seller: {
      id: 's4',
      name: 'Insumos del Sur',
      rating: 4.6,
      ratingCount: 0,
      salesCount: 756,
      address: {
        province: 'Buenos Aires',
        city: 'Bahía Blanca',
        street: 'Av. Alem 2340'
      }
    },
    stock: 600,
    unit: 'bolsa 50kg',
    features: {
      'Nitrógeno': '18%',
      'Fósforo (P2O5)': '46%',
      'Solubilidad': 'Alta'
    },
    tags: ['fosfato', 'arranque', 'siembra'],
    createdAt: '2026-01-12'
  },
  // Agroquímicos
  {
    id: '5',
    name: 'Herbicida Glifosato 66.2% - 20L',
    category: 'Agroquímicos',
    subcategory: 'Herbicidas',
    price: 85000,
    currency: 'ARS',
    description: 'Herbicida sistémico no selectivo. Presentación concentrada de alta eficiencia.',
    image: 'https://images.unsplash.com/photo-1584279094798-9f6a00f0fe6e?w=400',
    location: {
      province: 'Santa Fe',
      city: 'Venado Tuerto'
    },
    seller: {
      id: 's5',
      name: 'AgroDefensa SA',
      rating: 4.9,
      ratingCount: 0,
      salesCount: 1850,
      address: {
        province: 'Santa Fe',
        city: 'Venado Tuerto',
        street: 'Parque Industrial Lote 45'
      }
    },
    stock: 350,
    unit: 'bidón 20L',
    features: {
      'Concentración': '66.2%',
      'Tipo': 'Sistémico',
      'Acción': 'No selectivo'
    },
    tags: ['glifosato', 'herbicida', 'malezas'],
    createdAt: '2026-01-11'
  },
  {
    id: '6',
    name: 'Insecticida Cipermetrina 25% - 1L',
    category: 'Agroquímicos',
    subcategory: 'Insecticidas',
    price: 12500,
    currency: 'ARS',
    description: 'Insecticida piretroide de amplio espectro. Controla orugas, pulgones y chinches.',
    image: 'https://images.unsplash.com/photo-1593113646773-028c67f46f4b?w=400',
    location: {
      province: 'Córdoba',
      city: 'Villa María'
    },
    seller: {
      id: 's6',
      name: 'Fitosanitarios Córdoba',
      rating: 4.7,
      ratingCount: 0,
      salesCount: 1120,
      address: {
        province: 'Córdoba',
        city: 'Villa María',
        street: 'Av. Dante Alighieri 567'
      }
    },
    stock: 480,
    unit: 'botella 1L',
    features: {
      'Principio activo': 'Cipermetrina 25%',
      'Clase': 'Piretroide',
      'Espectro': 'Amplio'
    },
    tags: ['insecticida', 'orugas', 'pulgones'],
    createdAt: '2026-01-10'
  },
  // Maquinaria
  {
    id: '7',
    name: 'Sembradora de Precisión 12 Surcos',
    category: 'Maquinaria',
    subcategory: 'Siembra',
    price: 15800000,
    currency: 'ARS',
    description: 'Sembradora neumática de precisión para siembra directa. 12 surcos a 52.5cm. Sistema de dosificación neumático.',
    image: 'https://images.unsplash.com/photo-1625246318776-f86f564c3e85?w=400',
    location: {
      province: 'Buenos Aires',
      city: 'Chivilcoy'
    },
    seller: {
      id: 's7',
      name: 'Maquinarias Agrícolas del Sur',
      rating: 4.8,
      ratingCount: 0,
      salesCount: 45,
      address: {
        province: 'Buenos Aires',
        city: 'Chivilcoy',
        street: 'Ruta 5 Km 158'
      }
    },
    stock: 3,
    unit: 'unidad',
    features: {
      'Surcos': '12',
      'Distancia': '52.5 cm',
      'Sistema': 'Neumático',
      'Tipo': 'Siembra directa'
    },
    tags: ['sembradora', 'precisión', 'siembra directa'],
    createdAt: '2026-01-09'
  },
  {
    id: '8',
    name: 'Pulverizadora Autopropulsada 3000L',
    category: 'Maquinaria',
    subcategory: 'Pulverización',
    price: 28500000,
    currency: 'ARS',
    description: 'Pulverizadora autopropulsada de alta capacidad. Tanque 3000L, botalón 28m, piloto automático.',
    image: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=400',
    location: {
      province: 'Santa Fe',
      city: 'Rafaela'
    },
    seller: {
      id: 's8',
      name: 'TecnoAgro Maquinarias',
      rating: 4.9,
      ratingCount: 0,
      salesCount: 28,
      address: {
        province: 'Santa Fe',
        city: 'Rafaela',
        street: 'Bv. Santa Fe 1890'
      }
    },
    stock: 2,
    unit: 'unidad',
    features: {
      'Capacidad tanque': '3000 L',
      'Botalón': '28 metros',
      'Tecnología': 'Piloto automático',
      'Estado': 'Nueva'
    },
    tags: ['pulverizadora', 'autopropulsada', 'tecnología'],
    createdAt: '2026-01-08'
  },
  // Productos Ganaderos
  {
    id: '9',
    name: 'Alimento Balanceado para Engorde Bovino',
    category: 'Ganadería',
    subcategory: 'Alimentación',
    price: 18500,
    currency: 'ARS',
    description: 'Alimento balanceado de alta energía para terminación de novillos. 16% proteína.',
    image: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400',
    location: {
      province: 'Buenos Aires',
      city: 'Tandil'
    },
    seller: {
      id: 's9',
      name: 'Nutrición Animal del Sur',
      rating: 4.8,
      ratingCount: 0,
      salesCount: 650,
      address: {
        province: 'Buenos Aires',
        city: 'Tandil',
        street: 'Av. del Valle 3421'
      }
    },
    stock: 2000,
    unit: 'bolsa 40kg',
    features: {
      'Proteína bruta': '16%',
      'Energía': 'Alta',
      'Destino': 'Engorde intensivo'
    },
    tags: ['balanceado', 'bovinos', 'engorde'],
    createdAt: '2026-01-07'
  },
  {
    id: '10',
    name: 'Electrificador Solar para Alambrado 40km',
    category: 'Ganadería',
    subcategory: 'Infraestructura',
    price: 165000,
    currency: 'ARS',
    description: 'Boyero eléctrico solar de alta potencia. Alcance 40km de alambrado. Panel solar incluido.',
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400',
    location: {
      province: 'Entre Ríos',
      city: 'Concordia'
    },
    seller: {
      id: 's10',
      name: 'Equipamientos Rurales Litoral',
      rating: 4.7,
      ratingCount: 0,
      salesCount: 340,
      address: {
        province: 'Entre Ríos',
        city: 'Concordia',
        street: 'Av. Urquiza 678'
      }
    },
    stock: 45,
    unit: 'unidad',
    features: {
      'Alcance': '40 km',
      'Energía': 'Solar',
      'Voltaje': '9000V',
      'Garantía': '2 años'
    },
    tags: ['boyero', 'solar', 'alambrado'],
    createdAt: '2026-01-06'
  },
  // Más productos variados
  {
    id: '11',
    name: 'Semilla de Trigo ACA 315',
    category: 'Semillas',
    subcategory: 'Trigo',
    price: 28000,
    currency: 'ARS',
    description: 'Variedad de trigo de ciclo largo, alto potencial de rinde y excelente calidad panadera.',
    image: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400',
    location: {
      province: 'Buenos Aires',
      city: 'Tres Arroyos'
    },
    seller: {
      id: 's1',
      name: 'Semillería La Pampa',
      rating: 4.8,
      ratingCount: 0,
      salesCount: 1250,
      address: {
        province: 'Buenos Aires',
        city: 'Tres Arroyos',
        street: 'Av. San Martín 1245'
      }
    },
    stock: 600,
    unit: 'bolsa 25kg',
    features: {
      'Ciclo': 'Largo',
      'Rendimiento': '5.500 kg/ha',
      'Calidad': 'Panadera'
    },
    tags: ['trigo', 'alto rinde', 'calidad'],
    createdAt: '2026-01-05'
  },
  {
    id: '12',
    name: 'Tractor 125 HP 4x4',
    category: 'Maquinaria',
    subcategory: 'Tractores',
    price: 42000000,
    currency: 'ARS',
    description: 'Tractor agrícola 125 HP, doble tracción, cabina con aire acondicionado. 1200 horas de uso.',
    image: 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?w=400',
    location: {
      province: 'Córdoba',
      city: 'Marcos Juárez'
    },
    seller: {
      id: 's11',
      name: 'Maquinarias Usadas del Centro',
      rating: 4.6,
      ratingCount: 0,
      salesCount: 89,
      address: {
        province: 'Córdoba',
        city: 'Marcos Juárez',
        street: 'Ruta 19 Km 205'
      }
    },
    stock: 1,
    unit: 'unidad',
    features: {
      'Potencia': '125 HP',
      'Tracción': '4x4',
      'Horas': '1200 hs',
      'Estado': 'Muy bueno'
    },
    tags: ['tractor', '4x4', 'usado'],
    createdAt: '2026-01-04'
  }
];

export const categories = [
  'Todas las categorías',
  'Semillas',
  'Fertilizantes',
  'Agroquímicos',
  'Maquinaria',
  'Ganadería'
];

export const subcategories: { [key: string]: string[] } = {
  'Semillas': ['Todas', 'Maíz', 'Soja', 'Trigo', 'Girasol', 'Forrajeras'],
  'Fertilizantes': ['Todas', 'Nitrogenados', 'Fosfatados', 'Potásicos', 'Complejos'],
  'Agroquímicos': ['Todas', 'Herbicidas', 'Insecticidas', 'Fungicidas', 'Coadyuvantes'],
  'Maquinaria': ['Todas', 'Tractores', 'Siembra', 'Pulverización', 'Cosecha'],
  'Ganadería': ['Todas', 'Alimentación', 'Sanidad', 'Infraestructura', 'Genética']
};

export const provinces = [
  'Todas las provincias',
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán'
];

