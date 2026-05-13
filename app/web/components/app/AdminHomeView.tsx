import React from 'react';
import OfflineIndicator from '../common/OfflineIndicator';
import PushToast from './PushToast';
import type { AdminTab } from '../admin/adminShared';

interface AdminHomeViewProps {
  role: 'ADMIN' | 'SUPERADMIN';
  displayName: string;
  notification: { title: string; body: string } | null;
  onCloseNotification: () => void;
  onOpenPanel: (tab: AdminTab) => void;
  onOpenShelfBrowser?: () => void;
  onOpenTimeline?: () => void;
  onOpenOperativeMode?: () => void;
  onLogout: () => Promise<void> | void;
}

const AdminHomeView: React.FC<AdminHomeViewProps> = ({ role, displayName, notification, onCloseNotification, onOpenPanel, onOpenShelfBrowser, onOpenTimeline, onOpenOperativeMode, onLogout }) => (
  <>
    <OfflineIndicator />
    <PushToast notification={notification} onClose={onCloseNotification} />
    <div className="min-h-dvh bg-slate-950 flex flex-col">
       <header className="bg-slate-950/90 border-b border-slate-800/50 backdrop-blur-xl px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.15)]">
         <div className="flex items-center justify-between max-w-6xl mx-auto">
           <div className="flex items-center gap-3">
             <span className="text-2xl">🏭</span>
             <div>
               <h1 className="text-lg font-black text-white tracking-tight">GESTOR ESTANTERIAS</h1>
               <p className="text-xs text-slate-200">{displayName} · {role}</p>
             </div>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={() => onOpenPanel('reports')} className="px-4 py-2 bg-cyan-600/80 text-slate-100 rounded-xl font-bold hover:bg-cyan-500/80 hover:text-white transition-all duration-200">{role === 'SUPERADMIN' ? '⚙️ Panel' : '📊 Panel'}</button>
             <button onClick={onLogout} className="px-4 py-2 bg-slate-800/80 text-slate-100 rounded-xl font-bold hover:bg-slate-700/80 hover:text-white transition-all duration-200">Salir</button>
           </div>
         </div>
       </header>

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {/* Modo Operativo — móvil */}
          <div className="bg-cyan-950/20 rounded-2xl border border-cyan-500/40 p-6 flex flex-col items-center gap-3 hover:border-cyan-400 transition-colors cursor-pointer" onClick={onOpenOperativeMode}>
            <span className="text-4xl">📸</span>
            <h3 className="font-bold text-white">Modo Operativo</h3>
            <p className="text-xs text-cyan-200 text-center">Escanear, ubicar y retirar con el móvil</p>
          </div>
          {/* Estanterías — visual de todas las secciones */}
          <div className="bg-slate-900 rounded-2xl border border-emerald-500/20 p-6 flex flex-col items-center gap-3 hover:border-emerald-500/50 transition-colors cursor-pointer" onClick={onOpenShelfBrowser}>
            <span className="text-4xl">🏭</span>
            <h3 className="font-bold text-white">Estanterías</h3>
            <p className="text-xs text-slate-500 text-center">Visual de todas las secciones y saturación</p>
          </div>
          {/* Historial — trazabilidad de artículos */}
          <div className="bg-slate-900 rounded-2xl border border-cyan-500/20 p-6 flex flex-col items-center gap-3 hover:border-cyan-500/50 transition-colors cursor-pointer" onClick={onOpenTimeline}>
            <span className="text-4xl">📋</span>
            <h3 className="font-bold text-white">Historial</h3>
            <p className="text-xs text-slate-500 text-center">Trazabilidad y recorrido de artículos</p>
          </div>
          {role === 'SUPERADMIN' && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col items-center gap-3 hover:border-cyan-500/30 transition-colors cursor-pointer" onClick={() => onOpenPanel('devices')}>
              <span className="text-4xl">📱</span>
              <h3 className="font-bold text-white">Dispositivos</h3>
              <p className="text-xs text-slate-500 text-center">Gestionar kioskos y tablets</p>
            </div>
          )}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col items-center gap-3 hover:border-emerald-500/30 transition-colors cursor-pointer" onClick={() => onOpenPanel('reports')}>
            <span className="text-4xl">📊</span>
            <h3 className="font-bold text-white">Informes</h3>
            <p className="text-xs text-slate-500 text-center">Exportar inventario y consultar metricas</p>
          </div>

          {role === 'SUPERADMIN' && (
            <>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col items-center gap-3 hover:border-cyan-500/30 transition-colors cursor-pointer" onClick={() => onOpenPanel('users')}>
                <span className="text-4xl">👥</span>
                <h3 className="font-bold text-white">Usuarios</h3>
                <p className="text-xs text-slate-500 text-center">Gestionar roles y permisos</p>
              </div>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col items-center gap-3 hover:border-amber-500/30 transition-colors cursor-pointer" onClick={() => onOpenPanel('special')}>
                <span className="text-4xl">🚨</span>
                <h3 className="font-bold text-white">Ubicaciones Especiales</h3>
                <p className="text-xs text-slate-500 text-center">Urgentes y revision tecnica</p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  </>
);

export default AdminHomeView;
