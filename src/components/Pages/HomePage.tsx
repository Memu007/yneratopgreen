import React, { useEffect, useRef } from 'react';
import styles from './HomePage.module.css';
import { useEsMovil } from '../../hooks/useEsMovil';
import type { VistaPrevia } from '../../hooks/useVistaPrevia';

interface HomePageProps {
  onNavigateToMarketplace: () => void;
  /** «Escribinos», la salida de los servicios que todavía no están. */
  onNavigateToContact: () => void;
  /** El total del mismo catálogo que el mercado. Inicio no muestra
      publicaciones: sólo cuántas hay, en la tarjeta del Mercado. */
  vistaPrevia: VistaPrevia;
}

interface Servicio {
  numero: string;
  nombre: string;
  texto: string;
  /** Las fotos son ilustrativas: van sin texto alternativo y sin nada encima.
      Salen del inventario del catálogo (dos con crédito, abajo) y de la
      clienta (la del relevamiento). */
  foto: string;
  ancho: number;
  alto: number;
  disponible?: boolean;
}

/* El ecosistema, en el orden que aprobó la clienta (30/09). Sólo el Mercado
   funciona hoy: los demás son tarjetas sin enlace ni botón, porque no hay
   adónde llevar. */
const SERVICIOS: Servicio[] = [
  {
    numero: '01', nombre: 'Ruta productiva',
    texto: 'Construí una ruta según producción, destino y mercado objetivo.',
    foto: '/catalogo/planificacion-riego-fertirriego.webp', ancho: 1600, alto: 1000,
  },
  {
    numero: '02', nombre: 'Mercado',
    texto: 'Buscá productos, maquinaria, insumos, tierras y servicios o publicá una oferta.',
    foto: '/catalogo/servicio-cosecha-monitor-rendimiento.webp', ancho: 1600, alto: 1000,
    disponible: true,
  },
  {
    numero: '03', nombre: 'Trazabilidad',
    texto: 'Generá eventos, datos y evidencias vinculados a la ruta y al lote.',
    foto: '/catalogo/terneros-angus-lote-20.webp', ancho: 1600, alto: 1000,
  },
  {
    numero: '04', nombre: 'Cumplimiento y certificaciones',
    texto: 'Controlá requisitos, documentos y certificaciones aplicables.',
    foto: '/catalogo/muestreo-suelo-recomendacion-fertilizacion.webp', ancho: 1600, alto: 1000,
  },
  {
    numero: '05', nombre: 'Tecnología',
    texto: 'Separá tecnología necesaria de mejoras opcionales y calculá inversión.',
    foto: '/catalogo/sensores-humedad-suelo-iot.webp', ancho: 1600, alto: 1000,
  },
  {
    numero: '06', nombre: 'Noticias del agro',
    texto: 'Lo que pasa en el mundo agropecuario, en un solo lugar.',
    foto: '/media/comercial/servicios-relevamiento-hero-960.webp', ancho: 960, alto: 540,
  },
  {
    numero: '07', nombre: 'Charlas y capacitaciones',
    texto: 'Encuentros con especialistas para producir y vender mejor.',
    foto: '/catalogo/dron-pulverizador-agricola-20l.webp', ancho: 1600, alto: 1000,
  },
];

/* Cómo funciona: cada paso con el servicio que lo atiende. Sólo el último,
   comercializar, funciona hoy. */
const PASOS: { numero: string; nombre: string; texto: string; servicio: string; disponible?: boolean }[] = [
  { numero: '01', nombre: 'Producir', texto: 'Qué producto, dónde, escala y etapa.', servicio: 'Ruta productiva' },
  { numero: '02', nombre: 'Destinar', texto: 'Consumo, industria, exportación u otro destino.', servicio: 'Ruta productiva' },
  { numero: '03', nombre: 'Cumplir', texto: 'Requisitos, documentos, controles y certificaciones.', servicio: 'Trazabilidad y cumplimiento' },
  { numero: '04', nombre: 'Tecnificar', texto: 'Lo necesario, recomendable y avanzado.', servicio: 'Tecnología' },
  { numero: '05', nombre: 'Comercializar', texto: 'Oferta, comprador, logística y operación.', servicio: 'Mercado · Disponible hoy', disponible: true },
];

/* Los tres niveles de registro del principio. Las barras son decorativas;
   los nombres se leen. */
const NIVELES: [string, string | null][] = [
  ['Registro esencial', 'Ruta industrial'],
  ['Registro ampliado', null],
  ['Registro exhaustivo', 'Ruta exportación'],
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToMarketplace,
  onNavigateToContact,
  vistaPrevia,
}) => {
  const tituloDelEcosistema = useRef<HTMLHeadingElement>(null);
  const { total } = vistaPrevia;

  // Lleva a los servicios y deja el foco en su título: quien navega con
  // teclado sigue desde ahí, y el lector de pantalla anuncia dónde quedó. El
  // título tiene margen de desplazamiento para no quedar bajo la cabecera.
  const conocerElEcosistema = () => {
    const titulo = tituloDelEcosistema.current;
    if (!titulo) return;
    titulo.scrollIntoView({ block: 'start' });
    titulo.focus({ preventScroll: true });
  };

  // En celular, «¿Te interesa alguno?» cierra la página, después del principio:
  // entre las tarjetas cortaba la lectura, y dejaba suelto el crédito de las
  // fotos. Desde 600 px la grilla tiene dos o cuatro columnas y el bloque la
  // completa como octava, así que ahí se queda. Cambia de lugar en el
  // documento, y no sólo en lo que se ve, para que el lector de pantalla y el
  // Tab lo encuentren donde está: por eso lo decide el ancho y no la hoja.
  const cierre = useRef<HTMLElement>(null);
  const escribinos = useRef<HTMLButtonElement>(null);
  const devolverElFoco = useRef(false);
  const cierreAlFinal = useEsMovil(() => {
    devolverElFoco.current = !!cierre.current?.contains(document.activeElement);
  });

  // Al mudarse, el bloque es otro elemento: si tenía el foco (girar el celular
  // o achicar la ventana con el foco en «Escribinos»), se lo devuelve.
  useEffect(() => {
    if (!devolverElFoco.current) return;
    devolverElFoco.current = false;
    escribinos.current?.focus();
  }, [cierreAlFinal]);

  // Al final es una sección más de la página, y su título es de nivel 2; en la
  // grilla es una tarjeta más, de nivel 3.
  const TituloDelCierre = cierreAlFinal ? 'h2' : 'h3';
  const porEtapas = (
    <aside ref={cierre} className={`tg-sobre-marca ${styles.porEtapas}`} aria-labelledby="titulo-por-etapas">
      <div>
        <p className="tg-eyebrow">Por etapas</p>
        <TituloDelCierre id="titulo-por-etapas" className={styles.porEtapasTitulo}>¿Te interesa alguno?</TituloDelCierre>
        <p>Cada servicio se suma por etapas, después del Mercado.</p>
      </div>
      <button ref={escribinos} type="button" className={`tg-button ${styles.botonBlanco}`} onClick={onNavigateToContact}>
        Escribinos
      </button>
    </aside>
  );

  // Es el contenido principal de la página: va en `main`, como el Mercado, la
  // ficha y Mi cuenta.
  return (
    <main className={styles.pagina}>
      <section className={`tg-sobre-marca ${styles.portada}`} aria-labelledby="titulo-inicio">
        <div className={styles.portadaTexto}>
          <p className="tg-eyebrow">Bienvenido a AgroBoeda</p>
          <h1 id="titulo-inicio" className={styles.portadaTitulo}>
            Producción, mercado, cumplimiento y tecnología en una misma ruta.
          </h1>
          <p className={styles.portadaBajada}>
            La plataforma parte de tu producción y su destino para determinar qué registrar, qué
            validar, qué tecnología realmente necesitás y cómo llevar la producción al mercado.
          </p>
          <div className={styles.acciones}>
            <button type="button" className={`tg-button ${styles.botonClaro}`} onClick={conocerElEcosistema}>
              Conocé el ecosistema
            </button>
            <button type="button" className={`tg-button ${styles.botonLinea}`} onClick={onNavigateToMarketplace}>
              Entrar al Mercado
            </button>
          </div>
          <p className={styles.nota}>Hoy funciona el Mercado. El resto del ecosistema se suma por etapas.</p>
        </div>
        {/* La fotografía no lleva texto encima ni filtro: la banda va debajo y
            dice qué se está mirando sin taparlo. Los dos derivados son los
            únicos autorizados para producción. */}
        <figure className={styles.portadaFoto}>
          <picture>
            <source media="(max-width: 599px)" srcSet="/media/comercial/home-cosecha-hero-1200.webp" />
            <img
              src="/media/comercial/home-cosecha-hero-1920.webp"
              alt="Cosecha y descarga de grano en un campo argentino"
              width={1920}
              height={1080}
            />
          </picture>
          <figcaption className={styles.fotoBanda}>
            <span>Cosecha y descarga de grano · Campo argentino</span>
            <i aria-hidden="true" />
          </figcaption>
        </figure>
      </section>

      <section className={styles.ecosistema} aria-labelledby="titulo-ecosistema">
        <div className="tg-container">
          <div className={styles.cabeza}>
            <div>
              <p className="tg-eyebrow">El ecosistema AgroBoeda</p>
              <h2 id="titulo-ecosistema" ref={tituloDelEcosistema} tabIndex={-1} className={styles.titulo}>
                ¿Qué querés hacer?
              </h2>
            </div>
            <p className={styles.intro}>
              Definí qué producís y dónde querés colocar la producción. AgroBoeda relaciona la ruta
              productiva con mercado, trazabilidad, cumplimiento, certificaciones y tecnología.
            </p>
          </div>

          <div className={styles.grilla}>
            {SERVICIOS.map((servicio) => (
              <article
                key={servicio.numero}
                className={servicio.disponible ? `${styles.servicio} ${styles.disponible}` : styles.servicio}
              >
                <div className={styles.foto}>
                  <img
                    src={servicio.foto}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={servicio.ancho}
                    height={servicio.alto}
                  />
                </div>
                <div className={styles.cuerpo}>
                  <div className={styles.meta}>
                    <span className={styles.numero}>{servicio.numero}</span>
                    <span className={servicio.disponible ? `${styles.estado} ${styles.estadoHoy}` : styles.estado}>
                      {servicio.disponible ? 'Disponible hoy' : 'Próximamente'}
                    </span>
                  </div>
                  <h3>{servicio.nombre}</h3>
                  <p>{servicio.texto}</p>
                  {servicio.disponible && (
                    <>
                      {/* El número es el `total` del catálogo. Mientras no se
                          sabe no se escribe ninguno: un número provisorio sería
                          inventado. */}
                      {total !== null && (
                        <p className={styles.cuenta}>
                          <b className="tg-data">{total}</b>{' '}
                          {total === 1 ? 'publicación disponible' : 'publicaciones disponibles'}
                        </p>
                      )}
                      <button type="button" className={styles.entrar} onClick={onNavigateToMarketplace}>
                        <span>Entrar al Mercado</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
            {!cierreAlFinal && porEtapas}
          </div>

          {/* Las dos fotos CC BY 2.0 llevan crédito, con la obra, el autor y la
              licencia enlazados (docs/pm/archivo/cerrados/INVENTARIO-FOTOS-CATALOGO-2026-09-09.md).
              Las demás son CC0, dominio público o de la clienta. */}
          <p className={styles.credito}>
            Fotos de Cumplimiento y Tecnología: “
            <a href="https://www.flickr.com/photos/62528187@N00/8612063738">soil samples</a>”, de{' '}
            <a href="https://www.flickr.com/photos/62528187@N00">photofarmer</a>, y “
            <a href="https://www.flickr.com/photos/87182179@N05/49238045018">soil-sensors</a>”, de{' '}
            <a href="https://www.flickr.com/photos/87182179@N05">Air Resources Laboratory</a>, con licencia{' '}
            <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a>. Recortadas.
          </p>
        </div>
      </section>

      <section className={styles.ruta} aria-labelledby="titulo-ruta">
        <div className="tg-container">
          <div className={styles.cabeza}>
            <div>
              <p className="tg-eyebrow">Cómo funciona</p>
              <h2 id="titulo-ruta" className={styles.titulo}>Una misma producción puede seguir distintas rutas.</h2>
            </div>
            <p className={styles.intro}>
              Cada paso de la ruta tiene su servicio en el ecosistema. El último, comercializar, ya
              funciona en el Mercado.
            </p>
          </div>
          <ol className={styles.pasos}>
            {PASOS.map((paso) => (
              <li key={paso.numero} className={paso.disponible ? `${styles.paso} ${styles.pasoHoy}` : styles.paso}>
                <span className={styles.nodo} aria-hidden="true" />
                <span className={styles.numero}>{paso.numero}</span>
                <h3>{paso.nombre}</h3>
                <p>{paso.texto}</p>
                <span className={styles.de}>{paso.servicio}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.principioMarco} aria-labelledby="titulo-principio">
        <div className="tg-container">
          <div className={`tg-sobre-marca ${styles.principio}`}>
            <div>
              <p id="titulo-principio" className="tg-eyebrow">Principio de AgroBoeda</p>
              <blockquote className={styles.frase}>
                La tecnología se decide <em>por la ruta</em>, no al revés.
              </blockquote>
            </div>
            <div>
              <p className={styles.principioTexto}>
                Una materia prima destinada a una industria puede requerir un esquema de registros y
                controles diferente al de una producción destinada a consumo humano directo o a un
                mercado de exportación exigente. AgroBoeda va a adaptar la gestión a la ruta
                seleccionada.
              </p>
              <ul className={styles.niveles}>
                {NIVELES.map(([nombre, ruta], indice) => (
                  <li key={nombre} className={styles.nivel}>
                    <span className={styles.barras} aria-hidden="true">
                      {[0, 1, 2].map((barra) => (
                        <i key={barra} className={barra <= indice ? styles.barraLlena : undefined} />
                      ))}
                    </span>
                    <b>{nombre}</b>
                    {ruta && <span>{ruta}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {cierreAlFinal && <div className={`tg-container ${styles.cierre}`}>{porEtapas}</div>}
    </main>
  );
};
