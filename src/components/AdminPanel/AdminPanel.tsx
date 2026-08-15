import React, { useState, useEffect, useRef } from 'react';
import styles from './AdminPanel.module.css';
import { useToast } from '../Toast/Toast';
import { apiGet, apiPost, apiPatch, apiDelete, apiBlob } from '../../utils/api';
import { ProductImage } from '../ProductImage/ProductImage';
import {
  ETIQUETA_DE_ESTADO,
  pesoLegible,
  type ColaDeDocumentacion,
  type DocumentacionEnCola,
} from '../../utils/documentacion';

type AdminTab =
  | 'dashboard' | 'users' | 'products' | 'orders' | 'categories' | 'config'
  | 'documentacion';

interface DashboardStats {
  total_users: number;
  total_sellers: number;
  total_customers: number;
  total_products: number;
  active_products: number;
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_revenue: number;
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
  
  // Dashboard
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'user' as 'admin' | 'user'
  });
  
  // Products
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  
  // Orders
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Categories
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'products' | 'services'>('all');
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    icon: '📦',
    is_service: false,
    display_order: 0
  });
  const [showAddSubcategory, setShowAddSubcategory] = useState<string | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Form Options (Config)
  const [formOptions, setFormOptions] = useState<FormOption[]>([]);
  const [optionTypes, setOptionTypes] = useState<OptionTypeInfo[]>([]);
  const [selectedOptionType, setSelectedOptionType] = useState<string>('province');
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

  // Cargar dashboard stats
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    }
  }, [activeTab]);

  // Cargar datos según pestaña
  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'products') loadProducts();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'categories') loadCategories();
    if (activeTab === 'config') loadFormOptions();
    if (activeTab === 'documentacion') loadDocumentacion();
  }, [activeTab, userRoleFilter, categoryFilter, selectedOptionType, docFiltro]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiGet<DashboardStats>('/admin/dashboard');
      setStats(data);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentacion = async () => {
    setLoading(true);
    try {
      const query = docFiltro ? `?estado=${docFiltro}` : '';
      const data = await apiGet<ColaDeDocumentacion>(`/admin/documentacion${query}`);
      setDocumentacion(data.items);
      setDocPendientes(data.pendientes);
    } catch (error) {
      console.error('Error cargando documentación:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = userRoleFilter ? `?role=${userRoleFilter}` : '';
      const data = await apiGet<{ users: AdminUser[]; total: number }>(`/admin/users${params}`);
      setUsers(data.users);
      setUsersTotal(data.total);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ products: AdminProduct[]; total: number }>('/admin/products');
      setProducts(data.products);
      setProductsTotal(data.total);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ orders: AdminOrder[]; total: number }>('/admin/orders');
      setOrders(data.orders);
      setOrdersTotal(data.total);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
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
  };

  const loadFormOptions = async () => {
    setLoading(true);
    try {
      // Cargar tipos de opciones si aún no lo hemos hecho
      if (optionTypes.length === 0) {
        const typesData = await apiGet<{ types: OptionTypeInfo[] }>('/admin/form-options/types');
        setOptionTypes(typesData.types);
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
  };

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
      await apiPatch(`/admin/form-options/${editingOption.id}`, {
        value: editingOption.value,
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

  const handleDeleteOption = async (optionId: string, optionLabel: string) => {
    if (!confirm(`¿Eliminar "${optionLabel}"?`)) return;
    
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
      setNewCategory({ name: '', description: '', icon: '📦', is_service: false, display_order: 0 });
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
      await apiPatch(`/admin/categories/${editingCategory.id}`, {
        name: editingCategory.name,
        description: editingCategory.description,
        icon: editingCategory.icon,
        is_service: editingCategory.is_service,
        is_active: editingCategory.is_active,
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

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`¿Eliminar la categoría "${categoryName}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
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

  const handleDeleteSubcategory = async (subcategoryId: string, subcategoryName: string) => {
    if (!confirm(`¿Eliminar la subcategoría "${subcategoryName}"?`)) {
      return;
    }
    
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

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      showToast('Complete todos los campos requeridos', 'warning');
      return;
    }
    
    try {
      await apiPost('/admin/users', newUser);
      showToast('Usuario creado exitosamente', 'success');
      setShowCreateUser(false);
      setNewUser({ email: '', password: '', full_name: '', phone: '', role: 'user' });
      loadUsers();
    } catch (error) {
      console.error('Error creando usuario:', error);
      showToast('Error al crear usuario', 'error');
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
    } catch (error: any) {
      console.error('Error cambiando rol:', error);
      const message = error?.message || error?.detail || 'Error al cambiar rol';
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

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: '#15803d',
      paused: '#b45309',
      draft: '#6b7280',
      deleted: '#dc2626',
      placed: '#1d4ed8',
      confirmed: '#6d28d9',
      shipped: '#b45309',
      delivered: '#15803d',
      cancelled: '#dc2626'
    };
    return (
      <span className={styles.badge} style={{ backgroundColor: colors[status] || '#666' }}>
        {status}
      </span>
    );
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h1>Panel de Administración</h1>
          <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>×</button>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'dashboard' ? styles.active : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Usuarios
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'products' ? styles.active : ''}`}
            onClick={() => setActiveTab('products')}
          >
            📦 Productos
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            🛒 Órdenes
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📁 Categorías
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'documentacion' ? styles.active : ''}`}
            onClick={() => setActiveTab('documentacion')}
          >
            📄 Documentación
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'config' ? styles.active : ''}`}
            onClick={() => setActiveTab('config')}
          >
            ⚙️ Configuración
          </button>
        </div>

        <div className={styles.content}>
          {loading && <div className={styles.loading}>Cargando...</div>}

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && stats && (
            <div className={styles.dashboard}>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>👥</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_users}</span>
                    <span className={styles.statLabel}>Usuarios Totales</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>🏪</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_sellers}</span>
                    <span className={styles.statLabel}>Vendedores</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>🛍️</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_customers}</span>
                    <span className={styles.statLabel}>Clientes</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>📦</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.active_products}</span>
                    <span className={styles.statLabel}>Productos Activos</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>🛒</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.total_orders}</span>
                    <span className={styles.statLabel}>Órdenes Totales</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>⏳</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.pending_orders}</span>
                    <span className={styles.statLabel}>Pendientes</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>✅</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stats.completed_orders}</span>
                    <span className={styles.statLabel}>Completadas</span>
                  </div>
                </div>
                <div className={styles.statCard} style={{ gridColumn: 'span 2', background: 'var(--gradient-primary)' }}>
                  <div className={styles.statIcon} style={{ color: 'white' }}>💰</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue} style={{ color: 'white' }}>{formatCurrency(stats.total_revenue)}</span>
                    <span className={styles.statLabel} style={{ color: '#ffffff' }}>Ingresos</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <div className={styles.usersSection}>
              <div className={styles.toolbar}>
                <select aria-label="Filtrar usuarios por rol"
                  value={userRoleFilter} 
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">Todos los roles</option>
                  <option value="admin">Administradores</option>
                  <option value="user">Usuarios</option>
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
                      onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className={styles.formActions}>
                    <button className={styles.saveBtn} onClick={handleCreateUser}>
                      Crear Usuario
                    </button>
                    <button className={styles.cancelBtn} onClick={() => setShowCreateUser(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

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
                            onChange={(e) => handleChangeUserRole(user.id, e.target.value)}
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
                            onClick={() => handleToggleUserActive(user.id)}
                          >
                            {user.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaDesplazable>
              <div className={styles.pagination}>
                Total: {usersTotal} usuarios
              </div>
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
              {documentacion.length === 0 && !loading && (
                <p className={styles.noData}>No hay documentación con ese estado.</p>
              )}
            </div>
          )}

          {/* PRODUCTS */}
          {activeTab === 'products' && (
            <div className={styles.productsSection}>
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
                          <ProductImage
                            src={product.image ? `${import.meta.env.VITE_IMAGES_URL || ''}${product.image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YwZjRlZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiMyZDUwMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7imqI8L3RleHQ+PC9zdmc+'}
                            alt={product.name}
                            className={styles.productThumb}
                          />
                        </td>
                        <td>{product.name}</td>
                        <td>{formatCurrency(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>{product.seller_name || '-'}</td>
                        <td>{getStatusBadge(product.status)}</td>
                        <td>
                          <select aria-label="Estado del producto"
                            value={product.status}
                            onChange={(e) => handleChangeProductStatus(product.id, e.target.value)}
                            className={styles.statusSelect}
                          >
                            <option value="active">Activo</option>
                            <option value="paused">Pausado</option>
                            <option value="draft">Borrador</option>
                            <option value="deleted">Eliminado</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaDesplazable>
              <div className={styles.pagination}>
                Total: {productsTotal} productos
              </div>
            </div>
          )}

          {/* ORDERS */}
          {activeTab === 'orders' && (
            <div className={styles.ordersSection}>
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
                        <td>{getStatusBadge(order.status)}</td>
                        <td>{formatDate(order.created_at)}</td>
                        <td>
                          <button
                            className={styles.viewBtn}
                            onClick={() => setSelectedOrder(order)}
                          >
                            👁️ Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaDesplazable>
              <div className={styles.pagination}>
                Total: {ordersTotal} órdenes
              </div>
            </div>
          )}
        </div>
      
      {/* Modal de detalle de orden */}
      {selectedOrder && (
        <div className={styles.orderDetailOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.orderDetailModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.orderDetailHeader}>
              <h2>📋 Orden {selectedOrder.order_number}</h2>
              <button className={styles.closeButton} aria-label="Cerrar" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            
            <div className={styles.orderDetailContent}>
              <div className={styles.orderDetailGrid}>
                <div className={styles.orderDetailSection}>
                  <h3>Información General</h3>
                  <p><strong>Estado:</strong> {getStatusBadge(selectedOrder.status)}</p>
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
                    placeholder="📦"
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
                      <span className={styles.categoryIcon}>{category.icon || '📦'}</span>
                      <div>
                        <h3>{category.name}</h3>
                        <span className={styles.categoryMeta}>
                          {category.is_service ? '🔧 Servicio' : '📦 Producto'} • 
                          {category.subcategories.length} subcategorías • 
                          {category.product_count} {category.is_service ? 'servicios' : 'productos'}
                          {!category.is_active && <span className={styles.inactiveTag}> • Inactiva</span>}
                        </span>
                      </div>
                    </div>
                    <div className={styles.categoryActions}>
                      <button 
                        className={styles.expandBtn}
                        onClick={() => toggleCategoryExpanded(category.id)}
                      >
                        {expandedCategories.has(category.id) ? '▼' : '▶'} Subcategorías
                      </button>
                      <button 
                        className={styles.editBtn}
                        onClick={() => setEditingCategory(category)}
                      >
                        ✏️
                      </button>
                      <button 
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteCategory(category.id, category.name)}
                        disabled={category.product_count > 0}
                        title={category.product_count > 0 ? 'No se puede eliminar (tiene productos)' : 'Eliminar'}
                      >
                        🗑️
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
                                onClick={() => handleDeleteSubcategory(sub.id, sub.name)}
                              >
                                ✕
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
                          <button onClick={() => handleAddSubcategory(category.id)}>✓</button>
                          <button onClick={() => {setShowAddSubcategory(null); setNewSubcategoryName('');}}>✕</button>
                        </div>
                      ) : (
                        <button 
                          className={styles.addSubBtn}
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
                            onChange={(e) => setEditingCategory({...editingCategory, is_service: e.target.value === 'service'})}
                          >
                            <option value="product">Producto</option>
                            <option value="service">Servicio</option>
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label htmlFor="categoria-edita-estado">Estado</label>
                          <select id="categoria-edita-estado"
                            value={editingCategory.is_active ? 'active' : 'inactive'}
                            onChange={(e) => setEditingCategory({...editingCategory, is_active: e.target.value === 'active'})}
                          >
                            <option value="active">Activa</option>
                            <option value="inactive">Inactiva</option>
                          </select>
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
            <h2>⚙️ Configuración de Formularios</h2>
            <p>Administra las opciones de los dropdowns del sistema</p>
          </div>
          
          {/* Selector de tipo de opción */}
          <div className={styles.configTabs}>
            {optionTypes.map(type => {
              const icons: Record<string, string> = {
                province: '📍',
                unit: '📏',
                pricing_type: '💰',
                availability: '📅',
                response_time: '⏱️'
              };
              return (
                <button
                  key={type.value}
                  className={`${styles.configTab} ${selectedOptionType === type.value ? styles.active : ''}`}
                  onClick={() => setSelectedOptionType(type.value)}
                >
                  {icons[type.value] || '📋'} {type.label}
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
              {showCreateOption ? '✕ Cerrar' : '+ Nueva Opción'}
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
                  ✓ Crear
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
                        onChange={(e) => setEditingOption({...editingOption, value: e.target.value})}
                        placeholder="Valor"
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
                      <button className={styles.saveBtn} onClick={handleUpdateOption}>✓</button>
                      <button className={styles.cancelBtn} onClick={() => setEditingOption(null)}>✕</button>
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
                          onClick={() => setEditingOption(option)}
                        >
                          ✏️
                        </button>
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteOption(option.id, option.label)}
                        >
                          🗑️
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
    </div>
  );
};
