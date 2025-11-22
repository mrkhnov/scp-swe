import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { decode as atob } from 'base-64';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      await api.loadTokens();
      if (api.accessToken) {
        // Decode JWT to get user info
        const tokenPayload = JSON.parse(atob(api.accessToken.split('.')[1]));
        const userData = {
          id: tokenPayload.user_id,
          email: tokenPayload.sub,
          role: tokenPayload.role,
        };
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await api.login(email, password);
    // Decode JWT to get user info (JWT payload contains user data)
    const tokenPayload = JSON.parse(atob(data.access_token.split('.')[1]));
    const userData = {
      id: tokenPayload.user_id,
      email: tokenPayload.sub,
      role: tokenPayload.role,
    };
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    console.log('AuthContext: register called with:', userData);
    // Just register the user, don't log them in
    try {
      const data = await api.register(userData);
      console.log('AuthContext: register successful, data:', data);
      return data;
    } catch (error) {
      console.error('AuthContext: register failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
