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
   * Cuántas hay en total según la API, para el conjunto pedido.
   *
   * Cuando la vista pide sólo servicios, el endpoint filtra antes de contar,
   * así que este número son servicios y no el catálogo entero.
   */
  total: number | null;
  cargando: boolean;
  error: string | null;
  reintentar: () => void;
}

const SIN_CONEXION = 'Sin conexión. Revisá tu red e intentá de nuevo.';

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

    // El filtro por tipo lo hace la base, antes de contar y de paginar.
    //
    // Antes esto pedía las cien publicaciones más nuevas y las filtraba acá.
    // Andaba con treinta filas y mentía con mil: si las cien más nuevas eran
    // productos, la pantalla decía que no hay servicios publicados. Lo
    // encontró PM leyendo el código, no la suite, porque el seed no llega a
    // cien.
    getProducts({
      page: 1,
      page_size: cantidad,
      publication_type: soloServicios ? 'servicio' : undefined,
      sort_by: 'created_at',
      sort_order: 'desc',
    })
      .then((respuesta) => {
        if (cancelado) return;
        const publicaciones = respuesta.items.map(convertBackendProductToFrontend);
        // La defensa de dominio se conserva aunque el servidor ya filtró: si
        // alguna vez volviera una publicación que no es de servicio, la
        // pantalla no la muestra como si lo fuera.
        const visibles = soloServicios
          ? publicaciones.filter((publicacion) =>
              esDeServicio(normalizarAnatomia(publicacion.operationKind)))
          : publicaciones;
        setOperaciones(visibles.slice(0, cantidad));
        setTotal(respuesta.total);
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
