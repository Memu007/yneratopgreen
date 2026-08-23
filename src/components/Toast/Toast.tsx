import React, { useState, useCallback, ReactNode } from 'react';
import { ToastContext, type ToastType, type ConfirmOptions } from '../../contexts/contextos';
import styles from './Toast.module.css';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastProviderProps {
  children: ReactNode;
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

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
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

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Un rótulo en palabras, no un emoji. Tres motivos: el color solo no es
  // un mensaje para quien no lo distingue; un lector de pantalla anuncia
  // «marca de verificación blanca» en vez de «listo»; y un dibujo de
  // sistema operativo no es parte de ninguna identidad.
  const rotuloDe = (type: ToastType) => {
    switch (type) {
      case 'success': return 'Listo';
      case 'error': return 'Error';
      case 'warning': return 'Atención';
      case 'info': return 'Aviso';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      
      {/* Toast Container */}
      <div className={styles.toastContainer} role="status" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`${styles.toast} ${styles[toast.type]}`}
            onClick={() => removeToast(toast.id)}
          >
            <span className={styles.rotulo}>{rotuloDe(toast.type)}</span>
            <span className={styles.message}>{toast.message}</span>
            <button className={styles.closeBtn} aria-label="Cerrar aviso">×</button>
          </div>
        ))}
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
