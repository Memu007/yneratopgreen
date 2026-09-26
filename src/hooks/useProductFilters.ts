import { useCallback, useEffect, useMemo, useState } from 'react';
import { seccionDeLaBarra } from '../navegacion/politica';
import {
  ORIGENES,
  RANGOS_DE_POTENCIA,
  type OrigenDeclarado,
  type RangoDePotencia,
} from '../utils/catalogService';

/**
 * Los cuatro órdenes que el Mercado ofrece, y cómo se traduce cada uno a la
 * consulta del catálogo.
 *
 * Ordenar es del servidor, no de la grilla. Antes la grilla reordenaba el
 * arreglo que tenía en la mano —la página descargada—, así que «Menor precio»
 * devolvía la más barata DE ESA PÁGINA y no del conjunto. Con paginación esa
 * diferencia deja de ser teórica.
 *
 * «Más relevantes» se retiró: no existe un ranking que sostenga esa promesa, y
 * un orden que no ordena nada es un control que miente.
 */
export type OrdenDelMercado = 'newest' | 'price-asc' | 'price-desc' | 'rating';

export const ORDENES: {
  valor: OrdenDelMercado;
  rotulo: string;
  sortBy: 'created_at' | 'price' | 'rating';
  sortOrder: 'asc' | 'desc';
}[] = [
  { valor: 'newest', rotulo: 'Más recientes', sortBy: 'created_at', sortOrder: 'desc' },
  { valor: 'price-asc', rotulo: 'Menor precio', sortBy: 'price', sortOrder: 'asc' },
  { valor: 'price-desc', rotulo: 'Mayor precio', sortBy: 'price', sortOrder: 'desc' },
  { valor: 'rating', rotulo: 'Mejor calificados', sortBy: 'rating', sortOrder: 'desc' },
];

/**
 * Nuevo o usado, y nada más.
 *
 * Los valores son los que declara `anatomia.py` y los que acepta la API: no
 * hay una lista acá y otra allá que puedan quedar distintas. La cadena vacía
 * es «cualquiera» y no viaja a la consulta.
 *
 * El filtro ACOTA y nunca completa. La condición sólo la tienen los activos y
 * ahí es opcional a propósito —en «Bienes y Ganado» y «Tierras y parcelas» un
 * ternero o un campo no son ni nuevos ni usados—, así que pedir «Nuevo»
 * devuelve los declarados nuevos. Sumarle los que no lo dicen sería afirmar un
 * dato que nadie cargó.
 */
export type CondicionDelMercado = '' | 'nuevo' | 'usado';

export const CONDICIONES: { valor: CondicionDelMercado; rotulo: string }[] = [
  { valor: '', rotulo: 'Cualquiera' },
  { valor: 'nuevo', rotulo: 'Nuevo' },
  { valor: 'usado', rotulo: 'Usado' },
];

const condicionDeLaBarra = (valor: string | null): CondicionDelMercado =>
  (CONDICIONES.some((opcion) => opcion.valor === valor) ? valor : '') as CondicionDelMercado;

/** Un rango de potencia de la barra, o ninguno si no es uno de los tres. */
const potenciaDeLaBarra = (valor: string | null): RangoDePotencia | '' =>
  (RANGOS_DE_POTENCIA.some((rango) => rango.valor === valor) ? valor as RangoDePotencia : '');

/** Un año de la barra: un entero de hasta cuatro cifras, o ninguno. */
const anioDeLaBarra = (valor: string | null): number | null =>
  (valor !== null && /^\d{1,4}$/.test(valor) ? Number(valor) : null);

/** Un origen de la barra, o ninguno si no es uno de los dos. */
const origenDeLaBarra = (valor: string | null): OrigenDeclarado | '' =>
  (ORIGENES.some((origen) => origen.valor === valor) ? valor as OrigenDeclarado : '');

/** Cuántas tarjetas trae una página. La decide el Mercado y viaja a la
 *  consulta: la grilla dibuja lo que le dan. */
export const POR_PAGINA = 24;

interface UseProductFiltersProps {
  /** Sólo el Mercado escribe sus filtros en la barra: en las otras cuatro
      secciones estos parámetros no significan nada. */
  escribeEnLaBarra: boolean;
  /** Cuántas veces movió la barra el historial. Cuando cambia hay que releer
      los filtros de la URL: volver a una entrada tiene que devolver también
      sus controles, no sólo su dirección. */
  versionDeLaBarra: number;
}

const numeroDeLaBarra = (parametros: URLSearchParams, clave: string, porOmision: number) => {
  const crudo = parametros.get(clave);
  if (crudo === null || crudo === '') return porOmision;
  const valor = Number(crudo);
  return Number.isFinite(valor) && valor >= 0 ? valor : porOmision;
};

const tipoDeLaBarra = (valor: string | null): 'todos' | 'productos' | 'servicios' =>
  (valor === 'productos' || valor === 'servicios' ? valor : 'todos');

const ordenDeLaBarra = (valor: string | null): OrdenDelMercado =>
  (ORDENES.some((opcion) => opcion.valor === valor) ? (valor as OrdenDelMercado) : 'newest');

/** Una página es un entero de 1 para arriba. Cualquier otra cosa en la barra
 *  —«0», «abc», «-3»— es la página 1, que es la que siempre existe. */
const paginaDeLaBarra = (parametros: URLSearchParams): number => {
  const crudo = Number(parametros.get('page'));
  if (!Number.isFinite(crudo)) return 1;
  return Math.max(1, Math.trunc(crudo));
};

export const useProductFilters = ({
  escribeEnLaBarra,
  versionDeLaBarra,
}: UseProductFiltersProps) => {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialNumber = (key: string, fallback: number) =>
    numeroDeLaBarra(initialParams, key, fallback);

  /**
   * Lo aplicado y lo tecleado son dos cosas.
   *
   * `searchQuery` es la consulta que está aplicada: la que viaja al catálogo,
   * la que filtra acá y la que se escribe en `q`. `textoBuscado` es lo que hay
   * en el campo. Sólo la acción del buscador —el clic o Enter— pasa de uno al
   * otro, recortado.
   *
   * Viven los dos acá, y no repartidos entre `App` y este módulo, porque el
   * único otro momento en que lo tecleado tiene que cambiar solo es cuando la
   * barra manda: volver atrás devuelve los filtros de esa entrada, y el campo
   * tiene que devolver el texto que produjo ese resultado. Con un efecto en
   * `App` que copiara lo aplicado sobre lo tecleado, ese efecto llegaba tarde
   * y pisaba lo que la persona acababa de escribir: medido, el caso 168 se
   * quedó con la consulta anterior aplicada porque su tecleo se perdió entre
   * el `setSearchQuery` de la búsqueda anterior y el efecto que lo seguía.
   */
  const [searchQuery, setSearchQuery] = useState(initialParams.get('q') || '');
  const [textoBuscado, setTextoBuscado] = useState(initialParams.get('q') || '');
  const [selectedType, setSelectedType] = useState<'todos' | 'productos' | 'servicios'>(() => {
    return tipoDeLaBarra(initialParams.get('type'));
  });
  const [selectedCategory, setSelectedCategory] = useState(
    initialParams.get('category') || 'Todas las categorías'
  );
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    initialParams.get('subcategory') || 'Todas'
  );
  const [selectedProvince, setSelectedProvince] = useState(
    initialParams.get('province') || 'Todas las provincias'
  );
  const [selectedLocalityId, setSelectedLocalityId] = useState(
    initialParams.get('locality_id') || ''
  );
  const [priceMin, setPriceMin] = useState<number>(() => initialNumber('min_price', 0));
  const [priceMax, setPriceMax] = useState<number>(() =>
    initialNumber('max_price', Number.MAX_SAFE_INTEGER)
  );
  const [inStockOnly, setInStockOnly] = useState(initialParams.get('in_stock') === 'true');
  const [minRating, setMinRating] = useState(() => initialNumber('min_rating', 0));
  const [condicion, setCondicion] = useState<CondicionDelMercado>(() =>
    condicionDeLaBarra(initialParams.get('condition')));
  /**
   * La marca elegida, por `value` de la opción. Vacío es «todas».
   *
   * A diferencia de la condición NO se valida contra una lista escrita acá:
   * las marcas viven en la base y el administrador las da de alta y de baja.
   * Lo que llega de la barra viaja tal cual y el servidor decide; una marca
   * que no existe devuelve cero, y la faceta sigue ofreciendo las que sí,
   * así que siempre hay por dónde salir.
   */
  const [marca, setMarca] = useState(() => initialParams.get('brand') || '');
  /**
   * El tipo del subrubro —el tercer nivel—, por slug, y el rango de potencia
   * de Tractores. Viajan en la barra como `subtype` y `power`.
   *
   * Dependen del SUBRUBRO: cambiar de rubro o de subrubro los suelta (ver
   * `desdeLaPrimera`), porque «Arados» no significa nada en Cosecha. Lo que
   * la barra traiga y no sea del subrubro lo descarta el Mercado cuando ya
   * conoce las listas, como una categoría que no existe.
   */
  const [tipo, setTipo] = useState(() => initialParams.get('subtype') || '');
  const [potencia, setPotencia] = useState<RangoDePotencia | ''>(() =>
    potenciaDeLaBarra(initialParams.get('power')));
  /**
   * El año de la máquina, desde y hasta, y el origen que declara quien vende.
   * Viajan como `year_from`, `year_to` y `origin`. El año cuelga de la
   * CATEGORÍA —sólo maquinaria lo declara—, así que cambiar de rubro o de
   * tipo de publicación lo suelta; el origen es de cualquier producto.
   */
  const [anioDesde, setAnioDesde] = useState<number | null>(() =>
    anioDeLaBarra(initialParams.get('year_from')));
  const [anioHasta, setAnioHasta] = useState<number | null>(() =>
    anioDeLaBarra(initialParams.get('year_to')));
  const [origen, setOrigen] = useState<OrigenDeclarado | ''>(() =>
    origenDeLaBarra(initialParams.get('origin')));
  /**
   * Cómo se ordena y en qué página estamos.
   *
   * Viven acá, con los filtros, y no en la grilla. Son parte de lo que se le
   * pide al servidor: viajan a la consulta, se escriben en la barra y vuelven
   * cuando la barra manda. La vista Cuadrícula/Lista no: esa sí es de la
   * grilla, porque no cambia lo que se pide sino cómo se dibuja.
   */
  const [orden, setOrden] = useState<OrdenDelMercado>(() =>
    ordenDeLaBarra(initialParams.get('sort')));
  const [pagina, setPagina] = useState(() => paginaDeLaBarra(initialParams));

  // Volver a una entrada del Mercado tiene que devolver sus filtros. El estado
  // se leyó una sola vez, al montar; desde que Atrás y Adelante existen de
  // verdad, la barra puede cambiar sin que esta pantalla se vuelva a montar.
  //
  // Se relee al dibujar, no en un efecto. Con un efecto, el commit de la
  // versión nueva corría después la escritura de la barra con los filtros de
  // antes. Al volver de una ficha recargada, cuyo estado arrancó vacío porque
  // su barra no tiene filtros, la barra quedaba un cuadro sin `q` y el Mercado
  // se dibujaba sin la búsqueda y con todas las publicaciones. Medido: un
  // cuadro con 24 tarjetas en vez de 1, seis veces de seis. Ajustado al
  // dibujar, el commit ya sale con los filtros de la barra.
  const [versionLeida, setVersionLeida] = useState(versionDeLaBarra);
  if (versionLeida !== versionDeLaBarra) {
    setVersionLeida(versionDeLaBarra);
    // La ficha de una publicación no lleva filtros en su URL, y no por eso el
    // Mercado de atrás dejó de tenerlos: releer ahí los borraría, y al volver
    // el Mercado se pediría de nuevo desde cero y arriba de todo. Se relee al
    // volver al Mercado, que es donde están.
    if (seccionDeLaBarra(window.location.pathname, window.location.search) !== 'product') {
      const params = new URLSearchParams(window.location.search);
      setSearchQuery(params.get('q') || '');
      setTextoBuscado(params.get('q') || '');
      setSelectedType(tipoDeLaBarra(params.get('type')));
      setSelectedCategory(params.get('category') || 'Todas las categorías');
      setSelectedSubcategory(params.get('subcategory') || 'Todas');
      setSelectedProvince(params.get('province') || 'Todas las provincias');
      setSelectedLocalityId(params.get('locality_id') || '');
      setPriceMin(numeroDeLaBarra(params, 'min_price', 0));
      setPriceMax(numeroDeLaBarra(params, 'max_price', Number.MAX_SAFE_INTEGER));
      setInStockOnly(params.get('in_stock') === 'true');
      setMinRating(numeroDeLaBarra(params, 'min_rating', 0));
      setCondicion(condicionDeLaBarra(params.get('condition')));
      setMarca(params.get('brand') || '');
      setTipo(params.get('subtype') || '');
      setPotencia(potenciaDeLaBarra(params.get('power')));
      setAnioDesde(anioDeLaBarra(params.get('year_from')));
      setAnioHasta(anioDeLaBarra(params.get('year_to')));
      setOrigen(origenDeLaBarra(params.get('origin')));
      setOrden(ordenDeLaBarra(params.get('sort')));
      setPagina(paginaDeLaBarra(params));
    }
  }

  useEffect(() => {
    if (!escribeEnLaBarra) return;
    const params = new URLSearchParams(window.location.search);
    const updateParam = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    updateParam('q', searchQuery || null);
    updateParam('type', selectedType === 'todos' ? null : selectedType);
    updateParam(
      'category',
      selectedCategory === 'Todas las categorías' ? null : selectedCategory
    );
    updateParam('subcategory', selectedSubcategory === 'Todas' ? null : selectedSubcategory);
    updateParam(
      'province',
      selectedProvince === 'Todas las provincias' ? null : selectedProvince
    );
    updateParam('locality_id', selectedLocalityId || null);
    updateParam('min_price', priceMin > 0 ? String(priceMin) : null);
    updateParam(
      'max_price',
      priceMax === Number.MAX_SAFE_INTEGER ? null : String(priceMax)
    );
    updateParam('in_stock', inStockOnly ? 'true' : null);
    updateParam('min_rating', minRating > 0 ? String(minRating) : null);
    updateParam('condition', condicion || null);
    updateParam('brand', marca || null);
    updateParam('subtype', tipo || null);
    updateParam('power', potencia || null);
    updateParam('year_from', anioDesde === null ? null : String(anioDesde));
    updateParam('year_to', anioHasta === null ? null : String(anioHasta));
    updateParam('origin', origen || null);
    updateParam('sort', orden === 'newest' ? null : orden);
    updateParam('page', pagina > 1 ? String(pagina) : null);

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [
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
    condicion,
    marca,
    tipo,
    potencia,
    anioDesde,
    anioHasta,
    origen,
    orden,
    pagina,
    escribeEnLaBarra,
  ]);

  /**
   * Cambiar lo que se pide vuelve a la página 1.
   *
   * La página 7 de un conjunto no significa nada en otro: con otro filtro
   * puede no existir, y si existe no muestra lo que la persona venía mirando.
   *
   * Se hace envolviendo los setters y NO con un efecto que vigile los filtros.
   * Ese efecto también correría cuando la barra manda —volver a una entrada
   * repone todos los filtros de golpe— y ahí la página que hay que respetar es
   * la de la entrada, no la 1: Atrás volvería siempre a la primera página.
   */
  const desdeLaPrimera = useMemo(() => {
    const envolver = <T,>(fijar: (valor: T) => void) => (valor: T) => {
      setPagina(1);
      fijar(valor);
    };
    // El tipo y la potencia cuelgan del subrubro: cambiar el rubro o el
    // subrubro los suelta en el mismo paso.
    const soltandoElTercerNivel = <T,>(fijar: (valor: T) => void) => (valor: T) => {
      setTipo('');
      setPotencia('');
      fijar(valor);
    };
    // El año cuelga de la categoría: cambiar de rubro, o de productos a
    // servicios, lo suelta. Cambiar de subrubro dentro de maquinaria, no.
    const soltandoElAnio = <T,>(fijar: (valor: T) => void) => (valor: T) => {
      setAnioDesde(null);
      setAnioHasta(null);
      fijar(valor);
    };
    return {
      setSelectedType: envolver(soltandoElAnio(setSelectedType)),
      setSelectedCategory: envolver(soltandoElAnio(soltandoElTercerNivel(setSelectedCategory))),
      setSelectedSubcategory: envolver(soltandoElTercerNivel(setSelectedSubcategory)),
      setSelectedProvince: envolver(setSelectedProvince),
      setSelectedLocalityId: envolver(setSelectedLocalityId),
      setPriceMin: envolver(setPriceMin),
      setPriceMax: envolver(setPriceMax),
      setInStockOnly: envolver(setInStockOnly),
      setMinRating: envolver(setMinRating),
      setCondicion: envolver(setCondicion),
      setMarca: envolver(setMarca),
      setTipo: envolver(setTipo),
      setPotencia: envolver(setPotencia),
      setAnioDesde: envolver(setAnioDesde),
      setAnioHasta: envolver(setAnioHasta),
      setOrigen: envolver(setOrigen),
      setOrden: envolver(setOrden),
    };
  }, []);

  /** Ir a otra página. Se acota acá y no en el control: una barra con
   *  `page=99` en un conjunto de dos páginas no puede pedir la 99.
   *
   *  Memorizada porque el efecto que consulta el catálogo la usa para
   *  corregir una página de más: sin identidad estable, declararla como
   *  dependencia volvería a disparar la consulta en cada render. */
  const irALaPagina = useCallback((destino: number, paginas: number) => {
    setPagina(Math.min(Math.max(1, Math.trunc(destino)), Math.max(1, paginas)));
  }, []);

  /** Aplicar lo que hay escrito. Vacío limpia el filtro, que es lo mismo que
      aplicar «nada»: `q` desaparece de la barra y la consulta deja de llevar
      `search`. */
  const aplicarBusqueda = () => {
    const recortado = textoBuscado.trim();
    setTextoBuscado(recortado);
    setSearchQuery(recortado);
    setPagina(1);
  };

  // Limpiar filtros no cambia el orden: ordenar no es filtrar, y quien eligió
  // «Menor precio» no pidió volver a «Más recientes».
  const resetFilters = () => {
    setPagina(1);
    setSearchQuery('');
    setTextoBuscado('');
    setSelectedType('todos');
    setSelectedCategory('Todas las categorías');
    setSelectedSubcategory('Todas');
    setSelectedProvince('Todas las provincias');
    setSelectedLocalityId('');
    setPriceMin(0);
    setPriceMax(Number.MAX_SAFE_INTEGER);
    setInStockOnly(false);
    setMinRating(0);
    setCondicion('');
    setMarca('');
    setTipo('');
    setPotencia('');
    setAnioDesde(null);
    setAnioHasta(null);
    setOrigen('');
  };

  return {
    // Estado
    searchQuery,
    textoBuscado,
    selectedType,
    selectedCategory,
    selectedSubcategory,
    selectedProvince,
    selectedLocalityId,
    priceMin,
    priceMax,
    inStockOnly,
    minRating,
    condicion,
    marca,
    tipo,
    potencia,
    anioDesde,
    anioHasta,
    origen,
    orden,
    pagina,
    // Setters. Los que cambian lo que se pide vuelven a la página 1.
    setTextoBuscado,
    aplicarBusqueda,
    ...desdeLaPrimera,
    irALaPagina,
    resetFilters,
  };
};
