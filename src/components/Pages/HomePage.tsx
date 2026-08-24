import React from 'react';
import styles from './HomePage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ProductCard } from '../ProductCard/ProductCard';
import type { VistaPrevia } from '../../hooks/useVistaPrevia';

interface HomePageProps {
  onNavigateToMarketplace: () => void;
  onNavigateToContact?: () => void;
  onNavigateToServices?: () => void;
  onPublishClick?: () => void;
  onLoginClick?: () => void;
  /** Publicaciones reales del mismo catálogo que el mercado. */
  vistaPrevia: VistaPrevia;
}

/** Las cuatro clases de operación, con el dato que las distingue.
 *
 *  Es contenido, no control: hoy no existe una traducción inequívoca de cada
 *  una a un filtro del mercado —«Maquinaria y campos» son dos categorías y
 *  «Logística» es una anatomía—, y un bloque que parece un botón y no filtra
 *  nada es peor que un texto que informa. */
const TAXONOMIA: [string, string][] = [
  ['Maquinaria y campos', 'Activos de alto valor'],
  ['Insumos', 'Precio, unidad y stock'],
  ['Servicios', 'Cobertura y modalidad'],
  ['Logística', 'Origen, destino y equipo'],
];

/** Los datos que cada publicación tiene que traer para poder compararse. */
const DECISION: [string, string][] = [
  ['Precio o modalidad', 'Valor publicado, unidad o indicación honesta de cotización.'],
  ['Ubicación y alcance', 'Localidad, cobertura o radio según el tipo de publicación.'],
  ['Responsable y próximo paso', 'Quién publica y qué acción existe realmente en el producto.'],
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToMarketplace,
  onNavigateToContact,
  onPublishClick,
  onLoginClick,
  vistaPrevia,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const handlePublishClick = () => {
    if (!user) {
      showToast('Debes iniciar sesión para publicar productos', 'warning');
      onLoginClick?.();
      return;
    }
    onPublishClick?.();
  };

  const { operaciones, total, cargando, error, reintentar } = vistaPrevia;

  return (
    <div className={styles.pagina}>
      <section className={styles.hero} aria-labelledby="titulo-inicio">
        <div className={styles.heroCopy}>
          <div className="tg-eyebrow">Mercado agro · Argentina</div>
          <h1 id="titulo-inicio" className={styles.heroTitulo}>
            Equipos, insumos y servicios para seguir produciendo.
          </h1>
          <p className="tg-lead">
            Publicaciones con precio o modalidad, ubicación, responsable y próximo paso.
          </p>
          <div className={styles.acciones}>
            <button className="tg-button tg-button--primary" onClick={onNavigateToMarketplace}>
              Explorar operaciones
            </button>
            <button className="tg-button tg-button--secondary" onClick={handlePublishClick}>
              Publicar una oferta
            </button>
          </div>
          {/* El número sale de `response.total`, que es lo que la API dice que
              hay. Mientras no se sabe, no se escribe un número provisorio. */}
          {total !== null && (
            <p className={styles.conteo}>
              {total === 1 ? '1 operación disponible ahora' : `${total} operaciones disponibles ahora`}
            </p>
          )}
        </div>
        {/* La fotografía no lleva texto encima ni filtro: ocupa su columna y se
            ve. Los dos derivados son los únicos autorizados para producción. */}
        <div className={styles.heroFoto}>
          <picture>
            <source media="(max-width: 599px)" srcSet="/media/comercial/home-cosecha-hero-1200.webp" />
            <img
              src="/media/comercial/home-cosecha-hero-1920.webp"
              alt="Cosecha y descarga de grano en un campo argentino"
              width={1920}
              height={1080}
            />
          </picture>
        </div>
      </section>

      <section className={styles.taxonomia} aria-labelledby="titulo-taxonomia">
        <h2 id="titulo-taxonomia" className="tg-sr-only">Tipos de operación</h2>
        <div className={`tg-container ${styles.taxonomiaGrilla}`}>
          {TAXONOMIA.map(([nombre, descriptor]) => (
            <div key={nombre} className={styles.taxonomiaItem}>
              <strong>{nombre}</strong>
              <span>{descriptor}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`tg-container ${styles.operaciones}`} aria-labelledby="titulo-operaciones">
        <div className={styles.encabezadoDeSeccion}>
          <div>
            <div className="tg-eyebrow">Mercado activo</div>
            <h2 id="titulo-operaciones">Operaciones disponibles</h2>
          </div>
          <button className="tg-button tg-button--tertiary" onClick={onNavigateToMarketplace}>
            Ver todas las operaciones
          </button>
        </div>

        {cargando ? (
          <div className={styles.grilla} aria-busy="true" aria-live="polite">
            <span className="tg-sr-only">Cargando operaciones</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.esqueleto} aria-hidden="true">
                <div className={styles.esqueletoFoto} />
                <div className={styles.esqueletoLinea} />
                <div className={`${styles.esqueletoLinea} ${styles.esqueletoCorta}`} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className={styles.aviso} role="alert">
            <p>{error}</p>
            <button className="tg-button tg-button--secondary" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        ) : operaciones.length === 0 ? (
          <div className={styles.aviso}>
            <p>Todavía no hay operaciones publicadas.</p>
            <button className="tg-button tg-button--secondary" onClick={handlePublishClick}>
              Publicar una oferta
            </button>
          </div>
        ) : (
          <div className={styles.grilla}>
            {operaciones.map((operacion) => (
              <ProductCard
                key={operacion.id}
                product={operacion}
                variante="compacta"
                onSolicitarCotizacion={onNavigateToContact}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.decision} aria-labelledby="titulo-datos">
        <div className={`tg-container ${styles.decisionGrilla}`}>
          <div className={styles.decisionIntro}>
            <div className="tg-eyebrow">Antes de avanzar</div>
            <h2 id="titulo-datos">Los datos que definen la operación.</h2>
          </div>
          {DECISION.map(([titulo, texto]) => (
            <div key={titulo} className={styles.decisionItem}>
              <strong>{titulo}</strong>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`tg-container ${styles.cta}`} aria-labelledby="titulo-publicar">
        <div className={styles.ctaInterior}>
          <div>
            <h2 id="titulo-publicar">¿Tenés algo para ofrecer?</h2>
            <p>Publicá un activo, un insumo o un servicio con los datos que necesita la operación.</p>
          </div>
          <div className={styles.acciones}>
            <button className="tg-button tg-button--primary" onClick={handlePublishClick}>
              Publicar una oferta
            </button>
            <button className="tg-button tg-button--secondary" onClick={onNavigateToMarketplace}>
              Ver el mercado
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
