import { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { sellerApi } from '../services/api';

const SellerDashboard = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '', SKU: '', brand: '', categoryId: '', subCategoryId: '', description: '', variants: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await sellerApi.listProducts({ page: 1, pageSize: 10 });
        setProducts(data?.items || []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const submitProduct = async (event) => {
    event.preventDefault();
    await sellerApi.upsertProduct({ ...form, variants: [{ variantId: 'default', weight: '1 unit', price: 10, MRP: 12, stock: 10 }] });
    setForm({ name: '', slug: '', SKU: '', brand: '', categoryId: '', subCategoryId: '', description: '', variants: [] });
  };

  return (
    <div className="page">
      <h2>Seller dashboard</h2>
      <form className="form-card" onSubmit={submitProduct}>
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
        <input placeholder="SKU" value={form.SKU} onChange={(event) => setForm({ ...form, SKU: event.target.value })} />
        <input placeholder="Brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
        <input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <button type="submit">Create product</button>
      </form>
      {loading ? <Loader message="Loading seller products..." /> : (
        <div className="product-grid">
          {products.map((product) => <div key={product.id || product._id} className="card">{product.name}</div>)}
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
