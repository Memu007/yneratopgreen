import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './AdminPanel.module.css';
import { useToast } from '../../hooks/useToast';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiBlob } from '../../utils/api';
import { ProductImage } from '../ProductImage/ProductImage';
import {
  ETIQUETA_DE_ESTADO,
  pesoLegible,
  type ColaDeDocumentacion,
  type DocumentacionEnCola,
} from '../../utils/documentacion';
import { useCapaModal } from '../../hooks/useCapaModal';
import { Confirmacion } from '../../formularios/Confirmacion';
import { ClaveTemporal } from './ClaveTemporal';
import {
  COLOR_DEL_TONO,
  ESTADOS_DE_ORDEN,
  ESTADOS_DE_PRODUCTO,
  estadoDeOrden,
  estadoDeProducto,
} from '../../utils/estados';
import type { EstadoTraducido } from '../../utils/estados';

/**
 * Una decisión pendiente de confirmar. `hacer` es la mutación: se ejecuta si y
 * sólo si la persona confirma.
 */
interface PedidoDeConfirmacion {
  titulo: string;
  detalle: React.ReactNode;
  textoConfirmar: string;
  destructiva?: boolean;
  hacer: () => Promise<void>;
}

/**
 * Tipos de opción que Configuración ya no administra.
 *
 * `province` era una lista de provincias escrita a mano, de cuando no había
 * padrón. Hoy no la consume nadie: publicar, registrarse, el alta de
 * transportista, los filtros del Mercado y la edición del perfil piden todos
 * `/catalog/localities/provinces`, que es el padrón oficial con sus
 * localidades. Se midió: en una base recién creada no hay ninguna fila
 * `province`, y ningún consumidor pide `option_type=province`.
 *
 * Dejarla en el panel era ofrecer un lugar donde escribir provincias que no
 * iban a aparecer en ningún lado, y una segunda lista de provincias es
 * exactamente lo que el padrón vino a evitar.
 *
 * Se retira de la pantalla y NADA más: las filas que existan y el endpoint
 * siguen como están, porque quitar el tipo del Backend rompería a cualquiera
 * que todavía lo llame.
 */
const TIPOS_RETIRADOS = ['province'];

type AdminTab =
  | 'dashboard' | 'users' | 'products' | 'orders' | 'categories' | 'config'
  | 'documentacion';

// Las claves son las que devuelve `/admin/dashboard`. Antes esta interfaz
// pedía `total_sellers` y `total_customers`, que el servidor nunca mandó: la
// pantalla dibujaba `undefined` en dos tarjetas y nadie se enteraba, porque
// TypeScript cree lo que dice la interfaz y la respuesta no se valida.
interface DashboardStats {
  total_users: number;
  total_normal_users: number;
  total_admins: number;
  total_products: number;
  active_products: number;
  total_orders: number;
  orders_in_process: number;
  completed_orders: number;
  sold_volume: number;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

interface AdminProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
  category?: string;
  seller_name?: string;
  image?: string;
  created_at?: string;
}

interface AdminOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  shipping_cost: number;
  buyer_name?: string;
  buyer_email?: string;
  seller_name?: string;
  items_count: number;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
  shipping_address?: string;
  created_at?: string;
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  is_active: boolean;
  display_order: number;
}

interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  is_service: boolean;
  is_active: boolean;
  display_order: number;
  subcategories: Subcategory[];
  product_count: number;
}

// Form Options
interface FormOption {
  id: string;
  option_type: string;
  value: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

interface OptionTypeInfo {
  value: string;
  label: string;
  description: string;
}

/**
 * Cuántas filas pide cada lista del panel.
 *
 * Explícito y fijo. El servidor ya usaba veinte por omisión, pero la
 * pantalla no puede deducir cuántas páginas hay de un valor que no pidió:
 * mostraba las primeras veinte filas y al pie el total entero, sin ninguna
 * forma de llegar a la fila 21.
 */
const FILAS_POR_PAGINA = 20;

/**
 * Cuántas páginas hay para ese total.
 *
 * Cero resultados es «página 1 de 1» y no «de 0»: la lista está vacía, que
 * no es lo mismo que rota, y con «de 0» no habría página donde pararse.
 */
const paginasDe = (total: number) => Math.max(1, Math.ceil(total / FILAS_POR_PAGINA));

interface PaginadorProps {
  /** Qué se está listando, en plural: entra en el total y en los rótulos. */
  etiqueta: string;
  pagina: number;
  total: number;
  alCambiar: (pagina: number) => void;
}

/**
 * El pie de una lista: cuántas hay, en qué página estás y cómo moverte.
 *
 * Vive afuera del componente para que las tres listas usen exactamente el
 * mismo control y no puedan divergir. Los botones dicen qué hacen y sobre
 * qué lista, y se deshabilitan en los extremos en vez de pedir una página
 * que no existe.
 */
const Paginador: React.FC<PaginadorProps> = ({ etiqueta, pagina, total, alCambiar }) => {
  const paginas = paginasDe(total);
  return (
    <div className={styles.pagination}>
      <span>Total: {total} {etiqueta}</span>
      <span className={styles.paginacionControles}>
        <button
          type="button"
          className={styles.paginaBtn}
          onClick={() => alCambiar(pagina - 1)}
          disabled={pagina <= 1}
          aria-label={`Página anterior de ${etiqueta}`}
        >
          Anterior
        </button>
        <span className={styles.paginaActual} aria-live="polite">
          Página {pagina} de {paginas}
        </span>
        <button
          type="button"
          className={styles.paginaBtn}
          onClick={() => alCambiar(pagina + 1)}
          disabled={pagina >= paginas}
          aria-label={`Página siguiente de ${etiqueta}`}
        >
          Siguiente
        </button>
      </span>
    </div>
  );
};

interface AdminPanelProps {
  onClose: () => void;
}

/**
 * Contenedor de una tabla que en pantallas chicas no entra y se desplaza en
 * horizontal. Una región que se desplaza tiene que poder recorrerse con el
 * teclado: hasta ahora las últimas columnas sólo se alcanzaban arrastrando con
 * el dedo o el mouse.
 *
 * El `tabIndex` se agrega SÓLO cuando la región desborda de verdad, y eso se
 * mide en vez de suponerse: en escritorio la tabla entra entera y una parada de
 * tabulación que no lleva a ninguna parte sería un estorbo. Se observan el
 * contenedor y la tabla porque las filas llegan después del primer dibujo.
 */
const TablaDesplazable: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({
  etiqueta,
  children,
}) => {
  const contenedor = useRef<HTMLDivElement>(null);
  const [desplazable, setDesplazable] = useState(false);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    const medir = () => setDesplazable(nodo.scrollWidth > nodo.clientWidth + 1);
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    if (nodo.firstElementChild) observador.observe(nodo.firstElementChild);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={contenedor}
      className={styles.tableScroll}
      {...(desplazable ? { tabIndex: 0, role: 'region', 'aria-label': etiqueta } : {})}
    >
      {children}
    </div>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(false);

  // Qué se rompió y dónde. Antes cada carga hacía `console.error` y seguía: la
  // pantalla mostraba la tabla vacía o los datos de la consulta anterior, y un
  // 500 se leía igual que «no hay resultados». Acá el fallo es un estado más,
  // por sección, y mientras está puesto NO se dibujan filas: se dibuja el aviso.
  type SeccionAuditada = 'dashboard' | 'usuarios' | 'productos' | 'ordenes' | 'documentacion';
  const [fallos, setFallos] = useState<Partial<Record<SeccionAuditada, string>>>({});
  const limpiarFallo = useCallback((seccion: SeccionAuditada) => {
    setFallos((previos) => {
      if (!(seccion in previos)) return previos;
      const restantes = { ...previos };
      delete restantes[seccion];
      return restantes;
    });
  }, []);
  const anotarFallo = useCallback((seccion: SeccionAuditada, recurso: string) => {
    setFallos((previos) => ({ ...previos, [seccion]: recurso }));
  }, []);
  
  // Dashboard
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  // Qué pidió cada lista la última vez. Al volver a una pestaña se siguen
  // viendo las filas anteriores, así que se puede filtrar o pasar de página
  // antes de que termine la carga que arrancó al entrar; esa carga vieja puede
  // llegar DESPUÉS y escribir filas y total de algo que ya no se pidió. Sólo la
  // respuesta de la combinación vigente —página más filtros— escribe.
  const pedidoVigente = useRef({ usuarios: '', productos: '', ordenes: '' });
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  // Activo/inactivo viaja como 'true'/'false' o vacío para «todos»: el
  // servidor distingue el filtro ausente de `is_active=false`.
  const [userActiveFilter, setUserActiveFilter] = useState<string>('');
  // Lo que se escribe y lo que se pidió son dos cosas: la lista no se
  // rearma con cada tecla, sino cuando se busca.
  const [userSearch, setUserSearch] = useState('');
  const [userSearchAplicada, setUserSearchAplicada] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [showCreateUser, setShowCreateUser] = useState(false);
  // Lo que hay que corregir en el alta, dicho donde se corrige. Un aviso
  // que se desvanece no sirve para arreglar un formulario.
  const [altaError, setAltaError] = useState('');
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'user' as 'admin' | 'user'
  });
  
  // La confirmación del panel: una sola capa para todas las decisiones que
  // pisan datos de otra persona.
  //
  // Antes había dos formas de decidir, y las dos estaban mal. Cambiar el rol,
  // activar o desactivar una cuenta y cambiar el estado de una publicación
  // escribían en el acto, con un `onChange`: un clic de más en un `select` ya
  // era un cambio hecho sobre la cuenta de otro. Y los borrados preguntaban
  // con `window.confirm`, que no es una capa del producto —no tiene nombre
  // accesible, no atrapa el foco ni lo devuelve, y bloquea el hilo—.
  //
  // `hacer` es lo único que escribe. Mientras no se confirme, no sale ninguna
  // solicitud; si se cancela, no sale ninguna nunca.
  const [confirmacion, setConfirmacion] = useState<PedidoDeConfirmacion | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // La contraseña temporal de un restablecimiento: existe en memoria, se
  // muestra una vez y se va. No se guarda, no se registra y no se puede
  // volver a pedir.
  const [claveTemporal, setClaveTemporal] = useState<{ usuario: string; clave: string } | null>(null);

  // Products
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productStatusFilter, setProductStatusFilter] = useState<string>('');
  const [productsPage, setProductsPage] = useState(1);
  
  // Orders
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Categories
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'products' | 'services'>('all');
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    icon: '',
    is_service: false,
    display_order: 0
  });
  const [showAddSubcategory, setShowAddSubcategory] = useState<string | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Form Options (Config)
  const [formOptions, setFormOptions] = useState<FormOption[]>([]);
  const [optionTypes, setOptionTypes] = useState<OptionTypeInfo[]>([]);
  const [selectedOptionType, setSelectedOptionType] = useState<string>('unit');
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [editingOption, setEditingOption] = useState<FormOption | null>(null);
  const [newOption, setNewOption] = useState({ value: '', label: '', display_order: 0 });

  // Documentación de vendedores. La cola arranca filtrada en pendientes
  // porque es lo único que pide una acción; el resto es consulta.
  const [documentacion, setDocumentacion] = useState<DocumentacionEnCola[]>([]);
  const [docPendientes, setDocPendientes] = useState(0);
  const [docFiltro, setDocFiltro] = useState<string>('pendiente');
  const [docRechazando, setDocRechazando] = useState<string | null>(null);
  const [docMotivo, setDocMotivo] = useState('');

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    limpiarFallo('dashboard');
    try {
      const data = await apiGet<DashboardStats>('/admin/dashboard');
      setStats(data);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      // Los números viejos no se dejan puestos: serían una respuesta que el
      // servidor no dio.
      setStats(null);
      anotarFallo('dashboard', 'el resumen del panel');
    } finally {
      setLoading(false);
    }
  }, [limpiarFallo, anotarFallo]);

  // Cargar dashboard stats
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    }
  }, [activeTab, loadDashboard]);

  const loadDocumentacion = useCallback(async () => {
    setLoading(true);
    limpiarFallo('documentacion');
    try {
      const query = docFiltro ? `?estado=${docFiltro}` : '';
      const data = await apiGet<ColaDeDocumentacion>(`/admin/documentacion${query}`);
      setDocumentacion(data.items);
      setDocPendientes(data.pendientes);
    } catch (error) {
      console.error('Error cargando documentación:', error);
      setDocumentacion([]);
      anotarFallo('documentacion', 'la cola de documentación');
    } finally {
      setLoading(false);
    }
  }, [docFiltro, limpiarFallo, anotarFallo]);

  const verConstancia = async (fila: DocumentacionEnCola) => {
    try {
      const archivo = await apiBlob(`/admin/documentacion/${fila.id}/archivo`);
      const url = URL.createObjectURL(archivo);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo abrir la constancia.',
        'error',
      );
    }
  };

  const decidirDocumentacion = async (
    fila: DocumentacionEnCola,
    decision: 'aprobada' | 'rechazada',
    motivo?: string,
  ) => {
    try {
      // Va el `presentado_el` **de la fila que se está mirando**, tal como lo
      // devolvió la cola: es lo que le dice al servidor qué presentación se
      // revisó. Si el vendedor la reemplazó mientras tanto, contesta 409 en
      // vez de aprobar un papel que nadie abrió.
      await apiPost(`/admin/documentacion/${fila.id}/decidir`, {
        decision,
        motivo,
        presentado_el: fila.presentado_el,
      });
      showToast(
        decision === 'aprobada'
          ? `Documentación de ${fila.user_nombre} aprobada.`
          : `Documentación de ${fila.user_nombre} rechazada.`,
        'success',
      );
      setDocRechazando(null);
      setDocMotivo('');
      await loadDocumentacion();
    } catch (error) {
      // Si otro administrador decidió primero, el servidor contesta 409 con el
      // estado real. Se muestra tal cual y se recarga: la cola tiene que
      // mostrar lo que pasó, no insistir con lo que este navegador creía.
      showToast(
        error instanceof Error ? error.message : 'No se pudo registrar la decisión.',
        'error',
      );
      await loadDocumentacion();
    }
  };

  // Buscar es una acción, no cada tecla: se aplica lo escrito y se vuelve a
  // la primera página, porque la que se estaba mirando era de otra lista.
  const aplicarBusquedaDeUsuarios = () => {
    setUserSearchAplicada(userSearch.trim());
    setUsersPage(1);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    limpiarFallo('usuarios');
    try {
      const params = new URLSearchParams({
        page: String(usersPage),
        page_size: String(FILAS_POR_PAGINA),
      });
      if (userRoleFilter) params.set('role', userRoleFilter);
      if (userActiveFilter) params.set('is_active', userActiveFilter);
      if (userSearchAplicada) params.set('search', userSearchAplicada);
      const clave = params.toString();
      pedidoVigente.current.usuarios = clave;
      const data = await apiGet<{ users: AdminUser[]; total: number }>(
        `/admin/users?${clave}`);
      if (pedidoVigente.current.usuarios !== clave) return;
      // La página puede haber quedado fuera del total: se filtró, se borró
      // una fila, o entró otro administrador. Se cae a la última que
      // existe en vez de dibujar un vacío que no es cierto.
      const ultima = paginasDe(data.total);
      if (usersPage > ultima) {
        setUsersPage(ultima);
        return;
      }
      setUsers(data.users);
      setUsersTotal(data.total);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      // Sin filas y con aviso: una tabla vacía después de un 500 se lee
      // como «no hay resultados», que es otra cosa.
      setUsers([]);
      setUsersTotal(0);
      anotarFallo('usuarios', 'la lista de usuarios');
    } finally {
      setLoading(false);
    }
  }, [usersPage, userRoleFilter, userActiveFilter, userSearchAplicada,
    limpiarFallo, anotarFallo]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    limpiarFallo('productos');
    try {
      const params = new URLSearchParams({
        page: String(productsPage),
        page_size: String(FILAS_POR_PAGINA),
      });
      if (productStatusFilter) params.set('status', productStatusFilter);
      const clave = params.toString();
      pedidoVigente.current.productos = clave;
      const data = await apiGet<{ products: AdminProduct[]; total: number }>(
        `/admin/products?${clave}`);
      if (pedidoVigente.current.productos !== clave) return;
      const ultima = paginasDe(data.total);
      if (productsPage > ultima) {
        setProductsPage(ultima);
        return;
      }
      setProducts(data.products);
      setProductsTotal(data.total);
    } catch (error) {
      console.error('Error cargando productos:', error);
      // Sin filas y con aviso: una tabla vacía después de un 500 se lee
      // como «no hay resultados», que es otra cosa.
      setProducts([]);
      setProductsTotal(0);
      anotarFallo('productos', 'la lista de publicaciones');
    } finally {
      setLoading(false);
    }
  }, [productsPage, productStatusFilter, limpiarFallo, anotarFallo]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    limpiarFallo('ordenes');
    try {
      const params = new URLSearchParams({
        page: String(ordersPage),
        page_size: String(FILAS_POR_PAGINA),
      });
      if (orderStatusFilter) params.set('status', orderStatusFilter);
      const clave = params.toString();
      pedidoVigente.current.ordenes = clave;
      const data = await apiGet<{ orders: AdminOrder[]; total: number }>(
        `/admin/orders?${clave}`);
      if (pedidoVigente.current.ordenes !== clave) return;
      const ultima = paginasDe(data.total);
      if (ordersPage > ultima) {
        setOrdersPage(ultima);
        return;
      }
      setOrders(data.orders);
      setOrdersTotal(data.total);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
      // Sin filas y con aviso: una tabla vacía después de un 500 se lee
      // como «no hay resultados», que es otra cosa.
      setOrders([]);
      setOrdersTotal(0);
      anotarFallo('ordenes', 'la lista de órdenes');
    } finally {
      setLoading(false);
    }
  }, [ordersPage, orderStatusFilter, limpiarFallo, anotarFallo]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      let params = '?include_inactive=true';
      if (categoryFilter === 'products') params += '&is_service=false';
      if (categoryFilter === 'services') params += '&is_service=true';
      
      const data = await apiGet<AdminCategory[]>(`/admin/categories${params}`);
      setCategories(data);
    } catch (error) {
      console.error('Error cargando categorías:', error);
      showToast('Error al cargar categorías', 'error');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, showToast]);

  const loadFormOptions = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar tipos de opciones si aún no lo hemos hecho
      if (optionTypes.length === 0) {
        const typesData = await apiGet<{ types: OptionTypeInfo[] }>('/admin/form-options/types');
        setOptionTypes(typesData.types.filter((tipo) => !TIPOS_RETIRADOS.includes(tipo.value)));
      }
      
      // Cargar opciones del tipo seleccionado
      const data = await apiGet<FormOption[]>(`/admin/form-options?option_type=${selectedOptionType}&include_inactive=true`);
      setFormOptions(data);
    } catch (error) {
      console.error('Error cargando opciones:', error);
      showToast('Error al cargar opciones de configuración', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedOptionType, optionTypes.length, showToast]);

  // Cargar datos según pestaña
  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'products') loadProducts();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'categories') loadCategories();
    if (activeTab === 'config') loadFormOptions();
    if (activeTab === 'documentacion') loadDocumentacion();
  }, [activeTab, userRoleFilter, categoryFilter, selectedOptionType, docFiltro,
      loadUsers, loadProducts, loadOrders, loadCategories, loadFormOptions,
      loadDocumentacion]);

  const handleCreateOption = async () => {
    if (!newOption.value.trim() || !newOption.label.trim()) {
      showToast('Complete valor y etiqueta', 'warning');
      return;
    }
    
    try {
      await apiPost('/admin/form-options', {
        option_type: selectedOptionType,
        value: newOption.value,
        label: newOption.label,
        display_order: newOption.display_order,
        is_active: true
      });
      showToast('Opción creada exitosamente', 'success');
      setShowCreateOption(false);
      setNewOption({ value: '', label: '', display_order: 0 });
      loadFormOptions();
    } catch (error: unknown) {
      console.error('Error creando opción:', error);
      const message = error instanceof Error ? error.message : 'Error al crear opción';
      showToast(message, 'error');
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOption) return;
    
    try {
      // El valor interno no viaja: es la llave con la que quedaron guardadas
      // las publicaciones y el Backend rechaza cambiarlo.
      await apiPut(`/admin/form-options/${editingOption.id}`, {
        label: editingOption.label,
        display_order: editingOption.display_order,
        is_active: editingOption.is_active
      });
      showToast('Opción actualizada', 'success');
      setEditingOption(null);
      loadFormOptions();
    } catch (error: unknown) {
      console.error('Error actualizando opción:', error);
      const message = error instanceof Error ? error.message : 'Error al actualizar';
      showToast(message, 'error');
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    
    try {
      await apiDelete(`/admin/form-options/${optionId}`);
      showToast('Opción eliminada', 'success');
      loadFormOptions();
    } catch (error: unknown) {
      console.error('Error eliminando opción:', error);
      const message = error instanceof Error ? error.message : 'Error al eliminar';
      showToast(message, 'error');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      showToast('Ingrese un nombre para la categoría', 'warning');
      return;
    }
    
    try {
      await apiPost('/admin/categories', newCategory);
      showToast('Categoría creada exitosamente', 'success');
      setShowCreateCategory(false);
      setNewCategory({ name: '', description: '', icon: '', is_service: false, display_order: 0 });
      loadCategories();
    } catch (error: unknown) {
      console.error('Error creando categoría:', error);
      const message = error instanceof Error ? error.message : 'Error al crear categoría';
      showToast(message, 'error');
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    
    try {
      await apiPut(`/admin/categories/${editingCategory.id}`, {
        name: editingCategory.name,
        description: editingCategory.description,
        icon: editingCategory.icon,
        is_service: editingCategory.is_service,
        // `is_active` NO viaja, y no es un olvido.
        //
        // Se midió: guardarlo en `false` se acepta, se persiste y no cambia
        // nada de la parte pública —la categoría sigue en los filtros, filtrar
        // por ella devuelve lo mismo, el catálogo queda igual y el detalle abre
        // normal—. `/catalog/categories` ni siquiera expone el campo. Era un
        // interruptor que decía «Inactiva» y no sacaba nada de circulación.
        //
        // Así que el panel dejó de ofrecerlo. La columna, la API y los datos
        // quedan como están por compatibilidad: lo que se retira es la acción,
        // no el campo. Si algún día `is_active` significa algo para el
        // catálogo, vuelve con su semántica escrita.
        display_order: editingCategory.display_order
      });
      showToast('Categoría actualizada', 'success');
      setEditingCategory(null);
      loadCategories();
    } catch (error: unknown) {
      console.error('Error actualizando categoría:', error);
      const message = error instanceof Error ? error.message : 'Error al actualizar';
      showToast(message, 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    
    try {
      await apiDelete(`/admin/categories/${categoryId}`);
      showToast('Categoría eliminada', 'success');
      loadCategories();
    } catch (error: unknown) {
      console.error('Error eliminando categoría:', error);
      const message = error instanceof Error ? error.message : 'Error al eliminar';
      showToast(message, 'error');
    }
  };

  const handleAddSubcategory = async (categoryId: string) => {
    if (!newSubcategoryName.trim()) {
      showToast('Ingrese un nombre para la subcategoría', 'warning');
      return;
    }
    
    try {
      await apiPost(`/admin/categories/${categoryId}/subcategories`, {
        name: newSubcategoryName,
        is_active: true,
        display_order: 0
      });
      showToast('Subcategoría agregada', 'success');
      setShowAddSubcategory(null);
      setNewSubcategoryName('');
      loadCategories();
    } catch (error: unknown) {
      console.error('Error agregando subcategoría:', error);
      const message = error instanceof Error ? error.message : 'Error al agregar';
      showToast(message, 'error');
    }
  };

  const handleDeleteSubcategory = async (subcategoryId: string) => {
    
    try {
      await apiDelete(`/admin/subcategories/${subcategoryId}`);
      showToast('Subcategoría eliminada', 'success');
      loadCategories();
    } catch (error: unknown) {
      console.error('Error eliminando subcategoría:', error);
      const message = error instanceof Error ? error.message : 'Error al eliminar';
      showToast(message, 'error');
    }
  };

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // El mínimo de la contraseña es del Backend: `UserCreateRequest` pide seis.
  // Se comprueba acá también para no gastar un viaje ni un 422 en algo que la
  // pantalla ya sabe.
  const MINIMO_DE_CLAVE = 6;

  const handleCreateUser = async () => {
    if (!newUser.email.trim() || !newUser.password || !newUser.full_name.trim()) {
      setAltaError('Completá el email, la contraseña y el nombre: son obligatorios.');
      return;
    }
    if (newUser.password.length < MINIMO_DE_CLAVE) {
      setAltaError(`La contraseña necesita al menos ${MINIMO_DE_CLAVE} caracteres.`);
      return;
    }

    setAltaError('');
    try {
      await apiPost('/admin/users', newUser);
      showToast('Usuario creado exitosamente', 'success');
      setShowCreateUser(false);
      setNewUser({ email: '', password: '', full_name: '', phone: '', role: 'user' });
      loadUsers();
    } catch (error) {
      console.error('Error creando usuario:', error);
      // El detalle del servidor es lo único accionable que hay: dice si el
      // email ya existe o qué campo no pasó. Reemplazarlo por «Error al crear
      // usuario» era tirar la única información útil. El formulario queda como
      // está, con lo escrito, para corregir y reintentar.
      setAltaError(error instanceof Error && error.message
        ? error.message
        : 'No se pudo crear el usuario.');
    }
  };

  const handleToggleUserActive = async (userId: string) => {
    try {
      await apiPost(`/admin/users/${userId}/toggle-active`, {});
      loadUsers();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cambiar estado del usuario', 'error');
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      await apiPatch(`/admin/users/${userId}`, { role: newRole });
      showToast('Rol actualizado correctamente', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error cambiando rol:', error);
      const message = error instanceof Error ? error.message : 'Error al cambiar rol';
      showToast(message, 'error');
    }
  };

  const handleChangeProductStatus = async (productId: string, newStatus: string) => {
    try {
      await apiPatch(`/admin/products/${productId}/status`, { status: newStatus });
      loadProducts();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cambiar estado', 'error');
    }
  };

  // --- Lo que se pregunta antes de escribir --------------------------------
  //
  // Cada pedido nombra el objeto —la persona, la publicación—, el cambio
  // exacto y su consecuencia. «¿Estás seguro?» no es una pregunta: no dice qué
  // se va a hacer ni sobre qué.

  const ROL_LEGIBLE: Record<string, string> = { admin: 'Admin', user: 'Usuario' };

  const pedirBorrado = (
    que: string,
    nombre: string,
    consecuencia: React.ReactNode,
    hacer: () => Promise<void>,
  ) => setConfirmacion({
    titulo: `Eliminar ${que}`,
    detalle: (<><strong>{nombre}</strong>. {consecuencia}</>),
    textoConfirmar: `Eliminar ${que}`,
    destructiva: true,
    hacer,
  });

  /**
   * Una contraseña nueva que sirva de verdad: 20 caracteres de un alfabeto
   * sin ambiguos —nada de O/0, l/1/I—, sacados del generador criptográfico del
   * navegador y no de `Math.random`, que es predecible.
   *
   * El rechazo por módulo se descarta en vez de recortarse: tomar el resto de
   * un byte sobre un alfabeto que no divide a 256 favorece a las primeras
   * letras, y una contraseña con letras más probables que otras es más corta
   * de lo que aparenta.
   */
  const claveNueva = () => {
    const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%+=?';
    const TOPE = 256 - (256 % ALFABETO.length);
    let clave = '';
    while (clave.length < 20) {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      for (const byte of bytes) {
        if (byte < TOPE && clave.length < 20) clave += ALFABETO[byte % ALFABETO.length];
      }
    }
    return clave;
  };

  const pedirRestablecerClave = (usuario: AdminUser) => setConfirmacion({
    titulo: 'Restablecer la contraseña',
    detalle: (
      <>
        Se le genera una contraseña nueva a <strong>{usuario.full_name}</strong>{' '}
        ({usuario.email}) y la de ahora deja de funcionar en el momento. Vas a verla
        una sola vez, así que tenés que tenerla a mano para pasársela. Queda vigente
        hasta que un administrador la restablezca otra vez.
      </>
    ),
    textoConfirmar: 'Generar contraseña nueva',
    destructiva: true,
    hacer: async () => {
      // La clave se genera acá y vive en memoria hasta que se cierra el
      // resultado. No se registra, no viaja en la URL y no se guarda.
      const clave = claveNueva();
      await apiPost(`/admin/users/${usuario.id}/reset-password`, { password: clave });
      setClaveTemporal({ usuario: usuario.full_name || usuario.email, clave });
    },
  });

  const pedirCambioDeRol = (usuario: AdminUser, nuevoRol: string) => {
    if (nuevoRol === usuario.role) return;
    const sube = nuevoRol === 'admin';
    setConfirmacion({
      titulo: sube ? 'Dar acceso de administrador' : 'Quitar acceso de administrador',
      detalle: (
        <>
          <strong>{usuario.full_name}</strong> ({usuario.email}) pasa de{' '}
          <strong>{ROL_LEGIBLE[usuario.role] || usuario.role}</strong> a{' '}
          <strong>{ROL_LEGIBLE[nuevoRol] || nuevoRol}</strong>.{' '}
          {sube
            ? 'Va a poder ver y cambiar los datos de todas las cuentas, publicaciones y órdenes.'
            : 'Deja de tener acceso al panel y a los datos de las demás cuentas.'}
        </>
      ),
      textoConfirmar: sube ? 'Dar acceso de Admin' : 'Pasar a Usuario',
      destructiva: !sube,
      hacer: () => handleChangeUserRole(usuario.id, nuevoRol),
    });
  };

  const pedirCambioDeCuenta = (usuario: AdminUser) => {
    const desactiva = usuario.is_active;
    setConfirmacion({
      titulo: desactiva ? 'Desactivar la cuenta' : 'Activar la cuenta',
      detalle: (
        <>
          <strong>{usuario.full_name}</strong> ({usuario.email}){' '}
          {desactiva
            ? 'no va a poder volver a entrar hasta que se reactive la cuenta. Sus publicaciones y sus órdenes quedan como están.'
            : 'vuelve a poder entrar con su contraseña de siempre.'}
        </>
      ),
      textoConfirmar: desactiva ? 'Desactivar la cuenta' : 'Activar la cuenta',
      destructiva: desactiva,
      hacer: () => handleToggleUserActive(usuario.id),
    });
  };

  const pedirCambioDeEstado = (producto: AdminProduct, nuevoEstado: string) => {
    if (nuevoEstado === producto.status) return;
    const CONSECUENCIA: Record<string, string> = {
      active: 'Vuelve a aparecer en el catálogo y se puede comprar.',
      paused: 'Deja de aparecer en el catálogo. No se borra y se puede volver a activar.',
      sold_out: 'Sigue visible pero no se puede comprar.',
      deleted: 'Deja de aparecer en el catálogo y en las búsquedas.',
    };
    const antes = estadoDeProducto(producto.status);
    const despues = estadoDeProducto(nuevoEstado);
    setConfirmacion({
      titulo: 'Cambiar el estado de la publicación',
      detalle: (
        <>
          <strong>{producto.name}</strong> pasa de <strong>{antes.texto}</strong> a{' '}
          <strong>{despues.texto}</strong>. {CONSECUENCIA[nuevoEstado] || ''}{' '}
          Es la publicación de otra persona: {producto.seller_name || 'su vendedor'} no
          recibe aviso de este cambio.
        </>
      ),
      textoConfirmar: `Pasar a ${despues.texto}`,
      destructiva: nuevoEstado === 'deleted' || nuevoEstado === 'paused',
      hacer: () => handleChangeProductStatus(producto.id, nuevoEstado),
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-AR');
  };

  // El badge dice el estado en castellano y con el tono que le corresponde.
  // Antes imprimía el token del Backend —`sold_out`, `awaiting_transfer_receipt`—
  // y pintaba de gris cualquier estado que su mapa no tuviera, que eran cuatro
  // de los catorce. El diccionario vive en `utils/estados`, así que la fila y
  // el filtro leen lo mismo.
  const badgeDeEstado = ({ texto, tono }: EstadoTraducido) => (
    <span className={styles.badge} style={{ backgroundColor: COLOR_DEL_TONO[tono] }}>
      {texto}
    </span>
  );

  // Atrapa el foco, lo devuelve al cerrar, cierra con Escape y traba el
  // scroll del fondo. Ninguna capa del producto hacía nada de esto.
  const capa = useCapaModal<HTMLDivElement>(onClose);

  // Carga, error y vacío son tres cosas distintas y hasta acá se veían igual.
  //
  // Con un fallo puesto NO se dibuja la tabla: se dibuja el aviso, con
  // `role="alert"` para que un lector de pantalla lo anuncie, diciendo QUÉ no
  // cargó y con un botón que vuelve a pedir lo mismo —la misma consulta y los
  // mismos filtros, porque la función de carga los lee del estado vigente—.
  // Mientras se está cargando se conserva lo que ya estaba, que es lo que hacía
  // antes; lo que cambia es que un vacío ahora se dice con todas las letras en
  // vez de ser una tabla sin filas.
  const bloqueAuditado = (
    seccion: SeccionAuditada,
    recargar: () => void,
    vacio: string,
    hayContenido: boolean,
    contenido: React.ReactNode,
  ): React.ReactNode => {
    const recurso = fallos[seccion];
    if (recurso) {
      return (
        <div role="alert" className={styles.avisoDeFallo}>
          <p className={styles.avisoDeFalloTexto}>No se pudo cargar {recurso}.</p>
          <button type="button" className={styles.avisoDeFalloBoton} onClick={recargar}>
            Reintentar
          </button>
        </div>
      );
    }
    // El vacío se DICE, pero no reemplaza a la tabla ni al pie: ese pie ya
    // decía la verdad —«Total: 0 usuarios», «Página 1 de 1», navegación
    // deshabilitada— y sacarlo perdería información en vez de sumarla.
    return (
      <>
        {contenido}
        {!hayContenido && !loading && <p className={styles.noData}>{vacio}</p>}
      </>
    );
  };

  // El detalle de una orden es otra capa encima del panel, no un div suelto:
  // sin esto Escape lo atravesaba y cerraba Administración entera —con su
  // pestaña, su filtro, su página y su scroll— y Tab se paseaba por la tabla
  // de atrás. Es la MISMA pila de `useCapaModal`: sólo responde la última.
  const cerrarDetalleDeOrden = useCallback(() => setSelectedOrder(null), []);
  const capaDeLaOrden = useCapaModal<HTMLDivElement>(
    cerrarDetalleDeOrden,
    selectedOrder !== null,
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-label="Administración"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h1>Panel de Administración</h1>
          <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>×</button>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'dashboard' ? styles.active : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Usuarios
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'products' ? styles.active : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Productos
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Órdenes
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            Categorías
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'documentacion' ? styles.active : ''}`}
            onClick={() => setActiveTab('documentacion')}
          >
            Documentación
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'config' ? styles.active : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Configuración
          </button>
        </div>

        <div className={styles.content}>
          {loading && <div className={styles.loading}>Cargando...</div>}

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && bloqueAuditado(
            'dashboard', loadDashboard, 'El resumen no devolvió datos.', stats !== null,
            stats && (
            <div className={styles.dashboard}>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_users}</span>
                    <span className={styles.statLabel}>Total de usuarios</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_normal_users}</span>
                    <span className={styles.statLabel}>Usuarios comunes</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_admins}</span>
                    <span className={styles.statLabel}>Administradores</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.active_products}</span>
                    <span className={styles.statLabel}>Productos Activos</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_orders}</span>
                    <span className={styles.statLabel}>Órdenes Totales</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.orders_in_process}</span>
                    <span className={styles.statLabel}>Órdenes en proceso</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.completed_orders}</span>
                    <span className={styles.statLabel}>Completadas</span>
                  </div>
                </div>
                <div className={styles.statCard} style={{ gridColumn: 'span 2', background: 'var(--gradient-primary)' }}>
                  <div className={styles.statIcon} style={{ color: 'white' }}></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue} style={{ color: 'white' }}>{formatCurrency(stats.sold_volume)}</span>
                    <span className={styles.statLabel} style={{ color: 'var(--tg-color-surface)' }}>Volumen vendido</span>
                  </div>
                </div>
              </div>
            </div>
            ),
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <div className={styles.usersSection}>
              <div className={styles.toolbar}>
                <input
                  type="search"
                  className={styles.filterSelect}
                  aria-label="Buscar usuarios por nombre o email"
                  placeholder="Buscar por nombre o email"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') aplicarBusquedaDeUsuarios(); }}
                />
                <button
                  type="button"
                  className={styles.addButton}
                  aria-label="Buscar usuarios"
                  onClick={aplicarBusquedaDeUsuarios}
                >
                  Buscar
                </button>
                <select aria-label="Filtrar usuarios por rol"
                  value={userRoleFilter} 
                  onChange={(e) => { setUserRoleFilter(e.target.value); setUsersPage(1); }}
                  className={styles.filterSelect}
                >
                  <option value="">Todos los roles</option>
                  <option value="admin">Administradores</option>
                  <option value="user">Usuarios</option>
                </select>
                <select aria-label="Filtrar usuarios por estado"
                  value={userActiveFilter}
                  onChange={(e) => { setUserActiveFilter(e.target.value); setUsersPage(1); }}
                  className={styles.filterSelect}
                >
                  <option value="">Activos e inactivos</option>
                  <option value="true">Solo activos</option>
                  <option value="false">Solo inactivos</option>
                </select>
                <button 
                  className={styles.addButton}
                  onClick={() => setShowCreateUser(true)}
                >
                  + Crear Usuario
                </button>
              </div>

              {showCreateUser && (
                <div className={styles.createForm}>
                  <h3>Crear Nuevo Usuario</h3>
                  {altaError && (
                    <p role="alert" className={styles.altaError}>{altaError}</p>
                  )}
                  <div className={styles.formGrid}>
                    <input
                      type="email"
                      placeholder="Email *"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    />
                    <input
                      type="password"
                      placeholder="Contraseña *"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Nombre Completo *"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                    />
                    <input
                      type="tel"
                      placeholder="Teléfono"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    />
                    <select aria-label="Rol del nuevo usuario"
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value as 'user' | 'admin'})}
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className={styles.formActions}>
                    <button className={styles.saveBtn} onClick={handleCreateUser}>
                      Crear Usuario
                    </button>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => { setShowCreateUser(false); setAltaError(''); }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {bloqueAuditado('usuarios', loadUsers,
                'No hay usuarios que coincidan con el filtro.', users.length > 0, (
                <>
              <TablaDesplazable etiqueta="Usuarios registrados">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Registrado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>
                          <select aria-label="Rol del usuario"
                            value={user.role}
                            onChange={(e) => pedirCambioDeRol(user, e.target.value)}
                            className={styles.roleSelect}
                          >
                            <option value="user">Usuario</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>
                          <span className={`${styles.statusDot} ${user.is_active ? styles.active : styles.inactive}`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>
                          <button
                            className={`${styles.actionBtn} ${user.is_active ? styles.deactivate : styles.activate}`}
                            onClick={() => pedirCambioDeCuenta(user)}
                          >
                            {user.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            className={styles.actionBtn}
                            onClick={() => pedirRestablecerClave(user)}
                          >
                            Restablecer contraseña
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaDesplazable>
              <Paginador
                etiqueta="usuarios"
                pagina={usersPage}
                total={usersTotal}
                alCambiar={setUsersPage}
              />
                </>
              ))}
            </div>
          )}

          {/* DOCUMENTACIÓN DE VENDEDORES
              Revisión manual: se mira la constancia y se decide. No habilita ni
              bloquea nada del marketplace; aprobar sólo enciende el distintivo. */}
          {activeTab === 'documentacion' && (
            <div className={styles.documentacionSection}>
              <div className={styles.toolbar}>
                <select
                  aria-label="Filtrar documentación por estado"
                  value={docFiltro}
                  onChange={(e) => setDocFiltro(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="pendiente">Pendientes</option>
                  <option value="aprobada">Aprobadas</option>
                  <option value="rechazada">Rechazadas</option>
                  <option value="">Todas</option>
                </select>
                <span className={styles.docPendientes}>
                  {docPendientes} pendiente{docPendientes === 1 ? '' : 's'} de revisión
                </span>
              </div>

              <p className={styles.docNota}>
                Revisión manual e informativa. Aprobar muestra «Documentación
                revisada» en las publicaciones de ese vendedor; no certifica su
                identidad ni garantiza la operación, y no habilita ni bloquea
                publicar, vender o cobrar.
              </p>

              {bloqueAuditado('documentacion', loadDocumentacion,
                'No hay documentación con ese estado.', documentacion.length > 0, (
              <TablaDesplazable etiqueta="Documentación presentada por vendedores">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>CUIT</th>
                      <th>Razón social</th>
                      <th>Constancia</th>
                      <th>Estado</th>
                      <th>Presentada</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentacion.map((fila) => (
                      <tr key={fila.id}>
                        <td>
                          {fila.user_nombre}
                          <br />
                          <span className={styles.docEmail}>{fila.user_email}</span>
                        </td>
                        <td>{fila.cuit}</td>
                        <td>{fila.razon_social}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.docArchivo}
                            onClick={() => verConstancia(fila)}
                          >
                            {fila.archivo_nombre}
                          </button>
                          <br />
                          <span className={styles.docEmail}>{pesoLegible(fila.archivo_bytes)}</span>
                        </td>
                        <td>
                          <span
                            className={styles.docEstado}
                            data-estado={fila.estado}
                          >
                            {ETIQUETA_DE_ESTADO[fila.estado]}
                          </span>
                          {fila.estado !== 'pendiente' && fila.revisado_por_nombre && (
                            <>
                              <br />
                              <span className={styles.docEmail}>
                                por {fila.revisado_por_nombre} el {formatDate(fila.revisado_el || '')}
                              </span>
                            </>
                          )}
                          {fila.estado === 'rechazada' && fila.motivo_de_rechazo && (
                            <>
                              <br />
                              <span className={styles.docEmail}>{fila.motivo_de_rechazo}</span>
                            </>
                          )}
                        </td>
                        <td>{formatDate(fila.presentado_el)}</td>
                        <td>
                          {fila.estado !== 'pendiente' ? (
                            <span className={styles.docEmail}>Ya revisada</span>
                          ) : docRechazando === fila.id ? (
                            <div className={styles.docRechazo}>
                              <label htmlFor={`doc-motivo-${fila.id}`}>
                                Motivo del rechazo
                              </label>
                              <input
                                id={`doc-motivo-${fila.id}`}
                                type="text"
                                maxLength={500}
                                placeholder="Qué tiene que corregir"
                                value={docMotivo}
                                onChange={(e) => setDocMotivo(e.target.value)}
                              />
                              <button
                                className={styles.actionBtn}
                                disabled={!docMotivo.trim()}
                                onClick={() => decidirDocumentacion(fila, 'rechazada', docMotivo)}
                              >
                                Confirmar rechazo
                              </button>
                              <button
                                className={styles.cancelBtn}
                                onClick={() => {
                                  setDocRechazando(null);
                                  setDocMotivo('');
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                className={`${styles.actionBtn} ${styles.activate}`}
                                onClick={() => decidirDocumentacion(fila, 'aprobada')}
                              >
                                Aprobar
                              </button>
                              <button
                                className={`${styles.actionBtn} ${styles.deactivate}`}
                                onClick={() => {
                                  setDocRechazando(fila.id);
                                  setDocMotivo('');
                                }}
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaDesplazable>
              ))}
            </div>
          )}

          {/* PRODUCTS */}
          {activeTab === 'products' && (
            <div className={styles.productsSection}>
              <div className={styles.toolbar}>
                <select aria-label="Filtrar publicaciones por estado"
                  value={productStatusFilter}
                  onChange={(e) => { setProductStatusFilter(e.target.value); setProductsPage(1); }}
                  className={styles.filterSelect}
                >
                  <option value="">Todos los estados</option>
                  {/* Del mismo diccionario que el badge de la fila: si el filtro
                      y la tabla no leyeran lo mismo, volverían a discrepar. */}
                  {Object.entries(ESTADOS_DE_PRODUCTO).map(([token, estado]) => (
                    <option key={token} value={token}>{estado.texto}</option>
                  ))}
                </select>
              </div>
              {bloqueAuditado('productos', loadProducts,
                'No hay publicaciones que coincidan con el filtro.', products.length > 0, (
                <>
              <TablaDesplazable etiqueta="Publicaciones del catálogo">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Imagen</th>
                      <th>Nombre</th>
                      <th>Precio</th>
                      <th>Stock</th>
                      <th>Vendedor</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => (
                      <tr key={product.id}>
                        <td>
                          {/* Sin imagen no se pasa un SVG inventado: aca habia
                              una TERCERA copia del respaldo verde en data-URI.
                              `ProductImage` ya sabe decir «Sin registro fotografico». */}
                          <ProductImage
                            src={product.image ? `${import.meta.env.VITE_IMAGES_URL || ''}${product.image}` : ''}
                            alt={product.name}
                            className={styles.productThumb}
                          />
                        </td>
                        <td>{product.name}</td>
                        <td>{formatCurrency(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>{product.seller_name || '-'}</td>
                        <td>{badgeDeEstado(estadoDeProducto(product.status))}</td>
                        <td>
                          <select aria-label="Estado del producto"
                            value={product.status}
                            onChange={(e) => pedirCambioDeEstado(product, e.target.value)}
                            className={styles.statusSelect}
                          >
                            {/* Del mismo diccionario que el badge de al lado y
                                que el filtro de arriba. Estaban escritas acá a
                                mano y en masculino —«Activo», «Pausado»—,
                                mientras el badge de la MISMA fila decía
                                «Activa» y «Pausada»: el mismo estado con dos
                                nombres, a dos centímetros. El `value` sigue
                                siendo el token del Backend, que es lo que
                                viaja en el PATCH. */}
                            {Object.entries(ESTADOS_DE_PRODUCTO).map(([token, estado]) => (
                              <option key={token} value={token}>{estado.texto}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaDesplazable>
              <Paginador
                etiqueta="productos"
                pagina={productsPage}
                total={productsTotal}
                alCambiar={setProductsPage}
              />
                </>
              ))}
            </div>
          )}

          {/* ORDERS */}
          {activeTab === 'orders' && (
            <div className={styles.ordersSection}>
              <div className={styles.toolbar}>
                <select aria-label="Filtrar órdenes por estado"
                  value={orderStatusFilter}
                  onChange={(e) => { setOrderStatusFilter(e.target.value); setOrdersPage(1); }}
                  className={styles.filterSelect}
                >
                  <option value="">Todos los estados</option>
                  {/* Idem Publicaciones: un solo diccionario para el filtro y la
                      fila. `draft` no se ofrece como filtro porque una orden en
                      borrador todavía no es un pedido, pero sí se traduce si
                      alguna aparece en la tabla. */}
                  {Object.entries(ESTADOS_DE_ORDEN)
                    .filter(([token]) => token !== 'draft')
                    .map(([token, estado]) => (
                      <option key={token} value={token}>{estado.texto}</option>
                    ))}
                </select>
              </div>
              {bloqueAuditado('ordenes', loadOrders,
                'No hay órdenes que coincidan con el filtro.', orders.length > 0, (
                <>
              <TablaDesplazable etiqueta="Órdenes de compra">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Comprador</th>
                      <th>Vendedor</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id}>
                        <td><strong>{order.order_number}</strong></td>
                        <td>{order.buyer_name || '-'}</td>
                        <td>{order.seller_name || '-'}</td>
                        <td>{order.items_count}</td>
                        <td>{formatCurrency(order.total_amount)}</td>
                        <td>{badgeDeEstado(estadoDeOrden(order.status))}</td>
                        <td>{formatDate(order.created_at)}</td>
                        <td>
                          <button
                            className={styles.viewBtn}
                            aria-label={`Ver la orden ${order.order_number}`}
                            onClick={() => setSelectedOrder(order)}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaDesplazable>
              <Paginador
                etiqueta="órdenes"
                pagina={ordersPage}
                total={ordersTotal}
                alCambiar={setOrdersPage}
              />
                </>
              ))}
            </div>
          )}
        </div>
      
      {/* Modal de detalle de orden */}
      {selectedOrder && (
        <div className={styles.orderDetailOverlay} onClick={cerrarDetalleDeOrden}>
          <div className={styles.orderDetailModal}
            ref={capaDeLaOrden}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-de-la-orden"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.orderDetailHeader}>
              <h2 id="titulo-de-la-orden"> Orden {selectedOrder.order_number}</h2>
              <button className={styles.closeButton} aria-label="Cerrar" onClick={cerrarDetalleDeOrden}>×</button>
            </div>
            
            <div className={styles.orderDetailContent}>
              <div className={styles.orderDetailGrid}>
                <div className={styles.orderDetailSection}>
                  <h3>Información General</h3>
                  <p><strong>Estado:</strong> {badgeDeEstado(estadoDeOrden(selectedOrder.status))}</p>
                  <p><strong>Fecha:</strong> {formatDate(selectedOrder.created_at)}</p>
                </div>
                
                <div className={styles.orderDetailSection}>
                  <h3>Comprador</h3>
                  <p><strong>Nombre:</strong> {selectedOrder.buyer_name || '-'}</p>
                  <p><strong>Email:</strong> {selectedOrder.buyer_email || '-'}</p>
                  <p><strong>Dirección:</strong> {selectedOrder.shipping_address || '-'}</p>
                </div>
                
                <div className={styles.orderDetailSection}>
                  <h3>Vendedor</h3>
                  <p><strong>Nombre:</strong> {selectedOrder.seller_name || '-'}</p>
                </div>
              </div>
              
              <div className={styles.orderDetailSection}>
                <h3>Productos ({selectedOrder.items_count} items)</h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio Unit.</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.product_name}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td>{formatCurrency(item.unit_price * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className={styles.noItems}>No hay detalles de items disponibles</p>
                )}
              </div>
              
              <div className={styles.orderTotals}>
                <div className={styles.totalRow}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subtotal || 0)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>Envío:</span>
                  <span>{formatCurrency(selectedOrder.shipping_cost || 0)}</span>
                </div>
                <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                  <span>Total:</span>
                  <span>{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORÍAS */}
      {activeTab === 'categories' && (
        <div className={styles.categoriesSection}>
          <div className={styles.sectionHeader}>
            <h2>Gestión de Categorías y Subcategorías</h2>
            <div className={styles.sectionActions}>
              <select aria-label="Filtrar categorias"
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'products' | 'services')}
                className={styles.filterSelect}
              >
                <option value="all">Todas</option>
                <option value="products">Solo Productos</option>
                <option value="services">Solo Servicios</option>
              </select>
              <button 
                className={styles.addButton}
                onClick={() => setShowCreateCategory(true)}
              >
                + Nueva Categoría
              </button>
            </div>
          </div>

          {/* Modal crear categoría */}
          {showCreateCategory && (
            <div className={styles.formCard}>
              <h3>Nueva Categoría</h3>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                    placeholder="Ej: Fertilizantes"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Icono (emoji)</label>
                  <input
                    type="text"
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})}
                    placeholder=""
                    maxLength={4}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="categoria-nueva-tipo">Tipo</label>
                  <select id="categoria-nueva-tipo"
                    value={newCategory.is_service ? 'service' : 'product'}
                    onChange={(e) => setNewCategory({...newCategory, is_service: e.target.value === 'service'})}
                  >
                    <option value="product">Producto</option>
                    <option value="service">Servicio</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Orden</label>
                  <input
                    type="number"
                    value={newCategory.display_order}
                    onChange={(e) => setNewCategory({...newCategory, display_order: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                  placeholder="Descripción opcional..."
                  rows={2}
                />
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setShowCreateCategory(false)}>
                  Cancelar
                </button>
                <button className={styles.saveBtn} onClick={handleCreateCategory}>
                  Crear Categoría
                </button>
              </div>
            </div>
          )}

          {/* Lista de categorías */}
          <div className={styles.categoriesList}>
            {categories.length === 0 ? (
              <p className={styles.noData}>No hay categorías para mostrar</p>
            ) : (
              categories.map(category => (
                <div key={category.id} className={`${styles.categoryCard} ${!category.is_active ? styles.inactive : ''}`}>
                  <div className={styles.categoryHeader}>
                    <div className={styles.categoryInfo}>
                      <span className={styles.categoryIcon}>{category.icon || ''}</span>
                      <div>
                        <h3>{category.name}</h3>
                        <span className={styles.categoryMeta}>
                          {category.is_service ? ' Servicio' : ' Producto'} •
                          {category.subcategories.length} subcategorías • 
                          {category.product_count} {category.is_service ? 'servicios' : 'productos'}
                          {!category.is_active && <span className={styles.inactiveTag}> • Inactiva</span>}
                        </span>
                      </div>
                    </div>
                    <div className={styles.categoryActions}>
                      <button 
                        className={styles.expandBtn}
                        aria-label={`${expandedCategories.has(category.id) ? 'Ocultar' : 'Mostrar'} las subcategorías de ${category.name}`}
                        onClick={() => toggleCategoryExpanded(category.id)}
                      >
                        {expandedCategories.has(category.id) ? 'Ocultar' : 'Mostrar'} subcategorías
                      </button>
                      <button 
                        className={styles.editBtn}
                        aria-label={`Editar la categoría ${category.name}`}
                        onClick={() => setEditingCategory(category)}
                      >
                        Editar
                      </button>
                      <button 
                        className={styles.deleteBtn}
                        aria-label={`Eliminar la categoría ${category.name}`}
                        onClick={() => pedirBorrado(
                          'la categoría',
                          category.name,
                          'Se elimina para siempre. Sólo se puede si no le queda ninguna publicación ni subcategoría.',
                          () => handleDeleteCategory(category.id),
                        )}
                        disabled={category.product_count > 0}
                        title={category.product_count > 0
                          ? `No se puede eliminar: tiene ${category.product_count} publicación(es)`
                          : undefined}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Subcategorías expandidas */}
                  {expandedCategories.has(category.id) && (
                    <div className={styles.subcategoriesSection}>
                      <div className={styles.subcategoriesList}>
                        {category.subcategories.length === 0 ? (
                          <p className={styles.noSubcategories}>Sin subcategorías</p>
                        ) : (
                          category.subcategories.map(sub => (
                            <div key={sub.id} className={`${styles.subcategoryItem} ${!sub.is_active ? styles.inactive : ''}`}>
                              <span>{sub.name}</span>
                              <button 
                                className={styles.deleteSubBtn}
                                aria-label={`Eliminar la subcategoría ${sub.name}`}
                                onClick={() => pedirBorrado(
                                  'la subcategoría',
                                  sub.name,
                                  'Se elimina para siempre. Sólo se puede si ninguna publicación la está usando.',
                                  () => handleDeleteSubcategory(sub.id),
                                )}
                              >
                                Eliminar
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Agregar subcategoría */}
                      {showAddSubcategory === category.id ? (
                        <div className={styles.addSubcategoryForm}>
                          <input
                            type="text"
                            value={newSubcategoryName}
                            onChange={(e) => setNewSubcategoryName(e.target.value)}
                            placeholder="Nombre de subcategoría"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(category.id)}
                          />
                          <button
                            aria-label={`Agregar la subcategoría a ${category.name}`}
                            onClick={() => handleAddSubcategory(category.id)}
                          >
                            Agregar
                          </button>
                          <button
                            aria-label={`Cancelar el alta de subcategoría en ${category.name}`}
                            onClick={() => {setShowAddSubcategory(null); setNewSubcategoryName('');}}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button 
                          className={styles.addSubBtn}
                          aria-label={`Agregar una subcategoría a ${category.name}`}
                          onClick={() => setShowAddSubcategory(category.id)}
                        >
                          + Agregar subcategoría
                        </button>
                      )}
                    </div>
                  )}

                  {/* Modal editar categoría */}
                  {editingCategory?.id === category.id && (
                    <div className={styles.editCategoryForm}>
                      <h4>Editar Categoría</h4>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label>Nombre</label>
                          <input
                            type="text"
                            value={editingCategory.name}
                            onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Icono</label>
                          <input
                            type="text"
                            value={editingCategory.icon || ''}
                            onChange={(e) => setEditingCategory({...editingCategory, icon: e.target.value})}
                            maxLength={4}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label htmlFor="categoria-edita-tipo">Tipo</label>
                          <select id="categoria-edita-tipo"
                            value={editingCategory.is_service ? 'service' : 'product'}
                            disabled={category.product_count > 0}
                            onChange={(e) => setEditingCategory(
                              {...editingCategory, is_service: e.target.value === 'service'})}
                          >
                            <option value="product">Producto</option>
                            <option value="service">Servicio</option>
                          </select>
                          {category.product_count > 0 && (
                            <p className={styles.avisoDeBloqueo}>
                              El tipo no se puede cambiar: {category.product_count} publicación(es)
                              ya se publicaron bajo esta categoría. El resto sí se edita.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={styles.formGroup}>
                        <label>Descripción</label>
                        <textarea
                          value={editingCategory.description || ''}
                          onChange={(e) => setEditingCategory({...editingCategory, description: e.target.value})}
                          rows={2}
                        />
                      </div>
                      <div className={styles.formActions}>
                        <button className={styles.cancelBtn} onClick={() => setEditingCategory(null)}>
                          Cancelar
                        </button>
                        <button className={styles.saveBtn} onClick={handleUpdateCategory}>
                          Guardar Cambios
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CONFIGURACIÓN - Opciones de Formulario */}
      {activeTab === 'config' && (
        <div className={styles.configSection}>
          <div className={styles.configHeader}>
            <h2> Configuración de Formularios</h2>
            <p>Administra las opciones de los dropdowns del sistema</p>
          </div>
          
          {/* Selector de tipo de opción */}
          <div className={styles.configTabs}>
            {optionTypes.map(type => {
              const icons: Record<string, string> = {
                province: '',
                unit: '',
                pricing_type: '',
                availability: '',
                response_time: ''
              };
              return (
                <button
                  key={type.value}
                  className={`${styles.configTab} ${selectedOptionType === type.value ? styles.active : ''}`}
                  onClick={() => setSelectedOptionType(type.value)}
                >
                  {icons[type.value] || ''} {type.label}
                </button>
              );
            })}
          </div>

          <div className={styles.optionTypeDescription}>
            {optionTypes.find(t => t.value === selectedOptionType)?.description}
          </div>

          <div className={styles.toolbar}>
            <span className={styles.resultCount}>{formOptions.length} opciones</span>
            <button 
              className={styles.addButton}
              onClick={() => setShowCreateOption(!showCreateOption)}
            >
              {showCreateOption ? 'Cerrar' : '+ Nueva Opción'}
            </button>
          </div>

          {/* Formulario crear opción - Inline compacto */}
          {showCreateOption && (
            <div className={styles.createForm}>
              <div className={styles.inlineFormRow}>
                <input
                  type="text"
                  value={newOption.value}
                  onChange={(e) => setNewOption({...newOption, value: e.target.value})}
                  placeholder="Valor interno (ej: buenos_aires)"
                  className={styles.inlineInput}
                />
                <input
                  type="text"
                  value={newOption.label}
                  onChange={(e) => setNewOption({...newOption, label: e.target.value})}
                  placeholder="Etiqueta visible (ej: Buenos Aires)"
                  className={styles.inlineInput}
                />
                <input
                  type="number"
                  value={newOption.display_order}
                  onChange={(e) => setNewOption({...newOption, display_order: parseInt(e.target.value) || 0})}
                  placeholder="Orden"
                  className={styles.inlineInputSmall}
                  style={{ width: '80px' }}
                />
                <button className={styles.saveBtn} onClick={handleCreateOption}>
                  Crear opción
                </button>
              </div>
            </div>
          )}

          {/* Lista de opciones */}
          <div className={styles.optionsList}>
            {formOptions.length === 0 ? (
              <p className={styles.noData}>No hay opciones configuradas</p>
            ) : (
              formOptions.map(option => (
                <div 
                  key={option.id} 
                  className={`${styles.optionItem} ${!option.is_active ? styles.inactive : ''}`}
                >
                  {editingOption?.id === option.id ? (
                    <div className={styles.optionEditForm}>
                      <input
                        type="text"
                        value={editingOption.value}
                        readOnly
                        aria-label="Valor interno de la opción (no se puede cambiar)"
                        title="El valor interno no se puede cambiar: es el que quedó guardado en las publicaciones"
                      />
                      <input
                        type="text"
                        value={editingOption.label}
                        onChange={(e) => setEditingOption({...editingOption, label: e.target.value})}
                        placeholder="Etiqueta"
                      />
                      <input
                        type="number"
                        value={editingOption.display_order}
                        onChange={(e) => setEditingOption({...editingOption, display_order: parseInt(e.target.value) || 0})}
                        style={{ width: '60px' }}
                      />
                      <select aria-label="Estado de la opcion"
                        value={editingOption.is_active ? 'active' : 'inactive'}
                        onChange={(e) => setEditingOption({...editingOption, is_active: e.target.value === 'active'})}
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                      <button
                        className={styles.saveBtn}
                        aria-label={`Guardar la opción ${editingOption.label}`}
                        onClick={handleUpdateOption}
                      >
                        Guardar
                      </button>
                      <button
                        className={styles.cancelBtn}
                        aria-label={`Cancelar la edición de ${editingOption.label}`}
                        onClick={() => setEditingOption(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className={styles.optionInfo}>
                        <span className={styles.optionLabel}>{option.label}</span>
                        <span className={styles.optionValue}>({option.value})</span>
                        {!option.is_active && <span className={styles.inactiveTag}>Inactivo</span>}
                      </div>
                      <div className={styles.optionActions}>
                        <span className={styles.optionOrder}>#{option.display_order}</span>
                        <button 
                          className={styles.editBtn}
                          aria-label={`Editar la opción ${option.label}`}
                          onClick={() => setEditingOption(option)}
                        >
                          Editar
                        </button>
                        <button 
                          className={styles.deleteBtn}
                          aria-label={`Eliminar la opción ${option.label}`}
                          onClick={() => pedirBorrado(
                            'la opción',
                            option.label,
                            'Deja de ofrecerse en los formularios. Las publicaciones que ya la eligieron no cambian.',
                            () => handleDeleteOption(option.id),
                          )}
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </div>

      {/* La confirmación, una sola para todo el panel. Se dibuja última: es la
          capa de más arriba y no tiene que competir con nada por el foco. */}
      {confirmacion && (
        <Confirmacion
          titulo={confirmacion.titulo}
          detalle={confirmacion.detalle}
          textoConfirmar={confirmacion.textoConfirmar}
          destructiva={confirmacion.destructiva}
          enCurso={confirmando}
          alConfirmar={async () => {
            // Una sola mutación por confirmación: mientras viaja, los botones
            // están deshabilitados y el fondo no cierra.
            setConfirmando(true);
            try {
              await confirmacion.hacer();
            } finally {
              setConfirmando(false);
              setConfirmacion(null);
            }
          }}
          alCancelar={() => setConfirmacion(null)}
        />
      )}

      {claveTemporal && (
        <ClaveTemporal
          usuario={claveTemporal.usuario}
          clave={claveTemporal.clave}
          alCerrar={() => setClaveTemporal(null)}
        />
      )}
    </div>
  );
};
