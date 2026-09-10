/**
 * La confirmación del producto: una decisión que se toma a propósito, escrita
 * una sola vez.
 *
 * Antes había dos maneras de preguntar, y ninguna servía para el panel de
 * administración. `Pregunta` —el cartel de «tenés cambios sin guardar»— tenía
 * su texto adentro y no se podía reusar. Y las acciones que pisan datos
 * ajenos usaban `window.confirm`, que no es una capa del producto: no tiene
 * nombre accesible, no atrapa el foco, no lo devuelve, no se puede leer con el
 * estilo del sitio y bloquea el hilo. Peor: había recorridos —cambiar el rol,
 * activar o desactivar una cuenta, cambiar el estado de una publicación— que
 * no preguntaban nada y escribían en el acto.
 *
 * Esto es esa capa, una sola, para todos los casos. Lo que cambia entre un
 * caso y otro es el texto; lo que no cambia —que Escape, el fondo y Cancelar
 * signifiquen lo mismo, que el foco entre y vuelva, que confirmar sea el único
 * camino que escribe— vive acá y no se vuelve a decidir en cada pantalla.
 *
 * `Pregunta` pasó a ser un uso de esto, así que la política de
 * `FORM-DIRTY-1` no cambió de forma ni de comportamiento: sigue con su texto,
 * y sus consumidores no se enteraron.
 */
import React from 'react';

import { useCapaModal } from '../hooks/useCapaModal';
import styles from './salidaProtegida.module.css';

export interface ConfirmacionProps {
  /** Qué se está por hacer. Nombra el objeto, no la acción en abstracto. */
  titulo: string;
  /** La consecuencia, en una frase. Es lo que decide a quien duda. */
  detalle: React.ReactNode;
  /** El texto del botón que escribe. Dice qué va a pasar, no «Aceptar». */
  textoConfirmar: string;
  /** El texto del botón que no escribe. */
  textoCancelar?: string;
  /**
   * Si la acción destruye o degrada algo. Cambia sólo el orden y el énfasis de
   * los botones: la salida segura queda primero y con el peso visual.
   */
  destructiva?: boolean;
  /** Mientras la mutación viaja: no se puede confirmar dos veces. */
  enCurso?: boolean;
  /**
   * Cómo se llaman los `id` del título y del detalle. Existe porque hay capas
   * que ya tenían nombre antes de que esto se factorizara —la de
   * `FORM-DIRTY-1` se identifica por `titulo-cambios-sin-guardar`— y ese
   * nombre es parte de su contrato: cambiarlo la vuelve irreconocible para
   * quien la busca por ahí. Sin esto, cada capa se nombra sola.
   */
  identidad?: string;
  alConfirmar: () => void;
  alCancelar: () => void;
}

/**
 * Un identificador propio por capa. Dos confirmaciones nunca conviven, pero el
 * `aria-labelledby` tiene que apuntar a un `id` real y único aunque una capa se
 * esté yendo mientras otra entra.
 */
let cuantas = 0;

export const Confirmacion: React.FC<ConfirmacionProps> = ({
  titulo,
  detalle,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  destructiva = false,
  enCurso = false,
  identidad,
  alConfirmar,
  alCancelar,
}) => {
  // El identificador se fija en el primer render y no cambia con los siguientes:
  // si se recalculara, el `aria-labelledby` apuntaría a un `id` viejo.
  const [ids] = React.useState(() => {
    if (identidad) return { titulo: `titulo-${identidad}`, detalle: `detalle-${identidad}` };
    cuantas += 1;
    return { titulo: `confirmacion-titulo-${cuantas}`, detalle: `confirmacion-detalle-${cuantas}` };
  });

  // Escape cierra ESTA capa —la última de la pila— y significa cancelar, igual
  // que el fondo y que el botón. Cancelar no escribe nunca.
  const capa = useCapaModal<HTMLDivElement>(alCancelar);

  const botonConfirmar = (
    <button
      type="button"
      className={`tg-button ${destructiva ? 'tg-button--secondary' : 'tg-button--primary'} ${styles.accion}`}
      onClick={alConfirmar}
      disabled={enCurso}
    >
      {enCurso ? 'Aplicando…' : textoConfirmar}
    </button>
  );

  const botonCancelar = (
    <button
      type="button"
      className={`tg-button ${destructiva ? 'tg-button--primary' : 'tg-button--secondary'} ${styles.accion}`}
      onClick={alCancelar}
      disabled={enCurso}
    >
      {textoCancelar}
    </button>
  );

  return (
    <div
      className={styles.fondo}
      onClick={(evento) => {
        // El clic no sigue subiendo: debajo puede haber otro fondo que también
        // cierra, y sin esto cancelar acá cerraría además la capa de atrás.
        evento.stopPropagation();
        if (!enCurso) alCancelar();
      }}
    >
      <div
        className={styles.tarjeta}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.titulo}
        aria-describedby={ids.detalle}
        tabIndex={-1}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className={styles.encabezado}>
          <h2 id={ids.titulo} className={styles.titulo}>{titulo}</h2>
          <button
            type="button"
            className={styles.cerrar}
            aria-label="Cerrar"
            onClick={alCancelar}
            disabled={enCurso}
          >
            ×
          </button>
        </div>

        <p id={ids.detalle} className={styles.detalle}>{detalle}</p>

        {/* En una decisión destructiva la salida segura va primero: es la que
            recibe el foco al abrir, así que confirmar con Enter a ciegas no
            destruye nada. */}
        <div className={styles.acciones}>
          {destructiva ? botonCancelar : botonConfirmar}
          {destructiva ? botonConfirmar : botonCancelar}
        </div>
      </div>
    </div>
  );
};
