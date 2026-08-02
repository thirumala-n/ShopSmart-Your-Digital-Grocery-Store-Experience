import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const itemCount = cart?.lines?.length || 0;

  return (
    <nav className="navbar">
      <Link to="/" className="brand">GroceryHub</Link>
      <div className="nav-links">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/products">Products</NavLink>
        <NavLink to="/wishlist">Wishlist</NavLink>
        <NavLink to="/orders">Orders</NavLink>
        <NavLink to="/cart">Cart ({itemCount})</NavLink>
      </div>
      <div className="nav-actions">
        {user ? (
          <>
            <Link to="/profile">{user.name || user.email}</Link>
            {user.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
            {user.role === 'SELLER' && <Link to="/seller">Seller</Link>}
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
