import React from 'react';
import OfflineIndicator from '../common/OfflineIndicator';
import PushToast from './PushToast';

interface ManagerInfoViewProps {
  role: 'JEFE_SECCION' | 'CALIDAD';
  displayName: string;
  notification: { title: string; body: string } | null;
  onCloseNotification: () => void;
  onOpenOperativeMode?: () => void;
  onLogout: () => Promise<void> | void;
}

const ManagerInfoView: React.FC<ManagerInfoViewProps> = ({ role, displayName, notification, onCloseNotification, onOpenOperativeMode, onLogout }) => (
  <>
    <OfflineIndicator />
    <PushToast notification={notification} onClose={onCloseNotification} />
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">{role === 'CALIDAD' ? '🔍' : '👷'}</span>
            <div>
              <h1 className="text-lg font-black text-white">{role === 'CALIDAD' ? 'Calidad' : 'Jefe de Seccion'}</h1>
              <p className="text-xs text-slate-400">{displayName}</p>
            </div>
          </div>
          <button onClick={onLogout} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700">Cerrar Sesion</button>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-white mb-4">🎯 Tu Rol: {role === 'CALIDAD' ? 'Control de Calidad' : 'Jefe de Sección'}</h2>
            <p className="text-slate-300 mb-4">
              {role === 'CALIDAD' 
                ? <><span className="font-bold text-cyan-300">Consumidor pasivo</span> de alertas. No tienes acceso a la operativa de estanterías.</>
                : <>Gestor de alertas y <span className="font-bold text-cyan-300">operativa en estanterías</span>.</>}
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl">
                <span className="text-xl">🔔</span>
                <div>
                  <p className="font-bold text-white">Notificaciones Push</p>
                  <p className="text-xs text-slate-400">Recibiras alertas automaticas en tu dispositivo</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold text-white">Alertas de Urgencia</p>
                  <p className="text-xs text-slate-400">
                    {role === 'CALIDAD' 
                      ? 'Articulos en ubicaciones de revision tecnica o urgentes (CAL-029, CAL-031, CAL-032, CAL-034).' 
                      : 'Articulos en ubicaciones urgentes de tu seccion.'}
                  </p>
                </div>
              </div>
              
              {role === 'JEFE_SECCION' ? (
                <div className="flex flex-col gap-3 p-4 bg-cyan-950/30 border border-cyan-900/50 rounded-xl mt-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📱</span>
                    <div>
                      <p className="font-bold text-white">Operativa Móvil</p>
                      <p className="text-xs text-slate-400">Escanea, ubica y retira artículos directamente con la cámara del dispositivo.</p>
                    </div>
                  </div>
                  <button 
                    onClick={onOpenOperativeMode}
                    className="w-full py-4 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.98]"
                  >
                    <span>📸</span> MODO OPERATIVO (Escanear)
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl">
                  <span className="text-xl">📊</span>
                  <div>
                    <p className="font-bold text-white">Sin Acceso Operativo</p>
                    <p className="text-xs text-slate-400">No puedes ubicar, retirar ni mover articulos. Contacta a un ADMIN o SUPERADMIN para cambios.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {role === 'CALIDAD' && (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <p className="font-bold text-amber-200">¿Necesitas operar estanterías?</p>
                  <p className="text-sm text-amber-100/80">Pide a un SUPERADMIN que cambie tu rol a ADMIN o CARRETILLERO.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  </>
);

export default ManagerInfoView;
