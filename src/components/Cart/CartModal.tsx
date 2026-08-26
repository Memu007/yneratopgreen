import React from 'react';
import styles from './CartModal.module.css';
import { ProductImage } from '../ProductImage/ProductImage';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatPrice } from '../../utils/formatters';
import { useCapaModal } from '../../hooks/useCapaModal';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose, onCheckout }) => {
  // Antes de cualquier `return` temprano: un hook se llama siempre y en
  // el mismo orden. El interruptor es el que decide si hace algo.
  const capa = useCapaModal<HTMLDivElement>(onClose, isOpen);

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
      <div className={styles.modal}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-label="Mi carrito"
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Mi carrito ({itemCount})
          </h2>
          <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.cartContent}>
          {items.length === 0 ? (
            <div className={styles.emptyCart}>
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
                        aria-label={`Quitar ${item.product.name} del carrito`}
                      >
                        Quitar
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
  /** La cabecera lo dibuja como una celda de su banda; el resto del producto
      lo usaría con su apariencia propia. */
  className?: string;
}

export const CartButton: React.FC<CartButtonProps> = ({ onClick, className }) => {
  const { itemCount } = useCart();

  return (
    // La cantidad va adentro del nombre y no en un disco flotante: el disco
    // era rojo —el color del error— para decir «tenés dos cosas», y sobre la
    // banda de marca quedaba pegado al borde de la celda de al lado.
    <button
      className={className || `tg-button tg-button--secondary ${styles.cartButton}`}
      onClick={onClick}
    >
      <span>Carrito</span>
      {itemCount > 0 && <span className={styles.cuenta}>({itemCount})</span>}
    </button>
  );
};
