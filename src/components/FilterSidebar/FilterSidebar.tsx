import React, { useMemo, useState } from 'react';
import styles from './FilterSidebar.module.css';
import type {
  CategoryResponse,
  LocalityResponse,
  ProvinceResponse,
} from '../../utils/catalogService';

interface FilterSidebarProps {
  categories: CategoryResponse[];
  provinces: ProvinceResponse[];
  localities: LocalityResponse[];
  isLoadingLocalities: boolean;
  selectedType: 'todos' | 'productos' | 'servicios';
  selectedCategory: string;
  selectedSubcategory: string;
  selectedProvinceId: string;
  selectedLocalityId: string;
  priceMin: number;
  priceMax: number;
  inStockOnly: boolean;
  minRating: number;
  onTypeChange: (type: 'todos' | 'productos' | 'servicios') => void;
  onCategoryChange: (category: string) => void;
  onSubcategoryChange: (subcategory: string) => void;
  onProvinceChange: (provinceId: string) => void;
  onLocalityChange: (localityId: string) => void;
  onPriceMinChange: (price: number) => void;
  onPriceMaxChange: (price: number) => void;
  onInStockChange: (inStock: boolean) => void;
  onMinRatingChange: (rating: number) => void;
  onResetFilters: () => void;
  /** Cuántas operaciones quedan con los filtros puestos. En celular el
      panel termina con «Ver N resultados»: sin el número, cerrar el panel
      es un salto a ciegas. */
  cantidadDeResultados: number;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  categories,
  provinces,
  localities,
  isLoadingLocalities,
  selectedType,
  selectedCategory,
  selectedSubcategory,
  selectedProvinceId,
  selectedLocalityId,
  priceMin,
  priceMax,
  inStockOnly,
  minRating,
  onTypeChange,
  onCategoryChange,
  onSubcategoryChange,
  onProvinceChange,
  onLocalityChange,
  onPriceMinChange,
  onPriceMaxChange,
  onInStockChange,
  onMinRatingChange,
  onResetFilters,
  cantidadDeResultados,
}) => {
  const [abierto, setAbierto] = useState(false);
  // Filtrar categorías según el tipo seleccionado
  const filteredCategories = useMemo(() => {
    if (selectedType === 'todos') return categories;
    if (selectedType === 'productos') return categories.filter(c => !c.is_service);
    return categories.filter(c => c.is_service);
  }, [categories, selectedType]);

  // Obtener subcategorías de la categoría seleccionada
  const currentSubcategories = useMemo(() => {
    if (selectedCategory === 'Todas las categorías') return [];
    const category = categories.find(c => c.name === selectedCategory);
    return category?.subcategories?.filter(s => s.is_active) || [];
  }, [categories, selectedCategory]);

  return (
    <aside className={styles.panel}>
      <div className={styles.plegable}>
        <button
          type="button"
          className={styles.resumen}
          aria-expanded={abierto}
          aria-controls="panel-de-filtros"
          onClick={() => setAbierto((previo) => !previo)}
        >
          Filtros
          <span className={styles.contador} aria-hidden="true">
            {abierto ? 'Cerrar' : 'Abrir'}
          </span>
        </button>

        <div id="panel-de-filtros" className={`${styles.cuerpo} ${abierto ? styles.abierto : ''}`}>
          <div className={styles.encabezado}>
            <h2 className={styles.titulo}>Filtrar</h2>
            <button className="tg-button tg-button--tertiary" onClick={onResetFilters}>
              Limpiar
            </button>
          </div>

          {/* Tipo: Producto/Servicio */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-type">Tipo</label>
            <select
              id="catalog-type"
              className={styles.select}
              value={selectedType}
              onChange={(e) => {
                onTypeChange(e.target.value as 'todos' | 'productos' | 'servicios');
                onCategoryChange('Todas las categorías');
                onSubcategoryChange('Todas');
              }}
            >
              <option value="todos">Todos</option>
              <option value="productos">Productos</option>
              <option value="servicios">Servicios</option>
            </select>
          </div>

          {/* Categoría */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-category">Categoría</label>
            <select
              id="catalog-category"
              className={styles.select}
              value={selectedCategory}
              onChange={(e) => {
                onCategoryChange(e.target.value);
                onSubcategoryChange('Todas');
              }}
            >
              <option value="Todas las categorías">Todas las categorías</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategoría */}
          {currentSubcategories.length > 0 && (
            <div className={styles.filterSection}>
              <label className={styles.filterLabel} htmlFor="catalog-subcategory">Subcategoría</label>
              <select
                id="catalog-subcategory"
                className={styles.select}
                value={selectedSubcategory}
                onChange={(e) => onSubcategoryChange(e.target.value)}
              >
                <option value="Todas">Todas</option>
                {currentSubcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.name}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ubicación oficial de la publicación */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-province">Provincia</label>
            <select
              id="catalog-province"
              className={styles.select}
              value={selectedProvinceId}
              onChange={(e) => onProvinceChange(e.target.value)}
            >
              <option value="">Todas las provincias</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-locality">Localidad</label>
            <select
              id="catalog-locality"
              className={styles.select}
              value={selectedLocalityId}
              onChange={(e) => onLocalityChange(e.target.value)}
              disabled={!selectedProvinceId || isLoadingLocalities}
            >
              <option value="">
                {isLoadingLocalities ? 'Cargando localidades...' : 'Todas las localidades'}
              </option>
              {localities.map((locality) => (
                <option key={locality.id} value={locality.id}>
                  {locality.name}
                </option>
              ))}
            </select>
          </div>

          {/* Precio */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-price-min">Precio</label>
            <div className={styles.priceInputs}>
              <input
                id="catalog-price-min"
                type="number"
                aria-label="Precio mínimo"
                className={styles.priceInput}
                placeholder="Mínimo"
                value={priceMin || ''}
                onChange={(e) => onPriceMinChange(Number(e.target.value) || 0)}
              />
              <input
                id="catalog-price-max"
                type="number"
                aria-label="Precio máximo"
                className={styles.priceInput}
                placeholder="Máximo"
                value={priceMax === Number.MAX_SAFE_INTEGER ? '' : priceMax}
                onChange={(e) => onPriceMaxChange(Number(e.target.value) || Number.MAX_SAFE_INTEGER)}
              />
            </div>
          </div>

          {/* Disponibilidad */}
          <div className={styles.filterSection}>
            <span className={styles.filterLabel} id="catalog-availability">Disponibilidad</span>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={inStockOnly}
                  onChange={(e) => onInStockChange(e.target.checked)}
                />
                Solo con stock disponible
              </label>
            </div>
          </div>

          {/* Calificación del vendedor.
              Eran cinco `span` con `onClick`: no se llegaban con el teclado, no
              tenían nombre y había que saber que una estrella llena significaba
              «esta cantidad o más». Ahora es el mismo control que los otros
              filtros y dice lo que hace. */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-rating">
              Calificación mínima del vendedor
            </label>
            <select
              id="catalog-rating"
              className={styles.select}
              value={minRating}
              onChange={(e) => onMinRatingChange(Number(e.target.value))}
            >
              <option value={0}>Cualquiera</option>
              {[1, 2, 3, 4, 5].map((estrellas) => (
                <option key={estrellas} value={estrellas}>
                  {estrellas} de 5 o más
                </option>
              ))}
            </select>
          </div>

          {/* En celular el panel es parte del flujo y termina devolviendo
              a los resultados con el número puesto. En escritorio esta fila
              no se dibuja: el panel nunca está tapando nada. */}
          <button className={`tg-button tg-button--primary ${styles.verResultados}`}
                  onClick={() => setAbierto(false)}>
            {cantidadDeResultados === 1 ? 'Ver 1 resultado' : `Ver ${cantidadDeResultados} resultados`}
          </button>
        </div>
      </div>
    </aside>
  );
};
