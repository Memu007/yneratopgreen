/**
 * Tipos de logística compartidos entre el panel del transportista y el
 * checkout.
 *
 * El catálogo de cargas NO está acá: lo sirve el servidor en
 * `GET /logistics/cargo-types`, porque lo que se guarda en cada perfil son sus
 * claves. Una copia en el frontend se desincronizaría sin que nada avisara.
 */

export interface TipoDeCarga {
  value: string;
  label: string;
}
