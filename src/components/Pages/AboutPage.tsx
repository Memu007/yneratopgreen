import React from 'react';
import styles from './AboutPage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

interface AboutPageProps {
  onNavigateToMarketplace?: () => void;
  /** Publicar desde esta pantalla.
   *
      Una sola función y no el par «abrí el formulario» / «abrí el Login»: quién
      de los dos corresponde lo decide la sesión, no la página. Sin sesión abre
      el ingreso y retoma el formulario recién si la persona entra; cancelar o
      fallar no abre nada. Es la MISMA puerta que usan Inicio y una tarjeta
      sin sesión.

      Acá llegó último: esta pantalla conservaba el ingreso sin continuidad —y
      sin decir por qué aparecía— cuando las otras dos ya lo habían dejado. */
  onSolicitarPublicar?: () => void;
  onNavigateToContact?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ 
  onNavigateToMarketplace, 
  onSolicitarPublicar,
  onNavigateToContact
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const handleStartSelling = () => {
    // El aviso explica por qué apareció el ingreso; esta pantalla no lo tenía.
    if (!user) showToast('Iniciá sesión para publicar una oferta', 'warning');
    onSolicitarPublicar?.();
  };

  return (
    <div className={styles.aboutPage}>
      {/* Hero Section - Información AgroBoeda */}
      <section className={styles.infoSection}>
        <div className={styles.container}>
          <div className={styles.infoGrid}>
            <div className={styles.infoText}>
              <h1 className={styles.infoTitle}>
                Información<br />
                <span className={styles.brandName}>AgroBoeda</span>
              </h1>
              <p className={styles.infoDescription}>
                Contamos con un equipo de expertos altamente capacitados en las 
                tecnologías con una orientación a la mecanización de la producción 
                agropecuaria. Cada uno de nuestros integrantes aporta una combinación 
                de conocimiento técnico y experiencia en campo, respaldada por 
                estrategias para evaluar permanentemente la eficiencia productiva, control 
                de impacto ambiental y maximización de recursos.
              </p>
              <button 
                className={styles.contactButton}
                onClick={onNavigateToContact}
              >
                Contactanos
              </button>
            </div>
            <div className={styles.infoMedia}>
              <div className={styles.videoContainer}>
                <video 
                  src="/video-topgreen.mp4" 
                  className={styles.heroVideo}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Misión y Visión Section */}
      <section className={styles.missionVisionSection}>
        <div className={styles.missionVisionOverlay}></div>
        <div className={styles.container}>
          <div className={styles.missionVisionGrid}>
            <div className={styles.missionCard}>
              <div className={styles.cardAccent}></div>
              <h2>Misión</h2>
              <p>
                En AgroBoeda, nuestra misión es impulsar la innovación en la producción
                agropecuaria a través de la mecanización avanzada y el uso de tecnologías 
                de vanguardia. Nos comprometemos a ofrecer soluciones eficientes, 
                sostenibles y adaptadas a las necesidades de nuestros clientes, mejorando 
                cada etapa del proceso productivo para maximizar el rendimiento y 
                minimizar el impacto ambiental.
              </p>
            </div>
            <div className={styles.visionCard}>
              <div className={styles.cardAccent}></div>
              <h2>Visión</h2>
              <p>
                Nuestra visión es ser líderes en el campo de la mecanización agropecuaria, 
                reconocidos por nuestra capacidad para integrar tecnología y experiencia, 
                convirtiéndonos en el socio estratégico de confianza para agricultores y 
                empresas que buscan optimizar sus operaciones y alcanzar un futuro más 
                sostenible en la agricultura.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* «Nuestro equipo» salió por ahora (la clienta, 20/09). */}

      {/* La invitación a publicar o buscar. Estaba también al final de Inicio
          —el bloque que se repetía entre pestañas (la clienta, 20/09)— y
          queda sólo acá, donde es el único camino al Mercado de la página.
          Decía «¿Listo para transformar tu producción?», que prometía de más
          (la clienta, 20/09). */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <h2>Publicá o buscá en el Mercado agropecuario</h2>
          <p>Publicá un equipo, un insumo o un servicio, o buscá lo que necesitás.</p>
          <div className={styles.ctaButtons}>
            <button className={styles.ctaPrimary} onClick={handleStartSelling}>
              Publicar una oferta
            </button>
            <button className={styles.ctaSecondary} onClick={onNavigateToMarketplace}>
              Ir al Mercado
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
