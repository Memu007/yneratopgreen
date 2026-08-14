import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPost, tokenStorage } from '../../utils/api';
import styles from './PaymentResultPage.module.css';

/**
 * La pantalla a la que vuelve el comprador desde Mercado Pago.
 *
 * Acá había un cartel que decía «¡Pago Exitoso!» porque la persona había
 * llegado por `/payment/success`. Esa URL la escribe cualquiera: no prueba que
 * se haya pagado nada, y decirlo es peor que no decir nada, porque el
 * comprador se va tranquilo de una compra que nadie cobró.
 *
 * Lo que hace ahora es lo único honesto que se puede hacer desde un navegador:
 * decir de dónde volvió la persona, y **preguntarle al servidor** —que le
 * pregunta a Mercado Pago— qué pasó de verdad. Mientras no haya respuesta,
 * dice que está verificando. Si Mercado Pago no contesta, lo dice también.
 */

interface PaymentResultProps {
  /** Por cuál de las tres vueltas llegó. Es contexto, no un resultado. */
  status: 'success' | 'failure' | 'pending';
  onGoToOrders: () => void;
  onGoHome: () => void;
}

interface EstadoDePago {
  order_number: string;
  status: string;
  payment_state?: string | null;
  verificado: boolean;
  can_pay: boolean;
  payment_url?: string | null;
}

/** Cuántas veces se vuelve a preguntar antes de dejar de insistir. */
const INTENTOS = 5;
const ESPERA_MS = 3000;

const TEXTO_DEL_ESTADO: Record<string, { titulo: string; detalle: string }> = {
  aprobado: {
    titulo: 'Pago acreditado',
    detalle:
      'Mercado Pago confirmó el pago y tu orden ya figura como pagada. El '
      + 'vendedor la ve igual.',
  },
  en_revision: {
    titulo: 'Hay más de un pago para esta orden',
    detalle:
      'Mercado Pago registró más de un pago aprobado. Tu orden figura como '
      + 'pagada y la mercadería se descontó una sola vez; los pagos los tiene '
      + 'que revisar el vendedor antes de seguir.',
  },
  en_proceso: {
    titulo: 'Mercado Pago está procesando el pago',
    detalle:
      'Todavía no está acreditado. Cuando lo esté, tu orden va a figurar como '
      + 'pagada sin que tengas que hacer nada.',
  },
  rechazado: {
    titulo: 'El pago fue rechazado',
    detalle:
      'Mercado Pago no aprobó el intento. Tu orden sigue en pie: podés volver '
      + 'a intentar desde «Mis compras» mientras el link siga vigente.',
  },
  pendiente: {
    titulo: 'Todavía no hay un pago registrado',
    detalle:
      'Mercado Pago no informó ningún pago para esta orden. Si acabás de '
      + 'pagar, puede tardar unos minutos en aparecer.',
  },
  devuelto: {
    titulo: 'El pago fue devuelto',
    detalle: 'Mercado Pago informó una devolución de este pago.',
  },
  contracargo: {
    titulo: 'El pago tiene un contracargo',
    detalle: 'El dinero de este pago se retiró. Escribile al vendedor.',
  },
  cancelado: {
    titulo: 'El pago quedó cancelado',
    detalle: 'Esta orden ya no se puede pagar por Mercado Pago.',
  },
};

export function PaymentResultPage({ status, onGoToOrders, onGoHome }: PaymentResultProps) {
  const [numeroDeOrden] = useState(() =>
    new URLSearchParams(window.location.search).get('orden')
  );
  const [estado, setEstado] = useState<EstadoDePago | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [sinSesion, setSinSesion] = useState(false);
  const [falloLaConsulta, setFalloLaConsulta] = useState(false);
  const cancelado = useRef(false);

  const preguntar = useCallback(async () => {
    if (!numeroDeOrden) {
      setVerificando(false);
      return;
    }
    if (!tokenStorage.getAccessToken()) {
      // Sin sesión no se puede saber nada de una orden, y está bien que sea
      // así: en qué anda una compra no es información pública.
      setSinSesion(true);
      setVerificando(false);
      return;
    }

    for (let intento = 0; intento < INTENTOS && !cancelado.current; intento += 1) {
      try {
        const respuesta = await apiPost<EstadoDePago>(
          `/orders/${encodeURIComponent(numeroDeOrden)}/payment-state`,
          {}
        );
        if (cancelado.current) return;
        setEstado(respuesta);
        setFalloLaConsulta(!respuesta.verificado);
        // Un estado que ya no se va a mover solo: se deja de preguntar.
        if (respuesta.payment_state && respuesta.payment_state !== 'pendiente') {
          setVerificando(false);
          return;
        }
      } catch {
        if (cancelado.current) return;
        setFalloLaConsulta(true);
      }
      await new Promise((seguir) => { setTimeout(seguir, ESPERA_MS); });
    }
    if (!cancelado.current) setVerificando(false);
  }, [numeroDeOrden]);

  useEffect(() => {
    cancelado.current = false;
    void preguntar();
    return () => {
      cancelado.current = true;
    };
  }, [preguntar]);

  const conocido = estado?.payment_state
    ? TEXTO_DEL_ESTADO[estado.payment_state]
    : undefined;

  const titulo = verificando
    ? 'Estamos verificando tu pago'
    : conocido?.titulo ?? 'No pudimos confirmar el pago todavía';

  const detalle = verificando
    ? 'Le estamos preguntando a Mercado Pago. Volver de esa pantalla no '
      + 'confirma un pago: lo confirma Mercado Pago.'
    : conocido?.detalle
      ?? 'No conseguimos respuesta de Mercado Pago en este momento. Tu orden no '
         + 'cambió: miralá en «Mis compras» dentro de un rato.';

  const deDondeVolvio = {
    success: 'Volviste desde la pantalla de pago de Mercado Pago.',
    pending: 'Mercado Pago te devolvió con el pago en revisión.',
    failure: 'Mercado Pago te devolvió sin completar el pago.',
  }[status];

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{titulo}</h1>

        <p className={styles.message} aria-live="polite">{detalle}</p>

        {/*
          De dónde volvió la persona se dice, porque le sirve de contexto. Lo
          que no se hace es tomarlo por un resultado.
        */}
        <p className={styles.subMessage}>{deDondeVolvio}</p>

        {numeroDeOrden && (
          <div className={styles.orderInfo}>
            <p><strong>Orden:</strong> #{numeroDeOrden}</p>
            {estado && <p><strong>Estado de la orden:</strong> {estado.status}</p>}
          </div>
        )}

        {sinSesion && (
          <p className={styles.subMessage}>
            Iniciá sesión para ver en qué quedó esta orden.
          </p>
        )}

        {falloLaConsulta && !verificando && (
          <p className={styles.subMessage} role="alert">
            No pudimos confirmarlo con Mercado Pago recién. Lo que ves es lo
            último que sabemos.
          </p>
        )}

        {/*
          El botón dice a dónde lleva de verdad. «Mis compras» vive adentro
          del panel que se abre desde el nombre, arriba a la derecha, así que
          prometer que este botón la abre sería mentir en chiquito.
        */}
        <p className={styles.subMessage}>
          Podés ver esta orden en «Mis compras», dentro de tu panel: abrilo
          desde tu nombre, arriba a la derecha.
        </p>

        <div className={styles.actions}>
          <button className={styles.primaryButton} onClick={onGoToOrders}>
            Ir al marketplace
          </button>
          <button className={styles.secondaryButton} onClick={onGoHome}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
