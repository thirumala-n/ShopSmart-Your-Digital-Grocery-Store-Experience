import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ordersApi } from '../services/api';

const OrderDetails = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await ordersApi.getById(orderId);
      setOrder(data?.data || null);
    };

    load();
  }, [orderId]);

  if (!order) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h2>Order details</h2>
      <p>Status: {order.status}</p>
      <pre>{JSON.stringify(order, null, 2)}</pre>
    </div>
  );
};

export default OrderDetails;
