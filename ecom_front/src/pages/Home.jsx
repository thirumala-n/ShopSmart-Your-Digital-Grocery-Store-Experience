import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import CategoryCard from '../components/CategoryCard';
import SearchBar from '../components/SearchBar';
import Loader from '../components/Loader';
import Chatbot from '../components/Chatbot';
import { metaApi, productsApi } from '../services/api';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          productsApi.list({ page: 1, pageSize: 8 }),
          metaApi.listRootCategories(),
        ]);
        setProducts(productsRes?.data?.items || []);
        setCategories(categoriesRes?.data?.items || []);
      } catch (error) {
        console.warn(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    window.location.href = `/products?search=${encodeURIComponent(search)}`;
  };

  if (loading) return <Loader message="Loading curated picks..." />;

  return (
    <div className="page home-page">
      <section className="hero">
        <div>
          <p className="eyebrow">Fresh essentials • fast delivery</p>
          <h1>Shop modern groceries with confidence.</h1>
          <p>Browse trusted products, save favorites, and checkout in minutes.</p>
          <SearchBar value={search} onChange={setSearch} onSubmit={submitSearch} />
        </div>
      </section>

      <section className="section">
        <h2>Shop by category</h2>
        <div className="category-grid">
          {categories.map((category) => (
            <CategoryCard key={category.id || category._id} category={category} />
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Featured products</h2>
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </section>

      <section className="section">
        <Chatbot />
      </section>
    </div>
  );
};

export default Home;
