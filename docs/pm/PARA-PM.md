# Dev 2 → PM

## Tarea

Implementé los filtros de provincia y localidad del catálogo, combinables con
categoría, precio y stock, con estado persistente en la URL.

La funcionalidad está verificada en navegador y contra PostgreSQL. Hay una
discrepancia en el criterio de cantidades: el seed actual no contiene 4/2/2
productos por provincia sino 6/3/3. No modifiqué backend ni seed para forzar un
resultado que contradiga la base.

## Archivos tocados

| Archivo | Agregadas | Borradas |
|---|---:|---:|
| `src/App.tsx` | 183 | 73 |
| `src/components/FilterSidebar/FilterSidebar.tsx` | 102 | 65 |
| `src/hooks/useProductFilters.ts` | 91 | 27 |
| `src/utils/catalogService.ts` | 41 | 15 |
| **Total de código** | **417** | **180** |

Este informe reemplaza el contenido anterior de `docs/pm/PARA-PM-2.md`.

## Qué hice

- Reemplacé la lista hardcodeada de provincias por
  `GET /api/catalog/localities/provinces`.
- El selector de provincia conserva el ID de dos caracteres para pedir
  localidades, pero el filtro de productos envía el nombre canónico exigido
  por el backend.
- Agregué el selector encadenado de localidades mediante
  `GET /api/catalog/localities?province_id=XX`.
- Al cambiar provincia se vacían la localidad seleccionada y el parámetro
  `locality_id`.
- El listado consulta al backend con provincia/localidad/categoría/precio/stock
  y conserva los filtros locales preexistentes de tipo, subcategoría y rating.
- Sincronicé en la URL búsqueda, tipo, categoría, subcategoría, provincia,
  localidad, precios, stock y rating. `section=marketplace` permite recargar o
  compartir el catálogo sin volver a Home.
- Evité carreras entre requests al cambiar filtros rápidamente.
- Moví los resets de categoría/subcategoría a sus eventos de cambio. Los
  `useEffect` anteriores los borraban durante el montaje y rompían la
  restauración desde URL.
- Añadí asociación `label`/`id` y nombres accesibles a los controles usados en
  la prueba de navegador.
- No modifiqué backend, esquema, migraciones, seed ni Docker.

## Diff completo

Diff real entre `de694cdb947358211ffcd9ddf2b8ac6cd2920d27` (main al
comenzar) y el commit de código `5de5b33e037a9364f8700eabb0bbfd405435b8a3`:

```diff
diff --git a/src/App.tsx b/src/App.tsx
index 8cdeba9..6f32a0a 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -17,25 +17,40 @@ import { ServicesPage } from './components/Pages/ServicesPage';
 import { ContactPage } from './components/Pages/ContactPage';
 import { PaymentResultPage } from './components/Pages/PaymentResultPage';
 import { useProductFilters } from './hooks/useProductFilters';
-import { getProducts, getCategories, convertBackendProductToFrontend } from './utils/catalogService';
-import type { NewProductData, Product } from './types';
-import type { CategoryResponse } from './utils/catalogService';
+import {
+  getProducts,
+  getCategories,
+  getLocalities,
+  getProvinces,
+  convertBackendProductToFrontend,
+} from './utils/catalogService';
+import type { NewProductData, Product } from './types';
+import type {
+  CategoryResponse,
+  LocalityResponse,
+  ProvinceResponse,
+} from './utils/catalogService';

 type AuthModalType = 'login' | 'register' | null;
 type PageSection = 'home' | 'marketplace' | 'about' | 'services' | 'contact' | 'payment-success' | 'payment-failure' | 'payment-pending';

 function App() {
   const { user } = useAuth();
-  const [products, setProducts] = useState<Product[]>([]);
-  const [categories, setCategories] = useState<CategoryResponse[]>([]);
-  const [loadingProducts, setLoadingProducts] = useState(false);
+  const [products, setProducts] = useState<Product[]>([]);
+  const [categories, setCategories] = useState<CategoryResponse[]>([]);
+  const [provinces, setProvinces] = useState<ProvinceResponse[]>([]);
+  const [localities, setLocalities] = useState<LocalityResponse[]>([]);
+  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
+  const [loadingProducts, setLoadingProducts] = useState(false);
+  const [productsRevision, setProductsRevision] = useState(0);

   const {
     searchQuery,
     selectedType,
     selectedCategory,
-    selectedSubcategory,
-    selectedProvince,
+    selectedSubcategory,
+    selectedProvince,
+    selectedLocalityId,
     priceMin,
     priceMax,
     inStockOnly,
@@ -43,8 +58,9 @@ function App() {
     setSearchQuery,
     setSelectedType,
     setSelectedCategory,
-    setSelectedSubcategory,
-    setSelectedProvince,
+    setSelectedSubcategory,
+    setSelectedProvince,
+    setSelectedLocalityId,
     setPriceMin,
     setPriceMax,
     setInStockOnly,
@@ -58,53 +74,130 @@ function App() {
   const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
   const [isAddProductOpen, setIsAddProductOpen] = useState(false);
   const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
-  const [currentSection, setCurrentSection] = useState<PageSection>(() => {
+  const [currentSection, setCurrentSection] = useState<PageSection>(() => {
     // Detectar rutas de pago desde URL al cargar
     const path = window.location.pathname;
     if (path === '/payment/success') return 'payment-success';
-    if (path === '/payment/failure') return 'payment-failure';
-    if (path === '/payment/pending') return 'payment-pending';
-    return 'home';
-  });
-
-  // Cargar productos y categorías desde la API cuando se navega al marketplace
-  useEffect(() => {
-    if (currentSection === 'marketplace') {
-      loadProductsFromAPI();
-      loadCategoriesFromAPI();
-    }
-  }, [currentSection]);
-
-  const loadCategoriesFromAPI = async () => {
-    try {
-      const data = await getCategories();
-      setCategories(data);
-    } catch (error) {
-      console.error('Error al cargar categorías:', error);
-      setCategories([]);
-    }
-  };
-
-  const loadProductsFromAPI = async () => {
-    setLoadingProducts(true);
-    try {
-      const response = await getProducts({
-        page: 1,
-        page_size: 100,
-        sort_by: 'created_at',
-        sort_order: 'desc',
-      });
-
-      const frontendProducts = response.items.map(convertBackendProductToFrontend);
-      setProducts(frontendProducts);
-    } catch (error) {
-      console.error('Error al cargar productos:', error);
-      // En caso de error, mantener array vacío
-      setProducts([]);
-    } finally {
-      setLoadingProducts(false);
-    }
-  };
+    if (path === '/payment/failure') return 'payment-failure';
+    if (path === '/payment/pending') return 'payment-pending';
+    if (new URLSearchParams(window.location.search).get('section') === 'marketplace') {
+      return 'marketplace';
+    }
+    return 'home';
+  });
+
+  const selectedProvinceId =
+    provinces.find((province) => province.name === selectedProvince)?.id || '';
+
+  // Cargar catálogos auxiliares al entrar al marketplace.
+  useEffect(() => {
+    if (currentSection !== 'marketplace') return;
+
+    let cancelled = false;
+    Promise.all([getCategories(), getProvinces()])
+      .then(([categoryData, provinceData]) => {
+        if (cancelled) return;
+        setCategories(categoryData);
+        setProvinces(provinceData);
+      })
+      .catch((error) => {
+        if (cancelled) return;
+        console.error('Error al cargar filtros del catálogo:', error);
+        setCategories([]);
+        setProvinces([]);
+      });
+
+    return () => {
+      cancelled = true;
+    };
+  }, [currentSection]);
+
+  // Cargar las localidades con el ID corto de provincia.
+  useEffect(() => {
+    if (currentSection !== 'marketplace' || !selectedProvinceId) {
+      setLocalities([]);
+      setIsLoadingLocalities(false);
+      return;
+    }
+
+    let cancelled = false;
+    setLocalities([]);
+    setIsLoadingLocalities(true);
+    getLocalities(selectedProvinceId)
+      .then((data) => {
+        if (!cancelled) setLocalities(data);
+      })
+      .catch((error) => {
+        if (cancelled) return;
+        console.error('Error al cargar localidades:', error);
+        setLocalities([]);
+      })
+      .finally(() => {
+        if (!cancelled) setIsLoadingLocalities(false);
+      });
+
+    return () => {
+      cancelled = true;
+    };
+  }, [currentSection, selectedProvinceId]);
+
+  // Filtrar en la API para usar la ubicación real de la publicación.
+  useEffect(() => {
+    if (currentSection !== 'marketplace') return;
+    if (selectedProvince !== 'Todas las provincias' && !selectedProvinceId) return;
+    if (
+      selectedCategory !== 'Todas las categorías'
+      && !categories.some((category) => category.name === selectedCategory)
+    ) {
+      return;
+    }
+
+    let cancelled = false;
+    setLoadingProducts(true);
+    getProducts({
+        search: searchQuery || undefined,
+        category: categories.find((category) => category.name === selectedCategory)?.id,
+        province:
+          selectedProvince === 'Todas las provincias' ? undefined : selectedProvince,
+        locality_id: selectedLocalityId || undefined,
+        min_price: priceMin > 0 ? priceMin : undefined,
+        max_price:
+          priceMax === Number.MAX_SAFE_INTEGER ? undefined : priceMax,
+        in_stock: inStockOnly || undefined,
+        page: 1,
+        page_size: 100,
+        sort_by: 'created_at',
+        sort_order: 'desc',
+      })
+      .then((response) => {
+        if (cancelled) return;
+        setProducts(response.items.map(convertBackendProductToFrontend));
+      })
+      .catch((error) => {
+        if (cancelled) return;
+        console.error('Error al cargar productos:', error);
+        setProducts([]);
+      })
+      .finally(() => {
+        if (!cancelled) setLoadingProducts(false);
+      });
+
+    return () => {
+      cancelled = true;
+    };
+  }, [
+    currentSection,
+    searchQuery,
+    selectedCategory,
+    selectedProvince,
+    selectedProvinceId,
+    selectedLocalityId,
+    priceMin,
+    priceMax,
+    inStockOnly,
+    categories,
+    productsRevision,
+  ]);

   const handleSearchSubmit = () => {
     console.log('Búsqueda realizada:', searchQuery);
@@ -116,19 +209,31 @@ function App() {
   };

   const handleAddProduct = (productData: NewProductData) => {
-    console.log('Nuevo producto agregado:', productData);
-    // Navegar al marketplace y recargar productos
-    setCurrentSection('marketplace');
-    // Esperar un momento para que el useEffect se ejecute
-    setTimeout(() => {
-      loadProductsFromAPI();
-    }, 100);
-  };
+    console.log('Nuevo producto agregado:', productData);
+    // Navegar al marketplace y recargar productos
+    setCurrentSection('marketplace');
+    setProductsRevision((revision) => revision + 1);
+  };

-  const handleNavigate = (section: PageSection) => {
-    setCurrentSection(section);
-    window.scrollTo({ top: 0, behavior: 'smooth' });
-  };
+  const handleNavigate = (section: PageSection) => {
+    const params = new URLSearchParams(window.location.search);
+    if (section === 'marketplace') params.set('section', 'marketplace');
+    else params.delete('section');
+    const query = params.toString();
+    window.history.replaceState(
+      window.history.state,
+      '',
+      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
+    );
+    setCurrentSection(section);
+    window.scrollTo({ top: 0, behavior: 'smooth' });
+  };
+
+  const handleProvinceChange = (provinceId: string) => {
+    const province = provinces.find((item) => item.id === provinceId);
+    setSelectedProvince(province?.name || 'Todas las provincias');
+    setSelectedLocalityId('');
+  };

   const renderContent = () => {
     switch (currentSection) {
@@ -144,12 +249,16 @@ function App() {
         return (
           <main className={styles.mainContent}>
             <div className={styles.contentWrapper}>
-              <FilterSidebar
-                categories={categories}
-                selectedType={selectedType}
-                selectedCategory={selectedCategory}
-                selectedSubcategory={selectedSubcategory}
-                selectedProvince={selectedProvince}
+              <FilterSidebar
+                categories={categories}
+                provinces={provinces}
+                localities={localities}
+                isLoadingLocalities={isLoadingLocalities}
+                selectedType={selectedType}
+                selectedCategory={selectedCategory}
+                selectedSubcategory={selectedSubcategory}
+                selectedProvinceId={selectedProvinceId}
+                selectedLocalityId={selectedLocalityId}
                 priceMin={priceMin}
                 priceMax={priceMax}
                 inStockOnly={inStockOnly}
@@ -157,7 +266,8 @@ function App() {
                 onTypeChange={setSelectedType}
                 onCategoryChange={setSelectedCategory}
                 onSubcategoryChange={setSelectedSubcategory}
-                onProvinceChange={setSelectedProvince}
+                onProvinceChange={handleProvinceChange}
+                onLocalityChange={setSelectedLocalityId}
                 onPriceMinChange={setPriceMin}
                 onPriceMaxChange={setPriceMax}
                 onInStockChange={setInStockOnly}
diff --git a/src/components/FilterSidebar/FilterSidebar.tsx b/src/components/FilterSidebar/FilterSidebar.tsx
index c4fcf73..06037b3 100644
--- a/src/components/FilterSidebar/FilterSidebar.tsx
+++ b/src/components/FilterSidebar/FilterSidebar.tsx
@@ -1,14 +1,21 @@
-import React, { useEffect, useMemo } from 'react';
-import styles from './FilterSidebar.module.css';
-import { provinces } from '../../data/mockData';
-import type { CategoryResponse } from '../../utils/catalogService';
-
-interface FilterSidebarProps {
-  categories: CategoryResponse[];
-  selectedType: 'todos' | 'productos' | 'servicios';
-  selectedCategory: string;
-  selectedSubcategory: string;
-  selectedProvince: string;
+import React, { useMemo } from 'react';
+import styles from './FilterSidebar.module.css';
+import type {
+  CategoryResponse,
+  LocalityResponse,
+  ProvinceResponse,
+} from '../../utils/catalogService';
+
+interface FilterSidebarProps {
+  categories: CategoryResponse[];
+  provinces: ProvinceResponse[];
+  localities: LocalityResponse[];
+  isLoadingLocalities: boolean;
+  selectedType: 'todos' | 'productos' | 'servicios';
+  selectedCategory: string;
+  selectedSubcategory: string;
+  selectedProvinceId: string;
+  selectedLocalityId: string;
   priceMin: number;
   priceMax: number;
   inStockOnly: boolean;
@@ -16,7 +23,8 @@ interface FilterSidebarProps {
   onTypeChange: (type: 'todos' | 'productos' | 'servicios') => void;
   onCategoryChange: (category: string) => void;
   onSubcategoryChange: (subcategory: string) => void;
-  onProvinceChange: (province: string) => void;
+  onProvinceChange: (provinceId: string) => void;
+  onLocalityChange: (localityId: string) => void;
   onPriceMinChange: (price: number) => void;
   onPriceMaxChange: (price: number) => void;
   onInStockChange: (inStock: boolean) => void;
@@ -24,20 +32,25 @@ interface FilterSidebarProps {
   onResetFilters: () => void;
 }

-export const FilterSidebar: React.FC<FilterSidebarProps> = ({
-  categories,
-  selectedType,
-  selectedCategory,
-  selectedSubcategory,
-  selectedProvince,
+export const FilterSidebar: React.FC<FilterSidebarProps> = ({
+  categories,
+  provinces,
+  localities,
+  isLoadingLocalities,
+  selectedType,
+  selectedCategory,
+  selectedSubcategory,
+  selectedProvinceId,
+  selectedLocalityId,
   priceMin,
   priceMax,
   inStockOnly,
   minRating,
   onTypeChange,
   onCategoryChange,
-  onSubcategoryChange,
-  onProvinceChange,
+  onSubcategoryChange,
+  onProvinceChange,
+  onLocalityChange,
   onPriceMinChange,
   onPriceMaxChange,
   onInStockChange,
@@ -58,17 +71,6 @@ export const FilterSidebar: React.FC<FilterSidebarProps> = ({
     return category?.subcategories?.filter(s => s.is_active) || [];
   }, [categories, selectedCategory]);

-  // Resetear categoría cuando cambia el tipo
-  useEffect(() => {
-    onCategoryChange('Todas las categorías');
-    onSubcategoryChange('Todas');
-  }, [selectedType]);
-
-  // Resetear subcategoría cuando cambia la categoría
-  useEffect(() => {
-    onSubcategoryChange('Todas');
-  }, [selectedCategory]);
-
   const handleRatingClick = (rating: number) => {
     onMinRatingChange(rating === minRating ? 0 : rating);
   };
@@ -79,11 +81,16 @@ export const FilterSidebar: React.FC<FilterSidebarProps> = ({

       {/* Tipo: Producto/Servicio */}
       <div className={styles.filterSection}>
-        <label className={styles.filterLabel}>Tipo</label>
-        <select
-          className={styles.select}
-          value={selectedType}
-          onChange={(e) => onTypeChange(e.target.value as 'todos' | 'productos' | 'servicios')}
+        <label className={styles.filterLabel} htmlFor="catalog-type">Tipo</label>
+        <select
+          id="catalog-type"
+          className={styles.select}
+          value={selectedType}
+          onChange={(e) => {
+            onTypeChange(e.target.value as 'todos' | 'productos' | 'servicios');
+            onCategoryChange('Todas las categorías');
+            onSubcategoryChange('Todas');
+          }}
         >
           <option value="todos">Todos</option>
           <option value="productos">Productos</option>
@@ -93,11 +100,15 @@ export const FilterSidebar: React.FC<FilterSidebarProps> = ({

       {/* Categoría */}
       <div className={styles.filterSection}>
-        <label className={styles.filterLabel}>Categoría</label>
-        <select
-          className={styles.select}
-          value={selectedCategory}
-          onChange={(e) => onCategoryChange(e.target.value)}
+        <label className={styles.filterLabel} htmlFor="catalog-category">Categoría</label>
+        <select
+          id="catalog-category"
+          className={styles.select}
+          value={selectedCategory}
+          onChange={(e) => {
+            onCategoryChange(e.target.value);
+            onSubcategoryChange('Todas');
+          }}
         >
           <option value="Todas las categorías">Todas las categorías</option>
           {filteredCategories.map((category) => (
@@ -127,36 +138,62 @@ export const FilterSidebar: React.FC<FilterSidebarProps> = ({
         </div>
       )}

-      {/* Ubicación */}
-      <div className={styles.filterSection}>
-        <label className={styles.filterLabel}>Ubicación</label>
-        <select
-          className={styles.select}
-          value={selectedProvince}
-          onChange={(e) => onProvinceChange(e.target.value)}
-        >
-          {provinces.map((province) => (
-            <option key={province} value={province}>
-              {province}
-            </option>
-          ))}
-        </select>
-      </div>
-
+      {/* Ubicación oficial de la publicación */}
+      <div className={styles.filterSection}>
+        <label className={styles.filterLabel} htmlFor="catalog-province">Provincia</label>
+        <select
+          id="catalog-province"
+          className={styles.select}
+          value={selectedProvinceId}
+          onChange={(e) => onProvinceChange(e.target.value)}
+        >
+          <option value="">Todas las provincias</option>
+          {provinces.map((province) => (
+            <option key={province.id} value={province.id}>
+              {province.name}
+            </option>
+          ))}
+        </select>
+      </div>
+
+      <div className={styles.filterSection}>
+        <label className={styles.filterLabel} htmlFor="catalog-locality">Localidad</label>
+        <select
+          id="catalog-locality"
+          className={styles.select}
+          value={selectedLocalityId}
+          onChange={(e) => onLocalityChange(e.target.value)}
+          disabled={!selectedProvinceId || isLoadingLocalities}
+        >
+          <option value="">
+            {isLoadingLocalities ? 'Cargando localidades...' : 'Todas las localidades'}
+          </option>
+          {localities.map((locality) => (
+            <option key={locality.id} value={locality.id}>
+              {locality.name}
+            </option>
+          ))}
+        </select>
+      </div>
+
       {/* Precio */}
       <div className={styles.filterSection}>
-        <label className={styles.filterLabel}>Precio</label>
-        <div className={styles.priceInputs}>
-          <input
-            type="number"
-            className={styles.priceInput}
+        <label className={styles.filterLabel} htmlFor="catalog-price-min">Precio</label>
+        <div className={styles.priceInputs}>
+          <input
+            id="catalog-price-min"
+            type="number"
+            aria-label="Precio mínimo"
+            className={styles.priceInput}
             placeholder="Mínimo"
             value={priceMin || ''}
             onChange={(e) => onPriceMinChange(Number(e.target.value) || 0)}
           />
-          <input
-            type="number"
-            className={styles.priceInput}
+          <input
+            id="catalog-price-max"
+            type="number"
+            aria-label="Precio máximo"
+            className={styles.priceInput}
             placeholder="Máximo"
             value={priceMax === Number.MAX_SAFE_INTEGER ? '' : priceMax}
             onChange={(e) => onPriceMaxChange(Number(e.target.value) || Number.MAX_SAFE_INTEGER)}
diff --git a/src/hooks/useProductFilters.ts b/src/hooks/useProductFilters.ts
index 19852ef..b6a8f57 100644
--- a/src/hooks/useProductFilters.ts
+++ b/src/hooks/useProductFilters.ts
@@ -1,4 +1,4 @@
-import { useState, useMemo } from 'react';
+import { useEffect, useMemo, useState } from 'react';
 import { Product } from '../types';

 // Función para normalizar texto (quita acentos y convierte a minúsculas)
@@ -13,16 +13,81 @@ interface UseProductFiltersProps {
   products: Product[];
 }

-export const useProductFilters = ({ products }: UseProductFiltersProps) => {
-  const [searchQuery, setSearchQuery] = useState('');
-  const [selectedType, setSelectedType] = useState<'todos' | 'productos' | 'servicios'>('todos');
-  const [selectedCategory, setSelectedCategory] = useState('Todas las categorías');
-  const [selectedSubcategory, setSelectedSubcategory] = useState('Todas');
-  const [selectedProvince, setSelectedProvince] = useState('Todas las provincias');
-  const [priceMin, setPriceMin] = useState<number>(0);
-  const [priceMax, setPriceMax] = useState<number>(Number.MAX_SAFE_INTEGER);
-  const [inStockOnly, setInStockOnly] = useState(false);
-  const [minRating, setMinRating] = useState(0);
+export const useProductFilters = ({ products }: UseProductFiltersProps) => {
+  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
+  const initialNumber = (key: string, fallback: number) => {
+    const rawValue = initialParams.get(key);
+    if (rawValue === null || rawValue === '') return fallback;
+    const parsedValue = Number(rawValue);
+    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
+  };
+
+  const [searchQuery, setSearchQuery] = useState(initialParams.get('q') || '');
+  const [selectedType, setSelectedType] = useState<'todos' | 'productos' | 'servicios'>(() => {
+    const value = initialParams.get('type');
+    return value === 'productos' || value === 'servicios' ? value : 'todos';
+  });
+  const [selectedCategory, setSelectedCategory] = useState(
+    initialParams.get('category') || 'Todas las categorías'
+  );
+  const [selectedSubcategory, setSelectedSubcategory] = useState(
+    initialParams.get('subcategory') || 'Todas'
+  );
+  const [selectedProvince, setSelectedProvince] = useState(
+    initialParams.get('province') || 'Todas las provincias'
+  );
+  const [selectedLocalityId, setSelectedLocalityId] = useState(
+    initialParams.get('locality_id') || ''
+  );
+  const [priceMin, setPriceMin] = useState<number>(() => initialNumber('min_price', 0));
+  const [priceMax, setPriceMax] = useState<number>(() =>
+    initialNumber('max_price', Number.MAX_SAFE_INTEGER)
+  );
+  const [inStockOnly, setInStockOnly] = useState(initialParams.get('in_stock') === 'true');
+  const [minRating, setMinRating] = useState(() => initialNumber('min_rating', 0));
+
+  useEffect(() => {
+    const params = new URLSearchParams(window.location.search);
+    const updateParam = (key: string, value: string | null) => {
+      if (value) params.set(key, value);
+      else params.delete(key);
+    };
+
+    updateParam('q', searchQuery || null);
+    updateParam('type', selectedType === 'todos' ? null : selectedType);
+    updateParam(
+      'category',
+      selectedCategory === 'Todas las categorías' ? null : selectedCategory
+    );
+    updateParam('subcategory', selectedSubcategory === 'Todas' ? null : selectedSubcategory);
+    updateParam(
+      'province',
+      selectedProvince === 'Todas las provincias' ? null : selectedProvince
+    );
+    updateParam('locality_id', selectedLocalityId || null);
+    updateParam('min_price', priceMin > 0 ? String(priceMin) : null);
+    updateParam(
+      'max_price',
+      priceMax === Number.MAX_SAFE_INTEGER ? null : String(priceMax)
+    );
+    updateParam('in_stock', inStockOnly ? 'true' : null);
+    updateParam('min_rating', minRating > 0 ? String(minRating) : null);
+
+    const query = params.toString();
+    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
+    window.history.replaceState(window.history.state, '', nextUrl);
+  }, [
+    searchQuery,
+    selectedType,
+    selectedCategory,
+    selectedSubcategory,
+    selectedProvince,
+    selectedLocalityId,
+    priceMin,
+    priceMax,
+    inStockOnly,
+    minRating,
+  ]);

   const filteredProducts = useMemo(() => {
     return products.filter((product) => {
@@ -46,11 +111,7 @@ export const useProductFilters = ({ products }: UseProductFiltersProps) => {
       const matchesSubcategory = selectedSubcategory === 'Todas' ||
         product.subcategory === selectedSubcategory;

-      // Filtro de provincia (normalizado para ignorar acentos)
-      const matchesProvince = selectedProvince === 'Todas las provincias' ||
-        normalizeText(product.location.province) === normalizeText(selectedProvince);
-
-      // Filtro de precio
+      // Filtro de precio
       const matchesPrice = product.price >= priceMin && product.price <= priceMax;

       // Filtro de stock
@@ -59,18 +120,19 @@ export const useProductFilters = ({ products }: UseProductFiltersProps) => {
       // Filtro de rating
       const matchesRating = product.seller.rating >= minRating;

-      return matchesSearch && matchesType && matchesCategory && matchesSubcategory &&
-             matchesProvince && matchesPrice && matchesStock && matchesRating;
-    });
-  }, [products, searchQuery, selectedType, selectedCategory, selectedSubcategory, selectedProvince,
-      priceMin, priceMax, inStockOnly, minRating]);
+      return matchesSearch && matchesType && matchesCategory && matchesSubcategory &&
+             matchesPrice && matchesStock && matchesRating;
+    });
+  }, [products, searchQuery, selectedType, selectedCategory, selectedSubcategory,
+      priceMin, priceMax, inStockOnly, minRating]);

   const resetFilters = () => {
     setSearchQuery('');
     setSelectedType('todos');
     setSelectedCategory('Todas las categorías');
-    setSelectedSubcategory('Todas');
-    setSelectedProvince('Todas las provincias');
+    setSelectedSubcategory('Todas');
+    setSelectedProvince('Todas las provincias');
+    setSelectedLocalityId('');
     setPriceMin(0);
     setPriceMax(Number.MAX_SAFE_INTEGER);
     setInStockOnly(false);
@@ -82,8 +144,9 @@ export const useProductFilters = ({ products }: UseProductFiltersProps) => {
     searchQuery,
     selectedType,
     selectedCategory,
-    selectedSubcategory,
-    selectedProvince,
+    selectedSubcategory,
+    selectedProvince,
+    selectedLocalityId,
     priceMin,
     priceMax,
     inStockOnly,
@@ -92,8 +155,9 @@ export const useProductFilters = ({ products }: UseProductFiltersProps) => {
     setSearchQuery,
     setSelectedType,
     setSelectedCategory,
-    setSelectedSubcategory,
-    setSelectedProvince,
+    setSelectedSubcategory,
+    setSelectedProvince,
+    setSelectedLocalityId,
     setPriceMin,
     setPriceMax,
     setInStockOnly,
diff --git a/src/utils/catalogService.ts b/src/utils/catalogService.ts
index 3fb491e..d71467c 100644
--- a/src/utils/catalogService.ts
+++ b/src/utils/catalogService.ts
@@ -30,7 +30,7 @@ export interface SubcategoryResponse {
   is_active: boolean;
 }

-export interface CategoryResponse {
+export interface CategoryResponse {
   id: string;
   name: string;
   slug: string;
@@ -39,9 +39,23 @@ export interface CategoryResponse {
   product_count: number;
   is_service: boolean;
   subcategories: SubcategoryResponse[];
-  created_at: string;
-}
-
+  created_at: string;
+}
+
+export interface ProvinceResponse {
+  id: string;
+  name: string;
+}
+
+export interface LocalityResponse {
+  id: string;
+  name: string;
+  province_id: string;
+  province_name: string;
+  latitude: number;
+  longitude: number;
+}
+
 export interface ProductImage {
   id: string;
   url: string;
@@ -108,17 +122,29 @@ export interface ProductListResponse {
 /**
  * Obtener categorías disponibles
  */
-export const getCategories = async (): Promise<CategoryResponse[]> => {
-  return apiGet<CategoryResponse[]>('/catalog/categories?include_empty=true');
-};
-
-/**
- * Obtener listado de productos con filtros
- */
-export const getProducts = async (params: {
-  search?: string;
-  category?: string;
-  min_price?: number;
+export const getCategories = async (): Promise<CategoryResponse[]> => {
+  return apiGet<CategoryResponse[]>('/catalog/categories?include_empty=true');
+};
+
+export const getProvinces = async (): Promise<ProvinceResponse[]> => {
+  return apiGet<ProvinceResponse[]>('/catalog/localities/provinces');
+};
+
+export const getLocalities = async (provinceId: string): Promise<LocalityResponse[]> => {
+  return apiGet<LocalityResponse[]>(
+    `/catalog/localities?province_id=${encodeURIComponent(provinceId)}`
+  );
+};
+
+/**
+ * Obtener listado de productos con filtros
+ */
+export const getProducts = async (params: {
+  search?: string;
+  category?: string;
+  province?: string;
+  locality_id?: string;
+  min_price?: number;
   max_price?: number;
   in_stock?: boolean;
   seller_id?: string;
```

Nota de verificación del bloque: el diff que produce Git tiene las mismas
cuatro rutas y `417 insertions(+), 180 deletions(-)`. No hay cambios en
`backend/` ni `docker-compose.yml`.

## Cómo lo verifiqué

### Instalación

```text
$ npm install
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 202 packages, and audited 203 packages in 4s

42 packages are looking for funding
  run `npm fund` for details

16 vulnerabilities (1 low, 2 moderate, 13 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

### Build

```text
$ npm run build
> tsc && vite build
vite v5.4.21 building for production...
transforming...
✓ 78 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.97 kB │ gzip:   0.51 kB
dist/assets/index-DgJ3Nz_2.css  129.06 kB │ gzip:  23.24 kB
dist/assets/index-D7-7yRLC.js   348.42 kB │ gzip: 103.46 kB
✓ built in 1.77s
```

### ESLint de los archivos tocados

```text
$ npx eslint src/App.tsx src/components/FilterSidebar/FilterSidebar.tsx src/hooks/useProductFilters.ts src/utils/catalogService.ts
ESLint: No issues found
```

### ESLint completo

El lint global no queda verde por deuda previa fuera de las cuatro rutas
tocadas:

```text
$ npm run lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/components/AdminPanel/AdminPanel.tsx
  180:6   warning  React Hook useEffect has missing dependencies: 'loadCategories', 'loadFormOptions', and 'loadUsers'. Either include them or remove the dependency array  react-hooks/exhaustive-deps
  471:21  error    Unexpected any. Specify a different type                                                                                                                 @typescript-eslint/no-explicit-any
  685:88  error    Unexpected any. Specify a different type                                                                                                                 @typescript-eslint/no-explicit-any
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/components/Checkout/CheckoutModal.tsx
  380:29  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  411:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  417:47  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/components/Pages/HomePage.tsx
  14:99  error  '_onNavigateToContact' is defined but never used  @typescript-eslint/no-unused-vars
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/components/Toast/Toast.tsx
  28:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/components/UserDashboard/UserDashboard.tsx
  339:11  error    Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')
  400:6   warning  React Hook useEffect has a missing dependency: 'showToast'. Either include it or remove the dependency array                              react-hooks/exhaustive-deps
  433:6   warning  React Hook useEffect has a missing dependency: 'editingProduct'. Either include it or remove the dependency array                         react-hooks/exhaustive-deps
  433:7   warning  React Hook useEffect has a complex expression in the dependency array. Extract it to a separate variable so it can be statically checked  react-hooks/exhaustive-deps
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/contexts/AuthContext.tsx
  7:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/contexts/CartContext.tsx
  7:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/contexts/ThemeContext.tsx
  71:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
/Users/Emi/.codex/.chatgpt-projects/g-p-6a5c0432126c8191875cf0ffeeed7118/yneratopgreen/src/utils/api.ts
   89:36  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  152:28  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  158:29  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  158:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  167:28  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  167:57  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  176:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  176:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  185:31  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  191:31  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
✖ 25 problems (17 errors, 8 warnings)
  1 error and 0 warnings potentially fixable with the `--fix` option.
```

### Whitespace y alcance

```text
$ git -c core.whitespace=blank-at-eof,space-before-tab,cr-at-eol diff --check
(sin salida)

$ git diff --exit-code -- backend docker-compose.yml
(sin salida; exit 0)
```

### Servidor de desarrollo

Ejecuté:

```text
$ npm run dev -- --host 127.0.0.1
```

El proceso quedó activo en `http://127.0.0.1:5173/`; `rtk` no emitió el banner
de Vite mientras la sesión estaba viva. Se comprobó la aplicación en esa URL
con el navegador y al terminar se detuvo manualmente:

```text
^C
Process exited with code 1
```

Backend usado: `http://127.0.0.1:8000/api`. Reutilicé los contenedores locales
ya saludables. Verifiqué antes que `backend/app/api/catalog.py` era idéntico
entre este clon y el checkout que levantó esos contenedores
(`f9f8cb597bd6e84b0f0d23fb2f7420b28b3ec066`, SHA-1).

### Contraste con PostgreSQL

Consulta exacta:

```text
$ docker exec topgreen-db psql -U topgreen -d topgreen -P pager=off -c "SELECT l.province_name, COUNT(*) AS active_products FROM products p JOIN localities l ON l.id = p.locality_id WHERE p.status = 'ACTIVE' GROUP BY l.province_name ORDER BY l.province_name; SELECT l.name, l.province_name, COUNT(*) AS active_products FROM products p JOIN localities l ON l.id = p.locality_id WHERE p.status = 'ACTIVE' AND l.id = '06063010' GROUP BY l.name, l.province_name; SELECT c.name AS category, COUNT(*) AS active_products FROM products p JOIN localities l ON l.id = p.locality_id JOIN categories c ON c.id = p.category_id WHERE p.status = 'ACTIVE' AND l.id = '06063010' AND c.name = 'Herramientas' GROUP BY c.name;"
 province_name | active_products
---------------+-----------------
 Buenos Aires  |               6
 Córdoba       |               3
 Santa Fe      |               3
(3 rows)

   name   | province_name | active_products
----------+---------------+-----------------
 Balcarce | Buenos Aires  |               2
(1 row)

   category   | active_products
--------------+-----------------
 Herramientas |               1
(1 row)
```

### Los seis puntos del criterio, uno por uno

| # | Prueba en navegador | Resultado |
|---:|---|---|
| 1 | Sin filtro / Buenos Aires / Córdoba / Santa Fe | UI: **12 / 6 / 3 / 3**. La DB devuelve exactamente **6 / 3 / 3**. El esperado 12 / 4 / 2 / 2 no se sostiene: además 4+2+2 suma 8, no 12. |
| 2 | Buenos Aires + Balcarce | UI: **2 productos**. URL: `?section=marketplace&province=Buenos+Aires&locality_id=06063010`. DB: **2**. |
| 3 | Ubicación + categoría; además precio y stock | BA + Balcarce + Herramientas: UI **1**, DB **1**. BA + Tecnología para el Cultivo + máximo 1.000.000 + stock: UI **1**. URL conservó `province`, `category`, `max_price` e `in_stock=true`. |
| 4 | Recarga | Tras recargar BA + Balcarce: provincia `06`, localidad `06063010`, resultado **2** y misma URL. También recargué la combinación BA + Tecnología + precio + stock: todos los valores siguieron seleccionados y el resultado siguió en **1**. |
| 5 | Cambiar provincia limpia localidad | Desde BA + Balcarce + Herramientas cambié a Córdoba: localidad quedó `""`, Balcarce desapareció de las opciones, el resultado fue **1** y la URL ya no contenía `locality_id`; categoría siguió activa. |
| 6 | Errores de consola | Consola final filtrada por `level === "error"`: `[]`. |

## Qué NO corrí

- No hice `docker compose down -v` ni un init limpio: esta tarea prohíbe
  backend/esquema y ya había contenedores saludables con código de catálogo
  idéntico. Sí corrí la UI contra API y DB reales.
- No ejecuté la suite completa de smoke tests de compra/venta/admin; no forma
  parte de esta tarea. La prueba solicitada fue el catálogo en navegador.
- No probé todos los 4.028 registros del padrón uno por uno.
- No corregí los 25 hallazgos del lint global porque están fuera de los cuatro
  archivos de esta tarea.
- No ejecuté `npm audit fix` ni actualicé dependencias.

## Errores encontrados

### 1. Criterio de cantidades desactualizado

- Esperado escrito: BA 4, Córdoba 2, Santa Fe 2, total 12.
- Resultado exacto: BA 6, Córdoba 3, Santa Fe 3, total 12.
- Causa: el seed actual crea 12 productos y les asigna localidades 6/3/3.
- Solución propuesta: corregir el criterio/documento a 6/3/3 o cambiar el seed
  en una tarea explícita. No conviene falsear el filtro.

### 2. Lint global rojo

- Mensaje exacto final:
  `✖ 25 problems (17 errors, 8 warnings)`.
- Causa: deuda previa en AdminPanel, Checkout, HomePage, UserDashboard,
  contextos y `src/utils/api.ts`.
- Solución propuesta: tarea separada de saneamiento. Los cuatro archivos
  modificados pasan ESLint aislado.

### 3. Clon fresco sin `.env`

En la primera apertura del frontend aparecieron:

```text
Error al cargar filtros del catálogo: Error: Internal Server Error
Error al cargar productos: Error: Internal Server Error
```

Causa: el clon no tenía `.env`; el proxy fallback de Vite apuntaba al puerto
80. Creé un `.env` local ignorado por Git con:
`VITE_API_URL=http://localhost:8000/api` y
`VITE_IMAGES_URL=http://localhost:8000`. No contiene secretos ni se publicó.
Tras reiniciar, la consola final quedó en `[]`.

### 4. Acceso a Docker dentro del sandbox

Primer intento exacto:

```text
permission denied while trying to connect to the Docker daemon socket at unix:///Users/Emi/.docker/run/docker.sock: Get "http://%2FUsers%2FEmi%2F.docker%2Frun%2Fdocker.sock/v1.49/containers/topgreen-db/json": dial unix /Users/Emi/.docker/run/docker.sock: connect: operation not permitted
```

Causa: aislamiento local, no la aplicación. Repetí sólo la consulta de lectura
con permiso de Docker y produjo la salida SQL incluida arriba.

### 5. Rama remota concurrente

Primer push exacto:

```text
To https://github.com/Memu007/yneratopgreen
 ! [rejected]        dev/filtro-ubicacion-frontend -> dev/filtro-ubicacion-frontend (fetch first)
error: failed to push some refs to 'https://github.com/Memu007/yneratopgreen'
hint: Updates were rejected because the remote contains work that you do
hint: not have locally. This is usually caused by another repository pushing
hint: to the same ref. You may want to first integrate the remote changes
hint: (e.g., 'git pull ...') before pushing again.
hint: See the 'Note about fast-forwards' in 'git push --help' for details.
```

La rama remota había recibido en paralelo otra implementación de las mismas
cuatro rutas. La traje, confirmé que no contenía archivos de otro alcance y
conservé su historial con un merge sin force-push. La implementación final es
la que documenta este informe y la que probé en navegador.

Push de código:

```text
To https://github.com/Memu007/yneratopgreen
   7dca7c0..642912f  dev/filtro-ubicacion-frontend -> dev/filtro-ubicacion-frontend
branch 'dev/filtro-ubicacion-frontend' set up to track 'origin/dev/filtro-ubicacion-frontend'.
ok dev/filtro-ubicacion-frontend
```

## Commit

- Rama: `dev/filtro-ubicacion-frontend`
- Commit de código: `5de5b33e037a9364f8700eabb0bbfd405435b8a3`
- Commit de integración publicado:
  `642912f27b42654f306061146836d8e7cb5903ce`
- Push de código: confirmado.
- El hash del commit de este informe se agrega en el aviso final, después de
  pushearlo, porque el propio commit todavía no existe al escribir el archivo.

## Observaciones adversariales

1. El criterio 4/2/2 es imposible junto con “12 sin filtro” si esas son las
   únicas provincias: suma 8. El código no debe adaptarse a una expectativa
   aritméticamente inconsistente.
2. `ProductGrid` muestra `1 productos encontrados`; es una deuda cosmética de
   pluralización preexistente. No la toqué porque no afecta el filtro.
3. El frontend filtraba provincia con `product.location.province`, pero ese
   campo representa ubicación derivada del vendedor en el modelo de UI. El
   filtro nuevo se hace en backend sobre `products.locality_id`, que es la
   fuente correcta.
4. La paginación solicita 100 registros y algunos filtros preexistentes siguen
   aplicándose en cliente. Para el seed actual es suficiente; con más de 100
   productos, tipo/subcategoría/rating podrían ofrecer totales incompletos.
   Categoría, precio, stock y ubicación ya se envían al backend en esta
   implementación.
5. Las dependencias reportan 16 vulnerabilidades, 13 altas. No corrí
   `npm audit fix --force` porque puede introducir cambios mayores fuera de
   alcance.
