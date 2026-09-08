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
          {/* El monograma oficial con el nombre al lado, igual que en la
              cabecera: el archivo dice AB y el nombre lo dice entero. La imagen
              va con `alt` vacío porque el nombre está escrito a su lado, así el
              control se anuncia «AgroBoeda» una sola vez.

              Es un botón y no un `div`: acá la marca vuelve a Inicio igual que
              la de la cabecera, y una marca que navega tiene que poder
              activarse con el teclado. Usa `handleNavigate`, la misma
              navegación que el resto del pie, que además deja la página
              arriba. */}
          <button type="button" className={styles.marca} onClick={handleNavigate('home')}>
            <img
              className={styles.monograma}
              src="/marca/agroboeda-monograma-alfa.png"
              alt=""
              width={320}
              height={197}
            />
            <span className={styles.nombre}>AgroBoeda</span>
          </button>
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
          <div className={styles.titulo}>AgroBoeda</div>
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
            cuenta de AgroBoeda. Un enlace que no lleva a nuestro perfil no es
            una red social nuestra: es un botón que promete algo que no existe.
            Cuando haya URLs reales, vuelven.

            Y la columna de «Servicios» ya no lista tres nombres sueltos:
            eran títulos que no correspondían a ninguna publicación ni a
            ninguna ancla de la página de Servicios. */}
      </div>

      <div className={`tg-container ${styles.legal}`}>
        <p>© {currentYear} AgroBoeda. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};
