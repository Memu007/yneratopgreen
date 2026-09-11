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

/**
 * Los pedidos cuyo 401 NO habla de la sesión, y que por eso no se reintentan
 * renovándola.
 *
 * `login` y `register` contestan por la credencial que se acaba de escribir;
 * `refresh` es el que renueva —reintentarlo sería morderse la cola—; y los de
 * verificación se piden justamente sin sesión. En todos, renovar no cambia la
 * respuesta, y reintentar sólo cambiaría el mensaje: «Email o contraseña
 * incorrectos» se convertiría en «Sesión expirada», que no es lo que pasó.
 *
 * Antes la regla era «ningún `/auth/`», y se llevaba puesto a `/auth/me`, que
 * es el ÚNICO de la familia que sí lleva sesión. Con eso, un access token
 * vencido y un refresh perfectamente válido terminaban en sesión cerrada:
 * `loadCurrentUser` pedía `/auth/me`, recibía 401, no reintentaba, y tiraba
 * los dos tokens. Está medido: entrar, vencer sólo el access y recargar dejaba
 * la cabecera en «Ingresar» con el refresh bueno todavía guardado.
 */
const SIN_REINTENTO = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/resend-verification',
];

const sePuedeReintentar = (endpoint: string) =>
  !SIN_REINTENTO.some((ruta) => endpoint.startsWith(ruta));

// Flag para evitar múltiples refresh simultáneos
let isRefreshing = false;
let refreshPromise: Promise<ResultadoDeRenovacion> | null = null;

/**
 * Qué pasó al intentar renovar. Tres resultados y no dos, porque «no se pudo»
 * y «no, esta credencial no vale» son cosas distintas y terminan distinto.
 */
type ResultadoDeRenovacion = 'renovado' | 'rechazado' | 'indisponible';

/**
 * Intenta renovar el access token usando el refresh token.
 *
 * Las credenciales se tiran SÓLO cuando el servidor contestó que no valen.
 * Antes se tiraban ante cualquier tropiezo —un 503, un timeout, la red
 * cortada—, así que una caída de dos segundos le cerraba la sesión a alguien
 * que la tenía perfectamente válida, y encima se la cerraba sin decírselo.
 * Está medido: con `/auth/refresh` respondiendo 503, `localStorage` quedaba
 * sin ningún token.
 */
async function refreshAccessToken(): Promise<ResultadoDeRenovacion> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    // No hay con qué renovar. Eso no es una caída: es una respuesta.
    tokenStorage.clearTokens();
    return 'rechazado';
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
      credentials: 'include',
    });
  } catch {
    // No se pudo ni preguntar: la sesión no dijo nada, así que no se toca.
    return 'indisponible';
  }

  if (response.ok) {
    const data = await response.json().catch(() => null);
    if (data?.access_token) {
      tokenStorage.setTokens(data.access_token, data.refresh_token);
      return 'renovado';
    }
    // Un 200 sin token es un servidor raro, no un rechazo a la credencial.
    return 'indisponible';
  }

  // Sólo un rechazo explícito de la credencial es un rechazo. Un 408, un 429 o
  // un 500 no dicen que el token no valga: dicen que ahora no se pudo. Antes la
  // regla era «del 500 para arriba», así que 408 y 429 tiraban las
  // credenciales, y son justamente los dos estados que aparecen cuando el otro
  // lado está sobrecargado, no cuando la sesión se venció.
  if (response.status === 401 || response.status === 403) {
    tokenStorage.clearTokens();
    return 'rechazado';
  }
  return 'indisponible';
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
 * Por qué falló un pedido, dicho de una forma que no haya que adivinar.
 *
 * Antes el motivo sólo vivía en el texto del error, así que distinguirlos
 * obligaba a buscarle frases —justo lo que ya está anotado como riesgo: una
 * pantalla que decide leyendo cómo está redactado un mensaje se rompe el día
 * que alguien lo mejora—. Acá el motivo viaja aparte del texto.
 *
 * La distinción que importa: `indisponible` es «no se pudo preguntar», y no
 * dice NADA sobre la sesión. Confundirla con `sesion-vencida` es cerrarle la
 * sesión a alguien porque el servidor se cayó dos segundos.
 */
export type CausaDeFalla = 'sesion-vencida' | 'indisponible' | 'respuesta';

export class ErrorDeLaApi extends Error {
  readonly causa: CausaDeFalla;
  readonly estado?: number;

  constructor(mensaje: string, causa: CausaDeFalla, estado?: number) {
    super(mensaje);
    this.name = 'ErrorDeLaApi';
    this.causa = causa;
    this.estado = estado;
  }
}

/**
 * Fetch wrapper con manejo de errores, cookies y refresh automático
 */
export async function apiFetch<T = unknown>(
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

  // Con FormData el Content-Type lo tiene que poner el navegador, porque
  // incluye el `boundary` que separa las partes. Dejar el `application/json`
  // de los headers por defecto manda un multipart que el servidor no puede
  // partir, y el error que vuelve no se parece en nada a la causa.
  if (config.body instanceof FormData) {
    delete (config.headers as Record<string, string>)['Content-Type'];
  }

  try {
    const response = await fetch(url, config);

    // Si recibimos 401, intentar refresh del token
    if (response.status === 401 && retry && sePuedeReintentar(endpoint)) {
      // Evitar múltiples refresh simultáneos
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken();
      }

      const renovacion = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (renovacion === 'renovado') {
        // Reintentar la request original
        return apiFetch<T>(endpoint, options, false);
      }
      if (renovacion === 'indisponible') {
        // No sabemos si la sesión vale: no se pudo preguntar. Decir
        // «expiró» acá sería inventar un diagnóstico.
        throw new ErrorDeLaApi(
          'No pudimos comprobar tu sesión. Volvé a intentarlo en un momento.',
          'indisponible',
        );
      }
      throw new ErrorDeLaApi(
        'Sesión expirada. Por favor, inicia sesión nuevamente.',
        'sesion-vencida',
        401,
      );
    }

    // Manejar errores HTTP
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ErrorDeLaApi(
        mensajeDeError(errorData?.detail, response),
        // Del 500 para arriba el servidor no contestó por lo que se le pidió:
        // se cayó. Eso se reintenta; lo demás es una respuesta.
        response.status >= 500 ? 'indisponible' : 'respuesta',
        response.status,
      );
    }

    // Si no hay contenido (204 No Content), retornar undefined
    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json();
  } catch (error) {
    // Vuelve tal cual SÓLO lo que ya sabe por qué falló. Todo lo demás llega
    // acá sin causa, empezando por el `TypeError` con el que `fetch` rechaza
    // cuando la conexión se corta —y un `TypeError` también es un `Error`—.
    //
    // Antes se relanzaba cualquier `Error` sin tocarlo, así que la red cortada
    // perdía su motivo por el camino y, más adelante, se leía como sesión
    // vencida. Está medido: con `/auth/me` abortado, `localStorage` quedaba sin
    // ningún token y aparecía el Login. El 503 estaba cubierto y la red no, que
    // es el caso más común de los dos.
    if (error instanceof ErrorDeLaApi) throw error;
    throw new ErrorDeLaApi('Error de red. Por favor, verifica tu conexión.', 'indisponible');
  }
}

/**
 * Helper para GET requests
 */
export const apiGet = <T = unknown>(endpoint: string) =>
  apiFetch<T>(endpoint, { method: 'GET' });

/**
 * Helper para POST requests
 */
export const apiPost = <T = unknown>(endpoint: string, data?: unknown) =>
  apiFetch<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });

/**
 * Helper para PUT requests
 */
export const apiPut = <T = unknown>(endpoint: string, data: unknown) =>
  apiFetch<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/**
 * Helper para PATCH requests
 */
export const apiPatch = <T = unknown>(endpoint: string, data: unknown) =>
  apiFetch<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

/**
 * Helper para DELETE requests
 */
export const apiDelete = <T = unknown>(endpoint: string) =>
  apiFetch<T>(endpoint, { method: 'DELETE' });

/**
 * Descarga un archivo protegido y devuelve su contenido.
 *
 * Un `<a href>` no lleva el `Authorization`, así que un documento privado no
 * se puede abrir con un enlace: hay que pedirlo con el token y quedarse con
 * los bytes. Quien llama arma la URL temporal y —esto importa— la revoca.
 */
export async function apiBlob(endpoint: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: getDefaultHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(mensajeDeError(errorData?.detail, response));
  }

  return response.blob();
}

/**
 * En qué estado está la sesión, ahora.
 *
 * Tres respuestas, y la tercera es la que faltaba. Existe porque tener un
 * token guardado no es tener sesión: entre que alguien entra y que aprieta un
 * botón puede pasar una tarde entera, y `isAuthenticated` sigue diciendo que
 * sí hasta que se recarga. Lo caro de esa distancia no es el error, es DÓNDE
 * aparece: en el carrito abría el Checkout, la persona completaba nombre,
 * teléfono, provincia y localidad, y recién ahí se topaba con «Sesión
 * expirada» y sin salida.
 *
 *  - `vigente`: la sesión sirve. Si el access token había vencido y el refresh
 *    servía, se renovó por el camino de siempre y nadie se enteró; por eso acá
 *    no se mira el token, se pregunta.
 *  - `sin-sesion`: está CONFIRMADO que no vale. Recién ahí se tiran las
 *    credenciales muertas —por eso esto se llama «asegurar» y no «consultar»:
 *    escribe—, porque un token que ya probamos que no sirve sólo alcanza para
 *    que el siguiente que lo lea crea que hay sesión.
 *  - `indisponible`: no se pudo preguntar. Un 503 o la red cortada no dicen
 *    nada de la sesión, y la primera versión de esto los trataba igual que un
 *    rechazo: borraba los dos tokens y ofrecía ingresar. Cerrarle la sesión a
 *    alguien porque el servidor se cayó dos segundos es peor que el defecto
 *    que esta pieza vino a arreglar, porque encima parece deliberado.
 */
export type EstadoDeLaSesion = 'vigente' | 'sin-sesion' | 'indisponible';

export async function asegurarSesion(): Promise<EstadoDeLaSesion> {
  if (!tokenStorage.getAccessToken()) return 'sin-sesion';
  try {
    await apiGet('/auth/me');
    return 'vigente';
  } catch (error) {
    // El que decide es el «sí» explícito, no el descarte. Antes cualquier cosa
    // que no fuera `indisponible` contaba como sesión vencida, y eso incluía a
    // los errores que llegan sin causa: alcanzaba con que uno se escapara sin
    // clasificar para volver a cerrar sesiones que estaban bien. Ahora hay que
    // decirlo para que cuente, y lo único que lo dice es el servidor.
    if (error instanceof ErrorDeLaApi && error.causa === 'sesion-vencida') {
      tokenStorage.clearTokens();
      return 'sin-sesion';
    }
    return 'indisponible';
  }
}

/**
 * Helper para upload de archivos (FormData)
 */
export const apiUpload = <T = unknown>(endpoint: string, formData: FormData) =>
  apiFetch<T>(endpoint, {
    method: 'POST',
    body: formData,
    headers: {}, // El Content-Type con boundary lo pone el navegador (ver apiFetch)
  });
