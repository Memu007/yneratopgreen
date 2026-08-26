import React from 'react';
import styles from './ServicesPage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ProductCard } from '../ProductCard/ProductCard';
import type { VistaPrevia } from '../../hooks/useVistaPrevia';

interface ServicesPageProps {
  onNavigateToContact?: () => void;
  /** Lleva al mercado con el filtro de servicios ya puesto. */
  onVerServiciosPublicados?: () => void;
  onPublishClick?: () => void;
  onLoginClick?: () => void;
  /** Publicaciones reales de servicio y logística. */
  vistaPrevia: VistaPrevia;
}

/** Lo que hace comparable a una propuesta. Son los datos que la publicación
 *  declara; no se prometen certificaciones, alianzas ni tecnologías. */
const COMPARACION: [string, string][] = [
  ['Cobertura real', 'Provincia, localidades o radio declarados por quien presta el servicio.'],
  ['Modalidad', 'Por hectárea, visita, proyecto o unidad que la publicación efectivamente informa.'],
  ['Condiciones', 'Equipamiento, disponibilidad y próximo paso sólo cuando existen datos.'],
];

const PRUEBA: [string, string][] = [
  ['Cobertura', 'Zona de trabajo'],
  ['Modalidad', 'Precio o cotización'],
  ['Responsable', 'Quién presta el servicio'],
];

export const ServicesPage: React.FC<ServicesPageProps> = ({
  onNavigateToContact,
  onVerServiciosPublicados,
  onPublishClick,
  onLoginClick,
  vistaPrevia,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const publicar = () => {
    if (!user) {
      showToast('Debes iniciar sesión para publicar un servicio', 'warning');
      onLoginClick?.();
      return;
    }
    onPublishClick?.();
  };

  const { operaciones, cargando, error, reintentar } = vistaPrevia;

  return (
    <div className={styles.pagina}>
      <section className={styles.hero} aria-labelledby="titulo-servicios">
        {/* La fotografía es evidencia de trabajo real y no lleva nada encima:
            ni texto, ni filtro, ni degradado. */}
        <figure className={styles.heroFoto}>
          <picture>
            <source
              media="(max-width: 599px)"
              srcSet="/media/comercial/servicios-relevamiento-hero-960-4x3.webp"
            />
            <img
              src="/media/comercial/servicios-relevamiento-hero-960.webp"
              alt="Relevamiento aéreo de un campo afectado por inundación"
              width={960}
              height={540}
            />
          </picture>
          <figcaption className={styles.fotoBanda}>
            <span>Relevamiento aéreo · Campo afectado por inundación</span>
            <i aria-hidden="true" />
          </figcaption>
        </figure>
        <div className={styles.heroCopy}>
          <p className="tg-eyebrow">Servicios publicados</p>
          <h1 id="titulo-servicios" className={styles.heroTitulo}>
            Encontrá quién resuelve el trabajo.
          </h1>
          <p className="tg-lead">
            Muestreo, labores, asistencia técnica y logística con cobertura, modalidad y
            responsable declarados.
          </p>
          <div className={styles.acciones}>
            <button className="tg-button tg-button--primary" onClick={onVerServiciosPublicados}>
              Ver servicios publicados
            </button>
            <button className="tg-button tg-button--secondary" onClick={publicar}>
              Publicar un servicio
            </button>
          </div>
          <div className={styles.prueba}>
            {PRUEBA.map(([titulo, texto]) => (
              <div key={titulo}>
                <strong>{titulo}</strong>
                <span>{texto}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`tg-container ${styles.operaciones}`} aria-labelledby="titulo-servicios-activos">
        <div className={styles.encabezadoDeSeccion}>
          <div>
            <p className="tg-eyebrow">Oferta disponible</p>
            <h2 id="titulo-servicios-activos">Servicios activos</h2>
          </div>
          <button className="tg-button tg-button--tertiary" onClick={onVerServiciosPublicados}>
            Explorar todos
          </button>
        </div>

        {cargando ? (
          /* Sin esqueleto de foto: un servicio no tiene foto en la tarjeta, y
             reservarle el hueco prometería una que no va a llegar. */
          <div className={styles.grilla} aria-busy="true" aria-live="polite">
            <span className="tg-sr-only">Cargando servicios</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.esqueleto} aria-hidden="true">
                <div className={styles.esqueletoLinea} />
                <div className={`${styles.esqueletoLinea} ${styles.esqueletoCorta}`} />
                <div className={styles.esqueletoLinea} />
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
            <p>Todavía no hay servicios publicados.</p>
            <button className="tg-button tg-button--secondary" onClick={publicar}>
              Publicar un servicio
            </button>
          </div>
        ) : (
          <div className={styles.grilla}>
            {operaciones.map((servicio) => (
              <ProductCard
                key={servicio.id}
                product={servicio}
                variante="compacta"
                onSolicitarCotizacion={onNavigateToContact}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.decision} aria-labelledby="titulo-comparar">
        <div className={`tg-container ${styles.decisionGrilla}`}>
          <div className={styles.decisionIntro}>
            <p className="tg-eyebrow">Comparación útil</p>
            <h2 id="titulo-comparar">Qué mirar antes de cotizar.</h2>
          </div>
          {COMPARACION.map(([titulo, texto]) => (
            <div key={titulo} className={styles.decisionItem}>
              <strong>{titulo}</strong>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`tg-container ${styles.cta}`} aria-labelledby="titulo-ofrecer">
        <div className={styles.ctaInterior}>
          <div>
            <h2 id="titulo-ofrecer">¿Prestás un servicio para el agro?</h2>
            <p>
              Indicá cobertura, modalidad y responsable para que la propuesta pueda compararse.
            </p>
          </div>
          <div className={styles.acciones}>
            <button className="tg-button tg-button--primary" onClick={publicar}>
              Publicar un servicio
            </button>
            <button className="tg-button tg-button--secondary" onClick={onVerServiciosPublicados}>
              Ver servicios
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
