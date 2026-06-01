
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useFormFactor } from '../../hooks/useFormFactor';
import { LogoIcon, LoadingIcon, ErrorIcon, UserIcon } from '../icons/Icons';
import type { UserRole, WarehouseSection } from '../../lib/firestoreSchema';
import CarretilleroLogin from './CarretilleroLogin';

const UnifiedLogin: React.FC = () => {
  const { loginWithEmail, loginAsGuest, loading, error: authError } = useAuth();
  const formFactor = useFormFactor();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [showCarretilleroLogin, setShowCarretilleroLogin] = useState(false);
  const [emailLoginHint, setEmailLoginHint] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setLocalError(null);
    const success = await loginWithEmail(email, password, rememberMe);
    if (!success) {
      setLocalError("Credenciales incorrectas o error de conexión.");
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
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cyan-500 outline-none text-slate-900 dark:text-white transition-all font-medium"
                placeholder="usuario@empresa.com"
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
    <div className="h-dvh flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-4 sm:p-6 animate-fade-in overflow-hidden">
      <div className="w-full max-w-4xl flex flex-col gap-3 sm:gap-8">

        {/* Header — compacto en móvil */}
        <div className="flex flex-col items-center gap-2 sm:gap-6 text-center">
          <div className="p-3 sm:p-6 bg-white dark:bg-slate-900 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800">
            <LogoIcon className="h-10 w-10 sm:h-16 sm:w-16 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div className="space-y-0.5 sm:space-y-2">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
              WMS <span className="text-cyan-500">CONTROL</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-lg font-medium">Selección de Perfil</p>
          </div>
        </div>

        {/* Role Selection Grid — 2×2 en móvil, 4 cols en desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <RoleCard
            icon={<div className="text-2xl sm:text-4xl">🏭</div>}
            title="KIOSKO"
            description="Operario · MEC"
            color="blue"
            onClick={() => handleQuickAccess('OPERARIO', 'MECANIZADO')}
            disabled={localLoading || loading}
          />
          <RoleCard
            icon={<div className="text-2xl sm:text-4xl">🚜</div>}
            title="CARRETILLA"
            description="Logística"
            color="amber"
            onClick={() => handleQuickAccess('CARRETILLERO')}
            disabled={localLoading || loading}
          />
          <RoleCard
            icon={<div className="text-2xl sm:text-4xl">🛡️</div>}
            title="ADMIN"
            description={formFactor === 'desktop' ? 'Acceso rápido' : 'Con cuenta'}
            color="slate"
            onClick={() => {
              if (formFactor === 'desktop') {
                handleQuickAccess('ADMIN');
              } else {
                setEmailLoginHint('Para operar manualmente y navegar estanterias como ADMIN o SUPERADMIN entra con cuenta autorizada.');
                setShowEmailLogin(true);
              }
            }}
            disabled={localLoading || loading}
          />
          <RoleCard
            icon={<div className="text-2xl sm:text-4xl">🔍</div>}
            title="CALIDAD"
            description={formFactor === 'desktop' ? 'Acceso rápido' : 'Con cuenta'}
            color="emerald"
            onClick={() => {
              if (formFactor === 'desktop') {
                handleQuickAccess('CALIDAD');
              } else {
                setEmailLoginHint('Para editar reprocesos, cantidades e importes entra con correo y contraseña de CALIDAD.');
                setShowEmailLogin(true);
              }
            }}
            disabled={localLoading || loading}
          />
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 sm:gap-6">
          {(localError || authError) && (
            <div className="w-full max-w-xl rounded-2xl border border-red-900/50 bg-red-950/35 px-4 py-3 text-sm font-bold text-red-200 flex items-center gap-3">
              <ErrorIcon className="h-5 w-5" />
              <span>{localError || authError}</span>
            </div>
          )}

          {/* Botones de acceso */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <button
              onClick={() => {
                setEmailLoginHint(null);
                setShowEmailLogin(true);
              }}
              className="group flex items-center gap-2 sm:gap-3 px-5 py-2.5 sm:px-6 sm:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <div className="p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-cyan-50 dark:group-hover:bg-cyan-900/30 transition-colors">
                <UserIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Entrar con cuenta
              </span>
            </button>

            <button
              onClick={() => setShowCarretilleroLogin(true)}
              className="group flex items-center gap-2 sm:gap-3 px-5 py-2.5 sm:px-6 sm:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <div className="p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-amber-50 dark:group-hover:bg-amber-900/30 transition-colors">
                <span className="text-lg">🚜</span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Soy carretillero
              </span>
            </button>
          </div>

          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            WMS v3.1 • Advanced Warehouse System
          </p>
        </div>

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


