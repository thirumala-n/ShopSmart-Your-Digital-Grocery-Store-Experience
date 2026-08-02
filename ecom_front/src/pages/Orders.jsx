import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import { ordersApi } from '../services/api';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await ordersApi.listMy({ page: 1, pageSize: 10 });
        setOrders(data?.items || []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="page">
      <h2>Orders</h2>
      {loading ? <Loader message="Loading orders..." /> : orders.length === 0 ? <p>No orders yet.</p> : (
        <div className="stack">
          {orders.map((order) => (
            <div key={order._id || order.id} className="card">
              <h3>{order.orderNumber || 'Order'}</h3>
              <p>Status: {order.status}</p>
              <Link to={`/orders/${order._id || order.id}`}>View details</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
