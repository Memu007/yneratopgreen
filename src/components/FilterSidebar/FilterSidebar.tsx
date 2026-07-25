import React, { useEffect, useMemo, useState } from 'react';
import styles from './FilterSidebar.module.css';
import {
  getLocalities,
  getProvinces,
  type CategoryResponse,
  type LocalityResponse,
  type ProvinceResponse,
} from '../../utils/catalogService';

interface FilterSidebarProps {
  categories: CategoryResponse[];
  selectedType: 'todos' | 'productos' | 'servicios';
  selectedCategory: string;
  selectedSubcategory: string;
  selectedProvince: string;
  selectedLocality: string;
  priceMin: number;
  priceMax: number;
  inStockOnly: boolean;
  minRating: number;
  onTypeChange: (type: 'todos' | 'productos' | 'servicios') => void;
  onCategoryChange: (category: string) => void;
  onSubcategoryChange: (subcategory: string) => void;
  onProvinceChange: (province: string) => void;
  onLocalityChange: (localityId: string) => void;
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
  selectedLocality,
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
}) => {
  const [provinceOptions, setProvinceOptions] = useState<ProvinceResponse[]>([]);
  const [localityOptions, setLocalityOptions] = useState<LocalityResponse[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingLocalities, setLoadingLocalities] = useState(false);

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

  const selectedProvinceId = useMemo(() => {
    return provinceOptions.find(province => province.name === selectedProvince)?.id || '';
  }, [provinceOptions, selectedProvince]);

  useEffect(() => {
    let cancelled = false;

    const loadProvinces = async () => {
      setLoadingProvinces(true);
      try {
        const data = await getProvinces();
        if (!cancelled) {
          setProvinceOptions(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error al cargar provincias:', error);
          setProvinceOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingProvinces(false);
        }
      }
    };

    void loadProvinces();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProvinceId) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    let cancelled = false;

    const loadLocalities = async () => {
      setLoadingLocalities(true);
      try {
        const data = await getLocalities(selectedProvinceId);
        if (!cancelled) {
          setLocalityOptions(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error al cargar localidades:', error);
          setLocalityOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingLocalities(false);
        }
      }
    };

    void loadLocalities();

    return () => {
      cancelled = true;
    };
  }, [selectedProvinceId]);

  // Resetear categoría cuando cambia el tipo
  useEffect(() => {
    onCategoryChange('Todas las categorías');
    onSubcategoryChange('Todas');
  }, [onCategoryChange, onSubcategoryChange, selectedType]);

  // Resetear subcategoría cuando cambia la categoría
  useEffect(() => {
    onSubcategoryChange('Todas');
  }, [onSubcategoryChange, selectedCategory]);

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

      {/* Provincia */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Provincia</label>
        <select
          className={styles.select}
          value={selectedProvince}
          onChange={(e) => onProvinceChange(e.target.value)}
          disabled={loadingProvinces}
        >
          <option value="">
            {loadingProvinces ? 'Cargando provincias...' : 'Todas las provincias'}
          </option>
          {provinceOptions.map((province) => (
            <option key={province.id} value={province.name}>
              {province.name}
            </option>
          ))}
        </select>
      </div>

      {/* Localidad */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Localidad</label>
        <select
          className={styles.select}
          value={selectedLocality}
          onChange={(e) => onLocalityChange(e.target.value)}
          disabled={!selectedProvinceId || loadingLocalities}
        >
          <option value="">
            {loadingLocalities ? 'Cargando localidades...' : 'Todas las localidades'}
          </option>
          {localityOptions.map((locality) => (
            <option key={locality.id} value={locality.id}>
              {locality.name}
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
