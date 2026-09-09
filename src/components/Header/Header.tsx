import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';
import { useAuth } from '../../hooks/useAuth';
import { CartButton } from '../Cart/CartModal';
import { useNavegacionActual } from '../../navegacion/navegacion';
import type { Seccion } from '../../navegacion/politica';
import { useToast } from '../../hooks/useToast';
import { explicarMP, resultadoDeMercadoPago } from '../../utils/mercadoPago';

// El tipo de secciones sale de la política y no se copia acá: esta lista
// paralela ya se quedó atrás una vez —no tenía `account`— y una copia que
// envejece es exactamente lo que la política vino a evitar.
type PageSection = Seccion;

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
// navegación es un contrato con lo que la aplicación sabe abrir. «Mercado» fue
// nueva en la barra pero no es un destino nuevo: antes la única forma de volver
// al catálogo era hacer clic en la marca. Desde que ese destino tiene su propia
// celda, la marca hace lo que hace en cualquier sitio: vuelve a Inicio.
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
  // Salir de la sesión no es ir a una sección, pero es una salida igual: pasa
  // por la misma guardia que la cabecera y el pie.
  const { pedirSalida } = useNavegacionActual();
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
    // Antes esto abría el modal. El modal ya no está: se navega al área de
    // cuenta, que es una sección con URL propia, así que la vuelta de Mercado
    // Pago queda en un lugar que se puede recargar y compartir.
    onNavigate('account');
    setVueltaDeMP(false);
  }, [vueltaDeMP, isAuthenticated, onNavigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  // Una sola cabecera y una sola primera banda: marca, las cinco secciones y
  // las acciones de la sesion, iguales en Inicio, en Servicios y en el Mercado.
  // Lo unico que cambia al entrar al Mercado es que aparece una segunda banda
  // con el buscador, debajo. La identidad de arriba no se mueve.
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
    <header className={styles.header}>
      <div className={`tg-sobre-marca ${styles.masthead}`}>
        {/* El activo oficial es el MONOGRAMA AB, no el nombre completo, así que
            va acompañado por «AgroBoeda» escrito. La imagen lleva `alt` vacío a
            propósito: al lado del nombre es decorativa, y con texto alternativo
            el botón se llamaría «AgroBoeda AgroBoeda». El monograma viene
            con fondo transparente de verdad: no se le finge con una máscara ni
            se le recolorea nada, el fondo de la fuente se separa despejando la
            mezcla en `scripts/derivar_marca.py`. */}
        <button className={styles.marca} onClick={() => onNavigate('home')}>
          <img
            className={styles.monograma}
            src="/marca/agroboeda-monograma-alfa.png"
            alt=""
            width={320}
            height={197}
          />
          <span className={styles.nombre}>AgroBoeda</span>
        </button>

        {/* La sesión crece por celdas: cada acción que suma el rol entra como
            una celda más con su propio separador, y el cereal queda reservado
            a la acción comercial —Vender—.

            Va antes que la navegación en el documento, y no después, porque el
            orden de lectura es el mismo en los tres anchos: identidad y sesión
            primero, destinos después, búsqueda al final. En celular y en tablet
            eso además coincide renglón por renglón con lo que se ve. */}
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
                aria-current={currentSection === 'account' ? 'page' : undefined}
                onClick={() => onNavigate('account')}
              >
                <span className={styles.soloEscritorio}>{user?.name}</span>
                <span className={styles.soloMovil}>Cuenta</span>
              </button>
              {/* Se navega ANTES de cerrar la sesión: si se hiciera al revés,
                  Mi cuenta se quedaría un instante sin usuario y el guardián
                  de la sección mandaría a ingresar a quien acaba de salir. */}
              <button
                className={styles.celda}
                onClick={() => pedirSalida(() => {
                  onNavigate('home');
                  logout();
                })}
              >
                Salir
              </button>
            </>
          ) : (
            <button className={styles.celda} onClick={onLoginClick}>
              Ingresar
            </button>
          )}
        </div>

        {navegacion}
      </div>

      {/* La búsqueda vive donde hay resultados que filtrar, y en su propia
          banda: en las otras secciones no hay grilla, así que un buscador ahí
          sería un control que parece hacer algo y no hace nada. Va debajo de la
          primera banda y no adentro, para no correr de lugar ni la marca ni las
          secciones ni las acciones al cambiar de pantalla. */}
      {enMercado && (
        <div className={`tg-sobre-marca ${styles.bandaDeBusqueda}`}>
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
        </div>
      )}

    </header>
  );
};
