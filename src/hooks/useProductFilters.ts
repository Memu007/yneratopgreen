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
  /** Sólo el Mercado escribe sus filtros en la barra: en las otras cuatro
      secciones estos parámetros no significan nada. */
  escribeEnLaBarra: boolean;
  /** Cuántas veces movió la barra el historial. Cuando cambia hay que releer
      los filtros de la URL: volver a una entrada tiene que devolver también
      sus controles, no sólo su dirección. */
  versionDeLaBarra: number;
}

const numeroDeLaBarra = (parametros: URLSearchParams, clave: string, porOmision: number) => {
  const crudo = parametros.get(clave);
  if (crudo === null || crudo === '') return porOmision;
  const valor = Number(crudo);
  return Number.isFinite(valor) && valor >= 0 ? valor : porOmision;
};

const tipoDeLaBarra = (valor: string | null): 'todos' | 'productos' | 'servicios' =>
  (valor === 'productos' || valor === 'servicios' ? valor : 'todos');

export const useProductFilters = ({
  products,
  escribeEnLaBarra,
  versionDeLaBarra,
}: UseProductFiltersProps) => {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialNumber = (key: string, fallback: number) =>
    numeroDeLaBarra(initialParams, key, fallback);

  const [searchQuery, setSearchQuery] = useState(initialParams.get('q') || '');
  const [selectedType, setSelectedType] = useState<'todos' | 'productos' | 'servicios'>(() => {
    return tipoDeLaBarra(initialParams.get('type'));
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

  // Volver a una entrada del Mercado tiene que devolver sus filtros. El estado
  // se leyó una sola vez, al montar; desde que Atrás y Adelante existen de
  // verdad, la barra puede cambiar sin que esta pantalla se vuelva a montar.
  useEffect(() => {
    if (versionDeLaBarra === 0) return;
    const params = new URLSearchParams(window.location.search);
    setSearchQuery(params.get('q') || '');
    setSelectedType(tipoDeLaBarra(params.get('type')));
    setSelectedCategory(params.get('category') || 'Todas las categorías');
    setSelectedSubcategory(params.get('subcategory') || 'Todas');
    setSelectedProvince(params.get('province') || 'Todas las provincias');
    setSelectedLocalityId(params.get('locality_id') || '');
    setPriceMin(numeroDeLaBarra(params, 'min_price', 0));
    setPriceMax(numeroDeLaBarra(params, 'max_price', Number.MAX_SAFE_INTEGER));
    setInStockOnly(params.get('in_stock') === 'true');
    setMinRating(numeroDeLaBarra(params, 'min_rating', 0));
  }, [versionDeLaBarra]);

  useEffect(() => {
    if (!escribeEnLaBarra) return;
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
    escribeEnLaBarra,
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
