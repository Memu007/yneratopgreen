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
        {/* Primera fila: quiénes somos, qué se busca y qué se puede hacer.
            Es el orden de un marketplace y no el de un panel: antes la marca
            era un botón más, perdido entre las acciones. */}
        <div className={styles.barraSuperior}>
          <div className={styles.marca}>
            {/* La bajada va AFUERA del botón a propósito: lo clickeable es el
                nombre, y su nombre accesible queda siendo «TopGreen» y nada más. */}
            <button
              className={styles.marcaNombre}
              onClick={() => onNavigate('marketplace')}
            >
              Top<span className={styles.marcaVerde}>Green</span>
            </button>
            <span className={styles.marcaBajada}>Marketplace agro</span>
          </div>

          {/* La búsqueda vive donde hay resultados que filtrar. En las otras
              secciones no hay grilla, así que un buscador ahí sería un control
              que parece hacer algo y no hace nada. */}
          {currentSection === 'marketplace' && (
            <form className={styles.buscador} onSubmit={handleSubmit} role="search">
              <input
                type="search"
                className={styles.buscadorCampo}
                placeholder="Buscar productos, semillas, maquinaria..."
                aria-label="Buscar en el marketplace"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              <button type="submit" className={styles.buscadorBoton}>
                Buscar
              </button>
            </form>
          )}

          <div className={styles.acciones}>
            {isAuthenticated && user?.role === 'admin' && onAdminClick && (
              <button className={styles.accionSecundaria} onClick={onAdminClick}>
                Admin
              </button>
            )}
            {isAuthenticated && (
              <button className={styles.accionPrincipal} onClick={onSellClick}>
                Vender
              </button>
            )}
            {isAuthenticated ? (
              <>
                <CartButton onClick={onCartClick} />
                <div className={styles.menuDeCuenta}>
                  {/* El nombre propio no sirve como etiqueta: cambia con cada
                      cuenta. La etiqueta dice qué abre el botón. */}
                  <button
                    className={styles.cuenta}
                    aria-label="Mi cuenta"
                    onClick={() => setShowDashboard(true)}
                  >
                    {user?.name}
                  </button>
                  <button className={styles.accionSecundaria} onClick={logout}>
                    Salir
                  </button>
                </div>
              </>
            ) : (
              <button className={styles.accionSecundaria} onClick={onLoginClick}>
                Ingresar
              </button>
            )}
          </div>
        </div>

        {/* Segunda fila: las secciones institucionales, que no compiten con la
            marca ni con la búsqueda. */}
        <nav className={styles.nav} aria-label="Secciones del sitio">
          {([
            ['home', 'Home'],
            ['about', 'Quienes Somos'],
            ['services', 'Servicios'],
            ['contact', 'Contacto'],
          ] as [PageSection, string][]).map(([seccion, texto]) => (
            <button
              key={seccion}
              className={currentSection === seccion ? styles.navLinkActive : styles.navLink}
              onClick={() => onNavigate(seccion)}
            >
              {texto}
            </button>
          ))}
        </nav>
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
