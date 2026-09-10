/**
 * La contraseña temporal, una sola vez.
 *
 * Restablecer la contraseña de otra persona deja un secreto en manos de quien
 * lo hizo, y ese secreto tiene que llegar a su dueño sin quedar por el camino.
 * Por eso acá no hay nada que la conserve: no se registra en la consola, no
 * entra en un toast, no viaja en la URL y no se guarda en el navegador. Vive
 * en el estado de React mientras esta capa está abierta y se va con ella.
 *
 * No hay botón de copiar a propósito: el portapapeles la deja disponible para
 * cualquier otra aplicación y sobrevive a cerrar esta pantalla, que es
 * exactamente lo que esta capa promete que no pasa. Se lee y se pasa por un
 * canal seguro.
 *
 * Al cerrar no se puede recuperar. Si se perdió, se restablece de nuevo: eso
 * genera otra, y la anterior deja de servir.
 */
import React from 'react';

import { useCapaModal } from '../../hooks/useCapaModal';
import styles from './ClaveTemporal.module.css';

interface ClaveTemporalProps {
  usuario: string;
  clave: string;
  alCerrar: () => void;
}

export const ClaveTemporal: React.FC<ClaveTemporalProps> = ({ usuario, clave, alCerrar }) => {
  const capa = useCapaModal<HTMLDivElement>(alCerrar);

  return (
    <div className={styles.fondo} onClick={(evento) => { evento.stopPropagation(); alCerrar(); }}>
      <div
        className={styles.tarjeta}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clave-temporal-titulo"
        aria-describedby="clave-temporal-detalle"
        tabIndex={-1}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="clave-temporal-titulo" className={styles.titulo}>
          Contraseña temporal de {usuario}
        </h2>

        <p id="clave-temporal-detalle" className={styles.detalle}>
          Esta es la única vez que se muestra. Al cerrar no se puede volver a verla;
          si se pierde, hay que restablecerla otra vez.
        </p>

        {/* La clave se marca como texto para leer y dictar: espaciada, en una
            tipografía donde no se confundan los caracteres parecidos. */}
        <p className={styles.clave} aria-label={`Contraseña temporal: ${clave}`}>
          <code>{clave}</code>
        </p>

        <p className={styles.aviso}>
          Pasásela por un canal donde puedas confirmar con quién estás hablando —en
          persona, o una llamada— y pedile que la cambie al entrar. No la mandes por
          un canal que quede escrito y compartido.
        </p>

        <div className={styles.acciones}>
          <button
            type="button"
            className="tg-button tg-button--primary"
            onClick={alCerrar}
          >
            Ya la anoté, cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
