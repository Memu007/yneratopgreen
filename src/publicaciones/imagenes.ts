/**
 * Subir una imagen de una publicación, y decir por qué no entró cuando no
 * entra.
 *
 * El alta ya lo hacía bien —mira `response.ok`, saca el motivo del cuerpo y
 * avisa que la publicación quedó sin esa imagen—. La edición no: llamaba a
 * `fetch` y seguía de largo, así que una imagen rechazada terminaba en
 * «actualizado exitosamente». La diferencia no era de criterio sino de que el
 * código estaba escrito dos veces; acá está una sola.
 *
 * No usa `apiFetch` a propósito: ese envoltorio tira una excepción ante
 * cualquier respuesta que no sea 2xx, y acá el fallo de una imagen no puede
 * abortar un guardado que ya se hizo. Lo que se necesita es el motivo, no una
 * interrupción.
 */
import { API_BASE_URL, tokenStorage } from '../utils/api';

/**
 * Sube una imagen. Devuelve `null` si entró y el motivo legible si no.
 *
 * El motivo sale del `detail` del cuerpo cuando el servidor lo manda; si no,
 * del cuerpo tal cual; y si no hay nada, del código HTTP.
 */
export async function subirImagenDePublicacion(
  publicacionId: string,
  archivo: File,
  esPrimaria: boolean,
): Promise<string | null> {
  const cuerpo = new FormData();
  cuerpo.append('files', archivo);
  cuerpo.append('is_primary', esPrimaria.toString());

  const token = tokenStorage.getAccessToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const respuesta = await fetch(`${API_BASE_URL}/products/${publicacionId}/images`, {
      method: 'POST',
      body: cuerpo,
      credentials: 'include',
      headers,
    });
    if (respuesta.ok) return null;

    let motivo = `HTTP ${respuesta.status}`;
    const texto = await respuesta.text();
    if (texto) {
      try {
        const leido = JSON.parse(texto) as { detail?: unknown };
        motivo = typeof leido.detail === 'string' ? leido.detail : texto;
      } catch {
        motivo = texto;
      }
    }
    return motivo;
  } catch (error) {
    return error instanceof Error ? error.message : 'error de red';
  }
}

/**
 * Cómo se nombra el resultado parcial. Una sola frase para las dos pantallas:
 * si el alta y la edición fallan por lo mismo, tienen que decir lo mismo.
 */
export function fraseDeImagenesFallidas(fallidas: string[]): string {
  return `no se pudo subir ${
    fallidas.length === 1 ? 'la imagen' : `${fallidas.length} imágenes`
  }: ${fallidas.join('; ')}`;
}
