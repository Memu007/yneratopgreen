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
        <div className={styles.emptyState}>
          <div className={styles.loadingSpinner}>⏳</div>
          <h3 className={styles.emptyTitle}>Cargando productos...</h3>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={styles.grid}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <h3 className={styles.emptyTitle}>No se encontraron productos</h3>
          <p className={styles.emptyText}>
            Intenta ajustar los filtros o realiza una búsqueda diferente
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

        <select 
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
