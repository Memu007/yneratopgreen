import React, { useCallback, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { NewProductData } from '../../types';
import { apiPost, apiGet } from '../../utils/api';
import { revisarElPrecio } from '../../publicaciones/precio';
import {
  fraseDeImagenesFallidas,
  subirImagenDePublicacion,
} from '../../publicaciones/imagenes';
import {
  ANIO_MINIMO,
  anioMaximo,
  ORIGENES,
  ROTULO_DEL_ORIGEN,
  type OrigenDeclarado,
} from '../../utils/catalogService';
import styles from './AddProductModal.module.css';
import { ProductImage } from '../ProductImage/ProductImage';
import { Condition, OperationKind, ETIQUETA_DE_ANATOMIA, ETIQUETA_DE_CONDICION } from '../../utils/anatomia';
import { useCapaModal } from '../../hooks/useCapaModal';
import { huboCambios, useSalidaProtegida } from '../../formularios/salidaProtegida';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: NewProductData) => void;
}

interface ImageFile {
  id: string;
  url: string;
  file?: File;
}

const UNITS = ['kg', 'ton', 'litros', 'unidad', 'bolsa', 'pack', 'ha'];

const SERVICE_PRICING_TYPES = [
  { value: 'por_hora', label: 'Por hora' },
  { value: 'por_hectarea', label: 'Por hectárea' },
  { value: 'por_trabajo', label: 'Por trabajo/servicio' },
  { value: 'a_convenir', label: 'A convenir' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'inmediata', label: 'Disponibilidad inmediata' },
  { value: 'programar', label: 'A programar' },
  { value: 'temporada', label: 'Solo en temporada' },
];

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  /** La lista cerrada de tipos del subrubro: el tercer nivel. */
  tipos?: { value: string; label: string }[];
  /** Si el subrubro lleva potencia en HP (Tractores). */
  usa_potencia?: boolean;
}

interface CategoryFromBackend {
  id: string;
  name: string;
  is_service: boolean;
  default_operation_kind: OperationKind;
  // Si esta categoría declara marca. No se deduce de la anatomía.
  usa_marca?: boolean;
  subcategories: Subcategory[];
}

// Interfaces para opciones de formulario
interface FormOptionItem {
  value: string;
  label: string;
}

interface FormOptionsData {
  unit: FormOptionItem[];
  brand: FormOptionItem[];
  pricing_type: FormOptionItem[];
  availability: FormOptionItem[];
  response_time: FormOptionItem[];
}

interface ProvinceOption {
  id: string;
  name: string;
}

interface LocalityOption {
  id: string;
  name: string;
  /** El nombre, con el departamento si se repite en la provincia. */
  label: string;
  province_id: string;
  province_name: string;
  latitude: number;
  longitude: number;
}

// Con qué valores abre el formulario. Se usan para arrancar y para volver a
// dejarlo vacío, así «vacío» significa lo mismo en los dos lados.
const FORMULARIO_VACIO = (): NewProductData => ({
  name: '',
  category: '',
  subcategory: '',
  localityId: '',
  price: 0,
  description: '',
  image: '',
  location: { province: '', city: '' },
  stock: 0,
  unit: 'kg',
  features: {},
  tags: [],
});

const SERVICIO_VACIO = () => ({
  pricingType: 'por_hora',
  availability: 'inmediata',
  coverageZones: [] as string[],
  experienceYears: '',
  hasEquipment: true,
  responseTime: '24hs',
});

const RETRATO_VACIO = {
  publicationType: 'producto',
  operationKind: 'insumo',
  condition: '',
  formData: FORMULARIO_VACIO(),
  serviceData: SERVICIO_VACIO(),
  selectedProvinceId: '',
  zoneInput: '',
  featureKey: '',
  featureValue: '',
  tagInput: '',
  imagenes: [] as string[],
};

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSubmit }) => {

  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryFromBackend[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [localities, setLocalities] = useState<LocalityOption[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [localitiesLoading, setLocalitiesLoading] = useState(false);
  const [formOptions, setFormOptions] = useState<FormOptionsData>({
    unit: [],
    brand: [],
    pricing_type: [],
    availability: [],
    response_time: []
  });
  
  // Tipo de publicación: producto o servicio
  const [publicationType, setPublicationType] = useState<'producto' | 'servicio'>('producto');
  // Cuál de las cuatro anatomías es. Arranca con la que declara la categoría
  // elegida y el vendedor puede corregirla: es él quien sabe si lo que sube
  // es una máquina única o un insumo que se vende de a bolsas.
  const [operationKind, setOperationKind] = useState<OperationKind>('insumo');
  // Nuevo o usado. Sólo la pide el activo de alto valor, y se puede dejar
  // sin declarar: en hacienda y campos el par no significa nada, y obligar a
  // elegir uno haría que el vendedor conteste cualquier cosa para publicar.
  const [condition, setCondition] = useState<Condition | ''>('');

  // La marca, cuando la categoría la ofrece. Vacía es «sin declarar» y no
  // viaja: la lista no puede tener todas las marcas que existen, y obligar
  // a elegir una haría que el vendedor conteste cualquiera para publicar.
  const [brand, setBrand] = useState('');

  // El tipo —el tercer nivel— y la potencia. Cuelgan del SUBRUBRO: se
  // ofrecen si el subrubro elegido los tiene, se sueltan al cambiarlo y son
  // opcionales, porque obligar a elegir haría que quien vende conteste
  // cualquiera para poder publicar.
  const [tipo, setTipo] = useState('');
  const [potencia, setPotencia] = useState('');

  // Modelo y año, donde la categoría pide marca, y el origen, en cualquier
  // producto. Opcionales por lo mismo que la marca.
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [origen, setOrigen] = useState<OrigenDeclarado | ''>('');
  
  const [formData, setFormData] = useState<NewProductData>(FORMULARIO_VACIO);

  // Datos específicos de servicios
  const [serviceData, setServiceData] = useState(SERVICIO_VACIO);
  const [zoneInput, setZoneInput] = useState('');

  const [featureKey, setFeatureKey] = useState('');
  const [featureValue, setFeatureValue] = useState('');
  const [tagInput, setTagInput] = useState('');

  // El retrato de lo que hay escrito. Se compara contra el del formulario
  // recién abierto, así un valor precargado no cuenta como cambio y volver un
  // campo a su valor original deja el formulario limpio otra vez. Las imágenes
  // entran por nombre: un archivo no se puede serializar.
  const hayBorrador = huboCambios(RETRATO_VACIO, {
    publicationType,
    operationKind,
    condition,
    formData,
    serviceData,
    selectedProvinceId,
    zoneInput,
    featureKey,
    featureValue,
    tagInput,
    imagenes: images.map((imagen) => imagen.file?.name ?? ''),
  });
  // El cierre protegido se dispara desde `useCapaModal`, que se queda con la
  // función que le pasan: por eso el borrador viaja por referencia.
  const hayBorradorRef = useRef(hayBorrador);
  hayBorradorRef.current = hayBorrador;

  const limpiarFormulario = useCallback(() => {
    setFormData(FORMULARIO_VACIO());
    setServiceData(SERVICIO_VACIO());
    setPublicationType('producto');
    setOperationKind('insumo');
    setCondition('');
    // Todo lo declarado se suelta: la marca se quedaba, y el alta siguiente
    // se abría con la marca de la publicación anterior ya elegida.
    setBrand('');
    setTipo('');
    setPotencia('');
    setModelo('');
    setAnio('');
    setOrigen('');
    setSelectedProvinceId('');
    setLocalities([]);
    setImages([]);
    setZoneInput('');
    setFeatureKey('');
    setFeatureValue('');
    setTagInput('');
  }, []);

  // Un solo camino de salida para los cuatro cierres del alta: Escape, la X,
  // el fondo y «Cancelar». Descartar limpia el borrador: si no, el alta
  // siguiente se abriría con lo que la persona acababa de descartar.
  // `alSalir` se desprende del objeto: el objeto se vuelve a crear en cada
  // render y `alSalir` no. Con el cierre estable, la capa no se vuelve a
  // montar mientras se escribe.
  const salida = useSalidaProtegida();
  const { alSalir } = salida;
  const cerrarYLimpiar = useCallback(() => {
    limpiarFormulario();
    onClose();
  }, [limpiarFormulario, onClose]);
  const pedirCierre = useCallback(
    () => alSalir(hayBorradorRef.current, cerrarYLimpiar),
    [alSalir, cerrarYLimpiar],
  );

  // Antes de cualquier `return` temprano: un hook se llama siempre y en el
  // mismo orden. El interruptor es el que decide si hace algo.
  const capa = useCapaModal<HTMLDivElement>(pedirCierre, isOpen);

  // Cargar categorías y opciones del backend
  React.useEffect(() => {
    if (isOpen) {
      // Cargar categorías
      apiGet<CategoryFromBackend[]>('/catalog/categories?include_empty=true')
        .then(data => setCategories(data))
        .catch(err => console.error('Error cargando categorías:', err))
        .finally(() => setCategoriesLoaded(true));
      
      // Cargar opciones de formulario
      apiGet<Partial<FormOptionsData>>('/catalog/form-options')
        .then((data) => setFormOptions(prev => ({ ...prev, ...data })))
        .catch(err => console.error('Error cargando opciones:', err));

      apiGet<ProvinceOption[]>('/catalog/localities/provinces')
        .then(data => setProvinces(data))
        .catch(err => console.error('Error cargando provincias:', err));
    }
  }, [isOpen]);

  // Si no está autenticado, no mostrar el modal
  if (!isAuthenticated || !user) {
    if (isOpen) {
      // La misma frase que la puerta, en la misma lengua. Esta guarda ya no
      // se alcanza desde ningún CTA de publicación —la puerta no abre el
      // formulario sin sesión—, pero era el único tuteo que quedaba del
      // camino, y dejarlo escrito lo dejaba listo para volver.
      showToast('Iniciá sesión para publicar una oferta', 'warning');
      onClose();
    }
    return null;
  }

  if (!isOpen) return null;

  // Filtrar categorías según tipo de publicación (del backend)
  const backendCategories = categories.filter(cat => 
    publicationType === 'servicio' ? cat.is_service : !cat.is_service
  );
  
  // La API es la única fuente de categorías. No usar fallbacks que puedan
  // publicar IDs inexistentes mientras la carga todavía está en curso.
  const currentCategories = backendCategories.map(cat => ({
    value: cat.name,
    anatomiaPorOmision: cat.default_operation_kind,
    // Lo dice la categoría y no la anatomía: «activo» incluye campos y
    // hacienda, y ni un campo ni un ternero tienen marca.
    usaMarca: cat.usa_marca === true,
    subcategories: cat.subcategories?.map((s: Subcategory) => s.name) || []
  }));
  
  // Obtener subcategorías de la categoría seleccionada
  const selectedCategory = currentCategories.find(cat => cat.value === formData.category);
  // Y el subrubro elegido, con su lista de tipos y si lleva potencia.
  const subrubroElegido = backendCategories
    .find(cat => cat.name === formData.category)
    ?.subcategories?.find((s: Subcategory) => s.name === formData.subcategory);
  const tiposDelSubrubro = subrubroElegido?.tipos ?? [];

  // Funciones para manejo de zonas de cobertura (servicios)
  const addCoverageZone = (zone?: string) => {
    const value = zone || zoneInput;
    if (value && !serviceData.coverageZones.includes(value)) {
      setServiceData(prev => ({
        ...prev,
        coverageZones: [...prev.coverageZones, value]
      }));
      setZoneInput('');
    }
  };

  const removeCoverageZone = (zone: string) => {
    setServiceData(prev => ({
      ...prev,
      coverageZones: prev.coverageZones.filter(z => z !== zone)
    }));
  };

  // Reset form cuando cambia el tipo
  const handleTypeChange = (type: 'producto' | 'servicio') => {
    setOperationKind(type === 'servicio' ? 'servicio' : 'insumo');
    setPublicationType(type);
    setTipo('');
    setPotencia('');
    setModelo('');
    setAnio('');
    if (type === 'servicio') setOrigen('');
    setFormData(prev => ({
      ...prev,
      category: '',
      subcategory: '',
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value
        }
      }));
    } else if (name === 'price' || name === 'stock') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (name === 'subcategory') {
      // Otro subrubro, otra lista: el tipo y la potencia de antes se sueltan.
      setTipo('');
      setPotencia('');
      setFormData(prev => ({ ...prev, subcategory: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // La categoría propone; el vendedor dispone. Sin esto habría que
    // elegir la anatomía a ciegas en cada alta.
    const elegida = currentCategories.find(cat => cat.value === e.target.value);
    if (elegida) setOperationKind(elegida.anatomiaPorOmision);
    setTipo('');
    setPotencia('');
    // El modelo y el año son de maquinaria: otra categoría los suelta.
    setModelo('');
    setAnio('');
    setFormData(prev => ({
      ...prev,
      category: e.target.value,
      subcategory: ''
    }));
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceId = e.target.value;
    const province = provinces.find(item => item.id === provinceId);
    setSelectedProvinceId(provinceId);
    setLocalities([]);
    setFormData(prev => ({
      ...prev,
      localityId: '',
      location: {
        province: province?.name || '',
        city: '',
      },
    }));

    if (!provinceId) return;

    setLocalitiesLoading(true);
    try {
      const data = await apiGet<LocalityOption[]>(
        `/catalog/localities?province_id=${encodeURIComponent(provinceId)}`
      );
      setLocalities(data);
    } catch (error) {
      console.error('Error cargando localidades:', error);
    } finally {
      setLocalitiesLoading(false);
    }
  };

  const handleLocalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const localityId = e.target.value;
    const locality = localities.find(item => item.id === localityId);
    setFormData(prev => ({
      ...prev,
      localityId,
      location: {
        province: locality?.province_name || prev.location.province,
        city: locality?.name || '',
      },
    }));
  };

  const addFeature = () => {
    if (featureKey && featureValue) {
      setFormData(prev => ({
        ...prev,
        features: {
          ...prev.features,
          [featureKey]: featureValue
        }
      }));
      setFeatureKey('');
      setFeatureValue('');
    }
  };

  const removeFeature = (key: string) => {
    setFormData(prev => {
      const newFeatures = { ...prev.features };
      delete newFeatures[key];
      return { ...prev, features: newFeatures };
    });
  };

  const addTag = () => {
    if (tagInput && !formData.tags.includes(tagInput)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  // Funciones para manejo de imágenes
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFiles(Array.from(files));
    }
  };

  const MAX_IMAGES = 3; // Máximo de imágenes por producto

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      showToast('Por favor selecciona archivos de imagen válidos', 'warning');
      return;
    }

    // Verificar límite de imágenes
    const availableSlots = MAX_IMAGES - images.length;
    if (availableSlots <= 0) {
      showToast(`Máximo ${MAX_IMAGES} imágenes por producto`, 'warning');
      return;
    }

    if (imageFiles.length > availableSlots) {
      showToast(`Sólo podés agregar ${availableSlots} imagen(es) más`, 'warning');
    }

    // Tomar solo las imágenes que caben
    const filesToProcess = imageFiles.slice(0, availableSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage: ImageFile = {
          id: Math.random().toString(36).substr(2, 9),
          url: reader.result as string,
          file: file
        };
        
        setImages(prev => [...prev, newImage]);
        
        // Actualizar la primera imagen como imagen principal
        if (images.length === 0) {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      // Si eliminamos la imagen principal, actualizar con la siguiente
      if (newImages.length > 0 && formData.image === prev.find(img => img.id === imageId)?.url) {
        setFormData(prevData => ({ ...prevData, image: newImages[0].url }));
      } else if (newImages.length === 0) {
        setFormData(prevData => ({ ...prevData, image: '' }));
      }
      return newImages;
    });
  };

  const setAsMainImage = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      setFormData(prev => ({ ...prev, image: image.url }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas según tipo de publicación
    if (publicationType === 'producto') {
      if (!formData.name || !formData.category || formData.stock === undefined) {
        showToast('Por favor completa todos los campos obligatorios', 'warning');
        return;
      }
    } else {
      if (!formData.name || !formData.category) {
        showToast('Por favor completa el nombre y la categoría', 'warning');
        return;
      }
    }

    // El año, si se declara, va de 1950 al año próximo. La API valida lo
    // mismo; acá se dice antes de mandar.
    if (selectedCategory?.usaMarca && anio
      && !(Number(anio) >= ANIO_MINIMO && Number(anio) <= anioMaximo())) {
      showToast(`El año tiene que estar entre ${ANIO_MINIMO} y ${anioMaximo()}.`, 'warning');
      return;
    }

    // El precio lo decide una sola regla, la misma que aplica la edición: si
    // no es «a convenir», tiene que estar y ser mayor a cero.
    const problemaDelPrecio = revisarElPrecio(formData.price, {
      publicationType,
      pricingType: serviceData.pricingType,
    });
    if (problemaDelPrecio) {
      showToast(problemaDelPrecio, 'warning');
      return;
    }

    if (!formData.description || formData.description.length < 10) {
      showToast('La descripción es obligatoria y debe tener al menos 10 caracteres', 'warning');
      return;
    }

    if (!formData.localityId) {
      showToast('Seleccioná una provincia y una localidad', 'warning');
      return;
    }

    // La fotografía es opcional, y acá se bloqueaba la publicación sin una.
    // `ANATOMIAS.md` la declara opcional con respaldo neutro, el catálogo y la
    // ficha ya saben decir «Sin registro fotográfico», y exigirla empujaba al vendedor a
    // subir cualquier imagen para poder publicar. La validación de tipo y de
    // tamaño sigue donde estaba: se aplica a lo que sí se adjunta.

    setIsSubmitting(true);

    try {
      // Buscar el category_id
      const selectedCat = categories.find(cat => cat.name === formData.category);
      if (!selectedCat) {
        showToast('Categoría no válida', 'error');
        setIsSubmitting(false);
        return;
      }

      // Buscar el subcategory_id si hay una subcategoría seleccionada
      let subcategoryId = null;
      if (formData.subcategory && formData.subcategory !== '') {
        const selectedSubcat = selectedCat.subcategories?.find(
          (s: Subcategory) => s.name === formData.subcategory
        );
        if (selectedSubcat) {
          subcategoryId = selectedSubcat.id;
        }
      }

      // 1. Crear el producto/servicio en el backend
      const productPayload: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        price: formData.price || 0,
        category_id: selectedCat.id,
        subcategory_id: subcategoryId,  // Agregar subcategory_id
        locality_id: formData.localityId,
        publication_type: publicationType,
        operation_kind: operationKind,
        condition: operationKind === 'activo' && condition ? condition : undefined,
        brand: selectedCategory?.usaMarca && brand ? brand : undefined,
        subcategory_type: tiposDelSubrubro.length > 0 && tipo ? tipo : undefined,
        power_hp: subrubroElegido?.usa_potencia && potencia ? Number(potencia) : undefined,
        model: selectedCategory?.usaMarca && modelo.trim() ? modelo.trim() : undefined,
        year: selectedCategory?.usaMarca && anio ? Number(anio) : undefined,
        origin: publicationType === 'producto' && origen ? origen : undefined,
      };

      // Campos específicos según tipo
      if (publicationType === 'producto') {
        productPayload.stock = formData.stock;
        productPayload.unit = formData.unit;
      } else {
        // Campos de servicio
        productPayload.pricing_type = serviceData.pricingType;
        productPayload.availability = serviceData.availability;
        productPayload.response_time = serviceData.responseTime;
        productPayload.experience_years = serviceData.experienceYears ? parseInt(serviceData.experienceYears) : null;
        productPayload.has_equipment = serviceData.hasEquipment;
        productPayload.coverage_zones = serviceData.coverageZones;
      }

      const productResponse = await apiPost<{id: string}>('/products', productPayload);
      const productId = productResponse.id;

      // 2. Subir imágenes
      const imageUploadErrors: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (image.file) {
          // La subida y el motivo del fallo son los mismos que usa la edición.
          const motivo = await subirImagenDePublicacion(productId, image.file, i === 0);
          if (motivo) {
            imageUploadErrors.push(`${image.file.name}: ${motivo}`);
          }
        }
      }

      const tipoMsg = publicationType === 'producto' ? 'Producto' : 'Servicio';
      if (imageUploadErrors.length > 0) {
        showToast(
          `${tipoMsg} "${formData.name}" publicado, pero ${fraseDeImagenesFallidas(imageUploadErrors)}`,
          'warning',
        );
      } else {
        showToast(`${tipoMsg} "${formData.name}" publicado exitosamente!`, 'success');
      }
      
      // Llamar al onSubmit del padre para recargar productos
      onSubmit(formData);
      
      // Cerrar el modal
      onClose();
      
      // El formulario vuelve a cero por el mismo camino que usa «descartar».
      limpiarFormulario();

    } catch (error) {
      console.error('Error al crear producto:', error);
      const tipoMsg = publicationType === 'producto' ? 'producto' : 'servicio';
      showToast(`Error al publicar el ${tipoMsg}. Por favor intenta de nuevo.`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={pedirCierre}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-label="Publicar"
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <h2>{publicationType === 'producto' ? 'Publicar un producto' : 'Publicar un servicio'}</h2>
          <button className={styles.closeButton} aria-label="Cerrar" onClick={pedirCierre}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Selector de Tipo de Publicación */}
          <div className={styles.section}>
            <h3>Tipo de Publicación</h3>
            <div className={styles.typeSelector}>
              <button
                type="button"
                className={`${styles.typeButton} ${publicationType === 'producto' ? styles.typeButtonActive : ''}`}
                onClick={() => handleTypeChange('producto')}
              >
                Producto
              </button>
              <button
                type="button"
                className={`${styles.typeButton} ${publicationType === 'servicio' ? styles.typeButtonActive : ''}`}
                onClick={() => handleTypeChange('servicio')}
              >
                Servicio
              </button>
            </div>
          </div>

          {/* Información Básica */}
          <div className={styles.section}>
            <h3>Información Básica</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="name">{publicationType === 'producto' ? 'Nombre del Producto' : 'Nombre del Servicio'} *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={publicationType === 'producto' ? 'Ej: Semillas de Maíz DK 7210' : 'Ej: Servicio de Fumigación Aérea'}
                required
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="category">Categoría *</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleCategoryChange}
                  required
                >
                  <option value="">
                    {categoriesLoaded ? 'Seleccionar...' : 'Cargando categorías...'}
                  </option>
                  {currentCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.value}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="subcategory">Subcategoría</label>
                <select
                  id="subcategory"
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                  disabled={!selectedCategory}
                >
                  <option value="">Seleccionar...</option>
                  {selectedCategory?.subcategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* El tipo: el tercer nivel, de la lista del subrubro. */}
            {tiposDelSubrubro.length > 0 && (
              <div className={styles.formGroup}>
                <label htmlFor="subcategory-type">Tipo</label>
                <select
                  id="subcategory-type"
                  name="subcategory-type"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  <option value="">Sin declarar</option>
                  {tiposDelSubrubro.map(opcion => (
                    <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                  ))}
                </select>
                <p className={styles.helpText}>
                  Quien busca en el Mercado puede filtrar por tipo: si no lo
                  declarás, tu publicación no aparece en ese filtro.
                </p>
              </div>
            )}

            {/* La potencia: en Tractores, el tercer nivel son rangos, y lo que
                se carga es el número. */}
            {subrubroElegido?.usa_potencia && (
              <div className={styles.formGroup}>
                <label htmlFor="power-hp">Potencia (HP)</label>
                <input
                  type="number"
                  id="power-hp"
                  name="power-hp"
                  value={potencia}
                  onChange={(e) => setPotencia(e.target.value)}
                  min={1}
                  max={1000}
                  step={1}
                  inputMode="numeric"
                />
                <p className={styles.helpText}>
                  El Mercado la agrupa en compacto (menos de 60 HP), estándar
                  (60 a 120) y alta (más de 120).
                </p>
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="operation-kind">Clase de publicación *</label>
              <select
                id="operation-kind"
                name="operation-kind"
                value={operationKind}
                onChange={(e) => setOperationKind(e.target.value as OperationKind)}
                required
              >
                {(publicationType === 'servicio'
                  ? (['servicio', 'logistica'] as OperationKind[])
                  : (['activo', 'insumo'] as OperationKind[])
                ).map(clase => (
                  <option key={clase} value={clase}>{ETIQUETA_DE_ANATOMIA[clase]}</option>
                ))}
              </select>
              <p className={styles.helpText}>
                {publicationType === 'servicio'
                  ? 'Logística es transporte y fletes; el resto de los trabajos son servicios.'
                  : 'Un activo es un bien puntual —una máquina, un campo, una hacienda— y pide condición. Un insumo se vende por unidad de medida y con stock.'}
              </p>
            </div>

            {operationKind === 'activo' && (
              <div className={styles.formGroup}>
                <label htmlFor="condition">Condición</label>
                <select
                  id="condition"
                  name="condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as Condition | '')}
                >
                  <option value="">Sin declarar</option>
                  {(['nuevo', 'usado'] as Condition[]).map(valor => (
                    <option key={valor} value={valor}>{ETIQUETA_DE_CONDICION[valor]}</option>
                  ))}
                </select>
                <p className={styles.helpText}>
                  Es lo primero que mira quien compra una máquina. Dejala sin
                  declarar sólo si no aplica —hacienda, campos—: no la completes
                  con una respuesta que no sea cierta.
                </p>
              </div>
            )}

            {/* La marca. La ofrece la CATEGORÍA, no la anatomía: «activo»
                incluye campos y hacienda, y ni un campo ni un ternero tienen
                marca. Por eso no cuelga de `operationKind`. */}
            {selectedCategory?.usaMarca && (
              <div className={styles.formGroup}>
                <label htmlFor="brand">Marca</label>
                <select
                  id="brand"
                  name="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                >
                  <option value="">Sin declarar</option>
                  {formOptions.brand.map(opcion => (
                    <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                  ))}
                </select>
                <p className={styles.helpText}>
                  Elegila de la lista para que quien busque por marca te encuentre.
                  Si la tuya no está, dejala sin declarar: escribirla en el título
                  no la vuelve buscable.
                </p>
              </div>
            )}

            {/* Modelo y año: van con la marca, donde la categoría la pide. */}
            {selectedCategory?.usaMarca && (
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="model">Modelo</label>
                  <input
                    id="model"
                    name="model"
                    type="text"
                    maxLength={80}
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ej.: 280A, 9750 STS"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="year">Año</label>
                  <input
                    id="year"
                    name="year"
                    type="number"
                    inputMode="numeric"
                    min={ANIO_MINIMO}
                    max={anioMaximo()}
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    placeholder={`${ANIO_MINIMO} a ${anioMaximo()}`}
                  />
                </div>
              </div>
            )}

            {/* El origen: lo declara quien vende, y así se lo muestra. */}
            {publicationType === 'producto' && (
              <div className={styles.formGroup}>
                <label htmlFor="origin">Origen</label>
                <select
                  id="origin"
                  name="origin"
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value as OrigenDeclarado | '')}
                >
                  <option value="">Sin declarar</option>
                  {ORIGENES.map(({ valor, rotulo }) => (
                    <option key={valor} value={valor}>{rotulo}</option>
                  ))}
                </select>
                <p className={styles.helpText}>
                  Quien compra lo ve rotulado «{ROTULO_DEL_ORIGEN}»: es lo que
                  vos decís, no algo que la plataforma haya comprobado.
                </p>
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="description">Descripción *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder={publicationType === 'producto' ? "Describe tu producto detalladamente..." : "Describe tu servicio, experiencia y metodología de trabajo..."}
                rows={4}
                required
              />
            </div>
          </div>

          {/* Imágenes */}
          <div className={styles.section}>
            <h3>{publicationType === 'producto' ? 'Fotografías del producto' : 'Fotografías del servicio'} (opcional)</h3>
            <p className={styles.sectionDescription}>
              {publicationType === 'producto'
                ? 'La primera es la principal. Si no subís ninguna, la publicación se muestra con el aviso «Sin registro fotográfico» y se puede publicar igual.'
                : 'Fotos del equipo, de trabajos realizados o de certificaciones. La primera es la principal. Si no subís ninguna, la publicación se muestra con el aviso «Sin registro fotográfico» y se puede publicar igual.'
              }
            </p>
            
            {/* Drag and Drop Area */}
            <div 
              className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={styles.dropZoneContent}>
                <p className={styles.dropZoneText}>
                  <strong>Arrastra imágenes aquí</strong> o haz clic para seleccionar
                </p>
                <p className={styles.dropZoneHint}>
                  Máximo {MAX_IMAGES} imágenes • JPG, PNG, WEBP (máx. 5MB c/u)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {/* Vista Previa de Imágenes */}
            {images.length > 0 && (
              <div className={styles.imagePreviewContainer}>
                <div className={styles.imageGrid}>
                  {images.map((image, index) => (
                    <div 
                      key={image.id} 
                      className={`${styles.imagePreview} ${formData.image === image.url ? styles.mainImage : ''}`}
                    >
                      <ProductImage src={image.url} alt={`Preview ${index + 1}`} />
                      {formData.image === image.url && (
                        <div className={styles.mainImageBadge}>
                          Principal
                        </div>
                      )}
                      <div className={styles.imageActions}>
                        {formData.image !== image.url && (
                          <button
                            type="button"
                            onClick={() => setAsMainImage(image.id)}
                            className={styles.setMainButton}
                            aria-label="Usar como imagen principal"
                          >
                            Principal
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className={styles.removeImageButton}
                          aria-label="Quitar esta imagen"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={styles.imageCount}>
                  {images.length} de {MAX_IMAGES} imágenes
                  {images.length >= MAX_IMAGES && ' (máximo alcanzado)'}
                </p>
              </div>
            )}
          </div>

          {/* Precio y Stock / Precio y Disponibilidad */}
          <div className={styles.section}>
            <h3>{publicationType === 'producto' ? 'Precio y Disponibilidad' : 'Precio y Modalidad'}</h3>
            
            {publicationType === 'producto' ? (
              /* Campos para Producto */
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="price">Precio (ARS) *</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="stock">Stock *</label>
                  <input
                    type="number"
                    id="stock"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    min="0"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="unit">Unidad</label>
                  <select
                    id="unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                  >
                    {formOptions.unit.length > 0
                      ? formOptions.unit.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))
                      : UNITS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))
                    }
                  </select>
                </div>
              </div>
            ) : (
              /* Campos para Servicio */
              <>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="pricingType">Tipo de Cobro *</label>
                    <select
                      id="pricingType"
                      value={serviceData.pricingType}
                      onChange={(e) => setServiceData({...serviceData, pricingType: e.target.value})}
                      required
                    >
                      {formOptions.pricing_type.length > 0
                        ? formOptions.pricing_type.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))
                        : SERVICE_PRICING_TYPES.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))
                      }
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="price">
                      {serviceData.pricingType === 'a_convenir' ? 'Precio Referencial (ARS)' : 'Precio (ARS) *'}
                    </label>
                    <input
                      type="number"
                      id="price"
                      name="price"
                      value={formData.price || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      required={serviceData.pricingType !== 'a_convenir'}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="availability">Disponibilidad *</label>
                    <select
                      id="availability"
                      value={serviceData.availability}
                      onChange={(e) => setServiceData({...serviceData, availability: e.target.value})}
                      required
                    >
                      {formOptions.availability.length > 0
                        ? formOptions.availability.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))
                        : AVAILABILITY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))
                      }
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="responseTime">Tiempo de Respuesta</label>
                    <select
                      id="responseTime"
                      value={serviceData.responseTime}
                      onChange={(e) => setServiceData({...serviceData, responseTime: e.target.value})}
                    >
                      {formOptions.response_time.length > 0
                        ? formOptions.response_time.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))
                        : (
                            <>
                              <option value="inmediato">Inmediato</option>
                              <option value="24hs">Dentro de 24hs</option>
                              <option value="48hs">Dentro de 48hs</option>
                              <option value="1_semana">Dentro de 1 semana</option>
                            </>
                          )
                      }
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="experienceYears">Años de Experiencia</label>
                    <input
                      type="number"
                      id="experienceYears"
                      value={serviceData.experienceYears}
                      onChange={(e) => setServiceData({...serviceData, experienceYears: e.target.value})}
                      min="0"
                      placeholder="Ej: 5"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Equipamiento</label>
                    <div className={styles.checkboxGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={serviceData.hasEquipment}
                          onChange={(e) => setServiceData({...serviceData, hasEquipment: e.target.checked})}
                        />
                        Cuento con equipamiento propio
                      </label>
                    </div>
                  </div>
                </div>

                {/* Zonas de Cobertura */}
                <div className={styles.formGroup}>
                  <label>Zonas de Cobertura</label>
                  <div className={styles.featureInput}>
                    <input
                      type="text"
                      id="newZone"
                      placeholder="Ej: Sur de Santa Fe, Norte de Buenos Aires"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            addCoverageZone(input.value.trim());
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.addFeatureButton}
                      onClick={() => {
                        const input = document.getElementById('newZone') as HTMLInputElement;
                        if (input.value.trim()) {
                          addCoverageZone(input.value.trim());
                          input.value = '';
                        }
                      }}
                    >
                      + Agregar
                    </button>
                  </div>
                  {serviceData.coverageZones.length > 0 && (
                    <div className={styles.featuresList}>
                      {serviceData.coverageZones.map((zone, index) => (
                        <div key={index} className={styles.featureTag}>
                          {zone}
                          <button
                            type="button"
                            onClick={() => removeCoverageZone(zone)}
                            className={styles.removeFeature}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Ubicación */}
          <div className={styles.section}>
            <h3>Ubicación</h3>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="province">Provincia *</label>
                <select
                  id="province"
                  value={selectedProvinceId}
                  onChange={handleProvinceChange}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {provinces.map(province => (
                    <option key={province.id} value={province.id}>{province.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="locality">Localidad *</label>
                <select
                  id="locality"
                  value={formData.localityId}
                  onChange={handleLocalityChange}
                  disabled={!selectedProvinceId || localitiesLoading}
                  required
                >
                  <option value="">
                    {localitiesLoading ? 'Cargando localidades...' : 'Seleccionar...'}
                  </option>
                  {localities.map(locality => (
                    <option key={locality.id} value={locality.id}>{locality.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Características */}
          <div className={styles.section}>
            <h3>{publicationType === 'producto' ? 'Características del Producto' : 'Características del Servicio'}</h3>
            
            <div className={styles.featureInput}>
              <input
                type="text"
                placeholder="Característica (Ej: Marca)"
                value={featureKey}
                onChange={(e) => setFeatureKey(e.target.value)}
              />
              <input
                type="text"
                placeholder="Valor (Ej: Dekalb)"
                value={featureValue}
                onChange={(e) => setFeatureValue(e.target.value)}
              />
              <button type="button" onClick={addFeature} className={styles.addButton}>
                + Agregar
              </button>
            </div>

            {Object.entries(formData.features).length > 0 && (
              <div className={styles.featureList}>
                {Object.entries(formData.features).map(([key, value]) => (
                  <div key={key} className={styles.featureItem}>
                    <strong>{key}:</strong> {value}
                    <button
                      type="button"
                      onClick={() => removeFeature(key)}
                      className={styles.removeButton}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Etiquetas */}
          <div className={styles.section}>
            <h3>Etiquetas</h3>
            
            <div className={styles.tagInput}>
              <input
                type="text"
                placeholder="Agregar etiqueta (Ej: promoción, nuevo)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button type="button" onClick={addTag} className={styles.addButton}>
                + Agregar
              </button>
            </div>

            {formData.tags.length > 0 && (
              <div className={styles.tagList}>
                {formData.tags.map(tag => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className={styles.tagRemove}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={pedirCierre} className={styles.cancelButton} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Publicando…' : publicationType === 'producto' ? 'Publicar producto' : 'Publicar servicio'}
            </button>
          </div>
        </form>
      </div>
      {salida.pregunta}
    </div>
  );
};
