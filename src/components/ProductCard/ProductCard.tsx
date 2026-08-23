import React, { useState } from 'react';
import styles from './ProductCard.module.css';
import { Product } from '../../types';
import { formatPrice } from '../../utils/formatters';
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

  // Es la ubicación declarada por el VENDEDOR, no el origen de la
  // publicación: ese vive en la base como localidad y no sale en la
  // respuesta pública. Se muestra en el orden en que viene, sin reordenar:
  // el texto es libre y adivinar cuál parte es provincia inventaba
  // «Argentina, Buenos Aires».
  const ubicacion = [product.location?.province, product.location?.city]
    .filter(Boolean)
    .join(', ');

  return (
    <>
    <div className={styles.card} onClick={() => setShowDetail(true)}>
      <div className={styles.imageContainer}>
        <ProductImage
          src={product.image}
          alt={product.name}
          categoria={product.category}
          className={styles.image}
          loading="lazy"
        />
        {!isService && !hasStock && (
          <span className={styles.sinStock}>Sin stock</span>
        )}
        {isService && <span className={styles.servicio}>Servicio</span>}
      </div>

      <div className={styles.content}>
        {/* La categoría es contexto y va arriba, chica. Antes se imprimía
            «categoría › subcategoría» aunque no hubiera subcategoría, y quedaba
            un separador colgado al final de la línea. */}
        <div className={styles.category}>
          {[product.category, product.subcategory].filter(Boolean).join(' · ')}
        </div>

        <h3 className={styles.title}>{product.name}</h3>

        {ubicacion && <div className={styles.ubicacion}>{ubicacion}</div>}

        {/* El precio es lo que se compara entre tarjetas: manda solo. La
            descripción y las etiquetas se fueron porque no se comparan, y eran
            lo que hacía que cada tarjeta pareciera un formulario. */}
        <div className={styles.priceSection}>
          <div className={styles.price}>
            {formatPrice(product.price, product.currency)}
          </div>
          <div className={styles.unit}>por {product.unit}</div>
        </div>

        <div className={styles.footer}>
          <div className={styles.seller}>
            <span className={styles.sellerName}>{product.seller.name}</span>
            {product.seller.ratingCount > 0 && (
              <span className={styles.rating}>
                {product.seller.rating.toFixed(1)} de 5
                <span className={styles.ratingCount}>
                  {` (${product.seller.ratingCount})`}
                </span>
              </span>
            )}
          </div>

          <button
            className={`${styles.addToCartButton} ${!hasStock ? styles.disabled : ''}`}
            onClick={handleAddToCart}
            disabled={!hasStock}
          >
            {isService ? 'Consultar' : (hasStock ? 'Agregar' : 'Sin stock')}
          </button>
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
