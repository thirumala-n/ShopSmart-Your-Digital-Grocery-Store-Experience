import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { chatbotApi } from '../services/api';

const Chatbot = () => {
  const initialMessages = [{ from: 'bot', text: 'Hello! I can help with products, orders, delivery, payments, and account support.' }];
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, error]);

  const sendMessage = async (message) => {
    const userMessage = message.trim();
    if (!userMessage || loading) return;

    setError('');
    setLastFailedMessage('');
    setMessages((prev) => [...prev, { from: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .slice(-8)
        .map((item) => ({ role: item.from === 'user' ? 'user' : 'assistant', content: item.text }));
      const { data } = await chatbotApi.ask(userMessage, history);
      setMessages((prev) => [...prev, {
        from: 'bot',
        text: data?.reply || 'Sorry, I could not respond right now.',
        data: data?.data || null,
        intent: data?.intent || '',
      }]);
    } catch (error) {
      setError(error.message || 'Chatbot is unavailable right now.');
      setLastFailedMessage(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const submitMessage = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  const retryLastMessage = () => {
    if (lastFailedMessage) sendMessage(lastFailedMessage);
  };

  const clearChat = () => {
    setMessages(initialMessages);
    setInput('');
    setError('');
    setLastFailedMessage('');
  };

  return (
    <section className="chatbot-card">
      <div className="chatbot-header">
        <div>
          <h3>Support assistant</h3>
          <p>Ask about products, orders, delivery, payments, or account help.</p>
        </div>
        <button type="button" className="chat-clear" onClick={clearChat} disabled={loading || messages.length === 1}>
          Clear
        </button>
      </div>
      <div className="chat-log" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble ${message.from}`}>
            <div>{message.text}</div>
            {message.from === 'bot' && <ChatbotResult data={message.data} />}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble bot typing">
            <span className="chat-spinner" aria-hidden="true" />
            Thinking...
          </div>
        )}
        {error && (
          <div className="chat-error">
            <span>{error}</span>
            {lastFailedMessage && (
              <button type="button" onClick={retryLastMessage} disabled={loading}>
                Retry
              </button>
            )}
          </div>
        )}
        <div ref={logEndRef} />
      </div>
      <form className="chat-form" onSubmit={submitMessage}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about orders, products, or delivery"
          maxLength={1000}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
};

const ChatbotResult = ({ data }) => {
  if (!data) return null;

  const products = data.products || [];
  const cartLines = data.cart?.lines || [];
  const cartSummary = data.cart?.summary;
  const wishlistItems = data.wishlistItems || [];
  const orders = data.orders?.items || [];

  return (
    <>
      {products.length > 0 && (
        <div className="chat-products">
          {products.map((product) => (
            <article className="chat-product-card" key={product._id || product.slug || product.name}>
              {product.image && <img src={product.image} alt={product.name} />}
              <div>
                <strong>{product.name}</strong>
                <span>₹{Number(product.price || 0).toLocaleString('en-IN')} · {product.stockStatus}</span>
                <span>Rating: {product.rating || 'New'}</span>
                {product.shortDescription && <p>{product.shortDescription}</p>}
                <Link to={`/products/${product.slug || product._id}`}>View product</Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {cartSummary && (
        <div className="chat-summary">
          <span>Items: {cartLines.length}</span>
          <span>Total: ₹{Number(cartSummary.grandTotal || 0).toLocaleString('en-IN')}</span>
          <Link to="/cart">Open cart</Link>
        </div>
      )}

      {wishlistItems.length > 0 && (
        <div className="chat-summary">
          <span>Wishlist items: {wishlistItems.length}</span>
          <Link to="/wishlist">Open wishlist</Link>
        </div>
      )}

      {orders.length > 0 && (
        <div className="chat-orders">
          {orders.slice(0, 3).map((order) => (
            <Link key={order.orderId || order.id} to={`/orders/${order.orderId || order.id}`}>
              {order.orderId || order.id} · {order.orderStatus || 'Status unavailable'}
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default Chatbot;
