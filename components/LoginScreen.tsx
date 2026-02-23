
import React, { useState } from 'react';
import { LogoIcon, LoadingIcon, ErrorIcon } from './Icons';
import { auth } from '../lib/firebase';

interface LoginScreenProps {
  onSuccess?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await auth.signInWithEmailAndPassword(email, password);
      if (onSuccess) onSuccess();
      // El cambio de estado se maneja en App.tsx vía onAuthStateChanged
    } catch (err: any) {
      console.error("Login failed", err);
      let msg = "Error al iniciar sesión.";

      // Mapeo de errores comunes
      switch (err.code) {
        case 'auth/invalid-email':
          msg = "El formato del correo electrónico no es válido.";
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          // Agrupamos errores de credenciales por seguridad y claridad
          msg = "Email o contraseña incorrectos.";
          break;
        case 'auth/too-many-requests':
          msg = "Demasiados intentos fallidos. Inténtalo más tarde.";
          break;
        case 'auth/network-request-failed':
          msg = "Error de conexión. Verifica tu internet.";
          break;
        default:
          if (err.message) msg = err.message;
      }

      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 animate-fade-in safe-area-inset-top safe-area-inset-bottom">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 flex flex-col gap-6">

        <div className="flex flex-col items-center gap-4 mb-2">
          <div className="p-4 bg-cyan-50 dark:bg-slate-800 rounded-2xl shadow-sm border border-cyan-100 dark:border-slate-700">
            <LogoIcon className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">GESTOR ESTANTERÍAS</h1>
            <p className="text-slate-500 dark:text-slate-400 text-base mt-1">Inicia sesión para acceder al inventario</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Correo Electrónico</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-slate-900 dark:text-white transition-all font-medium text-base disabled:opacity-50"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-slate-900 dark:text-white transition-all font-medium text-base disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl flex items-start gap-3 animate-shake">
              <ErrorIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg text-lg"
          >
            {isLoading ? <LoadingIcon className="h-6 w-6" /> : "Iniciar Sesión"}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-400">Sistema de Gestión de Inventario v2.2</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
