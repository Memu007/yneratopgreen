import React, { useState, useMemo } from 'react';
import styles from './ProductGrid.module.css';
import { Product } from '../../types';
import { ProductCard } from '../ProductCard/ProductCard';

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
}

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating';

export const ProductGrid: React.FC<ProductGridProps> = ({ products, isLoading = false }) => {
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  const sortedProducts = useMemo(() => {
    const sorted = [...products];

    switch (sortBy) {
      case 'price-asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'newest':
        return sorted.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'rating':
        return sorted.sort((a, b) => b.seller.rating - a.seller.rating);
      default:
        return sorted;
    }
  }, [products, sortBy]);

  if (isLoading) {
    return (
      <div className={styles.grid}>
        {/* Bloques del tamaño de las tarjetas que vienen, en vez de un reloj de
            arena centrado: la página no salta cuando llegan los resultados. */}
        <div className={styles.productsGrid} aria-busy="true" aria-live="polite">
          <span className={styles.soloLectores}>Buscando publicaciones…</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.esqueleto} aria-hidden="true">
              <div className={styles.esqueletoImagen} />
              <div className={styles.esqueletoLinea} />
              <div className={`${styles.esqueletoLinea} ${styles.esqueletoCorta}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={styles.grid}>
        <div className={styles.emptyState}>
          <h3 className={styles.emptyTitle}>No hay publicaciones para esta búsqueda</h3>
          <p className={styles.emptyText}>
            Probá con menos filtros, otra provincia u otras palabras.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <div className={styles.header}>
        <div className={styles.resultsCount}>
          <span className={styles.resultsNumber}>{products.length}</span> productos encontrados
        </div>

        <select aria-label="Ordenar resultados"
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="relevance">Más relevantes</option>
          <option value="price-asc">Menor precio</option>
          <option value="price-desc">Mayor precio</option>
          <option value="newest">Más recientes</option>
          <option value="rating">Mejor calificados</option>
        </select>
      </div>

      <div className={styles.productsGrid}>
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};
