import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ErrorState from '../components/ErrorState';
import ProductCard from '../components/ProductCard';
import CategoryCard from '../components/CategoryCard';
import SearchBar from '../components/SearchBar';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import { metaApi, productsApi } from '../services/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const searchValue = query.get('search') || '';
    const categoryId = query.get('categoryId') || '';
    setSearch(searchValue);
    setPage(1);

    const load = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          productsApi.list({ page: 1, pageSize: 20, search: searchValue, categoryId }),
          metaApi.listRootCategories(),
        ]);
        setProducts(productsRes?.data?.items || []);
        setCategories(categoriesRes?.data?.items || []);
        setTotalPages(Math.max(1, productsRes?.data?.totalPages || 1));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [location.search]);

  const submitSearch = (event) => {
    event.preventDefault();
    window.location.href = `/products?search=${encodeURIComponent(search)}`;
  };

  return (
    <div className="page">
      <h2>Products</h2>
      <SearchBar value={search} onChange={setSearch} onSubmit={submitSearch} />
      <div className="category-grid">
        {categories.map((category) => (
          <CategoryCard key={category.id || category._id} category={category} />
        ))}
      </div>
      {loading ? <Loader message="Loading products..." /> : error ? <ErrorState message={error} /> : (
        <>
          <div className="product-grid">
            {products.map((product) => <ProductCard key={product._id} product={product} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Products;
