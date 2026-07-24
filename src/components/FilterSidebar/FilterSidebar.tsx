import React, { useEffect, useMemo } from 'react';
import styles from './FilterSidebar.module.css';
import { provinces } from '../../data/mockData';
import type { CategoryResponse } from '../../utils/catalogService';

interface FilterSidebarProps {
  categories: CategoryResponse[];
  selectedType: 'todos' | 'productos' | 'servicios';
  selectedCategory: string;
  selectedSubcategory: string;
  selectedProvince: string;
  priceMin: number;
  priceMax: number;
  inStockOnly: boolean;
  minRating: number;
  onTypeChange: (type: 'todos' | 'productos' | 'servicios') => void;
  onCategoryChange: (category: string) => void;
  onSubcategoryChange: (subcategory: string) => void;
  onProvinceChange: (province: string) => void;
  onPriceMinChange: (price: number) => void;
  onPriceMaxChange: (price: number) => void;
  onInStockChange: (inStock: boolean) => void;
  onMinRatingChange: (rating: number) => void;
  onResetFilters: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  categories,
  selectedType,
  selectedCategory,
  selectedSubcategory,
  selectedProvince,
  priceMin,
  priceMax,
  inStockOnly,
  minRating,
  onTypeChange,
  onCategoryChange,
  onSubcategoryChange,
  onProvinceChange,
  onPriceMinChange,
  onPriceMaxChange,
  onInStockChange,
  onMinRatingChange,
  onResetFilters,
}) => {
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

  // Resetear categoría cuando cambia el tipo
  useEffect(() => {
    onCategoryChange('Todas las categorías');
    onSubcategoryChange('Todas');
  }, [selectedType]);

  // Resetear subcategoría cuando cambia la categoría
  useEffect(() => {
    onSubcategoryChange('Todas');
  }, [selectedCategory]);

  const handleRatingClick = (rating: number) => {
    onMinRatingChange(rating === minRating ? 0 : rating);
  };

  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.sidebarTitle}>Filtros</h2>

      {/* Tipo: Producto/Servicio */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Tipo</label>
        <select
          className={styles.select}
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value as 'todos' | 'productos' | 'servicios')}
        >
          <option value="todos">Todos</option>
          <option value="productos">Productos</option>
          <option value="servicios">Servicios</option>
        </select>
      </div>

      {/* Categoría */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Categoría</label>
        <select
          className={styles.select}
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
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
          <label className={styles.filterLabel}>Subcategoría</label>
          <select
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

      {/* Ubicación */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Ubicación</label>
        <select
          className={styles.select}
          value={selectedProvince}
          onChange={(e) => onProvinceChange(e.target.value)}
        >
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>

      {/* Precio */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Precio</label>
        <div className={styles.priceInputs}>
          <input
            type="number"
            className={styles.priceInput}
            placeholder="Mínimo"
            value={priceMin || ''}
            onChange={(e) => onPriceMinChange(Number(e.target.value) || 0)}
          />
          <input
            type="number"
            className={styles.priceInput}
            placeholder="Máximo"
            value={priceMax === Number.MAX_SAFE_INTEGER ? '' : priceMax}
            onChange={(e) => onPriceMaxChange(Number(e.target.value) || Number.MAX_SAFE_INTEGER)}
          />
        </div>
      </div>

      {/* Disponibilidad */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Disponibilidad</label>
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

      {/* Calificación del vendedor */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Calificación mínima</label>
        <div className={styles.ratingStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`${styles.star} ${star <= minRating ? styles.active : ''}`}
              onClick={() => handleRatingClick(star)}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      <button className={styles.resetButton} onClick={onResetFilters}>
        Limpiar filtros
      </button>
    </aside>
  );
};
