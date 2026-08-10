import React, { useState, useEffect } from 'react';
import styles from './UserDashboard.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast/Toast';
import { apiGet, apiPatch, apiDelete, apiPost, tokenStorage, API_BASE_URL } from '../../utils/api';
import { ProductImage } from '../ProductImage/ProductImage';
import {
  getLocalities,
  getProvinces,
  LocalityResponse,
  ProvinceResponse,
} from '../../utils/catalogService';

type TabType = 'profile' | 'notifications' | 'purchases' | 'sales' | 'products';

// Interface para notificaciones
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  order_id?: string;
  is_read: boolean;
  created_at: string;
}

// Interface para órdenes del backend
interface BackendOrderItem {
  id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  subtotal: number;
  product_image_snapshot?: string;
}

interface BackendOrder {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  total_amount: number;
  items: BackendOrderItem[];
  created_at: string;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_address?: string;
  seller_name?: string;
  seller_phone?: string;
  seller_whatsapp?: string;
  transfer_receipt_url?: string;
  rejection_reason?: string;
}

interface Order {
  id: string;
  date: string;
  status: 'pending' | 'awaiting-transfer-receipt' | 'transfer-receipt-submitted' | 'paid' | 'confirmed' | 'in-transit' | 'delivered' | 'cancelled' | 'rejected';
  total: number;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
  buyer?: {
    name: string;
    phone: string;
    address: string;
  };
  seller?: {
    name: string;
    phone: string;
    whatsapp: string;
  };
  transferReceiptUrl?: string;
  rejectionReason?: string;
}

interface UserProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  status: 'active' | 'paused' | 'sold-out';
  views: number;
  likes: number;
  publishedDate: string;
}

// Interfaz para subcategorías
interface Subcategory {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

// Interfaz para categorías del backend
interface CategoryFromBackend {
  id: string;
  name: string;
  is_service: boolean;
  subcategories: Subcategory[];
}

// Interfaz para productos del backend
interface BackendProduct {
  id: string;
  name: string;
  category_id: string;
  category?: { id: string; name: string };
  subcategory_id?: string;
  subcategory?: { id: string; name: string };
  price: number;
  stock: number;
  unit?: string;
  description?: string;
  location?: string;
  images?: Array<{ id: string; url: string; is_primary: boolean }>;
  status: string;
  views_count: number;
  likes_count: number;
  created_at: string;
  publication_type?: string;
  // Campos de servicio
  pricing_type?: string;
  availability?: string;
  response_time?: string;
  experience_years?: number;
  has_equipment?: boolean;
  coverage_zones?: string[];
}

// Interfaz para el formulario de edición
interface EditFormData {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  unit: string;
  category_id: string;
  category_name: string;
  subcategory_id: string;
  subcategory_name: string;
  location_province: string;
  location_city: string;
  existingImages: Array<{ id: string; url: string; is_primary: boolean }>;
  newImages: Array<{ file: File; preview: string }>;
  imagesToDelete: string[];
  publication_type: 'producto' | 'servicio';
  // Campos de servicio
  pricing_type?: string;
  availability?: string;
  response_time?: string;
  experience_years?: string;
  has_equipment?: boolean;
  coverage_zones?: string[];
}

// Helper para construir URL de imagen - usar variable de entorno o vacío para rutas relativas
const IMAGES_BASE_URL = import.meta.env.VITE_IMAGES_URL || '';
const getImageUrl = (url: string | undefined): string => {
  if (!url) return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmNGVkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzJkNTAxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuKaoiBTaW4gSW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${IMAGES_BASE_URL}${url}`;
};

interface UserDashboardProps {
  onClose: () => void;
  onPublishClick?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ onClose, onPublishClick }) => {
  const { user, updateProfile } = useAuth();
  const { showToast, showConfirm } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | Order['status']>('all');
  
  // Estado para productos reales del usuario
  const [userProducts, setUserProducts] = useState<UserProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true); // Empieza en true para mostrar carga
  const [productsError, setProductsError] = useState<string | null>(null);
  
  // Estado para órdenes reales
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Estado para modal de edición
  const [editingProduct, setEditingProduct] = useState<EditFormData | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Estado para notificaciones
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  
  // Estado para calificaciones
  const [ratingModal, setRatingModal] = useState<{ orderId: string; sellerName: string } | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratedOrders, setRatedOrders] = useState<Set<string>>(new Set());
  
  // Referencia a los productos originales del backend para edición
  const [backendProducts, setBackendProducts] = useState<BackendProduct[]>([]);
  
  // Estado para categorías (para edición)
  const [categories, setCategories] = useState<CategoryFromBackend[]>([]);

  // Lista de provincias argentinas
  const PROVINCES = [
    "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut",
    "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
    "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
    "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
  ];

  // Helper para mapear status del backend al frontend
  const mapBackendStatus = (status: string): Order['status'] => {
    const statusMap: Record<string, Order['status']> = {
      'placed': 'pending',
      'awaiting_transfer_receipt': 'awaiting-transfer-receipt',
      'transfer_receipt_submitted': 'transfer-receipt-submitted',
      'paid': 'paid',
      'confirmed': 'confirmed',
      'shipped': 'in-transit',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'rejected': 'rejected'
    };
    return statusMap[status.toLowerCase()] || 'pending';
  };

  // Cargar órdenes (compras y ventas) cuando cambia de pestaña
  useEffect(() => {
    const loadOrders = async () => {
      if (activeTab !== 'purchases' && activeTab !== 'sales') return;
      
      setLoadingOrders(true);
      try {
        if (activeTab === 'purchases') {
          const response = await apiGet<BackendOrder[]>('/orders/my?as_role=buyer');
          const mappedOrders: Order[] = response.map(o => ({
            id: o.order_number,
            date: o.created_at,
            status: mapBackendStatus(o.status),
            total: o.total_amount,
            items: o.items.map(i => ({
              productName: i.product_name_snapshot,
              quantity: i.quantity,
              price: i.unit_price_snapshot
            })),
            seller: o.seller_name ? {
              name: o.seller_name,
              phone: o.seller_phone || '',
              whatsapp: o.seller_whatsapp || o.seller_phone || ''
            } : undefined,
            transferReceiptUrl: o.transfer_receipt_url,
            rejectionReason: o.rejection_reason,
          }));
          setPurchases(mappedOrders);
        } else if (activeTab === 'sales') {
          const response = await apiGet<BackendOrder[]>('/orders/my?as_role=seller');
          const mappedOrders: Order[] = response.map(o => ({
            id: o.order_number,
            date: o.created_at,
            status: mapBackendStatus(o.status),
            total: o.total_amount,
            items: o.items.map(i => ({
              productName: i.product_name_snapshot,
              quantity: i.quantity,
              price: i.unit_price_snapshot
            })),
            buyer: o.buyer_name ? {
              name: o.buyer_name,
              phone: o.buyer_phone || '',
              address: o.buyer_address || ''
            } : undefined,
            transferReceiptUrl: o.transfer_receipt_url,
            rejectionReason: o.rejection_reason,
          }));
          setSales(mappedOrders);
        }
      } catch (error) {
        console.error('Error al cargar órdenes:', error);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrders();
  }, [activeTab]);

  // Cargar productos del usuario cuando se monta el componente
  useEffect(() => {
    const loadUserProducts = async () => {
      setLoadingProducts(true);
      setProductsError(null);
      
      try {
        const response = await apiGet<{ products: BackendProduct[]; total: number }>('/products/my');
        
        // Convertir productos del backend al formato del frontend
        // Guardar productos originales del backend
        setBackendProducts(response.products);
        
        const convertedProducts: UserProduct[] = response.products.map((p: BackendProduct) => {
          // Obtener la imagen principal
          const primaryImage = p.images?.find(img => img.is_primary)?.url || p.images?.[0]?.url;
          
          // Determinar el estado del producto
          let status: UserProduct['status'] = 'active';
          if (p.stock === 0) status = 'sold-out';
          else if (p.status === 'draft' || p.status === 'paused') status = 'paused';
          
          return {
            id: p.id,
            name: p.name,
            category: p.category?.name || 'Sin categoría',
            price: p.price,
            stock: p.stock,
            image: getImageUrl(primaryImage),
            status,
            views: p.views_count || 0,
            likes: p.likes_count || 0,
            publishedDate: p.created_at,
          };
        });
        
        setUserProducts(convertedProducts);
      } catch (error) {
        console.error('Error al cargar productos:', error);
        setProductsError(error instanceof Error ? error.message : 'Error al cargar productos');
      } finally {
        setLoadingProducts(false);
      }
    };

    loadUserProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar notificaciones cuando se monta el componente o cambia de pestaña
  useEffect(() => {
    const loadNotifications = async () => {
      if (activeTab !== 'notifications') {
        // Solo cargar el contador de no leídas si no estamos en la pestaña
        try {
          const response = await apiGet<{ unread_count: number }>('/notifications/unread-count');
          setUnreadCount(response.unread_count);
        } catch (error) {
          console.error('Error al cargar contador de notificaciones:', error);
        }
        return;
      }
      
      setLoadingNotifications(true);
      try {
        const response = await apiGet<{ notifications: Notification[]; unread_count: number; total: number }>('/notifications');
        setNotifications(response.notifications);
        setUnreadCount(response.unread_count);
      } catch (error) {
        console.error('Error al cargar notificaciones:', error);
      } finally {
        setLoadingNotifications(false);
      }
    };

    loadNotifications();
  }, [activeTab]);

  // Cargar categorías cuando se abre el modal de edición
  useEffect(() => {
    if (editingProduct) {
      apiGet<CategoryFromBackend[]>('/catalog/categories?include_empty=true')
        .then(data => setCategories(data))
        .catch(err => console.error('Error cargando categorías:', err));
    }
  }, [editingProduct !== null]);

  // Estado temporal para edición de perfil
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '+54 9 11 5555-4444',
    whatsapp: '+54 9 11 5555-4444',
    province: 'Buenos Aires',
    city: 'CABA',
    address: 'Av. Corrientes 1234',
    cbu: user?.cbu || '',
    bankAlias: user?.bankAlias || '',
    carrierBaseLocalityId: user?.carrierBaseLocalityId || '',
    carrierTransport: user?.carrierTransport || '',
    carrierTransportCertified: user?.carrierTransportCertified ?? false,
    // El radio viaja como texto mientras se edita y se convierte al guardar:
    // así el campo puede quedar vacío sin volverse NaN.
    carrierCoverageRadiusKm:
      user?.carrierCoverageRadiusKm != null ? String(user.carrierCoverageRadiusKm) : '',
    carrierCapacity: user?.carrierCapacity || '',
  });

  // Los productos se cargan desde el backend en userProducts (ver useEffect arriba)
  // Las órdenes se cargan desde el backend en purchases y sales (ver useEffect arriba)

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- Perfil de transportista ---------------------------------------------
  // Sólo lo ve y lo edita quien ya es transportista. Convertirse en uno, o
  // dejar de serlo, no se hace desde acá.
  const esTransportista = Boolean(user?.isCarrier);
  const [carrierProvinces, setCarrierProvinces] = useState<ProvinceResponse[]>([]);
  const [carrierLocalities, setCarrierLocalities] = useState<LocalityResponse[]>([]);
  const [carrierProvinceId, setCarrierProvinceId] = useState(user?.carrierBaseProvinceId || '');
  const [carrierPadronError, setCarrierPadronError] = useState('');

  // El padrón se pide recién al entrar en edición: en modo lectura alcanza con
  // el nombre de la localidad que ya viene en /auth/me.
  useEffect(() => {
    if (!isEditing || !esTransportista || carrierProvinces.length > 0) return;
    void getProvinces()
      .then((data) => {
        setCarrierProvinces(data);
        setCarrierPadronError('');
      })
      .catch(() => setCarrierPadronError('No se pudo cargar el padrón de provincias.'));
  }, [isEditing, esTransportista, carrierProvinces.length]);

  useEffect(() => {
    if (!isEditing || !esTransportista || !carrierProvinceId) return;
    // Si se cambia de provincia con una consulta en vuelo, la respuesta vieja
    // no puede pisar a la nueva.
    let vigente = true;
    void getLocalities(carrierProvinceId)
      .then((data) => {
        if (!vigente) return;
        setCarrierLocalities(data);
        setCarrierPadronError('');
      })
      .catch(() => {
        if (vigente) setCarrierPadronError('No se pudieron cargar las localidades.');
      });
    return () => {
      vigente = false;
    };
  }, [isEditing, esTransportista, carrierProvinceId]);

  // Cancelar devuelve los datos de transporte a lo guardado; si no, una edición
  // abandonada volvería a enviarse en el guardado siguiente.
  const handleCancelEdit = () => {
    setEditForm((current) => ({
      ...current,
      carrierBaseLocalityId: user?.carrierBaseLocalityId || '',
      carrierTransport: user?.carrierTransport || '',
      carrierTransportCertified: user?.carrierTransportCertified ?? false,
      carrierCoverageRadiusKm:
        user?.carrierCoverageRadiusKm != null ? String(user.carrierCoverageRadiusKm) : '',
      carrierCapacity: user?.carrierCapacity || '',
    }));
    setCarrierProvinceId(user?.carrierBaseProvinceId || '');
    setCarrierPadronError('');
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    const radio = Number(editForm.carrierCoverageRadiusKm);
    if (esTransportista && (!editForm.carrierCoverageRadiusKm.trim() || !(radio > 0))) {
      // El formulario no está dentro de un <form>, así que no hay validación
      // nativa: sin este freno el envío saldría sin radio y el backend
      // conservaría el anterior sin que nadie se entere.
      showToast('El radio de cobertura tiene que ser mayor que cero', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: editForm.name,
        phone: editForm.phone,
        location: `${editForm.address}, ${editForm.city}, ${editForm.province}`,
        cbu: editForm.cbu,
        bankAlias: editForm.bankAlias,
        // Los datos de transporte sólo salen si la cuenta es transportista;
        // para cualquier otra el cuerpo enviado es el mismo de antes.
        ...(esTransportista
          ? {
              carrierBaseLocalityId: editForm.carrierBaseLocalityId,
              carrierTransport: editForm.carrierTransport,
              carrierTransportCertified: editForm.carrierTransportCertified,
              carrierCoverageRadiusKm: radio,
              carrierCapacity: editForm.carrierCapacity,
            }
          : {}),
      });
      showToast('Perfil actualizado exitosamente', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Error al guardar perfil:', error);
      // El motivo real de la API dice qué corregir; el texto genérico queda
      // sólo para un fallo que no traiga mensaje.
      const motivo = error instanceof Error && error.message.trim()
        ? error.message
        : 'Error al guardar el perfil';
      showToast(motivo, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Helper para recargar órdenes
  const reloadOrders = async (role: 'buyer' | 'seller') => {
    try {
      const response = await apiGet<BackendOrder[]>(`/orders/my?as_role=${role}`);
      const mappedOrders: Order[] = response.map(o => ({
        id: o.order_number,
        date: o.created_at,
        status: mapBackendStatus(o.status),
        total: o.total_amount,
        items: o.items.map(i => ({
          productName: i.product_name_snapshot,
          quantity: i.quantity,
          price: i.unit_price_snapshot
        })),
        buyer: o.buyer_name ? {
          name: o.buyer_name,
          phone: o.buyer_phone || '',
          address: o.buyer_address || ''
        } : undefined,
        seller: o.seller_name ? {
          name: o.seller_name,
          phone: o.seller_phone || '',
          whatsapp: o.seller_whatsapp || o.seller_phone || ''
        } : undefined,
        transferReceiptUrl: o.transfer_receipt_url,
        rejectionReason: o.rejection_reason,
      }));
      
      if (role === 'buyer') {
        setPurchases(mappedOrders);
      } else {
        setSales(mappedOrders);
      }
    } catch (error) {
      console.error('Error al recargar órdenes:', error);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    const confirmed = await showConfirm({
      title: 'Confirmar pedido',
      message: '¿Confirmar este pedido?',
      confirmText: 'Confirmar',
      type: 'info'
    });
    if (!confirmed) return;
    
    try {
      await apiPatch(`/orders/${orderId}/status`, { status: 'confirmed' });
      showToast('Pedido confirmado exitosamente', 'success');
      await reloadOrders('seller');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al confirmar el pedido', 'error');
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const confirmed = await showConfirm({
      title: 'Rechazar pedido',
      message: '¿Estás seguro de rechazar este pedido?\n\nEsta acción restaurará el stock.',
      confirmText: 'Rechazar',
      type: 'danger'
    });
    if (!confirmed) return;
    
    try {
      await apiPost(`/orders/${orderId}/cancel`, {});
      showToast('Pedido rechazado y cancelado', 'warning');
      await reloadOrders('seller');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al rechazar el pedido', 'error');
    }
  };

  const handleMarkAsShipped = async (orderId: string) => {
    const confirmed = await showConfirm({
      title: 'Marcar como enviado',
      message: '¿Marcar este pedido como enviado?',
      confirmText: 'Marcar enviado',
      type: 'info'
    });
    if (!confirmed) return;
    
    try {
      await apiPatch(`/orders/${orderId}/status`, { status: 'shipped' });
      showToast('Pedido marcado como enviado', 'success');
      await reloadOrders('seller');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al marcar como enviado', 'error');
    }
  };

  const handleTransferDecision = async (orderId: string, decision: 'approve' | 'reject') => {
    const reason = decision === 'reject' ? window.prompt('Motivo del rechazo:')?.trim() : undefined;
    if (decision === 'reject' && !reason) return;
    try {
      await apiPatch(`/orders/${orderId}/transfer-receipt`, { decision, reason });
      showToast(
        decision === 'approve' ? 'Comprobante aprobado' : 'Comprobante rechazado',
        decision === 'approve' ? 'success' : 'warning',
      );
      await reloadOrders('seller');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo validar el comprobante', 'error');
    }
  };

  // Funciones para notificaciones
  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await apiPost(`/notifications/${notificationId}/read`, {});
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiPost('/notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      showToast('Todas las notificaciones marcadas como leídas', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al marcar notificaciones', 'error');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    // Optimistic update: eliminar de la UI inmediatamente
    const notification = notifications.find(n => n.id === notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Intentar eliminar en el servidor (ignorar errores 404 - ya no existe)
    try {
      await apiDelete(`/notifications/${notificationId}`);
    } catch {
      // Silenciar errores - la notificación ya fue eliminada de la UI
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      'order_placed': '🛒',
      'order_received': '📦',
      'order_confirmed': '✅',
      'order_shipped': '🚚',
      'order_delivered': '🎉',
      'order_cancelled': '❌',
      'order_rejected': '🚫',
      'payment_approved': '💳',
      'payment_failed': '⚠️',
      'product_sold': '💰',
      'welcome': '👋',
      'system': '🔔',
    };
    return icons[type] || '🔔';
  };

  const formatNotificationDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  const handleCancelPurchase = async (orderId: string) => {
    const confirmed = await showConfirm({
      title: 'Cancelar pedido',
      message: '¿Estás seguro de cancelar este pedido?\n\nEsta acción no se puede deshacer.',
      confirmText: 'Cancelar pedido',
      type: 'danger'
    });
    if (!confirmed) return;
    
    try {
      await apiPost(`/orders/${orderId}/cancel`, {});
      showToast('Pedido cancelado', 'success');
      await reloadOrders('buyer');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cancelar el pedido', 'error');
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    const confirmed = await showConfirm({
      title: 'Confirmar recepción',
      message: '¿Confirmar que recibiste el pedido?\n\nEsto marcará la venta como completada.',
      confirmText: 'Confirmar recepción',
      type: 'info'
    });
    if (!confirmed) return;
    
    try {
      await apiPatch(`/orders/${orderId}/status`, { status: 'delivered' });
      showToast('¡Pedido recibido! Gracias por tu compra.', 'success');
      await reloadOrders('buyer');
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al confirmar la recepción', 'error');
    }
  };

  // Función para abrir el modal de calificación
  const openRatingModal = (orderId: string, sellerName: string) => {
    setRatingModal({ orderId, sellerName });
    setRatingScore(5);
    setRatingComment('');
  };

  // Función para enviar la calificación
  const handleSubmitRating = async () => {
    if (!ratingModal) return;
    
    setSubmittingRating(true);
    try {
      await apiPost('/ratings/', {
        order_id: ratingModal.orderId,
        score: ratingScore,
        comment: ratingComment || null
      });
      
      showToast('¡Gracias por tu calificación!', 'success');
      setRatedOrders(prev => new Set(prev).add(ratingModal.orderId));
      setRatingModal(null);
    } catch (error: unknown) {
      console.error('Error al enviar calificación:', error);
      const errorMessage = error instanceof Error && 'message' in error 
        ? (error as { message?: string }).message 
        : 'Error al enviar la calificación';
      if (errorMessage?.includes('Ya has calificado')) {
        showToast('Ya calificaste esta orden', 'info');
        setRatedOrders(prev => new Set(prev).add(ratingModal.orderId));
        setRatingModal(null);
      } else {
        showToast('Error al enviar la calificación', 'error');
      }
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleToggleProductStatus = async (productId: string, currentStatus: UserProduct['status']) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const actionLabel = newStatus === 'active' ? 'activar' : 'pausar';
    
    const confirmed = await showConfirm({
      title: `${newStatus === 'active' ? 'Activar' : 'Pausar'} producto`,
      message: `¿Estás seguro de ${actionLabel} este producto?`,
      confirmText: newStatus === 'active' ? 'Activar' : 'Pausar',
      type: 'info'
    });
    if (!confirmed) return;
    
    try {
      await apiPatch(`/products/${productId}`, { status: newStatus });
      showToast(`Producto ${newStatus === 'active' ? 'activado' : 'pausado'} exitosamente`, 'success');
      
      // Recargar productos
      await reloadUserProducts();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      showToast('Error al cambiar el estado del producto', 'error');
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar producto',
      message: `¿Estás seguro de eliminar "${productName}"?\n\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      type: 'danger'
    });
    if (!confirmed) return;
    
    try {
      await apiDelete(`/products/${productId}`);
      showToast('Producto eliminado exitosamente', 'success');
      
      // Recargar productos
      await reloadUserProducts();
    } catch (error) {
      console.error('Error al eliminar:', error);
      showToast('Error al eliminar el producto', 'error');
    }
  };
  
  // Función helper para recargar productos
  const reloadUserProducts = async () => {
    try {
      const response = await apiGet<{ products: BackendProduct[]; total: number }>('/products/my');
      setBackendProducts(response.products);
      
      const convertedProducts: UserProduct[] = response.products.map((p: BackendProduct) => {
        const primaryImage = p.images?.find(img => img.is_primary)?.url || p.images?.[0]?.url;
        let status: UserProduct['status'] = 'active';
        if (p.stock === 0) status = 'sold-out';
        else if (p.status === 'draft' || p.status === 'paused') status = 'paused';
        
        return {
          id: p.id,
          name: p.name,
          category: p.category?.name || 'Sin categoría',
          price: p.price,
          stock: p.stock,
          image: getImageUrl(primaryImage),
          status,
          views: p.views_count || 0,
          likes: p.likes_count || 0,
          publishedDate: p.created_at,
        };
      });
      setUserProducts(convertedProducts);
    } catch (error) {
      console.error('Error al recargar productos:', error);
    }
  };

  const handleEditProduct = (productId: string) => {
    // Buscar el producto original del backend
    const product = backendProducts.find(p => p.id === productId);
    if (!product) {
      showToast('No se encontró el producto', 'error');
      return;
    }
    
    // Preparar imágenes existentes
    const existingImages = (product.images || []).map(img => ({
      id: img.id,
      url: img.url,
      is_primary: img.is_primary
    }));
    
    // Parsear ubicación (formato: "ciudad, provincia")
    const locationParts = (product.location || '').split(',').map(s => s.trim());
    const location_city = locationParts[0] || '';
    const location_province = locationParts[1] || '';
    
    // Determinar tipo de publicación
    const isService = product.publication_type === 'servicio';
    
    // Abrir modal de edición con los datos del producto
    setEditingProduct({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock?.toString() || '0',
      unit: product.unit || 'kg',
      category_id: product.category_id,
      category_name: product.category?.name || '',
      subcategory_id: product.subcategory_id || '',
      subcategory_name: product.subcategory?.name || '',
      location_province,
      location_city,
      existingImages,
      newImages: [],
      imagesToDelete: [],
      publication_type: isService ? 'servicio' : 'producto',
      // Campos de servicio
      pricing_type: product.pricing_type || 'por_hora',
      availability: product.availability || 'inmediata',
      response_time: product.response_time || '24hs',
      experience_years: product.experience_years?.toString() || '',
      has_equipment: product.has_equipment ?? true,
      coverage_zones: product.coverage_zones || [],
    });
  };
  
  const handleSaveEditProduct = async () => {
    if (!editingProduct) return;
    
    const price = parseFloat(editingProduct.price) || 0;
    const stock = parseInt(editingProduct.stock) || 0;
    const isService = editingProduct.publication_type === 'servicio';
    
    // Validaciones según tipo
    if (!isService && price <= 0) {
      showToast('El precio debe ser mayor a 0', 'warning');
      return;
    }
    if (!isService && stock < 0) {
      showToast('El stock no puede ser negativo', 'warning');
      return;
    }
    
    setIsSavingEdit(true);
    try {
      // Construir ubicación
      const location = editingProduct.location_city && editingProduct.location_province
        ? `${editingProduct.location_city}, ${editingProduct.location_province}`
        : '';
      
      // Construir payload base
      const payload: Record<string, unknown> = {
        name: editingProduct.name,
        description: editingProduct.description,
        price: price,
        location: location,
      };
      
      // Agregar subcategoría si existe
      if (editingProduct.subcategory_id) {
        payload.subcategory_id = editingProduct.subcategory_id;
      }
      
      // Campos específicos según tipo
      if (isService) {
        payload.pricing_type = editingProduct.pricing_type;
        payload.availability = editingProduct.availability;
        payload.response_time = editingProduct.response_time;
        payload.experience_years = editingProduct.experience_years ? parseInt(editingProduct.experience_years) : null;
        payload.has_equipment = editingProduct.has_equipment;
        payload.coverage_zones = editingProduct.coverage_zones;
      } else {
        payload.stock = stock;
        payload.unit = editingProduct.unit;
      }
      
      // 1. Actualizar datos del producto
      await apiPatch(`/products/${editingProduct.id}`, payload);
      
      // 2. Eliminar imágenes marcadas para eliminar
      for (const imageId of editingProduct.imagesToDelete) {
        try {
          await apiDelete(`/products/${editingProduct.id}/images/${imageId}`);
        } catch (err) {
          console.error('Error al eliminar imagen:', err);
        }
      }
      
      // 3. Subir nuevas imágenes
      const token = tokenStorage.getAccessToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      for (let i = 0; i < editingProduct.newImages.length; i++) {
        const image = editingProduct.newImages[i];
        const imageFormData = new FormData();
        imageFormData.append('files', image.file);
        // La primera imagen nueva es primaria solo si no hay imágenes existentes
        const isPrimary = editingProduct.existingImages.length === 0 && i === 0;
        imageFormData.append('is_primary', isPrimary.toString());
        
        await fetch(`${API_BASE_URL}/products/${editingProduct.id}/images`, {
          method: 'POST',
          body: imageFormData,
          credentials: 'include',
          headers,
        });
      }
      
      showToast('Producto actualizado exitosamente', 'success');
      setEditingProduct(null);
      
      // Recargar productos
      const response = await apiGet<{ products: BackendProduct[]; total: number }>('/products/my');
      setBackendProducts(response.products);
      
      const convertedProducts: UserProduct[] = response.products.map((p: BackendProduct) => {
        const primaryImage = p.images?.find(img => img.is_primary)?.url || p.images?.[0]?.url;
        let status: UserProduct['status'] = 'active';
        if (p.stock === 0) status = 'sold-out';
        else if (p.status === 'draft' || p.status === 'paused') status = 'paused';
        
        return {
          id: p.id,
          name: p.name,
          category: p.category?.name || 'Sin categoría',
          price: p.price,
          stock: p.stock || 0,
          image: getImageUrl(primaryImage),
          status,
          views: p.views_count || 0,
          likes: p.likes_count || 0,
          publishedDate: p.created_at,
        };
      });
      setUserProducts(convertedProducts);
      
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      showToast('Error al actualizar el producto', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };
  
  // Límite de imágenes por producto
  const MAX_IMAGES_PER_PRODUCT = 3;
  
  // Funciones para manejar imágenes en edición
  const handleAddEditImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingProduct || !e.target.files) return;
    
    const currentTotal = editingProduct.existingImages.length + editingProduct.newImages.length;
    const availableSlots = MAX_IMAGES_PER_PRODUCT - currentTotal;
    
    if (availableSlots <= 0) {
      showToast(`Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto`, 'warning');
      return;
    }
    
    const files = Array.from(e.target.files).slice(0, availableSlots);
    if (files.length < e.target.files.length) {
      showToast(`Solo se agregaron ${files.length} imagen(es). Máximo ${MAX_IMAGES_PER_PRODUCT}`, 'warning');
    }
    
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    
    setEditingProduct({
      ...editingProduct,
      newImages: [...editingProduct.newImages, ...newImages]
    });
  };
  
  const handleRemoveExistingImage = (imageId: string) => {
    if (!editingProduct) return;
    
    setEditingProduct({
      ...editingProduct,
      existingImages: editingProduct.existingImages.filter(img => img.id !== imageId),
      imagesToDelete: [...editingProduct.imagesToDelete, imageId]
    });
  };
  
  const handleRemoveNewImage = (index: number) => {
    if (!editingProduct) return;
    
    const newImages = [...editingProduct.newImages];
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    
    setEditingProduct({
      ...editingProduct,
      newImages
    });
  };

  const getStatusBadge = (status: Order['status']) => {
    const statusConfig = {
      pending: { label: 'Pendiente de Pago', color: '#b45309' },
      'awaiting-transfer-receipt': { label: 'Esperando Comprobante', color: '#b45309' },
      'transfer-receipt-submitted': { label: 'Comprobante a Revisar', color: '#0369a1' },
      paid: { label: 'Pagado', color: '#047857' },
      confirmed: { label: 'Confirmado', color: '#4a7c29' },
      'in-transit': { label: 'En Tránsito', color: '#0f766e' },
      delivered: { label: 'Entregado', color: '#2d5016' },
      cancelled: { label: 'Cancelado', color: '#d32f2f' },
      rejected: { label: 'Rechazado', color: '#dc2626' },
    };

    const config = statusConfig[status];
    return (
      <span className={styles.statusBadge} style={{ backgroundColor: config.color }}>
        {config.label}
      </span>
    );
  };

  // Fuera de la edición no hay control que etiquetar: el `for` apuntaría a un
  // id inexistente.
  const paraCampo = (id: string) => (isEditing ? id : undefined);

  const renderProfile = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Mi Perfil</h2>
        {!isEditing ? (
          <button className={styles.editButton} onClick={() => setIsEditing(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Editar
          </button>
        ) : (
          <div className={styles.editActions}>
            <button 
              className={styles.saveButton} 
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              className={styles.cancelButton}
              onClick={handleCancelEdit}
              disabled={isSavingProfile}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Estadísticas del usuario */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'linear-gradient(135deg, #4a7c29 0%, #2d5016 100%)'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.statInfo}>
            <p className={styles.statLabel}>Reputación</p>
            <p className={styles.statValue}>
              {(user?.ratingCount ?? 0) > 0 ? `⭐ ${(user?.ratingAverage ?? 0).toFixed(1)}` : '—'}
            </p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'linear-gradient(135deg, #52b788 0%, #2d6a4f 100%)'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.statInfo}>
            <p className={styles.statLabel}>Productos</p>
            <p className={styles.statValue}>{loadingProducts ? '...' : userProducts.length}</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'linear-gradient(135deg, #ffd93d 0%, #ffb703 100%)'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.statInfo}>
            <p className={styles.statLabel}>Ventas</p>
            <p className={styles.statValue}>{user?.salesCount ?? 0}</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="9" cy="21" r="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="20" cy="21" r="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.statInfo}>
            <p className={styles.statLabel}>Compras</p>
            <p className={styles.statValue}>{user?.purchasesCount ?? 0}</p>
          </div>
        </div>
      </div>

      <div className={styles.profileCard}>
        <div className={styles.avatarSection}>
          <div className={styles.avatar}>
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.userRating}>
            {(user?.ratingCount ?? 0) > 0 ? (
              <>
                <span className={styles.stars}>{'⭐'.repeat(Math.round(user?.ratingAverage ?? 0))}</span>
                <span className={styles.ratingValue}>{(user?.ratingAverage ?? 0).toFixed(1)}</span>
              </>
            ) : (
              <span className={styles.noRating}>Sin calificaciones</span>
            )}
          </div>
        </div>

        <div className={styles.profileForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Nombre Completo</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              ) : (
                <p>{user?.name}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              ) : (
                <p>{user?.email}</p>
              )}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Teléfono</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+54 9 11 1234-5678"
                />
              ) : (
                <p>{editForm.phone || 'No especificado'}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>WhatsApp</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editForm.whatsapp}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                  placeholder="+54 9 11 1234-5678"
                />
              ) : (
                <p>{editForm.whatsapp || 'No especificado'}</p>
              )}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Provincia</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.province}
                  onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
                />
              ) : (
                <p>{editForm.province || 'No especificada'}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Ciudad</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              ) : (
                <p>{editForm.city || 'No especificada'}</p>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Dirección</label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Calle, número, piso, depto"
              />
            ) : (
              <p>{editForm.address || 'No especificada'}</p>
            )}
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>CBU para transferencias</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.cbu}
                  onChange={(e) => setEditForm({ ...editForm, cbu: e.target.value })}
                  placeholder="CBU"
                />
              ) : (
                <p>{editForm.cbu || 'No configurado'}</p>
              )}
            </div>
            <div className={styles.formGroup}>
              <label>Alias bancario</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.bankAlias}
                  onChange={(e) => setEditForm({ ...editForm, bankAlias: e.target.value })}
                  placeholder="Alias"
                />
              ) : (
                <p>{editForm.bankAlias || 'No configurado'}</p>
              )}
            </div>
          </div>

          {esTransportista && (
            <>
              <h3 className={styles.carrierHeading}>Datos de transportista</h3>

              {carrierPadronError && (
                <p className={styles.carrierError} role="alert">{carrierPadronError}</p>
              )}

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor={paraCampo('perfil-provincia-base')}>Provincia base</label>
                  {isEditing ? (
                    <select
                      id="perfil-provincia-base"
                      value={carrierProvinceId}
                      onChange={(e) => {
                        // Elegir la misma provincia no es un cambio: vaciar la
                        // lista sin recargarla dejaría el selector de localidad
                        // en blanco para siempre.
                        if (e.target.value === carrierProvinceId) return;
                        setCarrierProvinceId(e.target.value);
                        setCarrierLocalities([]);
                        setEditForm({ ...editForm, carrierBaseLocalityId: '' });
                      }}
                    >
                      <option value="">Seleccionar provincia</option>
                      {carrierProvinces.map((province) => (
                        <option key={province.id} value={province.id}>{province.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p>{user?.carrierBaseProvinceName || 'No especificada'}</p>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={paraCampo('perfil-localidad-base')}>Localidad base</label>
                  {isEditing ? (
                    <select
                      id="perfil-localidad-base"
                      value={editForm.carrierBaseLocalityId}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        carrierBaseLocalityId: e.target.value,
                      })}
                      disabled={!carrierProvinceId}
                    >
                      <option value="">Seleccionar localidad</option>
                      {carrierLocalities.map((locality) => (
                        <option key={locality.id} value={locality.id}>{locality.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p>{user?.carrierBaseLocalityName || 'No especificada'}</p>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor={paraCampo('perfil-transporte')}>Transporte habilitado</label>
                {isEditing ? (
                  <input
                    id="perfil-transporte"
                    type="text"
                    value={editForm.carrierTransport}
                    onChange={(e) => setEditForm({ ...editForm, carrierTransport: e.target.value })}
                    placeholder="Camión con acoplado, dominio AB 123 CD"
                  />
                ) : (
                  <p>{user?.carrierTransport || 'No especificado'}</p>
                )}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor={paraCampo('perfil-radio')}>Radio de cobertura (km)</label>
                  {isEditing ? (
                    <input
                      id="perfil-radio"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editForm.carrierCoverageRadiusKm}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        carrierCoverageRadiusKm: e.target.value,
                      })}
                    />
                  ) : (
                    <p>
                      {user?.carrierCoverageRadiusKm != null
                        ? `${user.carrierCoverageRadiusKm} km`
                        : 'No especificado'}
                    </p>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={paraCampo('perfil-capacidad')}>Capacidad de carga</label>
                  {isEditing ? (
                    <input
                      id="perfil-capacidad"
                      type="text"
                      value={editForm.carrierCapacity}
                      onChange={(e) => setEditForm({ ...editForm, carrierCapacity: e.target.value })}
                      placeholder="Hasta 40 toneladas de semillas"
                    />
                  ) : (
                    <p>{user?.carrierCapacity || 'No especificada'}</p>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                {isEditing ? (
                  <label className={styles.carrierCheckbox} htmlFor="perfil-habilitacion">
                    <input
                      id="perfil-habilitacion"
                      type="checkbox"
                      checked={editForm.carrierTransportCertified}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        carrierTransportCertified: e.target.checked,
                      })}
                    />
                    Declaro que el transporte está habilitado
                  </label>
                ) : (
                  <>
                    <label>Declaración de habilitación</label>
                    <p>
                      {user?.carrierTransportCertified
                        ? 'Declarada por el titular'
                        : 'Sin declarar'}
                    </p>
                  </>
                )}
              </div>
            </>
          )}

          <div className={styles.privacyNote}>
            🔒 Tu información de contacto solo se comparte con los compradores después de que confirmen la compra
          </div>
        </div>
      </div>

    </div>
  );

  const renderPurchases = () => {
    const filteredPurchases = filterStatus === 'all' 
      ? purchases 
      : purchases.filter(order => order.status === filterStatus);

    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Mis Compras</h2>
          <span className={styles.count}>{purchases.length} pedidos</span>
        </div>

        {loadingOrders ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⏳</div>
            <h3>Cargando tus compras...</h3>
          </div>
        ) : purchases.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🛒</div>
            <h3>Aún no tienes compras</h3>
            <p>Explora el marketplace y realiza tu primera compra</p>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className={styles.filterBar}>
              <button 
                className={`${styles.filterButton} ${filterStatus === 'all' ? styles.filterActive : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                Todos ({purchases.length})
              </button>
              <button 
                className={`${styles.filterButton} ${filterStatus === 'pending' ? styles.filterActive : ''}`}
                onClick={() => setFilterStatus('pending')}
              >
                Pendientes ({purchases.filter(o => o.status === 'pending').length})
              </button>
              <button 
                className={`${styles.filterButton} ${filterStatus === 'in-transit' ? styles.filterActive : ''}`}
                onClick={() => setFilterStatus('in-transit')}
              >
                En tránsito ({purchases.filter(o => o.status === 'in-transit').length})
              </button>
              <button 
                className={`${styles.filterButton} ${filterStatus === 'delivered' ? styles.filterActive : ''}`}
                onClick={() => setFilterStatus('delivered')}
              >
                Entregados ({purchases.filter(o => o.status === 'delivered').length})
              </button>
            </div>

            <div className={styles.ordersList}>
              {filteredPurchases.map((order) => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div>
                    <h3>Pedido #{order.id}</h3>
                    <p className={styles.orderDate}>📅 {new Date(order.date).toLocaleDateString('es-AR')}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className={styles.orderItems}>
                  {order.items.map((item, index) => (
                    <div key={index} className={styles.orderItem}>
                      <span className={styles.itemName}>{item.productName}</span>
                      <span className={styles.itemQuantity}>x{item.quantity}</span>
                      <span className={styles.itemPrice}>
                        ${item.price.toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.orderTotal}>
                  <strong>Total:</strong> ${order.total.toLocaleString('es-AR')}
                </div>

                {order.rejectionReason && (
                  <div className={styles.contactInfo}>
                    <strong>Motivo del rechazo:</strong> {order.rejectionReason}
                  </div>
                )}

                {order.seller && (order.status === 'confirmed' || order.status === 'in-transit' || order.status === 'delivered') && (
                  <div className={styles.contactInfo}>
                    <div className={styles.unlocked}>🔓 Información de Contacto del Vendedor</div>
                    <p><strong>{order.seller.name}</strong></p>
                    <p>📞 {order.seller.phone}</p>
                    <a 
                      href={`https://wa.me/${order.seller.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.whatsappButton}
                    >
                      💬 Contactar por WhatsApp
                    </a>
                  </div>
                )}
                
                {/* Acciones del comprador */}
                <div className={styles.orderActions}>
                  {(order.status === 'pending' || order.status === 'paid'
                    || order.status === 'confirmed'
                    || order.status === 'awaiting-transfer-receipt') && (
                    <button
                      className={styles.rejectButton}
                      onClick={() => handleCancelPurchase(order.id)}
                    >
                      ❌ Cancelar Pedido
                    </button>
                  )}
                  {order.status === 'in-transit' && (
                    <button 
                      className={styles.confirmButton}
                      onClick={() => handleConfirmDelivery(order.id)}
                    >
                      ✅ Confirmar Recepción
                    </button>
                  )}
                  {order.status === 'delivered' && !ratedOrders.has(order.id) && (
                    <button 
                      className={styles.confirmButton}
                      onClick={() => openRatingModal(order.id, order.seller?.name || 'Vendedor')}
                    >
                      ⭐ Calificar Vendedor
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
    );
  };

  const renderSales = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Mis Ventas</h2>
        <span className={styles.count}>{sales.length} pedidos</span>
      </div>

      {loadingOrders ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⏳</div>
          <h3>Cargando tus ventas...</h3>
        </div>
      ) : sales.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>💰</div>
          <h3>Aún no tienes ventas</h3>
          <p>Publica productos y espera a que los compradores te encuentren</p>
        </div>
      ) : (
        <div className={styles.ordersList}>
          {sales.map((order) => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <div>
                  <h3>Venta #{order.id}</h3>
                  <p className={styles.orderDate}>📅 {new Date(order.date).toLocaleDateString('es-AR')}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className={styles.orderItems}>
                {order.items.map((item, index) => (
                  <div key={index} className={styles.orderItem}>
                    <span className={styles.itemName}>{item.productName}</span>
                    <span className={styles.itemQuantity}>x{item.quantity}</span>
                    <span className={styles.itemPrice}>
                      ${item.price.toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.orderTotal}>
                <strong>Total:</strong> ${order.total.toLocaleString('es-AR')}
              </div>

              {order.buyer && order.status !== 'cancelled' && (
                <div className={styles.contactInfo}>
                  <div className={styles.unlocked}>🔓 Información del Comprador</div>
                  <p><strong>{order.buyer.name}</strong></p>
                  <p>📞 {order.buyer.phone}</p>
                  <p>📍 {order.buyer.address}</p>
                </div>
              )}

              {order.transferReceiptUrl && (
                <div className={styles.contactInfo}>
                  <div className={styles.unlocked}>🏦 Comprobante de transferencia</div>
                  <a
                    href={getImageUrl(order.transferReceiptUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver comprobante
                  </a>
                </div>
              )}

              <div className={styles.orderActions}>
                {(order.status === 'transfer-receipt-submitted'
                  || order.status === 'awaiting-transfer-receipt') && (
                  <>
                    <p>
                      <strong>Verificá el dinero en tu cuenta bancaria antes de aprobar.</strong>{' '}
                      {order.status === 'transfer-receipt-submitted' ? (
                        <>
                          Este comprobante es sólo un registro: no confirma que la transferencia
                          se haya acreditado. No apruebes si el importe acreditado no coincide con
                          el total de la orden.
                        </>
                      ) : (
                        <>
                          El comprador todavía no adjuntó comprobante. Si ya viste la
                          acreditación en tu cuenta, aprobá igual; si no llegó, rechazá la orden
                          indicando el motivo.
                        </>
                      )}
                    </p>
                    <button
                      className={styles.confirmButton}
                      onClick={() => handleTransferDecision(order.id, 'approve')}
                    >
                      {order.status === 'transfer-receipt-submitted'
                        ? '✅ Aprobar comprobante'
                        : '✅ Aprobar transferencia'}
                    </button>
                    <button
                      className={styles.rejectButton}
                      onClick={() => handleTransferDecision(order.id, 'reject')}
                    >
                      {order.status === 'transfer-receipt-submitted'
                        ? '❌ Rechazar comprobante'
                        : '❌ Rechazar transferencia'}
                    </button>
                  </>
                )}
                {(order.status === 'pending' || order.status === 'paid') && (
                  <>
                    {order.status === 'paid' && (
                      <button 
                        className={styles.confirmButton}
                        onClick={() => handleConfirmOrder(order.id)}
                      >
                        ✅ Confirmar Pedido
                      </button>
                    )}
                    <button 
                      className={styles.rejectButton}
                      onClick={() => handleRejectOrder(order.id)}
                    >
                      ❌ Rechazar
                    </button>
                  </>
                )}
                {order.status === 'confirmed' && (
                  <>
                    <button 
                      className={styles.confirmButton}
                      onClick={() => handleMarkAsShipped(order.id)}
                    >
                      🚚 Marcar como Enviado
                    </button>
                    <button 
                      className={styles.rejectButton}
                      onClick={() => handleRejectOrder(order.id)}
                    >
                      ❌ Cancelar Venta
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProducts = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Mis Productos</h2>
        <button 
          className={styles.addButton}
          onClick={onPublishClick}
        >
          + Publicar Producto
        </button>
      </div>

      {loadingProducts ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⏳</div>
          <h3>Cargando tus productos...</h3>
        </div>
      ) : productsError ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3>Error al cargar productos</h3>
          <p>{productsError}</p>
        </div>
      ) : userProducts.length > 0 ? (
        <div className={styles.productsGrid}>
          {userProducts.map((product) => (
            <div key={product.id} className={styles.productCard}>
              <div className={styles.productImage}>
                <ProductImage src={product.image} alt={product.name} />
                <div className={`${styles.productStatusBadge} ${styles[`status-${product.status}`]}`}>
                  {product.status === 'active' && '✅ Activo'}
                  {product.status === 'paused' && '⏸️ Pausado'}
                  {product.status === 'sold-out' && '❌ Agotado'}
                </div>
              </div>

              <div className={styles.productInfo}>
                <h3>{product.name}</h3>
                <p className={styles.productCategory}>{product.category}</p>
                
                <div className={styles.productMeta}>
                  <div className={styles.productPrice}>
                    <strong>${product.price.toLocaleString('es-AR')}</strong>
                  </div>
                  <div className={styles.productStock}>
                    Stock: {product.stock} unidades
                  </div>
                </div>

                <div className={styles.productStats}>
                  <span title="Vistas">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {product.views}
                  </span>
                  <span title="Me gusta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {product.likes}
                  </span>
                </div>

                <div className={styles.productActions}>
                  <button 
                    className={styles.editBtn}
                    onClick={() => handleEditProduct(product.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Editar
                  </button>

                  {product.status !== 'sold-out' && (
                    <button 
                      className={styles.toggleBtn}
                      onClick={() => handleToggleProductStatus(product.id, product.status)}
                    >
                      {product.status === 'active' ? '⏸️ Pausar' : '▶️ Activar'}
                    </button>
                  )}

                  <button 
                    className={styles.deleteBtn}
                    aria-label={`Eliminar ${product.name}`}
                    onClick={() => handleDeleteProduct(product.id, product.name)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📦</div>
          <h3>Aún no tienes productos publicados</h3>
          <p>Comienza a vender tus productos agrícolas en TopGreen</p>
          <button 
            className={styles.primaryButton}
            onClick={onPublishClick}
          >
            + Publicar mi primer producto
          </button>
        </div>
      )}
    </div>
  );

  const renderNotifications = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>🔔 Notificaciones</h2>
        {notifications.length > 0 && unreadCount > 0 && (
          <button 
            className={styles.markAllReadBtn}
            onClick={handleMarkAllNotificationsRead}
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {loadingNotifications ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Cargando notificaciones...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔔</div>
          <h3>No tienes notificaciones</h3>
          <p>Cuando ocurran eventos importantes, las verás aquí</p>
        </div>
      ) : (
        <div className={styles.notificationsList}>
          {notifications.map(notification => (
            <div 
              key={notification.id}
              className={`${styles.notificationItem} ${!notification.is_read ? styles.unread : ''}`}
              onClick={() => !notification.is_read && handleMarkNotificationRead(notification.id)}
            >
              <div className={styles.notificationIcon}>
                {getNotificationIcon(notification.type)}
              </div>
              <div className={styles.notificationContent}>
                <div className={styles.notificationHeader}>
                  <h4>{notification.title}</h4>
                  <span className={styles.notificationTime}>
                    {formatNotificationDate(notification.created_at)}
                  </span>
                </div>
                <p className={styles.notificationMessage}>{notification.message}</p>
              </div>
              <button 
                className={styles.deleteNotificationBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNotification(notification.id);
                }}
                title="Eliminar notificación"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>
          ×
        </button>

        <div className={styles.header}>
          <h1>Mi Panel</h1>
          <p>Gestiona tu perfil, compras y ventas</p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'profile' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mi Perfil
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'notifications' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Notificaciones
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'purchases' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('purchases')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="9" cy="21" r="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="20" cy="21" r="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mis Compras
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'sales' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mis Ventas
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'products' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mis Productos
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'notifications' && renderNotifications()}
          {activeTab === 'purchases' && renderPurchases()}
          {activeTab === 'sales' && renderSales()}
          {activeTab === 'products' && renderProducts()}
        </div>
      </div>
      
      {/* Modal de Edición de Producto */}
      {editingProduct && (
        <div className={styles.editModalOverlay} onClick={() => setEditingProduct(null)}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.editModalHeader}>
              <h2>✏️ Editar {editingProduct.publication_type === 'servicio' ? 'Servicio' : 'Producto'}</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setEditingProduct(null)}
              >
                ×
              </button>
            </div>
            
            <div className={styles.editModalContent}>
              {/* Nombre */}
              <div className={styles.editFormGroup}>
                <label>Nombre del {editingProduct.publication_type === 'servicio' ? 'Servicio' : 'Producto'}</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    name: e.target.value
                  })}
                />
              </div>
              
              {/* Descripción */}
              <div className={styles.editFormGroup}>
                <label>Descripción</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    description: e.target.value
                  })}
                  rows={4}
                />
              </div>
              
              {/* Categoría y Subcategoría */}
              <div className={styles.editFormRow}>
                <div className={styles.editFormGroup}>
                  <label>Categoría</label>
                  <input
                    type="text"
                    value={editingProduct.category_name}
                    disabled
                    className={styles.disabledInput}
                  />
                  <small>La categoría no se puede cambiar</small>
                </div>
                
                <div className={styles.editFormGroup}>
                  <label>Subcategoría</label>
                  <select
                    value={editingProduct.subcategory_id}
                    onChange={(e) => {
                      const selectedSubcat = categories
                        .find(c => c.id === editingProduct.category_id)
                        ?.subcategories.find(s => s.id === e.target.value);
                      setEditingProduct({
                        ...editingProduct,
                        subcategory_id: e.target.value,
                        subcategory_name: selectedSubcat?.name || ''
                      });
                    }}
                  >
                    <option value="">Sin subcategoría</option>
                    {categories
                      .find(c => c.id === editingProduct.category_id)
                      ?.subcategories?.filter(s => s.is_active)
                      .map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>
              
              {/* Precio, Stock y Unidad - Solo para productos */}
              {editingProduct.publication_type === 'producto' ? (
                <div className={styles.editFormRow}>
                  <div className={styles.editFormGroup}>
                    <label>Precio ($)</label>
                    <input
                      type="text"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        price: e.target.value
                      })}
                      placeholder="0"
                    />
                  </div>
                  
                  <div className={styles.editFormGroup}>
                    <label>Stock</label>
                    <input
                      type="text"
                      value={editingProduct.stock}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        stock: e.target.value
                      })}
                      placeholder="0"
                    />
                  </div>
                  
                  <div className={styles.editFormGroup}>
                    <label>Unidad</label>
                    <select
                      value={editingProduct.unit}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        unit: e.target.value
                      })}
                    >
                      <option value="kg">kg</option>
                      <option value="ton">ton</option>
                      <option value="litros">litros</option>
                      <option value="unidad">unidad</option>
                      <option value="bolsa">bolsa</option>
                    </select>
                  </div>
                </div>
              ) : (
                /* Campos para servicios */
                <>
                  <div className={styles.editFormRow}>
                    <div className={styles.editFormGroup}>
                      <label>Tipo de Precio</label>
                      <select
                        value={editingProduct.pricing_type || 'por_hora'}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          pricing_type: e.target.value
                        })}
                      >
                        <option value="por_hora">Por hora</option>
                        <option value="por_hectarea">Por hectárea</option>
                        <option value="por_trabajo">Por trabajo</option>
                        <option value="a_convenir">A convenir</option>
                      </select>
                    </div>
                    
                    <div className={styles.editFormGroup}>
                      <label>Precio ($)</label>
                      <input
                        type="text"
                        value={editingProduct.price}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          price: e.target.value
                        })}
                        placeholder={editingProduct.pricing_type === 'a_convenir' ? '0' : 'Precio'}
                        disabled={editingProduct.pricing_type === 'a_convenir'}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.editFormRow}>
                    <div className={styles.editFormGroup}>
                      <label>Disponibilidad</label>
                      <select
                        value={editingProduct.availability || 'inmediata'}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          availability: e.target.value
                        })}
                      >
                        <option value="inmediata">Inmediata</option>
                        <option value="programar">A programar</option>
                        <option value="temporada">Solo en temporada</option>
                      </select>
                    </div>
                    
                    <div className={styles.editFormGroup}>
                      <label>Tiempo de respuesta</label>
                      <select
                        value={editingProduct.response_time || '24hs'}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          response_time: e.target.value
                        })}
                      >
                        <option value="inmediato">Inmediato</option>
                        <option value="24hs">24 horas</option>
                        <option value="48hs">48 horas</option>
                        <option value="1_semana">1 semana</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className={styles.editFormRow}>
                    <div className={styles.editFormGroup}>
                      <label>Años de experiencia</label>
                      <input
                        type="number"
                        value={editingProduct.experience_years || ''}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          experience_years: e.target.value
                        })}
                        placeholder="Opcional"
                        min="0"
                      />
                    </div>
                    
                    <div className={styles.editFormGroup}>
                      <label>¿Cuenta con equipamiento?</label>
                      <select
                        value={editingProduct.has_equipment ? 'true' : 'false'}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          has_equipment: e.target.value === 'true'
                        })}
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              
              {/* Ubicación */}
              <div className={styles.editFormRow}>
                <div className={styles.editFormGroup}>
                  <label>Provincia</label>
                  <select
                    value={editingProduct.location_province}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      location_province: e.target.value
                    })}
                  >
                    <option value="">Seleccionar...</option>
                    {PROVINCES.map(prov => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
                
                <div className={styles.editFormGroup}>
                  <label>Ciudad</label>
                  <input
                    type="text"
                    value={editingProduct.location_city}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      location_city: e.target.value
                    })}
                    placeholder="Ej: Rosario"
                  />
                </div>
              </div>
              
              {/* Sección de Imágenes */}
              <div className={styles.editFormGroup}>
                <label>📷 Imágenes del {editingProduct.publication_type === 'servicio' ? 'Servicio' : 'Producto'}</label>
                <div className={styles.editImagesContainer}>
                  {/* Imágenes existentes */}
                  {editingProduct.existingImages.map((img, index) => (
                    <div key={`existing-${index}`} className={styles.editImageItem}>
                      <ProductImage src={getImageUrl(img.url)} alt={`Imagen ${index + 1}`} />
                      <button
                        type="button"
                        className={styles.removeImageBtn}
                        onClick={() => handleRemoveExistingImage(img.id)}
                        title="Eliminar imagen"
                      >
                        ✕
                      </button>
                      {img.is_primary && <span className={styles.primaryBadge}>Principal</span>}
                    </div>
                  ))}
                  
                  {/* Imágenes nuevas */}
                  {editingProduct.newImages.map((img, index) => (
                    <div key={`new-${index}`} className={styles.editImageItem}>
                      <ProductImage src={img.preview} alt={`Nueva imagen ${index + 1}`} />
                      <button
                        type="button"
                        className={styles.removeImageBtn}
                        onClick={() => handleRemoveNewImage(index)}
                        title="Eliminar imagen"
                      >
                        ✕
                      </button>
                      <span className={styles.newBadge}>Nueva</span>
                    </div>
                  ))}
                  
                  {/* Botón para agregar imagen (solo si no está en el límite) */}
                  {(editingProduct.existingImages.length + editingProduct.newImages.length) < MAX_IMAGES_PER_PRODUCT && (
                    <label className={styles.addImageBtn}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAddEditImage}
                        style={{ display: 'none' }}
                      />
                      <span>+ Agregar</span>
                    </label>
                  )}
                </div>
                <small style={{ color: '#666', marginTop: '8px', display: 'block' }}>
                  {editingProduct.existingImages.length + editingProduct.newImages.length} de {MAX_IMAGES_PER_PRODUCT} imágenes
                  {(editingProduct.existingImages.length + editingProduct.newImages.length) >= MAX_IMAGES_PER_PRODUCT && 
                    ' (máximo alcanzado)'}
                </small>
              </div>
            </div>
            
            <div className={styles.editModalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setEditingProduct(null)}
              >
                Cancelar
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSaveEditProduct}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Calificación */}
      {ratingModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setRatingModal(null)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '30px',
              width: '90%',
              maxWidth: '450px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, color: '#2d5016', fontSize: '1.5rem' }}>
                ⭐ Calificar a {ratingModal.sellerName}
              </h2>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#333' }}>
                Tu calificación
              </label>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', fontSize: '2.5rem' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRatingScore(star);
                    }}
                    style={{ 
                      color: star <= ratingScore ? '#b45309' : '#5c636a',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, color 0.2s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {star <= ratingScore ? '★' : '☆'}
                  </span>
                ))}
              </div>
              <p style={{ textAlign: 'center', marginTop: '12px', color: '#666', fontSize: '1.1rem' }}>
                {ratingScore === 1 && '😞 Muy malo'}
                {ratingScore === 2 && '😕 Malo'}
                {ratingScore === 3 && '😐 Regular'}
                {ratingScore === 4 && '🙂 Bueno'}
                {ratingScore === 5 && '😃 Excelente'}
              </p>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                Comentario (opcional)
              </label>
              <textarea
                value={ratingComment}
                onChange={(e) => {
                  e.stopPropagation();
                  setRatingComment(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="Cuéntanos tu experiencia con el vendedor..."
                rows={4}
                maxLength={500}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '2px solid #ddd',
                  fontSize: '1rem',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              <small style={{ color: '#888' }}>{ratingComment.length}/500 caracteres</small>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRatingModal(null);
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '2px solid #ddd',
                  backgroundColor: 'white',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubmitRating();
                }}
                disabled={submittingRating}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: submittingRating ? '#ccc' : '#2d5016',
                  color: 'white',
                  cursor: submittingRating ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                {submittingRating ? 'Enviando...' : '✓ Enviar Calificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
