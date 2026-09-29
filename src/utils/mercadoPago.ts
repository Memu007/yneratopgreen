/**
 * Lo que el navegador sabe del vínculo con Mercado Pago.
 *
 * Vive fuera de los componentes porque lo usan dos: el encabezado, que recibe
 * al vendedor cuando vuelve de autorizar, y el panel, que muestra el estado.
 *
 * Todo lo que hay acá son códigos de un enum del backend. El texto crudo de
 * Mercado Pago —y cualquier credencial— no llega nunca hasta el navegador, así
 * que traducir es elegir una frase de esta lista, no interpretar un error
 * ajeno.
 */

export type EstadoMP =
  | 'no_configurado'
  | 'desconectado'
  | 'conectado'
  | 'requiere_reconexion';

export interface VinculoMP {
  estado: EstadoMP;
  mp_user_id: string | null;
  vinculado_el: string | null;
  expira_el: string | null;
  conviene_renovar: boolean;
  motivo?: string | null;
}

/** Cada motivo dice qué pasó y qué puede hacer la persona al respecto. */
export const MOTIVOS_MP: Record<string, string> = {
  cancelado: 'No autorizaste la conexión. Podés intentarlo cuando quieras.',
  estado_invalido: 'El pedido de conexión venció o ya se había usado. Empezalo de nuevo.',
  sin_sesion: 'Se cerró tu sesión durante la conexión. Entrá de nuevo y volvé a intentar.',
  sesion_distinta: 'Esa conexión se había iniciado desde otra sesión. Empezala de nuevo desde acá.',
  cuenta_en_uso: 'Esa cuenta de Mercado Pago ya está vinculada a otro usuario de AgroBoeda.',
  mp_rechazo: 'Mercado Pago rechazó la conexión. Probá de nuevo en unos minutos.',
  mp_sin_respuesta: 'Mercado Pago no respondió a tiempo. Probá de nuevo en unos minutos.',
  respuesta_invalida: 'Mercado Pago respondió algo inesperado. Probá de nuevo en unos minutos.',
  credencial_ilegible: 'Tus credenciales guardadas dejaron de ser válidas. Reconectá tu cuenta.',
  sin_configurar: 'La conexión con Mercado Pago todavía no está habilitada.',
  otra_cuenta_con_cobros: 'Tenés ventas con cobro de Mercado Pago en curso, y se terminan con la cuenta '
    + 'que ya tenías vinculada: sigue vinculada esa. Vas a poder cambiarla cuando esas ventas se paguen, se '
    + 'cancelen o venzan sin pago.',
};

export const explicarMP = (motivo?: string | null) =>
  (motivo && MOTIVOS_MP[motivo]) || 'No se pudo completar la conexión con Mercado Pago.';

export const VINCULO_OK = 'vinculado';

/** El motivo del 409 de desvincular: hay cobros en curso. */
export const COBROS_EN_CURSO = 'cobros_en_curso';

/**
 * Por qué no se pudo desvincular y cuándo se va a poder. Lo dice el panel,
 * no un aviso que se va: es lo que la persona tiene que saber para volver.
 */
export function explicarCobrosEnCurso(cuantos: number): string {
  const una = cuantos === 1;
  return `Todavía no podés desvincular tu cuenta: tenés ${cuantos} ${una ? 'venta' : 'ventas'} con cobro de `
    + `Mercado Pago en curso, y AgroBoeda necesita tu cuenta para confirmar con Mercado Pago cómo `
    + `${una ? 'termina' : 'terminan'}. Vas a poder desvincularla cuando ${una ? 'esa venta' : 'esas ventas'} `
    + `${una ? 'se pague, se cancele o venza' : 'se paguen, se cancelen o venzan'} sin pago.`;
}

/**
 * Saca de la URL el resultado que dejó el callback y lo borra, para que
 * recargar la página no vuelva a anunciar lo mismo. Devuelve `null` si esta
 * carga no viene de Mercado Pago.
 */
export function resultadoDeMercadoPago(): { vinculado: boolean; motivo: string | null } | null {
  const parametros = new URLSearchParams(window.location.search);
  const vinculado = parametros.get('mp');
  const motivo = parametros.get('mp_error');
  if (!vinculado && !motivo) return null;

  parametros.delete('mp');
  parametros.delete('mp_error');
  const consulta = parametros.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${consulta ? `?${consulta}` : ''}${window.location.hash}`,
  );

  return { vinculado: vinculado === VINCULO_OK, motivo };
}
