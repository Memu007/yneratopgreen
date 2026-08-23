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

// Las secciones que existen de verdad. No se agregan destinos inventados: la
// navegación es un contrato con lo que la aplicación sabe abrir. «Mercado» es
// nueva en la barra pero no es un destino nuevo: hasta ahora la única forma de
// volver al catálogo era hacer clic en la marca.
const SECCIONES: [PageSection, string][] = [
  ['home', 'Inicio'],
  ['marketplace', 'Mercado'],
  ['services', 'Servicios'],
  ['about', 'Quiénes somos'],
  ['contact', 'Contacto'],
];

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
      <div className={`tg-container ${styles.masthead}`}>
        {/* El wordmark es un archivo, no letras compuestas a mano: su dibujo
            está convertido a contornos, así que no depende de que la fuente
            haya cargado. El nombre accesible es «TopGreen» y nada más. */}
        <button className={styles.marca} onClick={() => onNavigate('marketplace')}>
          <img src="/marca/topgreen-compact.svg" alt="TopGreen" width={431} height={112} />
        </button>

        {/* La búsqueda vive donde hay resultados que filtrar. En las otras
            secciones no hay grilla, así que un buscador ahí sería un control
            que parece hacer algo y no hace nada. */}
        {currentSection === 'marketplace' && (
          <form className={styles.buscador} onSubmit={handleSubmit} role="search">
            <label className="tg-sr-only" htmlFor="buscar-mercado">
              Buscar en el mercado
            </label>
            <input
              id="buscar-mercado"
              type="search"
              className={styles.buscadorCampo}
              placeholder="Buscar producto, servicio o ubicación"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <button type="submit" className={`tg-button tg-button--primary ${styles.buscadorBoton}`}>
              Buscar
            </button>
          </form>
        )}

        <div className={styles.acciones}>
          {isAuthenticated && user?.role === 'admin' && onAdminClick && (
            <button className="tg-button tg-button--secondary" onClick={onAdminClick}>
              Admin
            </button>
          )}
          {isAuthenticated && (
            <button className="tg-button tg-button--primary" onClick={onSellClick}>
              Vender
            </button>
          )}
          {isAuthenticated ? (
            <>
              <CartButton onClick={onCartClick} />
              {/* El nombre propio no sirve como etiqueta: cambia con cada
                  cuenta. La etiqueta dice qué abre el botón. */}
              <button
                className={`tg-button tg-button--secondary ${styles.cuenta}`}
                aria-label="Mi cuenta"
                onClick={() => setShowDashboard(true)}
              >
                {user?.name}
              </button>
              <button className="tg-button tg-button--tertiary" onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <button className="tg-button tg-button--secondary" onClick={onLoginClick}>
              Ingresar
            </button>
          )}
        </div>
      </div>

      <nav className={styles.nav} aria-label="Secciones del sitio">
        <div className={`tg-container ${styles.navInterior}`}>
          {SECCIONES.map(([seccion, texto]) => (
            <button
              key={seccion}
              className={styles.navLink}
              aria-current={currentSection === seccion ? 'page' : undefined}
              onClick={() => onNavigate(seccion)}
            >
              {texto}
            </button>
          ))}
        </div>
      </nav>

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
