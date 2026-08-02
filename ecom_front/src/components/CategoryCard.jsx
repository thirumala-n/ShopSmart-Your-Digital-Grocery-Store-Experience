import { Link } from 'react-router-dom';

const CategoryCard = ({ category }) => (
  <Link to={`/products?categoryId=${category.id || category._id}`} className="category-card">
    <h3>{category.name}</h3>
    <p>{category.description || 'Explore products in this category.'}</p>
  </Link>
);

export default CategoryCard;
