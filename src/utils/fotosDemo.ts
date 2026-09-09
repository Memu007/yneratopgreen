/**
 * Las fotos del catálogo de demostración, por slug.
 *
 * ESTA TABLA SE DERIVA de `docs/pm/INVENTARIO-FOTOS-CATALOGO-2026-09-09.md`, el
 * paquete que cerró la PM. El caso 162 vuelve a leer ese inventario y se cae si
 * dejaron de coincidir: la atribución no puede envejecer por separado de la foto
 * que atribuye.
 *
 * Qué resuelve y qué NO:
 *
 *  - la foto real que sube un vendedor SIEMPRE gana. Acá sólo se mira cuando la
 *    publicación no tiene foto, o cuando la que tiene es de relleno —el seed
 *    dejó URLs de `picsum.photos`, que devuelve una imagen al azar, y para el
 *    sistema visual eso es lo mismo que no tener foto—;
 *  - un slug que no está en esta tabla conserva el respaldo honesto («Sin
 *    registro fotográfico»). No hay imagen genérica de reemplazo: veinte avisos
 *    distintos con la misma foto son inventario ficticio con otro nombre.
 *
 * El crédito no es decorativo. Veinticinco de las treinta son CC BY o CC BY-SA
 * —las otras cinco son CC0 o dominio público—, y esas veinticinco exigen
 * mantener autor, licencia y la mención de la adaptación DONDE SE MUESTRA la
 * obra, no sólo en un archivo del repositorio. Por eso el crédito viaja con la
 * foto y el detalle lo imprime. Se imprime en las treinta: distinguir cuáles lo
 * necesitan sería una regla más para mantener, y acreditar de más no molesta a
 * nadie.
 */

export interface FotoDemo {
  archivo: string;
  obra: string;
  autor: string;
  /** Tal cual lo escribió la PM en el inventario: es la fuente. */
  licencia: string;
  /** Cómo se lee en pantalla. El inventario mezcla «by 2.0» con «CC BY-SA 4.0»
   *  y a una persona no se le muestra un identificador a medio escribir. */
  licenciaVisible: string;
  urlLicencia: string;
  fuente: string;
}

/** La adaptación común a las treinta, declarada por la PM en el inventario. */
export const ADAPTACION_DEMO = 'recorte centrado, redimensionado y conversión a WebP';

export const FOTO_DEMO_POR_SLUG: Record<string, FotoDemo> = {
  'semillas-maiz-dk-premium': {
    archivo: '/catalogo/semillas-maiz-dk-premium.webp',
    obra: 'Corn',
    autor: 'Thad Zajdowicz',
    licencia: 'cc0 1.0',
    licenciaVisible: 'CC0 1.0',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
    fuente: 'https://www.flickr.com/photos/40632439@N00/6273685781',
  },
  'fertilizante-triple-15': {
    archivo: '/catalogo/fertilizante-triple-15.webp',
    obra: 'NPK 19-19-19 Fertilizer (1)',
    autor: 'Suyash Dwivedi',
    licencia: 'CC BY-SA 4.0',
    licenciaVisible: 'CC BY-SA 4.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/4.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:NPK_19-19-19_Fertilizer_(1).jpg',
  },
  'pulverizadora-jacto-600': {
    archivo: '/catalogo/pulverizadora-jacto-600.webp',
    obra: 'John Deere 4730 Sprayer',
    autor: 'basicbill',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/60159466@N00/6958418362',
  },
  'semillas-soja-rr-intacta': {
    archivo: '/catalogo/semillas-soja-rr-intacta.webp',
    obra: 'Planting Soybeans',
    autor: 'UnitedSoybeanBoard',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/95352257@N06/10140178515',
  },
  'cosechadora-john-deere-9750': {
    archivo: '/catalogo/cosechadora-john-deere-9750.webp',
    obra: 'Soybean Harvest',
    autor: 'UnitedSoybeanBoard',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/95352257@N06/13782568404',
  },
  'herbicida-glifosato-20l': {
    archivo: '/catalogo/herbicida-glifosato-20l.webp',
    obra: 'IMG_2986 (2400x1600)',
    autor: 'Chafer Machinery',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/98342789@N05/10978695584',
  },
  'servicio-siembra-gps': {
    archivo: '/catalogo/servicio-siembra-gps.webp',
    obra: 'Precision Planting',
    autor: 'USFWS Mountain Prairie',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/51986662@N05/5223642187',
  },
  'rastra-discos-24-platos': {
    archivo: '/catalogo/rastra-discos-24-platos.webp',
    obra: 'Disc harrowing',
    autor: 'Michael Trolove',
    licencia: 'by-sa 2.0',
    licenciaVisible: 'CC BY-SA 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/2.0/',
    fuente: 'https://www.geograph.org.uk/photo/741616',
  },
  'terneros-angus-lote-20': {
    archivo: '/catalogo/terneros-angus-lote-20.webp',
    obra: '20130712-AMS-LSC-0453',
    autor: 'USDAgov',
    licencia: 'pdm 1.0',
    licenciaVisible: 'Dominio público (PDM 1.0)',
    urlLicencia: 'https://creativecommons.org/publicdomain/mark/1.0/',
    fuente: 'https://www.flickr.com/photos/41284017@N08/9303666227',
  },
  'vaquillonas-braford-prenadas': {
    archivo: '/catalogo/vaquillonas-braford-prenadas.webp',
    obra: 'k5685-1',
    autor: 'USDAgov',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/41284017@N08/8433750688',
  },
  'dron-pulverizador-agricola-20l': {
    archivo: '/catalogo/dron-pulverizador-agricola-20l.webp',
    obra: 'DJI Agras T50 demonstrating sprayers in flight',
    autor: 'Blervis',
    licencia: 'CC0 1.0',
    licenciaVisible: 'CC0 1.0',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:DJI_Agras_T50_demonstrating_sprayers_in_flight.jpg',
  },
  'sensores-humedad-suelo-iot': {
    archivo: '/catalogo/sensores-humedad-suelo-iot.webp',
    obra: 'soil-sensors',
    autor: 'Air Resources Laboratory',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/87182179@N05/49238045018',
  },
  'urea-granulada-46-nitrogeno': {
    archivo: '/catalogo/urea-granulada-46-nitrogeno.webp',
    obra: 'Granular Urea application',
    autor: 'Michael Trolove',
    licencia: 'CC BY-SA 2.0',
    licenciaVisible: 'CC BY-SA 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/2.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:Granular_Urea_application_-_geograph.org.uk_-_1219037.jpg',
  },
  'tractor-pauny-280a-doble-traccion': {
    archivo: '/catalogo/tractor-pauny-280a-doble-traccion.webp',
    obra: 'Organic Fertiliser (Manure)',
    autor: 'B4bees',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/26314424@N08/3966711687',
  },
  'insecticida-lambda-cihalotrina-1l': {
    archivo: '/catalogo/insecticida-lambda-cihalotrina-1l.webp',
    obra: 'An Air Tractor Doing Some Crop Dusting near the Farm',
    autor: 'pmarkham',
    licencia: 'by-sa 2.0',
    licenciaVisible: 'CC BY-SA 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/2.0/',
    fuente: 'https://www.flickr.com/photos/9197427@N06/3777092726',
  },
  'servicio-cosecha-monitor-rendimiento': {
    archivo: '/catalogo/servicio-cosecha-monitor-rendimiento.webp',
    obra: 'It’s combine harvester time!',
    autor: 'JOHN K THORNE',
    licencia: 'cc0 1.0',
    licenciaVisible: 'CC0 1.0',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
    fuente: 'https://www.flickr.com/photos/89918055@N05/51380202253',
  },
  'transporte-granos-a-puerto': {
    archivo: '/catalogo/transporte-granos-a-puerto.webp',
    obra: 'Alan driving the grain truck..',
    autor: 'Jeff Sandquist',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/48003527@N00/2752128242',
  },
  'flete-maquinaria-agricola-carreton': {
    archivo: '/catalogo/flete-maquinaria-agricola-carreton.webp',
    obra: 'John Deere 2030 with IH tractor on trailer (1)',
    autor: 'Cjp24',
    licencia: 'CC BY-SA 4.0',
    licenciaVisible: 'CC BY-SA 4.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/4.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:John_Deere_2030_with_IH_tractor_on_trailer_(1).jpg',
  },
  'recepcion-secado-acopio-granos': {
    archivo: '/catalogo/recepcion-secado-acopio-granos.webp',
    obra: 'Nampa Alberta Grain Elevator',
    autor: 'Wilson Hui',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/51942038@N04/10290116723',
  },
  'guarda-granos-silo-bolsa': {
    archivo: '/catalogo/guarda-granos-silo-bolsa.webp',
    obra: 'Silo bolsas - Provincia de Buenos Aires - 2008',
    autor: 'Roblespepe',
    licencia: 'CC BY-SA 3.0',
    licenciaVisible: 'CC BY-SA 3.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/3.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:Silo_bolsas_-_Prov_Buenos_Aires_-2008.jpg',
  },
  'asesoramiento-manejo-integrado-cultivos': {
    archivo: '/catalogo/asesoramiento-manejo-integrado-cultivos.webp',
    obra: 'Agronomist showing well developed soybean roots from LEM Alvorada farm IPI experiment Brazil',
    autor: 'International Potash Institute',
    licencia: 'CC BY 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/49027973@N08/17444052940',
  },
  'planificacion-riego-fertirriego': {
    archivo: '/catalogo/planificacion-riego-fertirriego.webp',
    obra: '20130920-OC-LSC-0639',
    autor: 'USDAgov',
    licencia: 'pdm 1.0',
    licenciaVisible: 'Dominio público (PDM 1.0)',
    urlLicencia: 'https://creativecommons.org/publicdomain/mark/1.0/',
    fuente: 'https://www.flickr.com/photos/41284017@N08/10548334043',
  },
  'mantenimiento-preventivo-cosechadoras': {
    archivo: '/catalogo/mantenimiento-preventivo-cosechadoras.webp',
    obra: 'Combine Harvester (Deutz-Faher TopLiner 4090 HTS) - at work at Moyvalley, Co. Kildare, Ireland. September 1st 2011',
    autor: 'Peter Mooney',
    licencia: 'by-sa 2.0',
    licenciaVisible: 'CC BY-SA 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/2.0/',
    fuente: 'https://www.flickr.com/photos/25874444@N00/6105468655',
  },
  'reparacion-hidraulica-maquinaria-agricola': {
    archivo: '/catalogo/reparacion-hidraulica-maquinaria-agricola.webp',
    obra: '140804-F-IG195-214',
    autor: 'Pacific Air Forces',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/69646446@N02/14818084076',
  },
  'muestreo-suelo-recomendacion-fertilizacion': {
    archivo: '/catalogo/muestreo-suelo-recomendacion-fertilizacion.webp',
    obra: 'soil samples',
    autor: 'photofarmer',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/62528187@N00/8612063738',
  },
  'instalacion-reparacion-alambrados-rurales': {
    archivo: '/catalogo/instalacion-reparacion-alambrados-rurales.webp',
    obra: 'a pretty morning farm',
    autor: 'scott1346',
    licencia: 'CC BY 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/42549779@N06/8265586126',
  },
  'equipo-riego-goteo-10-hectareas': {
    archivo: '/catalogo/equipo-riego-goteo-10-hectareas.webp',
    obra: 'Irrigation equipment',
    autor: 'Bommi Dharrshini OKC',
    licencia: 'CC BY-SA 4.0',
    licenciaVisible: 'CC BY-SA 4.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/4.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:Irrigation_equipment.jpg',
  },
  'manga-ganadera-balanza-electronica': {
    archivo: '/catalogo/manga-ganadera-balanza-electronica.webp',
    obra: 'Scale for large livestock (Waage für Großvieh), Museum Waake',
    autor: 'Nemracc',
    licencia: 'CC BY-SA 4.0',
    licenciaVisible: 'CC BY-SA 4.0',
    urlLicencia: 'https://creativecommons.org/licenses/by-sa/4.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:Scale_for_large_livestock_(Waage_für_Großvieh),_Museum_Waake.jpg',
  },
  'kit-filtros-correas-cosechadora': {
    archivo: '/catalogo/kit-filtros-correas-cosechadora.webp',
    obra: 'Mechanical components in an old engine workshop showcasing intricate details and vintage machinery',
    autor: 'Shixart1985',
    licencia: 'CC BY 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://commons.wikimedia.org/wiki/File:Mechanical_components_in_an_old_engine_workshop_showcasing_intricate_details_and_vintage_machinery.jpg',
  },
  'campo-agricola-120-hectareas': {
    archivo: '/catalogo/campo-agricola-120-hectareas.webp',
    obra: 'Ririe Dam aerial',
    autor: 'Sam Beebe',
    licencia: 'by 2.0',
    licenciaVisible: 'CC BY 2.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/2.0/',
    fuente: 'https://www.flickr.com/photos/28585409@N04/6287371297',
  },
};

/**
 * La foto que le corresponde a una publicación del catálogo demostrativo.
 *
 * Devuelve `undefined` cuando no hay que intervenir: cuando la publicación ya
 * tiene una foto de verdad, o cuando su slug no es de la demostración.
 */
export function fotoDemoDe(slug?: string, tieneFotoReal = false): FotoDemo | undefined {
  if (tieneFotoReal || !slug) return undefined;
  return FOTO_DEMO_POR_SLUG[slug];
}

/** Qué foto es ésta, si es una de la demostración. */
export function fotoDemoDeArchivo(src?: string): FotoDemo | undefined {
  if (!src) return undefined;
  return Object.values(FOTO_DEMO_POR_SLUG).find((foto) => src.endsWith(foto.archivo));
}
