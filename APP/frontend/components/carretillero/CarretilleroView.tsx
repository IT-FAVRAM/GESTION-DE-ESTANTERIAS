/**
 * CarretilleroView — Vista principal del carretillero
 * Gestor de Estanterías WMS v3.0
 * 
 * 2 pestañas: ESTANTERÍAS (navegador) y RECOGIDAS (cola de solicitudes)
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfNavigator from './ShelfNavigator';
import PickupQueue from './PickupQueue';
import CarrosView from './CarrosView';

type CarretilleroTab = 'shelves' | 'pickups' | 'carts';

interface CarretilleroViewProps {
  onBack?: () => void;
}

const CarretilleroView: React.FC<CarretilleroViewProps> = ({ onBack }) => {
  const { displayName, operarioId, logout } = useAuth();
  const { pendingCount } = usePickupQueue();
  const [activeTab, setActiveTab] = useState<CarretilleroTab>('shelves');
  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
       {/* Header */}
       <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <span className="text-2xl">🚚</span>
             <div>
               <h1 className="text-lg font-black text-slate-900 tracking-tight">CARRETILLERO</h1>
               <p className="text-xs text-slate-500">{displayName} · ID: {operarioId}</p>
             </div>
           </div>
           <div className="flex gap-2">
             <button
               onClick={onBack ? onBack : logout}
               className="px-3 py-2 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200"
             >
               {onBack ? 'Volver' : 'Salir'}
             </button>
           </div>
         </div>
       </header>

       {/* Tab bar */}
       <div className="flex-shrink-0 bg-white border-b border-slate-200 px-2">
         <div className="flex gap-1">
           <button
             onClick={() => setActiveTab('shelves')}
             className={`flex-1 py-3 text-sm font-semibold transition-colors relative
               ${activeTab === 'shelves' ? 'text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}
           >
             🏭 ESTANTERÍAS
             {activeTab === 'shelves' && (
               <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />
             )}
           </button>
           <button
             onClick={() => setActiveTab('pickups')}
             className={`flex-1 py-3 text-sm font-semibold transition-colors relative
               ${activeTab === 'pickups' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
             📦 RECOGIDAS
             {pendingCount > 0 && (
               <span className="absolute top-1 right-1/4 w-6 h-6 flex items-center justify-center
                 bg-red-500 text-white text-xs font-black rounded-full animate-pulse">
                 {pendingCount}
               </span>
             )}
             {activeTab === 'pickups' && (
               <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
             )}
           </button>
           <button
             onClick={() => setActiveTab('carts')}
             className={`flex-1 py-3 text-sm font-semibold transition-colors relative
               ${activeTab === 'carts' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
           >
             🛒 CARROS
             {activeTab === 'carts' && (
               <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
             )}
           </button>
         </div>
       </div>

       {/* Content */}
       <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
         {activeTab === 'shelves' ? (
           <ShelfNavigator />
         ) : activeTab === 'pickups' ? (
           <div className="h-full overflow-y-auto">
             <PickupQueue />
           </div>
         ) : (
           <CarrosView />
         )}
       </main>

    </div>
  );
};

export default CarretilleroView;


