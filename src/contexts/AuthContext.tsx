import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, RegisterData, RegistroPendiente } from '../types';
import { apiGet, apiPost, apiPatch, tokenStorage } from '../utils/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Tipos de respuesta del backend
interface BackendUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'seller' | 'customer';
  avatar_url?: string;
  phone?: string;
  whatsapp?: string;
  location?: string;
  bio?: string;
  cbu?: string;
  alias_bancario?: string;
  is_carrier?: boolean;
  carrier_base_locality_id?: string;
  carrier_base_locality_name?: string;
  carrier_base_province_id?: string;
  carrier_base_province_name?: string;
  carrier_transport?: string;
  carrier_transport_certified?: boolean;
  carrier_certification_detail?: string;
  carrier_certification_declared_at?: string;
  carrier_coverage_radius_km?: number;
  carrier_capacity?: string;
  carrier_vehicle_model?: string;
  carrier_plate?: string;
  carrier_cargo_types?: string[];
  carrier_cargo_other?: string;
  rating_average?: number;
  rating_count?: number;
  sales_count?: number;
  purchases_count?: number;
  created_at: string;
}

interface AuthResponse {
  user: BackendUser;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  message?: string;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

// Helper para convertir BackendUser a User del frontend
const mapBackendUserToFrontend = (backendUser: BackendUser): User => {
  // Normalizar rol (puede venir en mayúsculas)
  const normalizedRole = backendUser.role?.toLowerCase() as 'admin' | 'seller' | 'customer';
  
  // Mapear roles del backend al frontend
  let frontendRole: 'admin' | 'seller' | 'buyer' | 'both';
  if (normalizedRole === 'admin') {
    frontendRole = 'admin';
  } else if (normalizedRole === 'seller') {
    frontendRole = 'seller';
  } else {
    frontendRole = 'buyer';
  }
  
  return {
    id: backendUser.id,
    email: backendUser.email,
    name: backendUser.full_name,
    phone: backendUser.phone,
    whatsapp: backendUser.whatsapp,
    role: frontendRole,
    avatarUrl: backendUser.avatar_url,
    location: backendUser.location,
    bio: backendUser.bio,
    cbu: backendUser.cbu,
    bankAlias: backendUser.alias_bancario,
    isCarrier: backendUser.is_carrier,
    carrierBaseLocalityId: backendUser.carrier_base_locality_id,
    carrierBaseLocalityName: backendUser.carrier_base_locality_name,
    carrierBaseProvinceId: backendUser.carrier_base_province_id,
    carrierBaseProvinceName: backendUser.carrier_base_province_name,
    carrierTransport: backendUser.carrier_transport,
    carrierTransportCertified: backendUser.carrier_transport_certified,
    carrierCertificationDetail: backendUser.carrier_certification_detail,
    carrierCertificationDeclaredAt: backendUser.carrier_certification_declared_at,
    carrierCoverageRadiusKm: backendUser.carrier_coverage_radius_km,
    carrierCapacity: backendUser.carrier_capacity,
    carrierVehicleModel: backendUser.carrier_vehicle_model,
    carrierPlate: backendUser.carrier_plate,
    carrierCargoTypes: backendUser.carrier_cargo_types ?? [],
    carrierCargoOther: backendUser.carrier_cargo_other,
    ratingAverage: backendUser.rating_average ?? 0,
    ratingCount: backendUser.rating_count ?? 0,
    salesCount: backendUser.sales_count ?? 0,
    purchasesCount: backendUser.purchases_count ?? 0,
    createdAt: backendUser.created_at,
  };
};

  // Cargar usuario actual desde el backend (si hay token guardado o cookie de sesión)
  useEffect(() => {
    const loadCurrentUser = async () => {
      // Verificar si hay token guardado
      const savedToken = tokenStorage.getAccessToken();
      if (!savedToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      try {
        // /auth/me devuelve directamente el usuario, no AuthResponse
        const backendUser = await apiGet<BackendUser>('/auth/me');
        setUser(mapBackendUserToFrontend(backendUser));
      } catch (error) {
        // Token inválido o expirado, limpiar
        tokenStorage.clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      if (!email || !password) {
        throw new Error('Email y contraseña son requeridos');
      }

      console.log('🔄 Intentando login con:', email);
      
      const response = await apiPost<AuthResponse>('/auth/login', {
        email,
        password,
      });

      console.log('✅ Respuesta del backend:', response);

      // Guardar tokens en localStorage
      if (response.access_token) {
        tokenStorage.setTokens(response.access_token, response.refresh_token);
      }

      const frontendUser = mapBackendUserToFrontend(response.user);

      console.log('✅ Usuario transformado:', frontendUser);
      setUser(frontendUser);
      console.log('✅ Login exitoso');
    } catch (error) {
      console.error('❌ Error en login:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error al iniciar sesión');
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      if (!userData.email || !userData.password || !userData.name) {
        throw new Error('Todos los campos son requeridos');
      }

      const response = await apiPost<RegistroPendiente>('/auth/register', {
        email: userData.email,
        password: userData.password,
        full_name: userData.name,
        phone: userData.phone,
        role: 'user',
        is_carrier: userData.isCarrier,
        carrier_base_locality_id: userData.carrierBaseLocalityId,
        carrier_transport: userData.carrierTransport,
        carrier_transport_certified: userData.carrierTransportCertified,
        carrier_certification_detail: userData.carrierCertificationDetail,
        carrier_coverage_radius_km: userData.carrierCoverageRadiusKm,
        carrier_capacity: userData.carrierCapacity,
        carrier_vehicle_model: userData.carrierVehicleModel,
        carrier_plate: userData.carrierPlate,
        carrier_cargo_types: userData.carrierCargoTypes,
        carrier_cargo_other: userData.carrierCargoOther,
      });

      // El alta no abre sesión: no hay tokens que guardar ni usuario que
      // poner en el contexto hasta que se confirme el correo.
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error al registrar usuario');
    }
  };

  const reenviarVerificacion = async (email: string): Promise<string> => {
    const respuesta = await apiPost<{ message: string }>(
      '/auth/resend-verification',
      { email },
    );
    return respuesta.message;
  };

  const verificarCorreo = async (token: string): Promise<string> => {
    const respuesta = await apiPost<{ message: string }>('/auth/verify-email', {
      token,
    });
    return respuesta.message;
  };

  const logout = async () => {
    try {
      await apiPost('/auth/logout');
    } catch (error) {
      // Ignorar errores de logout
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
      localStorage.removeItem('agromarket_cart');
      window.dispatchEvent(new CustomEvent('user-logout'));
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      if (!user) throw new Error('Usuario no autenticado');

      const response = await apiPatch<BackendUser>('/auth/me', {
        full_name: userData.name,
        phone: userData.phone,
        whatsapp: userData.whatsapp,
        location: userData.location,
      bio: userData.bio,
      cbu: userData.cbu,
      alias_bancario: userData.bankAlias,
      // Los datos de transportista viajan sólo cuando quien edita los manda:
      // `JSON.stringify` descarta las claves sin valor, así que un perfil
      // común sigue enviando exactamente el mismo cuerpo que antes.
      carrier_base_locality_id: userData.carrierBaseLocalityId,
      carrier_transport: userData.carrierTransport,
      carrier_transport_certified: userData.carrierTransportCertified,
      carrier_certification_detail: userData.carrierCertificationDetail,
      carrier_coverage_radius_km: userData.carrierCoverageRadiusKm,
      carrier_capacity: userData.carrierCapacity,
      carrier_vehicle_model: userData.carrierVehicleModel,
      carrier_plate: userData.carrierPlate,
      carrier_cargo_types: userData.carrierCargoTypes,
      carrier_cargo_other: userData.carrierCargoOther,
      });

      setUser(mapBackendUserToFrontend(response));
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error al actualizar perfil');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    register,
    reenviarVerificacion,
    verificarCorreo,
    logout,
    updateProfile,
  };

  // Mostrar loading mientras se carga el usuario
  if (loading) {
    return null; // O un spinner de carga
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
