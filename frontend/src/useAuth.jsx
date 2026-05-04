import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const AuthContext = createContext(null);

export { API };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('ui_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error parsing saved user", e);
      }
    }
    setLoading(false);
  }, []);

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
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
