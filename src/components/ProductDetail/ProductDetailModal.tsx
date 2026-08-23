import React, { useState } from 'react';
import { Product } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast/Toast';
import { formatPrice } from '../../utils/formatters';
import { SellerProfileModal } from '../SellerProfile/SellerProfileModal';
import styles from './ProductDetailModal.module.css';
import { ProductImage } from '../ProductImage/ProductImage';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showSellerProfile, setShowSellerProfile] = useState(false);
  const isService = product.isService || false;

  // Antes esto era `[product.image, product.image, product.image]`: tres
  // miniaturas de la MISMA foto, que al hacer clic no cambiaban nada. Una
  // galería que no lleva a ningún lado es una acción falsa.
  const images = [product.image].filter(Boolean);

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      showToast('Debes iniciar sesión para agregar productos al carrito', 'warning');
      return;
    }

    if (!isService && quantity > product.stock) {
      showToast(`Solo hay ${product.stock} unidades disponibles`, 'warning');
      return;
    }

    addItem(product, quantity);
    showToast(`${quantity} ${product.unit || 'unidad'}(s) de ${product.name} agregado al carrito`, 'success');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" />
          </svg>
        </button>

        <div className={styles.content}>
          {/* Galería de Imágenes */}
          <div className={styles.imageSection}>
            <div className={styles.mainImage}>
              <ProductImage
                src={images[selectedImage]}
                alt={product.name}
                categoria={product.category}
              />
            </div>
            {/* Las miniaturas aparecen cuando hay más de una foto que elegir.
                Antes eran tres, y las tres eran la misma imagen. */}
            {images.length > 1 && (
              <div className={styles.thumbnails}>
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Ver imagen ${idx + 1} de ${images.length}`}
                    aria-pressed={selectedImage === idx}
                    className={`${styles.thumbnail} ${selectedImage === idx ? styles.thumbnailActive : ''}`}
                    onClick={() => setSelectedImage(idx)}
                  >
                    <ProductImage src={img} alt="" categoria={product.category} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Información del Producto */}
          <div className={styles.infoSection}>
            <div className={styles.header}>
              <div className={styles.category}>
                {[product.category, product.subcategory].filter(Boolean).join(' · ')}
              </div>
              <h2 className={styles.title}>{product.name}</h2>
              <div className={styles.priceSection}>
                <span className={styles.price}>{formatPrice(product.price, product.currency)}</span>
                <span className={styles.unit}>por {product.unit}</span>
              </div>
            </div>

            {/* Información del Vendedor - SOLO NOMBRE Y CALIFICACIÓN */}
            <div className={styles.sellerInfo}>
              <h3>Vendido por</h3>
              <div 
                className={`${styles.sellerCard} ${styles.sellerClickable}`}
                onClick={() => setShowSellerProfile(true)}
              >
                <div className={styles.sellerAvatar}>
                  {product.seller.name.charAt(0)}
                </div>
                <div className={styles.sellerDetails}>
                  <div className={styles.sellerName}>
                    {product.seller.name}
                    <span className={styles.viewProfile}>Ver perfil</span>
                  </div>
                  {/* El texto es exactamente «Documentación revisada»: dice lo
                      que se hizo —alguien miró una constancia— y no promete
                      identidad comprobada ni ausencia de fraude. */}
                  {product.seller.documentacionRevisada && (
                    <div className={styles.sellerDocumentacion}>
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="none"
                           stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                           strokeLinejoin="round" aria-hidden="true" focusable="false">
                        <path d="M2.5 8.5 L6 12 L13.5 4" />
                      </svg>
                      Documentación revisada
                    </div>
                  )}
                  <div className={styles.sellerRating}>
                    {product.seller.ratingCount > 0 ? (
                      <>
                        <span className={styles.ratingNumber}>
                          {product.seller.rating.toFixed(1)} de 5
                        </span>
                        <span className={styles.salesCount}>
                          ({product.seller.ratingCount} {product.seller.ratingCount === 1 ? 'calificación' : 'calificaciones'})
                        </span>
                      </>
                    ) : (
                      <span className={styles.noRating}>Sin calificaciones aún</span>
                    )}
                  </div>
                  {product.seller.salesCount > 0 && (
                    <div className={styles.salesInfo}>
                      {product.seller.salesCount} {product.seller.salesCount === 1 ? 'venta' : 'ventas'}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.privacyNote}>
                Los datos de contacto se comparten al confirmar la compra
              </div>
            </div>

            {/* Ubicación */}
            <div className={styles.location}>
              <div>
                <div className={styles.locationTitle}>Ubicación</div>
                <div className={styles.locationText}>
                  {[product.location.province, product.location.city]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              </div>
            </div>

            {/* Stock - Solo para productos, no servicios */}
            {!isService && (
              <div className={styles.stock}>
                <span className={product.stock > 10 ? styles.stockAvailable : styles.stockLow}>
                  {product.stock > 0 ? `${product.stock} disponibles` : 'Sin stock'}
                </span>
              </div>
            )}
            {isService && (
              <div className={styles.serviceInfo}>
                <span className={styles.serviceBadge}>Servicio disponible</span>
              </div>
            )}

            {/* Descripción */}
            <div className={styles.description}>
              <h3>Descripción</h3>
              <p>{product.description}</p>
            </div>

            {/* Características */}
            {Object.keys(product.features).length > 0 && (
              <div className={styles.features}>
                <h3>Características</h3>
                <div className={styles.featuresList}>
                  {Object.entries(product.features).map(([key, value]) => (
                    <div key={key} className={styles.featureItem}>
                      <span className={styles.featureKey}>{key}:</span>
                      <span className={styles.featureValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Etiquetas */}
            {product.tags.length > 0 && (
              <div className={styles.tags}>
                {product.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Agregar al Carrito */}
            <div className={styles.actions}>
              <div className={styles.quantitySelector}>
                <button
                  aria-label="Quitar una unidad"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  aria-label="Cantidad"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    const maxVal = isService ? 999 : product.stock;
                    setQuantity(Math.min(maxVal, Math.max(1, val)));
                  }}
                  min="1"
                  max={isService ? 999 : product.stock}
                />
                <button
                  aria-label="Agregar una unidad"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={!isService && quantity >= product.stock}
                >
                  +
                </button>
              </div>
              <button
                className={styles.addToCartButton}
                onClick={handleAddToCart}
                disabled={!isService && product.stock === 0}
              >
                {isService ? 'Contratar Servicio' : (product.stock > 0 ? 'Agregar al Carrito' : 'Sin Stock')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Perfil del Vendedor */}
      {showSellerProfile && (
        <SellerProfileModal
          sellerId={product.seller.id}
          sellerName={product.seller.name}
          onClose={() => setShowSellerProfile(false)}
        />
      )}
    </div>
  );
};
