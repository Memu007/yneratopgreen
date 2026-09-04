/**
 * El único lugar del producto que escribe el historial y el único que escucha
 * `popstate`. Todo lo demás pide navegar; nadie más toca `window.history`.
 *
 * Tres reglas y ninguna más:
 *
 * 1. Ir a otra ubicación es una entrada de verdad (`pushState`). Elegir la que
 *    ya está no agrega nada: el historial no se llena de repetidos.
 * 2. Salir de una pantalla de llegada —el correo, la vuelta de Mercado Pago—
 *    REEMPLAZA su entrada: es un resultado que ya se leyó, y volver a él con
 *    Atrás o recargando anuncia de nuevo algo que ya pasó.
 * 3. Una capa visible —el detalle de una publicación— no es una ubicación: es
 *    una entrada más sobre la misma URL, marcada en el estado de la entrada.
 *    Así el primer Atrás cierra el detalle y deja intacto lo de atrás, y
 *    cerrarlo con la propia interfaz consume esa entrada en vez de dejarla
 *    colgada.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  esPantallaDeLlegada,
  filtrosDeLaBarra,
  seccionDeLaBarra,
  urlDe,
  type Seccion,
} from './politica';

interface EstadoDeLaEntrada {
  capa: string | null;
}

export interface Navegacion {
  /** La sección que declara la barra. */
  seccion: Seccion;
  /** La publicación abierta sobre esa sección, si hay alguna. */
  capa: string | null;
  /**
   * Cuántas veces movió la barra el historial. Lo que guarda estado leído de
   * la URL —los filtros del Mercado— lo relee cuando esto cambia: sin eso,
   * volver a una entrada mostraría su URL con los controles de otra.
   */
  version: number;
  navegar: (destino: Seccion) => void;
  abrirCapa: (id: string) => void;
  cerrarCapa: () => void;
}

const barraActual = () => `${window.location.pathname}${window.location.search}`;

const capaDeLaEntrada = (): string | null => {
  const estado = window.history.state as EstadoDeLaEntrada | null;
  return typeof estado?.capa === 'string' ? estado.capa : null;
};

const seccionActual = () =>
  seccionDeLaBarra(window.location.pathname, window.location.search);

export function useNavegacion(): Navegacion {
  const [seccion, setSeccion] = useState<Seccion>(seccionActual);
  const [capa, setCapa] = useState<string | null>(capaDeLaEntrada);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // El ÚNICO oyente de `popstate`. Antes no había ninguno: Atrás movía la
    // barra y la pantalla se quedaba donde estaba.
    const alMoverElHistorial = () => {
      setSeccion(seccionActual());
      setCapa(capaDeLaEntrada());
      setVersion((cuantas) => cuantas + 1);
    };
    window.addEventListener('popstate', alMoverElHistorial);
    return () => window.removeEventListener('popstate', alMoverElHistorial);
  }, []);

  const navegar = useCallback((destino: Seccion) => {
    const desde = seccionActual();
    const filtros = filtrosDeLaBarra(window.location.search);

    // La capa no sobrevive a una navegación deliberada, y su entrada tampoco:
    // se reescribe sin ella —misma URL, otro estado— para que Atrás no traiga
    // de vuelta un detalle que la persona dejó al irse.
    if (capaDeLaEntrada() !== null) {
      window.history.replaceState({ capa: null }, '', barraActual());
    }

    const url = urlDe(destino, destino === 'marketplace' ? filtros : null);
    const aqui = urlDe(desde, desde === 'marketplace' ? filtros : null);
    if (esPantallaDeLlegada(desde)) {
      // Sale del `pathname` de llegada sin dejarlo atrás.
      window.history.replaceState({ capa: null }, '', url);
    } else if (url !== aqui) {
      window.history.pushState({ capa: null }, '', url);
    } else if (url !== barraActual()) {
      // Es la ubicación que ya estaba, escrita de otra manera: se ordena la
      // barra sin agregar una entrada repetida.
      window.history.replaceState({ capa: null }, '', url);
    }

    setSeccion(destino);
    setCapa(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const abrirCapa = useCallback((id: string) => {
    window.history.pushState({ capa: id }, '', barraActual());
    setCapa(id);
  }, []);

  const cerrarCapa = useCallback(() => {
    // Se cierra volviendo atrás, que es lo que consume la entrada. Cerrar sin
    // volver dejaría una entrada fantasma: el primer Atrás no haría nada
    // visible y el segundo sacaría del sitio.
    if (capaDeLaEntrada() !== null) window.history.back();
    else setCapa(null);
  }, []);

  return useMemo(
    () => ({ seccion, capa, version, navegar, abrirCapa, cerrarCapa }),
    [seccion, capa, version, navegar, abrirCapa, cerrarCapa],
  );
}

/**
 * La navegación viva, para lo que está lejos de `App`. La tarjeta de una
 * publicación la usa para abrir y cerrar su detalle; no escucha nada por su
 * cuenta.
 */
export const ContextoDeNavegacion = createContext<Navegacion | null>(null);

export function useNavegacionActual(): Navegacion {
  const navegacion = useContext(ContextoDeNavegacion);
  if (!navegacion) {
    throw new Error('Falta ContextoDeNavegacion.Provider por encima de este componente');
  }
  return navegacion;
}
