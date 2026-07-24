import { useState, useMemo } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'todos' | 'productos' | 'servicios'>('todos');
  const [selectedCategory, setSelectedCategory] = useState('Todas las categorías');
  const [selectedSubcategory, setSelectedSubcategory] = useState('Todas');
  const [selectedProvince, setSelectedProvince] = useState('Todas las provincias');
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(Number.MAX_SAFE_INTEGER);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);

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

      // Filtro de provincia (normalizado para ignorar acentos)
      const matchesProvince = selectedProvince === 'Todas las provincias' || 
        normalizeText(product.location.province) === normalizeText(selectedProvince);

      // Filtro de precio
      const matchesPrice = product.price >= priceMin && product.price <= priceMax;

      // Filtro de stock
      const matchesStock = !inStockOnly || product.stock > 0;

      // Filtro de rating
      const matchesRating = product.seller.rating >= minRating;

      return matchesSearch && matchesType && matchesCategory && matchesSubcategory && 
             matchesProvince && matchesPrice && matchesStock && matchesRating;
    });
  }, [products, searchQuery, selectedType, selectedCategory, selectedSubcategory, selectedProvince, 
      priceMin, priceMax, inStockOnly, minRating]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedType('todos');
    setSelectedCategory('Todas las categorías');
    setSelectedSubcategory('Todas');
    setSelectedProvince('Todas las provincias');
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
    setPriceMin,
    setPriceMax,
    setInStockOnly,
    setMinRating,
    // Resultados
    filteredProducts,
    resetFilters,
  };
};
