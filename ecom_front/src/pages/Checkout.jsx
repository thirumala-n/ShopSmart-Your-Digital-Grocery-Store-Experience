import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../components/ErrorState';
import { ordersApi } from '../services/api';
import { useCart } from '../context/CartContext';

const Checkout = () => {
  const { cart } = useCart();
  const [form, setForm] = useState({ deliverySlotId: '', paymentMethod: 'COD', addressLine1: '', city: '', pincode: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submitOrder = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await ordersApi.placeOrder({
        shippingAddress: { line1: form.addressLine1, city: form.city, pincode: form.pincode },
        deliverySlotId: form.deliverySlotId,
        paymentMethod: form.paymentMethod,
      });
      navigate(`/orders/${data?.data?._id || data?.data?.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h2>Checkout</h2>
      <form className="form-card" onSubmit={submitOrder}>
        {error && <ErrorState message={error} />}
        <input placeholder="Address line 1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
        <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
        <input placeholder="Delivery Slot" value={form.deliverySlotId} onChange={(e) => setForm({ ...form, deliverySlotId: e.target.value })} />
        <input placeholder="Payment Method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} />
        <button type="submit">Place order</button>
      </form>
      <div className="summary-card">
        <h3>Amount due</h3>
        <p>${cart?.summary?.grandTotal || 0}</p>
      </div>
    </div>
  );
};

export default Checkout;
