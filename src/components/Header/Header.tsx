import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';
import { useAuth } from '../../hooks/useAuth';
import { CartButton } from '../Cart/CartModal';
import { UserDashboard } from '../UserDashboard/UserDashboard';
import { useToast } from '../../hooks/useToast';
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

// El punto de corte contractual de celular, leído una sola vez y escuchado.
// Se usa para lo único que el CSS no puede resolver: el texto de un
// `placeholder` es un atributo, no contenido, y no se puede reescribir con una
// media query. Todo lo demás que cambia en celular lo decide la hoja.
const CONSULTA_MOVIL = '(max-width: 599px)';

function useEsMovil(): boolean {
  const [esMovil, setEsMovil] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(CONSULTA_MOVIL).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia(CONSULTA_MOVIL);
    const alCambiar = () => setEsMovil(consulta.matches);
    alCambiar();
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return esMovil;
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
  const esMovil = useEsMovil();

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
    // `showToast` está memorizado en su proveedor con dependencias vacías:
    // su identidad no cambia, así que declararlo no hace que el efecto
    // vuelva a correr. Omitirlo era esconderle a la herramienta que el
    // efecto lo usa.
  }, [showToast]);

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

  // Dos cabeceras, no dos componentes: el mercado necesita el buscador
  // dominante y la navegacion en una segunda banda; el resto de las paginas
  // publicas entra en una sola banda compacta. La sesion, los roles, el
  // carrito y la vuelta de Mercado Pago son los mismos en las dos.
  const enMercado = currentSection === 'marketplace';

  const navegacion = (
    <nav className={styles.navInterior} aria-label="Secciones del sitio">
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
    </nav>
  );

  return (
    <header className={`${styles.header} ${enMercado ? styles.headerMercado : styles.headerCompacto}`}>
      <div className={`tg-sobre-marca ${styles.masthead}`}>
        {/* El wordmark es un archivo, no letras compuestas a mano: su dibujo
            está convertido a contornos, así que no depende de que la fuente
            haya cargado. Sobre la banda verde va la versión monocroma clara;
            el nombre accesible es «TopGreen» y nada más. */}
        <button className={styles.marca} onClick={() => onNavigate('marketplace')}>
          <img src="/marca/topgreen-mono-light.svg" alt="TopGreen" width={555} height={110} />
        </button>

        {/* La búsqueda vive donde hay resultados que filtrar. En las otras
            secciones no hay grilla, así que un buscador ahí sería un control
            que parece hacer algo y no hace nada. */}
        {enMercado && (
          <form className={styles.buscador} onSubmit={handleSubmit} role="search">
            <label className="tg-sr-only" htmlFor="buscar-mercado">
              Buscar en el mercado
            </label>
            <input
              id="buscar-mercado"
              type="search"
              className={styles.buscadorCampo}
              /* En 390 px el texto descriptivo no entra y se corta a la mitad
                 de una palabra. La instrucción corta dice lo mismo y cabe; la
                 etiqueta, que es lo que lee un lector de pantalla, no cambia. */
              placeholder={esMovil ? 'Buscar' : 'Buscar producto, servicio o ubicación'}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <button type="submit" className={styles.buscadorBoton}>
              Buscar
            </button>
          </form>
        )}

        {!enMercado && navegacion}

        {/* La sesión crece por celdas: cada acción que suma el rol entra como
            una celda más con su propio separador, y el cereal queda reservado
            a la acción comercial —Vender—. */}
        <div className={styles.acciones}>
          {isAuthenticated && user?.role === 'admin' && onAdminClick && (
            <button className={styles.celda} onClick={onAdminClick}>
              Admin
            </button>
          )}
          {isAuthenticated && (
            <button className={`${styles.celda} ${styles.celdaVender}`} onClick={onSellClick}>
              Vender
            </button>
          )}
          {isAuthenticated ? (
            <>
              <CartButton onClick={onCartClick} className={styles.celda} />
              {/* El nombre propio no sirve como etiqueta: cambia con cada
                  cuenta. La etiqueta dice qué abre el botón. En escritorio se
                  muestra el nombre real; en celular se muestra «Cuenta»
                  porque un nombre variable no entra sin cortarse. */}
              <button
                className={`${styles.celda} ${styles.cuenta}`}
                aria-label="Mi cuenta"
                onClick={() => setShowDashboard(true)}
              >
                <span className={styles.soloEscritorio}>{user?.name}</span>
                <span className={styles.soloMovil}>Cuenta</span>
              </button>
              <button className={styles.celda} onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <button className={styles.celda} onClick={onLoginClick}>
              Ingresar
            </button>
          )}
        </div>
      </div>

      {enMercado && (
        <div className={styles.nav}>
          <div className="tg-container">{navegacion}</div>
        </div>
      )}

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
