import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setTokens, getUserFromToken } from '../services/api';
import { useApp } from '../App';
import { UserRole } from '../types';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CONSUMER);
  const [companyId, setCompanyId] = useState('1'); 
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const parsedCompanyId = companyId ? parseInt(companyId) : null;
        await api.register({ 
          email, 
          password, 
          role, 
          company_id: parsedCompanyId === 0 ? null : parsedCompanyId 
        });
        setIsRegister(false);
        setError('Registration successful. Please sign in.');
      } else {
        const tokens = await api.login({ email, password });
        setTokens(tokens.access_token, tokens.refresh_token);
        const user = getUserFromToken();
        setUser(user);
        if (user?.role === UserRole.CONSUMER) navigate('/consumer');
        else navigate('/supplier');
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-system-bg p-4">
      
      <div className="w-full max-w-[400px] bg-white p-10 rounded-2xl shadow-subtle">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-system-text text-white rounded-xl mx-auto flex items-center justify-center text-xl font-bold mb-4">S</div>
          <h1 className="text-2xl font-semibold text-system-text tracking-tight">
            {isRegister ? 'Create an Account' : 'Sign in to Platform'}
          </h1>
          <p className="text-system-textSec mt-2 text-sm">
            Welcome back. Please enter your details.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-system-red px-4 py-3 rounded-lg mb-6 text-sm font-medium flex items-center">
             <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
             {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Email</label>
            <input 
              type="email" 
              required 
              className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text placeholder-gray-400 focus:ring-2 focus:ring-system-blue transition-all outline-none"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Password</label>
            <input 
              type="password" 
              required 
              className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text placeholder-gray-400 focus:ring-2 focus:ring-system-blue transition-all outline-none"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {isRegister && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">I am a</label>
                <select 
                  className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text focus:ring-2 focus:ring-system-blue outline-none appearance-none"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                >
                  <option value={UserRole.CONSUMER}>Consumer (Restaurant/Hotel)</option>
                  <option value={UserRole.SUPPLIER_OWNER}>Supplier Owner</option>
                </select>
              </div>
              <div>
                 <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Company ID (Demo)</label>
                 <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                 />
                 <p className="text-[10px] text-system-textSec mt-1.5 ml-1">1 for Supplier, 2 for Consumer</p>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-system-blue hover:bg-system-blueHover text-white font-medium py-3.5 rounded-full transition-colors disabled:opacity-70 shadow-lg shadow-blue-500/30 mt-2"
          >
            {loading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-system-textSec">
          {isRegister ? 'Already have an account?' : "Don't have an account?"} 
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="ml-1 text-system-blue font-semibold hover:underline"
          >
            {isRegister ? 'Sign in' : 'Create account'}
          </button>
        </div>
      </div>

      {!isRegister && (
        <div className="mt-8 text-center">
           <p className="text-xs text-system-textSec uppercase tracking-widest font-semibold mb-2">Demo Accounts</p>
           <div className="flex gap-4 text-xs text-system-textSec">
              <span className="bg-white px-3 py-1 rounded-full border border-system-border">buyer@restaurant.com / pass123</span>
              <span className="bg-white px-3 py-1 rounded-full border border-system-border">owner@supplier.com / pass123</span>
           </div>
        </div>
      )}
    </div>
  );
}