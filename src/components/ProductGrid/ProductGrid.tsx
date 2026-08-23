import React, { useState, useMemo } from 'react';
import styles from './ProductGrid.module.css';
import { Product } from '../../types';
import { ProductCard } from '../ProductCard/ProductCard';

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  /** Adónde va quien pide una cotización. Se pasa hacia abajo hasta la tarjeta
      y el detalle: sin destino, el botón queda deshabilitado en vez de
      prometer una solicitud que no existe. */
  onSolicitarCotizacion?: () => void;
}

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating';

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading = false,
  onSolicitarCotizacion,
}) => {
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
      <div className={styles.resultados}>
        {/* Bloques del tamaño de las tarjetas que vienen, en vez de un reloj de
            arena centrado: la página no salta cuando llegan los resultados. */}
        <div className={styles.grilla} aria-busy="true" aria-live="polite">
          <span className="tg-sr-only">Cargando operaciones</span>
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

  const cantidad = products.length;

  return (
    <div className={styles.resultados}>
      <div className={styles.barra}>
        <div>
          <div className="tg-meta">Resultados</div>
          {/* «Operaciones» y no «productos»: el conjunto mezcla bienes,
              servicios y logística, y llamarlo productos deja afuera a dos
              tercios de lo que hay. */}
          <h2 className={styles.conteo}>
            {cantidad === 1 ? '1 operación' : `${cantidad} operaciones`}
          </h2>
        </div>

        <div className={`tg-field ${styles.orden}`}>
          <label htmlFor="catalog-sort">Ordenar por</label>
          <select
            id="catalog-sort"
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
      </div>

      {cantidad === 0 ? (
        <div className={styles.vacio}>
          <h3>No hay operaciones con estos filtros.</h3>
          <p className="tg-small">Probá con menos filtros, otra provincia u otras palabras.</p>
        </div>
      ) : (
        <div className={styles.grilla}>
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSolicitarCotizacion={onSolicitarCotizacion}
            />
          ))}
        </div>
      )}
    </div>
  );
};
