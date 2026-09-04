import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
// Se reutilizan los estilos de la pantalla de resultado de pago: misma forma
// —tarjeta centrada con título, mensaje y acciones— así que no hace falta una
// hoja nueva. Los círculos de ícono de esa hoja quedan afuera; ver abajo.
import styles from './PaymentResultPage.module.css';

interface VerifyEmailPageProps {
  onGoToLogin: () => void;
  onGoHome: () => void;
}

type Estado = 'verificando' | 'ok' | 'error';

// La ruta pelada, sin fragmento: es donde queda la barra apenas se lee el
// token.
const RUTA_LIMPIA = '/verificar-correo';

// El token llega en el fragmento del enlace, que el navegador nunca manda al
// servidor. De ahí sale a memoria y la barra se limpia en el acto.
function leerTokenDelFragmento(): string | null {
  const fragmento = window.location.hash.replace(/^#/, '');
  if (!fragmento) return null;
  return new URLSearchParams(fragmento).get('token');
}

export function VerifyEmailPage({ onGoToLogin, onGoHome }: VerifyEmailPageProps) {
  const { verificarCorreo, reenviarVerificacion } = useAuth();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('Estamos confirmando tu correo…');
  const [correo, setCorreo] = useState('');
  const [avisoDeReenvio, setAvisoDeReenvio] = useState('');
  const [reenviando, setReenviando] = useState(false);

  // Cada enlace se consume UNA sola vez: acá queda el último token procesado.
  // Sin esto, el doble montaje que hace React en desarrollo gastaría el token
  // y la segunda respuesta —"este enlace ya se usó"— pisaría el éxito de la
  // primera.
  const yaProcesado = useRef<string | null>(null);

  useEffect(() => {
    const procesar = () => {
      const token = leerTokenDelFragmento();

      // El token sale de la barra ANTES de cualquier llamada. En el fragmento
      // no llega al servidor, pero sí queda a la vista en la barra y en el
      // historial, y recargar reintentaría un enlace ya usado. Se queda en
      // memoria y nada más.
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, '', RUTA_LIMPIA);
      }

      if (!token) {
        // Sin token: o el enlace vino incompleto, o es el segundo montaje de
        // React, que ya no lo ve porque la barra quedó limpia. Sólo el primer
        // caso es un error para mostrar.
        if (yaProcesado.current === null) {
          setEstado('error');
          setMensaje('El enlace está incompleto. Pedí uno nuevo desde el ingreso.');
        }
        return;
      }

      if (token === yaProcesado.current) return;
      yaProcesado.current = token;

      setEstado('verificando');
      setMensaje('Estamos confirmando tu correo…');

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
    };

    procesar();

    // Abrir un segundo enlace cuando ya estamos en esta pantalla sólo cambia
    // el fragmento, y eso NO recarga la página: sin escuchar el cambio, la
    // vista seguiría mostrando el resultado del enlace anterior.
    window.addEventListener('hashchange', procesar);
    return () => window.removeEventListener('hashchange', procesar);
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

  // Salir de acá ya no escribe el historial: la política de navegación
  // normaliza el `pathname` al irse de una pantalla de llegada, y hacerlo
  // además desde esta página dejaba dos escrituras para el mismo paso.

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
