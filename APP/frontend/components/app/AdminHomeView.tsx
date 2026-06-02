import React, { useState, useCallback, useRef, useMemo } from 'react';
import OfflineIndicator from '../common/OfflineIndicator';
import PushToast from './PushToast';
import ConfirmationModal from '../common/ConfirmationModal';
import TraerArticuloModal from '../kiosk/TraerArticuloModal';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import { SHELF_DEFINITIONS, ALL_SHELVES } from '../../lib/firestoreSchema';
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

  const shelves = useMemo(() => ALL_SHELVES.filter((s) => s.code !== 'COM'), []);

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
    const shelfDef = ALL_SHELVES.find((s) => s.code === selectedShelfCode);
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
    const shelfDef = ALL_SHELVES.find((s) => s.code === selectedShelfCode);
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
      <div className="h-dvh bg-slate-950 flex flex-col overflow-hidden">
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
              <button onClick={onLogout} className="px-4 py-2 bg-slate-800/80 text-slate-100 rounded-xl font-bold hover:bg-slate-700/80 hover:text-white transition-all duration-200">Salir</button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 max-w-6xl mx-auto w-full overflow-y-auto overscroll-contain pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {/* Operar — Estanterías + Carros */}
            <button
              type="button"
              onClick={onOpenOperativeMode}
              className="bg-gradient-to-br from-cyan-950/40 to-slate-900 rounded-2xl border border-cyan-500/40 p-5 flex flex-col gap-2 hover:border-cyan-400/50 active:scale-[0.98] transition-all cursor-pointer touch-manipulation shadow-lg shadow-cyan-950/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-2xl shrink-0">🏭</div>
                <div className="text-left">
                  <h3 className="font-black text-white text-base">Operar</h3>
                  <p className="text-xs text-cyan-300/70">Estanterías y carros</p>
                </div>
              </div>
            </button>

            {/* Historial */}
            <button
              type="button"
              onClick={onOpenTimeline}
              className="bg-slate-900 rounded-2xl border border-slate-700/50 p-5 flex flex-col items-start gap-2 hover:border-cyan-500/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">📋</div>
              <div>
                <h3 className="font-bold text-white text-sm">Historial</h3>
                <p className="text-xs text-slate-500 mt-0.5">Trazabilidad y recorrido de artículos</p>
              </div>
            </button>

            {/* Conexiones */}
            <button
              type="button"
              onClick={() => onOpenPanel('connections')}
              className="bg-slate-900 rounded-2xl border border-slate-700/50 p-5 flex flex-col items-start gap-2 hover:border-cyan-400/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">📡</div>
              <div>
                <h3 className="font-bold text-white text-sm">Conexiones</h3>
                <p className="text-xs text-slate-500 mt-0.5">Monitor wifi de todos los kioskos</p>
              </div>
            </button>

            {/* Avisar Carretillero */}
            <button
              type="button"
              onClick={() => openShelfPicker('avisar')}
              className="bg-slate-900 rounded-2xl border border-amber-500/20 p-5 flex flex-col items-start gap-2 hover:border-amber-400/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">🚚</div>
              <div>
                <h3 className="font-bold text-white text-sm">Avisar Carretillero</h3>
                <p className="text-xs text-slate-500 mt-0.5">Solicitar recogida en una estantería</p>
              </div>
            </button>

            {/* Solicitar Artículo */}
            <button
              type="button"
              onClick={() => openShelfPicker('traer')}
              className="bg-slate-900 rounded-2xl border border-emerald-500/20 p-5 flex flex-col items-start gap-2 hover:border-emerald-400/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">📦</div>
              <div>
                <h3 className="font-bold text-white text-sm">Solicitar Artículo</h3>
                <p className="text-xs text-slate-500 mt-0.5">Que traigan un artículo a tu sección</p>
              </div>
            </button>

            {/* Informes */}
            <button
              type="button"
              onClick={() => onOpenPanel('reports')}
              className="bg-slate-900 rounded-2xl border border-slate-700/50 p-5 flex flex-col items-start gap-2 hover:border-emerald-500/30 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">📊</div>
              <div>
                <h3 className="font-bold text-white text-sm">Informes</h3>
                <p className="text-xs text-slate-500 mt-0.5">Inventario, exportar Excel y métricas</p>
              </div>
            </button>

            {role === 'SUPERADMIN' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenPanel('team')}
                  className="bg-slate-900 rounded-2xl border border-slate-700/50 p-5 flex flex-col items-start gap-2 hover:border-cyan-500/30 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">👥</div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Usuarios y Dispositivos</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Roles, permisos y kioskos</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPanel('special')}
                  className="bg-slate-900 rounded-2xl border border-amber-500/20 p-5 flex flex-col items-start gap-2 hover:border-amber-500/30 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">🚨</div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Ubicaciones Especiales</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Urgentes y revisión técnica</p>
                  </div>
                </button>
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
            ? `¿Solicitar recogida para ${ALL_SHELVES.find((s) => s.code === selectedShelfCode)?.name || selectedShelfCode}? El carretillero recibirá un aviso.`
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


