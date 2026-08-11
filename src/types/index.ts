export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  currency: string;
  description: string;
  image: string;
  isService?: boolean;
  location: {
    province: string;
    city: string;
  };
  seller: {
    id: string;
    name: string;
    rating: number;
    ratingCount: number;
    salesCount: number;
    address: {
      province: string;
      city: string;
      street?: string;
    };
  };
  stock: number;
  unit: string;
  features: {
    [key: string]: string;
  };
  tags: string[];
  createdAt: string;
}

export interface FilterOptions {
  categories: string[];
  subcategories: string[];
  priceRange: {
    min: number;
    max: number;
  };
  provinces: string[];
  inStock: boolean;
  minRating?: number;
}

export interface FilterState {
  searchQuery: string;
  selectedCategory: string;
  selectedSubcategory: string;
  priceMin: number;
  priceMax: number;
  selectedProvince: string;
  inStockOnly: boolean;
  minRating: number;
}

// Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  location?: string;
  bio?: string;
  cbu?: string;
  bankAlias?: string;
  isCarrier?: boolean;
  carrierBaseLocalityId?: string;
  // Derivados del padrón, de sólo lectura: sirven para mostrar la localidad
  // base y para abrir el selector en la provincia que ya está guardada.
  carrierBaseLocalityName?: string;
  carrierBaseProvinceId?: string;
  carrierBaseProvinceName?: string;
  carrierTransport?: string;
  carrierTransportCertified?: boolean;
  carrierCertificationDetail?: string;
  carrierCertificationDeclaredAt?: string;
  carrierCoverageRadiusKm?: number;
  carrierCapacity?: string;
  role: 'user' | 'admin' | 'seller' | 'buyer' | 'both';
  avatar?: string;
  avatarUrl?: string;
  // Reputación y estadísticas
  ratingAverage?: number;
  ratingCount?: number;
  salesCount?: number;
  purchasesCount?: number;
  createdAt: string;
}

// El alta ya no abre sesión: devuelve a qué correo se mandó el enlace.
export interface RegistroPendiente {
  email: string;
  message: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<RegistroPendiente>;
  reenviarVerificacion: (email: string) => Promise<string>;
  verificarCorreo: (token: string) => Promise<string>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  location?: string;
  role: 'user' | 'admin';
  isCarrier?: boolean;
  carrierBaseLocalityId?: string;
  carrierTransport?: string;
  carrierTransportCertified?: boolean;
  carrierCertificationDetail?: string;
  carrierCertificationDeclaredAt?: string;
  carrierCoverageRadiusKm?: number;
  carrierCapacity?: string;
}

// Cart Types
export interface CartItem {
  product: Product;
  quantity: number;
  addedAt: string;
}

export interface CartContextType {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  addItem: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  // Manda el carrito visible al servidor. Las llamadas se encadenan: la
  // última en salir es la última en escribir, y esperar la promesa
  // garantiza que no quedó ninguna escritura anterior en vuelo.
  sincronizarConServidor: () => Promise<void>;
}

// Order Types
export interface ShippingAddress {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  notes?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  shippingAddress: ShippingAddress;
  paymentMethod: 'transfer' | 'mercadopago' | 'cash';
  status: 'pending' | 'awaiting-transfer-receipt' | 'transfer-receipt-submitted' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// New Product Form Data
export interface NewProductData {
  name: string;
  category: string;
  subcategory: string;
  localityId: string;
  price: number;
  description: string;
  image: string;
  location: {
    province: string;
    city: string;
  };
  stock: number;
  unit: string;
  features: {
    [key: string]: string;
  };
  tags: string[];
}
