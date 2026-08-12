import React, { useEffect, useRef, useState } from 'react';
import styles from './CheckoutModal.module.css';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, apiFetch, apiGet, tokenStorage } from '../../utils/api';
import { ProductImage } from '../ProductImage/ProductImage';
import {
  getLocalities,
  getProvinces,
  LocalityResponse,
  ProvinceResponse,
} from '../../utils/catalogService';

interface CheckoutModalProps {
  onClose: () => void;
}

/** Transportistas que cubren el viaje, agrupados por futura orden. */
interface DistanciaOrigen {
  locality_id: string;
  name: string;
  province_name: string;
  distance_km: number;
}

interface TransportistaCompatible {
  id: string;
  full_name: string;
  base_locality_name: string;
  base_province_name: string;
  transport: string;
  certification_detail: string;
  certification_declared_at: string;
  coverage_radius_km: number;
  capacity?: string;
  distance_to_destination_km: number;
  distances_to_origins: DistanciaOrigen[];
}

interface GrupoDeFletes {
  seller_id: string;
  seller_name: string;
  origins: { id: string; name: string; province_name: string }[];
  origin_missing: boolean;
  carriers: TransportistaCompatible[];
}

interface FletesCompatibles {
  destination: { id: string; name: string; province_name: string };
  groups: GrupoDeFletes[];
}

/**
 * El transportista ya elegido, con el contacto que el listado no trae. Sólo
 * llega desde el servidor, después de que revalidó que cubre este grupo.
 */
interface TransportistaElegido extends TransportistaCompatible {
  email: string;
  phone?: string;
  whatsapp?: string;
}

interface RespuestaDeSeleccion {
  seller_id: string;
  seller_name: string;
  carrier: TransportistaElegido;
}

/**
 * Qué decidió el comprador para un pedido. Sin entrada en el mapa, no decidió
 * nada todavía: ese es el tercer estado y es el que no deja avanzar.
 */
type DecisionDeTraslado =
  | { modo: 'self' }
  | { modo: 'carrier'; elegido?: TransportistaElegido };

type CheckoutStep = 'shipping' | 'payment' | 'transfer';

interface BankTransferOption {
  seller_id: string;
  seller_name: string;
  cbu?: string;
  alias_bancario?: string;
  amount: number;
}

interface BankTransferOrder extends BankTransferOption {
  order_id: string;
  order_number: string;
  status: string;
  transfer_receipt_url?: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose }) => {
  const { items, totalAmount, clearCart, sincronizarConServidor } = useCart();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [transferOptions, setTransferOptions] = useState<BankTransferOption[]>([]);
  const [transferOrders, setTransferOrders] = useState<BankTransferOrder[]>([]);
  const [transferFiles, setTransferFiles] = useState<Record<string, File>>({});
  const [transferMessages, setTransferMessages] = useState<Record<string, string>>({});
  const [loadingTransferOptions, setLoadingTransferOptions] = useState(false);
  
  const [shippingData, setShippingData] = useState({
    fullName: user?.name || '',
    phone: '',
    provinceId: '',
    localityId: '',
    address: '',
    postalCode: '',
    notes: '',
  });

  // --- destino del padrón y fletes compatibles ------------------------------
  const [provincias, setProvincias] = useState<ProvinceResponse[]>([]);
  const [localidades, setLocalidades] = useState<LocalityResponse[]>([]);
  const [padronError, setPadronError] = useState('');
  const [fletes, setFletes] = useState<FletesCompatibles | null>(null);
  const [fletesCargando, setFletesCargando] = useState(false);
  const [fletesError, setFletesError] = useState('');
  // Una decisión por pedido. Se vacía entero cuando cambia el destino o el
  // carrito: lo que se eligió para otro viaje no vale para éste, y el contacto
  // que se había revelado deja de mostrarse.
  const [decisiones, setDecisiones] = useState<Record<string, DecisionDeTraslado>>({});
  const [seleccionando, setSeleccionando] = useState('');
  const [erroresDeSeleccion, setErroresDeSeleccion] = useState<Record<string, string>>({});
  // Cada consulta de fletes lleva número, y el número cubre la sincronización
  // y la búsqueda: una respuesta tardía de un destino o de un carrito
  // anteriores no puede pisar el resultado vigente.
  const consultaDeFletes = useRef(0);
  // Retrato exacto del carrito visible. Si cambia mientras el checkout está
  // abierto, lo de antes deja de valer y hay que volver a sincronizar.
  const retratoDelCarrito = items
    .map((item) => `${item.product.id}x${item.quantity}`)
    .sort()
    .join('|');
  useEffect(() => {
    void getProvinces()
      .then(setProvincias)
      .catch(() => setPadronError('No se pudo cargar el padrón de provincias.'));
  }, []);

  useEffect(() => {
    if (!shippingData.provinceId) {
      setLocalidades([]);
      return;
    }
    let vigente = true;
    void getLocalities(shippingData.provinceId)
      .then((data) => {
        if (!vigente) return;
        setLocalidades(data);
        setPadronError('');
      })
      .catch(() => {
        if (vigente) setPadronError('No se pudieron cargar las localidades.');
      });
    return () => {
      vigente = false;
    };
  }, [shippingData.provinceId]);

  useEffect(() => {
    const destino = shippingData.localityId;
    // El número se incrementa SIEMPRE, incluso cuando no hay destino: cambiar
    // de provincia vacía la localidad, y una respuesta en vuelo de la anterior
    // seguiría pasando por vigente si la generación no se hubiera movido.
    const consulta = consultaDeFletes.current + 1;
    consultaDeFletes.current = consulta;
    const vigente = () => consultaDeFletes.current === consulta;

    // Cambiar de destino, o de carrito, invalida el listado anterior en el
    // acto: mostrar fletes de otro viaje sería peor que no mostrar ninguno.
    setFletes(null);
    setFletesError('');
    if (!destino) {
      setFletesCargando(false);
      return;
    }

    setFletesCargando(true);

    void (async () => {
      try {
        // El carrito que ve la persona vive en el navegador y el servidor
        // arma los grupos con el suyo. Sin sincronizar primero, el listado
        // podría describir un carrito que ya no existe —o uno vacío—.
        await sincronizarConServidor();
        if (!vigente()) return;

        const data = await apiGet<FletesCompatibles>(
          `/logistics/compatible-carriers?destination_locality_id=${encodeURIComponent(destino)}`,
        );
        if (!vigente()) return;
        setFletes(data);
      } catch (err) {
        if (!vigente()) return;
        // Si la sincronización falla, no se consulta compatibilidad y se
        // muestra el motivo real, no un listado que no representa nada.
        setFletesError(err instanceof Error ? err.message : 'No se pudieron buscar fletes');
      } finally {
        if (vigente()) setFletesCargando(false);
      }
    })();
  }, [shippingData.localityId, retratoDelCarrito, sincronizarConServidor]);

  // Cambiar destino, productos, cantidades o vendedor invalida lo decidido.
  // No se conserva "lo que ya había elegido" para el viaje nuevo: sería
  // afirmar una compatibilidad que nadie comprobó, y dejar a la vista un
  // contacto que se reveló para otra cosa.
  useEffect(() => {
    setDecisiones({});
    setErroresDeSeleccion({});
    setSeleccionando('');
  }, [shippingData.localityId, retratoDelCarrito]);

  const decidir = (vendedor: string, decision: DecisionDeTraslado) => {
    setErroresDeSeleccion((actuales) => ({ ...actuales, [vendedor]: '' }));
    setDecisiones((actuales) => ({ ...actuales, [vendedor]: decision }));
  };

  const elegirTransportista = async (vendedor: string, transportista: string) => {
    // La misma generación que la búsqueda: si mientras se confirmaba cambió el
    // destino o el carrito, esta respuesta llega tarde y no puede devolver una
    // selección —ni un contacto— que ya se invalidó.
    const consulta = consultaDeFletes.current;
    setSeleccionando(`${vendedor}:${transportista}`);
    setErroresDeSeleccion((actuales) => ({ ...actuales, [vendedor]: '' }));
    try {
      const respuesta = await apiFetch<RespuestaDeSeleccion>('/logistics/select-carrier', {
        method: 'POST',
        body: JSON.stringify({
          destination_locality_id: shippingData.localityId,
          seller_id: vendedor,
          carrier_id: transportista,
        }),
      });
      if (consultaDeFletes.current !== consulta) return;
      setDecisiones((actuales) => ({
        ...actuales,
        [vendedor]: { modo: 'carrier', elegido: respuesta.carrier },
      }));
    } catch (err) {
      if (consultaDeFletes.current !== consulta) return;
      setErroresDeSeleccion((actuales) => ({
        ...actuales,
        [vendedor]: err instanceof Error ? err.message : 'No se pudo elegir el transportista',
      }));
    } finally {
      if (consultaDeFletes.current === consulta) setSeleccionando('');
    }
  };

  const decisionResuelta = (vendedor: string) => {
    const decision = decisiones[vendedor];
    if (!decision) return false;
    return decision.modo === 'self' || Boolean(decision.elegido);
  };

  // Ningún pedido puede quedar en "necesito flete pero no elegí": eso no es
  // una decisión, es la mitad de una.
  const pedidosSinResolver = (fletes?.groups ?? []).filter(
    (grupo) => !decisionResuelta(grupo.seller_id),
  );
  const trasladoResuelto = Boolean(fletes) && pedidosSinResolver.length === 0;

  // Un pedido sin decidir NO se manda como cuenta propia: se omite, y el
  // servidor lo rechaza por nombre. Suponer una decisión que nadie tomó sería
  // peor que fallar, sobre todo si el carrito cambió después del paso de envío.
  const decisionesParaElServidor = () => (fletes?.groups ?? []).flatMap((grupo) => {
    const decision = decisiones[grupo.seller_id];
    if (!decision) return [];
    return [{
      seller_id: grupo.seller_id,
      mode: decision.modo,
      carrier_id: decision.modo === 'carrier' ? decision.elegido?.id : undefined,
    }];
  });

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trasladoResuelto) {
      setError(
        fletes
          ? `Falta decidir cómo se traslada ${pedidosSinResolver.length === 1
              ? 'un pedido'
              : `${pedidosSinResolver.length} pedidos`}.`
          : 'Elegí el destino para poder resolver el traslado.',
      );
      return;
    }
    setError('');
    setCurrentStep('payment');
    void selectBankTransfer();
  };

  const selectBankTransfer = async () => {
    setError('');
    setLoadingTransferOptions(true);
    try {
      // Por la misma cola que la búsqueda de fletes: si una sincronización
      // anterior sigue en vuelo, ésta no puede adelantarla y terminar
      // escribiendo última sobre el carrito del servidor.
      await sincronizarConServidor();
      setTransferOptions(await apiGet<BankTransferOption[]>('/orders/transfer-options'));
    } catch (err) {
      setTransferOptions([]);
      setError(err instanceof Error ? err.message : 'No se pudo ofrecer transferencia');
    } finally {
      setLoadingTransferOptions(false);
    }
  };

  const uploadTransferReceipt = async (orderId: string) => {
    const file = transferFiles[orderId];
    if (!file) {
      setTransferMessages(current => ({ ...current, [orderId]: 'Seleccioná un comprobante' }));
      return;
    }
    const body = new FormData();
    body.append('file', file);
    const token = tokenStorage.getAccessToken();
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/transfer-receipt`, {
        method: 'POST',
        body,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
      setTransferOrders(current => current.map(order =>
        order.order_id === orderId ? { ...order, ...data } : order
      ));
      setTransferMessages(current => ({ ...current, [orderId]: 'Comprobante enviado' }));
    } catch (err) {
      setTransferMessages(current => ({
        ...current,
        [orderId]: err instanceof Error ? err.message : 'No se pudo subir el comprobante',
      }));
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await sincronizarConServidor();

      // 2. Crear la orden con los datos de envío
      const checkoutData = {
        shipping_address: `${shippingData.address}, ${shippingData.fullName}`,
        // La ciudad y la provincia las deriva el backend del padrón: no se
        // mandan como texto porque no son dato del cliente.
        shipping_locality_id: shippingData.localityId,
        shipping_postal_code: shippingData.postalCode,
        // Una decisión por pedido. El servidor vuelve a derivar los grupos y a
        // revalidar cada transportista: esto es lo que el comprador dijo, no
        // una verdad.
        shipping_decisions: decisionesParaElServidor(),
        notes: shippingData.notes || `Tel: ${shippingData.phone}`
      };

      const response = await apiFetch<{ orders: BankTransferOrder[] }>('/orders/checkout/transfer', {
        method: 'POST',
        body: JSON.stringify(checkoutData)
      });
      setTransferOrders(response.orders);
      clearCart();
      setCurrentStep('transfer');

    } catch (err) {
      console.error('Error en checkout:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar el pedido');
      setCurrentStep('payment');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const fechaDeDeclaracion = (iso: string) => {
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime())
      ? iso
      : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  /** Una tarjeta del directorio: quién cubre el viaje, sin contacto. */
  const tarjetaDeCandidato = (
    grupo: GrupoDeFletes,
    carrier: TransportistaCompatible,
  ) => (
    <li key={carrier.id} className={styles.fleteTarjeta}>
      <p className={styles.fleteNombre}>{carrier.full_name}</p>
      <p className={styles.fleteDato}>
        Base: {carrier.base_locality_name}, {carrier.base_province_name}
        {' · '}radio declarado {carrier.coverage_radius_km} km
      </p>
      <p className={styles.fleteDato}>{carrier.transport}</p>
      {carrier.capacity && (
        <p className={styles.fleteDato}>Capacidad: {carrier.capacity}</p>
      )}
      <p className={styles.fleteDato}>
        A {carrier.distance_to_destination_km} km del destino
        {carrier.distances_to_origins.map((d) => (
          <span key={d.locality_id}> · a {d.distance_km} km de {d.name}</span>
        ))}
      </p>
      <p className={styles.fleteDeclaracion}>
        Declara: {carrier.certification_detail}
        {' ('}declarado el {fechaDeDeclaracion(carrier.certification_declared_at)}
        {'). '}
        TopGreen no verifica esta habilitación.
      </p>
      <p className={styles.fleteSinContacto}>
        Los datos de contacto aparecen cuando lo seleccionás.
      </p>
      <button
        type="button"
        className={styles.fleteElegir}
        disabled={seleccionando !== ''}
        onClick={() => void elegirTransportista(grupo.seller_id, carrier.id)}
      >
        {seleccionando === `${grupo.seller_id}:${carrier.id}`
          ? 'Seleccionando…'
          : `Seleccionar a ${carrier.full_name}`}
      </button>
    </li>
  );

  /** El transportista ya elegido para un pedido, con su contacto. */
  const bloqueDelElegido = (grupo: GrupoDeFletes, elegido: TransportistaElegido) => (
    <div className={styles.fleteElegido}>
      <p className={styles.fleteEtiqueta}>Transportista elegido</p>
      <p className={styles.fleteNombre}>{elegido.full_name}</p>
      <p className={styles.fleteDato}>
        Base: {elegido.base_locality_name}, {elegido.base_province_name}
        {' · '}{elegido.transport}
      </p>
      {elegido.capacity && (
        <p className={styles.fleteDato}>Capacidad: {elegido.capacity}</p>
      )}
      <p className={styles.fleteContacto}>
        {elegido.email}
        {elegido.phone && ` · ${elegido.phone}`}
        {elegido.whatsapp && elegido.whatsapp !== elegido.phone
          && ` · WhatsApp ${elegido.whatsapp}`}
      </p>
      <p className={styles.fleteDeclaracion}>
        Declara: {elegido.certification_detail}
        {' ('}declarado el {fechaDeDeclaracion(elegido.certification_declared_at)}
        {'). '}
        TopGreen no verifica esta habilitación.
      </p>
      <p className={styles.fleteNota}>
        La coordinación y el precio del flete se acuerdan directamente.
      </p>
      <div className={styles.fleteAcciones}>
        <button
          type="button"
          className={styles.fleteQuitar}
          onClick={() => decidir(grupo.seller_id, { modo: 'carrier' })}
        >
          Quitar del pedido
        </button>
      </div>
    </div>
  );

  /**
   * El traslado, pedido por pedido. Cada futura orden se resuelve con una de
   * dos decisiones y no hay tercera: transportista elegido, o el comprador
   * coordina. Antes de elegir no se muestra ningún dato de contacto.
   */
  const renderFletes = () => {
    if (!shippingData.localityId) return null;

    return (
      <section className={styles.fletes} aria-live="polite">
        <h3 className={styles.fletesTitulo}>Cómo se traslada cada pedido</h3>

        {fletesCargando && <p className={styles.fleteAviso}>Buscando transportistas…</p>}

        {fletesError && (
          <p className={styles.fleteAviso} role="alert">⚠️ {fletesError}</p>
        )}

        {!fletesCargando && !fletesError && fletes?.groups.map((grupo) => {
          const decision = decisiones[grupo.seller_id];
          const puedeLlevarFlete = !grupo.origin_missing;
          const grupoId = `traslado-${grupo.seller_id}`;
          return (
            <div key={grupo.seller_id} className={styles.fleteGrupo}>
              <h4 className={styles.fleteGrupoTitulo}>
                Envío de {grupo.seller_name}
                {grupo.origins.length > 0 && (
                  <span className={styles.fleteOrigenes}>
                    {' '}desde {grupo.origins.map((o) => `${o.name}, ${o.province_name}`).join(' y ')}
                  </span>
                )}
              </h4>

              {grupo.origin_missing && (
                <p className={styles.fleteAviso}>
                  Este vendedor todavía no cargó la localidad oficial de alguna de sus
                  publicaciones, así que no podemos calcular qué transportistas cubren el
                  viaje. Sólo podés seguir coordinando el traslado por tu cuenta.
                </p>
              )}

              <div className={styles.fleteOpciones} role="radiogroup" aria-label={`Traslado del envío de ${grupo.seller_name}`}>
                {puedeLlevarFlete && (
                  <label className={styles.fleteOpcion}>
                    <input
                      type="radio"
                      name={grupoId}
                      checked={decision?.modo === 'carrier'}
                      onChange={() => decidir(grupo.seller_id, { modo: 'carrier' })}
                    />
                    <span>
                      <strong>Necesito flete</strong>
                      <span className={styles.fleteOpcionAyuda}>
                        Elegís un transportista que cubre este tramo.
                      </span>
                    </span>
                  </label>
                )}
                <label className={styles.fleteOpcion}>
                  <input
                    type="radio"
                    name={grupoId}
                    checked={decision?.modo === 'self'}
                    onChange={() => decidir(grupo.seller_id, { modo: 'self' })}
                  />
                  <span>
                    <strong>Coordino el traslado por mi cuenta</strong>
                    <span className={styles.fleteOpcionAyuda}>
                      Seguís al pago sin elegir transportista.
                    </span>
                  </span>
                </label>
              </div>

              {erroresDeSeleccion[grupo.seller_id] && (
                <p className={styles.fleteAviso} role="alert">
                  ⚠️ {erroresDeSeleccion[grupo.seller_id]}
                </p>
              )}

              {decision?.modo === 'carrier' && decision.elegido
                && bloqueDelElegido(grupo, decision.elegido)}

              {decision?.modo === 'carrier' && !decision.elegido && (
                grupo.carriers.length === 0 ? (
                  <p className={styles.fleteAviso}>
                    Ningún transportista declara cubrir este destino y este origen.
                    Probá con otro destino, o coordiná el traslado por tu cuenta.
                  </p>
                ) : (
                  <ul className={styles.fleteLista}>
                    {grupo.carriers.map((carrier) => tarjetaDeCandidato(grupo, carrier))}
                  </ul>
                )
              )}

              {!decision && (
                <p className={styles.fletePendiente}>
                  Todavía no dijiste cómo se traslada este pedido.
                </p>
              )}
            </div>
          );
        })}

        <p className={styles.fleteNota}>
          Distancias estimadas en línea recta.
        </p>
      </section>
    );
  };

  const renderShippingStep = () => (
    <form onSubmit={handleShippingSubmit} className={styles.form}>
      <div className={styles.stepHeader}>
        <h2>📦 Datos de Envío</h2>
        <p>Completa tus datos para recibir el pedido</p>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>Nombre Completo *</label>
          <input
            type="text"
            required
            value={shippingData.fullName}
            onChange={(e) => setShippingData({ ...shippingData, fullName: e.target.value })}
            placeholder="Juan Pérez"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Teléfono *</label>
          <input
            type="tel"
            required
            value={shippingData.phone}
            onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
            placeholder="+54 9 11 1234-5678"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="checkout-provincia">Provincia *</label>
          <select
            id="checkout-provincia"
            required
            value={shippingData.provinceId}
            onChange={(e) => setShippingData({
              ...shippingData,
              provinceId: e.target.value,
              localityId: '',
            })}
          >
            <option value="">Seleccionar provincia</option>
            {provincias.map((provincia) => (
              <option key={provincia.id} value={provincia.id}>{provincia.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="checkout-localidad">Localidad *</label>
          <select
            id="checkout-localidad"
            required
            value={shippingData.localityId}
            onChange={(e) => setShippingData({ ...shippingData, localityId: e.target.value })}
            disabled={!shippingData.provinceId}
          >
            <option value="">Seleccionar localidad</option>
            {localidades.map((localidad) => (
              <option key={localidad.id} value={localidad.id}>{localidad.name}</option>
            ))}
          </select>
        </div>

        {padronError && (
          <div className={styles.formGroupFull}>
            <p className={styles.fleteAviso} role="alert">{padronError}</p>
          </div>
        )}

        <div className={styles.formGroupFull}>
          <label>Dirección Completa *</label>
          <input
            type="text"
            required
            value={shippingData.address}
            onChange={(e) => setShippingData({ ...shippingData, address: e.target.value })}
            placeholder="Av. San Martín 1234, Piso 5, Depto B"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Código Postal *</label>
          <input
            type="text"
            required
            value={shippingData.postalCode}
            onChange={(e) => setShippingData({ ...shippingData, postalCode: e.target.value })}
            placeholder="2000"
          />
        </div>

        <div className={styles.formGroupFull}>
          <label>Notas Adicionales (Opcional)</label>
          <textarea
            value={shippingData.notes}
            onChange={(e) => setShippingData({ ...shippingData, notes: e.target.value })}
            placeholder="Ej: Tocar timbre dos veces, entregar en horario de mañana, etc."
            rows={3}
          />
        </div>
      </div>

      {renderFletes()}

      <button type="submit" className={styles.nextButton}>
        Continuar al Pago →
      </button>
    </form>
  );

  const renderPaymentStep = () => (
    <form onSubmit={handlePaymentSubmit} className={styles.form}>
      <div className={styles.stepHeader}>
        <h2>💳 Método de Pago</h2>
        <p>Selecciona cómo deseas pagar tu pedido</p>
      </div>

      {error && (
        <div className={styles.errorMessage} role="alert">
          ⚠️ {error}
        </div>
      )}

      <div className={styles.paymentMethods}>
        <label className={`${styles.paymentOption} ${styles.paymentOptionActive}`}>
          <input
            type="radio"
            name="payment"
            value="bank_transfer"
            checked
            readOnly
          />
          <div className={styles.paymentContent}>
            <div className={styles.paymentIcon}>🏦</div>
            <div>
              <div className={styles.paymentTitle}>Transferencia bancaria</div>
              <div className={styles.paymentDescription}>
                Transferí directamente al vendedor y adjuntá el comprobante
              </div>
            </div>
          </div>
        </label>
      </div>

      <div className={styles.confirmationInfo}>
        <p>
          El pago es una transferencia directa a la cuenta del vendedor.
          TopGreen no recibe ni retiene el dinero.
        </p>
        {loadingTransferOptions ? (
          <p>Cargando datos bancarios...</p>
        ) : transferOptions.map(option => (
          <div key={option.seller_id} className={styles.infoCard}>
            <h3>{option.seller_name}</h3>
            {option.cbu && <p><strong>CBU:</strong> {option.cbu}</p>}
            {option.alias_bancario && <p><strong>Alias:</strong> {option.alias_bancario}</p>}
            <p><strong>Monto:</strong> {formatPrice(option.amount)}</p>
          </div>
        ))}
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.backButton} onClick={() => setCurrentStep('shipping')} disabled={isLoading}>
          ← Volver
        </button>
        <button type="submit" className={styles.nextButton} disabled={isLoading}>
          {isLoading ? 'Procesando...' : 'Crear orden y adjuntar comprobante'}
        </button>
      </div>
    </form>
  );

  const renderTransferStep = () => (
    <div className={styles.confirmation}>
      <h2>🏦 Transferencia bancaria</h2>
      <p>Adjuntá un comprobante por vendedor. La orden queda pendiente hasta su validación.</p>
      <p>
        El pago es una transferencia directa a la cuenta del vendedor.
        TopGreen no recibe ni retiene el dinero.
      </p>
      {transferOrders.map(order => (
        <div key={order.order_id} className={styles.infoCard}>
          <h3>{order.seller_name}</h3>
          <p><strong>Referencia de pago:</strong> {order.order_number}</p>
          {order.cbu && <p><strong>CBU:</strong> {order.cbu}</p>}
          {order.alias_bancario && <p><strong>Alias:</strong> {order.alias_bancario}</p>}
          <p><strong>Titular:</strong> {order.seller_name}</p>
          <p><strong>Monto:</strong> {formatPrice(order.amount)}</p>
          <p>
            Usá <strong>{order.order_number}</strong> como concepto de la
            transferencia. Es lo que le permite al vendedor reconocer tu pago
            en su resumen bancario.
          </p>
          {order.status === 'transfer_receipt_submitted' ? (
            <p>✅ Comprobante enviado. Esperando validación del vendedor.</p>
          ) : (
            <>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setTransferFiles(current => ({ ...current, [order.order_id]: file }));
                }}
              />
              <button
                type="button"
                className={styles.nextButton}
                onClick={() => void uploadTransferReceipt(order.order_id)}
              >
                Adjuntar comprobante
              </button>
            </>
          )}
          {transferMessages[order.order_id] && <p>{transferMessages[order.order_id]}</p>}
        </div>
      ))}
      <button type="button" className={styles.finishButton} onClick={onClose}>
        Finalizar
      </button>
    </div>
  );

  const renderOrderSummary = () => (
    <div className={styles.sidebar}>
      <h3>Resumen del Pedido</h3>
      
      <div className={styles.summaryItems}>
        {items.map((item) => (
          <div key={item.product.id} className={styles.summaryItem}>
            <div className={styles.summaryItemImage}>
              <ProductImage src={item.product.image} alt={item.product.name} />
            </div>
            <div className={styles.summaryItemInfo}>
              <div className={styles.summaryItemName}>{item.product.name}</div>
              <div className={styles.summaryItemQuantity}>Cantidad: {item.quantity}</div>
              <div className={styles.summaryItemPrice}>{formatPrice(item.product.price * item.quantity)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.summaryTotal}>
        <div className={styles.summaryRow}>
          <span>Subtotal:</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>Envío:</span>
          <span className={styles.free}>A coordinar con el vendedor</span>
        </div>
        <div className={styles.summaryRowTotal}>
          <strong>Total:</strong>
          <strong>{formatPrice(totalAmount)}</strong>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>
          ×
        </button>

        <div className={styles.progressBar}>
          <div className={`${styles.progressStep} ${currentStep === 'shipping' ? styles.progressStepActive : styles.progressStepComplete}`}>
            <div className={styles.progressCircle}>1</div>
            <span>Envío</span>
          </div>
          <div className={styles.progressLine}></div>
          <div className={`${styles.progressStep} ${currentStep === 'payment' ? styles.progressStepActive : currentStep === 'transfer' ? styles.progressStepComplete : ''}`}>
            <div className={styles.progressCircle}>2</div>
            <span>Pago</span>
          </div>
          <div className={styles.progressLine}></div>
          <div className={`${styles.progressStep} ${currentStep === 'transfer' ? styles.progressStepActive : ''}`}>
            <div className={styles.progressCircle}>3</div>
            <span>Comprobante</span>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.main}>
            {currentStep === 'shipping' && renderShippingStep()}
            {currentStep === 'payment' && renderPaymentStep()}
            {currentStep === 'transfer' && renderTransferStep()}
          </div>

          {currentStep !== 'transfer' && renderOrderSummary()}
        </div>
      </div>
    </div>
  );
};
