import React, { useState } from 'react';
import styles from './CheckoutModal.module.css';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, apiFetch, apiGet, tokenStorage } from '../../utils/api';
import { ProductImage } from '../ProductImage/ProductImage';

interface CheckoutModalProps {
  onClose: () => void;
}

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
  const { items, totalAmount, clearCart } = useCart();
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
    province: '',
    city: '',
    address: '',
    postalCode: '',
    notes: '',
  });

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('payment');
    void selectBankTransfer();
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
          <select id="checkout-provincia"
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
