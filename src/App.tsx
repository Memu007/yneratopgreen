import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './App.module.css';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { UserDashboard } from './components/UserDashboard/UserDashboard';
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
import { asegurarSesion, tokenStorage } from './utils/api';
import { ContextoDeNavegacion, useNavegacion } from './navegacion/navegacion';
import type { Seccion } from './navegacion/politica';
import type { NewProductData, Product, CotizacionPedida } from './types';
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
  const { user, isAuthenticated } = useAuth();
  // La única navegación del producto: qué sección declara la barra, qué capa
  // hay abierta encima y cómo se escribe el historial. Nadie más lo toca.
  const navegacion = useNavegacion();
  const currentSection = navegacion.seccion;
  /**
   * La cotización que se está pidiendo, si se llegó a Contacto desde una
   * publicación.
   *
   * Vive acá porque es de la navegación, no de Contacto: dura lo que dura el
   * viaje desde la tarjeta o el detalle hasta la pantalla, y se pierde en
   * cuanto se entra a Contacto por cualquier otro lado. No se guarda en el
   * navegador a propósito —recargar Contacto no tiene por qué revivir una
   * consulta de otro momento— y por eso tampoco viaja en la URL.
   */
  const [cotizacionPedida, setCotizacionPedida] = useState<CotizacionPedida | null>(null);

  /**
   * Navegar. Entrar a Contacto por la cabecera, el pie o cualquier llamada
   * común limpia la cotización: si no, una consulta genérica heredaría el
   * asunto y el mensaje de la publicación que alguien miró hace diez minutos.
   */
  const handleNavigate = useCallback((destino: Seccion) => {
    if (destino === 'contact') setCotizacionPedida(null);
    navegacion.navegar(destino);
  }, [navegacion]);

  /**
   * Pedir una cotización: deja la intención y va. No pasa por `handleNavigate`
   * justamente para no borrarse a sí misma, y por eso una publicación nueva
   * reemplaza a la anterior en vez de mezclarse con ella.
   */
  const pedirCotizacion = useCallback((pedido: CotizacionPedida) => {
    setCotizacionPedida(pedido);
    navegacion.navegar('contact');
  }, [navegacion]);
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
  /**
   * Qué se sabe de los catálogos auxiliares: categorías y provincias.
   *
   * Son los que dicen si un filtro que viene en la URL existe, así que
   * decidir antes de tenerlos es decidir sin saber. Con una categoría
   * inexistente el mercado hacía `return` sin consultar nada, y la grilla
   * afirmaba «No hay operaciones con estos filtros»: la respuesta de una API
   * a la que nadie preguntó.
   *
   * Tres estados y no un booleano. «Todavía no llegaron» y «no se pudieron
   * traer» terminan en pantallas distintas —esperar y fallar— y un booleano
   * las confunde; deducirlo de que la lista esté vacía las confunde también,
   * porque una lista vacía es lo que dejan las dos.
   */
  const [catalogosAuxiliares, setCatalogosAuxiliares] =
    useState<'pendiente' | 'listos' | 'falló'>('pendiente');
  const [revisionDeCatalogos, setRevisionDeCatalogos] = useState(0);
  
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

  // Mi cuenta pide sesión. Entrar directo a `?section=account` sin ella no
  // muestra una pantalla vacía ni redirige en silencio: abre el ingreso, y
  // decide DESPUÉS, cuando el ingreso se cerró y el resultado ya se sabe.
  //
  // Dos intentos fallaron acá y los dos por lo mismo: leer la sesión demasiado
  // temprano.
  //
  //  - leerla DENTRO del callback de cierre decía siempre «no autenticó»,
  //    porque el modal cierra en el mismo paso en que la sesión se guarda;
  //  - deducir «canceló» de «el modal ya no está y yo lo había pedido» se cae
  //    con `StrictMode`, que en desarrollo corre cada efecto dos veces: la
  //    segunda vuelta veía la bandera puesta y el modal todavía sin abrir, y
  //    mandaba a Inicio antes de que nadie escribiera nada.
  //
  // Así que la decisión se toma cuando el ingreso se cerró de verdad, en el
  // paso siguiente, con el estado ya asentado. `AuthProvider` no dibuja nada
  // mientras restaura la sesión, así que para entonces `isAuthenticated` es una
  // respuesta y no un «todavía no sé».
  const situacion = useRef({ autenticado: isAuthenticated, seccion: currentSection });
  situacion.current = { autenticado: isAuthenticated, seccion: currentSection };
  useEffect(() => {
    if (currentSection !== 'account' || isAuthenticated) return;
    abrirLoginYVolver(() => {
      setTimeout(() => {
        const ahora = situacion.current;
        if (ahora.seccion === 'account' && !ahora.autenticado) handleNavigate('home');
      }, 0);
    });
    // `handleNavigate` viene memorizado de la navegación; `abrirLoginYVolver`
    // sólo escribe estado y volver a crearlo no cambia cuándo corre esto.
  }, [currentSection, isAuthenticated, handleNavigate]);

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

  /**
   * Publicar.
   *
   * Es la misma puerta que ya usan la tarjeta y el detalle: sin sesión se
   * abre el Login de verdad y, si la persona entra, se abre el formulario
   * que había pedido. Antes el aviso y el Login eran todo el trámite: al
   * volver había que encontrar otra vez el botón, así que la intención se
   * perdía justo donde la persona ya había dicho qué quería hacer.
   *
   * La sesión se lee DESPUÉS de que el ingreso se cerró, y del `ref` y no de
   * la variable capturada: el modal cierra en el mismo paso en que la sesión
   * se guarda, así que leerla dentro del callback dice siempre «no entró».
   * Es el mismo desfasaje que ya resolvió Mi cuenta y usa su misma lectura.
   *
   * Cancelar, equivocar la contraseña o darse de alta dejan esto en nada: el
   * alta no abre sesión, así que no hay nada que retomar. Y lo único que se
   * retoma es abrir la pantalla: ingresar no publica, no crea una orden, no
   * reserva stock y no toca el carrito.
   */
  const pedirPublicar = () => {
    if (situacion.current.autenticado) {
      setIsAddProductOpen(true);
      return;
    }
    abrirLoginYVolver(() => {
      setTimeout(() => {
        if (situacion.current.autenticado) setIsAddProductOpen(true);
      }, 0);
    });
  };

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
    setCatalogosAuxiliares('pendiente');
    Promise.all([getCategories(), getProvinces()])
      .then(([categoryData, provinceData]) => {
        if (cancelled) return;
        setCategories(categoryData);
        setProvinces(provinceData);
        setCatalogosAuxiliares('listos');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error al cargar filtros del catálogo:', error);
        setCategories([]);
        setProvinces([]);
        // Vaciar las listas y callarse dejaba TODO filtro pareciendo
        // inexistente, así que un filtro legítimo se descartaba solo y la
        // pantalla mostraba un mercado sin filtrar como si fuera la
        // respuesta pedida. Sin catálogos no se valida nada: se dice.
        setCatalogosAuxiliares('falló');
      });

    return () => {
      cancelled = true;
    };
  }, [currentSection, revisionDeCatalogos]);

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

  // Qué filtros de la URL no existen. Sólo se sabe con los catálogos en la
  // mano: mientras están en camino `false` no significa «es válido» sino
  // «todavía no se sabe», y confundir las dos cosas es de dónde salía el
  // vacío falso.
  const categoriaInvalida = catalogosAuxiliares === 'listos'
    && selectedCategory !== 'Todas las categorías'
    && !categories.some((category) => category.name === selectedCategory);
  const provinciaInvalida = catalogosAuxiliares === 'listos'
    && selectedProvince !== 'Todas las provincias'
    && !provinces.some((province) => province.name === selectedProvince);

  /**
   * El filtro que no existe se suelta, y se va de la barra con él.
   *
   * Se suelta ese y nada más: una URL con una categoría inventada y una
   * provincia real sigue siendo una consulta por esa provincia. La
   * localidad es la excepción, y no por ampliar el descarte: no es un
   * filtro aparte, es un lugar ADENTRO de la provincia que se descartó. Sin
   * provincia el selector de localidades no tiene nada que ofrecer, así que
   * quedaría filtrando por algo que no se ve y no se puede sacar. Es lo
   * mismo que ya hace cambiar de provincia a mano.
   *
   * La barra no se escribe acá. El hook de filtros serializa su estado en
   * cada cambio, así que soltar el filtro es lo que borra el parámetro; un
   * segundo escritor del historial sería justo lo que la navegación central
   * existe para evitar.
   */
  useEffect(() => {
    if (categoriaInvalida) setSelectedCategory('Todas las categorías');
    if (provinciaInvalida) {
      setSelectedProvince('Todas las provincias');
      setSelectedLocalityId('');
    }
  }, [
    categoriaInvalida,
    provinciaInvalida,
    setSelectedCategory,
    setSelectedProvince,
    setSelectedLocalityId,
  ]);

  /**
   * Qué consulta describe lo que se está mirando, y cuál fue la última que
   * volvió con respuesta. Mientras no coinciden, la grilla espera.
   *
   * Enumerar los momentos de espera —catálogos en camino, filtro inválido en
   * descarte— no alcanzaba, y el caso 167 lo encontró: entre soltar el
   * filtro y salir la consulta hay un render donde ya no se está decidiendo
   * nada y todavía no se está cargando nada, porque los efectos corren
   * DESPUÉS de dibujar. En ese render la lista vacía volvía a leerse como
   * «no hay», y el vacío falso reaparecía por un cuadro.
   *
   * Así que no se enumeran momentos: se compara la consulta vigente con la
   * contestada. Cualquier hueco nuevo entre las dos es espera por
   * construcción, sin que nadie se acuerde de agregarlo.
   *
   * La subcategoría y la calificación mínima no entran en la firma a
   * propósito: no viajan a la consulta, así que la respuesta que hay sigue
   * siendo la respuesta a lo que se pidió.
   */
  const consultaVigente = JSON.stringify([
    searchQuery,
    selectedType,
    selectedCategory,
    selectedProvince,
    selectedProvinceId,
    selectedLocalityId,
    priceMin,
    priceMax,
    inStockOnly,
    productsRevision,
  ]);
  const [consultaContestada, setConsultaContestada] = useState<string | null>(null);

  // Que falten los catálogos es la única espera que no termina en respuesta:
  // ahí lo que corresponde es decirlo, y por eso sale de la espera.
  const laPantallaEspera = currentSection === 'marketplace'
    && catalogosAuxiliares !== 'falló'
    && consultaContestada !== consultaVigente;

  // Que no se pudieran traer los catálogos no es un mercado vacío ni un
  // mercado caído: es que no se pudo validar lo que pide la URL. Se dice y
  // se ofrece reintentar, en vez de atribuirle al mercado un cero que nadie
  // midió.
  const errorDeLaPantalla = catalogosAuxiliares === 'falló'
    ? 'No pudimos cargar los filtros del mercado. Volvé a intentarlo en un momento.'
    : errorDeCatalogo;
  const reintentarElMercado = () => {
    if (catalogosAuxiliares === 'falló') {
      setRevisionDeCatalogos((intento) => intento + 1);
      return;
    }
    setProductsRevision((intento) => intento + 1);
  };

  // Filtrar en la API para usar la ubicación real de la publicación.
  useEffect(() => {
    if (currentSection !== 'marketplace') return;
    // Sin catálogos no se consulta, y no porque falte un dato de la
    // consulta: es que todavía no se sabe si lo que pide la URL existe. Con
    // un filtro inválido tampoco, porque el descarte ya está en camino y
    // preguntar acá sería preguntar por algo que se acaba de soltar. Las dos
    // esperas se ven como espera y no como catálogo vacío.
    if (catalogosAuxiliares !== 'listos') return;
    if (categoriaInvalida || provinciaInvalida) return;

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
        if (cancelled) return;
        setLoadingProducts(false);
        // Contestada quiere decir «volvió», no «volvió con resultados»: un
        // cero de la API es una respuesta y se dibuja como tal. Lo que no
        // puede pasar es dibujarlo antes de que vuelva.
        setConsultaContestada(consultaVigente);
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
    catalogosAuxiliares,
    categoriaInvalida,
    provinciaInvalida,
    productsRevision,
    consultaVigente,
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

  /**
   * Continuar compra.
   *
   * La sesión se comprueba ACÁ y no en el Checkout, y el lugar es el punto.
   * Tener un token guardado no es tener sesión: `isAuthenticated` se queda con
   * lo que sabía al entrar, así que con la credencial ya vencida este botón
   * abría el Checkout igual. La persona completaba nombre, teléfono, provincia
   * y localidad, apretaba «Continuar al pago» y recién ahí aparecía «Sesión
   * expirada», sin Login y sin salida. Que el error llegue una pantalla después
   * no lo hace más chico: lo hace más caro, porque llega con el trabajo hecho.
   *
   * Si el access token venció pero el refresh sirve, se renueva por el camino
   * de siempre y no se interrumpe nada: la persona no tiene por qué enterarse
   * de la mecánica de sus tokens.
   *
   * Y si no se puede recuperar, es la MISMA puerta de siempre —la de la
   * tarjeta, el detalle y publicar—: se ofrece ingresar. Cancelar devuelve al
   * carrito con lo que había; nada se compra, se reserva ni se paga por
   * ingresar.
   *
   * Que entró se lee del token y no de `isAuthenticated`, que es justo lo que
   * acabamos de probar que miente: `asegurarSesion` tira la credencial muerta,
   * así que un token acá es uno nuevo, de alguien que acaba de entrar.
   */
  const handleCheckout = async () => {
    if (await asegurarSesion()) {
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
      return;
    }
    setIsCartOpen(false);
    abrirLoginYVolver(() => {
      setTimeout(() => {
        if (tokenStorage.getAccessToken()) setIsCheckoutOpen(true);
        else setIsCartOpen(true);
      }, 0);
    });
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
          onSolicitarCotizacion={pedirCotizacion}
          onNavigateToServices={() => handleNavigate('services')}
          onSolicitarPublicar={pedirPublicar}
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
                isLoading={loadingProducts || laPantallaEspera}
                error={errorDeLaPantalla}
                onReintentar={reintentarElMercado}
                onSolicitarCotizacion={pedirCotizacion}
                onSolicitarIngreso={abrirLoginYVolver}
              />
            </div>
          </main>
        );
      case 'about':
        return (
          <AboutPage 
            onNavigateToMarketplace={() => handleNavigate('marketplace')}
            onNavigateToContact={() => handleNavigate('contact')}
            onSolicitarPublicar={pedirPublicar}
            />
        );
      case 'services':
        return (
          <ServicesPage
              onSolicitarCotizacion={pedirCotizacion}
            onVerServiciosPublicados={verServiciosPublicados}
            onSolicitarPublicar={pedirPublicar}
            onSolicitarIngreso={abrirLoginYVolver}
            vistaPrevia={vistaPreviaDeServicios}
          />
        );
      case 'account':
        // Mi cuenta es una página del sitio, no una capa sobre él.
        // Quien entra sin sesión no ve nada: el efecto de más abajo
        // le abre el ingreso y lo trae de vuelta si autentica.
        return isAuthenticated ? (
          <UserDashboard onPublishClick={() => setIsAddProductOpen(true)} />
        ) : null;
      case 'contact':
        // La `key` cuelga del ID de la publicación, no de su nombre.
        //
        // Dos publicaciones pueden llamarse igual —el mismo servicio ofrecido
        // por dos vendedores es el caso típico—, y con el nombre por identidad
        // pasar de una a otra no remontaba nada: la pantalla seguía mostrando
        // al vendedor de la primera.
        //
        // El formulario nace con la cotización adentro, y eso sólo alcanza si
        // la pantalla se monta de nuevo. Estando YA en Contacto no se monta:
        // volver a entrar por el pie deja la misma instancia viva y el
        // formulario seguía mostrando la publicación anterior aunque la
        // intención ya se hubiera limpiado. Con la `key`, cambiar de intención
        // —o dejar de tenerla— es otra pantalla, y una publicación nueva
        // reemplaza a la anterior en vez de convivir con ella.
        return (
          <ContactPage
            key={cotizacionPedida ? `cotizacion:${cotizacionPedida.id}` : 'generico'}
            cotizacion={cotizacionPedida}
          />
        );
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
          onSolicitarPublicar={pedirPublicar}
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
