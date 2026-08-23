import React from 'react';
import styles from './Footer.module.css';

interface FooterProps {
  onNavigate?: (section: 'home' | 'marketplace' | 'services' | 'about' | 'contact') => void;
}

type Seccion = 'home' | 'marketplace' | 'services' | 'about' | 'contact';

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear();

  const handleNavigate = (section: Seccion) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(section);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className={styles.footer}>
      <div className={`tg-container ${styles.grilla}`}>
        <div>
          {/* La versión monocroma clara: la única autorizada sobre índigo. */}
          <img
            className={styles.marca}
            src="/marca/topgreen-mono-light.svg"
            alt="TopGreen"
            width={896}
            height={112}
          />
          <p className={styles.bajada}>Mercado agro: productos, servicios y logística.</p>
        </div>

        <div>
          <div className={styles.titulo}>Mercado</div>
          <ul className={styles.lista}>
            <li><a href="#" onClick={handleNavigate('marketplace')}>Publicaciones</a></li>
            <li><a href="#" onClick={handleNavigate('services')}>Servicios</a></li>
          </ul>
        </div>

        <div>
          <div className={styles.titulo}>TopGreen</div>
          <ul className={styles.lista}>
            <li><a href="#" onClick={handleNavigate('home')}>Inicio</a></li>
            <li><a href="#" onClick={handleNavigate('about')}>Quiénes somos</a></li>
            <li><a href="#" onClick={handleNavigate('contact')}>Contacto</a></li>
          </ul>
        </div>

        <div>
          <div className={styles.titulo}>Contacto</div>
          <ul className={styles.lista}>
            <li><a href="mailto:info@topgreen.com.ar">info@topgreen.com.ar</a></li>
            <li><a href="tel:+5492233485801">+54 9 223 348 5801</a></li>
            <li><a href="https://wa.me/5492233485801" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
            <li className={styles.dato}>Mar del Plata, Argentina</li>
          </ul>
        </div>

        {/* Acá había tres enlaces a «redes»: apuntaban a twitter.com,
            linkedin.com e instagram.com, o sea a las plataformas y no a una
            cuenta de TopGreen. Un enlace que no lleva a nuestro perfil no es
            una red social nuestra: es un botón que promete algo que no existe.
            Cuando haya URLs reales, vuelven.

            Y la columna de «Servicios» ya no lista tres nombres sueltos:
            eran títulos que no correspondían a ninguna publicación ni a
            ninguna ancla de la página de Servicios. */}
      </div>

      <div className={`tg-container ${styles.legal}`}>
        <p>© {currentYear} TopGreen. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};
