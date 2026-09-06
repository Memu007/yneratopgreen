import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './UserDashboard.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { apiGet, apiPatch, apiDelete, apiPost, apiUpload, apiBlob } from '../../utils/api';
import { revisarElPrecio } from '../../publicaciones/precio';
import {
  fraseDeImagenesFallidas,
  subirImagenDePublicacion,
} from '../../publicaciones/imagenes';
import { explicarMP, type VinculoMP } from '../../utils/mercadoPago';
import { ETIQUETA_DE_ESTADO, type MiDocumentacion } from '../../utils/documentacion';
import { type TipoDeCarga } from '../../utils/logistica';
import { ProductImage } from '../ProductImage/ProductImage';
import { User } from '../../types';
import {
  getLocalities,
  getProvinces,
  LocalityResponse,
  ProvinceResponse,
} from '../../utils/catalogService';
import {
  Condition,
  OperationKind,
  ETIQUETA_DE_ANATOMIA,
  ETIQUETA_DE_CONDICION,
  esDeServicio,
  normalizarAnatomia,
  normalizarCondicion,
} from '../../utils/anatomia';
import {
  etiquetaDeCatalogo,
  formatCantidad,
  formatPrice,
  precioVisible,
} from '../../utils/formatters';
import { useCapaModal } from '../../hooks/useCapaModal';
import { huboCambios, useSalidaProtegida } from '../../formularios/salidaProtegida';

type TabType = 'profile' | 'notifications' | 'purchases' | 'sales' | 'products'
  | 'operations';

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

/**
 * Cómo se traslada una orden. `mode` ausente es una orden anterior a la
 * logística: traslado no definido, que no es lo mismo que cuenta propia.
 */
interface TrasladoDeLaOrden {
  mode?: 'carrier' | 'self' | null;
  carrier_name?: string;
  carrier_base?: string;
  carrier_transport?: string;
  carrier_vehicle_model?: string;
  carrier_cargo_declared?: string[];
  carrier_capacity?: string;
  carrier_certification_detail?: string;
  carrier_certification_declared_at?: string;
  carrier_email?: string;
  carrier_phone?: string;
  carrier_whatsapp?: string;
  // Con el contacto: en una orden la selección ya ocurrió.
  carrier_plate?: string;
}

/** Una operación asignada, tal como la ve el transportista. */
interface OperacionAsignada {
  order_id: string;
  order_number: string;
  created_at: string;
  seller_name: string;
  origins: { id: string; name: string; province_name: string }[];
  destination?: { id: string; name: string; province_name: string } | null;
  items: { product_name: string; quantity: number }[];
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
  // El snapshot bancario de la orden. Es de CUANDO SE COMPRÓ, no lo que el
  // vendedor tenga hoy: si cambia su CBU mañana, esta orden sigue diciendo a
  // dónde se acordó transferir.
  seller_cbu?: string;
  seller_alias_bancario?: string;
  seller_bank_holder?: string;
  transfer_receipt_url?: string;
  rejection_reason?: string;
  shipping?: TrasladoDeLaOrden;
  payment_method?: string;
  payment_url?: string;
  can_pay?: boolean;
  payment_state?: string;
}

interface Order {
  id: string;
  /** El identificador real de la orden. `id` es el número que se muestra. */
  orderId: string;
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
  /** A dónde va la plata de ESTA orden, congelado al comprarla. */
  transferencia?: {
    cbu?: string;
    alias?: string;
    titular?: string;
  };
  rejectionReason?: string;
  shipping?: TrasladoDeLaOrden;
  /**
   * Lo del pago, y sólo para el comprador: el servidor manda el link y si la
   * orden todavía se puede pagar. La pantalla no lo deduce del estado.
   */
  paymentMethod?: string;
  paymentUrl?: string;
  canPay?: boolean;
  /**
   * En qué anda el pago por Mercado Pago, dicho por el servidor después de
   * preguntárselo a Mercado Pago. Lo ven el comprador y el vendedor, y dice
   * lo mismo para los dos.
   */
  paymentState?: string;
}

/**
 * Qué se le dice a una persona sobre el pago de su orden por Mercado Pago.
 *
 * Las mismas palabras para el comprador y para el vendedor: si a uno le
 * dijéramos «aprobado» y al otro «pendiente», el que despacha y el que reclama
 * estarían mirando dos verdades distintas.
 *
 * Ninguno de estos textos sale de la URL por la que volvió nadie. Salen del
 * servidor, que se lo preguntó a Mercado Pago.
 */
const TEXTO_DEL_PAGO: Record<string, { texto: string; problema?: boolean }> = {
  pendiente: {
    texto: 'Todavía no hay ningún pago registrado en Mercado Pago para esta orden.',
  },
  en_proceso: {
    texto:
      'Mercado Pago está procesando el pago. Cuando se acredite, la orden va a '
      + 'figurar como pagada sola.',
  },
  aprobado: { texto: 'Pago acreditado en Mercado Pago.' },
  en_revision: {
    texto:
      'Mercado Pago registró más de un pago aprobado para esta orden. La '
      + 'mercadería se descontó una sola vez y no se devolvió plata sola: hace '
      + 'falta revisar los pagos antes de seguir.',
    problema: true,
  },
  rechazado: {
    texto:
      'El último intento de pago fue rechazado. Se puede volver a intentar con '
      + 'el mismo link mientras siga vigente.',
    problema: true,
  },
  devuelto: {
    texto:
      'Mercado Pago informó una devolución de este pago. Revisalo antes de '
      + 'despachar.',
    problema: true,
  },
  contracargo: {
    texto:
      'Este pago tiene un contracargo: el dinero se retiró. Revisalo antes de '
      + 'despachar.',
    problema: true,
  },
  cancelado: { texto: 'El pago de esta orden quedó cancelado.' },
};

interface UserProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  /** La anatomía declarada. Decide qué muestra la tarjeta del panel, igual
   *  que en el catálogo: un servicio no tiene stock ni fotografía. */
  operationKind?: string;
  unit?: string;
  pricingType?: string;
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
  // `location` es el texto derivado que el Backend arma a partir de la
  // localidad. Se conserva para lo que ya lo lee, pero NO es la fuente.
  location?: string;
  // La ubicación oficial de la publicación: su identificador del padrón y lo
  // mínimo para dibujar los selects. Una fila heredada las trae en null.
  locality_id?: string | null;
  locality?: {
    id: string;
    name: string;
    province_id: string;
    province_name: string;
  } | null;
  images?: Array<{ id: string; url: string; is_primary: boolean }>;
  status: string;
  views_count: number;
  likes_count: number;
  created_at: string;
  publication_type?: string;
  operation_kind?: string;
  condition?: string | null;
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
  /** La ubicación oficial de la publicación. Vacío quiere decir que no
   *  tiene: no se adivina una desde texto libre ni desde el perfil. */
  locality_id: string;
  /** Sólo gobierna qué localidades se ofrecen. Lo que se guarda es la
   *  localidad, nunca la provincia sola. */
  province_id: string;
  existingImages: Array<{ id: string; url: string; is_primary: boolean }>;
  newImages: Array<{ file: File; preview: string }>;
  imagesToDelete: string[];
  publication_type: 'producto' | 'servicio';
  // La anatomía declarada. Se puede corregir: los registros anteriores a la
  // columna tomaron la que declara su categoría, y sólo el vendedor sabe si
  // lo que publicó es una máquina única o un insumo con stock.
  operation_kind: OperationKind;
  condition: Condition | '';
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
  // Sin URL no se inventa una imagen. Aca habia una SEGUNDA copia del SVG en
  // data-URI -fondo verde claro, Arial, «Sin Imagen» con un simbolo-: la del
  // catalogo se retiro en la entrega anterior y esta quedo viva en el panel,
  // que es exactamente donde la captura la mostro. Con la cadena vacia manda
  // `ProductImage`, que dice «Sin registro fotografico» con el respaldo del sistema.
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${IMAGES_BASE_URL}${url}`;
};

/**
 * Una publicación del backend, como la dibuja el panel.
 *
 * Esta conversión vivía copiada tres veces —carga inicial, recarga después de
 * pausar, activar o eliminar, y recarga después de editar— y las copias no
 * decían lo mismo: dos perdían la anatomía, la unidad y la modalidad, y
 * marcaban «Agotado» por stock 0 a publicaciones que no reservan unidades.
 * Así, pausar un servicio lo dejaba sin botón para reactivarlo. Es una sola
 * conversión para que las tres pantallas no puedan volver a divergir.
 */
const aPublicacionDelPanel = (p: BackendProduct): UserProduct => {
  // La imagen principal, si la hay.
  const primaria = p.images?.find((img) => img.is_primary)?.url || p.images?.[0]?.url;

  // «Agotado» sólo existe donde hay unidades que agotar. Un servicio no
  // reserva stock —lo decide su anatomía— y sin embargo la fila guarda 0,
  // porque la columna tiene ese valor por omisión y el alta le pasa NULL. En
  // una publicación de servicio manda su estado real: activo o pausado.
  const usaStock = !esDeServicio(normalizarAnatomia(p.operation_kind));
  let status: UserProduct['status'] = 'active';
  if (usaStock && p.stock === 0) status = 'sold-out';
  else if (p.status === 'draft' || p.status === 'paused') status = 'paused';

  return {
    id: p.id,
    name: p.name,
    category: p.category?.name || 'Sin categoría',
    price: p.price,
    stock: p.stock,
    operationKind: p.operation_kind,
    unit: p.unit,
    pricingType: p.pricing_type,
    image: getImageUrl(primaria),
    status,
    views: p.views_count || 0,
    likes: p.likes_count || 0,
    publishedDate: p.created_at,
  };
};

// Único armador del formulario de perfil. Sale de la cuenta y de nada más: lo
// que no está guardado empieza vacío, nunca con un dato de ejemplo. Hidratar y
// cancelar usan esta misma función, así no pueden divergir.
/** El retrato de una edición. Los archivos nuevos entran por nombre: un
 *  `File` no se puede serializar y lo que importa es cuáles se agregaron. */
const retratoDeLaEdicion = (edicion: EditFormData | null) => (edicion
  ? { ...edicion, newImages: edicion.newImages.map((imagen) => imagen.file.name) }
  : null);

const formularioDesde = (cuenta: User | null) => ({
  name: cuenta?.name || '',
  phone: cuenta?.phone || '',
  whatsapp: cuenta?.whatsapp || '',
  // La ubicación es un texto libre y se conserva tal cual está guardado.
  // Partirla en provincia/ciudad/dirección y volver a unirla no es reversible:
  // "Rosario, Santa Fe" no tiene tres partes y una dirección puede traer comas.
  location: cuenta?.location || '',
  cbu: cuenta?.cbu || '',
  bankAlias: cuenta?.bankAlias || '',
  carrierBaseLocalityId: cuenta?.carrierBaseLocalityId || '',
  carrierTransport: cuenta?.carrierTransport || '',
  carrierTransportCertified: cuenta?.carrierTransportCertified ?? false,
  carrierCertificationDetail: cuenta?.carrierCertificationDetail || '',
  // El radio viaja como texto mientras se edita y se convierte al guardar: así
  // el campo puede quedar vacío sin volverse NaN.
  carrierCoverageRadiusKm:
    cuenta?.carrierCoverageRadiusKm != null ? String(cuenta.carrierCoverageRadiusKm) : '',
  carrierCapacity: cuenta?.carrierCapacity || '',
  carrierVehicleModel: cuenta?.carrierVehicleModel || '',
  carrierPlate: cuenta?.carrierPlate || '',
  // Las cargas viajan como el conjunto de claves tildadas.
  carrierCargoTypes: cuenta?.carrierCargoTypes ?? [],
  carrierCargoOther: cuenta?.carrierCargoOther || '',
});

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
  // Con qué abrió la edición. Se compara contra esto para saber si hay algo
  // sin guardar; se escribe al abrir y no en un efecto, para que no dependa de
  // en qué orden dibuje React.
  const retratoInicialDeLaEdicion = useRef('');
  // La ubicación con la que abrió la edición. Sirve para distinguir «no la
  // tocó» de «la tocó y la dejó a medias», que son cosas distintas: la
  // primera puede guardar el resto y la segunda no.
  const ubicacionInicialDeLaEdicion = useRef({ province_id: '', locality_id: '' });
  const [ubicacionIncompleta, setUbicacionIncompleta] = useState(false);
  const localidadDeLaEdicion = useRef<HTMLSelectElement>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Vinculo con Mercado Pago. `mpVinculo` es lo unico que decide que se ve:
  // no se guardan tokens ni nada parecido, porque el backend no los manda.
  const [mpVinculo, setMpVinculo] = useState<VinculoMP | null>(null);
  const [mpCargando, setMpCargando] = useState(true);
  const [mpTrabajando, setMpTrabajando] = useState(false);

  // Documentación fiscal presentada para revisión manual. No habilita ni
  // bloquea nada: sin presentar, pendiente o rechazada se publica y se vende
  // igual. Lo único que cambia una aprobación es que aparece el distintivo.
  const [documentacion, setDocumentacion] = useState<MiDocumentacion | null>(null);
  const [docCargando, setDocCargando] = useState(true);
  const [docEnviando, setDocEnviando] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docCuit, setDocCuit] = useState('');
  const [docRazonSocial, setDocRazonSocial] = useState('');
  const [docArchivo, setDocArchivo] = useState<File | null>(null);
  const [docFormularioAbierto, setDocFormularioAbierto] = useState(false);

  // El catálogo de cargas lo trae el servidor: lo que se guarda son sus
  // claves, así que la lista que se ofrece para tildar tiene que ser la misma
  // que valida el alta. Duplicarla acá quedaría desincronizada en silencio.
  const [tiposDeCarga, setTiposDeCarga] = useState<TipoDeCarga[]>([]);
  
  // Estado para notificaciones
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  
  // Estado para calificaciones
  const [ratingModal, setRatingModal] = useState<{ orderId: string; sellerName: string } | null>(null);
  // Rechazar una transferencia es una decisión con motivo obligatorio que el
  // comprador va a leer, así que vive en su propia capa del panel. Era un
  // `window.prompt`: fuera del sistema de capas, sin validación propia, sin
  // error visible —en blanco no pasaba nada y nadie decía por qué— y
  // perdiendo lo escrito cuando la API fallaba.
  const [rechazoDeTransferencia, setRechazoDeTransferencia] = useState<{
    orderId: string;
    comprador: string;
    total: number;
    conComprobante: boolean;
  } | null>(null);
  const [motivoDelRechazo, setMotivoDelRechazo] = useState('');
  const [errorDelRechazo, setErrorDelRechazo] = useState('');
  const [enviandoElRechazo, setEnviandoElRechazo] = useState(false);
  // El envío en curso, por referencia: el cierre protegido lo consulta desde
  // `useCapaModal`, que se queda con una sola versión de la función.
  const enviandoElRechazoRef = useRef(false);
  enviandoElRechazoRef.current = enviandoElRechazo;
  const motivoDelRechazoRef = useRef<HTMLTextAreaElement>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratedOrders, setRatedOrders] = useState<Set<string>>(new Set());
  
  // Referencia a los productos originales del backend para edición
  const [backendProducts, setBackendProducts] = useState<BackendProduct[]>([]);
  
  // Estado para categorías (para edición)
  const [categories, setCategories] = useState<CategoryFromBackend[]>([]);

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

  // Preparar o recuperar el link de pago de una orden propia.
  //
  // La compra por Mercado Pago se termina en Mercado Pago, y el comprador
  // puede cerrar el checkout antes de eso: sin esto, la orden queda creada y
  // sin ninguna forma visible de pagarla. La ruta es idempotente, así que
  // volver acá devuelve el mismo link y nunca crea otra orden ni otro pago.
  const [preparandoPago, setPreparandoPago] = useState('');
  const [errorDePago, setErrorDePago] = useState<Record<string, string>>({});

  // El comprobante de una transferencia que quedó a medias, por orden. Se
  // guarda el archivo elegido, si se está enviando y el motivo del último
  // fallo, para que un error se lea y se pueda reintentar sin recargar.
  const [comprobantes, setComprobantes] = useState<Record<string, File>>({});
  const [enviandoComprobante, setEnviandoComprobante] = useState('');
  const [errorDeComprobante, setErrorDeComprobante] = useState<Record<string, string>>({});
  // Sube de a uno para volver a pedirle las órdenes al servidor. La pantalla no
  // parchea la orden en memoria: después de subir el comprobante, lo que vale
  // es lo que diga la fuente real.
  const [recargaDeOrdenes, setRecargaDeOrdenes] = useState(0);

  const enviarComprobante = async (orden: Order) => {
    const archivo = comprobantes[orden.orderId];
    if (!archivo) {
      setErrorDeComprobante((actuales) => ({
        ...actuales, [orden.orderId]: 'Elegí el comprobante antes de enviarlo',
      }));
      return;
    }
    setEnviandoComprobante(orden.orderId);
    setErrorDeComprobante((actuales) => ({ ...actuales, [orden.orderId]: '' }));
    try {
      const cuerpo = new FormData();
      cuerpo.append('file', archivo);
      // La misma ruta y el mismo contrato de archivo que usa el checkout: acá
      // no hay un camino nuevo, sólo otra puerta al mismo.
      await apiUpload(`/orders/${orden.orderId}/transfer-receipt`, cuerpo);
      setComprobantes((actuales) => {
        const siguientes = { ...actuales };
        delete siguientes[orden.orderId];
        return siguientes;
      });
      setRecargaDeOrdenes((n) => n + 1);
      showToast('Comprobante enviado. El vendedor lo va a revisar.', 'success');
    } catch (error) {
      setErrorDeComprobante((actuales) => ({
        ...actuales,
        [orden.orderId]: error instanceof Error
          ? error.message
          : 'No se pudo enviar el comprobante',
      }));
    } finally {
      setEnviandoComprobante('');
    }
  };

  const continuarPago = async (orden: Order) => {
    if (orden.paymentUrl) {
      window.open(orden.paymentUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreparandoPago(orden.orderId);
    setErrorDePago((actuales) => ({ ...actuales, [orden.orderId]: '' }));
    try {
      const listo = await apiPost<{ payment_url?: string; reason?: string }>(
        `/orders/${orden.orderId}/payment-link`,
      );
      if (listo.payment_url) {
        setPurchases((actuales) => actuales.map((o) => (
          o.orderId === orden.orderId ? { ...o, paymentUrl: listo.payment_url } : o
        )));
        window.open(listo.payment_url, '_blank', 'noopener,noreferrer');
        return;
      }
      setErrorDePago((actuales) => ({
        ...actuales,
        [orden.orderId]: `No se pudo preparar el pago${listo.reason ? ` (${listo.reason})` : ''}. `
          + 'La orden sigue creada y podés reintentar.',
      }));
    } catch (err) {
      setErrorDePago((actuales) => ({
        ...actuales,
        [orden.orderId]: err instanceof Error ? err.message : 'No se pudo preparar el pago',
      }));
    } finally {
      setPreparandoPago('');
    }
  };

  // Operaciones asignadas: sólo las pide quien es transportista, y el servidor
  // devuelve únicamente las suyas. No hay parámetro de transportista.
  const [operaciones, setOperaciones] = useState<OperacionAsignada[]>([]);
  const [cargandoOperaciones, setCargandoOperaciones] = useState(false);
  const [errorDeOperaciones, setErrorDeOperaciones] = useState('');

  useEffect(() => {
    if (activeTab !== 'operations') return;
    let vigente = true;
    setCargandoOperaciones(true);
    setErrorDeOperaciones('');
    void apiGet<{ operations: OperacionAsignada[] }>('/logistics/my-operations')
      .then((respuesta) => {
        if (vigente) setOperaciones(respuesta.operations);
      })
      .catch((error) => {
        if (vigente) {
          setErrorDeOperaciones(
            error instanceof Error ? error.message : 'No se pudieron cargar las operaciones',
          );
        }
      })
      .finally(() => {
        if (vigente) setCargandoOperaciones(false);
      });
    return () => { vigente = false; };
  }, [activeTab]);

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
            orderId: o.id,
            date: o.created_at,
            status: mapBackendStatus(o.status),
            total: o.total_amount,
            items: o.items.map(i => ({
              productName: i.product_name_snapshot,
              quantity: i.quantity,
              price: i.unit_price_snapshot
            })),
            paymentMethod: o.payment_method,
            paymentUrl: o.payment_url,
            canPay: o.can_pay,
            paymentState: o.payment_state,
            seller: o.seller_name ? {
              name: o.seller_name,
              phone: o.seller_phone || '',
              whatsapp: o.seller_whatsapp || o.seller_phone || ''
            } : undefined,
            transferReceiptUrl: o.transfer_receipt_url,
            // Sólo para el comprador: es él quien tiene que transferir, y lo
            // que necesita es el snapshot de la orden, no el perfil de hoy.
            transferencia: (o.seller_cbu || o.seller_alias_bancario || o.seller_bank_holder)
              ? {
                cbu: o.seller_cbu,
                alias: o.seller_alias_bancario,
                titular: o.seller_bank_holder,
              }
              : undefined,
            rejectionReason: o.rejection_reason,
            shipping: o.shipping,
          }));
          setPurchases(mappedOrders);
        } else if (activeTab === 'sales') {
          const response = await apiGet<BackendOrder[]>('/orders/my?as_role=seller');
          const mappedOrders: Order[] = response.map(o => ({
            id: o.order_number,
            orderId: o.id,
            date: o.created_at,
            status: mapBackendStatus(o.status),
            total: o.total_amount,
            items: o.items.map(i => ({
              productName: i.product_name_snapshot,
              quantity: i.quantity,
              price: i.unit_price_snapshot
            })),
            paymentMethod: o.payment_method,
            paymentState: o.payment_state,
            buyer: o.buyer_name ? {
              name: o.buyer_name,
              phone: o.buyer_phone || '',
              address: o.buyer_address || ''
            } : undefined,
            transferReceiptUrl: o.transfer_receipt_url,
            rejectionReason: o.rejection_reason,
            shipping: o.shipping,
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
  }, [activeTab, recargaDeOrdenes]);

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
        
        const convertedProducts: UserProduct[] = response.products.map(aPublicacionDelPanel);
        
        setUserProducts(convertedProducts);
      } catch (error) {
        console.error('Error al cargar productos:', error);
        setProductsError(error instanceof Error ? error.message : 'Error al cargar productos');
      } finally {
        setLoadingProducts(false);
      }
    };

    loadUserProducts();
  }, []);

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

  const cargarDocumentacion = async () => {
    setDocCargando(true);
    try {
      setDocumentacion(await apiGet<MiDocumentacion>('/documentacion'));
    } catch {
      // Igual que con el vínculo: que no se pueda leer el estado no rompe el
      // panel. Se muestra como desconocido y el resto sigue andando.
      setDocumentacion(null);
    } finally {
      setDocCargando(false);
    }
  };

  const presentarDocumentacion = async () => {
    if (!docArchivo) {
      setDocError('Elegí la constancia en PDF que querés presentar.');
      return;
    }

    setDocEnviando(true);
    setDocError(null);
    try {
      const formulario = new FormData();
      formulario.append('cuit', docCuit);
      formulario.append('razon_social', docRazonSocial);
      formulario.append('archivo', docArchivo);
      const estado = await apiUpload<MiDocumentacion>('/documentacion', formulario);
      setDocumentacion(estado);
      setDocFormularioAbierto(false);
      setDocArchivo(null);
      showToast('Documentación presentada. Queda pendiente de revisión.', 'success');
    } catch (error) {
      // El motivo real de la API, no uno inventado: la persona tiene que poder
      // corregir el CUIT o el archivo con lo que dice el servidor.
      setDocError(error instanceof Error ? error.message : 'No se pudo presentar la documentación.');
    } finally {
      setDocEnviando(false);
    }
  };

  const verMiConstancia = async () => {
    try {
      const archivo = await apiBlob('/documentacion/archivo');
      const url = URL.createObjectURL(archivo);
      window.open(url, '_blank', 'noopener');
      // La URL temporal se suelta después de que el navegador la abrió; si se
      // revoca en el acto, la pestaña nueva se queda sin nada que mostrar.
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo abrir la constancia.',
        'error',
      );
    }
  };

  useEffect(() => {
    void cargarVinculoMP();
    void cargarDocumentacion();
  }, []);

  // Cargar categorías cuando se ABRE el modal de edición. La condición vive
  // en una variable y no adentro del arreglo de dependencias: ahí la
  // herramienta no puede analizarla, y de paso queda dicho que lo que
  // importa es la apertura y no cada tecla que se escribe adentro.
  const editando = editingProduct !== null;
  useEffect(() => {
    if (!editando) return;
    apiGet<CategoryFromBackend[]>('/catalog/categories?include_empty=true')
      .then(data => setCategories(data))
      .catch(err => console.error('Error cargando categorías:', err));
  }, [editando]);

  const cargarVinculoMP = async () => {
    setMpCargando(true);
    try {
      setMpVinculo(await apiGet<VinculoMP>('/mp-oauth/status'));
    } catch {
      // Que no se pueda leer el estado del vinculo no rompe el panel: se
      // muestra como no disponible y el resto sigue andando.
      setMpVinculo(null);
    } finally {
      setMpCargando(false);
    }
  };

  // Vincular y reconectar son la misma accion: se abre un intento nuevo y se
  // manda a la persona a autorizar. El intento anterior queda invalidado.
  const conectarMercadoPago = async () => {
    setMpTrabajando(true);
    try {
      const { auth_url } = await apiPost<{ auth_url: string }>('/mp-oauth/auth-url', {});
      window.location.href = auth_url;
    } catch {
      showToast('No se pudo iniciar la conexión con Mercado Pago.', 'error');
      setMpTrabajando(false);
    }
  };

  const renovarMercadoPago = async () => {
    setMpTrabajando(true);
    try {
      const estado = await apiPost<VinculoMP>('/mp-oauth/refresh', {});
      setMpVinculo(estado);
      showToast(
        estado.estado === 'conectado' ? 'Conexión renovada.' : explicarMP(estado.motivo),
        estado.estado === 'conectado' ? 'success' : 'warning',
      );
    } catch {
      showToast('No se pudo renovar la conexión.', 'error');
    } finally {
      setMpTrabajando(false);
    }
  };

  const desvincularMercadoPago = async () => {
    const confirmado = await showConfirm({
      title: 'Desvincular Mercado Pago',
      message: 'Se borran de TopGreen las credenciales de tu cuenta.\n\n'
        + 'Para retirarle el permiso a la aplicación también del lado de Mercado Pago, '
        + 'hacelo desde tu cuenta.',
      confirmText: 'Desvincular',
      type: 'warning',
    });
    if (!confirmado) return;

    setMpTrabajando(true);
    try {
      setMpVinculo(await apiPost<VinculoMP>('/mp-oauth/unlink', {}));
      showToast('Cuenta de Mercado Pago desvinculada.', 'success');
    } catch {
      showToast('No se pudo desvincular la cuenta.', 'error');
    } finally {
      setMpTrabajando(false);
    }
  };

  // Estado temporal para edición de perfil
  const [editForm, setEditForm] = useState(() => formularioDesde(user));

  // La cuenta llega después del primer render y vuelve a llegar tras guardar.
  // Mientras no se esté editando, el formulario se rehidrata desde ella: es lo
  // que hace que cancelar devuelva TODO —generales y transporte— al último
  // estado guardado, sin una segunda copia del mismo mapeo.
  useEffect(() => {
    if (!isEditing) setEditForm(formularioDesde(user));
  }, [user, isEditing]);

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

  // El vocabulario de cargas, para las casillas. Se pide una sola vez y sólo
  // si la cuenta es transportista.
  useEffect(() => {
    if (!esTransportista || tiposDeCarga.length > 0) return;
    void apiGet<{ types: TipoDeCarga[] }>('/logistics/cargo-types')
      .then((data) => setTiposDeCarga(data.types))
      .catch(() => setTiposDeCarga([]));
  }, [esTransportista, tiposDeCarga.length]);

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

  // El padrón para editar la ubicación de una publicación. Son los mismos
  // ayudantes que usan el alta y el registro: una sola lista de provincias en
  // todo el producto, y las localidades que el catálogo reconoce.
  const [provinciasDeLaEdicion, setProvinciasDeLaEdicion] = useState<ProvinceResponse[]>([]);
  const [localidadesDeLaEdicion, setLocalidadesDeLaEdicion] = useState<LocalityResponse[]>([]);
  const [padronDeLaEdicion, setPadronDeLaEdicion] = useState('');
  const provinciaDeLaEdicion = editingProduct?.province_id || '';

  useEffect(() => {
    if (!editingProduct || provinciasDeLaEdicion.length > 0) return;
    void getProvinces()
      .then((data) => {
        setProvinciasDeLaEdicion(data);
        setPadronDeLaEdicion('');
      })
      .catch(() => setPadronDeLaEdicion('No se pudo cargar el padrón de provincias.'));
  }, [editingProduct, provinciasDeLaEdicion.length]);

  useEffect(() => {
    if (!provinciaDeLaEdicion) {
      setLocalidadesDeLaEdicion([]);
      return;
    }
    // Si se cambia de provincia con una consulta en vuelo, la respuesta vieja
    // no puede pisar a la nueva.
    let vigente = true;
    void getLocalities(provinciaDeLaEdicion)
      .then((data) => {
        if (!vigente) return;
        setLocalidadesDeLaEdicion(data);
        setPadronDeLaEdicion('');
      })
      .catch(() => {
        if (vigente) setPadronDeLaEdicion('No se pudieron cargar las localidades.');
      });
    return () => {
      vigente = false;
    };
  }, [provinciaDeLaEdicion]);

  // Cancelar sale de la edición; la rehidratación de arriba devuelve todos los
  // campos al último estado guardado. Una edición abandonada no puede
  // reaparecer en el guardado siguiente.
  // --- Cerrar sin perder trabajo ------------------------------------------
  // Tres formularios viven en este panel y comparten una sola política. La
  // suciedad se mide contra el retrato con el que cada uno abrió: un valor
  // precargado no es un cambio, y volver un campo a su valor original deja el
  // formulario limpio otra vez.
  const perfilSucio = isEditing && (
    huboCambios(formularioDesde(user), editForm)
    || carrierProvinceId !== (user?.carrierBaseProvinceId || '')
  );
  const edicionSucia = editingProduct !== null
    && JSON.stringify(retratoDeLaEdicion(editingProduct)) !== retratoInicialDeLaEdicion.current;
  const calificacionSucia = ratingModal !== null && (ratingScore !== 5 || ratingComment !== '');
  // Un motivo de rechazo a medio escribir es trabajo sin guardar como
  // cualquier otro: cerrar el panel entero con eso adentro tiene que
  // preguntar, igual que con los otros tres formularios.
  const rechazoSucio = rechazoDeTransferencia !== null && motivoDelRechazo.trim() !== '';
  const hayTrabajoSinGuardar = perfilSucio || edicionSucia || calificacionSucia
    || rechazoSucio;
  const trabajoRef = useRef(hayTrabajoSinGuardar);
  trabajoRef.current = hayTrabajoSinGuardar;

  // `alSalir` se desprende del objeto: el objeto se vuelve a crear en cada
  // render y `alSalir` no. Con el cierre estable, la capa no se vuelve a
  // montar mientras se escribe.
  const salida = useSalidaProtegida();
  const { alSalir } = salida;
  // Cerrar el panel entero: lo pide la X, el fondo y Escape, y arrastra
  // cualquiera de los tres formularios que esté sucio.
  const pedirCierreDelPanel = useCallback(
    () => alSalir(trabajoRef.current, onClose),
    [alSalir, onClose],
  );
  const cerrarLaEdicion = useCallback(() => setEditingProduct(null), []);
  // Cerrar la capa del rechazo no toca la orden: sólo suelta lo que se estaba
  // por mandar. El foco vuelve al botón que la abrió por la pila de capas.
  const soltarElRechazo = useCallback(() => {
    setRechazoDeTransferencia(null);
    setMotivoDelRechazo('');
    setErrorDelRechazo('');
  }, []);
  // El cierre que piden las cuatro vías —Escape, X, Cancelar y fondo— es uno
  // solo, y está protegido: mientras el rechazo viaja, cerrar sería mentir.
  // La petición no se cancela, así que la orden se rechazaría igual y la
  // persona se quedaría sin ver su propio resultado. La capa se queda hasta
  // que haya una respuesta: si sale bien cierra sola, y si falla vuelve a
  // dejarse cerrar con el motivo intacto.
  const cerrarElRechazo = useCallback(() => {
    if (enviandoElRechazoRef.current) return;
    soltarElRechazo();
  }, [soltarElRechazo]);
  const pedirCierreDeLaEdicion = () => alSalir(edicionSucia, cerrarLaEdicion);
  const cerrarLaCalificacion = useCallback(() => setRatingModal(null), []);
  const pedirCierreDeLaCalificacion = () =>
    alSalir(calificacionSucia, cerrarLaCalificacion);

  const handleCancelEdit = () => {
    setEditForm(formularioDesde(user));
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
        whatsapp: editForm.whatsapp,
        // Tal cual se editó: abrir y guardar sin tocar nada tiene que dejar el
        // mismo texto que había.
        location: editForm.location,
        cbu: editForm.cbu,
        bankAlias: editForm.bankAlias,
        // Los datos de transporte sólo salen si la cuenta es transportista;
        // para cualquier otra el cuerpo enviado es el mismo de antes.
        ...(esTransportista
          ? {
              carrierBaseLocalityId: editForm.carrierBaseLocalityId,
              carrierTransport: editForm.carrierTransport,
              carrierTransportCertified: editForm.carrierTransportCertified,
              carrierCertificationDetail: editForm.carrierCertificationDetail,
              carrierCoverageRadiusKm: radio,
              carrierCapacity: editForm.carrierCapacity,
              carrierVehicleModel: editForm.carrierVehicleModel,
              carrierPlate: editForm.carrierPlate,
              carrierCargoTypes: editForm.carrierCargoTypes,
              // El detalle sólo acompaña si «Otra» quedó tildada; si no, el
              // servidor lo suelta igual, y mandarlo confundiria al leer el
              // cuerpo de la peticion.
              carrierCargoOther: editForm.carrierCargoTypes.includes('otra')
                ? editForm.carrierCargoOther
                : '',
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
        orderId: o.id,
        date: o.created_at,
        status: mapBackendStatus(o.status),
        total: o.total_amount,
        items: o.items.map(i => ({
          productName: i.product_name_snapshot,
          quantity: i.quantity,
          price: i.unit_price_snapshot
        })),
        paymentMethod: o.payment_method,
        paymentUrl: o.payment_url,
        canPay: o.can_pay,
        paymentState: o.payment_state,
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

  // Aprobar no cambió: sigue siendo un clic, con su aviso y su recarga.
  const handleTransferDecision = async (orderId: string) => {
    try {
      await apiPatch(`/orders/${orderId}/transfer-receipt`, { decision: 'approve' });
      showToast('Comprobante aprobado', 'success');
      await reloadOrders('seller');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo validar el comprobante', 'error');
    }
  };

  const abrirElRechazo = (order: Order) => {
    if (enviandoElRechazoRef.current) return;
    setMotivoDelRechazo('');
    setErrorDelRechazo('');
    setRechazoDeTransferencia({
      orderId: order.id,
      comprador: order.buyer?.name || 'el comprador',
      total: order.total,
      conComprobante: order.status === 'transfer-receipt-submitted',
    });
  };

  const confirmarElRechazo = async () => {
    // Mientras hay un envío en curso el botón no vuelve a disparar: una
    // decisión de este tamaño no se manda dos veces por un doble clic.
    if (!rechazoDeTransferencia || enviandoElRechazo) return;
    const motivo = motivoDelRechazo.trim();
    if (!motivo) {
      // Antes, un motivo en blanco no mandaba nada Y no decía nada: la
      // decisión simplemente no pasaba y nadie sabía por qué.
      setErrorDelRechazo('Escribí el motivo del rechazo: el comprador lo va a leer.');
      motivoDelRechazoRef.current?.focus();
      return;
    }
    setEnviandoElRechazo(true);
    setErrorDelRechazo('');
    try {
      await apiPatch(`/orders/${rechazoDeTransferencia.orderId}/transfer-receipt`, {
        decision: 'reject',
        reason: motivo,
      });
      soltarElRechazo();
      showToast('Comprobante rechazado', 'warning');
      await reloadOrders('seller');
    } catch (error) {
      // El fallo se queda DENTRO de la capa: lo escrito no se pierde y se
      // puede reintentar sin volver a tipearlo. Y no se declara un rechazo
      // que no ocurrió.
      setErrorDelRechazo(error instanceof Error && error.message.trim()
        ? error.message
        : 'No se pudo rechazar el comprobante. Probá de nuevo.');
    } finally {
      setEnviandoElRechazo(false);
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

  // Una palabra y no un dibujo. El emoji no dice nada a quien no lo
  // distingue, y un lector de pantalla anuncia «camión» en vez de «enviado».
  const rotuloDeAviso = (type: string) => {
    const etiquetas: Record<string, string> = {
      'order_placed': 'Pedido',
      'order_received': 'Venta',
      'order_confirmed': 'Confirmado',
      'order_shipped': 'Enviado',
      'order_delivered': 'Entregado',
      'order_cancelled': 'Cancelado',
      'order_rejected': 'Rechazado',
      'payment_approved': 'Pago',
      'payment_failed': 'Pago fallido',
      'product_sold': 'Vendido',
      'welcome': 'Bienvenida',
      'system': 'Aviso',
    };
    return etiquetas[type] || 'Aviso';
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
      // Ya se guardó: no hay nada sin guardar que preguntar.
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
      
      const convertedProducts: UserProduct[] = response.products.map(aPublicacionDelPanel);
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
    
    // La ubicación oficial entra por su identificador. Partir `location` por
    // comas era adivinar: ese texto es un derivado de compatibilidad y una
    // fila heredada puede tener cualquier cosa escrita ahí. Sin localidad,
    // los dos campos quedan vacíos y la pantalla lo dice.
    const locality_id = product.locality_id || '';
    const province_id = product.locality?.province_id || '';
    
    // Determinar tipo de publicación
    const isService = product.publication_type === 'servicio';
    
    // Abrir modal de edición con los datos del producto
    const edicion: EditFormData = {
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
      locality_id,
      province_id,
      existingImages,
      newImages: [],
      imagesToDelete: [],
      publication_type: isService ? 'servicio' : 'producto',
      operation_kind: normalizarAnatomia(product.operation_kind),
      condition: normalizarCondicion(product.condition) || '',
      // Campos de servicio
      pricing_type: product.pricing_type || 'por_hora',
      availability: product.availability || 'inmediata',
      response_time: product.response_time || '24hs',
      experience_years: product.experience_years?.toString() || '',
      has_equipment: product.has_equipment ?? true,
      coverage_zones: product.coverage_zones || [],
    };
    retratoInicialDeLaEdicion.current = JSON.stringify(retratoDeLaEdicion(edicion));
    ubicacionInicialDeLaEdicion.current = { province_id, locality_id };
    setUbicacionIncompleta(false);
    setEditingProduct(edicion);
  };
  
  const handleSaveEditProduct = async () => {
    if (!editingProduct) return;
    
    const price = parseFloat(editingProduct.price) || 0;
    const stock = parseInt(editingProduct.stock) || 0;
    const isService = editingProduct.publication_type === 'servicio';
    
    // El precio lo decide la misma regla que el alta. Sin ella, un servicio
    // por hora podía quedar guardado en cero editándolo y era imposible
    // publicarlo así: la misma publicación recibía dos respuestas.
    const problemaDelPrecio = revisarElPrecio(editingProduct.price, {
      publicationType: editingProduct.publication_type,
      pricingType: editingProduct.pricing_type,
    });
    if (problemaDelPrecio) {
      showToast(problemaDelPrecio, 'warning');
      return;
    }
    if (!isService && stock < 0) {
      showToast('El stock no puede ser negativo', 'warning');
      return;
    }
    
    // La ubicación se elige entera o no se toca. Cambiar de provincia vacía
    // la localidad, y guardar así omitía `locality_id`: el PATCH respondía
    // 200, el aviso decía «actualizado exitosamente» y la publicación seguía
    // donde estaba. Media selección no es un cambio guardado; es el mismo
    // engaño que esta pieza vino a cerrar, con otra ropa.
    const ubicacionTocada =
      editingProduct.province_id !== ubicacionInicialDeLaEdicion.current.province_id
      || editingProduct.locality_id !== ubicacionInicialDeLaEdicion.current.locality_id;
    if (ubicacionTocada && !editingProduct.locality_id) {
      // El aviso queda a la vista mientras se corrige —no se desvanece— y el
      // foco va al control que falta. No se manda nada: lo elegido y lo
      // escrito quedan intactos.
      setUbicacionIncompleta(true);
      localidadDeLaEdicion.current?.focus();
      return;
    }
    setUbicacionIncompleta(false);

    setIsSavingEdit(true);
    try {
      // Construir payload base
      const payload: Record<string, unknown> = {
        name: editingProduct.name,
        description: editingProduct.description,
        price: price,
        operation_kind: editingProduct.operation_kind,
        condition: editingProduct.operation_kind === 'activo' && editingProduct.condition
          ? editingProduct.condition
          : null,
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
      
      // La ubicación viaja por su identificador oficial. Mandar un `location`
      // escrito a mano no cambiaba nada —el esquema de la edición ni siquiera
      // lo acepta— y derivar acá el texto sería tener la misma regla dos veces:
      // el Backend valida el ID y arma el texto compatible.
      if (editingProduct.locality_id) {
        payload.locality_id = editingProduct.locality_id;
      }

      // 1. Actualizar datos del producto
      await apiPatch(`/products/${editingProduct.id}`, payload);
      
      // 2. Eliminar imágenes marcadas para eliminar. Una que no se pudo quitar
      // sigue estando: decirlo es parte de no declarar un éxito que no fue.
      const problemas: string[] = [];
      for (const imageId of editingProduct.imagesToDelete) {
        try {
          await apiDelete(`/products/${editingProduct.id}/images/${imageId}`);
        } catch (err) {
          problemas.push(err instanceof Error
            ? `no se pudo quitar una imagen: ${err.message}`
            : 'no se pudo quitar una imagen');
        }
      }

      // 3. Subir nuevas imágenes, por el mismo camino que el alta. Una imagen
      // rechazada NO puede terminar en «actualizado exitosamente»: lo que se
      // guardó se informa como guardado, y la que no entró, con su motivo.
      const imagenesFallidas: string[] = [];
      for (let i = 0; i < editingProduct.newImages.length; i++) {
        const image = editingProduct.newImages[i];
        // La primera imagen nueva es primaria solo si no hay imágenes existentes
        const isPrimary = editingProduct.existingImages.length === 0 && i === 0;
        const motivo = await subirImagenDePublicacion(
          editingProduct.id, image.file, isPrimary,
        );
        if (motivo) {
          imagenesFallidas.push(`${image.file.name}: ${motivo}`);
        }
      }
      if (imagenesFallidas.length > 0) {
        problemas.push(fraseDeImagenesFallidas(imagenesFallidas));
      }

      if (problemas.length > 0) {
        showToast(
          `La publicación se actualizó, pero ${problemas.join('; ')}. Los demás `
          + 'cambios quedaron guardados.',
          'warning',
        );
      } else {
        showToast('Producto actualizado exitosamente', 'success');
      }
      setEditingProduct(null);
      
      // Recargar productos
      const response = await apiGet<{ products: BackendProduct[]; total: number }>('/products/my');
      setBackendProducts(response.products);
      
      const convertedProducts: UserProduct[] = response.products.map(aPublicacionDelPanel);
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
      pending: { label: 'Pendiente de Pago', color: 'var(--tg-color-warning)' },
      'awaiting-transfer-receipt': { label: 'Esperando Comprobante', color: 'var(--tg-color-warning)' },
      'transfer-receipt-submitted': { label: 'Comprobante a Revisar', color: 'var(--tg-color-info)' },
      paid: { label: 'Pagado', color: 'var(--tg-color-brand)' },
      confirmed: { label: 'Confirmado', color: 'var(--tg-color-brand)' },
      'in-transit': { label: 'En Tránsito', color: 'var(--tg-color-info)' },
      delivered: { label: 'Entregado', color: 'var(--tg-color-brand)' },
      cancelled: { label: 'Cancelado', color: 'var(--tg-color-error)' },
      rejected: { label: 'Rechazado', color: 'var(--tg-color-error)' },
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
              onClick={() => alSalir(perfilSucio, handleCancelEdit)}
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
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.statInfo}>
            <p className={styles.statLabel}>Reputación</p>
            <p className={styles.statValue}>
              {/* Con palabras y no con una raya: «—» obliga a adivinar si es
                  cero, si falta el dato o si se rompió algo. */}
              {(user?.ratingCount ?? 0) > 0
                ? `${(user?.ratingAverage ?? 0).toFixed(1)} de 5`
                : 'Sin calificaciones aún'}
            </p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
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
          <div className={styles.statIcon}>
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
          <div className={styles.statIcon}>
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
                <span className={styles.stars}>{''.repeat(Math.round(user?.ratingAverage ?? 0))}</span>
                <span className={styles.ratingValue}>{(user?.ratingAverage ?? 0).toFixed(1)}</span>
              </>
            ) : (
              <span className={styles.noRating}>Sin calificaciones aún</span>
            )}
          </div>
        </div>

        <div className={styles.profileForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor={paraCampo('perfil-nombre')}>Nombre Completo</label>
              {isEditing ? (
                <input
                  id="perfil-nombre"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              ) : (
                <p>{user?.name}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              {/* El email no se edita: no hay endpoint que lo cambie, y un
                  campo que aparenta guardar y se ignora es peor que un dato
                  fijo. Cambiar el correo exige reconfirmarlo, y eso es una
                  pieza propia. */}
              <label>Email</label>
              <p>{user?.email}</p>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor={paraCampo('perfil-telefono')}>Teléfono</label>
              {isEditing ? (
                <input
                  id="perfil-telefono"
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+54 9 11 1234-5678"
                />
              ) : (
                <p>{user?.phone || 'No especificado'}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor={paraCampo('perfil-whatsapp')}>WhatsApp</label>
              {isEditing ? (
                <input
                  id="perfil-whatsapp"
                  type="tel"
                  value={editForm.whatsapp}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                  placeholder="+54 9 11 1234-5678"
                />
              ) : (
                <p>{user?.whatsapp || 'No especificado'}</p>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor={paraCampo('perfil-ubicacion')}>Ubicación</label>
            {isEditing ? (
              <input
                id="perfil-ubicacion"
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="Ruta 8 km 220, Pergamino, Buenos Aires"
              />
            ) : (
              <p>{user?.location || 'No especificada'}</p>
            )}
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor={paraCampo('perfil-cbu')}>CBU para transferencias</label>
              {isEditing ? (
                <input
                  id="perfil-cbu"
                  type="text"
                  value={editForm.cbu}
                  onChange={(e) => setEditForm({ ...editForm, cbu: e.target.value })}
                  placeholder="CBU"
                />
              ) : (
                <p>{user?.cbu || 'No configurado'}</p>
              )}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor={paraCampo('perfil-alias')}>Alias bancario</label>
              {isEditing ? (
                <input
                  id="perfil-alias"
                  type="text"
                  value={editForm.bankAlias}
                  onChange={(e) => setEditForm({ ...editForm, bankAlias: e.target.value })}
                  placeholder="Alias"
                />
              ) : (
                <p>{user?.bankAlias || 'No configurado'}</p>
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
                  <label htmlFor={paraCampo('perfil-modelo')}>Marca y modelo</label>
                  {isEditing ? (
                    <input
                      id="perfil-modelo"
                      type="text"
                      value={editForm.carrierVehicleModel}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        carrierVehicleModel: e.target.value,
                      })}
                      placeholder="Scania R450"
                    />
                  ) : (
                    <p>{user?.carrierVehicleModel || 'No especificado'}</p>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={paraCampo('perfil-dominio')}>Dominio</label>
                  {isEditing ? (
                    <input
                      id="perfil-dominio"
                      type="text"
                      value={editForm.carrierPlate}
                      onChange={(e) => setEditForm({ ...editForm, carrierPlate: e.target.value })}
                      placeholder="AB 123 CD"
                    />
                  ) : (
                    <p>{user?.carrierPlate || 'No especificado'}</p>
                  )}
                  {/* Dónde termina este dato, dicho en el campo: quien lo
                      escribe tiene que saber quién lo va a ver. */}
                  <p className={styles.campoPrivado}>
                    Privado: no aparece en el listado de transportistas. Lo ve
                    el comprador recién después de seleccionarte, junto con tu
                    contacto.
                  </p>
                </div>
              </div>

              <div className={styles.formGroup}>
                <span className={styles.etiquetaGrupo} id="perfil-cargas">
                  Cargas que transportás
                </span>
                {isEditing ? (
                  <>
                    <div className={styles.cargasGrilla} role="group" aria-labelledby="perfil-cargas">
                      {tiposDeCarga.map((tipo) => (
                        <label key={tipo.value} className={styles.carrierCheckbox}>
                          <input
                            type="checkbox"
                            checked={editForm.carrierCargoTypes.includes(tipo.value)}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              carrierCargoTypes: e.target.checked
                                ? [...editForm.carrierCargoTypes, tipo.value]
                                : editForm.carrierCargoTypes.filter((c) => c !== tipo.value),
                            })}
                          />
                          {tipo.label}
                        </label>
                      ))}
                    </div>
                    {editForm.carrierCargoTypes.includes('otra') && (
                      <div className={styles.formGroup}>
                        <label htmlFor="perfil-carga-otra">Contá qué transportás</label>
                        <input
                          id="perfil-carga-otra"
                          type="text"
                          maxLength={120}
                          value={editForm.carrierCargoOther}
                          onChange={(e) => setEditForm({
                            ...editForm,
                            carrierCargoOther: e.target.value,
                          })}
                          placeholder="Bidones de 200 litros"
                        />
                      </div>
                    )}
                    <p className={styles.ayudaCampo}>
                      Es una declaración tuya y sirve para que el comprador compare.
                      No decide en qué viajes aparecés: eso lo siguen definiendo tu
                      localidad base y tu radio.
                    </p>
                  </>
                ) : (
                  <p>
                    {(user?.carrierCargoTypes?.length ?? 0) > 0
                      ? user!.carrierCargoTypes!
                          .map((clave) => (clave === 'otra'
                            ? `Otra: ${user?.carrierCargoOther || 'sin detalle'}`
                            : tiposDeCarga.find((t) => t.value === clave)?.label || clave))
                          .join(' · ')
                      : 'No especificadas'}
                  </p>
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

              <div className={styles.formGroup}>
                <label htmlFor={paraCampo('perfil-habilitacion-detalle')}>
                  Detalle de la habilitación
                </label>
                {isEditing ? (
                  <input
                    id="perfil-habilitacion-detalle"
                    type="text"
                    value={editForm.carrierCertificationDetail}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      carrierCertificationDetail: e.target.value,
                    })}
                    placeholder="RUTA, transporte de cargas generales, N.° 12345"
                  />
                ) : (
                  <p>{user?.carrierCertificationDetail || 'Sin declarar'}</p>
                )}
                <p className={styles.carrierNota}>
                  {user?.carrierCertificationDeclaredAt
                    ? `Declarado el ${new Date(user.carrierCertificationDeclaredAt)
                        .toLocaleDateString('es-AR')}. TopGreen no verifica esta habilitación.`
                    : 'Es tu declaración. TopGreen no la verifica y guarda la fecha en que la hacés.'}
                </p>
              </div>
            </>
          )}

          <div className={styles.privacyNote}>
            Tu información de contacto solo se comparte con los compradores después de que confirmen la compra
          </div>
        </div>
      </div>

      {/* Mercado Pago: dónde cobra el vendedor. El dinero va a su cuenta,
          TopGreen no lo recibe ni lo reparte. */}
      <div className={styles.mpSection}>
        <div className={styles.sectionHeader}>
          <h2> Mercado Pago — dónde cobrás</h2>
        </div>
        <div className={styles.mpContent}>
          {mpCargando ? (
            <p>Cargando estado…</p>
          ) : mpVinculo?.estado === 'conectado' ? (
            <div className={styles.mpLinked}>
              <span className={styles.mpStatus}> Cuenta vinculada</span>
              <p>Cuenta de Mercado Pago: <strong>{mpVinculo.mp_user_id}</strong></p>
              <p className={styles.mpInfo}>
                Cuando el cobro con Mercado Pago esté disponible, los pagos de tus
                ventas van a entrar directamente en tu cuenta. TopGreen no los recibe
                ni los reparte, y no te cobra comisión por vender; Mercado Pago te
                descuenta la suya, como en cualquier venta tuya.
              </p>
              {mpVinculo.conviene_renovar && (
                <>
                  <div className={styles.mpWarning}>
                    <strong>Tu conexión vence pronto</strong>
                  </div>
                  <button
                    className={styles.mpLinkButton}
                    onClick={renovarMercadoPago}
                    disabled={mpTrabajando}
                  >
                    {mpTrabajando ? 'Renovando…' : 'Renovar conexión'}
                  </button>
                </>
              )}
              <button
                className={styles.mpUnlinkButton}
                onClick={desvincularMercadoPago}
                disabled={mpTrabajando}
              >
                Desvincular cuenta
              </button>
            </div>
          ) : mpVinculo?.estado === 'requiere_reconexion' ? (
            <div className={styles.mpUnlinked}>
              <div className={styles.mpWarning}>
                <strong>Hay que reconectar tu cuenta</strong>
              </div>
              <p>
                El permiso que le diste a TopGreen sobre tu cuenta
                {mpVinculo.mp_user_id ? <> <strong>{mpVinculo.mp_user_id}</strong></> : null}
                {' '}dejó de estar disponible. Reconectala para dejar tu cobro por
                Mercado Pago en condiciones.
              </p>
              <button
                className={styles.mpLinkButton}
                onClick={conectarMercadoPago}
                disabled={mpTrabajando}
              >
                {mpTrabajando ? 'Abriendo Mercado Pago…' : ' Reconectar cuenta'}
              </button>
              <button
                className={styles.mpUnlinkButton}
                onClick={desvincularMercadoPago}
                disabled={mpTrabajando}
              >
                Desvincular cuenta
              </button>
            </div>
          ) : mpVinculo?.estado === 'desconectado' ? (
            <div className={styles.mpUnlinked}>
              <div className={styles.mpWarning}>
                <strong>Cuenta no vinculada</strong>
              </div>
              <p>
                Vinculá tu cuenta de Mercado Pago para dejar lista tu forma de cobro:
                cuando esté disponible, los pagos de tus ventas van a entrar
                directamente ahí. El cobro por transferencia no depende de esto y
                sigue funcionando igual.
              </p>
              <div className={styles.mpBenefits}>
                <h4>Qué pasa cuando la vinculás:</h4>
                <ul>
                  <li> Cobrás vos, en tu propia cuenta</li>
                  <li> TopGreen no recibe ni retiene ese dinero</li>
                  <li> Podés desvincularla cuando quieras</li>
                </ul>
              </div>
              <button
                className={styles.mpLinkButton}
                onClick={conectarMercadoPago}
                disabled={mpTrabajando}
              >
                {mpTrabajando ? 'Abriendo Mercado Pago…' : ' Vincular Mercado Pago'}
              </button>
              <p className={styles.mpHelp}>
                Te lleva a Mercado Pago para que autorices la conexión. TopGreen nunca
                ve ni te pide tu contraseña.
              </p>
            </div>
          ) : (
            <div className={styles.mpUnlinked}>
              <div className={styles.mpWarning}>
                <strong>Cobro por Mercado Pago no disponible</strong>
              </div>
              <p>
                Todavía no está habilitado en la plataforma. Tus ventas por
                transferencia no se ven afectadas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Documentación fiscal. Es opcional y no habilita nada: publicar,
          vender y cobrar funcionan igual sin presentarla. Lo único que cambia
          una aprobación es que aparece el distintivo en tus publicaciones. */}
      <div className={styles.docSection}>
        <div className={styles.sectionHeader}>
          <h2> Documentación fiscal</h2>
        </div>
        <div className={styles.docContent}>
          {docCargando ? (
            <p>Cargando estado…</p>
          ) : (
            <>
              <p className={styles.docEstado}>
                Estado:{' '}
                <strong data-estado={documentacion?.estado ?? 'sin_presentacion'}>
                  {ETIQUETA_DE_ESTADO[documentacion?.estado ?? 'sin_presentacion']}
                </strong>
              </p>

              {documentacion?.estado === 'rechazada' && documentacion.motivo_de_rechazo && (
                <div className={styles.docRechazo} role="alert">
                  <strong>Por qué se rechazó:</strong> {documentacion.motivo_de_rechazo}
                </div>
              )}

              {documentacion && documentacion.estado !== 'sin_presentacion' && (
                <dl className={styles.docDatos}>
                  <div>
                    <dt>CUIT</dt>
                    <dd>{documentacion.cuit}</dd>
                  </div>
                  <div>
                    <dt>Razón social</dt>
                    <dd>{documentacion.razon_social}</dd>
                  </div>
                  <div>
                    <dt>Constancia</dt>
                    <dd>
                      <button
                        type="button"
                        className={styles.docVerArchivo}
                        onClick={verMiConstancia}
                      >
                        {documentacion.archivo_nombre}
                      </button>
                    </dd>
                  </div>
                </dl>
              )}

              <p className={styles.docAyuda}>
                Presentar tu CUIT, tu razón social y una constancia fiscal es
                opcional. No hace falta para publicar, vender ni cobrar. Si la
                revisión sale aprobada, en tus publicaciones aparece
                «Documentación revisada».
              </p>

              {!docFormularioAbierto ? (
                <button
                  type="button"
                  className={styles.docBoton}
                  onClick={() => {
                    setDocCuit(documentacion?.cuit ?? '');
                    setDocRazonSocial(documentacion?.razon_social ?? '');
                    setDocArchivo(null);
                    setDocError(null);
                    setDocFormularioAbierto(true);
                  }}
                >
                  {documentacion && documentacion.estado !== 'sin_presentacion'
                    ? 'Reemplazar documentación'
                    : 'Presentar documentación'}
                </button>
              ) : (
                <div className={styles.docFormulario}>
                  {documentacion?.estado === 'aprobada' && (
                    <p className={styles.docAviso}>
                      Reemplazarla retira el distintivo hasta que se revise la
                      nueva: lo revisado fue el papel anterior.
                    </p>
                  )}

                  <div className={styles.formGroup}>
                    <label htmlFor="doc-cuit">CUIT</label>
                    <input
                      id="doc-cuit"
                      type="text"
                      inputMode="numeric"
                      placeholder="30-71009999-1"
                      value={docCuit}
                      onChange={(e) => setDocCuit(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="doc-razon-social">Razón social</label>
                    <input
                      id="doc-razon-social"
                      type="text"
                      placeholder="Campo Verde SRL"
                      value={docRazonSocial}
                      onChange={(e) => setDocRazonSocial(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="doc-archivo">Constancia fiscal (PDF)</label>
                    <input
                      id="doc-archivo"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setDocArchivo(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  {docError && (
                    <div className={styles.docError} role="alert">
                      {docError}
                    </div>
                  )}

                  <div className={styles.editActions}>
                    <button
                      type="button"
                      className={styles.saveButton}
                      onClick={presentarDocumentacion}
                      disabled={docEnviando}
                    >
                      {docEnviando ? 'Enviando…' : 'Enviar para revisión'}
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => {
                        setDocFormularioAbierto(false);
                        setDocError(null);
                      }}
                      disabled={docEnviando}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );

  const fechaDeclarada = (iso?: string) => {
    if (!iso) return '';
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime())
      ? iso
      : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  /**
   * El traslado de una orden. Lo ven comprador y vendedor, con la misma
   * información y distinta frase. Sin modo es una orden anterior a la
   * logística: se dice que no está definido, no que la coordina alguien.
   */
  const renderTraslado = (traslado: TrasladoDeLaOrden | undefined, comoComprador: boolean) => {
    const modo = traslado?.mode;

    if (modo !== 'carrier' && modo !== 'self') {
      return (
        <div className={styles.traslado}>
          <div className={styles.trasladoTitulo}> Traslado</div>
          <p className={styles.trasladoTexto}>Traslado no definido.</p>
        </div>
      );
    }

    if (modo === 'self') {
      return (
        <div className={styles.traslado}>
          <div className={styles.trasladoTitulo}> Traslado</div>
          <p className={styles.trasladoTexto}>
            {comoComprador
              ? 'Coordinás el traslado por tu cuenta.'
              : 'El comprador coordina el traslado por su cuenta.'}
          </p>
        </div>
      );
    }

    return (
      <div className={styles.traslado}>
        <div className={styles.trasladoTitulo}> Transportista</div>
        <p className={styles.trasladoTexto}><strong>{traslado?.carrier_name}</strong></p>
        {traslado?.carrier_base && (
          <p className={styles.trasladoTexto}>Base: {traslado.carrier_base}</p>
        )}
        {traslado?.carrier_transport && (
          <p className={styles.trasladoTexto}>
            {traslado.carrier_transport}
            {traslado.carrier_vehicle_model ? ` · ${traslado.carrier_vehicle_model}` : ''}
            {traslado.carrier_plate ? ` · dominio ${traslado.carrier_plate}` : ''}
          </p>
        )}
        {traslado?.carrier_capacity && (
          <p className={styles.trasladoTexto}>Capacidad: {traslado.carrier_capacity}</p>
        )}
        {(traslado?.carrier_cargo_declared?.length ?? 0) > 0 && (
          <p className={styles.trasladoTexto}>
            Declara transportar: {traslado!.carrier_cargo_declared!.join(' · ')}
          </p>
        )}
        <p className={styles.trasladoContacto}>
          {traslado?.carrier_email}
          {traslado?.carrier_phone && ` · ${traslado.carrier_phone}`}
          {traslado?.carrier_whatsapp && traslado.carrier_whatsapp !== traslado.carrier_phone
            && ` · WhatsApp ${traslado.carrier_whatsapp}`}
        </p>
        {traslado?.carrier_certification_detail && (
          <p className={styles.trasladoDeclaracion}>
            Declara: {traslado.carrier_certification_detail}
            {traslado.carrier_certification_declared_at
              && ` (declarado el ${fechaDeclarada(traslado.carrier_certification_declared_at)})`}
            . TopGreen no verifica esta habilitación.
          </p>
        )}
        <p className={styles.trasladoDeclaracion}>
          La coordinación y el precio del flete se acuerdan directamente.
        </p>
      </div>
    );
  };

  /**
   * Lo que ve el transportista de una operación asignada: qué mover, desde
   * dónde y hacia dónde. Sin precios, sin totales, sin comprobantes y sin
   * contacto del comprador: nada de eso hace falta para mover una carga.
   */
  const renderOperaciones = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Mis Operaciones</h2>
        <span className={styles.count}>{operaciones.length} asignadas</span>
      </div>

      {errorDeOperaciones && (
        <p className={styles.trasladoTexto} role="alert"> {errorDeOperaciones}</p>
      )}

      {cargandoOperaciones ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}></div>
          <h3>Cargando tus operaciones...</h3>
        </div>
      ) : operaciones.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}></div>
          <h3>Todavía no te eligieron para ningún viaje</h3>
          <p>Cuando un comprador te elija, la operación aparece acá.</p>
        </div>
      ) : (
        <div className={styles.ordersList}>
          {operaciones.map((operacion) => (
            <div key={operacion.order_id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <div>
                  <h3>Operación #{operacion.order_number}</h3>
                  <p className={styles.orderDate}>
                    {new Date(operacion.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>

              <div className={styles.traslado}>
                <div className={styles.trasladoTitulo}> Recorrido</div>
                <p className={styles.trasladoTexto}>
                  Retiro en {operacion.origins.length > 0
                    ? operacion.origins.map((o) => `${o.name}, ${o.province_name}`).join(' y ')
                    : 'origen no informado'}
                  {' '}— entrega en {operacion.destination
                    ? `${operacion.destination.name}, ${operacion.destination.province_name}`
                    : 'destino no informado'}
                </p>
                <p className={styles.trasladoTexto}>Entrega {operacion.seller_name}</p>
              </div>

              <div className={styles.orderItems}>
                {operacion.items.map((item, index) => (
                  <div key={index} className={styles.orderItem}>
                    <span className={styles.itemName}>{item.product_name}</span>
                    <span className={styles.itemQuantity}>x{item.quantity}</span>
                  </div>
                ))}
              </div>

              <p className={styles.trasladoDeclaracion}>
                La coordinación y el precio del flete se acuerdan directamente.
              </p>
            </div>
          ))}
        </div>
      )}
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
            <div className={styles.emptyIcon}></div>
            <h3>Cargando tus compras...</h3>
          </div>
        ) : purchases.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}></div>
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
                    <p className={styles.orderDate}> {new Date(order.date).toLocaleDateString('es-AR')}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className={styles.orderItems}>
                  {order.items.map((item, index) => (
                    <div key={index} className={styles.orderItem}>
                      <span className={styles.itemName}>{item.productName}</span>
                      <span className={styles.itemQuantity}>x{item.quantity}</span>
                      <span className={styles.itemPrice}>
                        {formatPrice(item.price)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.orderTotal}>
                  <strong>Total:</strong> {formatPrice(order.total)}
                </div>

                {renderTraslado(order.shipping, true)}

                {/*
                  El pago que quedó a medias. Aparece sólo si el servidor dice
                  que esta orden todavía se puede pagar y que es de Mercado
                  Pago: una cancelada, una rechazada o una por transferencia no
                  ofrecen nada.
                */}
                {/*
                  En qué anda el pago, para los dos lados. Va antes del botón
                  porque es la información; el botón es la acción.
                */}
                {order.paymentMethod === 'mercadopago' && order.paymentState
                  && TEXTO_DEL_PAGO[order.paymentState] && (
                  <p
                    className={`${styles.estadoDePago} ${
                      TEXTO_DEL_PAGO[order.paymentState].problema
                        ? styles.estadoDePagoProblema
                        : ''
                    }`}
                  >
                    {TEXTO_DEL_PAGO[order.paymentState].texto}
                  </p>
                )}

                {order.canPay && order.paymentMethod === 'mercadopago' && (
                  <div className={styles.pagoPendiente}>
                    <p className={styles.pagoPendienteTexto}>
                      Esta orden se paga con Mercado Pago y todavía está
                      <strong> pendiente de confirmación</strong>.
                    </p>
                    <button
                      type="button"
                      className={styles.pagoPendienteBoton}
                      disabled={preparandoPago === order.orderId}
                      onClick={() => void continuarPago(order)}
                    >
                      {preparandoPago === order.orderId
                        ? 'Preparando…'
                        : order.paymentUrl ? 'Continuar pago' : 'Preparar pago'}
                    </button>
                    {errorDePago[order.orderId] && (
                      <p className={styles.pagoPendienteError} role="alert">
                        {errorDePago[order.orderId]}
                      </p>
                    )}
                  </div>
                )}

                {order.rejectionReason && (
                  <div className={styles.contactInfo}>
                    <strong>Motivo del rechazo:</strong> {order.rejectionReason}
                  </div>
                )}

                {/*
                  La transferencia que quedó a medias.
                  Antes esto vivía sólo adentro del checkout: quien cerraba esa
                  ventana sin adjuntar se quedaba sin forma de pagar una compra
                  que ya existía, y acá sólo le ofrecíamos cancelarla.
                  Aparece cuando el servidor dice que la orden es por
                  transferencia y que todavía espera el comprobante; la pantalla
                  no deduce el estado.
                  Los datos bancarios salen del SNAPSHOT de la orden y no del
                  perfil del vendedor: es a dónde ESTA compra acordó transferir.
                  Si el vendedor cambia su CBU mañana, pagar a la cuenta nueva
                  sería pagarle a otra cosa.
                */}
                {order.paymentMethod === 'transfer'
                  && order.status === 'awaiting-transfer-receipt'
                  && order.transferencia && (
                  <div className={styles.pagoPendiente}>
                    <p className={styles.pagoPendienteTexto}>
                      Esta compra se paga por <strong>transferencia</strong> y
                      todavía falta el comprobante.
                    </p>
                    {order.transferencia.titular && (
                      <p><strong>Titular:</strong> {order.transferencia.titular}</p>
                    )}
                    {order.transferencia.cbu && (
                      <p><strong>CBU:</strong> {order.transferencia.cbu}</p>
                    )}
                    {order.transferencia.alias && (
                      <p><strong>Alias:</strong> {order.transferencia.alias}</p>
                    )}
                    <p><strong>Importe:</strong> {formatPrice(order.total)}</p>
                    <p>
                      Usá <strong>{order.id}</strong> como concepto de la
                      transferencia. Es lo que le permite al vendedor reconocer
                      tu pago en su resumen bancario.
                    </p>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      aria-label={`Comprobante de la orden ${order.id}`}
                      onChange={(event) => {
                        const archivo = event.target.files?.[0];
                        if (!archivo) return;
                        setComprobantes((actuales) => ({
                          ...actuales, [order.orderId]: archivo,
                        }));
                        setErrorDeComprobante((actuales) => ({
                          ...actuales, [order.orderId]: '',
                        }));
                      }}
                    />
                    <button
                      type="button"
                      className={styles.pagoPendienteBoton}
                      disabled={enviandoComprobante === order.orderId}
                      onClick={() => void enviarComprobante(order)}
                    >
                      {enviandoComprobante === order.orderId
                        ? 'Enviando…'
                        : 'Enviar comprobante'}
                    </button>
                    {errorDeComprobante[order.orderId] && (
                      <p className={styles.pagoPendienteError} role="alert">
                        {errorDeComprobante[order.orderId]}
                      </p>
                    )}
                  </div>
                )}

                {order.seller && (order.status === 'confirmed' || order.status === 'in-transit' || order.status === 'delivered') && (
                  <div className={styles.contactInfo}>
                    <div className={styles.unlocked}> Información de Contacto del Vendedor</div>
                    <p><strong>{order.seller.name}</strong></p>
                    <p> {order.seller.phone}</p>
                    <a 
                      href={`https://wa.me/${order.seller.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.whatsappButton}
                    >
                      Contactar por WhatsApp
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
                      Cancelar Pedido
                    </button>
                  )}
                  {order.status === 'in-transit' && (
                    <button 
                      className={styles.confirmButton}
                      onClick={() => handleConfirmDelivery(order.id)}
                    >
                      Confirmar Recepción
                    </button>
                  )}
                  {order.status === 'delivered' && !ratedOrders.has(order.id) && (
                    <button 
                      className={styles.confirmButton}
                      onClick={() => openRatingModal(order.id, order.seller?.name || 'Vendedor')}
                    >
                      Calificar Vendedor
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
          <div className={styles.emptyIcon}></div>
          <h3>Cargando tus ventas...</h3>
        </div>
      ) : sales.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}></div>
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
                  <p className={styles.orderDate}> {new Date(order.date).toLocaleDateString('es-AR')}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className={styles.orderItems}>
                {order.items.map((item, index) => (
                  <div key={index} className={styles.orderItem}>
                    <span className={styles.itemName}>{item.productName}</span>
                    <span className={styles.itemQuantity}>x{item.quantity}</span>
                    <span className={styles.itemPrice}>
                      {formatPrice(item.price)}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.orderTotal}>
                <strong>Total:</strong> {formatPrice(order.total)}
              </div>

              {renderTraslado(order.shipping, false)}

              {order.buyer && order.status !== 'cancelled' && (
                <div className={styles.contactInfo}>
                  <div className={styles.unlocked}> Información del Comprador</div>
                  <p><strong>{order.buyer.name}</strong></p>
                  <p> {order.buyer.phone}</p>
                  <p> {order.buyer.address}</p>
                </div>
              )}

              {/* El motivo que el propio vendedor escribio al rechazar, a la
                  vista en su venta: la decision y su razon viven juntas. */}
              {order.rejectionReason && (
                <div className={styles.contactInfo}>
                  <strong>Motivo del rechazo:</strong> {order.rejectionReason}
                </div>
              )}

              {order.transferReceiptUrl && (
                <div className={styles.contactInfo}>
                  <div className={styles.unlocked}> Comprobante de transferencia</div>
                  <a
                    href={getImageUrl(order.transferReceiptUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver comprobante
                  </a>
                </div>
              )}

              {/*
                En qué anda el pago por Mercado Pago. Es el mismo texto que ve
                el comprador: si acá dijera otra cosa, el que despacha y el que
                reclama estarían mirando dos verdades.
              */}
              {order.paymentMethod === 'mercadopago' && order.paymentState
                && TEXTO_DEL_PAGO[order.paymentState] && (
                <p
                  className={`${styles.estadoDePago} ${
                    TEXTO_DEL_PAGO[order.paymentState].problema
                      ? styles.estadoDePagoProblema
                      : ''
                  }`}
                >
                  {TEXTO_DEL_PAGO[order.paymentState].texto}
                </p>
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
                      onClick={() => handleTransferDecision(order.id)}
                    >
                      {order.status === 'transfer-receipt-submitted'
                        ? ' Aprobar comprobante'
                        : ' Aprobar transferencia'}
                    </button>
                    <button
                      className={styles.rejectButton}
                      onClick={() => abrirElRechazo(order)}
                    >
                      {order.status === 'transfer-receipt-submitted'
                        ? ' Rechazar comprobante'
                        : ' Rechazar transferencia'}
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
                        Confirmar Pedido
                      </button>
                    )}
                    <button 
                      className={styles.rejectButton}
                      onClick={() => handleRejectOrder(order.id)}
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {order.status === 'confirmed' && (
                  <>
                    <button 
                      className={styles.confirmButton}
                      onClick={() => handleMarkAsShipped(order.id)}
                    >
                      Marcar como Enviado
                    </button>
                    <button 
                      className={styles.rejectButton}
                      onClick={() => handleRejectOrder(order.id)}
                    >
                      Cancelar Venta
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
        <h2>Mis publicaciones</h2>
        <button 
          className={styles.addButton}
          onClick={onPublishClick}
        >
          + Publicar
        </button>
      </div>

      {loadingProducts ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}></div>
          <h3>Cargando tus productos...</h3>
        </div>
      ) : productsError ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}></div>
          <h3>Error al cargar productos</h3>
          <p>{productsError}</p>
        </div>
      ) : userProducts.length > 0 ? (
        <div className={styles.productsGrid}>
          {userProducts.map((product) => {
            // La anatomía manda acá igual que en el catálogo. La tarjeta del
            // panel imprimía siempre foto, precio con formato propio y
            // «Stock: N unidades»: sobre un servicio eso es un dato que nadie
            // cargó —el stock de un servicio es NULL— y una foto que no existe.
            const anatomia = normalizarAnatomia(product.operationKind);
            const deServicio = esDeServicio(anatomia);
            const estado = product.status === 'active'
              ? 'Activo'
              : product.status === 'paused' ? 'Pausado' : 'Agotado';
            const distintivo = (
              <div className={`${styles.productStatusBadge} ${styles[`status-${product.status}`]}`}>
                {estado}
              </div>
            );

            return (
            <div key={product.id} className={styles.productCard}>
              {deServicio ? (
                <div className={styles.productEncabezado}>{distintivo}</div>
              ) : (
                <div className={styles.productImage}>
                  <ProductImage src={product.image} alt={product.name} />
                  {distintivo}
                </div>
              )}

              <div className={styles.productInfo}>
                <p className={styles.anatomiaEtiqueta}>{ETIQUETA_DE_ANATOMIA[anatomia]}</p>
                <h3>{product.name}</h3>
                <p className={styles.productCategory}>{product.category}</p>

                <div className={styles.productMeta}>
                  <div className={styles.productPrice}>
                    <strong>{precioVisible(product)}</strong>
                  </div>
                  {deServicio ? (
                    product.pricingType ? (
                      <div className={styles.productStock}>
                        {etiquetaDeCatalogo(product.pricingType)}
                      </div>
                    ) : null
                  ) : (
                    <div className={styles.productStock}>
                      Stock: {formatCantidad(product.stock, product.unit)}
                    </div>
                  )}
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
                      {product.status === 'active' ? ' Pausar' : ' Activar'}
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
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}></div>
          <h3>Todavía no publicaste nada</h3>
          <p>Acá vas a ver tus productos y tus servicios publicados.</p>
          <button 
            className={styles.primaryButton}
            onClick={onPublishClick}
          >
            + Publicar la primera
          </button>
        </div>
      )}
    </div>
  );

  const renderNotifications = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2> Notificaciones</h2>
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
          <div className={styles.emptyIcon}></div>
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
                {rotuloDeAviso(notification.type)}
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

  // Atrapa el foco, lo devuelve al cerrar, cierra con Escape y traba el
  // scroll del fondo. Ninguna capa del producto hacía nada de esto.
  const capa = useCapaModal<HTMLDivElement>(pedirCierreDelPanel);
  // La capa del rechazo usa la pila ya aceptada: foco adentro, trampa de Tab,
  // Escape que cierra sólo la de arriba y foco de vuelta a su disparador.
  const capaDelRechazo = useCapaModal<HTMLDivElement>(
    cerrarElRechazo, rechazoDeTransferencia !== null,
  );

  return (
    <div className={styles.overlay} onClick={pedirCierreDelPanel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-label="Mi cuenta"
        tabIndex={-1}
      >
        <button className={styles.closeButton} aria-label="Cerrar" onClick={pedirCierreDelPanel}>
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
          {esTransportista && (
            <button
              className={`${styles.tab} ${activeTab === 'operations' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('operations')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 3h15v13H1z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 8h4l3 3v5h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="5.5" cy="18.5" r="2.5" strokeWidth="2"/>
                <circle cx="18.5" cy="18.5" r="2.5" strokeWidth="2"/>
              </svg>
              Mis Operaciones
            </button>
          )}
          <button
            className={`${styles.tab} ${activeTab === 'products' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mis publicaciones
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'notifications' && renderNotifications()}
          {activeTab === 'purchases' && renderPurchases()}
          {activeTab === 'sales' && renderSales()}
          {activeTab === 'operations' && esTransportista && renderOperaciones()}
          {activeTab === 'products' && renderProducts()}
        </div>
      </div>
      
      {/* Rechazo de una transferencia: capa propia, con motivo obligatorio. */}
      {rechazoDeTransferencia && (
        <div
          className={styles.editModalOverlay}
          onClick={(evento) => {
            // El clic no sube al fondo del panel, que también cierra.
            evento.stopPropagation();
            cerrarElRechazo();
          }}
        >
          <div
            className={styles.editModal}
            ref={capaDelRechazo}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-del-rechazo"
            aria-busy={enviandoElRechazo || undefined}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.editModalHeader}>
              <h2 id="titulo-del-rechazo">
                {rechazoDeTransferencia.conComprobante
                  ? 'Rechazar el comprobante'
                  : 'Rechazar la transferencia'}
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Cerrar"
                onClick={cerrarElRechazo}
                disabled={enviandoElRechazo}
              >
                ×
              </button>
            </div>

            <div className={styles.editModalContent}>
              <p className={styles.ayudaCampo}>
                Venta #{rechazoDeTransferencia.orderId} a{' '}
                <strong>{rechazoDeTransferencia.comprador}</strong> por{' '}
                {formatPrice(rechazoDeTransferencia.total)}.
                {rechazoDeTransferencia.conComprobante
                  ? ' El comprobante que adjuntó queda rechazado.'
                  : ' La orden queda rechazada por falta de acreditación.'}
              </p>

              <div className={styles.editFormGroup}>
                <label htmlFor="motivo-del-rechazo">
                  Motivo del rechazo
                </label>
                <textarea
                  id="motivo-del-rechazo"
                  ref={motivoDelRechazoRef}
                  value={motivoDelRechazo}
                  onChange={(e) => {
                    setErrorDelRechazo('');
                    setMotivoDelRechazo(e.target.value);
                  }}
                  aria-invalid={errorDelRechazo ? true : undefined}
                  rows={4}
                  maxLength={500}
                  placeholder="Ej: el importe acreditado no coincide con el total de la orden."
                />
                <p className={styles.ayudaCampo}>
                  Lo lee el comprador. Sin motivo no se puede rechazar.
                </p>
              </div>

              {errorDelRechazo && (
                // El error vive acá adentro y no se desvanece: mientras se
                // corrige tiene que seguir a la vista.
                <p className={styles.ayudaCampo} role="alert">{errorDelRechazo}</p>
              )}
            </div>

            <div className={styles.editModalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={cerrarElRechazo}
                disabled={enviandoElRechazo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.rejectButton}
                onClick={confirmarElRechazo}
                disabled={enviandoElRechazo}
              >
                {enviandoElRechazo ? 'Rechazando…' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Producto */}
      {editingProduct && (
        <div
          className={styles.editModalOverlay}
          onClick={(evento) => {
            // El clic no sube al fondo del panel, que también cierra: sin esto,
            // cerrar la edición cerraba además Mi Panel entero.
            evento.stopPropagation();
            pedirCierreDeLaEdicion();
          }}
        >
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.editModalHeader}>
              <h2> Editar {editingProduct.publication_type === 'servicio' ? 'Servicio' : 'Producto'}</h2>
              <button 
                className={styles.closeButton}
                onClick={pedirCierreDeLaEdicion}
              >
                ×
              </button>
            </div>
            
            <div className={styles.editModalContent}>
              {/* Nombre */}
              <div className={styles.editFormGroup}>
                <label htmlFor="edit-nombre">Nombre del {editingProduct.publication_type === 'servicio' ? 'Servicio' : 'Producto'}</label>
                <input
                  id="edit-nombre"
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
                <label htmlFor="edit-descripcion">Descripción</label>
                <textarea
                  id="edit-descripcion"
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
                  <label htmlFor="edit-categoria">Categoría</label>
                  <input
                    id="edit-categoria"
                    type="text"
                    value={editingProduct.category_name}
                    disabled
                    className={styles.disabledInput}
                  />
                  <small>La categoría no se puede cambiar</small>
                </div>
                
                <div className={styles.editFormGroup}>
                  <label htmlFor="edit-subcategoria">Subcategoría</label>
                  <select
                    id="edit-subcategoria"
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
              
              {/* Clase de publicación: la que decide qué muestra la tarjeta y
                  qué acción ofrece. Se puede corregir acá porque los avisos
                  anteriores a la columna heredaron la de su categoría. */}
              <div className={styles.editFormGroup}>
                <label htmlFor="edit-operation-kind">Clase de publicación</label>
                <select
                  id="edit-operation-kind"
                  value={editingProduct.operation_kind}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    operation_kind: e.target.value as OperationKind,
                  })}
                >
                  {(editingProduct.publication_type === 'servicio'
                    ? (['servicio', 'logistica'] as OperationKind[])
                    : (['activo', 'insumo'] as OperationKind[])
                  ).map(clase => (
                    <option key={clase} value={clase}>{ETIQUETA_DE_ANATOMIA[clase]}</option>
                  ))}
                </select>
              </div>

              {editingProduct.operation_kind === 'activo' && (
                <div className={styles.editFormGroup}>
                  <label htmlFor="edit-condition">Condición</label>
                  <select
                    id="edit-condition"
                    value={editingProduct.condition}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      condition: e.target.value as Condition | '',
                    })}
                  >
                    <option value="">Sin declarar</option>
                    {(['nuevo', 'usado'] as Condition[]).map(valor => (
                      <option key={valor} value={valor}>{ETIQUETA_DE_CONDICION[valor]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Precio, Stock y Unidad - Solo para productos */}
              {editingProduct.publication_type === 'producto' ? (
                <div className={styles.editFormRow}>
                  <div className={styles.editFormGroup}>
                    <label htmlFor="edit-precio">Precio ($)</label>
                    <input
                      id="edit-precio"
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
                    <label htmlFor="edit-stock">Stock</label>
                    <input
                      id="edit-stock"
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
                    <label htmlFor="edit-unidad">Unidad</label>
                    <select
                      id="edit-unidad"
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
                      <label htmlFor="edit-tipo-precio">Tipo de Precio</label>
                      <select
                        id="edit-tipo-precio"
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
                      <label htmlFor="edit-precio-servicio">Precio ($)</label>
                      <input
                        id="edit-precio-servicio"
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
                      <label htmlFor="edit-disponibilidad">Disponibilidad</label>
                      <select
                        id="edit-disponibilidad"
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
                      <label htmlFor="edit-respuesta">Tiempo de respuesta</label>
                      <select
                        id="edit-respuesta"
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
                      <label htmlFor="edit-experiencia">Años de experiencia</label>
                      <input
                        id="edit-experiencia"
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
              
              {/* Ubicación de la publicación, del padrón oficial. No es la del
                  perfil de quien publica: ese es otro dato y vive en Mi Perfil. */}
              <div className={styles.editFormRow}>
                <div className={styles.editFormGroup}>
                  <label htmlFor="edit-provincia">Provincia</label>
                  <select
                    id="edit-provincia"
                    value={editingProduct.province_id}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      province_id: e.target.value,
                      // Cambiar de provincia deja la localidad sin elegir: la
                      // anterior ya no pertenece a lo que se está ofreciendo.
                      locality_id: '',
                    })}
                  >
                    <option value="">Seleccionar...</option>
                    {provinciasDeLaEdicion.map((provincia) => (
                      <option key={provincia.id} value={provincia.id}>{provincia.name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.editFormGroup}>
                  <label htmlFor="edit-localidad">Localidad</label>
                  <select
                    id="edit-localidad"
                    ref={localidadDeLaEdicion}
                    aria-invalid={ubicacionIncompleta || undefined}
                    value={editingProduct.locality_id}
                    onChange={(e) => {
                      setUbicacionIncompleta(false);
                      setEditingProduct({
                        ...editingProduct,
                        locality_id: e.target.value,
                      });
                    }}
                    disabled={!editingProduct.province_id}
                  >
                    <option value="">Seleccionar...</option>
                    {localidadesDeLaEdicion.map((localidad) => (
                      <option key={localidad.id} value={localidad.id}>{localidad.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {ubicacionIncompleta && (
                <p className={styles.ayudaCampo} role="alert">
                  Elegí también la localidad: la ubicación se guarda entera. Hasta
                  que la elijas, la publicación queda donde estaba.
                </p>
              )}
              {padronDeLaEdicion && (
                <p className={styles.ayudaCampo} role="status">{padronDeLaEdicion}</p>
              )}
              {!editingProduct.locality_id && (
                // Una publicación heredada puede no tener localidad oficial. Se
                // dice tal cual: elegir una la sanea, y no elegirla no fabrica
                // ninguna por el costado.
                <p className={styles.ayudaCampo} role="status">
                  Esta publicación no tiene ubicación oficial. Elegí provincia y
                  localidad para que aparezca en los filtros del Mercado.
                </p>
              )}
              
              {/* Sección de Imágenes */}
              <div className={styles.editFormGroup}>
                <label> Imágenes del {editingProduct.publication_type === 'servicio' ? 'Servicio' : 'Producto'}</label>
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
                <small style={{ color: 'var(--tg-color-text-secondary)', marginTop: '8px', display: 'block' }}>
                  {editingProduct.existingImages.length + editingProduct.newImages.length} de {MAX_IMAGES_PER_PRODUCT} imágenes
                  {(editingProduct.existingImages.length + editingProduct.newImages.length) >= MAX_IMAGES_PER_PRODUCT && 
                    ' (máximo alcanzado)'}
                </small>
              </div>
            </div>
            
            <div className={styles.editModalActions}>
              <button
                className={styles.cancelBtn}
                onClick={pedirCierreDeLaEdicion}
              >
                Cancelar
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSaveEditProduct}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Guardando...' : ' Guardar Cambios'}
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
          onClick={(evento) => {
            // Igual que la edición: el fondo de la calificación no puede
            // cerrar además el panel que está debajo.
            evento.stopPropagation();
            pedirCierreDeLaCalificacion();
          }}
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
              <h2 style={{ margin: 0, color: 'var(--tg-color-brand)', fontSize: '1.5rem' }}>
                Calificar a {ratingModal.sellerName}
              </h2>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: 'var(--tg-color-text)' }}>
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
                      color: star <= ratingScore ? 'var(--tg-color-warning)' : 'var(--tg-color-text-secondary)',
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
              <p style={{ textAlign: 'center', marginTop: '12px', color: 'var(--tg-color-text-secondary)', fontSize: '1.1rem' }}>
                {ratingScore === 1 && ' Muy malo'}
                {ratingScore === 2 && ' Malo'}
                {ratingScore === 3 && ' Regular'}
                {ratingScore === 4 && ' Bueno'}
                {ratingScore === 5 && ' Excelente'}
              </p>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--tg-color-text)' }}>
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
              <small style={{ color: 'var(--tg-color-text-secondary)' }}>{ratingComment.length}/500 caracteres</small>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pedirCierreDeLaCalificacion();
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '2px solid #ddd',
                  backgroundColor: 'white',
                  color: 'var(--tg-color-text-secondary)',
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
                  backgroundColor: submittingRating ? 'var(--tg-color-border-control)' : 'var(--tg-color-brand)',
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
      {salida.pregunta}
    </div>
  );
};
