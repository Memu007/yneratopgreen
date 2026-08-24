import { useCallback, useEffect, useState } from 'react';
import { convertBackendProductToFrontend, getProducts } from '../utils/catalogService';
import { esDeServicio, normalizarAnatomia } from '../utils/anatomia';
import type { Product } from '../types';

/**
 * La vista previa de operaciones de Inicio y de Servicios.
 *
 * Son publicaciones reales, pedidas al mismo catálogo que el mercado y en el
 * mismo orden. No hay endpoint nuevo, no hay lista guardada en código y no hay
 * «destacadas»: el producto no tiene dato de curaduría, así que llamarlas así
 * sería inventar un criterio.
 */
export interface VistaPrevia {
  /** Hasta `cantidad` publicaciones, en el orden en que las devolvió la API. */
  operaciones: Product[];
  /**
   * Cuántas hay en total según la API.
   *
   * Es `null` cuando la vista filtró del lado del navegador —el caso de
   * servicios—, porque ahí el total de la respuesta cuenta el catálogo entero
   * y usarlo diría «12 servicios» sobre un número que no son servicios.
   */
  total: number | null;
  cargando: boolean;
  error: string | null;
  reintentar: () => void;
}

const SIN_CONEXION = 'Sin conexión. Revisá tu red e intentá de nuevo.';

/** Lo que se pide cuando hay que filtrar por dominio del lado del navegador. */
const PAGINA_PARA_FILTRAR = 100;

export function useVistaPrevia({
  activa,
  cantidad = 3,
  soloServicios = false,
  mensajeDeError,
}: {
  /** Sólo pide datos cuando la pantalla que la usa está a la vista. */
  activa: boolean;
  cantidad?: number;
  soloServicios?: boolean;
  mensajeDeError: string;
}): VistaPrevia {
  const [operaciones, setOperaciones] = useState<Product[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    if (!activa) return;

    let cancelado = false;
    setCargando(true);
    setError(null);

    // Servicios y logística no tienen filtro propio en la API: se pide el
    // catálogo canónico y se filtra por la misma regla de dominio que usa todo
    // el producto —`operationKind`—, nunca por título ni por precio.
    getProducts({
      page: 1,
      page_size: soloServicios ? PAGINA_PARA_FILTRAR : cantidad,
      sort_by: 'created_at',
      sort_order: 'desc',
    })
      .then((respuesta) => {
        if (cancelado) return;
        const publicaciones = respuesta.items.map(convertBackendProductToFrontend);
        if (soloServicios) {
          setOperaciones(
            publicaciones
              .filter((publicacion) => esDeServicio(normalizarAnatomia(publicacion.operationKind)))
              .slice(0, cantidad),
          );
          setTotal(null);
        } else {
          setOperaciones(publicaciones.slice(0, cantidad));
          setTotal(respuesta.total);
        }
      })
      .catch((fallo) => {
        if (cancelado) return;
        console.error('Error al cargar la vista previa de operaciones:', fallo);
        setOperaciones([]);
        setTotal(null);
        const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false;
        setError(sinRed ? SIN_CONEXION : mensajeDeError);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [activa, cantidad, soloServicios, mensajeDeError, intento]);

  return { operaciones, total, cargando, error, reintentar };
}
