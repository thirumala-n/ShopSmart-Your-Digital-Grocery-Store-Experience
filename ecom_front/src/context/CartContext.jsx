import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cartApi } from '../services/api';
import { toast } from 'react-toastify';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ lines: [], summary: {} });
  const [loading, setLoading] = useState(false);

  const refreshCart = async () => {
    try {
      setLoading(true);
      const { data } = await cartApi.get();
      setCart(data?.data || { lines: [], summary: {} });
    } catch (error) {
      console.warn(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCart();
  }, []);

  const addToCart = async (productId, variantId, quantity = 1) => {
    await cartApi.addItem({ productId, variantId, quantity });
    await refreshCart();
    toast.success('Added to cart');
  };

  const updateQuantity = async (productId, variantId, quantity) => {
    await cartApi.updateItem({ productId, variantId, quantity });
    await refreshCart();
  };

  const removeFromCart = async (productId, variantId) => {
    await cartApi.removeItem({ productId, variantId });
    await refreshCart();
    toast.info('Removed from cart');
  };

  const value = useMemo(() => ({ cart, loading, refreshCart, addToCart, updateQuantity, removeFromCart }), [cart, loading]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
