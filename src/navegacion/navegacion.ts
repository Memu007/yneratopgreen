/**
 * El único lugar del producto que escribe el historial y el único que escucha
 * `popstate`. Todo lo demás pide navegar; nadie más toca `window.history`.
 *
 * Tres reglas y ninguna más:
 *
 * 1. Ir a otra ubicación es una entrada de verdad (`pushState`). Elegir la que
 *    ya está no agrega nada: el historial no se llena de repetidos.
 * 2. Salir de una pantalla de llegada —el correo, la vuelta de Mercado Pago—
 *    REEMPLAZA su entrada: es un resultado que ya se leyó, y volver a él con
 *    Atrás o recargando anuncia de nuevo algo que ya pasó.
 * 3. La ficha de una publicación es una ubicación con URL propia
 *    (`?section=product&id=…`): se comparte, se recarga y entra al historial
 *    como cualquier otra. Antes era una capa sobre la misma URL, y por eso no
 *    se podía mandar ni recargar. Al abrirla, la entrada de la que se sale
 *    anota hasta dónde se había bajado; Atrás vuelve a esa entrada, y la
 *    vista vuelve a ese punto cuando el contenido ya está dibujado.
 *
 * Y una guardia, que llegó con Mi cuenta.
 *
 * Mientras Mi cuenta era un modal, `FORM-DIRTY-1` alcanzaba con proteger su
 * cierre: la X, el fondo y Escape eran las únicas salidas. Como página, las
 * salidas son la cabecera, el pie, Salir y el Atrás del navegador, y ninguna
 * de esas pasa por el componente. Así que la pantalla que tiene trabajo sin
 * guardar registra acá una guardia, y esas salidas preguntan una sola vez
 * antes de irse.
 *
 * El Atrás es el caso incómodo: cuando `popstate` llega, la barra YA se movió.
 * Se deshace el movimiento antes de preguntar —se vuelve a escribir la
 * ubicación que se estaba mirando— y recién ahí se pregunta, para que «seguir
 * editando» conserve pantalla, URL y contenido. Si la respuesta es descartar,
 * se repite el Atrás con la guardia levantada.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

import {
  esPantallaDeLlegada,
  filtrosDeLaBarra,
  publicacionDeLaBarra,
  seccionDeLaBarra,
  urlDe,
  type Seccion,
} from './politica';

/**
 * Lo que la navegación anota en cada entrada del historial. Sólo lo lee y lo
 * escribe este archivo; el resto del estado de la entrada —si lo hubiera— se
 * conserva al reescribirla.
 */
interface EstadoDeLaEntrada {
  /** Desde qué sección se abrió esta ficha. Sin él, la ficha llegó por un
   *  enlace directo y no hay adónde volver con Atrás. */
  origen?: Seccion;
  /** Hasta dónde se había bajado en esta entrada cuando se abrió una ficha. */
  desplazamiento?: number;
  /** Qué ficha se abrió desde esta entrada: al volver, el foco vuelve a su
   *  tarjeta. */
  fichaAbierta?: string;
  /** Con qué enlace de la tarjeta se abrió —el título o «Ver detalle»—: el
   *  foco vuelve a ese mismo. */
  enlaceDeLaFicha?: string;
}

/**
 * Lo que una pantalla con trabajo sin guardar le pide a la navegación: que
 * antes de irse le pregunte. Es la misma política de `FORM-DIRTY-1`, aplicada
 * al límite de la página en vez del de un modal.
 */
export interface GuardiaDeSalida {
  /** ¿Hay algo escrito y sin guardar ahora mismo? */
  hayTrabajoSinGuardar: () => boolean;
  /** Preguntar y, si la persona descarta, ejecutar `seguir`. */
  preguntar: (seguir: () => void) => void;
}

export interface Navegacion {
  /** La sección que declara la barra. */
  seccion: Seccion;
  /** La publicación de la ficha, si la sección es una ficha. */
  publicacion: string | null;
  /** Desde qué sección se abrió la ficha, si se abrió desde el sitio. */
  origenDeLaFicha: Seccion | null;
  /**
   * Cuántas veces movió la barra el historial. Lo que guarda estado leído de
   * la URL —los filtros del Mercado— lo relee cuando esto cambia: sin eso,
   * volver a una entrada mostraría su URL con los controles de otra.
   */
  version: number;
  navegar: (destino: Seccion) => void;
  /** Ir a la ficha de una publicación: una entrada nueva, con su URL. */
  abrirPublicacion: (id: string) => void;
  /** Salir de la ficha. Si se abrió desde el sitio es Atrás —la entrada de
   *  origen ya tiene sus filtros, su página y su desplazamiento—; si llegó
   *  por un enlace directo no hay atrás propio y se va al Mercado. */
  volverDeLaFicha: () => void;
  /**
   * Una salida que no es una sección —Salir de la sesión— pasando por la misma
   * guardia. Sin esto, cerrar sesión con un perfil a medio editar se llevaría
   * el trabajo sin avisar.
   */
  pedirSalida: (seguir: () => void) => void;
  /** La pantalla que tiene trabajo sin guardar se anuncia acá, y se da de baja
   *  al desmontarse. Devuelve la función de baja, para usarla en el efecto. */
  registrarGuardia: (guardia: GuardiaDeSalida) => () => void;
}

const barraActual = () => `${window.location.pathname}${window.location.search}`;

const estadoDeLaEntrada = (): EstadoDeLaEntrada =>
  (window.history.state as EstadoDeLaEntrada | null) || {};

const seccionActual = () =>
  seccionDeLaBarra(window.location.pathname, window.location.search);

const publicacionActual = () =>
  (seccionActual() === 'product' ? publicacionDeLaBarra(window.location.search) : null);

const origenDeLaEntrada = (): Seccion | null =>
  (seccionActual() === 'product' ? estadoDeLaEntrada().origen || null : null);

/** La ubicación que se está mirando, tal como la dejó el último movimiento. */
const ubicacionDeAhora = () => ({
  barra: barraActual(),
  estado: window.history.state as EstadoDeLaEntrada | null,
  seccion: seccionActual(),
});

/**
 * Vuelve la vista al punto anotado cuando el contenido ya lo alcanza. Al volver
 * de una ficha, la pantalla de origen puede tardar un cuadro —o una respuesta,
 * si su vista previa se vuelve a pedir— en tener la altura de antes y en tener
 * dibujada la tarjeta; bajar antes de eso deja la vista más arriba. Se espera
 * a las dos cosas, con un tope, y recién ahí se devuelve el foco a la tarjeta
 * de la ficha que se cerró.
 */
function volverAlPunto(desplazamiento: number, ficha: string | null, enlace: string | null) {
  const limite = performance.now() + 3000;
  const tarjeta = () => {
    if (!ficha) return null;
    const deLaFicha = `[data-ficha="${CSS.escape(ficha)}"]`;
    return (enlace && document.querySelector<HTMLElement>(
      `${deLaFicha}[data-ficha-enlace="${CSS.escape(enlace)}"]`,
    )) || document.querySelector<HTMLElement>(deLaFicha);
  };
  const paso = () => {
    const alcanza = document.documentElement.scrollHeight - window.innerHeight >= desplazamiento - 1;
    const dibujada = !ficha || tarjeta() !== null;
    if (!(alcanza && dibujada) && performance.now() < limite) {
      window.requestAnimationFrame(paso);
      return;
    }
    // Sin animación: volver no es desplazarse, es reaparecer donde se estaba.
    window.scrollTo({ top: desplazamiento, behavior: 'instant' });
    tarjeta()?.focus({ preventScroll: true });
  };
  window.requestAnimationFrame(paso);
}

export function useNavegacion(): Navegacion {
  const [seccion, setSeccion] = useState<Seccion>(seccionActual);
  const [publicacion, setPublicacion] = useState<string | null>(publicacionActual);
  const [origenDeLaFicha, setOrigenDeLaFicha] = useState<Seccion | null>(origenDeLaEntrada);
  const [version, setVersion] = useState(0);

  const guardia = useRef<GuardiaDeSalida | null>(null);
  // Dónde estábamos antes del último movimiento. Hace falta para deshacer un
  // Atrás: cuando llega `popstate` la barra ya cambió, y esto es lo único que
  // recuerda qué decía.
  const ubicacionMirada = useRef({
    barra: '', estado: null as EstadoDeLaEntrada | null, seccion: 'home' as Seccion,
  });
  // Un Atrás ya consentido no se vuelve a preguntar.
  const salidaConsentida = useRef(false);
  // El regreso de una ficha que falta aplicar. Se anota al llegar `popstate` y
  // se aplica después de dibujar: antes, la pantalla de origen todavía no está.
  const regresoPendiente = useRef<{
    desplazamiento: number; ficha: string | null; enlace: string | null;
  } | null>(null);

  useEffect(() => {
    ubicacionMirada.current = ubicacionDeAhora();
  }, []);

  const registrarGuardia = useCallback((nueva: GuardiaDeSalida) => {
    guardia.current = nueva;
    return () => {
      if (guardia.current === nueva) guardia.current = null;
    };
  }, []);

  // El único filtro: si hay guardia y hay trabajo, pregunta; si no, sigue.
  const conGuardia = useCallback((seguir: () => void) => {
    const actual = guardia.current;
    if (actual && actual.hayTrabajoSinGuardar()) actual.preguntar(seguir);
    else seguir();
  }, []);

  useEffect(() => {
    // El ÚNICO oyente de `popstate`. Antes no había ninguno: Atrás movía la
    // barra y la pantalla se quedaba donde estaba.
    const alMoverElHistorial = () => {
      const actual = guardia.current;
      if (actual && actual.hayTrabajoSinGuardar() && !salidaConsentida.current) {
        // La barra ya se movió. Se la devuelve a donde estaba ANTES de
        // preguntar: si la respuesta es seguir editando, la URL y la pantalla
        // tienen que quedar exactamente como estaban.
        const { barra, estado } = ubicacionMirada.current;
        window.history.pushState(estado, '', barra);
        actual.preguntar(() => {
          salidaConsentida.current = true;
          window.history.back();
        });
        return;
      }
      salidaConsentida.current = false;
      const veniaDeUnaFicha = ubicacionMirada.current.seccion === 'product';
      ubicacionMirada.current = ubicacionDeAhora();
      setSeccion(seccionActual());
      setPublicacion(publicacionActual());
      setOrigenDeLaFicha(origenDeLaEntrada());
      setVersion((cuantas) => cuantas + 1);

      // Volver de una ficha a la entrada desde la que se abrió: la vista va al
      // punto que esa entrada anotó, una vez dibujada. Cualquier otro
      // movimiento sigue como siempre, con lo que haga el navegador.
      const { desplazamiento, fichaAbierta, enlaceDeLaFicha } = estadoDeLaEntrada();
      if (veniaDeUnaFicha && seccionActual() !== 'product' && typeof desplazamiento === 'number') {
        regresoPendiente.current = {
          desplazamiento, ficha: fichaAbierta || null, enlace: enlaceDeLaFicha || null,
        };
      } else if (seccionActual() === 'product') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };
    window.addEventListener('popstate', alMoverElHistorial);
    return () => window.removeEventListener('popstate', alMoverElHistorial);
  }, []);

  // Después de dibujar la entrada a la que se volvió.
  useEffect(() => {
    const regreso = regresoPendiente.current;
    if (!regreso) return;
    regresoPendiente.current = null;
    volverAlPunto(regreso.desplazamiento, regreso.ficha, regreso.enlace);
  }, [version]);

  const navegarDeVerdad = useCallback((destino: Seccion) => {
    const desde = seccionActual();
    const filtros = filtrosDeLaBarra(window.location.search);

    const url = urlDe(destino, destino === 'marketplace' ? filtros : null);
    const aqui = urlDe(
      desde,
      desde === 'marketplace' ? filtros : null,
      publicacionDeLaBarra(window.location.search),
    );
    if (esPantallaDeLlegada(desde)) {
      // Sale del `pathname` de llegada sin dejarlo atrás.
      window.history.replaceState({}, '', url);
    } else if (url !== aqui) {
      window.history.pushState({}, '', url);
    } else if (url !== barraActual()) {
      // Es la ubicación que ya estaba, escrita de otra manera: se ordena la
      // barra sin agregar una entrada repetida.
      window.history.replaceState(window.history.state, '', url);
    }

    ubicacionMirada.current = ubicacionDeAhora();
    setSeccion(destino);
    setPublicacion(null);
    setOrigenDeLaFicha(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Ir a otra sección pasa por la guardia: la cabecera y el pie son dos de las
  // salidas de una página que puede tener formularios adentro.
  const navegar = useCallback(
    (destino: Seccion) => conGuardia(() => navegarDeVerdad(destino)),
    [conGuardia, navegarDeVerdad],
  );

  const pedirSalida = useCallback(
    (seguir: () => void) => conGuardia(seguir),
    [conGuardia],
  );

  // Abrir una ficha es irse de la pantalla, así que pasa por la guardia como
  // cualquier otra salida.
  const abrirPublicacion = useCallback((id: string) => conGuardia(() => {
    const desde = seccionActual();
    if (desde === 'product' && publicacionActual() === id) return;
    // La entrada de la que se sale anota hasta dónde se había bajado, qué
    // ficha se abrió y con qué enlace: es lo que Atrás necesita para devolver
    // la vista y el foco.
    const disparador = document.activeElement?.getAttribute('data-ficha-enlace') || undefined;
    window.history.replaceState(
      {
        ...estadoDeLaEntrada(),
        desplazamiento: window.scrollY,
        fichaAbierta: id,
        enlaceDeLaFicha: disparador,
      },
      '',
      barraActual(),
    );
    window.history.pushState({ origen: desde }, '', urlDe('product', null, id));
    ubicacionMirada.current = ubicacionDeAhora();
    setSeccion('product');
    setPublicacion(id);
    setOrigenDeLaFicha(desde);
    // La ficha empieza arriba, sin animación: es otra página.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }), [conGuardia]);

  const volverDeLaFicha = useCallback(() => {
    // Con origen, volver es Atrás: consume la entrada de la ficha en vez de
    // apilar otra, y la entrada de origen trae sus filtros, su página y su
    // punto. Sin origen —enlace directo, pestaña nueva— Atrás sacaría del
    // sitio, así que se va al Mercado.
    if (origenDeLaEntrada()) window.history.back();
    else navegar('marketplace');
  }, [navegar]);

  return useMemo(
    () => ({
      seccion,
      publicacion,
      origenDeLaFicha,
      version,
      navegar,
      abrirPublicacion,
      volverDeLaFicha,
      pedirSalida,
      registrarGuardia,
    }),
    [seccion, publicacion, origenDeLaFicha, version, navegar, abrirPublicacion,
      volverDeLaFicha, pedirSalida, registrarGuardia],
  );
}

/**
 * La navegación viva, para lo que está lejos de `App`. La tarjeta de una
 * publicación la usa para abrir su ficha; no escucha nada por su cuenta.
 */
export const ContextoDeNavegacion = createContext<Navegacion | null>(null);

export function useNavegacionActual(): Navegacion {
  const navegacion = useContext(ContextoDeNavegacion);
  if (!navegacion) {
    throw new Error('Falta ContextoDeNavegacion.Provider por encima de este componente');
  }
  return navegacion;
}
