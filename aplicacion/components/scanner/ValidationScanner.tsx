
import React, { useState, useRef, useEffect } from 'react';
import { LocationId } from '../lib/warehouseData';
import { CheckIcon, ErrorIcon, LoadingIcon } from './Icons';
import { parseLocationFromText } from '../lib/locationParser';

interface ValidationScannerProps {
  targetLocation: LocationId;
  onSuccess: () => void;
  onClose: () => void;
}

const ValidationScanner: React.FC<ValidationScannerProps> = ({ targetLocation, onSuccess, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleValidate = () => {
    const scannedText = inputValue.trim().toUpperCase();
    setValidationStatus('validating');

    const parsedLocation = parseLocationFromText(scannedText, {}, { strict: true });

    if (parsedLocation && parsedLocation === targetLocation) {
      setValidationStatus('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } else {
      setValidationStatus('error');
      setErrorMsg(`El código introducido (${scannedText}) no coincide con ${targetLocation}. Comprueba el código en el cartel y vuelve a intentarlo.`);
    }
  };

  const handleRetry = () => {
    setValidationStatus('idle');
    setInputValue('');
    setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 text-center border border-slate-800">

        {validationStatus === 'idle' && (
          <div>
            <h3 className="text-white font-bold text-xl mb-2">Validar Ubicación</h3>
            <p className="text-slate-400 text-sm mb-6">
              Introduce el código del cartel de la ubicación:<br />
              <span className="text-cyan-400 font-bold text-lg">{targetLocation}</span>
            </p>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && handleValidate()}
              placeholder={`Ej: ${targetLocation}`}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white font-bold rounded-xl text-center uppercase outline-none focus:border-cyan-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 bg-rose-800 text-rose-300 font-bold rounded-xl hover:bg-rose-700">
                Cancelar
              </button>
              <button
                onClick={handleValidate}
                disabled={!inputValue.trim()}
                className="flex-1 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 disabled:opacity-50"
              >
                Verificar
              </button>
            </div>
          </div>
        )}

        {validationStatus === 'validating' && (
          <div className="py-10">
            <LoadingIcon className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-white font-bold text-xl">Verificando Ubicación...</h3>
          </div>
        )}

        {validationStatus === 'success' && (
          <div className="py-10 animate-scale-in">
            <div className="h-20 w-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(34,197,94,0.5)]">
              <CheckIcon className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-white font-bold text-2xl">¡Ubicación Correcta!</h3>
            <p className="text-slate-400 mt-2">Guardando asignación...</p>
          </div>
        )}

        {validationStatus === 'error' && (
          <div className="py-6">
            <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <ErrorIcon className="h-8 w-8" />
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Error de Validación</h3>
            <p className="text-slate-300 text-sm mb-6">{errorMsg}</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 bg-rose-800 text-rose-300 font-bold rounded-xl hover:bg-rose-700">
                Cancelar
              </button>
              <button onClick={handleRetry} className="flex-1 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200">
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationScanner;


