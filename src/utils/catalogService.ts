/**
 * Servicio para manejar operaciones del catálogo de productos
 */
import { apiGet } from './api';
import { Product } from '../types';
import { normalizarAnatomia, normalizarCondicion } from './anatomia';

// Base URL para imágenes - usar variable de entorno o ruta relativa (vacía para producción)
const IMAGES_BASE_URL = import.meta.env.VITE_IMAGES_URL || '';

/**
 * Construye la URL completa para una imagen
 */
// Placeholder SVG como data URI (no requiere conexión externa)
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmNGVkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzJkNTAxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuKaoiBTaW4gSW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';

function getImageUrl(url: string | undefined): string {
  if (!url) return PLACEHOLDER_IMAGE;
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
  operation_kind?: string;
  condition?: string | null;
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
  province_id: string;
  province_name: string;
  latitude: number;
  longitude: number;
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

export interface ProductListResponse {
  items: ProductFromBackend[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
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

/**
 * Obtener listado de productos con filtros
 */
export const getProducts = async (params: {
  search?: string;
  category?: string;
  province?: string;
  locality_id?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  seller_id?: string;
  sort_by?: 'created_at' | 'price' | 'sales' | 'views';
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
  
  // Extraer provincia y ciudad de la location si existe
  const sellerWithLocation = seller && 'location' in seller ? seller as SellerInfo : undefined;
  const locationParts = sellerWithLocation?.location?.split(',').map(s => s.trim()) || ['Argentina', ''];
  
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
    image: getImageUrl(primaryImageUrl),
    location: {
      province: locationParts[0] || 'Argentina',
      city: locationParts[1] || '',
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
      address: {
        province: locationParts[0] || 'Argentina',
        city: locationParts[1] || '',
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
  };
};
