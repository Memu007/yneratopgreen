import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * El punto de corte contractual de celular, leído una sola vez y escuchado.
 *
 * Es para lo único que el CSS no puede resolver: un texto que es un atributo
 * (el `placeholder` de la búsqueda) o un bloque que tiene que cambiar de lugar
 * en el documento, y no sólo en lo que se ve, para que el lector de pantalla y
 * el Tab lo encuentren donde está. Todo lo demás que cambia en celular lo
 * decide la hoja, con este mismo corte.
 */
export const CONSULTA_MOVIL = '(max-width: 599px)';

/**
 * `antesDeCambiar` corre cuando cambia el ancho y antes de que la pantalla se
 * vuelva a dibujar: es el último momento en que se puede leer qué tenía el foco
 * en el lugar viejo.
 */
export function useEsMovil(antesDeCambiar?: () => void): boolean {
  const [esMovil, setEsMovil] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(CONSULTA_MOVIL).matches,
  );
  // El aviso y el valor vigente se guardan después de dibujar, no mientras.
  const aviso = useRef(antesDeCambiar);
  const vigente = useRef(esMovil);
  useLayoutEffect(() => {
    aviso.current = antesDeCambiar;
    vigente.current = esMovil;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia(CONSULTA_MOVIL);
    const alCambiar = () => {
      if (consulta.matches === vigente.current) return;
      aviso.current?.();
      setEsMovil(consulta.matches);
    };
    // Por si cambió entre el primer dibujo y este efecto: con el mismo aviso,
    // para que el foco tampoco se pierda en ese caso.
    alCambiar();
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return esMovil;
}
