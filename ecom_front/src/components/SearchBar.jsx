const SearchBar = ({ value, onChange, onSubmit }) => (
  <form className="search-bar" onSubmit={onSubmit}>
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search products" />
    <button type="submit">Search</button>
  </form>
);

export default SearchBar;
