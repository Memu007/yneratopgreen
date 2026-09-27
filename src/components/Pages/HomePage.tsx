import React from 'react';
import styles from './HomePage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import type { VistaPrevia } from '../../hooks/useVistaPrevia';

interface HomePageProps {
  onNavigateToMarketplace: () => void;
  /** Publicar desde esta pantalla.
   *
      Es una sola función y no el par «abrí el formulario» / «abrí el Login»,
      porque quién de los dos corresponde no lo decide la página: lo decide la
      sesión, y la página lo sabría un instante antes de que el ingreso la
      cambie. Sin sesión abre el ingreso y retoma el formulario recién si la
      persona entra; cancelar o fallar no abre nada. Es la MISMA puerta que usa
      una tarjeta sin sesión. */
  onSolicitarPublicar?: () => void;
  /** El total del mismo catálogo que el mercado. Inicio no muestra
      publicaciones (la clienta, 20/09): sólo cuántas hay. */
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

/** El número de renglón del libro mayor: `01`, `02`, `03`, `04`. */
const renglon = (indice: number) => String(indice + 1).padStart(2, '0');

/** Lo que muestra cada publicación, para poder compararla con otra.
 *
 *  Describe lo que la plataforma muestra, no lo que hay que hacer (la
 *  clienta, 20/09): precio y modalidad van juntos porque no se excluyen, el
 *  radio del transportista se nombra porque no lo encontraba, y no se
 *  anuncia como virtud lo que tiene que ser lo mínimo. */
const DECISION: [string, string][] = [
  ['Precio y modalidad', 'El precio, su unidad y, en los servicios, cómo se cobra. Sin precio publicado, se pide cotización.'],
  ['Ubicación y alcance', 'La localidad de la publicación, la cobertura de un servicio y el radio de alcance de cada transportista.'],
  ['Quién publica y qué se puede hacer', 'El nombre y la reputación de quien publica, y la acción disponible: agregar al carrito, contratar o pedir cotización.'],
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToMarketplace,
  onSolicitarPublicar,
  vistaPrevia,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const handlePublishClick = () => {
    // El aviso sólo explica por qué apareció el ingreso; lo que pasa después no
    // se decide acá. Y lo dice en la lengua del sitio: «Debes iniciar sesión»
    // era el tuteo que quedaba en este camino, con el resto ya en voseo.
    if (!user) showToast('Iniciá sesión para publicar una oferta', 'warning');
    onSolicitarPublicar?.();
  };

  const { total } = vistaPrevia;

  return (
    <div className={styles.pagina}>
      <section className={styles.hero} aria-labelledby="titulo-inicio">
        {/* El margen del libro: una regla vertical con el rótulo de la página.
            Es ornamento del sistema y no información nueva, así que no se
            anuncia dos veces y desaparece en celular. */}
        <div className={styles.margen} aria-hidden="true">
          <span>Mercado agropecuario · Argentina</span>
        </div>
        <div className={styles.heroCopy}>
          <p className="tg-eyebrow">Mercado agropecuario · Argentina</p>
          <h1 id="titulo-inicio" className={styles.heroTitulo}>
            Equipos, insumos y servicios para seguir produciendo.
          </h1>
          <p className="tg-lead">
            Publicaciones con precio y modalidad, ubicación y quién publica.
          </p>
          {/* El único acceso al Mercado de esta página (la clienta, 20/09): la
              sección de publicaciones y la invitación del final se fueron. */}
          <div className={styles.acciones}>
            <button className="tg-button tg-button--primary" onClick={onNavigateToMarketplace}>
              Ir al Mercado
            </button>
            <button className="tg-button tg-button--secondary" onClick={handlePublishClick}>
              Publicar una oferta
            </button>
          </div>
          {/* El número sale de `response.total`, que es lo que la API dice que
              hay. Mientras no se sabe, no se escribe un número provisorio: el
              `30` de la lámina era el dato ilustrativo del prototipo. */}
          {total !== null && (
            <p className={styles.medidor}>
              <span className={`tg-data ${styles.medidorNumero}`}>{total}</span>
              <span className={styles.medidorTexto}>
                {total === 1 ? 'Publicación disponible ahora' : 'Publicaciones disponibles ahora'}
              </span>
              <i className={styles.medidorRegla} aria-hidden="true" />
            </p>
          )}
        </div>
        {/* La fotografía no lleva texto encima ni filtro: ocupa su columna y se
            ve. Debajo va la banda de registro, que dice qué se está mirando sin
            taparlo. Los dos derivados son los únicos autorizados para
            producción. */}
        <figure className={styles.heroFoto}>
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

      <section className={styles.taxonomia} aria-labelledby="titulo-taxonomia">
        <h2 id="titulo-taxonomia" className="tg-sr-only">Tipos de publicación</h2>
        <div className={styles.taxonomiaGrilla}>
          {TAXONOMIA.map(([nombre, descriptor], indice) => (
            <div key={nombre} className={styles.taxonomiaItem}>
              <span className={styles.taxonomiaNumero} aria-hidden="true">{renglon(indice)}</span>
              <strong>{nombre}</strong>
              <span className={styles.taxonomiaDescriptor}>{descriptor}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.decision} aria-labelledby="titulo-datos">
        <div className={`tg-container ${styles.decisionGrilla}`}>
          <div className={styles.decisionIntro}>
            <p className="tg-eyebrow">Para comparar</p>
            <h2 id="titulo-datos">Lo que muestra cada publicación.</h2>
          </div>
          {DECISION.map(([titulo, texto]) => (
            <div key={titulo} className={styles.decisionItem}>
              <strong>{titulo}</strong>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};
