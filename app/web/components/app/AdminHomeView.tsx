import React, { useState, useCallback, useRef, useMemo } from 'react';
import OfflineIndicator from '../common/OfflineIndicator';
import PushToast from './PushToast';
import ConfirmationModal from '../common/ConfirmationModal';
import TraerArticuloModal from '../kiosk/TraerArticuloModal';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
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

type PendingShelfAction = 'avisar' | 'traer';

const AdminHomeView: React.FC<AdminHomeViewProps> = ({ role, displayName, notification, onCloseNotification, onOpenPanel, onOpenShelfBrowser, onOpenTimeline, onOpenOperativeMode, onLogout }) => {
  const [showTraerModal, setShowTraerModal] = useState(false);
  const [showAvisarConfirm, setShowAvisarConfirm] = useState(false);
  const [showShelfPicker, setShowShelfPicker] = useState(false);
  const [pendingShelfAction, setPendingShelfAction] = useState<PendingShelfAction | null>(null);
  const [selectedShelfCode, setSelectedShelfCode] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { operarioId, firebaseUser } = useAuth();
  const { createPickupRequest, createDeliveryRequest } = usePickupQueue();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  const shelves = useMemo(() => SHELF_DEFINITIONS.filter((s) => s.code !== 'COM'), []);

  const showFeedback = useCallback((type: 'success' | 'error', msg: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ type, msg });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
  }, []);

  const openShelfPicker = useCallback((action: PendingShelfAction) => {
    setPendingShelfAction(action);
    setSelectedShelfCode('');
    setShowShelfPicker(true);
  }, []);

  const handleShelfSelected = useCallback((shelfCode: string) => {
    setSelectedShelfCode(shelfCode);
    setShowShelfPicker(false);
    setPendingShelfAction(null);

    if (pendingShelfAction === 'avisar') {
      setShowAvisarConfirm(true);
    } else if (pendingShelfAction === 'traer') {
      setShowTraerModal(true);
    }
  }, [pendingShelfAction]);

  const handleAvisarConfirm = async () => {
    if (!selectedShelfCode) return;
    const shelfDef = SHELF_DEFINITIONS.find((s) => s.code === selectedShelfCode);
    if (!shelfDef) return;

    setProcessing(true);
    setShowAvisarConfirm(false);
    const ok = await createPickupRequest(effectiveOperarioId, displayName, selectedShelfCode);
    setProcessing(false);
    if (ok) showFeedback('success', `✅ Carretillero avisado para ${shelfDef.name}`);
    else showFeedback('error', 'Error al enviar la solicitud');
  };

  const handleDeliveryRequest = async (
    articleCode: string,
    orderFab: string,
    artShelfCode: string,
    artShelfName: string,
    positions: string[],
  ) => {
    if (!selectedShelfCode) return;
    const shelfDef = SHELF_DEFINITIONS.find((s) => s.code === selectedShelfCode);
    if (!shelfDef) return;

    setProcessing(true);
    setShowTraerModal(false);
    const ok = await createDeliveryRequest(
      effectiveOperarioId, displayName,
      selectedShelfCode, shelfDef.name,
      articleCode, orderFab, artShelfName, positions,
    );
    setProcessing(false);
    if (ok) showFeedback('success', `✅ Solicitud enviada — artículo llegará a ${shelfDef.name}`);
    else showFeedback('error', 'Error al enviar la solicitud');
  };

  return (
    <>
      <OfflineIndicator />
      <PushToast notification={notification} onClose={onCloseNotification} />
      {feedback && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-2xl text-center font-bold text-sm shadow-2xl ${
          feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {feedback.msg}
        </div>
      )}
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
            {/* Monitor de conexiones — disponible para ADMIN y SUPERADMIN */}
            <div className="bg-slate-900 rounded-2xl border border-cyan-500/20 p-6 flex flex-col items-center gap-3 hover:border-cyan-400/50 transition-colors cursor-pointer" onClick={() => onOpenPanel('connections')}>
              <span className="text-4xl">📡</span>
              <h3 className="font-bold text-white">Conexiones</h3>
              <p className="text-xs text-slate-500 text-center">Monitor wifi en tiempo real de todos los kioskos</p>
            </div>
            {/* Historial — trazabilidad de artículos */}
            <div className="bg-slate-900 rounded-2xl border border-cyan-500/20 p-6 flex flex-col items-center gap-3 hover:border-cyan-500/50 transition-colors cursor-pointer" onClick={onOpenTimeline}>
              <span className="text-4xl">📋</span>
              <h3 className="font-bold text-white">Historial</h3>
              <p className="text-xs text-slate-500 text-center">Trazabilidad y recorrido de artículos</p>
            </div>
            {/* 🚚 Avisar Carretillero */}
            <div className="bg-slate-900 rounded-2xl border border-amber-500/20 p-6 flex flex-col items-center gap-3 hover:border-amber-400/50 transition-colors cursor-pointer" onClick={() => openShelfPicker('avisar')}>
              <span className="text-4xl">🚚</span>
              <h3 className="font-bold text-white">Avisar Carretillero</h3>
              <p className="text-xs text-slate-500 text-center">Solicitar recogida en una estantería</p>
            </div>
            {/* 📦 Solicitar Artículo */}
            <div className="bg-slate-900 rounded-2xl border border-emerald-500/20 p-6 flex flex-col items-center gap-3 hover:border-emerald-400/50 transition-colors cursor-pointer" onClick={() => openShelfPicker('traer')}>
              <span className="text-4xl">📦</span>
              <h3 className="font-bold text-white">Solicitar Artículo</h3>
              <p className="text-xs text-slate-500 text-center">Pedir que traigan un artículo a una estantería</p>
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

      {/* ─── Shelf Picker Modal ─── */}
      {showShelfPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-black text-white">
                {pendingShelfAction === 'avisar' ? '🚚 Selecciona estantería' : '📦 Selecciona estantería'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {pendingShelfAction === 'avisar'
                  ? '¿Para qué estantería quieres avisar al carretillero?'
                  : '¿En qué estantería quieres recibir el artículo?'}
              </p>
            </div>
            <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-2">
              {shelves.map((shelf) => (
                <button
                  key={shelf.code}
                  onClick={() => handleShelfSelected(shelf.code)}
                  className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500/50 rounded-xl px-4 py-3 transition-all active:scale-[0.98]"
                >
                  <span className="font-bold text-white">{shelf.name}</span>
                  <span className="text-xs text-slate-400 ml-2 font-mono">({shelf.code})</span>
                </button>
              ))}
            </div>
            <div className="px-6 pb-6 pt-2">
              <button
                onClick={() => { setShowShelfPicker(false); setPendingShelfAction(null); }}
                className="w-full h-12 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-sm font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={showAvisarConfirm}
        onClose={() => setShowAvisarConfirm(false)}
        title="🚚 Avisar Carretillero"
        message={
          selectedShelfCode
            ? `¿Solicitar recogida para ${SHELF_DEFINITIONS.find((s) => s.code === selectedShelfCode)?.name || selectedShelfCode}? El carretillero recibirá un aviso.`
            : 'Selecciona una estantería primero.'
        }
        icon="🚚"
        variant="warning"
        confirmText="SÍ, AVISAR"
        onConfirm={handleAvisarConfirm}
        loading={processing}
      />

      {showTraerModal && selectedShelfCode && (
        <TraerArticuloModal
          open={showTraerModal}
          currentShelfCode={selectedShelfCode}
          onClose={() => setShowTraerModal(false)}
          onConfirm={handleDeliveryRequest}
          loading={processing}
        />
      )}
    </>
  );
};

export default AdminHomeView;
