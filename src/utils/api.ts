/**
 * Configuración y helpers para llamadas a la API
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Funciones para manejar tokens en localStorage
 */
export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken?: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

/**
 * Headers por defecto para todas las requests
 */
const getDefaultHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Agregar token de autorización si existe
  const token = tokenStorage.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Flag para evitar múltiples refresh simultáneos
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Intenta renovar el access token usando el refresh token
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      return false;
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        tokenStorage.setTokens(data.access_token, data.refresh_token);
        return true;
      }
    }
    
    // Si el refresh falla, limpiar tokens
    tokenStorage.clearTokens();
    return false;
  } catch {
    tokenStorage.clearTokens();
    return false;
  }
}

/**
 * FastAPI devuelve `detail` de más de una forma: una cadena para los errores
 * de negocio, y una LISTA de objetos para los de validación del cuerpo.
 * Pasarla tal cual a `new Error(...)` convierte la lista en la cadena
 * "[object Object]", que es lo que veía quien se registraba con un correo mal
 * escrito. Acá se normaliza a un texto, cualquiera sea la forma que llegue.
 */
const CAMPOS: Record<string, string> = {
  email: 'El correo',
  password: 'La contraseña',
  full_name: 'El nombre',
  phone: 'El teléfono',
  quantity: 'La cantidad',
};

function textoDeUnError(item: unknown): string | null {
  if (typeof item === 'string') return item.trim() || null;
  if (!item || typeof item !== 'object') return null;

  const { msg, loc, type } = item as { msg?: unknown; loc?: unknown; type?: unknown };
  if (typeof msg !== 'string' || !msg.trim()) return null;

  // `loc` es la ruta del campo: ["body", "email"]. Interesa el último tramo.
  const campo = Array.isArray(loc)
    ? [...loc].reverse().find((parte) => typeof parte === 'string' && parte !== 'body')
    : undefined;
  const nombre = typeof campo === 'string' ? (CAMPOS[campo] ?? campo) : null;

  // Los dos motivos que una persona puede encontrar desde los formularios
  // valen la pena en castellano; el resto conserva el texto de origen, que es
  // preferible a inventarle una traducción que envejezca mal.
  if (type === 'value_error' && campo === 'email') {
    return 'El correo no parece una dirección válida. Revisalo y probá de nuevo.';
  }
  if (type === 'string_too_short' && nombre) {
    return `${nombre} es demasiado corto.`;
  }
  if (type === 'missing' && nombre) {
    return `${nombre} es obligatorio.`;
  }

  return nombre ? `${nombre}: ${msg}` : msg;
}

function mensajeDeError(detail: unknown, response: { status: number; statusText?: string }): string {
  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const textos = detail
      .map(textoDeUnError)
      .filter((texto): texto is string => Boolean(texto));
    if (textos.length) return textos.join(' ');
  }

  if (detail && typeof detail === 'object') {
    const texto = textoDeUnError(detail);
    if (texto) return texto;
  }

  const cola = response.statusText ? `: ${response.statusText}` : '';
  return `Error ${response.status}${cola}`;
}

/**
 * Fetch wrapper con manejo de errores, cookies y refresh automático
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...getDefaultHeaders(),
      ...options.headers,
    },
    credentials: 'include', // Incluir cookies en todas las requests
  };

  try {
    const response = await fetch(url, config);

    // Si recibimos 401, intentar refresh del token
    if (response.status === 401 && retry && !endpoint.includes('/auth/')) {
      // Evitar múltiples refresh simultáneos
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken();
      }

      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (refreshed) {
        // Reintentar la request original
        return apiFetch<T>(endpoint, options, false);
      } else {
        // Refresh falló, lanzar error de autenticación
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }
    }

    // Manejar errores HTTP
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(mensajeDeError(errorData?.detail, response));
    }

    // Si no hay contenido (204 No Content), retornar undefined
    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error de red. Por favor, verifica tu conexión.');
  }
}

/**
 * Helper para GET requests
 */
export const apiGet = <T = any>(endpoint: string) => 
  apiFetch<T>(endpoint, { method: 'GET' });

/**
 * Helper para POST requests
 */
export const apiPost = <T = any>(endpoint: string, data?: any) =>
  apiFetch<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });

/**
 * Helper para PUT requests
 */
export const apiPut = <T = any>(endpoint: string, data: any) =>
  apiFetch<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/**
 * Helper para PATCH requests
 */
export const apiPatch = <T = any>(endpoint: string, data: any) =>
  apiFetch<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

/**
 * Helper para DELETE requests
 */
export const apiDelete = <T = any>(endpoint: string) =>
  apiFetch<T>(endpoint, { method: 'DELETE' });

/**
 * Helper para upload de archivos (FormData)
 */
export const apiUpload = <T = any>(endpoint: string, formData: FormData) =>
  apiFetch<T>(endpoint, {
    method: 'POST',
    body: formData,
    headers: {}, // No incluir Content-Type para FormData (se setea automáticamente con boundary)
  });
