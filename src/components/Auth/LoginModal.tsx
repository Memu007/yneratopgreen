import React, { useState } from 'react';
import styles from './AuthModal.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useCapaModal } from '../../hooks/useCapaModal';

interface LoginModalProps {
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSwitchToRegister }) => {
  const { login, reenviarVerificacion } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Cuando el motivo del rechazo es la falta de confirmación, el aviso ofrece
  // el reenvío: sin eso la persona queda sin salida.
  const [faltaConfirmar, setFaltaConfirmar] = useState(false);
  const [avisoDeReenvio, setAvisoDeReenvio] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFaltaConfirmar(false);
    setAvisoDeReenvio('');
    setIsLoading(true);

    try {
      await login(email, password);
      showToast('¡Bienvenido/a de nuevo!', 'success');
      onClose();
    } catch (err) {
      console.error('❌ Error en login modal:', err);
      const errorMessage = err instanceof Error ? err.message : 'Email o contraseña incorrectos';
      setError(errorMessage);
      setFaltaConfirmar(/no está confirmada/i.test(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReenviar = async () => {
    setAvisoDeReenvio('');
    setIsLoading(true);
    try {
      setAvisoDeReenvio(await reenviarVerificacion(email));
    } catch (err) {
      setAvisoDeReenvio(
        err instanceof Error ? err.message : 'No se pudo reenviar el correo.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Atrapa el foco, lo devuelve al cerrar, cierra con Escape y traba el
  // scroll del fondo. Ninguna capa del producto hacía nada de esto.
  const capa = useCapaModal<HTMLDivElement>(onClose);

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modal}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-label="Ingresar"
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Iniciar Sesión</h2>
          <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error} role="alert">{error}</div>}
          {faltaConfirmar && (
            <button
              type="button"
              className={styles.switchLink}
              onClick={handleReenviar}
              disabled={isLoading}
            >
              Reenviame el correo de confirmación
            </button>
          )}
          {avisoDeReenvio && (
            <div className={styles.success} role="status">
              {avisoDeReenvio}
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Email <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              className={styles.input}
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Contraseña <span className={styles.required}>*</span>
            </label>
            <div className={styles.passwordGroup}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className={styles.switchText}>
          ¿No tienes cuenta?{' '}
          <button type="button" className={styles.switchLink} onClick={onSwitchToRegister}>
            Regístrate aquí
          </button>
        </div>
      </div>
    </div>
  );
};
