/**
 * La única regla de precio de una publicación.
 *
 * Existía dos veces y decidía distinto: el alta exigía precio a todo servicio
 * que no fuera «a convenir», y la edición sólo miraba el precio de los
 * productos. Con eso, un servicio por hora podía quedar guardado en cero
 * editándolo, y publicado con ese mismo cero era imposible. La misma
 * publicación recibía dos respuestas según por dónde se la tocara.
 *
 * La matriz es mínima y la aplican los dos:
 *
 *   producto                    -> precio explícito, mayor a cero
 *   servicio (no «a convenir»)  -> precio explícito, mayor a cero
 *   servicio «a convenir»       -> puede ir vacío o en cero
 *
 * No valida nada más: el resto de los campos sigue donde estaba.
 */

/** El mensaje es uno solo, así el alta y la edición dicen lo mismo. */
export const PRECIO_OBLIGATORIO = 'Indicá un precio mayor a cero.';
export const PRECIO_NEGATIVO = 'El precio no puede ser negativo.';

export interface ContextoDelPrecio {
  /** `'producto'` o `'servicio'`. */
  publicationType: string;
  /** Sólo lo tienen los servicios; `'a_convenir'` es el que exime del precio. */
  pricingType?: string | null;
}

/** ¿Esta publicación puede no declarar precio? */
export function precioAConvenir({ publicationType, pricingType }: ContextoDelPrecio): boolean {
  return publicationType === 'servicio' && pricingType === 'a_convenir';
}

/**
 * Devuelve el motivo por el que este precio no sirve, o `null` si sirve.
 *
 * Acepta el valor crudo —el alta lo tiene como número y la edición como texto—
 * para que las dos pantallas puedan preguntar lo mismo sin convertir antes.
 */
export function revisarElPrecio(
  crudo: string | number | null | undefined,
  contexto: ContextoDelPrecio,
): string | null {
  const vacio = crudo === '' || crudo === null || crudo === undefined;
  const numero = typeof crudo === 'number'
    ? crudo
    : Number.parseFloat(String(crudo ?? '').replace(',', '.'));

  if (precioAConvenir(contexto)) {
    // Vacío y cero están bien: el precio se acuerda después. Lo que no puede
    // pasar es que el precio referencial declarado sea negativo.
    if (vacio || Number.isNaN(numero)) return null;
    return numero < 0 ? PRECIO_NEGATIVO : null;
  }

  if (vacio || Number.isNaN(numero) || numero <= 0) return PRECIO_OBLIGATORIO;
  return null;
}
