import React, { useState } from 'react';
import styles from './UserDashboard.module.css';
import { useToast } from '../../hooks/useToast';
import { apiPost, tokenStorage } from '../../utils/api';

/**
 * Cambiar la propia contraseña, para cualquier rol.
 *
 * Las reglas de la contraseña nueva son de la API, y su mensaje se muestra
 * tal cual: acá sólo se comprueba que esté escrita dos veces igual, que es lo
 * único que la API no puede saber. Un error no borra nada: se corrige el campo
 * que hace falta y se vuelve a mandar.
 */
export const CambiarClave: React.FC = () => {
  const { showToast } = useToast();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!actual || !nueva || !repetida) {
      setError('Completá los tres campos.');
      return;
    }
    if (nueva !== repetida) {
      setError('La contraseña nueva y su repetición no coinciden.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const sesion = await apiPost<{ access_token?: string; refresh_token?: string }>(
        '/auth/change-password', { current_password: actual, new_password: nueva });
      // Cambiarla cierra todas las sesiones de la cuenta, también ésta: con los
      // tokens nuevos que devuelve la API, sigue abierta sin ingresar de nuevo.
      if (sesion.access_token) tokenStorage.setTokens(sesion.access_token, sesion.refresh_token);
      setActual('');
      setNueva('');
      setRepetida('');
      showToast('Cambiaste tu contraseña.', 'success');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo cambiar la contraseña. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className={styles.claveSection} aria-labelledby="titulo-cambiar-clave">
      <div className={styles.sectionHeader}>
        <h2 id="titulo-cambiar-clave">Cambiar contraseña</h2>
      </div>
      <div className={styles.docContent}>
        <form className={styles.docFormulario} onSubmit={cambiar} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="clave-actual">Contraseña actual</label>
            <input
              id="clave-actual"
              type="password"
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="clave-nueva">Contraseña nueva</label>
            <input
              id="clave-nueva"
              type="password"
              autoComplete="new-password"
              aria-describedby="clave-nueva-regla"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <p id="clave-nueva-regla" className={styles.campoPrivado}>
              Al menos 6 caracteres y hasta 72. Las letras con acento y la ñ cuentan doble.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="clave-repetida">Repetí la contraseña nueva</label>
            <input
              id="clave-repetida"
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </div>

          {error && (
            <div className={styles.docError} role="alert">
              {error}
            </div>
          )}

          <div className={styles.editActions}>
            <button type="submit" className={styles.saveButton} disabled={enviando}>
              {enviando ? 'Cambiando…' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
