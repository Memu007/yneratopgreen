import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
// Se reutilizan los estilos de la pantalla de resultado de pago: misma forma
// —tarjeta centrada con título, mensaje y acciones— así que no hace falta una
// hoja nueva. Los círculos de ícono de esa hoja quedan afuera; ver abajo.
import styles from './PaymentResultPage.module.css';

interface VerifyEmailPageProps {
  onGoToLogin: () => void;
  onGoHome: () => void;
}

type Estado = 'verificando' | 'ok' | 'error';

export function VerifyEmailPage({ onGoToLogin, onGoHome }: VerifyEmailPageProps) {
  const { verificarCorreo, reenviarVerificacion } = useAuth();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('Estamos confirmando tu correo…');
  const [correo, setCorreo] = useState('');
  const [avisoDeReenvio, setAvisoDeReenvio] = useState('');
  const [reenviando, setReenviando] = useState(false);

  // El enlace se consume UNA sola vez. Sin este guardia, el doble montaje que
  // hace React en desarrollo gastaría el token y la segunda respuesta —"este
  // enlace ya se usó"— pisaría el éxito de la primera.
  const yaIntentado = useRef(false);

  useEffect(() => {
    if (yaIntentado.current) return;
    yaIntentado.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setEstado('error');
      setMensaje('El enlace está incompleto. Pedí uno nuevo desde el ingreso.');
      return;
    }

    verificarCorreo(token)
      .then((texto) => {
        setEstado('ok');
        setMensaje(texto);
      })
      .catch((error: unknown) => {
        setEstado('error');
        setMensaje(
          error instanceof Error
            ? error.message
            : 'No pudimos confirmar tu correo. Pedí un enlace nuevo.',
        );
      });
  }, [verificarCorreo]);

  const handleReenviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setAvisoDeReenvio('');
    setReenviando(true);
    try {
      setAvisoDeReenvio(await reenviarVerificacion(correo));
    } catch (error: unknown) {
      setAvisoDeReenvio(
        error instanceof Error ? error.message : 'No se pudo reenviar el correo.',
      );
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Sin el círculo con el ícono de PaymentResultPage: sus tres fondos
            dejan el glifo blanco en 2,15:1 y 2,54:1, por debajo del 3:1 que
            exige un texto de ese tamaño. El estado ya lo dicen el título y el
            mensaje, que es lo que además lee un lector de pantalla. */}
        <h1 className={styles.title}>
          {estado === 'ok' ? 'Correo confirmado' : 'Confirmación de correo'}
        </h1>

        <p className={styles.message} role="status">
          {mensaje}
        </p>

        {estado === 'error' && (
          <form className={styles.helpSection} onSubmit={handleReenviar}>
            <label htmlFor="correo-reenvio" className={styles.subMessage}>
              Escribí tu correo y te mandamos un enlace nuevo:
            </label>
            <input
              id="correo-reenvio"
              type="email"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              placeholder="tu@email.com"
              required
            />
            <button type="submit" className={styles.secondaryButton} disabled={reenviando}>
              {reenviando ? 'Reenviando…' : 'Reenviar el enlace'}
            </button>
            {avisoDeReenvio && (
              <p className={styles.subMessage} role="status">
                {avisoDeReenvio}
              </p>
            )}
          </form>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={onGoToLogin}>
            Iniciar sesión
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onGoHome}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
