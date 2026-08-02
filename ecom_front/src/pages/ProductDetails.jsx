import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productsApi } from '../services/api';
import { useCart } from '../context/CartContext';

const ProductDetails = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await productsApi.getBySlug(slug);
        setProduct(data?.data || null);
      } catch (error) {
        console.warn(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  if (loading) return <div className="loader">Loading product...</div>;
  if (!product) return <div className="page">Product not found.</div>;

  return (
    <div className="page product-details">
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <div className="product-variants">
        {(product.variants || []).map((variant) => (
          <div key={variant.variantId} className="variant-card">
            <span>{variant.weight}</span>
            <strong>${variant.price}</strong>
            <button onClick={() => addToCart(product._id, variant.variantId, 1)}>Add</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductDetails;
