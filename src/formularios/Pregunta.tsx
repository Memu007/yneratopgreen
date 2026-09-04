/**
 * La pregunta que aparece cuando se intenta cerrar un formulario con trabajo
 * sin guardar. Vive en su propio archivo porque el resto de la política no
 * dibuja nada: acá está el único componente.
 */
import React from 'react';

import { useCapaModal } from '../hooks/useCapaModal';
import styles from './salidaProtegida.module.css';

interface PreguntaProps {
  alSeguirEditando: () => void;
  alDescartar: () => void;
}

/**
 * La pregunta. Es la capa de arriba: `useCapaModal` la mete en la pila, le
 * atrapa el foco, traba el fondo y hace que Escape la cierre a ella y no a lo
 * que hay debajo. Escape, la X y el fondo significan «seguir editando»: la
 * salida destructiva se elige a propósito, nunca por descarte.
 */
export const Pregunta: React.FC<PreguntaProps> = ({ alSeguirEditando, alDescartar }) => {
  const capa = useCapaModal<HTMLDivElement>(alSeguirEditando);

  return (
    <div
      className={styles.fondo}
      onClick={(evento) => {
        // El clic no sigue subiendo: debajo hay un fondo que también cierra, y
        // sin esto la pregunta se contestaría a sí misma y volvería a aparecer.
        evento.stopPropagation();
        alSeguirEditando();
      }}
    >
      <div
        className={styles.tarjeta}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cambios-sin-guardar"
        aria-describedby="detalle-cambios-sin-guardar"
        tabIndex={-1}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className={styles.encabezado}>
          <h2 id="titulo-cambios-sin-guardar" className={styles.titulo}>
            Tenés cambios sin guardar
          </h2>
          <button
            type="button"
            className={styles.cerrar}
            aria-label="Cerrar"
            onClick={alSeguirEditando}
          >
            ×
          </button>
        </div>

        <p id="detalle-cambios-sin-guardar" className={styles.detalle}>
          Si salís ahora, lo que escribiste se pierde.
        </p>

        <div className={styles.acciones}>
          <button
            type="button"
            className={`tg-button tg-button--primary ${styles.accion}`}
            onClick={alSeguirEditando}
          >
            Seguir editando
          </button>
          <button
            type="button"
            className={`tg-button tg-button--secondary ${styles.accion}`}
            onClick={alDescartar}
          >
            Descartar cambios
          </button>
        </div>
      </div>
    </div>
  );
};
