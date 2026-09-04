/**
 * Una sola política para cerrar un formulario con trabajo sin guardar.
 *
 * No es autoguardado ni borradores: es la protección mínima contra un cierre
 * accidental. Un formulario limpio cierra por donde siempre; uno sucio
 * pregunta una vez, y la pregunta es una capa más —la de arriba— de la misma
 * pila que el resto de los diálogos.
 *
 * Cinco formularios la usan: perfil (con los datos de transportista), alta de
 * publicación, edición de publicación, checkout y calificación. La política
 * vive acá una vez y no cinco veces en cada uno.
 */
import React, { useCallback, useRef, useState } from 'react';

import { Pregunta } from './Pregunta';

/**
 * ¿Cambió algo respecto del retrato inicial?
 *
 * El retrato se saca de los valores con los que el formulario ABRE, así que un
 * valor precargado no es un cambio; y como se compara valor por valor, cambiar
 * algo y volver a dejarlo como estaba deja el formulario limpio otra vez.
 */
export function huboCambios(inicial: unknown, actual: unknown): boolean {
  return JSON.stringify(inicial) !== JSON.stringify(actual);
}

export interface SalidaProtegida {
  /**
   * Un camino de cierre, protegido. Si no hay trabajo sin guardar cierra en el
   * acto; si lo hay, pregunta y recién cierra cuando la persona elige
   * descartar.
   */
  alSalir: (hayTrabajoSinGuardar: boolean, cerrar: () => void) => void;
  /** ¿Está la pregunta arriba? Sirve para no disparar nada mientras tanto. */
  preguntando: boolean;
  /** La pregunta, para dibujarla. Es `null` mientras no haga falta. */
  pregunta: React.ReactNode;
}

export function useSalidaProtegida(): SalidaProtegida {
  // Qué cierre quedó esperando la decisión. Va en una referencia y no en el
  // estado: mientras la pregunta está arriba, un segundo pedido de cierre no
  // puede encolar otro que después se ejecutaría sobre lo que ya no está.
  const cierrePendiente = useRef<(() => void) | null>(null);
  const [preguntando, setPreguntando] = useState(false);

  const alSalir = useCallback((hayTrabajoSinGuardar: boolean, cerrar: () => void) => {
    if (cierrePendiente.current) return;
    if (!hayTrabajoSinGuardar) {
      cerrar();
      return;
    }
    cierrePendiente.current = cerrar;
    setPreguntando(true);
  }, []);

  const alSeguirEditando = useCallback(() => {
    cierrePendiente.current = null;
    setPreguntando(false);
  }, []);

  const alDescartar = useCallback(() => {
    const cerrar = cierrePendiente.current;
    cierrePendiente.current = null;
    setPreguntando(false);
    // El cierre corre después de que la pregunta se haya ido: así el foco
    // vuelve por la pila —primero al control que pidió cerrar, después al
    // disparador de la capa que se cierra— y no queda en un nodo que ya no
    // está en el documento.
    if (cerrar) setTimeout(cerrar, 0);
  }, []);

  return {
    alSalir,
    preguntando,
    pregunta: preguntando
      ? <Pregunta alSeguirEditando={alSeguirEditando} alDescartar={alDescartar} />
      : null,
  };
}
