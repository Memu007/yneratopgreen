import { useEffect, useState } from 'react';
import { apiPost } from '../../utils/api';
import styles from './PaymentResultPage.module.css';

interface PaymentResultProps {
  status: 'success' | 'failure' | 'pending';
  onGoToOrders: () => void;
  onGoHome: () => void;
}

interface PaymentInfo {
  orderId: string | null;
  paymentId: string | null;
  status: string | null;
  externalReference: string | null;
}

export function PaymentResultPage({ status, onGoToOrders, onGoHome }: PaymentResultProps) {
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    orderId: null,
    paymentId: null,
    status: null,
    externalReference: null,
  });

  useEffect(() => {
    // Obtener parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    
    setPaymentInfo({
      orderId: orderId,
      paymentId: params.get('payment_id'),
      status: params.get('status'),
      externalReference: params.get('external_reference'),
    });

    // Si el pago fue exitoso, sincronizar el estado con el backend
    if (status === 'success' && orderId) {
      syncPaymentStatus(orderId);
    }
  }, [status]);

  const syncPaymentStatus = async (orderId: string) => {
    try {
      await apiPost<{ message: string; synced: boolean }>(`/payments/sync-status/${orderId}`, {});
    } catch (error) {
      console.error('Error sincronizando estado del pago:', error);
      // No mostramos error al usuario, el pago ya fue exitoso
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: '✓',
          iconClass: styles.successIcon,
          title: '¡Pago Exitoso!',
          message: 'Tu pago ha sido procesado correctamente. El vendedor será notificado y comenzará a preparar tu pedido.',
          subMessage: 'Recibirás un email con los detalles de tu compra.',
        };
      case 'failure':
        return {
          icon: '✗',
          iconClass: styles.failureIcon,
          title: 'Pago Rechazado',
          message: 'No pudimos procesar tu pago. Por favor, intenta con otro medio de pago o verifica los datos de tu tarjeta.',
          subMessage: 'Tu pedido no ha sido cancelado, puedes intentar pagar nuevamente.',
        };
      case 'pending':
        return {
          icon: '⏳',
          iconClass: styles.pendingIcon,
          title: 'Pago Pendiente',
          message: 'Tu pago está siendo procesado. Esto puede demorar entre unos minutos y 2 días hábiles dependiendo del medio de pago.',
          subMessage: 'Te notificaremos por email cuando se acredite.',
        };
      default:
        return {
          icon: '?',
          iconClass: styles.pendingIcon,
          title: 'Estado Desconocido',
          message: 'No pudimos determinar el estado de tu pago.',
          subMessage: 'Por favor, revisa tus órdenes para más información.',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={`${styles.iconCircle} ${config.iconClass}`}>
          <span className={styles.icon}>{config.icon}</span>
        </div>
        
        <h1 className={styles.title}>{config.title}</h1>
        <p className={styles.message}>{config.message}</p>
        <p className={styles.subMessage}>{config.subMessage}</p>

        {paymentInfo.orderId && (
          <div className={styles.orderInfo}>
            <p><strong>Orden:</strong> #{paymentInfo.externalReference || paymentInfo.orderId}</p>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.primaryButton} onClick={onGoToOrders}>
            Ver Mis Órdenes
          </button>
          <button className={styles.secondaryButton} onClick={onGoHome}>
            Volver al Inicio
          </button>
        </div>

        {status === 'failure' && (
          <div className={styles.helpSection}>
            <h3>¿Necesitas ayuda?</h3>
            <ul>
              <li>Verifica que los datos de tu tarjeta sean correctos</li>
              <li>Asegúrate de tener fondos suficientes</li>
              <li>Intenta con otro medio de pago</li>
              <li>Contacta a tu banco si el problema persiste</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
