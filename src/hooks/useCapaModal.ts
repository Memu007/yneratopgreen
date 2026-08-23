import { useEffect, useRef } from 'react';

/**
 * Lo que toda capa que se abre encima tiene que hacer, y que hasta ahora cada
 * modal resolvía a medias o no resolvía:
 *
 * 1. **Atrapar el foco.** Sin esto, tabular desde adentro del modal sigue
 *    recorriendo la página de atrás, que está tapada: quien navega con teclado
 *    termina moviéndose por controles que no puede ver.
 * 2. **Devolverlo al cerrar.** Al volver, el foco tiene que estar donde estaba,
 *    no al principio del documento.
 * 3. **Cerrar con Escape.**
 * 4. **Trabar el scroll del fondo**, para que la rueda no mueva la página de
 *    atrás mientras la capa está abierta.
 *
 * Devuelve la referencia que hay que poner en el contenedor de la capa.
 */
const FOCALIZABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useCapaModal<T extends HTMLElement>(onClose: () => void) {
  const contenedor = useRef<T>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El foco entra en la capa. Si adentro no hay nada focalizable todavía
    // —una capa que está cargando—, se enfoca el contenedor mismo.
    const primero = contenedor.current?.querySelector<HTMLElement>(FOCALIZABLES);
    (primero || contenedor.current)?.focus();

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !contenedor.current) return;

      const focalizables = Array.from(
        contenedor.current.querySelectorAll<HTMLElement>(FOCALIZABLES),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focalizables.length === 0) return;

      const primeroActual = focalizables[0];
      const ultimo = focalizables[focalizables.length - 1];
      const activo = document.activeElement;

      // El ciclo se cierra a mano en los dos extremos: es lo único que impide
      // que el foco se escape a la página de atrás.
      if (e.shiftKey && (activo === primeroActual || activo === contenedor.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primeroActual.focus();
      }
    };

    document.addEventListener('keydown', alTeclear, true);
    return () => {
      document.removeEventListener('keydown', alTeclear, true);
      document.body.style.overflow = overflowPrevio;
      previo?.focus?.();
    };
  }, [onClose]);

  return contenedor;
}
