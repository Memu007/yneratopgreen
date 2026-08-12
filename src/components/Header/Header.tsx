import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { CartButton } from '../Cart/CartModal';
import { UserDashboard } from '../UserDashboard/UserDashboard';
import { useToast } from '../Toast/Toast';
import { explicarMP, resultadoDeMercadoPago } from '../../utils/mercadoPago';

type PageSection = 'home' | 'marketplace' | 'about' | 'services' | 'contact' | 'payment-success' | 'payment-failure' | 'payment-pending' | 'verificar-correo';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onLoginClick: () => void;
  onCartClick: () => void;
  onSellClick: () => void;
  onAdminClick?: () => void;
  currentSection: PageSection;
  onNavigate: (section: PageSection) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  onSearchChange, 
  onSearchSubmit,
  onLoginClick,
  onCartClick,
  onSellClick,
  onAdminClick,
  currentSection,
  onNavigate,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();
  const [showDashboard, setShowDashboard] = useState(false);
  const [vueltaDeMP, setVueltaDeMP] = useState(false);

  // La vuelta de Mercado Pago aterriza en una carga nueva de la página, con el
  // panel cerrado. Se recibe acá, que es lo que siempre está montado: si se
  // atendiera en el panel, el vendedor volvería a la portada sin enterarse de
  // si su cuenta quedó vinculada o no.
  useEffect(() => {
    const resultado = resultadoDeMercadoPago();
    if (!resultado) return;

    if (resultado.vinculado) {
      showToast('Tu cuenta de Mercado Pago quedó vinculada.', 'success');
    } else {
      showToast(explicarMP(resultado.motivo), 'error');
    }
    setVueltaDeMP(true);
  }, []);

  // Y se lo devuelve a donde estaba, pero recién cuando la sesión terminó de
  // restaurarse: al montar todavía no se sabe quién es. Si resulta que no hay
  // sesión —que es justamente el caso `sin_sesion`— no se abre nada, porque el
  // panel sin usuario no tiene qué mostrar; el aviso ya dijo qué hacer.
  useEffect(() => {
    if (!vueltaDeMP || !isAuthenticated) return;
    setShowDashboard(true);
    setVueltaDeMP(false);
  }, [vueltaDeMP, isAuthenticated]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.headerContent}>
          <nav className={styles.nav}>
            <button
              className={currentSection === 'home' ? styles.navLinkActive : styles.navLink}
              onClick={() => onNavigate('home')}
            >
              Home
            </button>
            <button
              className={currentSection === 'about' ? styles.navLinkActive : styles.navLink}
              onClick={() => onNavigate('about')}
            >
              Quienes Somos
            </button>
            <button
              className={currentSection === 'services' ? styles.navLinkActive : styles.navLink}
              onClick={() => onNavigate('services')}
            >
              Servicios
            </button>
            <button
              className={currentSection === 'contact' ? styles.navLinkActive : styles.navLink}
              onClick={() => onNavigate('contact')}
            >
              Contacto
            </button>
          </nav>

          {currentSection === 'marketplace' && (
            <form className={styles.searchBar} onSubmit={handleSubmit}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Buscar productos, semillas, maquinaria..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              <button type="submit" className={styles.searchButton}>
                Buscar
              </button>
            </form>
          )}

          <div className={styles.actions}>
            {isAuthenticated && user?.role === 'admin' && onAdminClick && (
              <button className={styles.adminButton} onClick={onAdminClick}>
                ⚙️ Admin
              </button>
            )}
            {isAuthenticated && (
              <button className={styles.sellButton} onClick={onSellClick}>
                📦 Vender
              </button>
            )}
            {isAuthenticated ? (
              <>
                <button
                  className={currentSection === 'marketplace' ? styles.navLinkActive : styles.marketplaceButton}
                  onClick={() => onNavigate('marketplace')}
                >
                  TopGreen
                </button>
                <CartButton onClick={onCartClick} />
                <div className={styles.userMenu}>
                  <button className={styles.userNameButton} onClick={() => setShowDashboard(true)}>
                    👤 {user?.name}
                  </button>
                  <button className={styles.actionButton} onClick={logout}>
                    Salir
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className={styles.actionButton} onClick={onLoginClick}>
                  Ingresar
                </button>
                <button
                  className={currentSection === 'marketplace' ? styles.navLinkActive : styles.marketplaceButton}
                  onClick={() => onNavigate('marketplace')}
                >
                  TopGreen
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showDashboard && (
        <UserDashboard 
          onClose={() => setShowDashboard(false)} 
          onPublishClick={() => {
            setShowDashboard(false);
            onSellClick();
          }}
        />
      )}
    </header>
  );
};
