import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';

// Función para normalizar texto (quita acentos y convierte a minúsculas)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

interface UseProductFiltersProps {
  products: Product[];
}

export const useProductFilters = ({ products }: UseProductFiltersProps) => {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialNumber = (key: string, fallback: number) => {
    const rawValue = initialParams.get(key);
    if (rawValue === null || rawValue === '') return fallback;
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
  };

  const [searchQuery, setSearchQuery] = useState(initialParams.get('q') || '');
  const [selectedType, setSelectedType] = useState<'todos' | 'productos' | 'servicios'>(() => {
    const value = initialParams.get('type');
    return value === 'productos' || value === 'servicios' ? value : 'todos';
  });
  const [selectedCategory, setSelectedCategory] = useState(
    initialParams.get('category') || 'Todas las categorías'
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    initialParams.get('subcategory') || 'Todas'
  );
  const [selectedProvince, setSelectedProvince] = useState(
    initialParams.get('province') || 'Todas las provincias'
  );
  const [selectedLocalityId, setSelectedLocalityId] = useState(
    initialParams.get('locality_id') || ''
  );
  const [priceMin, setPriceMin] = useState<number>(() => initialNumber('min_price', 0));
  const [priceMax, setPriceMax] = useState<number>(() =>
    initialNumber('max_price', Number.MAX_SAFE_INTEGER)
  );
  const [inStockOnly, setInStockOnly] = useState(initialParams.get('in_stock') === 'true');
  const [minRating, setMinRating] = useState(() => initialNumber('min_rating', 0));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const updateParam = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    updateParam('q', searchQuery || null);
    updateParam('type', selectedType === 'todos' ? null : selectedType);
    updateParam(
      'category',
      selectedCategory === 'Todas las categorías' ? null : selectedCategory
    );
    updateParam('subcategory', selectedSubcategory === 'Todas' ? null : selectedSubcategory);
    updateParam(
      'province',
      selectedProvince === 'Todas las provincias' ? null : selectedProvince
    );
    updateParam('locality_id', selectedLocalityId || null);
    updateParam('min_price', priceMin > 0 ? String(priceMin) : null);
    updateParam(
      'max_price',
      priceMax === Number.MAX_SAFE_INTEGER ? null : String(priceMax)
    );
    updateParam('in_stock', inStockOnly ? 'true' : null);
    updateParam('min_rating', minRating > 0 ? String(minRating) : null);

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [
    searchQuery,
    selectedType,
    selectedCategory,
    selectedSubcategory,
    selectedProvince,
    selectedLocalityId,
    priceMin,
    priceMax,
    inStockOnly,
    minRating,
  ]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Filtro de búsqueda (insensible a acentos)
      const normalizedQuery = normalizeText(searchQuery);
      const matchesSearch = searchQuery === '' || 
        normalizeText(product.name).includes(normalizedQuery) ||
        normalizeText(product.description).includes(normalizedQuery) ||
        product.tags.some(tag => normalizeText(tag).includes(normalizedQuery));

      // Filtro de tipo (producto/servicio)
      const matchesType = selectedType === 'todos' || 
        (selectedType === 'productos' && !product.isService) ||
        (selectedType === 'servicios' && product.isService);

      // Filtro de categoría
      const matchesCategory = selectedCategory === 'Todas las categorías' || 
        product.category === selectedCategory;

      // Filtro de subcategoría
      const matchesSubcategory = selectedSubcategory === 'Todas' || 
        product.subcategory === selectedSubcategory;

      // Filtro de precio
      const matchesPrice = product.price >= priceMin && product.price <= priceMax;

      // Filtro de stock
      const matchesStock = !inStockOnly || product.stock > 0;

      // Filtro de rating
      const matchesRating = product.seller.rating >= minRating;

      return matchesSearch && matchesType && matchesCategory && matchesSubcategory &&
             matchesPrice && matchesStock && matchesRating;
    });
  }, [products, searchQuery, selectedType, selectedCategory, selectedSubcategory,
      priceMin, priceMax, inStockOnly, minRating]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedType('todos');
    setSelectedCategory('Todas las categorías');
    setSelectedSubcategory('Todas');
    setSelectedProvince('Todas las provincias');
    setSelectedLocalityId('');
    setPriceMin(0);
    setPriceMax(Number.MAX_SAFE_INTEGER);
    setInStockOnly(false);
    setMinRating(0);
  };

  return {
    // Estado
    searchQuery,
    selectedType,
    selectedCategory,
    selectedSubcategory,
    selectedProvince,
    selectedLocalityId,
    priceMin,
    priceMax,
    inStockOnly,
    minRating,
    // Setters
    setSearchQuery,
    setSelectedType,
    setSelectedCategory,
    setSelectedSubcategory,
    setSelectedProvince,
    setSelectedLocalityId,
    setPriceMin,
    setPriceMax,
    setInStockOnly,
    setMinRating,
    // Resultados
    filteredProducts,
    resetFilters,
  };
};
