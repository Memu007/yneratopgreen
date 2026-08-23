/**
 * Los objetos de contexto, sin componentes ni hooks.
 *
 * Viven aparte por una razón concreta: una hoja que exporta un componente Y
 * otra cosa rompe el refresco en caliente del navegador, y la herramienta lo
 * avisa. Separar el contexto del proveedor y del hook arregla eso de verdad,
 * en vez de silenciar el aviso.
 */
import { createContext } from 'react';
import { AuthContextType, CartContextType } from '../types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const CartContext = createContext<CartContextType | undefined>(undefined);

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ToastContext = createContext<ToastContextType | null>(null);
