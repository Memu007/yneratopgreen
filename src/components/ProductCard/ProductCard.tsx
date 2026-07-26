import React, { useState } from 'react';
import styles from './ProductCard.module.css';
import { Product } from '../../types';
import { formatPrice, truncateText } from '../../utils/formatters';
import { useCart } from '../../contexts/CartContext';
import { ProductDetailModal } from '../ProductDetail/ProductDetailModal';
import { ProductImage } from '../ProductImage/ProductImage';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItem } = useCart();
  const [showDetail, setShowDetail] = useState(false);
  const isService = product.isService || false;
  const hasStock = isService || product.stock > 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasStock) {
      addItem(product, 1);
    }
  };

  return (
    <>
    <div className={styles.card} onClick={() => setShowDetail(true)}>
      <div className={styles.imageContainer}>
        <ProductImage
          src={product.image}
          alt={product.name}
          className={styles.image}
          loading="lazy"
        />
        {!isService && (
          <span className={`${styles.stockBadge} ${!hasStock ? styles.outOfStock : ''}`}>
            {hasStock ? `Stock: ${product.stock}` : 'Sin stock'}
          </span>
        )}
        {isService && (
          <span className={styles.serviceBadge}>Servicio</span>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.category}>
          {product.category} › {product.subcategory}
        </div>

        <h3 className={styles.title}>{product.name}</h3>

        <p className={styles.description}>
          {truncateText(product.description, 100)}
        </p>

        {product.tags && product.tags.length > 0 && (
          <div className={styles.features}>
            {product.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className={styles.featureTag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className={styles.priceSection}>
          <div>
            <div className={styles.price}>
              {formatPrice(product.price, product.currency)}
            </div>
            <div className={styles.unit}>
              por {product.unit}
            </div>
          </div>

          <button 
            className={`${styles.addToCartButton} ${!hasStock ? styles.disabled : ''}`}
            onClick={handleAddToCart}
            disabled={!hasStock}
          >
            {isService ? '📋 Consultar' : (hasStock ? '🛒 Agregar' : 'Sin stock')}
          </button>
        </div>

        <div className={styles.footer}>
          <div className={styles.seller}>
            <div className={styles.sellerName}>
              {product.seller.name}
            </div>
            <div className={styles.rating}>
              {product.seller.ratingCount > 0 ? (
                <>⭐ {product.seller.rating.toFixed(1)} <span className={styles.ratingCount}>({product.seller.ratingCount})</span></>
              ) : (
                <span className={styles.noRating}>Sin calificaciones</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {showDetail && (
      <ProductDetailModal 
        product={product} 
        onClose={() => setShowDetail(false)} 
      />
    )}
    </>
  );
};
