import React from 'react';
import styles from './AboutPage.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ProductImage } from '../ProductImage/ProductImage';

interface AboutPageProps {
  onNavigateToMarketplace?: () => void;
  /** Publicar desde esta pantalla.
   *
      Una sola función y no el par «abrí el formulario» / «abrí el Login»: quién
      de los dos corresponde lo decide la sesión, no la página. Sin sesión abre
      el ingreso y retoma el formulario recién si la persona entra; cancelar o
      fallar no abre nada. Es la MISMA puerta que usan Inicio, Servicios y una
      tarjeta sin sesión.

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

      {/* Nuestro Equipo Section */}
      <section className={styles.teamSection}>
        <div className={styles.container}>
          <h2 className={styles.teamTitle}>Nuestro equipo</h2>
          
          {/* Mercedes Raiz */}
          <div className={styles.teamMember}>
            <div className={styles.memberPhoto}>
              <ProductImage
                src="/MercedesRaiz.jpg"
                alt="Ingeniera Mercedes Raiz"
                className={styles.memberImage}
              />
            </div>
            <div className={styles.memberInfo}>
              <h3 className={styles.memberName}>Ingeniera Mercedes Raiz</h3>
              <p className={styles.memberRole}>Fundadora y Directora Técnica</p>
              <p className={styles.memberDescription}>
                Como ingeniera en Mecanización de la Producción Agropecuaria, lidero un 
                equipo dedicado a transformar la eficiencia en cada etapa de la producción 
                agrícola. Mi experiencia en la selección y uso de maquinaria agrícola y el 
                asesoramiento especializado en cada etapa del ciclo productivo ayuda a 
                nuestros clientes a maximizar el rendimiento de sus equipos, asegurando 
                que cada tarea se realice con la máxima eficiencia y precisión con apoyo y 
                seguimiento de inteligencia artificial que garantizan soluciones adaptadas 
                a las necesidades específicas de cada cliente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <h2>¿Listo para transformar tu producción?</h2>
          <p>Únete a AgroBoeda y accede a las mejores soluciones tecnológicas para el agro</p>
          <div className={styles.ctaButtons}>
            <button className={styles.ctaPrimary} onClick={handleStartSelling}>
              Comenzar a Vender
            </button>
            <button className={styles.ctaSecondary} onClick={onNavigateToMarketplace}>
              Explorar Productos
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
