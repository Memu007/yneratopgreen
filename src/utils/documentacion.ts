/**
 * Documentación fiscal del vendedor: los tipos y los textos.
 *
 * Los textos viven acá y no repartidos por los componentes porque el panel del
 * usuario y el de administración tienen que decir lo mismo del mismo estado.
 * Y porque el distintivo aprobado dice exactamente «Documentación revisada»:
 * es una revisión manual de un papel, no una verificación de identidad, y esa
 * diferencia se pierde en cuanto cada pantalla escribe su propia versión.
 */

export type EstadoDocumentacion =
  | 'sin_presentacion'
  | 'pendiente'
  | 'aprobada'
  | 'rechazada';

/** Lo que ve el titular. Nunca trae quién revisó. */
export interface MiDocumentacion {
  estado: EstadoDocumentacion;
  cuit?: string | null;
  razon_social?: string | null;
  archivo_nombre?: string | null;
  motivo_de_rechazo?: string | null;
  presentado_el?: string | null;
  revisado_el?: string | null;
}

/** Lo que ve administración: agrega de quién es y quién decidió. */
export interface DocumentacionEnCola {
  id: string;
  user_id: string;
  user_nombre: string;
  user_email: string;
  estado: Exclude<EstadoDocumentacion, 'sin_presentacion'>;
  cuit: string;
  razon_social: string;
  archivo_nombre: string;
  archivo_bytes: number;
  motivo_de_rechazo?: string | null;
  revisado_por_nombre?: string | null;
  revisado_el?: string | null;
  presentado_el: string;
}

export interface ColaDeDocumentacion {
  items: DocumentacionEnCola[];
  total: number;
  pendientes: number;
}

export const ETIQUETA_DE_ESTADO: Record<EstadoDocumentacion, string> = {
  sin_presentacion: 'Sin presentar',
  pendiente: 'Pendiente de revisión',
  aprobada: 'Documentación revisada',
  rechazada: 'Rechazada',
};

export const DISTINTIVO = 'Documentación revisada';

export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
