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
 * 3. Una capa visible —el detalle de una publicación— no es una ubicación: es
 *    una entrada más sobre la misma URL, marcada en el estado de la entrada.
 *    Así el primer Atrás cierra el detalle y deja intacto lo de atrás, y
 *    cerrarlo con la propia interfaz consume esa entrada en vez de dejarla
 *    colgada.
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
  seccionDeLaBarra,
  urlDe,
  type Seccion,
} from './politica';

interface EstadoDeLaEntrada {
  capa: string | null;
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
  /** La publicación abierta sobre esa sección, si hay alguna. */
  capa: string | null;
  /**
   * Cuántas veces movió la barra el historial. Lo que guarda estado leído de
   * la URL —los filtros del Mercado— lo relee cuando esto cambia: sin eso,
   * volver a una entrada mostraría su URL con los controles de otra.
   */
  version: number;
  navegar: (destino: Seccion) => void;
  abrirCapa: (id: string) => void;
  cerrarCapa: () => void;
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

const capaDeLaEntrada = (): string | null => {
  const estado = window.history.state as EstadoDeLaEntrada | null;
  return typeof estado?.capa === 'string' ? estado.capa : null;
};

const seccionActual = () =>
  seccionDeLaBarra(window.location.pathname, window.location.search);

export function useNavegacion(): Navegacion {
  const [seccion, setSeccion] = useState<Seccion>(seccionActual);
  const [capa, setCapa] = useState<string | null>(capaDeLaEntrada);
  const [version, setVersion] = useState(0);

  const guardia = useRef<GuardiaDeSalida | null>(null);
  // Dónde estábamos antes del último movimiento. Hace falta para deshacer un
  // Atrás: cuando llega `popstate` la barra ya cambió, y esto es lo único que
  // recuerda qué decía.
  const ubicacionMirada = useRef({ barra: '', estado: null as EstadoDeLaEntrada | null });
  // Un Atrás ya consentido no se vuelve a preguntar.
  const salidaConsentida = useRef(false);

  useEffect(() => {
    ubicacionMirada.current = { barra: barraActual(), estado: window.history.state };
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
      ubicacionMirada.current = { barra: barraActual(), estado: window.history.state };
      setSeccion(seccionActual());
      setCapa(capaDeLaEntrada());
      setVersion((cuantas) => cuantas + 1);
    };
    window.addEventListener('popstate', alMoverElHistorial);
    return () => window.removeEventListener('popstate', alMoverElHistorial);
  }, []);

  const navegarDeVerdad = useCallback((destino: Seccion) => {
    const desde = seccionActual();
    const filtros = filtrosDeLaBarra(window.location.search);

    // La capa no sobrevive a una navegación deliberada, y su entrada tampoco:
    // se reescribe sin ella —misma URL, otro estado— para que Atrás no traiga
    // de vuelta un detalle que la persona dejó al irse.
    if (capaDeLaEntrada() !== null) {
      window.history.replaceState({ capa: null }, '', barraActual());
    }

    const url = urlDe(destino, destino === 'marketplace' ? filtros : null);
    const aqui = urlDe(desde, desde === 'marketplace' ? filtros : null);
    if (esPantallaDeLlegada(desde)) {
      // Sale del `pathname` de llegada sin dejarlo atrás.
      window.history.replaceState({ capa: null }, '', url);
    } else if (url !== aqui) {
      window.history.pushState({ capa: null }, '', url);
    } else if (url !== barraActual()) {
      // Es la ubicación que ya estaba, escrita de otra manera: se ordena la
      // barra sin agregar una entrada repetida.
      window.history.replaceState({ capa: null }, '', url);
    }

    ubicacionMirada.current = { barra: barraActual(), estado: window.history.state };
    setSeccion(destino);
    setCapa(null);
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

  const abrirCapa = useCallback((id: string) => {
    window.history.pushState({ capa: id }, '', barraActual());
    ubicacionMirada.current = { barra: barraActual(), estado: window.history.state };
    setCapa(id);
  }, []);

  const cerrarCapa = useCallback(() => {
    // Se cierra volviendo atrás, que es lo que consume la entrada. Cerrar sin
    // volver dejaría una entrada fantasma: el primer Atrás no haría nada
    // visible y el segundo sacaría del sitio.
    //
    // Este Atrás lo pide la propia interfaz, así que no lo filtra la guardia:
    // cerrar el detalle de una publicación no es salir de la pantalla.
    if (capaDeLaEntrada() !== null) {
      salidaConsentida.current = true;
      window.history.back();
    } else setCapa(null);
  }, []);

  return useMemo(
    () => ({
      seccion, capa, version, navegar, abrirCapa, cerrarCapa, pedirSalida, registrarGuardia,
    }),
    [seccion, capa, version, navegar, abrirCapa, cerrarCapa, pedirSalida, registrarGuardia],
  );
}

/**
 * La navegación viva, para lo que está lejos de `App`. La tarjeta de una
 * publicación la usa para abrir y cerrar su detalle; no escucha nada por su
 * cuenta.
 */
export const ContextoDeNavegacion = createContext<Navegacion | null>(null);

export function useNavegacionActual(): Navegacion {
  const navegacion = useContext(ContextoDeNavegacion);
  if (!navegacion) {
    throw new Error('Falta ContextoDeNavegacion.Provider por encima de este componente');
  }
  return navegacion;
}
