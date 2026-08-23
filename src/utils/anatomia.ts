/**
 * Las cuatro anatomías, y qué acción ofrece cada publicación.
 *
 * El diseño aprobado distingue activo de alto valor, insumo, servicio y
 * logística, y cada una muestra datos distintos. Cuál es no se deduce acá: la
 * declara la publicación en el alta y viaja en la respuesta pública como
 * `operation_kind`. Este módulo sólo traduce esa declaración a lo que la
 * interfaz tiene que dibujar, y es el único lugar donde se decide: si la regla
 * estuviera repartida entre la tarjeta y el detalle, los dos podrían ofrecer
 * acciones distintas sobre la misma publicación.
 */
import { Condition, OperationKind, Product } from '../types';

export type { Condition, OperationKind };

export const ANATOMIAS: OperationKind[] = ['activo', 'insumo', 'servicio', 'logistica'];

/** Las dos que viven en categorías de servicio. */
export const DE_SERVICIO: OperationKind[] = ['servicio', 'logistica'];

export const ETIQUETA_DE_ANATOMIA: Record<OperationKind, string> = {
  activo: 'Activo de alto valor',
  insumo: 'Insumo estandarizado',
  servicio: 'Servicio',
  logistica: 'Logística',
};

/**
 * Lo que dice el backend, o `insumo` si no dice nada.
 *
 * Ausente sólo aparece en datos anteriores a la columna: `insumo` es
 * exactamente cómo se comportaba toda publicación de producto antes —precio,
 * stock y «Agregar»—, así que es la lectura que no cambia nada.
 */
export function normalizarAnatomia(valor?: string | null): OperationKind {
  return (ANATOMIAS as string[]).includes(valor || '')
    ? (valor as OperationKind)
    : 'insumo';
}

export function esDeServicio(anatomia?: OperationKind): boolean {
  return DE_SERVICIO.includes(anatomia || 'insumo');
}

/**
 * ¿Hay un precio para cobrar?
 *
 * No es una interpretación: una publicación sin precio publicado guarda 0, y
 * el catálogo de servicios lo declara además como modalidad `a_convenir`. Lo
 * que no se puede cobrar tampoco puede entrar al carrito —hoy podía, y salía
 * una orden de $0—, y en su lugar dice «A cotizar».
 */
export function tienePrecioPublicado(product: Product): boolean {
  return Number(product.price) > 0;
}

/** Qué puede hacerse con esta publicación, ahora, de verdad. */
export type Accion =
  /** Entra al carrito y sigue por el checkout de siempre. */
  | { tipo: 'comprar'; etiqueta: string }
  /** No hay precio que cobrar: el puente honesto es Contacto. */
  | { tipo: 'cotizar'; etiqueta: string }
  /** Hay precio, pero no queda nada para vender. */
  | { tipo: 'sin-stock'; etiqueta: string };

/**
 * La acción primaria de una publicación.
 *
 * El verbo cambia con la anatomía porque no se compra igual una cosechadora
 * que una bolsa de urea, pero el camino es el mismo que ya existía: carrito y
 * checkout. Lo único que se cierra es comprar algo que no tiene precio.
 */
export function accionDe(product: Product): Accion {
  const anatomia = normalizarAnatomia(product.operationKind);

  if (!tienePrecioPublicado(product)) {
    return { tipo: 'cotizar', etiqueta: 'Solicitar cotización' };
  }

  // Un servicio no tiene unidades que reservar: el backend nunca le descontó
  // stock y por eso no se le pregunta si le queda.
  if (!esDeServicio(anatomia) && !(product.stock > 0)) {
    return { tipo: 'sin-stock', etiqueta: 'Sin stock' };
  }

  switch (anatomia) {
    case 'activo':
      return { tipo: 'comprar', etiqueta: 'Iniciar operación' };
    case 'insumo':
      return { tipo: 'comprar', etiqueta: 'Agregar' };
    default:
      // Servicio y logística con precio publicado: es la contratación que el
      // producto ya soporta, con su carrito y su checkout.
      return { tipo: 'comprar', etiqueta: 'Contratar' };
  }
}

/** La acción secundaria, que siempre nombra el objeto en vez de «ver más». */
export function etiquetaSecundaria(product: Product): string {
  switch (normalizarAnatomia(product.operationKind)) {
    case 'activo':
      return 'Ver condiciones';
    case 'servicio':
      return 'Ver alcance';
    case 'logistica':
      return 'Ver cobertura';
    default:
      return 'Ver detalle';
  }
}

/**
 * Lo que dice el backend sobre la condición, o nada.
 *
 * Nada es una respuesta válida y frecuente: hacienda y campos son activos donde
 * «nuevo o usado» no significa nada, y ninguna publicación anterior a la columna
 * la declaró. Donde falta, la ficha omite la fila. Inventar «nuevo» sería
 * afirmar algo que el vendedor no dijo.
 */
export function normalizarCondicion(valor?: string | null): Condition | undefined {
  return valor === 'nuevo' || valor === 'usado' ? valor : undefined;
}

export const ETIQUETA_DE_CONDICION: Record<Condition, string> = {
  nuevo: 'Nuevo',
  usado: 'Usado',
};
