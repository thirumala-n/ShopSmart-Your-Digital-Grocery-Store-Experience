import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error?.response?.data?.error || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: (payload) => api.post('/api/auth/login', payload),
  register: (payload) => api.post('/api/auth/register', payload),
  refresh: (payload) => api.post('/api/auth/refresh', payload),
  logout: (payload) => api.post('/api/auth/logout', payload),
};

export const productsApi = {
  getHomeBanners: () => api.get('/api/products/banners/home'),
  list: (params) => api.get('/api/products', { params }),
  getById: (id) => api.get(`/api/products/by-id/${id}`),
  getBySlug: (slug) => api.get(`/api/products/${slug}`),
};

export const metaApi = {
  listRootCategories: () => api.get('/api/meta/categories/root'),
  listSubcategories: (parentId) => api.get(`/api/meta/categories/${parentId}/subcategories`),
  listFeaturedBrands: () => api.get('/api/meta/brands/featured'),
};

export const cartApi = {
  get: () => api.get('/api/cart'),
  addItem: (payload) => api.post('/api/cart/items', payload),
  updateItem: (payload) => api.patch('/api/cart/items', payload),
  removeItem: (payload) => api.delete('/api/cart/items', { data: payload }),
  applyCoupon: (payload) => api.post('/api/cart/coupon', payload),
  clearCoupon: () => api.delete('/api/cart/coupon'),
};

export const wishlistApi = {
  get: () => api.get('/api/wishlist'),
  addItem: (payload) => api.post('/api/wishlist/items', payload),
  removeItem: (payload) => api.delete('/api/wishlist/items', { data: payload }),
};

export const ordersApi = {
  listMy: (params) => api.get('/api/orders/my', { params }),
  placeOrder: (payload) => api.post('/api/orders', payload),
  getById: (orderId) => api.get(`/api/orders/${orderId}`),
  confirmPayment: (orderId, payload) => api.post(`/api/orders/${orderId}/confirm-payment`, payload),
};

export const accountApi = {
  getProfile: () => api.get('/api/account/me'),
  updateProfile: (payload) => api.patch('/api/account/me', payload),
};

export const sellerApi = {
  listProducts: (params) => api.get('/api/seller/products', { params }),
  upsertProduct: (payload) => api.post('/api/seller/products/upsert', payload),
  updateStock: (payload) => api.patch('/api/seller/inventory/stock', payload),
};

export const adminApi = {
  dashboardMetrics: () => api.get('/api/admin/dashboard/metrics'),
  listUsers: (params) => api.get('/api/admin/users', { params }),
  listOrders: (params) => api.get('/api/admin/orders', { params }),
};

export const chatbotApi = {
  ask: (message, history = []) => api.post('/api/chatbot', { message, history }),
};

export default api;
