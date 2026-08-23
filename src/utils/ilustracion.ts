/**
 * Cuándo una imagen NO es la foto del producto, y con qué ilustrarla.
 *
 * El seed cargó publicaciones con URLs de `picsum.photos`, que devuelve una
 * foto **al azar**: gatos, edificios, retratos. No fallan al cargar —por eso
 * el respaldo por `onError` nunca se enteraba—, cargan perfecto y muestran
 * cualquier cosa al lado de un precio y un vendedor reales.
 *
 * Así que no se espera a que fallen: se reconocen por el origen y no se piden.
 * En su lugar va una ilustración de familia que **dice que es ilustrativa**.
 * Fingir que es la foto exacta sería el mismo problema con mejor gusto.
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

/** Las familias que tienen motivo propio. */
export type Familia =
  | 'cultivo'
  | 'maquinaria'
  | 'ganado'
  | 'agua'
  | 'tierra'
  | 'tecnologia'
  | 'logistica'
  | 'generico';

/**
 * De categoría a familia. Se comparan sin acentos ni mayúsculas porque el
 * nombre viene del catálogo y ahí se escribe para leer, no para comparar.
 */
const POR_PALABRA: [RegExp, Familia][] = [
  [/maquinaria|repuesto|mantenimiento|contratista/, 'maquinaria'],
  [/ganader|forraje|ganado|bienes/, 'ganado'],
  [/riego|drenaje|agua/, 'agua'],
  [/tierra|parcela|campo/, 'tierra'],
  [/precision|tecnolog|asesoramiento/, 'tecnologia'],
  [/logistica|flete|transporte/, 'logistica'],
  [/insumo|semilla|acopio|grano|agroquimic|fertilizante/, 'cultivo'],
];

export function familiaDe(categoria?: string): Familia {
  if (!categoria) return 'generico';
  const limpio = categoria
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  for (const [patron, familia] of POR_PALABRA) {
    if (patron.test(limpio)) return familia;
  }
  return 'generico';
}
