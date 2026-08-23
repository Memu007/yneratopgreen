import { useState, useEffect } from 'react';
import styles from './App.module.css';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { useAuth } from './hooks/useAuth';
import { FilterSidebar } from './components/FilterSidebar/FilterSidebar';
import { ProductGrid } from './components/ProductGrid/ProductGrid';
import { LoginModal } from './components/Auth/LoginModal';
import { RegisterModal } from './components/Auth/RegisterModal';
import { CartModal } from './components/Cart/CartModal';
import { CheckoutModal } from './components/Checkout/CheckoutModal';
import { AddProductModal } from './components/AddProduct/AddProductModal';
import { AdminPanel } from './components/AdminPanel/AdminPanel';
import { HomePage } from './components/Pages/HomePage';
import { AboutPage } from './components/Pages/AboutPage';
import { ServicesPage } from './components/Pages/ServicesPage';
import { ContactPage } from './components/Pages/ContactPage';
import { PaymentResultPage } from './components/Pages/PaymentResultPage';
import { VerifyEmailPage } from './components/Pages/VerifyEmailPage';
import { useProductFilters } from './hooks/useProductFilters';
import {
  getProducts,
  getCategories,
  getLocalities,
  getProvinces,
  convertBackendProductToFrontend,
} from './utils/catalogService';
import type { NewProductData, Product } from './types';
import type {
  CategoryResponse,
  LocalityResponse,
  ProvinceResponse,
} from './utils/catalogService';

type AuthModalType = 'login' | 'register' | null;
type PageSection = 'home' | 'marketplace' | 'about' | 'services' | 'contact' | 'payment-success' | 'payment-failure' | 'payment-pending' | 'verificar-correo';

function App() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [provinces, setProvinces] = useState<ProvinceResponse[]>([]);
  const [localities, setLocalities] = useState<LocalityResponse[]>([]);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsRevision, setProductsRevision] = useState(0);
  
  const {
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
    filteredProducts,
    resetFilters,
  } = useProductFilters({ products });

  const [authModal, setAuthModal] = useState<AuthModalType>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<PageSection>(() => {
    // Detectar rutas de pago desde URL al cargar
    const path = window.location.pathname;
    // El enlace del correo de confirmación entra por acá.
    if (path === '/verificar-correo') return 'verificar-correo';
    if (path === '/payment/success') return 'payment-success';
    if (path === '/payment/failure') return 'payment-failure';
    if (path === '/payment/pending') return 'payment-pending';
    if (new URLSearchParams(window.location.search).get('section') === 'marketplace') {
      return 'marketplace';
    }
    return 'home';
  });

  const selectedProvinceId =
    provinces.find((province) => province.name === selectedProvince)?.id || '';

  // Cargar catálogos auxiliares al entrar al marketplace.
  useEffect(() => {
    if (currentSection !== 'marketplace') return;

    let cancelled = false;
    Promise.all([getCategories(), getProvinces()])
      .then(([categoryData, provinceData]) => {
        if (cancelled) return;
        setCategories(categoryData);
        setProvinces(provinceData);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error al cargar filtros del catálogo:', error);
        setCategories([]);
        setProvinces([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSection]);

  // Cargar las localidades con el ID corto de provincia.
  useEffect(() => {
    if (currentSection !== 'marketplace' || !selectedProvinceId) {
      setLocalities([]);
      setIsLoadingLocalities(false);
      return;
    }

    let cancelled = false;
    setLocalities([]);
    setIsLoadingLocalities(true);
    getLocalities(selectedProvinceId)
      .then((data) => {
        if (!cancelled) setLocalities(data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error al cargar localidades:', error);
        setLocalities([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLocalities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSection, selectedProvinceId]);

  // Filtrar en la API para usar la ubicación real de la publicación.
  useEffect(() => {
    if (currentSection !== 'marketplace') return;
    if (selectedProvince !== 'Todas las provincias' && !selectedProvinceId) return;
    if (
      selectedCategory !== 'Todas las categorías'
      && !categories.some((category) => category.name === selectedCategory)
    ) {
      return;
    }

    let cancelled = false;
    setLoadingProducts(true);
    getProducts({
        search: searchQuery || undefined,
        category: categories.find((category) => category.name === selectedCategory)?.id,
        province:
          selectedProvince === 'Todas las provincias' ? undefined : selectedProvince,
        locality_id: selectedLocalityId || undefined,
        min_price: priceMin > 0 ? priceMin : undefined,
        max_price:
          priceMax === Number.MAX_SAFE_INTEGER ? undefined : priceMax,
        in_stock: inStockOnly || undefined,
        page: 1,
        page_size: 100,
        sort_by: 'created_at',
        sort_order: 'desc',
      })
      .then((response) => {
        if (cancelled) return;
        setProducts(response.items.map(convertBackendProductToFrontend));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error al cargar productos:', error);
        setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentSection,
    searchQuery,
    selectedCategory,
    selectedProvince,
    selectedProvinceId,
    selectedLocalityId,
    priceMin,
    priceMax,
    inStockOnly,
    categories,
    productsRevision,
  ]);

  const handleSearchSubmit = () => {
    console.log('Búsqueda realizada:', searchQuery);
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleAddProduct = (productData: NewProductData) => {
    console.log('Nuevo producto agregado:', productData);
    // Navegar al marketplace y recargar productos
    setCurrentSection('marketplace');
    setProductsRevision((revision) => revision + 1);
  };

  const handleNavigate = (section: PageSection) => {
    const params = new URLSearchParams(window.location.search);
    if (section === 'marketplace') params.set('section', 'marketplace');
    else params.delete('section');
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    );
    setCurrentSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProvinceChange = (provinceId: string) => {
    const province = provinces.find((item) => item.id === provinceId);
    setSelectedProvince(province?.name || 'Todas las provincias');
    setSelectedLocalityId('');
  };

  const renderContent = () => {
    switch (currentSection) {
      case 'home':
        return <HomePage 
          onNavigateToMarketplace={() => handleNavigate('marketplace')} 
          onNavigateToContact={() => handleNavigate('contact')}
          onNavigateToServices={() => handleNavigate('services')}
          onPublishClick={() => setIsAddProductOpen(true)}
          onLoginClick={() => setAuthModal('login')}
        />;
      case 'verificar-correo':
        return (
          <VerifyEmailPage
            onGoToLogin={() => {
              handleNavigate('home');
              setAuthModal('login');
            }}
            onGoHome={() => handleNavigate('home')}
          />
        );
      case 'marketplace':
        return (
          <main className={styles.mainContent}>
            <section className={`tg-container ${styles.presentacion}`} aria-labelledby="titulo-mercado">
              <div>
                <div className="tg-eyebrow">Mercado agro</div>
                <h1 id="titulo-mercado">Operaciones disponibles</h1>
              </div>
              <p className="tg-lead">
                Productos, servicios y logística con precio o modalidad, ubicación,
                responsable y próximo paso.
              </p>
            </section>
            <div className={styles.contentWrapper}>
              <FilterSidebar
                categories={categories}
                provinces={provinces}
                localities={localities}
                isLoadingLocalities={isLoadingLocalities}
                selectedType={selectedType}
                selectedCategory={selectedCategory}
                selectedSubcategory={selectedSubcategory}
                selectedProvinceId={selectedProvinceId}
                selectedLocalityId={selectedLocalityId}
                priceMin={priceMin}
                priceMax={priceMax}
                inStockOnly={inStockOnly}
                minRating={minRating}
                onTypeChange={setSelectedType}
                onCategoryChange={setSelectedCategory}
                onSubcategoryChange={setSelectedSubcategory}
                onProvinceChange={handleProvinceChange}
                onLocalityChange={setSelectedLocalityId}
                onPriceMinChange={setPriceMin}
                onPriceMaxChange={setPriceMax}
                onInStockChange={setInStockOnly}
                onMinRatingChange={setMinRating}
                onResetFilters={resetFilters}
                cantidadDeResultados={filteredProducts.length}
              />
              <ProductGrid
                products={filteredProducts}
                isLoading={loadingProducts}
                onSolicitarCotizacion={() => handleNavigate('contact')}
              />
            </div>
          </main>
        );
      case 'about':
        return (
          <AboutPage 
            onNavigateToMarketplace={() => handleNavigate('marketplace')}
            onOpenSellModal={() => setIsAddProductOpen(true)}
            isLoggedIn={!!user}
            onOpenLogin={() => setAuthModal('login')}
            onNavigateToContact={() => handleNavigate('contact')}
          />
        );
      case 'services':
        return <ServicesPage onNavigateToContact={() => handleNavigate('contact')} />;
      case 'contact':
        return <ContactPage />;
      case 'payment-success':
        return (
          <PaymentResultPage 
            status="success" 
            onGoToOrders={() => handleNavigate('marketplace')} 
            onGoHome={() => {
              window.history.pushState({}, '', '/');
              handleNavigate('home');
            }} 
          />
        );
      case 'payment-failure':
        return (
          <PaymentResultPage 
            status="failure" 
            onGoToOrders={() => handleNavigate('marketplace')} 
            onGoHome={() => {
              window.history.pushState({}, '', '/');
              handleNavigate('home');
            }} 
          />
        );
      case 'payment-pending':
        return (
          <PaymentResultPage 
            status="pending" 
            onGoToOrders={() => handleNavigate('marketplace')} 
            onGoHome={() => {
              window.history.pushState({}, '', '/');
              handleNavigate('home');
            }} 
          />
        );
      default:
        return <HomePage 
          onNavigateToMarketplace={() => handleNavigate('marketplace')}
          onNavigateToContact={() => handleNavigate('contact')}
          onPublishClick={() => setIsAddProductOpen(true)}
        />;
    }
  };

  return (
    <div className={styles.app}>
      <Header 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onLoginClick={() => setAuthModal('login')}
        onCartClick={() => setIsCartOpen(true)}
        onSellClick={() => setIsAddProductOpen(true)}
        onAdminClick={() => setIsAdminPanelOpen(true)}
        currentSection={currentSection}
        onNavigate={handleNavigate}
      />

      {renderContent()}

      <Footer onNavigate={(section) => handleNavigate(section as PageSection)} />

      {/* Modales de autenticación */}
      {authModal === 'login' && (
        <LoginModal
          onClose={() => setAuthModal(null)}
          onSwitchToRegister={() => setAuthModal('register')}
        />
      )}

      {authModal === 'register' && (
        <RegisterModal
          onClose={() => setAuthModal(null)}
          onSwitchToLogin={() => setAuthModal('login')}
        />
      )}

      {/* Modal del carrito */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />

      {/* Modal de Checkout */}
      {isCheckoutOpen && (
        <CheckoutModal onClose={() => setIsCheckoutOpen(false)} />
      )}

      {/* Modal para agregar producto */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSubmit={handleAddProduct}
      />

      {/* Panel de Administración - solo visible para admins */}
      {isAdminPanelOpen && user?.role === 'admin' && (
        <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />
      )}
    </div>
  );
}

export default App;
