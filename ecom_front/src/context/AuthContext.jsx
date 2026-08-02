import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/api';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('accessToken') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const { data } = await authApi.login(credentials);
    const authUser = data?.user || data?.data?.user;
    const accessToken = data?.token || data?.data?.token || data?.accessToken || data?.data?.accessToken;
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      setToken(accessToken);
    }
    if (authUser) {
      localStorage.setItem('authUser', JSON.stringify(authUser));
      setUser(authUser);
    }
    return data;
  };

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    toast.success('Registration successful. Please log in.');
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout({ refreshToken: localStorage.getItem('refreshToken') || '' });
    } catch (error) {
      console.warn(error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      setToken('');
      setUser(null);
      toast.info('You have been logged out.');
    }
  };

  const value = useMemo(() => ({ user, token, loading, login, register, logout }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
