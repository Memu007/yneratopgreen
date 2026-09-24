/**
 * Servicio para manejar operaciones del catálogo de productos
 */
import { apiGet } from './api';
import { Product } from '../types';
import { normalizarAnatomia, normalizarCondicion } from './anatomia';
import { esFotoDeRelleno } from './fotos';
import { fotoDemoDe } from './fotosDemo';

// Base URL para imágenes - usar variable de entorno o ruta relativa (vacía para producción)
const IMAGES_BASE_URL = import.meta.env.VITE_IMAGES_URL || '';

/**
 * Construye la URL completa para una imagen
 */
// Sin URL no se inventa una imagen. Acá había un SVG en data-URI —fondo
// verde claro, Arial, «Sin Imagen» con un símbolo— que se colaba antes del
// respaldo del sistema: una publicación sin foto terminaba mostrando un
// tercer diseño que nadie aprobó ni midió. La cadena vacía deja que
// `ProductImage` diga «Sin registro fotográfico» con los activos del paquete.
function getImageUrl(url: string | undefined): string {
  if (!url) return '';
  // Si ya es una URL completa (http/https), retornarla tal cual
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Si es una ruta relativa, agregarle la base URL (vacía en producción = ruta relativa)
  return `${IMAGES_BASE_URL}${url}`;
}

export interface SubcategoryResponse {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  product_count: number;
  is_service: boolean;
  /** Si las publicaciones de esta categoría declaran marca. Lo decide la
      categoría y no la anatomía: «activo» incluye campos y hacienda. */
  usa_marca?: boolean;
  operation_kind?: string;
  condition?: string | null;
  pricing_type?: string | null;
  availability?: string | null;
  response_time?: string | null;
  coverage_zones?: string[] | null;
  subcategories: SubcategoryResponse[];
  created_at: string;
}

export interface ProvinceResponse {
  id: string;
  name: string;
}

export interface LocalityResponse {
  id: string;
  name: string;
  /** Lo que muestra el selector: el nombre, y el departamento cuando el
      nombre se repite en la provincia. */
  label: string;
  /** Las entidades anidadas de Georef que esta localidad absorbe: repiten su
      nombre, el selector no las ofrece y lo guardado sobre ellas sigue
      valiendo. */
  nested_ids: string[];
  province_id: string;
  province_name: string;
  latitude: number;
  longitude: number;
}

/** De dónde es la PUBLICACIÓN, según el padrón oficial. Es la misma columna
    con la que el Backend filtra por provincia, así que lo que se ve en la
    tarjeta y lo que decidió el filtro son el mismo dato. No confundir con
    `SellerInfo.location`, que es texto libre del perfil de quien publica. */
export interface UbicacionDePublicacion {
  locality_id: string;
  locality: string;
  province: string;
}

export interface ProductImage {
  id: string;
  url: string;
  display_order: number;
  is_primary: boolean;
}

export interface SellerInfo {
  id: string;
  full_name: string;
  avatar_url?: string;
  location?: string;
  rating_average: number;
  rating_count: number;
  sales_count?: number;
  // Sólo lo trae el detalle: la tarjeta del listado no lo pide, y por eso el
  // distintivo aparece al abrir la publicación y no en la grilla.
  documentacion_revisada?: boolean;
}

export interface SellerBasicInfo {
  id: string;
  full_name: string;
  rating_average: number;
  rating_count: number;
}

export interface ProductFromBackend {
  publication_location?: UbicacionDePublicacion | null;
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  unit?: string;
  category_id: string;
  category_name: string;
  subcategory_id?: string;
  subcategory_name?: string;
  is_service?: boolean;
  operation_kind?: string;
  condition?: string | null;
  pricing_type?: string | null;
  availability?: string | null;
  response_time?: string | null;
  coverage_zones?: string[] | null;
  primary_image?: string;
  seller?: SellerBasicInfo;
  views_count: number;
  likes_count: number;
  sales_count: number;
  status: string;
  created_at: string;
}

export interface ProductDetailFromBackend extends ProductFromBackend {
  seller: SellerInfo;
  images: ProductImage[];
  published_at?: string;
}

/**
 * Una marca ofrecible en el Mercado, con cuántas publicaciones tiene HOY.
 *
 * La lista la arma el servidor sobre el conjunto filtrado, no el navegador
 * sobre la página que bajó: con paginación, contar acá contaría 24
 * publicaciones y llamaría a eso «el mercado».
 */
export interface MarcaDelMercado {
  value: string;
  label: string;
  count: number;
}

export interface ProductListResponse {
  items: ProductFromBackend[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
  /** Las marcas que tiene el conjunto filtrado, con cuántas publicaciones
      tiene cada una. Viene en la misma respuesta que el listado: pedirla
      aparte podría contestar sobre un conjunto distinto del dibujado. */
  brands: MarcaDelMercado[];
}

/**
 * Obtener categorías disponibles
 */
export const getCategories = async (): Promise<CategoryResponse[]> => {
  return apiGet<CategoryResponse[]>('/catalog/categories?include_empty=true');
};

export const getProvinces = async (): Promise<ProvinceResponse[]> => {
  return apiGet<ProvinceResponse[]>('/catalog/localities/provinces');
};

export const getLocalities = async (provinceId: string): Promise<LocalityResponse[]> => {
  return apiGet<LocalityResponse[]>(
    `/catalog/localities?province_id=${encodeURIComponent(provinceId)}`
  );
};

/** La opción del selector que representa una localidad guardada.

    Lo guardado puede ser una entidad anidada que el selector ya no ofrece:
    entonces se muestra la localidad que la absorbe. Sólo cambia lo que se
    ve; lo guardado cambia recién cuando se elige otra. */
export const opcionDeLocalidad = (
  localidades: Pick<LocalityResponse, 'id' | 'nested_ids'>[],
  id: string,
): string => localidades.find((l) => l.id === id || l.nested_ids.includes(id))?.id ?? id;

/**
 * Obtener listado de productos con filtros
 */
export const getProducts = async (params: {
  search?: string;
  category?: string;
  /** Subcategoría, por id. Viaja a la consulta como la categoría: filtrarla
      acá sería filtrar la página que bajó, y el total dejaría de describir
      lo que se está mirando. */
  subcategory?: string;
  province?: string;
  locality_id?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  seller_id?: string;
  /** Producto o servicio, filtrado en la base. Sin esto hay que bajar una
      página del catálogo entero y filtrarla acá, que sólo funciona mientras el
      catálogo entre en una página. */
  publication_type?: 'producto' | 'servicio';
  /** Calificación mínima del vendedor, 0 a 5. Mismo motivo que la
      subcategoría. */
  min_rating?: number;
  /** Nuevo o usado. La API la valida contra esos dos valores: un tercero
      responde 422 en vez de descartarse en silencio. */
  condition?: 'nuevo' | 'usado';
  /** Marca, por `value` de la opción y no por etiqueta. Se ofrece sólo lo
      que la faceta de la respuesta anterior trajo, así que una marca sin
      resultados no llega a pedirse. */
  brand?: string;
  sort_by?: 'created_at' | 'price' | 'sales' | 'views' | 'rating';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
} = {}): Promise<ProductListResponse> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/catalog/products${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  return apiGet<ProductListResponse>(endpoint);
};

/**
 * Obtener detalle de un producto
 */
export const getProductDetail = async (productId: string): Promise<ProductDetailFromBackend> => {
  return apiGet<ProductDetailFromBackend>(`/catalog/products/${productId}`);
};

/**
 * Convertir producto del backend al formato del frontend
 */
export const convertBackendProductToFrontend = (backendProduct: ProductFromBackend | ProductDetailFromBackend): Product => {
  const seller = 'seller' in backendProduct ? backendProduct.seller : undefined;
  
  // La ubicación de la PUBLICACIÓN sale del padrón, no del perfil de quien
  // publica. Antes se partía `seller.location` por comas y se mostraba eso:
  // una rastra de Balcarce, vendida por una cuenta de Córdoba, aparecía como
  // «Córdoba» incluso filtrando Buenos Aires. Sin localidad no se inventa
  // nada: quedan vacías y la tarjeta no dibuja la línea.
  const ubicacion = backendProduct.publication_location;

  // La del vendedor sigue existiendo, pero como dato SUYO y en su bloque.
  const sellerWithLocation = seller && 'location' in seller ? seller as SellerInfo : undefined;
  const partesDelVendedor = sellerWithLocation?.location?.split(',').map(s => s.trim()) || [];
  
  // Obtener la URL de la imagen principal
  const primaryImageUrl = backendProduct.primary_image || 
    ('images' in backendProduct && backendProduct.images.length > 0 ? backendProduct.images[0].url : undefined);
  
  // Obtener rating del vendedor (0 si no tiene calificaciones)
  const sellerRating = seller?.rating_average || 0;
  const sellerRatingCount = seller?.rating_count || 0;
  const sellerSalesCount = 'sales_count' in (seller || {}) ? (seller as SellerInfo).sales_count || 0 : backendProduct.sales_count || 0;
  
  return {
    id: backendProduct.id,
    name: backendProduct.name,
    category: backendProduct.category_name,
    subcategory: backendProduct.subcategory_name || '',
    price: backendProduct.price,
    currency: backendProduct.currency,
    description: backendProduct.description,
    // La foto de la publicación, y si no hay, la del catálogo demostrativo.
    //
    // El orden es el único que no miente: primero lo que subió quien
    // publica. Sólo cuando eso no existe —o es una URL de relleno, que para
    // el sistema visual es lo mismo que no existir— se mira la tabla de la
    // demostracion. Un slug ajeno sin foto no encuentra nada ahi y conserva
    // el respaldo honesto: no hay imagen generica de reemplazo.
    image: fotoDemoDe(
      backendProduct.slug,
      !esFotoDeRelleno(getImageUrl(primaryImageUrl)),
    )?.archivo ?? getImageUrl(primaryImageUrl),
    location: {
      province: ubicacion?.province || '',
      city: ubicacion?.locality || '',
    },
    seller: {
      id: seller?.id || '',
      name: seller?.full_name || 'Vendedor',
      rating: sellerRating,
      ratingCount: sellerRatingCount,
      salesCount: sellerSalesCount,
      // `=== true` y no un booleano casteado: la tarjeta del listado no manda
      // el campo, y ausente tiene que leerse como «no», nunca como «sí».
      documentacionRevisada:
        (seller as SellerInfo | undefined)?.documentacion_revisada === true,
      // El domicilio declarado por quien publica, tal como lo escribió. Es su
      // dato y vive en su bloque: no describe de dónde es la publicación.
      address: {
        province: partesDelVendedor[0] || '',
        city: partesDelVendedor[1] || '',
      },
    },
    stock: backendProduct.stock,
    unit: backendProduct.unit || 'unidad',
    features: {}, // El backend no tiene features estructuradas aún
    tags: [], // El backend no tiene tags aún
    createdAt: backendProduct.created_at,
    isService: backendProduct.is_service || false,
    operationKind: normalizarAnatomia(backendProduct.operation_kind),
    condition: normalizarCondicion(backendProduct.condition),
    pricingType: backendProduct.pricing_type || undefined,
    availability: backendProduct.availability || undefined,
    responseTime: backendProduct.response_time || undefined,
    coverageZones: backendProduct.coverage_zones || undefined,
  };
};
