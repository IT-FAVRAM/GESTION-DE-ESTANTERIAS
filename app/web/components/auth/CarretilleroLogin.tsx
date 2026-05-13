/**
 * CarretilleroLogin — Login para el carretillero
 * Gestor de Estanterías WMS v3.0
 * @deprecated Replaced by `UnifiedLogin` in active V3 routing.
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import NumericKeypad from '../common/NumericKeypad';

const CarretilleroLogin: React.FC = () => {
  const { loginAsOperario, error } = useAuth();
  const [operarioId, setOperarioId] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!operarioId) return;
    
    setLoading(true);
    setLocalError(null);
    
    const success = await loginAsOperario(operarioId, 'CARRETILLERO');
    
    if (!success) {
      setLocalError(error || 'ID no reconocido');
    }
    
    setLoading(false);
  }, [operarioId, loginAsOperario, error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-orange-950 via-slate-900 to-slate-900 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-4">
          <span className="text-4xl">🚚</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          CARRETILLERO
        </h1>
        <p className="text-slate-400 mt-3 text-lg">
          Introduce tu número de empleado
        </p>
      </div>

      {/* Keypad */}
      <div className="w-full max-w-sm">
        <NumericKeypad
          value={operarioId}
          onChange={setOperarioId}
          onConfirm={handleConfirm}
          maxDigits={3}
          loading={loading}
          error={localError || error}
          placeholder="Nº empleado"
        />
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-slate-600">
          WMS v3.0 · Modo Carretillero
        </p>
      </div>
    </div>
  );
};

export default CarretilleroLogin;
