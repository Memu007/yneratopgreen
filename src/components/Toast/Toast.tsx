import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, ReactNode } from 'react';
import {
  ToastContext, type ToastType, type ConfirmOptions, type OpcionesDelAviso,
} from '../../contexts/contextos';
import styles from './Toast.module.css';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  detalle?: string;
  accion?: OpcionesDelAviso['accion'];
  saliendo: boolean;
}

interface ToastProviderProps {
  children: ReactNode;
}

// Lo que salió bien se va solo; un error se queda hasta que lo cierren.
const DURACION = 4000;
// Lo que tarda la salida (bajar y apagarse). Con movimiento reducido, nada.
const SALIDA = 200;
// Cuántos se ven apilados; los de más atrás esperan su turno.
const A_LA_VISTA = 3;
// Cuántos se despliegan como máximo: más subirían por encima de la pantalla.
// Los de más atrás aparecen a medida que se cierran los de adelante.
const DESPLEGADOS = 5;
// Lo que hay que deslizar con el dedo para cerrarlo.
const DESLIZAR = 60;

const sinMovimiento = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// El tiempo que le queda a cada aviso que se va solo. Se pausa con el mouse o
// el foco encima: nadie tiene que correr para leer ni para llegar al botón.
interface Temporizador {
  restante: number;
  desde: number;
  pendiente?: ReturnType<typeof setTimeout>;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const siguienteId = useRef(0);
  const temporizadores = useRef(new Map<number, Temporizador>());
  const enPausa = useRef(false);

  const removeToast = useCallback((id: number) => {
    const temporizador = temporizadores.current.get(id);
    if (temporizador?.pendiente) clearTimeout(temporizador.pendiente);
    temporizadores.current.delete(id);
    if (sinMovimiento()) {
      setToasts(prev => prev.filter(t => t.id !== id));
      return;
    }
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, saliendo: true } : t)));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), SALIDA);
  }, []);

  const correr = useCallback((id: number) => {
    const temporizador = temporizadores.current.get(id);
    if (!temporizador || temporizador.pendiente) return;
    temporizador.desde = Date.now();
    temporizador.pendiente = setTimeout(() => removeToast(id), temporizador.restante);
  }, [removeToast]);

  const pausar = useCallback(() => {
    enPausa.current = true;
    for (const temporizador of temporizadores.current.values()) {
      if (!temporizador.pendiente) continue;
      clearTimeout(temporizador.pendiente);
      temporizador.pendiente = undefined;
      temporizador.restante = Math.max(0, temporizador.restante - (Date.now() - temporizador.desde));
    }
  }, []);

  const reanudar = useCallback(() => {
    enPausa.current = false;
    for (const id of temporizadores.current.keys()) correr(id);
  }, [correr]);

  const showToast = useCallback((message: string, type: ToastType = 'info', opciones: OpcionesDelAviso = {}) => {
    siguienteId.current += 1;
    const id = siguienteId.current;
    setToasts(prev => [...prev, {
      id, message, type, detalle: opciones.detalle, accion: opciones.accion, saliendo: false,
    }]);
    if (type !== 'error') {
      temporizadores.current.set(id, { restante: DURACION, desde: Date.now() });
      if (!enPausa.current) correr(id);
    }
  }, [correr]);

  useEffect(() => () => {
    for (const temporizador of temporizadores.current.values()) {
      if (temporizador.pendiente) clearTimeout(temporizador.pendiente);
    }
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = (result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState({
      isOpen: false,
      options: { title: '', message: '' },
      resolve: null,
    });
  };

  // La pila se despliega con el mouse encima o con el foco adentro: así los de
  // atrás se leen y sus botones se alcanzan con el teclado.
  const [conMouse, setConMouse] = useState(false);
  const [conFoco, setConFoco] = useState(false);
  const desplegada = conMouse || conFoco;
  // Cerrar un aviso con el mouse lo saca de debajo del puntero, y el navegador
  // no avisa que el mouse salió: sin esto la pila quedaba desplegada y en
  // pausa, y lo bueno que llegaba después no se iba. Cuando cambia la lista se
  // vuelve a preguntar si el puntero sigue encima.
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      const nodo = contenedor.current;
      if (!nodo || !nodo.matches(':hover')) setConMouse(false);
      if (!nodo || !nodo.contains(document.activeElement)) setConFoco(false);
    });
    return () => cancelAnimationFrame(cuadro);
  }, [toasts]);
  useEffect(() => {
    if (desplegada) pausar();
    else reanudar();
  }, [desplegada, pausar, reanudar]);

  // Desplegada, cada aviso sube lo que miden los que tiene adelante.
  const alturas = useRef(new Map<number, number>());
  const [, medir] = useState(0);
  const nodos = useRef(new Map<number, HTMLLIElement>());
  useLayoutEffect(() => {
    let cambio = false;
    for (const id of alturas.current.keys()) {
      if (!nodos.current.has(id)) alturas.current.delete(id);
    }
    for (const [id, nodo] of nodos.current) {
      // `offsetHeight` y no la caja dibujada: la de los de atrás está achicada.
      const alto = (nodo.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
      if (alturas.current.get(id) !== alto) {
        alturas.current.set(id, alto);
        cambio = true;
      }
    }
    if (cambio) medir((n) => n + 1);
  }, [toasts]);

  // Al cerrarse con el teclado el que tenía el foco, el foco pasa al siguiente
  // aviso y no se pierde en la página. Con el mouse o el dedo no: dejarle el
  // foco a otro aviso dejaba la pila desplegada y en pausa.
  const cerrar = (id: number, conTeclado = false) => {
    const nodo = nodos.current.get(id);
    if (nodo?.contains(document.activeElement)) {
      if (!conTeclado) {
        (document.activeElement as HTMLElement | null)?.blur();
        removeToast(id);
        return;
      }
      const quedan = toasts.filter(t => t.id !== id && !t.saliendo);
      const otro = quedan[quedan.length - 1];
      const destino = otro && nodos.current.get(otro.id)?.querySelector<HTMLButtonElement>('[data-cerrar]');
      if (destino) destino.focus();
      else (document.activeElement as HTMLElement | null)?.blur();
    }
    removeToast(id);
  };

  // En el celular se cierra deslizándolo con el dedo, de costado o hacia abajo.
  const arrastre = useRef<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const [desplazado, setDesplazado] = useState<{ id: number; dx: number; dy: number } | null>(null);
  const alApoyar = (id: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return;
    arrastre.current = { id, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a) return;
    a.dx = e.clientX - a.x;
    a.dy = Math.max(0, e.clientY - a.y);
    setDesplazado({ id: a.id, dx: a.dx, dy: a.dy });
  };
  const alSoltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    setDesplazado(null);
    if (a && (Math.abs(a.dx) > DESLIZAR || a.dy > DESLIZAR)) cerrar(a.id);
  };

  const visibles = toasts.filter(t => !t.saliendo);
  const valor = useMemo(() => ({ showToast, showConfirm }), [showToast, showConfirm]);
  const posicion = (id: number) => visibles.length - 1 - visibles.findIndex(t => t.id === id);

  let subida = 0;
  const subidas = new Map<number, number>();
  for (const t of [...visibles].reverse().slice(0, DESPLEGADOS)) {
    subidas.set(t.id, subida);
    subida += (alturas.current.get(t.id) ?? 0) + 8;
  }
  const altoDeLaPila = desplegada
    ? Math.max(0, subida - 8)
    : (visibles.length ? (alturas.current.get(visibles[visibles.length - 1].id) ?? 0) : 0);

  return (
    <ToastContext.Provider value={valor}>
      {children}

      {/* Los avisos: abajo al centro, lejos de la cabecera. El más nuevo va
          adelante; los de atrás, más chicos y asomando. */}
      <div
        ref={contenedor}
        className={styles.toastContainer}
        data-desplegada={desplegada || undefined}
        onMouseEnter={() => setConMouse(true)}
        onMouseLeave={() => setConMouse(false)}
        onFocus={() => setConFoco(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setConFoco(false);
        }}
      >
        <ol className={styles.pila} style={{ height: altoDeLaPila }}>
          {toasts.map(toast => {
            const atras = toast.saliendo ? 0 : posicion(toast.id);
            const arrastrado = desplazado?.id === toast.id ? desplazado : null;
            const transform = arrastrado
              ? `translate(${arrastrado.dx}px, ${arrastrado.dy}px)`
              : desplegada
                ? `translateY(-${subidas.get(toast.id) ?? 0}px)`
                : `translateY(-${Math.min(atras, A_LA_VISTA) * 14}px) scale(${1 - Math.min(atras, A_LA_VISTA) * 0.06})`;
            return (
              <li
                key={toast.id}
                ref={(nodo) => {
                  if (nodo) nodos.current.set(toast.id, nodo);
                  else nodos.current.delete(toast.id);
                }}
                className={styles.lugar}
                data-atras={(!desplegada && atras > 0) || atras >= DESPLEGADOS ? Math.min(atras, A_LA_VISTA) : undefined}
                style={{ transform, zIndex: 100 - atras }}
              >
                <div
                  className={[
                    styles.toast, styles[toast.type], toast.saliendo ? styles.saliendo : '',
                  ].join(' ')}
                  role={toast.type === 'error' ? 'alert' : 'status'}
                  aria-atomic="true"
                  onPointerDown={alApoyar(toast.id)}
                  onPointerMove={alMover}
                  onPointerUp={alSoltar}
                  onPointerCancel={alSoltar}
                >
                  <span className={styles.icono} aria-hidden="true">
                    {toast.type === 'success' ? (
                      <svg viewBox="0 0 16 16" width="14" height="14">
                        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : toast.type === 'info' ? 'i' : '!'}
                  </span>
                  <span className={styles.texto}>
                    <span className={styles.message}>{toast.message}</span>
                    {toast.detalle && <span className={styles.detalle}>{toast.detalle}</span>}
                  </span>
                  {toast.accion && (
                    <button
                      type="button"
                      className={styles.accion}
                      onClick={() => {
                        toast.accion?.alHacer();
                        cerrar(toast.id);
                      }}
                    >
                      {toast.accion.rotulo}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label="Cerrar aviso"
                    data-cerrar=""
                    // Un clic hecho con el teclado (Enter o espacio) llega con detail 0.
                    onClick={(e) => cerrar(toast.id, e.detail === 0)}
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Confirm Modal */}
      {confirmState.isOpen && (
        <div className={styles.overlay} onClick={() => handleConfirm(false)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={`${styles.confirmHeader} ${styles[confirmState.options.type || 'info']}`}>
              <h3>{confirmState.options.title}</h3>
            </div>
            <div className={styles.confirmBody}>
              <p>{confirmState.options.message}</p>
            </div>
            <div className={styles.confirmActions}>
              <button
                className={styles.cancelButton}
                onClick={() => handleConfirm(false)}
              >
                {confirmState.options.cancelText || 'Cancelar'}
              </button>
              <button
                className={`${styles.confirmButton} ${styles[confirmState.options.type || 'info']}`}
                onClick={() => handleConfirm(true)}
              >
                {confirmState.options.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
