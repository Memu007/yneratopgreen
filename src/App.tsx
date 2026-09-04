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
import { useVistaPrevia } from './hooks/useVistaPrevia';
import {
  getProducts,
  getCategories,
  getLocalities,
  getProvinces,
  convertBackendProductToFrontend,
} from './utils/catalogService';
import { ContextoDeNavegacion, useNavegacion } from './navegacion/navegacion';
import type { Seccion } from './navegacion/politica';
import type { NewProductData, Product } from './types';
import type {
  CategoryResponse,
  LocalityResponse,
  ProvinceResponse,
} from './utils/catalogService';

type AuthModalType = 'login' | 'register' | null;
// La lista de secciones vive en la política de navegación y no acá: el tipo
// que se usa en las pantallas y el que se lee de la barra tienen que ser uno.
type PageSection = Seccion;

function App() {
  const { user } = useAuth();
  // La única navegación del producto: qué sección declara la barra, qué capa
  // hay abierta encima y cómo se escribe el historial. Nadie más lo toca.
  const navegacion = useNavegacion();
  const currentSection = navegacion.seccion;
  const handleNavigate = navegacion.navegar;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [provinces, setProvinces] = useState<ProvinceResponse[]>([]);
  const [localities, setLocalities] = useState<LocalityResponse[]>([]);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsRevision, setProductsRevision] = useState(0);
  // Cuántas publicaciones hay para esta consulta, según la API. No es lo
  // mismo que cuántas bajaron: la página trae como máximo cien, y contar las
  // que llegaron es contar la página, no el mercado.
  const [totalDeCatalogo, setTotalDeCatalogo] = useState<number | null>(null);
  // Qué decir cuando el mercado no carga. Sin esto, una falla de red terminaba
  // en la lista vacía y el cartel «No hay operaciones con estos filtros», que
  // es mentira: no es que no haya, es que no pudimos preguntar.
  const [errorDeCatalogo, setErrorDeCatalogo] = useState<string | null>(null);
  
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
  } = useProductFilters({
    products,
    escribeEnLaBarra: currentSection === 'marketplace',
    versionDeLaBarra: navegacion.version,
  });

  const [authModal, setAuthModal] = useState<AuthModalType>(null);
  // Adónde volver cuando el Login se cierre, se complete o se cancele. Lo usa
  // el detalle de una publicación: sin sesión ofrece ingresar, se aparta
  // mientras el Login está arriba y vuelve a abrirse después con la misma
  // publicación. Se guarda envuelta en otra función porque `useState` trata a
  // una función como actualizador y la llamaría en vez de guardarla.
  const [volverDespuesDeIngresar, setVolverDespuesDeIngresar] =
    useState<(() => void) | null>(null);

  const abrirLoginYVolver = (alVolver: () => void) => {
    setVolverDespuesDeIngresar(() => alVolver);
    setAuthModal('login');
  };

  // Ingresar desde la cabecera, o desde cualquier lado que no sea una
  // publicación, no arrastra ninguna continuidad. Es explícito a propósito:
  // un callback que quedó de un ingreso anterior reabriría una publicación
  // que la persona ya dejó atrás.
  const abrirLogin = () => {
    setVolverDespuesDeIngresar(null);
    setAuthModal('login');
  };

  const cerrarAutenticacion = () => {
    setAuthModal(null);
    if (volverDespuesDeIngresar) {
      const volver = volverDespuesDeIngresar;
      setVolverDespuesDeIngresar(null);
      volver();
    }
  };
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const selectedProvinceId =
    provinces.find((province) => province.name === selectedProvince)?.id || '';

  // Las vistas previas de Inicio y de Servicios salen del mismo catalogo que el
  // mercado, con el mismo orden, y se piden solo cuando su pantalla esta a la
  // vista. Viven aca y no adentro de cada pagina para no competir con la carga
  // del mercado ni duplicar el estado de red.
  const vistaPreviaDeInicio = useVistaPrevia({
    activa: currentSection === 'home',
    mensajeDeError: 'No pudimos cargar las operaciones.',
  });
  const vistaPreviaDeServicios = useVistaPrevia({
    activa: currentSection === 'services',
    soloServicios: true,
    mensajeDeError: 'No pudimos cargar los servicios.',
  });

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
    setErrorDeCatalogo(null);
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
        // El tipo de operacion viaja a la consulta, no se filtra despues.
        //
        // La pagina baja como maximo cien publicaciones. Con el filtro del
        // lado del navegador, pedir «servicios» miraba las cien mas nuevas y
        // se quedaba con las que fueran servicio: si ninguna lo era, el
        // mercado decia que no hay, aunque hubiera doscientas mas atras.
        publication_type:
          selectedType === 'productos' ? 'producto'
            : selectedType === 'servicios' ? 'servicio'
              : undefined,
        page: 1,
        page_size: 100,
        sort_by: 'created_at',
        sort_order: 'desc',
      })
      .then((response) => {
        if (cancelled) return;
        setProducts(response.items.map(convertBackendProductToFrontend));
        setTotalDeCatalogo(response.total);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error al cargar productos:', error);
        setProducts([]);
        setTotalDeCatalogo(null);
        // Dos fallas distintas, y conviene no confundirlas: quedarse sin red es
        // algo que la persona puede resolver, y que se lo cuenten es lo que le
        // permite hacerlo. Que el servidor falle no es asunto suyo. El resto de
        // los errores conserva el mensaje general a propósito: inventar un
        // «sin conexión» donde hay conexión manda a revisar el módem por nada.
        const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false;
        setErrorDeCatalogo(
          sinRed
            ? 'Sin conexión. Revisá tu red e intentá de nuevo.'
            : 'No pudimos cargar el mercado. Volvé a intentarlo en un momento.',
        );
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
    // `selectedType` es dependencia de verdad desde que viaja a la consulta:
    // sin esto, cambiar de productos a servicios no volvia a pedir nada.
    selectedType,
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

  // El conteo visible sale del total de la API. Dos filtros no viajan a la
  // consulta —subcategoría y calificación mínima del vendedor— y los aplica
  // el navegador sobre la página descargada; mientras no descarten ninguna
  // fila, el total de la API sigue describiendo lo que se está mirando. En
  // cuanto descartan alguna, deja de describirlo y lo honesto es contar lo
  // que quedó. La deuda de paginación mayor a cien sigue abierta y está en
  // `docs/pm/ux2c/DEUDA-PAGINACION.md`.
  const elNavegadorDescarto = filteredProducts.length !== products.length;
  const totalDeResultados = totalDeCatalogo !== null && !elNavegadorDescarto
    ? totalDeCatalogo
    : filteredProducts.length;

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
    handleNavigate('marketplace');
    setProductsRevision((revision) => revision + 1);
  };

  // Ir al mercado con el filtro de servicios puesto.
  //
  // Escribir `type=servicios` en la URL no alcanza: el hook de filtros ya esta
  // montado y lee su estado, no la barra de direcciones. Se fija el estado y
  // recien despues se navega.
  const verServiciosPublicados = () => {
    setSelectedType('servicios');
    handleNavigate('marketplace');
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
          onLoginClick={abrirLogin}
          onSolicitarIngreso={abrirLoginYVolver}
          vistaPrevia={vistaPreviaDeInicio}
        />;
      case 'verificar-correo':
        return (
          <VerifyEmailPage
            onGoToLogin={() => {
              handleNavigate('home');
              abrirLogin();
            }}
            onGoHome={() => handleNavigate('home')}
          />
        );
      case 'marketplace':
        return (
          <main className={styles.mainContent}>
            {/* El mercado abre con resultados y no con una portada: la banda
                de presentación desaparece porque el destino ya está dicho en
                la celda activa de la cabecera y el conteo lo confirma. El
                encabezado de nivel 1 se queda: sacarlo dejaría la pantalla sin
                título en el árbol del documento. */}
            <h1 className="tg-sr-only">Operaciones disponibles</h1>
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
                total={totalDeResultados}
                isLoading={loadingProducts}
                error={errorDeCatalogo}
                onReintentar={() => setProductsRevision((intento) => intento + 1)}
                onSolicitarCotizacion={() => handleNavigate('contact')}
                onSolicitarIngreso={abrirLoginYVolver}
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
            onOpenLogin={abrirLogin}
            onNavigateToContact={() => handleNavigate('contact')}
          />
        );
      case 'services':
        return (
          <ServicesPage
            onNavigateToContact={() => handleNavigate('contact')}
            onVerServiciosPublicados={verServiciosPublicados}
            onPublishClick={() => setIsAddProductOpen(true)}
            onLoginClick={abrirLogin}
            onSolicitarIngreso={abrirLoginYVolver}
            vistaPrevia={vistaPreviaDeServicios}
          />
        );
      case 'contact':
        return <ContactPage />;
      case 'payment-success':
        return (
          <PaymentResultPage 
            status="success" 
            onGoToOrders={() => handleNavigate('marketplace')} 
            onGoHome={() => handleNavigate('home')}
          />
        );
      case 'payment-failure':
        return (
          <PaymentResultPage 
            status="failure" 
            onGoToOrders={() => handleNavigate('marketplace')} 
            onGoHome={() => handleNavigate('home')}
          />
        );
      case 'payment-pending':
        return (
          <PaymentResultPage 
            status="pending" 
            onGoToOrders={() => handleNavigate('marketplace')} 
            onGoHome={() => handleNavigate('home')}
          />
        );
      default:
        return <HomePage 
          onNavigateToMarketplace={() => handleNavigate('marketplace')}
          onNavigateToContact={() => handleNavigate('contact')}
          onPublishClick={() => setIsAddProductOpen(true)}
          onLoginClick={abrirLogin}
          onSolicitarIngreso={abrirLoginYVolver}
          vistaPrevia={vistaPreviaDeInicio}
        />;
    }
  };

  // Una sola política de navegación para todo el árbol: la tarjeta de una
  // publicación abre y cierra su detalle por acá, sin escuchar el historial
  // por su cuenta.
  return (
    <ContextoDeNavegacion.Provider value={navegacion}>
      <div className={styles.app}>
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          onLoginClick={abrirLogin}
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
            onClose={cerrarAutenticacion}
            onSwitchToRegister={() => setAuthModal('register')}
          />
        )}

        {/* Saltar entre Login y Registro es el mismo trámite: la continuidad se
            conserva, así que estos dos NO usan `abrirLogin`/`abrirRegistro`, que
            la borran. */}
        {authModal === 'register' && (
          <RegisterModal
            onClose={cerrarAutenticacion}
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
    </ContextoDeNavegacion.Provider>
  );
}

export default App;
