import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { CartItem, CartContextType, Product } from '../types';
import { useToast } from '../components/Toast/Toast';
import { apiFetch } from '../utils/api';

const CartContext = createContext<CartContextType | undefined>(undefined);

// Cómo se resume un carrito para saber si el servidor ya tiene esto mismo.
// Es pura y vive afuera del componente: así no cambia de identidad en cada
// render.
const retratoDe = (lista: CartItem[]) => lista
  .map((item) => `${item.product.id}x${item.quantity}`)
  .sort()
  .join('|');

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const { showToast } = useToast();

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const storedCart = localStorage.getItem('agromarket_cart');
    if (storedCart) {
      setItems(JSON.parse(storedCart));
    }
  }, []);

  // Limpiar carrito cuando el usuario cierra sesión
  useEffect(() => {
    const handleLogout = () => {
      setItems([]);
      localStorage.removeItem('agromarket_cart');
    };
    window.addEventListener('user-logout', handleLogout);
    return () => window.removeEventListener('user-logout', handleLogout);
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('agromarket_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product: Product, quantity: number = 1) => {
    const isService = product.isService || false;
    
    setItems((prevItems) => {
      // Verificar si el producto ya está en el carrito
      const existingItemIndex = prevItems.findIndex(
        (item) => item.product.id === product.id
      );

      if (existingItemIndex > -1) {
        // Si existe, actualizar cantidad
        const newItems = [...prevItems];
        const newQuantity = newItems[existingItemIndex].quantity + quantity;
        
        // Verificar stock disponible (solo para productos, no servicios)
        if (!isService && newQuantity > product.stock) {
          showToast('No hay suficiente stock disponible', 'warning');
          return prevItems;
        }

        newItems[existingItemIndex].quantity = newQuantity;
        return newItems;
      } else {
        // Si no existe, agregar nuevo item
        if (!isService && quantity > product.stock) {
          showToast('No hay suficiente stock disponible', 'warning');
          return prevItems;
        }

        return [
          ...prevItems,
          {
            product,
            quantity,
            addedAt: new Date().toISOString(),
          },
        ];
      }
    });
  };

  const removeItem = (productId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.product.id === productId) {
          const isService = item.product.isService || false;
          // Verificar stock disponible (solo para productos, no servicios)
          if (!isService && quantity > item.product.stock) {
            showToast('No hay suficiente stock disponible', 'warning');
            return item;
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  // --- sincronización con el carrito del servidor ---------------------------
  // Vive acá y no en el checkout a propósito. El modal se desmonta al
  // cerrarlo, y con él moriría una cola local: alcanzaría con cerrar el
  // checkout mientras una escritura está en vuelo, cambiar el carrito y
  // volver a abrirlo para que la instancia nueva escriba por su cuenta y la
  // vieja terminara última sobre el carrito vigente. El carrito sobrevive a
  // sus pantallas; la coordinación de sus escrituras también.
  const colaDeSincronizacion = useRef<Promise<void>>(Promise.resolve());
  const retratoEncolado = useRef('');
  // La lista se lee de una referencia al día y no del cierre: así la función
  // no cambia de identidad en cada render y quien la use en un efecto puede
  // declararla como dependencia sin volver a ejecutarlo de más.
  const itemsVigentes = useRef(items);
  itemsVigentes.current = items;

  const sincronizarConServidor = useCallback(() => {
    const lista = itemsVigentes.current;
    const retrato = retratoDe(lista);
    if (retratoEncolado.current !== retrato) {
      retratoEncolado.current = retrato;
      // La foto se toma AL ENCOLAR: cada turno manda lo que había cuando le
      // tocó el lugar en la fila, así el último en salir es el último en
      // escribir.
      const instantanea = lista.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));
      const turno = colaDeSincronizacion.current
        .catch(() => undefined)
        .then(async () => {
          try {
            // Sin respaldo por producto: si falla, el motivo real sube tal
            // cual y quien esté esperando decide qué mostrar.
            await apiFetch('/cart/sync', {
              method: 'POST',
              body: JSON.stringify({ items: instantanea }),
            });
          } catch (error) {
            // No quedó escrito lo que se pedía: el intento siguiente tiene
            // que volver a mandarlo en vez de darlo por hecho.
            retratoEncolado.current = '';
            throw error;
          }
        });
      colaDeSincronizacion.current = turno;
    }
    // Se espera la cola entera aunque esta llamada no haya encolado nada:
    // con una escritura anterior en vuelo, el servidor todavía no
    // representa lo que se ve.
    return colaDeSincronizacion.current;
  }, []);

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const totalAmount = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  const value: CartContextType = {
    items,
    itemCount,
    totalAmount,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    sincronizarConServidor,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
