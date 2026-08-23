/**
 * Cuándo una imagen NO es la foto del producto.
 *
 * El seed cargó publicaciones con URLs de `picsum.photos`, que devuelve una
 * foto **al azar**: gatos, edificios, retratos. No fallan al cargar —por eso
 * un respaldo que espere el `onError` nunca se entera—, cargan perfecto y
 * muestran cualquier cosa al lado de un precio y un vendedor reales.
 *
 * Así que no se espera a que fallen: se reconocen por el origen y no se piden.
 * Para el sistema visual una publicación con una foto de relleno es una
 * publicación **sin fotografía**, y así se rotula. La versión anterior ponía
 * ahí una ilustración por familia: se retiró porque hacía que veinte avisos
 * distintos parecieran el mismo bien, que es inventario ficticio con otro
 * nombre.
 */

/** Orígenes que devuelven una imagen cualquiera, no la del producto. */
const ORIGENES_DE_RELLENO = ['picsum.photos', 'placehold.co', 'placeholder.com', 'via.placeholder.com'];

export function esFotoDeRelleno(src?: string): boolean {
  if (!src) return true;
  try {
    const url = new URL(src, window.location.origin);
    return ORIGENES_DE_RELLENO.some((origen) => url.hostname.endsWith(origen));
  } catch {
    return false;
  }
}
