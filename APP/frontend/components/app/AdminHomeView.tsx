import React, { useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import OfflineIndicator from '../common/OfflineIndicator';
import PushToast from './PushToast';
import ConfirmationModal from '../common/ConfirmationModal';
import TraerArticuloModal, { type TraerSelection } from '../kiosk/TraerArticuloModal';
import CarretilleroPicker from '../carretillero/CarretilleroPicker';
import type { CarretilleroOption } from '../../lib/api/pickupQueueApi';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import { SHELF_DEFINITIONS, ALL_SHELVES } from '../../lib/firestoreSchema';
import type { AdminTab } from '../admin/adminShared';

const ChaperoView = lazy(() => import('../chapero/ChaperoView'));
const PieceCounterCamera = lazy(() => import('../common/PieceCounterCamera'));

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
  chatButton?: React.ReactNode;
}

type PendingShelfAction = 'avisar' | 'traer';

const AdminHomeView: React.FC<AdminHomeViewProps> = ({ role, displayName, notification, onCloseNotification, onOpenPanel, onOpenShelfBrowser, onOpenTimeline, onOpenOperativeMode, onLogout, chatButton }) => {
  const [showTraerModal, setShowTraerModal] = useState(false);
  const [showAvisarConfirm, setShowAvisarConfirm] = useState(false);
  const [showShelfPicker, setShowShelfPicker] = useState(false);
  const [showCarretilleroPicker, setShowCarretilleroPicker] = useState(false);
  const [selectedCarretillero, setSelectedCarretillero] = useState<CarretilleroOption | null>(null);
  const [showChapero, setShowChapero] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
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

  // Tras elegir estantería → elegir carretillero → ejecutar la acción pendiente.
  const handleShelfSelected = useCallback((shelfCode: string) => {
    setSelectedShelfCode(shelfCode);
    setShowShelfPicker(false);
    setShowCarretilleroPicker(true);
  }, []);

  const handleCarretilleroPicked = useCallback((c: CarretilleroOption) => {
    setSelectedCarretillero(c);
    setShowCarretilleroPicker(false);
    if (pendingShelfAction === 'avisar') setShowAvisarConfirm(true);
    else if (pendingShelfAction === 'traer') setShowTraerModal(true);
    setPendingShelfAction(null);
  }, [pendingShelfAction]);

  const handleAvisarConfirm = async () => {
    if (!selectedShelfCode) return;
    const shelfDef = ALL_SHELVES.find((s) => s.code === selectedShelfCode);
    if (!shelfDef) return;

    setProcessing(true);
    setShowAvisarConfirm(false);
    const ok = await createPickupRequest({
      operarioId: effectiveOperarioId, operarioName: displayName, shelfCode: selectedShelfCode,
      targetCarretilleroId: selectedCarretillero?.uid,
      targetCarretilleroName: selectedCarretillero?.name,
    });
    setProcessing(false);
    if (ok) showFeedback('success', `✅ Carretillero avisado para ${shelfDef.name}`);
    else showFeedback('error', 'Error al enviar la solicitud');
  };

  const handleDeliveryRequest = async (selection: TraerSelection) => {
    if (!selectedShelfCode) return;
    const shelfDef = ALL_SHELVES.find((s) => s.code === selectedShelfCode);
    if (!shelfDef) return;

    setProcessing(true);
    setShowTraerModal(false);
    const ok = await createDeliveryRequest({
      operarioId: effectiveOperarioId, operarioName: displayName,
      shelfCode: selectedShelfCode, shelfName: shelfDef.name,
      articleCode: selection.articleCode, articleOrderFab: selection.articleOrderFab,
      articleShelfName: selection.articleShelfName, articlePositions: selection.articlePositions,
      destinationShelfCode: selection.destination.code, destinationShelfName: selection.destination.name,
      destinationSection: selection.destination.section, destinationStation: selection.destination.station,
      targetCarretilleroId: selectedCarretillero?.uid,
      targetCarretilleroName: selectedCarretillero?.name,
    });
    setProcessing(false);
    if (ok) showFeedback('success', `✅ Solicitud enviada — artículo llegará a ${selection.destination.name}`);
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
      <div className="h-dvh bg-sky-50 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏭</span>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight">GESTOR ESTANTERIAS</h1>
                <p className="text-xs text-slate-500">{displayName} · {role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {chatButton}
              <button onClick={onLogout} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all duration-200">Salir</button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 max-w-6xl mx-auto w-full overflow-y-auto overscroll-contain pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {/* Operar — Estanterías + Carros */}
            <button
              type="button"
              onClick={onOpenOperativeMode}
              className="bg-cyan-50 rounded-2xl border border-cyan-200 p-5 flex flex-col gap-2 hover:border-cyan-400 active:scale-[0.98] transition-all cursor-pointer touch-manipulation shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-100 border border-cyan-200 flex items-center justify-center text-2xl shrink-0">🏭</div>
                <div className="text-left">
                  <h3 className="font-black text-slate-900 text-base">Operar</h3>
                  <p className="text-xs text-cyan-700">Estanterías y carros</p>
                </div>
              </div>
            </button>

            {/* Historial */}
            <button
              type="button"
              onClick={onOpenTimeline}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-start gap-2 hover:border-cyan-500/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">📋</div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Historial</h3>
                <p className="text-xs text-slate-500 mt-0.5">Trazabilidad y recorrido de artículos</p>
              </div>
            </button>

            {/* Conexiones */}
            <button
              type="button"
              onClick={() => onOpenPanel('connections')}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-start gap-2 hover:border-cyan-400/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">📡</div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Conexiones</h3>
                <p className="text-xs text-slate-500 mt-0.5">Monitor wifi de todos los kioskos</p>
              </div>
            </button>

            {/* Calidad WiFi */}
            <button
              type="button"
              onClick={() => onOpenPanel('wifi-quality')}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-start gap-2 hover:border-emerald-400/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">📶</div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Calidad WiFi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Analisis real de ancho de banda y latencia</p>
              </div>
            </button>

            {/* Chapero */}
            <button
              type="button"
              onClick={() => setShowChapero(true)}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-start gap-2 hover:border-slate-500/50 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">🔩</div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Chapero</h3>
                <p className="text-xs text-slate-500 mt-0.5">Gestión de chapas por material y espesor</p>
              </div>
            </button>

            {/* Contar piezas — solo SUPERADMIN */}
            {role === 'SUPERADMIN' && (
              <button
                type="button"
                onClick={() => setShowCounter(true)}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-start gap-2 hover:border-cyan-500/40 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">📐</div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Contar piezas</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Conteo por foto con IA</p>
                </div>
              </button>
            )}

            {/* Informes */}
            <button
              type="button"
              onClick={() => onOpenPanel('reports')}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-start gap-2 hover:border-emerald-500/30 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">📊</div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Informes</h3>
                <p className="text-xs text-slate-500 mt-0.5">Inventario, exportar Excel y métricas</p>
              </div>
            </button>

            {role === 'SUPERADMIN' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenPanel('team')}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-start gap-2 hover:border-cyan-500/30 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">👥</div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Usuarios y Dispositivos</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Roles, permisos y kioskos</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPanel('special')}
                  className="bg-white rounded-2xl border border-amber-200 p-5 flex flex-col items-start gap-2 hover:border-amber-400 active:scale-[0.98] transition-all cursor-pointer text-left touch-manipulation shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl">🚨</div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Ubicaciones Especiales</h3>
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
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-black text-slate-900">
                {pendingShelfAction === 'avisar' ? '🚚 Selecciona estantería' : '📦 Selecciona estantería'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
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
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-cyan-400 rounded-xl px-4 py-3 transition-all active:scale-[0.98]"
                >
                  <span className="font-bold text-slate-900">{shelf.name}</span>
                  <span className="text-xs text-slate-500 ml-2 font-mono">({shelf.code})</span>
                </button>
              ))}
            </div>
            <div className="px-6 pb-6 pt-2">
              <button
                onClick={() => { setShowShelfPicker(false); setPendingShelfAction(null); }}
                className="w-full h-12 rounded-xl bg-rose-700 hover:bg-rose-600 text-rose-200 hover:text-white text-sm font-bold border border-rose-600 transition-all active:scale-[0.98]"
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

      <CarretilleroPicker
        open={showCarretilleroPicker}
        onSelect={handleCarretilleroPicked}
        onClose={() => { setShowCarretilleroPicker(false); setPendingShelfAction(null); }}
      />

      {showTraerModal && selectedShelfCode && (
        <TraerArticuloModal
          open={showTraerModal}
          currentShelfCode={selectedShelfCode}
          targetCarretilleroName={selectedCarretillero?.name}
          onClose={() => setShowTraerModal(false)}
          onConfirm={handleDeliveryRequest}
          loading={processing}
        />
      )}

      {showChapero && (
        <div className="fixed inset-0 z-50">
          <Suspense fallback={<div className="flex items-center justify-center h-full bg-sky-50 text-slate-600">Cargando chapero…</div>}>
            <ChaperoView onClose={() => setShowChapero(false)} />
          </Suspense>
        </div>
      )}

      {showCounter && role === 'SUPERADMIN' && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-50 text-slate-600">Cargando contador…</div>}>
          <PieceCounterCamera onClose={() => setShowCounter(false)} />
        </Suspense>
      )}
    </>
  );
};

export default AdminHomeView;


