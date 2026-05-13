/**
 * AdminLogin — Login con email y contraseña para roles admin
 * Gestor de Estanterías WMS v3.0
 * 
 * Para: JEFE_SECCION, CALIDAD, ADMIN, SUPERADMIN
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const AdminLogin: React.FC = () => {
  const { loginWithEmail, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email || !password) return;
    
    setLoading(true);
    await loginWithEmail(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-4 sm:p-6">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-6 sm:p-8 flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-4 mb-2">
          <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
            <span className="text-4xl">🏭</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-white tracking-tight">GESTOR ESTANTERÍAS</h1>
            <p className="text-slate-400 text-base mt-1">Panel de administración</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
              Correo Electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white transition-all font-medium text-base disabled:opacity-50 placeholder-slate-600"
              placeholder="usuario@favram.com"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white transition-all font-medium text-base disabled:opacity-50 placeholder-slate-600"
              placeholder="••••••••"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold rounded-xl flex items-start gap-3 animate-shake">
              <span className="text-xl">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="mt-2 w-full py-4 bg-cyan-500 text-white font-bold rounded-xl hover:bg-cyan-400 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg text-lg"
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Iniciando sesión...
              </span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-600">WMS v3.0 · Panel de Gestión</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
