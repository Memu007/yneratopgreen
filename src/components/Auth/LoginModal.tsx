import React, { useState } from 'react';
import styles from './AuthModal.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useCapaModal } from '../../hooks/useCapaModal';

interface LoginModalProps {
  onClose: () => void;
  onSwitchToRegister: () => void;
  /** Salida para quien no puede entrar: lleva a Contacto, que es donde hay
      una persona. No hay recuperación automática todavía, así que el Login no
      puede prometer un correo, un enlace ni un plazo: lo único honesto es
      decir por dónde se sigue. */
  onIrASoporte: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onClose,
  onSwitchToRegister,
  onIrASoporte,
}) => {
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
      // El mismo criterio que en el contexto: se registra el mensaje que se
      // le muestra a la persona, no el objeto que lo trae.
      console.error('Fallo el ingreso desde el formulario:', err instanceof Error ? err.message : 'error desconocido');
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
            <label className={styles.label} htmlFor="login-email">
              Email <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              id="login-email"
              className={styles.input}
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="login-clave">
              Contraseña <span className={styles.required}>*</span>
            </label>
            <div className={styles.passwordGroup}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-clave"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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

        {/* Quien olvidó la contraseña no tenía ninguna salida acá: probaba,
            fallaba y volvía a probar. No hay restablecimiento automático y no
            se inventa uno; se dice que no lo hay y se ofrece el canal que sí
            existe. Sin promesa de correo ni de plazo. */}
        {/* `helpText` ya existe y ya la usa el registro: mismo par de colores
            que el resto de los textos secundarios, así que esta salida no
            estrena ningún estilo. */}
        <p className={styles.helpText}>
          ¿Olvidaste tu contraseña? Todavía no hay recuperación automática.{' '}
          <button type="button" className={styles.switchLink} onClick={onIrASoporte}>
            Escribinos por Contacto
          </button>
        </p>

        <div className={styles.switchText}>
          ¿No tenés cuenta?{' '}
          <button type="button" className={styles.switchLink} onClick={onSwitchToRegister}>
            Registrate acá
          </button>
        </div>
      </div>
    </div>
  );
};
