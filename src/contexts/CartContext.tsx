import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { CartContext } from './contextos';
import { CartItem, CartContextType, Product } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../utils/api';
import { tienePrecioPublicado } from '../utils/anatomia';

// Cómo se resume un carrito para saber si el servidor ya tiene esto mismo.
// Es pura y vive afuera del componente: así no cambia de identidad en cada
// render.
const retratoDe = (lista: CartItem[]) => lista
  .map((item) => `${item.product.id}x${item.quantity}`)
  .sort()
  .join('|');

// La única clave del carrito. Se nombra una vez porque la recuperación
// tiene que poder descartar ESA y ninguna otra.
const CLAVE_DEL_CARRITO = 'agromarket_cart';

/**
 * ¿Esta entrada de la copia local sirve como ítem del carrito?
 *
 * El mínimo es lo que el carrito necesita para existir: una publicación
 * identificada, con un precio que se pueda cobrar —la misma regla que usa el
 * catálogo— y una cantidad positiva. Sin eso no hay total que sumar ni ítem
 * que mandar al checkout, y el intento de dibujarlo tira la aplicación entera.
 */
const esItemUsable = (entrada: unknown): entrada is CartItem => {
  if (!entrada || typeof entrada !== 'object') return false;
  const { product, quantity } = entrada as { product?: unknown; quantity?: unknown };
  if (!product || typeof product !== 'object') return false;
  const { id } = product as { id?: unknown };
  return typeof id === 'string' && id.trim() !== ''
    && tienePrecioPublicado(product as Product)
    && typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0;
};

/**
 * El carrito con el que arranca la pantalla.
 *
 * Se lee al construir el estado y no en un efecto. El efecto que guarda corre
 * en el mismo montaje y, si la lectura fuera otro efecto, escribiría el
 * carrito vacío inicial encima de lo guardado antes de que esa lectura
 * llegara a verse: con React en modo estricto —el de `npm run dev`— el
 * segundo montaje leía ese vacío y el carrito se perdía en cada recarga.
 *
 * Lo que no se pueda convertir en un carrito usable se descarta, y se
 * descarta SÓLO esta clave: los tokens y las preferencias de quien navega no
 * son asunto del carrito. Un carrito válido se conserva tal cual.
 */
const carritoGuardado = (): CartItem[] => {
  let guardado: string | null = null;
  try {
    guardado = localStorage.getItem(CLAVE_DEL_CARRITO);
  } catch {
    // Sin almacenamiento —modo privado, permisos— se arranca vacío y se sigue.
    return [];
  }
  if (guardado === null) return [];

  let leido: unknown;
  try {
    leido = JSON.parse(guardado);
  } catch {
    leido = undefined;
  }

  const usables = Array.isArray(leido) ? leido.filter(esItemUsable) : [];
  if (usables.length > 0) return usables;

  // No quedó nada aprovechable: se descarta la copia dañada. Si ya estaba
  // vacía no hay nada que descartar y la clave se deja como está.
  if (guardado !== '[]') {
    try {
      localStorage.removeItem(CLAVE_DEL_CARRITO);
    } catch {
      // Si tampoco se puede borrar, el carrito vacío alcanza para seguir.
    }
  }
  return [];
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(carritoGuardado);
  const { showToast } = useToast();
  const { user } = useAuth();

  // Limpiar carrito cuando el usuario cierra sesión
  useEffect(() => {
    const handleLogout = () => {
      setItems([]);
      localStorage.removeItem(CLAVE_DEL_CARRITO);
    };
    window.addEventListener('user-logout', handleLogout);
    return () => window.removeEventListener('user-logout', handleLogout);
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem(CLAVE_DEL_CARRITO, JSON.stringify(items));
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
  // De quién son esa cola y ese retrato. El proveedor no se desmonta al cerrar
  // sesión, así que sin esto la cuenta que entra después heredaría el «esto ya
  // está sincronizado» de la anterior y su carrito del servidor se quedaría
  // con lo que hubiera antes.
  const identidadDeLaCola = useRef<string | null>(null);
  // La identidad y la lista se leen de referencias al día y no del cierre: así
  // la función no cambia de identidad en cada render y quien la use en un
  // efecto puede declararla como dependencia sin volver a ejecutarlo de más.
  const identidadVigente = useRef<string | null>(null);
  identidadVigente.current = user?.id ?? null;
  const itemsVigentes = useRef(items);
  itemsVigentes.current = items;

  const sincronizarConServidor = useCallback(() => {
    const identidad = identidadVigente.current;
    if (identidadDeLaCola.current !== identidad) {
      // Sesión distinta: cola nueva y retrato en blanco. La cola anterior no
      // se espera: una petición que ya viajó se resuelve donde el servidor la
      // haya tomado, y hacer que esta sesión la aguarde sería dejarla colgada
      // de una ajena.
      identidadDeLaCola.current = identidad;
      colaDeSincronizacion.current = Promise.resolve();
      retratoEncolado.current = '';
    }
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
          // Este turno pudo esperar detrás de otro y arrancar cuando la sesión
          // ya cambió. `apiFetch` firma con las credenciales del momento: si
          // saliera ahora, escribiría el carrito de una cuenta con la
          // instantánea de otra. No sale.
          if (identidadVigente.current !== identidad) return;
          try {
            // Sin respaldo por producto: si falla, el motivo real sube tal
            // cual y quien esté esperando decide qué mostrar.
            await apiFetch('/cart/sync', {
              method: 'POST',
              body: JSON.stringify({ items: instantanea }),
            });
          } catch (error) {
            // No quedó escrito lo que se pedía: el intento siguiente tiene
            // que volver a mandarlo en vez de darlo por hecho. Sólo si el
            // retrato sigue siendo el de esta sesión: si ya cambió, borrarlo
            // pisaría el de la cuenta nueva.
            if (identidadDeLaCola.current === identidad) retratoEncolado.current = '';
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
