import { useState, useCallback } from 'react';
import axios from 'axios';
import { API } from './config';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ui_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, rol, nombre, usuario_id } = res.data;
    const userData = { email, rol, nombre, usuario_id };
    
    localStorage.setItem('ui_token', access_token);
    localStorage.setItem('ui_user', JSON.stringify(userData));
    
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (nombre, email, password, telefono, direccion) => {
    await axios.post(`${API}/auth/register`, { nombre, email, password, telefono, direccion, rol: 'ciudadano' });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ui_token');
    localStorage.removeItem('ui_user');
    setUser(null);
  }, []);

  const authHeader = useCallback(() => {
    const token = localStorage.getItem('ui_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const value = {
    user,
    login,
    register,
    logout,
    authHeader,
    loading: false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
