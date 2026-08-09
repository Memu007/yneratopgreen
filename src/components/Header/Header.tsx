import React, { useState } from 'react';
import styles from './Header.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { CartButton } from '../Cart/CartModal';
import { UserDashboard } from '../UserDashboard/UserDashboard';

type PageSection = 'home' | 'marketplace' | 'about' | 'services' | 'contact' | 'payment-success' | 'payment-failure' | 'payment-pending';

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
  const [showDashboard, setShowDashboard] = useState(false);

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
