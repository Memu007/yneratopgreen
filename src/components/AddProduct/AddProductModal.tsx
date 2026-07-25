import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast/Toast';
import { NewProductData } from '../../types';
import { apiPost, apiGet, API_BASE_URL, tokenStorage } from '../../utils/api';
import styles from './AddProductModal.module.css';

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
}

interface CategoryFromBackend {
  id: string;
  name: string;
  is_service: boolean;
  subcategories: Subcategory[];
}

// Interfaces para opciones de formulario
interface FormOptionItem {
  value: string;
  label: string;
}

interface FormOptionsData {
  unit: FormOptionItem[];
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
  province_id: string;
  province_name: string;
  latitude: number;
  longitude: number;
}

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
    pricing_type: [],
    availability: [],
    response_time: []
  });
  
  // Tipo de publicación: producto o servicio
  const [publicationType, setPublicationType] = useState<'producto' | 'servicio'>('producto');
  
  const [formData, setFormData] = useState<NewProductData>({
    name: '',
    category: '',
    subcategory: '',
    localityId: '',
    price: 0,
    description: '',
    image: '',
    location: {
      province: '',
      city: '',
    },
    stock: 0,
    unit: 'kg',
    features: {},
    tags: [],
  });

  // Datos específicos de servicios
  const [serviceData, setServiceData] = useState({
    pricingType: 'por_hora',
    availability: 'inmediata',
    coverageZones: [] as string[],
    experienceYears: '',
    hasEquipment: true,
    responseTime: '24hs',
  });
  const [zoneInput, setZoneInput] = useState('');

  const [featureKey, setFeatureKey] = useState('');
  const [featureValue, setFeatureValue] = useState('');
  const [tagInput, setTagInput] = useState('');

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
      showToast('Debes iniciar sesión para publicar productos', 'warning');
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
    subcategories: cat.subcategories?.map((s: Subcategory) => s.name) || []
  }));
  
  // Obtener subcategorías de la categoría seleccionada
  const selectedCategory = currentCategories.find(cat => cat.value === formData.category);

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
    setPublicationType(type);
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
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
      showToast(`Solo puedes agregar ${availableSlots} imagen(es) más`, 'warning');
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
      if (!formData.name || !formData.category || !formData.price || formData.stock === undefined) {
        showToast('Por favor completa todos los campos obligatorios', 'warning');
        return;
      }
    } else {
      if (!formData.name || !formData.category) {
        showToast('Por favor completa el nombre y la categoría', 'warning');
        return;
      }
      // Para servicios "a convenir", el precio es opcional
      if (serviceData.pricingType !== 'a_convenir' && !formData.price) {
        showToast('Por favor indica el precio del servicio', 'warning');
        return;
      }
    }

    if (!formData.description || formData.description.length < 10) {
      showToast('La descripción es obligatoria y debe tener al menos 10 caracteres', 'warning');
      return;
    }

    if (!formData.localityId) {
      showToast('Seleccioná una provincia y una localidad', 'warning');
      return;
    }

    if (images.length === 0) {
      showToast(`Por favor agrega al menos una imagen del ${publicationType}`, 'warning');
      return;
    }

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
          const imageFormData = new FormData();
          imageFormData.append('files', image.file);
          imageFormData.append('is_primary', (i === 0).toString());

          // Construir la URL correcta usando API_BASE_URL y agregar token de autorización
          const token = tokenStorage.getAccessToken();
          const headers: HeadersInit = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          try {
            const imageResponse = await fetch(`${API_BASE_URL}/products/${productId}/images`, {
              method: 'POST',
              body: imageFormData,
              credentials: 'include',
              headers,
            });

            if (!imageResponse.ok) {
              let reason = `HTTP ${imageResponse.status}`;
              const responseBody = await imageResponse.text();

              if (responseBody) {
                try {
                  const parsedBody = JSON.parse(responseBody) as { detail?: unknown };
                  if (typeof parsedBody.detail === 'string') {
                    reason = parsedBody.detail;
                  }
                } catch {
                  reason = responseBody;
                }
              }

              imageUploadErrors.push(`${image.file.name}: ${reason}`);
            }
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'error de red';
            imageUploadErrors.push(`${image.file.name}: ${reason}`);
          }
        }
      }

      const tipoMsg = publicationType === 'producto' ? 'Producto' : 'Servicio';
      if (imageUploadErrors.length > 0) {
        showToast(
          `${tipoMsg} "${formData.name}" publicado, pero no se pudo subir ${imageUploadErrors.length === 1 ? 'la imagen' : `${imageUploadErrors.length} imágenes`}: ${imageUploadErrors.join('; ')}`,
          'warning',
        );
      } else {
        showToast(`${tipoMsg} "${formData.name}" publicado exitosamente!`, 'success');
      }
      
      // Llamar al onSubmit del padre para recargar productos
      onSubmit(formData);
      
      // Cerrar el modal
      onClose();
      
      // Resetear formulario
      setFormData({
        name: '',
        category: '',
        subcategory: '',
        localityId: '',
        price: 0,
        description: '',
        image: '',
        location: {
          province: '',
          city: '',
        },
        stock: 0,
        unit: 'kg',
        features: {},
        tags: [],
      });
      setSelectedProvinceId('');
      setLocalities([]);
      setImages([]);
      setServiceData({
        pricingType: 'por_hora',
        availability: 'inmediata',
        coverageZones: [],
        experienceYears: '',
        hasEquipment: true,
        responseTime: '24hs',
      });

    } catch (error) {
      console.error('Error al crear producto:', error);
      const tipoMsg = publicationType === 'producto' ? 'producto' : 'servicio';
      showToast(`Error al publicar el ${tipoMsg}. Por favor intenta de nuevo.`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{publicationType === 'producto' ? '🌾 Agregar Nuevo Producto' : '🔧 Ofrecer Nuevo Servicio'}</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
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
                📦 Producto
              </button>
              <button
                type="button"
                className={`${styles.typeButton} ${publicationType === 'servicio' ? styles.typeButtonActive : ''}`}
                onClick={() => handleTypeChange('servicio')}
              >
                🔧 Servicio
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
            <h3>{publicationType === 'producto' ? 'Imágenes del Producto *' : 'Imágenes del Servicio *'}</h3>
            <p className={styles.sectionDescription}>
              {publicationType === 'producto' 
                ? 'Agrega fotos de alta calidad de tu producto. La primera imagen será la imagen principal.'
                : 'Agrega fotos de tu equipo, trabajos realizados o certificaciones. La primera imagen será la imagen principal.'
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
                <div className={styles.uploadIcon}>📸</div>
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
                      <img src={image.url} alt={`Preview ${index + 1}`} />
                      {formData.image === image.url && (
                        <div className={styles.mainImageBadge}>
                          ⭐ Principal
                        </div>
                      )}
                      <div className={styles.imageActions}>
                        {formData.image !== image.url && (
                          <button
                            type="button"
                            onClick={() => setAsMainImage(image.id)}
                            className={styles.setMainButton}
                            title="Establecer como imagen principal"
                          >
                            ⭐
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className={styles.removeImageButton}
                          title="Eliminar imagen"
                        >
                          🗑️
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
                          📍 {zone}
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
                    <option key={locality.id} value={locality.id}>{locality.name}</option>
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
            <button type="button" onClick={onClose} className={styles.cancelButton} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? '⏳ Publicando...' : publicationType === 'producto' ? '📦 Publicar Producto' : '🔧 Publicar Servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
