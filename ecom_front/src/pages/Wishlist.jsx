import { useEffect, useState } from 'react';
import { wishlistApi } from '../services/api';

const Wishlist = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await wishlistApi.get();
      setItems(data?.data || []);
    };

    load();
  }, []);

  return (
    <div className="page">
      <h2>Wishlist</h2>
      {items.length === 0 ? <p>No saved products.</p> : (
        <div className="product-grid">
          {items.map((item) => (
            <div key={item._id} className="card">
              <h3>{item.name}</h3>
              <p>{item.brand}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
