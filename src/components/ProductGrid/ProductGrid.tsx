import React, { useState, useMemo } from 'react';
import styles from './ProductGrid.module.css';
import { Product } from '../../types';
import { ProductCard } from '../ProductCard/ProductCard';

interface ProductGridProps {
  products: Product[];
  /** Cuántas publicaciones hay para esta consulta, según la API. La grilla
      dibuja como máximo la página descargada, así que contar las tarjetas
      dibujadas sería contar la página y no el mercado. */
  total?: number;
  isLoading?: boolean;
  /** El mercado no cargó. Es distinto de que no haya resultados, y por eso no
      comparte cartel: acá no sabemos qué hay. */
  error?: string | null;
  /** Volver a preguntar. Sin esto, el único camino era recargar la página. */
  onReintentar?: () => void;
  /** Adónde va quien pide una cotización. Se pasa hacia abajo hasta la tarjeta
      y el detalle: sin destino, el botón queda deshabilitado en vez de
      prometer una solicitud que no existe. */
  onSolicitarCotizacion?: () => void;
  /** Se pasa hacia abajo igual que la cotización: la tarjeta la necesita para
      que el detalle, sin sesión, ofrezca ingresar en vez de un aviso sin
      salida. */
  onSolicitarIngreso?: (alVolver: () => void) => void;
}

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating';

/** Las dos presentaciones del Mercado, y no hay una tercera. El «destacado»
 *  implícito —el activo que se quedaba con la fila entera— dejó de existir:
 *  la geometría la elige quien mira, no la anatomía de lo que está mirando. */
type Vista = 'cuadricula' | 'lista';

const VISTAS: { valor: Vista; rotulo: string }[] = [
  { valor: 'cuadricula', rotulo: 'Cuadrícula' },
  { valor: 'lista', rotulo: 'Lista' },
];

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  total,
  isLoading = false,
  error = null,
  onReintentar,
  onSolicitarCotizacion,
  onSolicitarIngreso,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  // La vista vive acá y sólo acá: ordenar, buscar, filtrar o abrir un detalle
  // no la tocan, porque ninguno de esos desmonta esta grilla. Salir del Mercado
  // sí la reinicia, y está bien: es una preferencia de la visita, no del perfil.
  const [vista, setVista] = useState<Vista>('cuadricula');

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

  // Una falla no es un catálogo vacío. Antes las dos terminaban en «No hay
  // operaciones con estos filtros», así que la página afirmaba que no existe
  // lo que no pudo preguntar.
  if (error) {
    return (
      <div className={styles.resultados}>
        <div className={styles.vacio} role="alert">
          <h3>{error}</h3>
          {onReintentar && (
            <button
              type="button"
              className="tg-button tg-button--secondary"
              onClick={onReintentar}
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  const dibujadas = products.length;
  // El total de la API cuando llegó; si no llegó, lo que hay en pantalla.
  const disponibles = total ?? dibujadas;
  // Y cuando el mercado tiene más de lo que entró en la página, se dice: no se
  // esconde el total verdadero ni se lo confunde con la página cargada. La
  // paginación sigue siendo deuda abierta y está registrada aparte.
  const parcial = disponibles > dibujadas;

  return (
    <div className={styles.resultados}>
      <div className={styles.barra}>
        {/* «Operaciones» y no «productos»: el conjunto mezcla bienes,
            servicios y logística, y llamarlo productos deja afuera a dos
            tercios de lo que hay. */}
        <h2 className={styles.conteo}>
          <strong className="tg-data">
            {parcial ? `${dibujadas} de ${disponibles}` : disponibles}
          </strong>
          <span>{disponibles === 1 ? 'operación' : 'operaciones'}</span>
        </h2>

        <div className={styles.controles}>
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

          {/* Dos radios de verdad y no un par de iconos: el rótulo se lee, el
              estado lo anuncia el navegador y las flechas alternan sin ratón.
              El radio queda escondido a la vista pero no del teclado ni del
              árbol de accesibilidad. */}
          <div className={styles.vista}>
            <span className={styles.vistaRotulo} id="rotulo-de-la-vista">Vista</span>
            <div
              className={styles.opciones}
              role="radiogroup"
              aria-labelledby="rotulo-de-la-vista"
            >
              {VISTAS.map(({ valor, rotulo }) => (
                <label key={valor} className={styles.opcionDeVista}>
                  <input
                    type="radio"
                    name="vista-del-mercado"
                    value={valor}
                    checked={vista === valor}
                    onChange={() => setVista(valor)}
                  />
                  <span className={styles.opcionTexto}>{rotulo}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dibujadas === 0 ? (
        <div className={styles.vacio}>
          <h3>No hay operaciones con estos filtros.</h3>
          <p className="tg-small">Probá con menos filtros, otra provincia u otras palabras.</p>
        </div>
      ) : (
        <div className={vista === 'lista' ? styles.renglones : styles.grilla}>
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              variante={vista === 'lista' ? 'lista' : 'catalogo'}
              onSolicitarCotizacion={onSolicitarCotizacion}
              onSolicitarIngreso={onSolicitarIngreso}
            />
          ))}
        </div>
      )}
    </div>
  );
};
