import React from 'react';
import styles from './Footer.module.css';

interface FooterProps {
  onNavigate?: (section: 'home' | 'services' | 'about' | 'contact') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear();

  const handleNavigate = (section: 'home' | 'services' | 'about' | 'contact') => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(section);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerSection}>
          <h3>Sitio web</h3>
          <ul>
            <li><a href="#" onClick={handleNavigate('home')}>Home</a></li>
            <li><a href="#" onClick={handleNavigate('services')}>Servicios</a></li>
            <li><a href="#" onClick={handleNavigate('about')}>Quienes somos</a></li>
            <li><a href="#" onClick={handleNavigate('contact')}>Contacto</a></li>
          </ul>
        </div>

        <div className={styles.footerSection}>
          <h3>Servicios</h3>
          <ul>
            <li><a href="#" onClick={handleNavigate('services')}>Asesoramiento en Mecanización</a></li>
            <li><a href="#" onClick={handleNavigate('services')}>Análisis Ambiental y Satelital</a></li>
            <li><a href="#" onClick={handleNavigate('services')}>Monitoreo con IA</a></li>
          </ul>
        </div>

        <div className={styles.footerSection}>
          <h3>Contacto</h3>
          <ul>
            <li><a href="mailto:info@topgreen.com.ar">info@topgreen.com.ar</a></li>
            <li>Mar del Plata, Argentina</li>
            <li><a href="tel:+5492233485801">+54 9 223 348 5801</a></li>
            <li><a href="https://wa.me/5492233485801" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
          </ul>
        </div>

        {/* Acá había tres enlaces a «redes»: apuntaban a twitter.com,
            linkedin.com e instagram.com, o sea a las plataformas y no a una
            cuenta de TopGreen. Un enlace que no lleva a nuestro perfil no es
            una red social nuestra: es un botón que promete algo que no existe.
            Cuando haya URLs reales, vuelven. */}
      </div>

      <div className={styles.footerBottom}>
        <p>© {currentYear} TopGreen. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};
