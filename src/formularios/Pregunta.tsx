/**
 * La pregunta que aparece cuando se intenta cerrar un formulario con trabajo
 * sin guardar. Vive en su propio archivo porque el resto de la política no
 * dibuja nada: acá está el único componente.
 *
 * Ya no dibuja la capa: la dibuja `Confirmacion`, que es la misma que usa el
 * panel de administración. Acá quedó lo único que es propio de `FORM-DIRTY-1`:
 * su texto, qué significa cada salida, y su nombre.
 *
 * El nombre importa y por eso se pasa a mano. Esta capa se identifica por
 * `titulo-cambios-sin-guardar` desde que existe, y quien la busca la busca por
 * ahí. Dejar que se nombrara sola la volvió irreconocible: la política seguía
 * funcionando y aun así parecía que no preguntaba nada.
 *
 * El comportamiento visible no cambió: mismo título, mismo detalle, mismos
 * botones y el mismo orden, y Escape, la X y el fondo siguen queriendo decir
 * «seguir editando» —la salida destructiva se elige a propósito, nunca por
 * descarte—.
 */
import React from 'react';

import { Confirmacion } from './Confirmacion';

interface PreguntaProps {
  alSeguirEditando: () => void;
  alDescartar: () => void;
}

export const Pregunta: React.FC<PreguntaProps> = ({ alSeguirEditando, alDescartar }) => (
  <Confirmacion
    identidad="cambios-sin-guardar"
    titulo="Tenés cambios sin guardar"
    detalle="Si salís ahora, lo que escribiste se pierde."
    textoConfirmar="Descartar cambios"
    textoCancelar="Seguir editando"
    destructiva
    alConfirmar={alDescartar}
    alCancelar={alSeguirEditando}
  />
);
