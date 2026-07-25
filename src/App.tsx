import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { useAuth } from './contexts/AuthContext';
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
import { useProductFilters } from './hooks/useProductFilters';
import { getProducts, getCategories, convertBackendProductToFrontend } from './utils/catalogService';
import type { NewProductData, Product } from './types';
import type { CategoryResponse } from './utils/catalogService';

type AuthModalType = 'login' | 'register' | null;
type PageSection = 'home' | 'marketplace' | 'about' | 'services' | 'contact' | 'payment-success' | 'payment-failure' | 'payment-pending';

function App() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const productsRequestId = useRef(0);
  
  const {
    searchQuery,
    selectedType,
    selectedCategory,
    selectedSubcategory,
    selectedProvince,
    selectedLocality,
    priceMin,
    priceMax,
    inStockOnly,
    minRating,
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
    if (path === '/payment/success') return 'payment-success';
    if (path === '/payment/failure') return 'payment-failure';
    if (path === '/payment/pending') return 'payment-pending';

    // Un enlace compartido con filtros debe abrir directamente el catálogo.
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('province') || searchParams.has('locality_id')) {
      return 'marketplace';
    }

    return 'home';
  });

  const loadCategoriesFromAPI = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      setCategories([]);
    }
  }, []);

  const loadProductsFromAPI = useCallback(async () => {
    const requestId = ++productsRequestId.current;
    setLoadingProducts(true);

    try {
      const response = await getProducts({
        province: selectedProvince || undefined,
        locality_id: selectedLocality || undefined,
        page: 1,
        page_size: 100,
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      
      if (requestId === productsRequestId.current) {
        const frontendProducts = response.items.map(convertBackendProductToFrontend);
        setProducts(frontendProducts);
      }
    } catch (error) {
      if (requestId === productsRequestId.current) {
        console.error('Error al cargar productos:', error);
        // En caso de error, mantener array vacío
        setProducts([]);
      }
    } finally {
      if (requestId === productsRequestId.current) {
        setLoadingProducts(false);
      }
    }
  }, [selectedLocality, selectedProvince]);

  // Cargar categorías cuando se navega al marketplace.
  useEffect(() => {
    if (currentSection === 'marketplace') {
      void loadCategoriesFromAPI();
    }
  }, [currentSection, loadCategoriesFromAPI]);

  // La ubicación se filtra en la API; el resto de los filtros se combina localmente.
  useEffect(() => {
    if (currentSection === 'marketplace') {
      void loadProductsFromAPI();
    }
  }, [currentSection, loadProductsFromAPI]);

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
    // Esperar un momento para que el useEffect se ejecute
    setTimeout(() => {
      void loadProductsFromAPI();
    }, 100);
  };

  const handleNavigate = (section: PageSection) => {
    setCurrentSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      case 'marketplace':
        return (
          <main className={styles.mainContent}>
            <div className={styles.contentWrapper}>
              <FilterSidebar
                categories={categories}
                selectedType={selectedType}
                selectedCategory={selectedCategory}
                selectedSubcategory={selectedSubcategory}
                selectedProvince={selectedProvince}
                selectedLocality={selectedLocality}
                priceMin={priceMin}
                priceMax={priceMax}
                inStockOnly={inStockOnly}
                minRating={minRating}
                onTypeChange={setSelectedType}
                onCategoryChange={setSelectedCategory}
                onSubcategoryChange={setSelectedSubcategory}
                onProvinceChange={setSelectedProvince}
                onLocalityChange={setSelectedLocality}
                onPriceMinChange={setPriceMin}
                onPriceMaxChange={setPriceMax}
                onInStockChange={setInStockOnly}
                onMinRatingChange={setMinRating}
                onResetFilters={resetFilters}
              />
              <ProductGrid products={filteredProducts} isLoading={loadingProducts} />
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
