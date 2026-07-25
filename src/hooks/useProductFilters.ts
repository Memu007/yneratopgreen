import { useMemo, useState } from 'react';
import { Product } from '../types';

// Función para normalizar texto (quita acentos y convierte a minúsculas)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const getQueryParam = (name: string): string => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) || '';
};

const updateLocationQuery = (province: string, localityId: string) => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);

  if (province) {
    url.searchParams.set('province', province);
  } else {
    url.searchParams.delete('province');
  }

  if (localityId) {
    url.searchParams.set('locality_id', localityId);
  } else {
    url.searchParams.delete('locality_id');
  }

  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
};

interface UseProductFiltersProps {
  products: Product[];
}

export const useProductFilters = ({ products }: UseProductFiltersProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'todos' | 'productos' | 'servicios'>('todos');
  const [selectedCategory, setSelectedCategory] = useState('Todas las categorías');
  const [selectedSubcategory, setSelectedSubcategory] = useState('Todas');
  const [selectedProvinceState, setSelectedProvinceState] = useState(() => getQueryParam('province'));
  const [selectedLocality, setSelectedLocalityState] = useState(() => getQueryParam('locality_id'));
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(Number.MAX_SAFE_INTEGER);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);

  const setSelectedProvince = (province: string) => {
    setSelectedProvinceState(province);
    setSelectedLocalityState('');
    updateLocationQuery(province, '');
  };

  const setSelectedLocality = (localityId: string) => {
    setSelectedLocalityState(localityId);
    updateLocationQuery(selectedProvinceState, localityId);
  };

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

      // La ubicación se filtra en la API usando product.locality_id.
      // Los demás filtros se aplican sobre el subconjunto devuelto.

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
    setSelectedProvinceState('');
    setSelectedLocalityState('');
    updateLocationQuery('', '');
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
    selectedProvince: selectedProvinceState,
    selectedLocality,
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
    setSelectedLocality,
    setPriceMin,
    setPriceMax,
    setInStockOnly,
    setMinRating,
    // Resultados
    filteredProducts,
    resetFilters,
  };
};
