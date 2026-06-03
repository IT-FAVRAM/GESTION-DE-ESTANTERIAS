import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { LoadingIcon, ErrorIcon } from '../icons/Icons';

interface CarretilleroLoginProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

const CARRETILLEROS = [
  { name: 'Oscar', email: 'oscar@carretillero.wms.local' },
  { name: 'Raul', email: 'raul@carretillero.wms.local' },
];

const CarretilleroLogin: React.FC<CarretilleroLoginProps> = ({ onSuccess, onBack }) => {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedName || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      // Establecer persistencia según "Recordar sesión"
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      const carretillero = CARRETILLEROS.find((c) => c.name === selectedName);
      if (!carretillero) throw new Error('Carretillero no válido');

      await signInWithEmailAndPassword(auth, carretillero.email, password);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Carretillero login failed', err);
      let msg = 'Error al iniciar sesión.';
      switch (err.code) {
        case 'auth/invalid-credential':
          msg = 'Contraseña incorrecta.';
          break;
        case 'auth/user-not-found':
          msg = 'Usuario no encontrado.';
          break;
        case 'auth/too-many-requests':
          msg = 'Demasiados intentos. Intenta más tarde.';
          break;
        default:
          if (err.message) msg = err.message;
      }
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-6">
        {/* Header con botón volver */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-2 text-sm font-bold transition-colors"
          >
            ← Volver
          </button>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Carretillero</h2>
          <div className="w-16" />
        </div>

        {/* Descripción */}
        <div className="text-center space-y-2">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Selecciona tu nombre e introduce tu contraseña
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Selección de nombre */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">
              Quién eres
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CARRETILLEROS.map((carretillero) => (
                <button
                  key={carretillero.name}
                  type="button"
                  onClick={() => setSelectedName(carretillero.name)}
                  className={`py-4 px-4 rounded-2xl font-bold text-center transition-all ${
                    selectedName === carretillero.name
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-amber-500'
                  }`}
                >
                  <div className="text-2xl mb-2">🚜</div>
                  <div className="text-sm">{carretillero.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Contraseña */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!selectedName}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white transition-all font-medium disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {/* Recordar sesión */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <label
              htmlFor="rememberMe"
              className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Recordar sesión en este dispositivo
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold rounded-2xl flex items-center gap-3">
              <ErrorIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !selectedName}
            className="w-full py-4 bg-amber-500 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <LoadingIcon className="h-6 w-6 animate-spin" />
                Verificando...
              </>
            ) : (
              'ENTRAR'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CarretilleroLogin;
