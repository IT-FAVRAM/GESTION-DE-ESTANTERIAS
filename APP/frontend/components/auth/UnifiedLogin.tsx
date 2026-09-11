
import React, { useState } from 'react';
import { Truck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFormFactor } from '../../hooks/useFormFactor';
import { LogoIcon, LoadingIcon, ErrorIcon, UserIcon } from '../icons/Icons';
import type { UserRole, WarehouseSection } from '../../lib/firestoreSchema';
import CarretilleroLogin from './CarretilleroLogin';
import { resolveEmailFromNameOrEmail } from '../../lib/auth/flexiblePasswordSignIn';

const UnifiedLogin: React.FC = () => {
  const { loginWithEmail, loginAsGuest, loading, error: authError } = useAuth();
  const formFactor = useFormFactor();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [showCarretilleroLogin, setShowCarretilleroLogin] = useState(false);
  const [emailLoginHint, setEmailLoginHint] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setLocalError(null);
    try {
      // Permitir login por email O por nombre de usuario (ej: MARIO)
      const resolvedEmail = await resolveEmailFromNameOrEmail(email);
      const success = await loginWithEmail(resolvedEmail, password, rememberMe);
      if (!success) {
        setLocalError("Credenciales incorrectas o error de conexión.");
      }
    } catch (err: any) {
      setLocalError(err.message || "Credenciales incorrectas o error de conexión.");
    }
    setLocalLoading(false);
  };

  const handleQuickAccess = async (role: UserRole, section?: WarehouseSection) => {
    setLocalLoading(true);
    setLocalError(null);
    const success = await loginAsGuest(role, section);
    if (!success) {
      // Permitimos que se muestre el error detallado de Firebase en authError.
      // Si por alguna razón no se estableciera, ponemos uno por defecto.
      setLocalError(null);
    }
    setLocalLoading(false);
  };

  if (showCarretilleroLogin) {
    return (
      <CarretilleroLogin
        onSuccess={() => {
          setShowCarretilleroLogin(false);
        }}
        onBack={() => setShowCarretilleroLogin(false)}
      />
    );
  }

  if (showEmailLogin) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 animate-fade-in">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-6">
          <button
            onClick={() => {
              setShowEmailLogin(false);
              setEmailLoginHint(null);
            }}
            className="self-start text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-2 text-sm font-bold transition-colors"
          >
            ← Volver a selección
          </button>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Acceso con cuenta</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Introduce tus credenciales autorizadas</p>
            {emailLoginHint && (
              <p className="text-xs font-bold text-amber-600 dark:text-amber-300">{emailLoginHint}</p>
            )}
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email o Nombre</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-900 dark:text-white transition-all font-medium"
                placeholder="usuario@empresa.com o MARIO"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-900 dark:text-white transition-all font-medium"
                placeholder="••••••••"
              />
            </div>

            {/* Recordar sesión */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Recordar sesión en este dispositivo
              </label>
            </div>

            {(localError || authError) && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold rounded-2xl flex items-center gap-3">
                <ErrorIcon className="h-5 w-5" />
                <span>{localError || authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={localLoading || loading}
              className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {localLoading || loading ? <LoadingIcon className="h-6 w-6 animate-spin" /> : "ENTRAR AL SISTEMA"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 animate-fade-in">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 sm:gap-10">

        {/* Logo + título */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
            <LogoIcon className="h-14 w-14 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              WMS <span className="text-cyan-500">CONTROL</span>
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Sistema de Gestión de Almacén</p>
          </div>
        </div>

        {/* Botones principales */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => { setEmailLoginHint(null); setShowEmailLogin(true); }}
            disabled={localLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-base rounded-2xl shadow-xl hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
          >
            <UserIcon className="h-5 w-5" />
            Acceder con cuenta
          </button>

          <button
            onClick={() => setShowCarretilleroLogin(true)}
            disabled={localLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-500 text-white font-black text-base rounded-2xl shadow-xl hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50"
          >
            <Truck className="h-5 w-5" aria-hidden />
            Soy carretillero
          </button>
        </div>

        {(localError || authError) && (
          <div className="w-full rounded-2xl border border-red-900/50 bg-red-950/35 px-4 py-3 text-sm font-bold text-red-200 flex items-center gap-3">
            <ErrorIcon className="h-5 w-5 shrink-0" />
            <span>{localError || authError}</span>
          </div>
        )}

        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          WMS v3.1 • Advanced Warehouse System
        </p>

      </div>
    </div>
  );
};

interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'amber' | 'slate' | 'emerald';
  onClick: () => void;
  disabled?: boolean;
}

const RoleCard: React.FC<RoleCardProps> = ({ icon, title, description, color, onClick, disabled }) => {
  const colors = {
    blue: 'hover:border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400',
    amber: 'hover:border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400',
    slate: 'hover:border-slate-500/60 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300',
    emerald: 'hover:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8
        bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800
        rounded-2xl sm:rounded-[2.5rem] shadow-lg sm:shadow-xl hover:shadow-2xl active:scale-95
        transition-all duration-300 disabled:opacity-50
        ${colors[color]}
      `}
    >
      <div className="p-3 sm:p-5 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-inner group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div className="text-center space-y-0.5 sm:space-y-1">
        <h3 className="text-sm sm:text-xl font-black tracking-tight">{title}</h3>
        <p className="text-[10px] sm:text-xs font-bold opacity-60 uppercase">{description}</p>
      </div>
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current animate-pulse" />
      </div>
    </button>
  );
};

export default UnifiedLogin;


