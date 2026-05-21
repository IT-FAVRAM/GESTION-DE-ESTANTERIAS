/**
 * CarretilleroView — Vista principal del carretillero
 * Gestor de Estanterías WMS v3.0
 * 
 * 2 pestañas: ESTANTERÍAS (navegador) y RECOGIDAS (cola de solicitudes)
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import CameraQRScanner from '../common/CameraQRScanner';
import ShelfNavigator from './ShelfNavigator';
import PickupQueue from './PickupQueue';
import CartEditor from './CartEditor';

type CarretilleroTab = 'shelves' | 'pickups' | 'carts';

interface CarretilleroViewProps {
  onBack?: () => void;
}

const CarretilleroView: React.FC<CarretilleroViewProps> = ({ onBack }) => {
  const { displayName, operarioId, logout } = useAuth();
  const { pendingCount } = usePickupQueue();
  const [activeTab, setActiveTab] = useState<CarretilleroTab>('shelves');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [lastScannedQR, setLastScannedQR] = useState<string | null>(null);

  const handleQRScan = useCallback((qrCode: string) => {
    setLastScannedQR(qrCode);
    // Log para debugging
    console.log('[CarretilleroView] QR escaneado:', qrCode);
    // Aquí se puede agregar lógica adicional si es necesaria
  }, []);

  return (
    <div className="h-dvh bg-slate-950 flex flex-col overflow-hidden">
       {/* Header */}
       <header className="flex-shrink-0 bg-slate-950/90 border-b border-slate-800/50 backdrop-blur-xl px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.15)]">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <span className="text-2xl">🚚</span>
             <div>
               <h1 className="text-lg font-black text-white tracking-tight">CARRETILLERO</h1>
               <p className="text-xs text-slate-200">{displayName} · ID: {operarioId}</p>
             </div>
           </div>
           <div className="flex gap-2">
             <button
               onClick={() => setShowCameraScanner(true)}
               className="px-3 py-2 text-xs font-bold bg-cyan-600/80 text-white rounded-lg hover:bg-cyan-700/80 transition-all duration-200 flex items-center gap-2"
               title="Escanear QR con cámara"
             >
               📷 Cámara
             </button>
             <button
               onClick={onBack ? onBack : logout}
               className="px-3 py-2 text-xs font-bold bg-slate-800/80 text-slate-100 rounded-lg hover:bg-slate-700/80 hover:text-white transition-all duration-200"
             >
               {onBack ? 'Volver' : 'Salir'}
             </button>
           </div>
         </div>
       </header>

       {/* Tab bar */}
       <div className="flex-shrink-0 bg-slate-950/80 border-b border-slate-700/50 backdrop-blur-sm px-2">
         <div className="flex gap-1">
           <button
             onClick={() => setActiveTab('shelves')}
             className={`flex-1 py-3 text-sm font-semibold transition-colors relative
               ${activeTab === 'shelves' ? 'text-cyan-200' : 'text-slate-300'}`}
           >
             🏭 ESTANTERÍAS
             {activeTab === 'shelves' && (
               <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500/80" />
             )}
           </button>
           <button
             onClick={() => setActiveTab('pickups')}
             className={`flex-1 py-3 text-sm font-semibold transition-colors relative
               ${activeTab === 'pickups' ? 'text-orange-200' : 'text-slate-300'}`}
           >
             📦 RECOGIDAS
             {pendingCount > 0 && (
               <span className="absolute top-1 right-1/4 w-6 h-6 flex items-center justify-center 
                 bg-red-500/80 text-white text-xs font-black rounded-full animate-pulse">
                 {pendingCount}
               </span>
             )}
             {activeTab === 'pickups' && (
               <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500/80" />
             )}
           </button>
           <button
             onClick={() => setActiveTab('carts')}
             className={`flex-1 py-3 text-sm font-semibold transition-colors relative
               ${activeTab === 'carts' ? 'text-emerald-200' : 'text-slate-300'}`}
           >
             🛒 CARROS
             {activeTab === 'carts' && (
               <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500/80" />
             )}
           </button>
         </div>
       </div>

       {/* Content */}
       <main className="flex-1 min-h-0 overflow-hidden">
         {activeTab === 'shelves' ? (
           <ShelfNavigator />
         ) : activeTab === 'pickups' ? (
           <div className="h-full overflow-y-auto">
             <PickupQueue />
           </div>
         ) : (
           <div className="h-full overflow-y-auto">
             <CartEditor />
           </div>
         )}
       </main>

       {/* Camera QR Scanner */}
       {showCameraScanner && (
         <CameraQRScanner
           onScan={handleQRScan}
           onClose={() => setShowCameraScanner(false)}
           onError={(error) => console.error('[CarretilleroView] Scanner error:', error)}
         />
       )}
    </div>
  );
};

export default CarretilleroView;
