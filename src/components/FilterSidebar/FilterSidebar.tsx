import React, { useMemo, useRef, useState } from 'react';
import styles from './FilterSidebar.module.css';
import type {
  CategoryResponse,
  LocalityResponse,
  MarcaDelMercado,
  ProvinceResponse,
  RangoDePotencia,
} from '../../utils/catalogService';
import {
  ANIO_MINIMO,
  anioMaximo,
  opcionDeLocalidad,
  ORIGENES,
  RANGOS_DE_POTENCIA,
  ROTULO_DEL_ORIGEN,
  type OrigenDeclarado,
} from '../../utils/catalogService';
import { CONDICIONES, type CondicionDelMercado } from '../../hooks/useProductFilters';

interface FilterSidebarProps {
  categories: CategoryResponse[];
  provinces: ProvinceResponse[];
  localities: LocalityResponse[];
  isLoadingLocalities: boolean;
  selectedType: 'todos' | 'productos' | 'servicios';
  selectedCategory: string;
  selectedSubcategory: string;
  selectedProvinceId: string;
  selectedLocalityId: string;
  priceMin: number;
  priceMax: number;
  inStockOnly: boolean;
  minRating: number;
  condicion: CondicionDelMercado;
  /** La marca elegida, por `value`. Vacío es «todas». */
  marca: string;
  /** Las marcas que el conjunto filtrado tiene HOY, con sus conteos. Las
      cuenta el servidor sobre el conjunto entero. Vacío quiere decir que
      acá no hay nada que elegir, y entonces el control no se dibuja: un
      selector con una sola opción que no filtra nada es ruido. */
  marcasDisponibles: MarcaDelMercado[];
  /** El tipo del subrubro elegido, por slug. Vacío es «todos». */
  tipo: string;
  /** El rango de potencia de Tractores. Vacío es «cualquiera». */
  potencia: RangoDePotencia | '';
  /** El año de la máquina, desde y hasta. `null` es «sin límite». */
  anioDesde: number | null;
  anioHasta: number | null;
  /** El origen declarado por quien vende. Vacío es «cualquiera». */
  origen: OrigenDeclarado | '';
  onTypeChange: (type: 'todos' | 'productos' | 'servicios') => void;
  onCategoryChange: (category: string) => void;
  onSubcategoryChange: (subcategory: string) => void;
  onProvinceChange: (provinceId: string) => void;
  onLocalityChange: (localityId: string) => void;
  onPriceMinChange: (price: number) => void;
  onPriceMaxChange: (price: number) => void;
  onInStockChange: (inStock: boolean) => void;
  onMinRatingChange: (rating: number) => void;
  onCondicionChange: (condicion: CondicionDelMercado) => void;
  onMarcaChange: (marca: string) => void;
  onTipoChange: (tipo: string) => void;
  onPotenciaChange: (potencia: RangoDePotencia | '') => void;
  onAnioDesdeChange: (anio: number | null) => void;
  onAnioHastaChange: (anio: number | null) => void;
  onOrigenChange: (origen: OrigenDeclarado | '') => void;
  onResetFilters: () => void;
  /** Cuántas operaciones quedan con los filtros puestos. En celular el
      panel termina con «Ver N resultados»: sin el número, cerrar el panel
      es un salto a ciegas. */
  cantidadDeResultados: number;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  categories,
  provinces,
  localities,
  isLoadingLocalities,
  selectedType,
  selectedCategory,
  selectedSubcategory,
  selectedProvinceId,
  selectedLocalityId,
  priceMin,
  priceMax,
  inStockOnly,
  minRating,
  condicion,
  marca,
  marcasDisponibles,
  tipo,
  potencia,
  anioDesde,
  anioHasta,
  origen,
  onTypeChange,
  onCategoryChange,
  onSubcategoryChange,
  onProvinceChange,
  onLocalityChange,
  onPriceMinChange,
  onPriceMaxChange,
  onInStockChange,
  onMinRatingChange,
  onCondicionChange,
  onMarcaChange,
  onTipoChange,
  onPotenciaChange,
  onAnioDesdeChange,
  onAnioHastaChange,
  onOrigenChange,
  onResetFilters,
  cantidadDeResultados,
}) => {
  const [abierto, setAbierto] = useState(false);
  const resumen = useRef<HTMLButtonElement>(null);
  // Filtrar categorías según el tipo seleccionado
  const filteredCategories = useMemo(() => {
    if (selectedType === 'todos') return categories;
    if (selectedType === 'productos') return categories.filter(c => !c.is_service);
    return categories.filter(c => c.is_service);
  }, [categories, selectedType]);

  // Obtener subcategorías de la categoría seleccionada
  const currentSubcategories = useMemo(() => {
    if (selectedCategory === 'Todas las categorías') return [];
    const category = categories.find(c => c.name === selectedCategory);
    return category?.subcategories?.filter(s => s.is_active) || [];
  }, [categories, selectedCategory]);

  // El subrubro elegido, del que cuelgan el tipo y la potencia.
  const subrubroElegido = useMemo(
    () => currentSubcategories.find((subcategory) => subcategory.name === selectedSubcategory),
    [currentSubcategories, selectedSubcategory],
  );
  const tiposDelSubrubro = subrubroElegido?.tipos ?? [];

  // Lo que describe una MÁQUINA o un PRODUCTO no aplica a un servicio: un
  // asesoramiento no es nuevo ni usado, no tiene año ni concesionaria. Esos
  // controles no se dibujan para servicios, salvo que ya tengan algo puesto:
  // un filtro aplicado nunca queda invisible.
  const categoriaElegida = categories.find((category) => category.name === selectedCategory);
  const esDeServicios = selectedType === 'servicios' || Boolean(categoriaElegida?.is_service);
  const usaAnio = Boolean(categoriaElegida?.usa_marca) && !esDeServicios;
  const verAnio = usaAnio || anioDesde !== null || anioHasta !== null;
  const verCondicion = !esDeServicios || condicion !== '';
  const verOrigen = !esDeServicios || origen !== '';

  // Pasar a servicios suelta lo que sólo aplica a productos.
  const soltarLoDeProductos = () => {
    if (condicion) onCondicionChange('');
    if (origen) onOrigenChange('');
  };

  // «Más filtros»: lo que se usa poco va plegado. Si tiene algo puesto, el
  // botón dice cuántos, y arranca abierto: un filtro aplicado no puede quedar
  // escondido.
  const activosEnMas = (inStockOnly ? 1 : 0) + (minRating > 0 ? 1 : 0);
  const [masAbierto, setMasAbierto] = useState(activosEnMas > 0);

  const anioDelCampo = (texto: string): number | null =>
    (/^\d{1,4}$/.test(texto) ? Number(texto) : null);

  return (
    <aside className={styles.panel}>
      <div className={styles.plegable}>
        <button
          ref={resumen}
          type="button"
          className={styles.resumen}
          aria-expanded={abierto}
          aria-controls="panel-de-filtros"
          onClick={() => setAbierto((previo) => !previo)}
        >
          Filtros
          <span className={styles.contador} aria-hidden="true">
            {abierto ? 'Cerrar' : 'Abrir'}
          </span>
        </button>

        <div id="panel-de-filtros" className={`${styles.cuerpo} ${abierto ? styles.abierto : ''}`}>
          <div className={styles.encabezado}>
            <h2 className={styles.titulo}>Filtrar</h2>
          </div>

          {/* El orden del panel (PM, 26/09): primero lo que describe lo que
              se busca, y cada filtro que depende de otro justo debajo de él;
              después dónde, después el precio, y al final, plegado, lo que se
              usa poco. Cada grupo es un `fieldset`: el lector de pantalla
              anuncia en qué grupo está cada control. */}
          <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>Qué buscás</legend>

          {/* Productos o servicios. Se llamaba «Tipo», igual que el tercer
              nivel del subrubro, y los dos quedaban en el mismo panel. */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-type">Productos o servicios</label>
            <select
              id="catalog-type"
              className={styles.select}
              value={selectedType}
              onChange={(e) => {
                const elegido = e.target.value as 'todos' | 'productos' | 'servicios';
                onTypeChange(elegido);
                onCategoryChange('Todas las categorías');
                onSubcategoryChange('Todas');
                if (elegido === 'servicios') soltarLoDeProductos();
              }}
            >
              <option value="todos">Todos</option>
              <option value="productos">Productos</option>
              <option value="servicios">Servicios</option>
            </select>
          </div>

          {/* Categoría */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-category">Categoría</label>
            <select
              id="catalog-category"
              className={styles.select}
              value={selectedCategory}
              onChange={(e) => {
                onCategoryChange(e.target.value);
                onSubcategoryChange('Todas');
                if (categories.find((c) => c.name === e.target.value)?.is_service) soltarLoDeProductos();
              }}
            >
              <option value="Todas las categorías">Todas las categorías</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategoría */}
          {currentSubcategories.length > 0 && (
            <div className={styles.filterSection}>
              <label className={styles.filterLabel} htmlFor="catalog-subcategory">Subcategoría</label>
              <select
                id="catalog-subcategory"
                className={styles.select}
                value={selectedSubcategory}
                onChange={(e) => onSubcategoryChange(e.target.value)}
              >
                <option value="Todas">Todas</option>
                {currentSubcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.name}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tipo: el tercer nivel. Aparece con un subrubro elegido que tiene
              lista, y ofrece sólo esa lista. Acota y no completa: las
              publicaciones que no declararon tipo no entran. */}
          {tiposDelSubrubro.length > 0 && (
            <div className={styles.filterSection}>
              <label className={styles.filterLabel} htmlFor="catalog-subtype">Tipo</label>
              <select
                id="catalog-subtype"
                className={styles.select}
                value={tipo}
                onChange={(e) => onTipoChange(e.target.value)}
              >
                <option value="">Todos</option>
                {tiposDelSubrubro.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Potencia: el tercer nivel de Tractores son rangos. Quien vende
              cargó los HP; el rango lo calcula el servidor. */}
          {subrubroElegido?.usa_potencia && (
            <div className={styles.filterSection}>
              <label className={styles.filterLabel} htmlFor="catalog-power">Potencia</label>
              <select
                id="catalog-power"
                className={styles.select}
                value={potencia}
                onChange={(e) => onPotenciaChange(e.target.value as RangoDePotencia | '')}
              >
                <option value="">Cualquiera</option>
                {RANGOS_DE_POTENCIA.map(({ valor, rotulo }) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </div>
          )}

          {/* Marca.

              La lista la trae la respuesta junto con el listado, y cada
              opción dice cuántas publicaciones tiene con los demás filtros
              puestos.

              Con una categoría que usa marca elegida llegan TODAS las marcas
              activas, también las que están en cero (decisión de Emi, 25/09):
              se revisa más fácil y se ve igual desde el primer día. Elegir
              una en cero da el vacío de siempre.

              Sin esa categoría llegan sólo las marcas que el conjunto tiene, y
              si no tiene ninguna el control no se dibuja. */}
          {marcasDisponibles.length > 0 && (
            <div className={styles.filterSection}>
              <label className={styles.filterLabel} htmlFor="catalog-brand">
                Marca
              </label>
              <select
                id="catalog-brand"
                className={styles.select}
                value={marca}
                onChange={(e) => onMarcaChange(e.target.value)}
              >
                <option value="">Todas las marcas</option>
                {marcasDisponibles.map(({ value, label, count }) => (
                  <option key={value} value={value}>{`${label} (${count})`}</option>
                ))}
              </select>
            </div>
          )}

          {/* Año de la máquina: un rango, y cualquiera de los dos extremos
              puede ir solo. Aparece donde la categoría pide marca, que es
              donde quien vende lo declara. */}
          {verAnio && (
            <div className={styles.filterSection} role="group" aria-labelledby="catalog-year">
              <span className={styles.filterLabel} id="catalog-year">Año</span>
              <div className={styles.priceInputs}>
                <input
                  id="catalog-year-from"
                  type="number"
                  inputMode="numeric"
                  aria-label="Año desde"
                  className={styles.priceInput}
                  placeholder="Desde"
                  min={ANIO_MINIMO}
                  max={anioMaximo()}
                  value={anioDesde ?? ''}
                  onChange={(e) => onAnioDesdeChange(anioDelCampo(e.target.value))}
                />
                <input
                  id="catalog-year-to"
                  type="number"
                  inputMode="numeric"
                  aria-label="Año hasta"
                  className={styles.priceInput}
                  placeholder="Hasta"
                  min={ANIO_MINIMO}
                  max={anioMaximo()}
                  value={anioHasta ?? ''}
                  onChange={(e) => onAnioHastaChange(anioDelCampo(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Condición del activo.
              Sólo la tienen los activos —una semilla no es «usada»— y ahí es
              opcional a propósito, así que el filtro ACOTA y nunca completa:
              «Nuevo» trae los declarados nuevos, no los nuevos más los que no
              lo dicen. Las opciones salen de la misma tabla que valida la API,
              para que no haya una lista acá y otra allá. */}
          {verCondicion && (
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-condition">
              Condición
            </label>
            <select
              id="catalog-condition"
              className={styles.select}
              value={condicion}
              onChange={(e) => onCondicionChange(e.target.value as CondicionDelMercado)}
            >
              {CONDICIONES.map(({ valor, rotulo }) => (
                <option key={valor || 'cualquiera'} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
          )}

          {/* Origen: lo que DECLARA quien vende, y el rótulo lo dice. No es
              algo que la plataforma haya comprobado, así que no se parece al
              distintivo de documentación revisada. */}
          {verOrigen && (
            <div className={styles.filterSection}>
              <label className={styles.filterLabel} htmlFor="catalog-origin">
                Origen <span className={styles.aclaracion}>· {ROTULO_DEL_ORIGEN}</span>
              </label>
              <select
                id="catalog-origin"
                className={styles.select}
                value={origen}
                onChange={(e) => onOrigenChange(e.target.value as OrigenDeclarado | '')}
              >
                <option value="">Cualquiera</option>
                {ORIGENES.map(({ valor, rotulo }) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </div>
          )}
          </fieldset>

          <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>Dónde</legend>

          {/* Ubicación oficial de la publicación */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-province">Provincia</label>
            <select
              id="catalog-province"
              className={styles.select}
              value={selectedProvinceId}
              onChange={(e) => onProvinceChange(e.target.value)}
            >
              <option value="">Todas las provincias</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-locality">Localidad</label>
            <select
              id="catalog-locality"
              className={styles.select}
              value={opcionDeLocalidad(localities, selectedLocalityId)}
              onChange={(e) => onLocalityChange(e.target.value)}
              disabled={!selectedProvinceId || isLoadingLocalities}
            >
              <option value="">
                {isLoadingLocalities ? 'Cargando localidades...' : 'Todas las localidades'}
              </option>
              {localities.map((locality) => (
                <option key={locality.id} value={locality.id}>
                  {locality.label}
                </option>
              ))}
            </select>
          </div>

          </fieldset>

          {/* Precio. El título del grupo lo nombra; cada campo dice cuál es. */}
          <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>Precio</legend>
          <div className={styles.filterSection}>
            <div className={styles.priceInputs}>
              <input
                id="catalog-price-min"
                type="number"
                aria-label="Precio mínimo"
                className={styles.priceInput}
                placeholder="Mínimo"
                value={priceMin || ''}
                onChange={(e) => onPriceMinChange(Number(e.target.value) || 0)}
              />
              <input
                id="catalog-price-max"
                type="number"
                aria-label="Precio máximo"
                className={styles.priceInput}
                placeholder="Máximo"
                value={priceMax === Number.MAX_SAFE_INTEGER ? '' : priceMax}
                onChange={(e) => onPriceMaxChange(Number(e.target.value) || Number.MAX_SAFE_INTEGER)}
              />
            </div>
          </div>

          </fieldset>

          {/* Más filtros: lo que se usa poco, plegado de entrada. Plegado con
              `hidden`, así que sus controles salen del recorrido de Tab y del
              árbol de accesibilidad. Si tiene algo puesto, el botón lo dice y
              arranca abierto: un filtro aplicado no queda escondido. */}
          <div className={styles.mas}>
            <button
              type="button"
              className={styles.masBoton}
              aria-expanded={masAbierto}
              aria-controls="mas-filtros"
              onClick={() => setMasAbierto((previo) => !previo)}
            >
              <span aria-hidden="true" className={styles.masMarca}>{masAbierto ? '▾' : '▸'}</span>
              Más filtros
              {activosEnMas > 0 && (
                <span className={styles.masActivos}>
                  {activosEnMas === 1 ? '(1 activo)' : `(${activosEnMas} activos)`}
                </span>
              )}
            </button>
            <div id="mas-filtros" className={styles.masCuerpo} hidden={!masAbierto}>
          {/* Disponibilidad */}
          <div className={styles.filterSection}>
            <span className={styles.filterLabel} id="catalog-availability">Disponibilidad</span>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={inStockOnly}
                  onChange={(e) => onInStockChange(e.target.checked)}
                />
                Solo con stock disponible
              </label>
            </div>
          </div>

          {/* Calificación del vendedor.
              Eran cinco `span` con `onClick`: no se llegaban con el teclado, no
              tenían nombre y había que saber que una estrella llena significaba
              «esta cantidad o más». Ahora es el mismo control que los otros
              filtros y dice lo que hace. */}
          <div className={styles.filterSection}>
            <label className={styles.filterLabel} htmlFor="catalog-rating">
              Calificación mínima del vendedor
            </label>
            <select
              id="catalog-rating"
              className={styles.select}
              value={minRating}
              onChange={(e) => onMinRatingChange(Number(e.target.value))}
            >
              <option value={0}>Cualquiera</option>
              {[1, 2, 3, 4, 5].map((estrellas) => (
                <option key={estrellas} value={estrellas}>
                  {estrellas} de 5 o más
                </option>
              ))}
            </select>
          </div>
            </div>
          </div>

          <button className={styles.limpiar} onClick={onResetFilters}>
            Limpiar filtros
          </button>

          {/* En celular el panel es parte del flujo y termina devolviendo
              a los resultados con el número puesto. En escritorio esta fila
              no se dibuja: el panel nunca está tapando nada.

              Al plegarse, el panel deja de verse y este botón con él. El
              foco pasa a «Filtros», que queda justo encima de los
              resultados; si no, se quedaría en un control que ya no está.

              Y se lo trae a la vista. Si Tab acaba de traer este botón con
              desplazamiento suave y se lo activa antes de que termine, ese
              desplazamiento seguiría después de plegar y se llevaría
              «Filtros» fuera de la pantalla: primero se lo corta donde está.
              `scrollIntoView` no lo corta si ya no tiene que moverse, un
              `scrollTo` sí. Después se centra «Filtros», y no arriba, porque
              entre 600 y 1023 px la cabecera queda pegada arriba y lo
              taparía; como «Filtros» está cerca del principio de la página,
              centrarlo es en la práctica volver arriba de todo. */}
          <button className={`tg-button tg-button--primary ${styles.verResultados}`}
                  onClick={() => {
                    setAbierto(false);
                    window.scrollTo({ top: window.scrollY, behavior: 'instant' });
                    resumen.current?.focus({ preventScroll: true });
                    resumen.current?.scrollIntoView({ block: 'center' });
                  }}>
            {cantidadDeResultados === 1 ? 'Ver 1 resultado' : `Ver ${cantidadDeResultados} resultados`}
          </button>
        </div>
      </div>
    </aside>
  );
};
