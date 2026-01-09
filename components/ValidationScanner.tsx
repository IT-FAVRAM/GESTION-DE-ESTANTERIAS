
import React, { useState } from 'react';
import { LocationId } from '../lib/warehouseData';
import { CheckIcon, ErrorIcon, LoadingIcon, CameraIcon } from './Icons';
import PhotoAnalyzerModal from './PhotoAnalyzerModal';

interface ValidationScannerProps {
  targetLocation: LocationId;
  onSuccess: () => void; // Success now just triggers callback, no data passing needed really as parent has context
  onClose: () => void;
}

const ValidationScanner: React.FC<ValidationScannerProps> = ({ targetLocation, onSuccess, onClose }) => {
  const [isPhotoOpen, setIsPhotoOpen] = useState(true);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLocationExtracted = (result: string | { article: string; order: string }) => {
      // Expecting string from single mode
      const scannedText = typeof result === 'string' ? result : '';
      setValidationStatus('validating');
      setIsPhotoOpen(false);

      // Simple fuzzy check: Does the extracted text contain the target parts?
      // E.g. Target "MEC-E1-B2-IZQ". Sign might say "MEC 001" or "MEC 1".
      const cleanTarget = targetLocation.replace(/-/g, ' '); // MEC E1 B2 IZQ
      const parts = cleanTarget.split(' ');
      
      // Heuristic: Check if main warehouse code and shelf number are present
      const whCode = parts[0]; // MEC
      // Extract shelf number e.g. E1 -> 1
      const shelfPart = parts.find(p => p.startsWith('E'))?.replace('E', '') || '';
      
      const scannedUpper = scannedText.toUpperCase();
      
      // Basic validation logic
      const matchesWarehouse = scannedUpper.includes(whCode);
      const matchesShelf = scannedUpper.includes(shelfPart) || scannedUpper.includes(` ${shelfPart} `) || scannedUpper.endsWith(` ${shelfPart}`);
      
      // If sign is "MEC 001", check if scanned has "MEC" and "001" or "1"
      const shelfPad = shelfPart.padStart(3, '0');
      const matchesShelfPad = scannedUpper.includes(shelfPad);

      if (matchesWarehouse && (matchesShelf || matchesShelfPad)) {
          setValidationStatus('success');
          setTimeout(() => {
              onSuccess();
          }, 1500);
      } else {
          setValidationStatus('error');
          setErrorMsg(`El cartel escaneado (${scannedText}) no parece coincidir con ${targetLocation}. Asegúrate de que se vea el código de almacén y estantería.`);
      }
  };

  const handleRetry = () => {
      setValidationStatus('idle');
      setErrorMsg('');
      setIsPhotoOpen(true);
  };

  if (isPhotoOpen) {
      return (
          <PhotoAnalyzerModal 
              onCodeExtracted={handleLocationExtracted}
              onClose={onClose}
              instruction={`Cartel de ubicación: ${targetLocation}`}
              mode="single"
          />
      );
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 text-center border border-slate-800">
          
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
                      <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700">
                          Cancelar
                      </button>
                      <button onClick={handleRetry} className="flex-1 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200">
                          Reintentar Foto
                      </button>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default ValidationScanner;
