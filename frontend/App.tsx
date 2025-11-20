import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, CartItem } from './types';
import { api, getUserFromToken, logout } from './services/api';
import Login from './pages/Login';
import ConsumerDashboard from './pages/consumer/ConsumerDashboard';
import SupplierDashboard from './pages/supplier/SupplierDashboard';
import ChatPage from './pages/ChatPage';

// --- Global State Context ---
interface AppContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  cart: CartItem[];
  addToCart: (p: any, qty: number) => void;
  clearCart: () => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

// --- Icons ---
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
);

// --- Layout Component ---
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser, cart } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isChat = location.pathname.includes('/chat');

  const isActive = (path: string) => {
      if (path === '/consumer' || path === '/supplier') {
          return location.pathname === path || location.pathname === path + '/';
      }
      return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-system-bg text-system-text">
      {/* Glassmorphism Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-system-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex justify-between items-center">
          <div 
            className="flex items-center space-x-2 cursor-pointer" 
            onClick={() => navigate('/')}
          >
            {/* Minimalist Logo */}
            <div className="w-6 h-6 bg-system-text rounded-md flex items-center justify-center text-white text-xs font-bold">S</div>
            <span className="font-semibold tracking-tight text-lg">Platform</span>
          </div>
          
          {user && (
            <div className="flex items-center space-x-8">
              <nav className="hidden md:flex space-x-6 text-sm font-medium text-system-textSec">
                {user.role === UserRole.CONSUMER ? (
                  <>
                    <button 
                      onClick={() => navigate('/consumer')} 
                      className={`transition-colors hover:text-system-text ${isActive('/consumer') ? 'text-system-text' : ''}`}
                    >
                      Marketplace
                    </button>
                    <button 
                      onClick={() => navigate('/consumer/suppliers')} 
                      className={`transition-colors hover:text-system-text ${isActive('/consumer/suppliers') ? 'text-system-text' : ''}`}
                    >
                      Suppliers
                    </button>
                    <button 
                      onClick={() => navigate('/consumer/orders')} 
                      className={`transition-colors hover:text-system-text ${isActive('/consumer/orders') ? 'text-system-text' : ''}`}
                    >
                      Orders
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => navigate('/supplier')} 
                      className={`transition-colors hover:text-system-text ${isActive('/supplier') ? 'text-system-text' : ''}`}
                    >
                      Overview
                    </button>
                    <button 
                      onClick={() => navigate('/supplier/products')} 
                      className={`transition-colors hover:text-system-text ${isActive('/supplier/products') ? 'text-system-text' : ''}`}
                    >
                      Catalog
                    </button>
                    <button 
                      onClick={() => navigate('/supplier/orders')} 
                      className={`transition-colors hover:text-system-text ${isActive('/supplier/orders') ? 'text-system-text' : ''}`}
                    >
                      Orders
                    </button>
                  </>
                )}
                <button 
                  onClick={() => navigate('/chat')} 
                  className={`transition-colors hover:text-system-text ${isChat ? 'text-system-blue font-semibold' : ''}`}
                >
                  Messages
                </button>
              </nav>
              
              <div className="flex items-center space-x-4 pl-4 border-l border-system-border">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-medium text-system-text">{user.email}</div>
                  <div className="text-[10px] text-system-textSec uppercase tracking-wider">
                    {user.role.replace('SUPPLIER_', '').toLowerCase()}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    logout();
                    setUser(null);
                    navigate('/login');
                  }} 
                  className="text-system-textSec hover:text-system-red transition-colors p-1"
                  title="Logout"
                >
                  <LogoutIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-500">
        {children}
      </main>

      <footer className="py-8 text-center text-xs text-system-textSec border-t border-system-border mt-8">
        <p>SCP Inc. © 2025. All rights reserved.</p>
      </footer>
    </div>
  );
};

// --- Protected Route Wrapper ---
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: UserRole[] }> = ({ children, allowedRoles }) => {
  const { user } = useApp();
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles) {
    const hasPermission = allowedRoles.some(role => 
      role === user.role || (role.startsWith('SUPPLIER') && user.role.startsWith('SUPPLIER'))
    );
    if (!hasPermission) return (
      <div className="h-64 flex flex-col items-center justify-center text-system-textSec">
        <span className="text-4xl mb-4">🚫</span>
        <h2 className="text-xl font-semibold text-system-text">Access Denied</h2>
        <p className="mt-2">You don't have permission to view this page.</p>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUserFromToken();
    setUser(u);
    setLoading(false);
  }, []);

  const addToCart = (product: any, qty: number) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + qty } : p);
      }
      return [...prev, { ...product, quantity: qty }];
    });
  };

  const clearCart = () => setCart([]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-system-bg">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-10 h-10 bg-system-border rounded-lg mb-4"></div>
        <div className="h-4 w-32 bg-system-border rounded"></div>
      </div>
    </div>
  );

  return (
    <AppContext.Provider value={{ user, setUser, cart, addToCart, clearCart }}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Root Redirect */}
          <Route path="/" element={
            user ? (
              <Navigate to={user.role === UserRole.CONSUMER ? "/consumer" : "/supplier"} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } />

          {/* Consumer Routes */}
          <Route path="/consumer/*" element={
            <ProtectedRoute allowedRoles={[UserRole.CONSUMER]}>
              <ConsumerDashboard />
            </ProtectedRoute>
          } />

          {/* Supplier Routes */}
          <Route path="/supplier/*" element={
            <ProtectedRoute allowedRoles={[UserRole.SUPPLIER_OWNER, UserRole.SUPPLIER_MANAGER, UserRole.SUPPLIER_SALES]}>
              <SupplierDashboard />
            </ProtectedRoute>
          } />

           {/* Shared Routes */}
           <Route path="/chat" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />

        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}