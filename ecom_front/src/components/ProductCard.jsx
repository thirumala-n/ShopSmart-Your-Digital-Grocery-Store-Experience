import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const image = product?.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
  const firstVariant = product?.variants?.[0];

  return (
    <article className="card">
      <img src={image} alt={product.name} className="card-image" />
      <div className="card-body">
        <h3>{product.name}</h3>
        <p>{product.brand}</p>
        <div className="price-row">
          <strong>${firstVariant?.price ?? 0}</strong>
          <span>{product.discountPercent}% off</span>
        </div>
        <div className="card-actions">
          <Link to={`/products/${product.slug || product._id}`}>View</Link>
          <button onClick={() => addToCart(product._id, firstVariant?.variantId || '', 1)}>Add to cart</button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
