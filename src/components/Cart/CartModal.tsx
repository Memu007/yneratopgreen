import React from 'react';
import styles from './CartModal.module.css';
import { ProductImage } from '../ProductImage/ProductImage';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast/Toast';
import { formatPrice } from '../../utils/formatters';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose, onCheckout }) => {
  const { items, itemCount, totalAmount, updateQuantity, removeItem, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { showToast, showConfirm } = useToast();

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      showToast('Debes iniciar sesión para continuar con la compra', 'warning');
      return;
    }
    onCheckout();
  };

  const handleClearCart = async () => {
    const confirmed = await showConfirm({
      title: 'Vaciar carrito',
      message: '¿Estás seguro de que quieres vaciar el carrito?',
      confirmText: 'Sí, vaciar',
      cancelText: 'Cancelar',
      type: 'warning'
    });
    if (confirmed) {
      clearCart();
      showToast('Carrito vaciado', 'success');
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            🛒 Mi Carrito ({itemCount})
          </h2>
          <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.cartContent}>
          {items.length === 0 ? (
            <div className={styles.emptyCart}>
              <div className={styles.emptyIcon}>🛒</div>
              <p className={styles.emptyText}>Tu carrito está vacío</p>
              <p className={styles.emptySubtext}>
                Agrega productos para comenzar tu compra
              </p>
            </div>
          ) : (
            <div className={styles.cartItems}>
              {items.map((item) => (
                <div key={item.product.id} className={styles.cartItem}>
                  <ProductImage
                    src={item.product.image}
                    alt={item.product.name}
                    className={styles.itemImage}
                  />

                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemName}>{item.product.name}</h3>

                    <div className={styles.itemPrice}>
                      {formatPrice(item.product.price, item.product.currency)}
                      <span className={styles.itemUnit}> / {item.product.unit}</span>
                    </div>

                    <div className={styles.quantityControls}>
                      <button
                        className={styles.quantityButton}
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className={styles.quantityValue}>{item.quantity}</span>
                      <button
                        className={styles.quantityButton}
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        className={styles.removeButton}
                        onClick={() => removeItem(item.product.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className={styles.itemSubtotal}>
                      <span className={styles.subtotalLabel}>Subtotal:</span>
                      <span className={styles.subtotalValue}>
                        {formatPrice(item.product.price * item.quantity, item.product.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className={styles.cartFooter}>
            <div className={styles.totalSection}>
              <span className={styles.totalLabel}>Total:</span>
              <span className={styles.totalValue}>
                {formatPrice(totalAmount, 'ARS')}
              </span>
            </div>

            <div className={styles.footerButtons}>
              <button className={styles.clearButton} onClick={handleClearCart}>
                Vaciar carrito
              </button>
              <button className={styles.checkoutButton} onClick={handleCheckout}>
                Continuar compra
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Botón del carrito para el header
interface CartButtonProps {
  onClick: () => void;
}

export const CartButton: React.FC<CartButtonProps> = ({ onClick }) => {
  const { itemCount } = useCart();

  return (
    <button className={styles.cartButton} onClick={onClick}>
      <span className={styles.cartIcon}>🛒</span>
      <span>Carrito</span>
      {itemCount > 0 && <span className={styles.badge}>{itemCount}</span>}
    </button>
  );
};
