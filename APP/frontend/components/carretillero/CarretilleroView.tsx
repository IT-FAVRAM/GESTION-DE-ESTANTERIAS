/**
 * CarretilleroView — Vista principal del carretillero
 * Gestor de Estanterías WMS v3.0
 * 
 * 2 pestañas: ESTANTERÍAS (navegador) y RECOGIDAS (cola de solicitudes)
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import ShelfNavigator, { type NavAction } from './ShelfNavigator';
import PickupQueue from './PickupQueue';
import CarrosView from './CarrosView';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

type CarretilleroTab = 'shelves' | 'pickups' | 'carts';

interface CarretilleroViewProps {
  onBack?: () => void;
  initialTab?: CarretilleroTab;
}

const CarretilleroView: React.FC<CarretilleroViewProps> = ({ onBack, initialTab = 'shelves' }) => {
  const { displayName, operarioId, logout } = useAuth();
  const { pendingCount } = usePickupQueue();
  const [activeTab, setActiveTab] = useState<CarretilleroTab>(initialTab);
  const [currentShelfAction, setCurrentShelfAction] = useState<NavAction>('idle');
  const [pendingShelfAction, setPendingShelfAction] = useState<NavAction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [currentShelfCode, setCurrentShelfCode] = useState<string>(SHELF_DEFINITIONS[0]?.code ?? 'MEC');
  const [pendingShelfSelect, setPendingShelfSelect] = useState<string | null>(null);
  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
       {/* Header */}
       <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
         <div className="flex items-center justify-between gap-2">
           <div className="flex items-center gap-3 min-w-0">
             <span className="text-2xl">🚚</span>
             <div className="min-w-0">
               <h1 className="text-lg font-black text-slate-900 tracking-tight">CARRETILLERO</h1>
               <p className="text-xs text-slate-500 truncate">{displayName} · ID: {operarioId}</p>
             </div>
           </div>
           {activeTab === 'shelves' && currentShelfAction === 'idle' && (
             <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
               <button onClick={() => setPendingShelfAction('ubicar')}
                 className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                 📦 UBICAR
               </button>
               <button onClick={() => setPendingShelfAction('retirar')}
                 className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                 📤 RETIRAR
               </button>
               <button onClick={() => setPendingShelfAction('mover')}
                 className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap">
                 🔄 MOVER
               </button>
             </div>
           )}
           <div className="flex gap-1 flex-shrink-0">
             <button onClick={() => setActiveTab('pickups')}
               className={`px-2 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                 activeTab === 'pickups'
                   ? 'bg-orange-500 text-white shadow-md'
                   : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
               }`}>
               📦 RECOGIDAS{pendingCount > 0 && <span className="ml-1 font-black">({pendingCount})</span>}
             </button>
             <button
               onClick={onBack ? onBack : logout}
               className="px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 whitespace-nowrap">
               {onBack ? 'Volver' : 'Salir'}
             </button>
           </div>
         </div>
       </header>


       {/* Content */}
       <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden flex flex-row">
         {activeTab === 'shelves' && (
           <aside className={`flex-shrink-0 bg-slate-100 border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${sidebarOpen && currentShelfAction === 'idle' ? 'w-44 sm:w-48' : 'w-10'}`}>
             {/* Toggle */}
             <button onClick={() => setSidebarOpen(o => !o)}
               className="flex-shrink-0 h-10 w-full flex items-center justify-center border-b border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 font-bold text-lg">
               {sidebarOpen && currentShelfAction === 'idle' ? '‹' : '›'}
             </button>
             {sidebarOpen && currentShelfAction === 'idle' && (
               <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
                 <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Estanterías</p>
                 {SHELF_DEFINITIONS.map(shelf => (
                   <button key={shelf.code}
                     onClick={() => { setPendingShelfSelect(shelf.code); setCurrentShelfCode(shelf.code); }}
                     className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors truncate ${currentShelfCode === shelf.code ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-200'}`}>
                     {shelf.name}
                   </button>
                 ))}
               </div>
             )}
           </aside>
         )}
         <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
           {activeTab === 'shelves' ? (
             <ShelfNavigator
               onActionChange={setCurrentShelfAction}
               externalActionTrigger={pendingShelfAction}
               onExternalActionConsumed={() => setPendingShelfAction(null)}
               externalShelfTrigger={pendingShelfSelect}
               onExternalShelfConsumed={() => setPendingShelfSelect(null)}
             />
           ) : activeTab === 'pickups' ? (
             <div className="h-full overflow-y-auto">
               <PickupQueue />
             </div>
           ) : (
             <CarrosView />
           )}
         </div>
       </main>

    </div>
  );
};

export default CarretilleroView;


