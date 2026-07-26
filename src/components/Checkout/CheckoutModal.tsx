import React, { useState, useEffect } from 'react';
import styles from './CheckoutModal.module.css';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, apiFetch, apiGet, tokenStorage } from '../../utils/api';

interface CheckoutModalProps {
  onClose: () => void;
}

type CheckoutStep = 'shipping' | 'payment' | 'transfer' | 'confirmation' | 'processing';
type PaymentMethod = 'mercadopago' | 'bank_transfer';

interface OrderResponse {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
}

interface PaymentPreferenceResponse {
  preference_id: string;
  init_point: string;
  sandbox_init_point: string;
}

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
  const { items, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mercadopago');
  const [orderNumber, setOrderNumber] = useState('');
  const [, setOrderId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [returnedFromMP, setReturnedFromMP] = useState(false);
  const [transferOptions, setTransferOptions] = useState<BankTransferOption[]>([]);
  const [transferOrders, setTransferOrders] = useState<BankTransferOrder[]>([]);
  const [transferFiles, setTransferFiles] = useState<Record<string, File>>({});
  const [transferMessages, setTransferMessages] = useState<Record<string, string>>({});
  const [loadingTransferOptions, setLoadingTransferOptions] = useState(false);
  
  const [shippingData, setShippingData] = useState({
    fullName: user?.name || '',
    phone: '',
    province: '',
    city: '',
    address: '',
    postalCode: '',
    notes: '',
  });

  // Detectar cuando el usuario vuelve con el botón atrás del navegador
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // persisted = true significa que la página viene del bfcache (back/forward)
      if (event.persisted && currentStep === 'processing') {
        setReturnedFromMP(true);
      }
    };

    const handleVisibilityChange = () => {
      // Si la página se vuelve visible y estábamos en processing
      if (document.visibilityState === 'visible' && currentStep === 'processing') {
        // Pequeño delay para asegurar que es un regreso y no un cambio de pestaña
        setTimeout(() => {
          if (currentStep === 'processing') {
            setReturnedFromMP(true);
          }
        }, 1000);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentStep]);

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('payment');
  };

  const syncBackendCart = async () => {
    const cartItems = items.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity
    }));
    try {
      await apiFetch('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: cartItems })
      });
    } catch (syncError) {
      console.error('Error sincronizando carrito:', syncError);
      for (const item of items) {
        try {
          await apiFetch('/cart/items', {
            method: 'POST',
            body: JSON.stringify({ product_id: item.product.id, quantity: item.quantity })
          });
        } catch {
          await apiFetch(`/cart/items/${item.product.id}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity: item.quantity })
          });
        }
      }
    }
  };

  const selectBankTransfer = async () => {
    setPaymentMethod('bank_transfer');
    setError('');
    setLoadingTransferOptions(true);
    try {
      await syncBackendCart();
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
      await syncBackendCart();

      // 2. Crear la orden con los datos de envío
      const checkoutData = {
        shipping_address: `${shippingData.address}, ${shippingData.fullName}`,
        shipping_city: shippingData.city,
        shipping_province: shippingData.province,
        shipping_postal_code: shippingData.postalCode,
        notes: shippingData.notes || `Tel: ${shippingData.phone}`
      };

      if (paymentMethod === 'bank_transfer') {
        const response = await apiFetch<{ orders: BankTransferOrder[] }>('/orders/checkout/transfer', {
          method: 'POST',
          body: JSON.stringify(checkoutData)
        });
        setTransferOrders(response.orders);
        clearCart();
        setCurrentStep('transfer');
        return;
      }

      const orderResponse = await apiFetch<OrderResponse>('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutData)
      });

      setOrderNumber(orderResponse.order_number);
      setOrderId(orderResponse.id);

      // 3. Si es MercadoPago, crear preferencia y redirigir
      if (paymentMethod === 'mercadopago') {
        setCurrentStep('processing');

        try {
          const preferenceResponse = await apiFetch<PaymentPreferenceResponse>('/payments/create-preference', {
            method: 'POST',
            body: JSON.stringify({ order_id: orderResponse.id })
          });

          // Limpiar carrito antes de redirigir
          clearCart();

          // Redirigir al checkout de Mercado Pago
          // Usar init_point - funciona con tokens OAuth (APP_USR)
          window.location.href = preferenceResponse.init_point;
          return;
        } catch (mpErr) {
          // La integración de Mercado Pago se entrega desvinculada.
          // Si el backend responde 503 ("no está configurada"), mostramos
          // un banner explicativo en lugar de un error genérico.
          const msg = mpErr instanceof Error ? mpErr.message : String(mpErr);
          if (/no est[áa] configurada|mp_not_configured|503/i.test(msg)) {
            setError(
              'La integración de pago con Mercado Pago no está configurada. ' +
              'El nuevo equipo técnico debe completar las credenciales antes ' +
              'de habilitar los pagos online. Tu pedido quedó registrado como pendiente.'
            );
            setCurrentStep('payment');
            return;
          }
          throw mpErr;
        }
      }

      // 4. Para otros métodos de pago, mostrar confirmación
      clearCart();
      setCurrentStep('confirmation');

    } catch (err) {
      console.error('Error en checkout:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar el pedido');
      setCurrentStep('payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    clearCart();
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
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
          <label>Provincia *</label>
          <select
            required
            value={shippingData.province}
            onChange={(e) => setShippingData({ ...shippingData, province: e.target.value })}
          >
            <option value="">Seleccionar provincia</option>
            <option value="Buenos Aires">Buenos Aires</option>
            <option value="CABA">CABA</option>
            <option value="Catamarca">Catamarca</option>
            <option value="Chaco">Chaco</option>
            <option value="Chubut">Chubut</option>
            <option value="Córdoba">Córdoba</option>
            <option value="Corrientes">Corrientes</option>
            <option value="Entre Ríos">Entre Ríos</option>
            <option value="Formosa">Formosa</option>
            <option value="Jujuy">Jujuy</option>
            <option value="La Pampa">La Pampa</option>
            <option value="La Rioja">La Rioja</option>
            <option value="Mendoza">Mendoza</option>
            <option value="Misiones">Misiones</option>
            <option value="Neuquén">Neuquén</option>
            <option value="Río Negro">Río Negro</option>
            <option value="Salta">Salta</option>
            <option value="San Juan">San Juan</option>
            <option value="San Luis">San Luis</option>
            <option value="Santa Cruz">Santa Cruz</option>
            <option value="Santa Fe">Santa Fe</option>
            <option value="Santiago del Estero">Santiago del Estero</option>
            <option value="Tierra del Fuego">Tierra del Fuego</option>
            <option value="Tucumán">Tucumán</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Ciudad *</label>
          <input
            type="text"
            required
            value={shippingData.city}
            onChange={(e) => setShippingData({ ...shippingData, city: e.target.value })}
            placeholder="Rosario"
          />
        </div>

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
        <div className={styles.errorMessage}>
          ⚠️ {error}
        </div>
      )}

      <div className={styles.paymentMethods}>
        <label className={`${styles.paymentOption} ${paymentMethod === 'mercadopago' ? styles.paymentOptionActive : ''}`}>
          <input
            type="radio"
            name="payment"
            value="mercadopago"
            checked={paymentMethod === 'mercadopago'}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          />
          <div className={styles.paymentContent}>
            <div className={styles.paymentIcon}>💰</div>
            <div>
              <div className={styles.paymentTitle}>MercadoPago</div>
              <div className={styles.paymentDescription}>
                Paga de forma segura con tarjeta de crédito, débito o dinero en cuenta
              </div>
              <div className={styles.paymentBadge}>✓ Recomendado</div>
            </div>
          </div>
        </label>

        <label className={`${styles.paymentOption} ${paymentMethod === 'bank_transfer' ? styles.paymentOptionActive : ''}`}>
          <input
            type="radio"
            name="payment"
            value="bank_transfer"
            checked={paymentMethod === 'bank_transfer'}
            onChange={() => void selectBankTransfer()}
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

      {paymentMethod === 'bank_transfer' && (
        <div className={styles.confirmationInfo}>
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
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.backButton} onClick={() => setCurrentStep('shipping')} disabled={isLoading}>
          ← Volver
        </button>
        <button type="submit" className={styles.nextButton} disabled={isLoading}>
          {isLoading
            ? 'Procesando...'
            : paymentMethod === 'bank_transfer'
              ? 'Crear orden y adjuntar comprobante'
              : 'Pagar con MercadoPago'}
        </button>
      </div>
    </form>
  );

  const renderTransferStep = () => (
    <div className={styles.confirmation}>
      <h2>🏦 Transferencia bancaria</h2>
      <p>Adjuntá un comprobante por vendedor. La orden queda pendiente hasta su validación.</p>
      {transferOrders.map(order => (
        <div key={order.order_id} className={styles.infoCard}>
          <h3>{order.seller_name}</h3>
          <p>Orden: <strong>{order.order_number}</strong></p>
          {order.cbu && <p><strong>CBU:</strong> {order.cbu}</p>}
          {order.alias_bancario && <p><strong>Alias:</strong> {order.alias_bancario}</p>}
          <p><strong>Titular:</strong> {order.seller_name}</p>
          <p><strong>Monto:</strong> {formatPrice(order.amount)}</p>
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

  const renderConfirmation = () => {
    // Agrupar productos por vendedor
    const itemsBySeller = items.reduce((acc, item) => {
      const sellerName = item.product.seller.name;
      if (!acc[sellerName]) {
        acc[sellerName] = {
          seller: item.product.seller,
          items: [],
          total: 0,
        };
      }
      acc[sellerName].items.push(item);
      acc[sellerName].total += item.product.price * item.quantity;
      return acc;
    }, {} as Record<string, any>);

    return (
      <div className={styles.confirmation}>
        <div className={styles.successIcon}>✅</div>
        <h2>¡Pedido Confirmado!</h2>
        <p className={styles.orderNumber}>Número de Pedido: <strong>{orderNumber}</strong></p>

        <div className={styles.confirmationInfo}>
          <div className={styles.infoCard}>
            <h3>📦 Datos de Envío</h3>
            <p><strong>{shippingData.fullName}</strong></p>
            <p>📞 {shippingData.phone}</p>
            <p>📍 {shippingData.address}</p>
            <p>{shippingData.city}, {shippingData.province} - CP: {shippingData.postalCode}</p>
            {shippingData.notes && (
              <p className={styles.notes}>Nota: {shippingData.notes}</p>
            )}
          </div>

          <div className={styles.infoCard}>
            <h3>💳 Método de Pago</h3>
            <p>💰 MercadoPago</p>
          </div>
        </div>

        <div className={styles.sellerContacts}>
          <div className={styles.unlocked}>
            🔓 <strong>Información Desbloqueada</strong> - Los vendedores ya tienen tus datos
          </div>

          {Object.values(itemsBySeller).map((sellerGroup: any, index) => (
            <div key={index} className={styles.sellerContactCard}>
              <h3>Vendedor: {sellerGroup.seller.name}</h3>
              
              <div className={styles.sellerProducts}>
                <h4>Productos:</h4>
                {sellerGroup.items.map((item: any, idx: number) => (
                  <div key={idx} className={styles.productLine}>
                    <span>{item.product.name} x{item.quantity}</span>
                    <span>{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                ))}
                <div className={styles.sellerTotal}>
                  <strong>Subtotal: {formatPrice(sellerGroup.total)}</strong>
                </div>
              </div>

              <div className={styles.contactDetails}>
                <p><strong>Contacto:</strong></p>
                <p>📞 {sellerGroup.seller.phone || '+54 9 11 1234-5678'}</p>
                <p>📧 {sellerGroup.seller.email || 'contacto@vendedor.com'}</p>
                {sellerGroup.seller.whatsapp && (
                  <a 
                    href={`https://wa.me/${sellerGroup.seller.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.whatsappButton}
                  >
                    💬 Contactar por WhatsApp
                  </a>
                )}
              </div>

              <div className={styles.addressInfo}>
                <p><strong>Dirección:</strong></p>
                <p>📍 {sellerGroup.seller.address?.street || 'Calle Principal 123'}</p>
                <p>{sellerGroup.seller.address?.city || 'Rosario'}, {sellerGroup.seller.address?.province || 'Santa Fe'}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.totalSection}>
          <h3>Total del Pedido: {formatPrice(totalAmount)}</h3>
        </div>

        <div className={styles.nextSteps}>
          <h3>📋 Próximos Pasos:</h3>
          <ol>
            <li>Los vendedores revisarán tu pedido y lo confirmarán</li>
            <li>Recibirás un correo con los detalles de pago</li>
            <li>Una vez confirmado el pago, se coordinará el envío</li>
            <li>Podrás seguir el estado en "Mis Compras"</li>
          </ol>
        </div>

        <button className={styles.finishButton} onClick={handleFinish}>
          Ir a Mis Compras
        </button>
      </div>
    );
  };

  const renderOrderSummary = () => (
    <div className={styles.sidebar}>
      <h3>Resumen del Pedido</h3>
      
      <div className={styles.summaryItems}>
        {items.map((item) => (
          <div key={item.product.id} className={styles.summaryItem}>
            <div className={styles.summaryItemImage}>
              <img src={item.product.image} alt={item.product.name} />
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

  const renderProcessing = () => (
    <div className={styles.confirmation}>
      {returnedFromMP ? (
        <>
          <h2>⚠️ ¿No completaste el pago?</h2>
          <p>Parece que volviste sin finalizar el pago en MercadoPago.</p>
          <p className={styles.orderNumber}>Tu orden <strong>{orderNumber}</strong> sigue activa.</p>
          <p>Podés ver tus órdenes pendientes en tu panel de usuario.</p>
          <div className={styles.formActions}>
            <button 
              className={styles.nextButton}
              onClick={onClose}
            >
              Ver mis órdenes
            </button>
            <button 
              className={styles.backButton}
              onClick={() => {
                setReturnedFromMP(false);
                setCurrentStep('payment');
              }}
            >
              Volver al checkout
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.processingSpinner}>
            <div className={styles.spinner}></div>
          </div>
          <h2>Redirigiendo a MercadoPago...</h2>
          <p>Por favor espera mientras te redirigimos al sistema de pagos seguro.</p>
          <p className={styles.orderNumber}>Orden: <strong>{orderNumber}</strong></p>
          <p>Total: <strong>{formatPrice(totalAmount)}</strong></p>
        </>
      )}
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        <div className={styles.progressBar}>
          <div className={`${styles.progressStep} ${currentStep === 'shipping' ? styles.progressStepActive : currentStep === 'payment' || currentStep === 'confirmation' ? styles.progressStepComplete : ''}`}>
            <div className={styles.progressCircle}>1</div>
            <span>Envío</span>
          </div>
          <div className={styles.progressLine}></div>
          <div className={`${styles.progressStep} ${currentStep === 'payment' ? styles.progressStepActive : currentStep === 'confirmation' ? styles.progressStepComplete : ''}`}>
            <div className={styles.progressCircle}>2</div>
            <span>Pago</span>
          </div>
          <div className={styles.progressLine}></div>
          <div className={`${styles.progressStep} ${currentStep === 'confirmation' ? styles.progressStepActive : ''}`}>
            <div className={styles.progressCircle}>3</div>
            <span>Confirmación</span>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.main}>
            {currentStep === 'shipping' && renderShippingStep()}
            {currentStep === 'payment' && renderPaymentStep()}
            {currentStep === 'processing' && renderProcessing()}
            {currentStep === 'transfer' && renderTransferStep()}
            {currentStep === 'confirmation' && renderConfirmation()}
          </div>

          {currentStep !== 'confirmation' && currentStep !== 'processing' && currentStep !== 'transfer' && renderOrderSummary()}
        </div>
      </div>
    </div>
  );
};
