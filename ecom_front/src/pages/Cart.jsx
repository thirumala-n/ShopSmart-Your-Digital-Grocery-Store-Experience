import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart } = useCart();
  const lines = cart?.lines || [];
  const summary = cart?.summary || {};

  return (
    <div className="page cart-page">
      <h2>Your cart</h2>
      {lines.length === 0 ? <p>No items yet.</p> : (
        <div className="cart-layout">
          <div>
            {lines.map((line) => (
              <div key={`${line.productId}-${line.variantId}`} className="cart-item">
                <div>
                  <h3>{line.productName}</h3>
                  <p>Qty: {line.quantity}</p>
                </div>
                <div className="cart-actions">
                  <button onClick={() => updateQuantity(line.productId, line.variantId, line.quantity + 1)}>+</button>
                  <button onClick={() => updateQuantity(line.productId, line.variantId, Math.max(1, line.quantity - 1))}>-</button>
                  <button onClick={() => removeFromCart(line.productId, line.variantId)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <aside className="summary-card">
            <h3>Summary</h3>
            <p>Subtotal: ${summary.totalMRP || 0}</p>
            <p>Discount: ${summary.totalDiscount || 0}</p>
            <p>Delivery: ${summary.deliveryFee || 0}</p>
            <p>Tax: ${summary.tax || 0}</p>
            <strong>Grand total: ${summary.grandTotal || 0}</strong>
            <Link to="/checkout" className="checkout-link">Proceed to checkout</Link>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Cart;
