import React from 'react';
import styles from './HomePage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

interface HomePageProps {
  onNavigateToMarketplace: () => void;
  onNavigateToContact?: () => void;
  onNavigateToServices?: () => void;
  onPublishClick?: () => void;
  onLoginClick?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateToMarketplace, onNavigateToServices, onPublishClick, onLoginClick }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const handlePublishClick = () => {
    if (!user) {
      showToast('Debes iniciar sesión para publicar productos', 'warning');
      if (onLoginClick) {
        onLoginClick();
      }
    } else {
      if (onPublishClick) {
        onPublishClick();
      }
    }
  };

  return (
    <div className={styles.homePage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Bienvenido a <span className={styles.brandName}>TopGreen</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Mercado agro: productos, servicios y logística
          </p>
          <p className={styles.heroDescription}>
            Conectamos productores, comercializadores y profesionales del sector
            agropecuario en un mismo lugar.
          </p>
          <button className={styles.ctaButton} onClick={onNavigateToMarketplace}>
            Ver el mercado
          </button>
        </div>
      </section>

      {/* Categories Section eliminada (v1.9.5):
          La Home ya no muestra "Categorías Destacadas".
          Las categorías siguen funcionando dentro de AgroMarket. */}

      {/* Benefits Section */}
      <section className={styles.benefitsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>¿Por qué elegir TopGreen?</h2>
          <div className={styles.benefitsGrid}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIconGrid}>
                <div className={styles.gridIcon}>
                  <span></span><span></span><span></span>
                  <span></span><span></span><span></span>
                  <span></span><span></span><span></span>
                </div>
              </div>
              <h3>TECNOLOGÍA</h3>
              <p>Analizamos de manera exhaustiva las condiciones ambientales mediante el uso de tecnologías asistidas por inteligencia artificial. Nos enfocamos en optimizar cada etapa del proceso productivo, garantizando una agricultura más eficiente, sostenible y adaptada a las necesidades actuales.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIconGrid}>
                <div className={styles.gridIcon}>
                  <span></span><span></span><span></span>
                  <span></span><span></span><span></span>
                  <span></span><span></span><span></span>
                </div>
              </div>
              <h3>MECANIZACIÓN</h3>
              <p>Implementamos la maquinaria y tecnologías vinculantes para maximizar la eficiencia de acuerdo a la escala productiva. Ofrecemos asesoramiento especializado para seleccionar el equipamiento más adecuado en cada fase de la producción, ofresiendo así una herramienta para gestinar la productividad y un aprovechamiento óptimo de los recursos.</p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitIconGrid}>
                <div className={styles.gridIcon}>
                  <span></span><span></span><span></span>
                  <span></span><span></span><span></span>
                  <span></span><span></span><span></span>
                </div>
              </div>
              <h3>CONFIANZA</h3>
              <p>Confía en nuestra experiencia y dedicación. Nuestro servicio está respaldado por alianzas con empresas líderes del sector, ofreciendo calidad, eficiencia y resultados que esten a la altura de las expectativas. Estamos comprometidos con una planificación en relación a las condiciones reales para la efectividad de la gestión productiva.</p>
            </div>
          </div>
          
          <div className={styles.servicesButtonWrapper}>
            <button className={styles.servicesButton} onClick={onNavigateToServices}>
              Ver nuestros servicios
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <h2>¿Sos productor o comerciante?</h2>
          <p>Comenzá a vender tus productos en TopGreen</p>
          <button className={styles.secondaryButton} onClick={handlePublishClick}>
            Publicar Producto
          </button>
        </div>
      </section>
    </div>
  );
};
