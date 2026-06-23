import React, { useState, useCallback, useRef } from 'react';
import OfflineIndicator from '../common/OfflineIndicator';
import PushToast from './PushToast';
import ConfirmationModal from '../common/ConfirmationModal';
import TraerArticuloModal, { type TraerSelection } from '../kiosk/TraerArticuloModal';
import CarretilleroPicker from '../carretillero/CarretilleroPicker';
import type { CarretilleroOption } from '../../lib/api/pickupQueueApi';
import { useAuth } from '../../hooks/useAuth';
import { usePickupQueue } from '../../hooks/usePickupQueue';
import type { WarehouseSection } from '../../lib/schema/sections';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';
import { SECTION_TO_SHELF } from '../../domain/auth/sectionShelf';

const SECTION_LABEL: Record<WarehouseSection, string> = {
  PRENSAS_MECANIZADO: 'Prensas-Mecanizado',
  PLEGADORA: 'Plegadora',
  SOLDADURA: 'Soldadura',
  SXP: 'Soldadura Puntos',
  AUTOPLEGADORA: 'Autoplegadora',
  REPASADO: 'Repasado',
  PINTURA: 'Pintura',
  LASER: 'Láser',
  CALIDAD: 'Calidad',
  PUNZONADO: 'Punzonado',
  OTROS: 'Otros',
};

interface ManagerInfoViewProps {
  role: 'JEFE_SECCION' | 'CALIDAD';
  displayName: string;
  section: WarehouseSection | null;
  notification: { title: string; body: string } | null;
  onCloseNotification: () => void;
  onOpenOperativeMode?: () => void;
  onLogout: () => Promise<void> | void;
}

const ManagerInfoView: React.FC<ManagerInfoViewProps> = ({ role, displayName, section, notification, onCloseNotification, onOpenOperativeMode, onLogout }) => {
  const [showTraerModal, setShowTraerModal] = useState(false);
  const [showAvisarConfirm, setShowAvisarConfirm] = useState(false);
  const [showCarretilleroPicker, setShowCarretilleroPicker] = useState(false);
  const [pendingAvisar, setPendingAvisar] = useState<'recogida' | 'traer' | null>(null);
  const [selectedCarretillero, setSelectedCarretillero] = useState<CarretilleroOption | null>(null);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { operarioId, firebaseUser } = useAuth();
  const { createPickupRequest, createDeliveryRequest } = usePickupQueue();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const shelfCode = role === 'JEFE_SECCION' && section ? (SECTION_TO_SHELF[section] ?? null) : null;
  const shelfDef = shelfCode ? SHELF_DEFINITIONS.find((s) => s.code === shelfCode) : null;

  const showFeedback = useCallback((type: 'success' | 'error', msg: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ type, msg });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
  }, []);

  // Paso 1: elegir carretillero, recordando qué solicitud sigue.
  const startAvisar = (kind: 'recogida' | 'traer') => {
    setPendingAvisar(kind);
    setShowCarretilleroPicker(true);
  };

  const handleCarretilleroPicked = (c: CarretilleroOption) => {
    setSelectedCarretillero(c);
    setShowCarretilleroPicker(false);
    if (pendingAvisar === 'recogida') setShowAvisarConfirm(true);
    else if (pendingAvisar === 'traer') setShowTraerModal(true);
  };

  const handleAvisarConfirm = async () => {
    if (!shelfCode || !shelfDef) { showFeedback('error', 'No tienes sección asignada'); return; }
    setProcessing(true);
    setShowAvisarConfirm(false);
    const ok = await createPickupRequest({
      operarioId: effectiveOperarioId, operarioName: displayName, shelfCode,
      targetCarretilleroId: selectedCarretillero?.uid,
      targetCarretilleroName: selectedCarretillero?.name,
    });
    setProcessing(false);
    if (ok) showFeedback('success', '✅ Carretillero avisado — recogida solicitada');
    else showFeedback('error', 'Error al enviar la solicitud');
  };

  const handleDeliveryRequest = async (selection: TraerSelection) => {
    if (!shelfCode || !shelfDef) { showFeedback('error', 'No tienes sección asignada'); return; }
    setProcessing(true);
    setShowTraerModal(false);
    const ok = await createDeliveryRequest({
      operarioId: effectiveOperarioId, operarioName: displayName,
      shelfCode, shelfName: shelfDef.name,
      articleCode: selection.articleCode, articleOrderFab: selection.articleOrderFab,
      articleShelfName: selection.articleShelfName, articlePositions: selection.articlePositions,
      destinationShelfCode: selection.destination.code, destinationShelfName: selection.destination.name,
      destinationSection: selection.destination.section, destinationStation: selection.destination.station,
      targetCarretilleroId: selectedCarretillero?.uid,
      targetCarretilleroName: selectedCarretillero?.name,
    });
    setProcessing(false);
    if (ok) showFeedback('success', '✅ Solicitud enviada — el carretillero traerá el artículo');
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
        <header className="bg-slate-900 border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{role === 'CALIDAD' ? '🔍' : '👷'}</span>
              <div>
                <h1 className="text-lg font-black text-white">{role === 'CALIDAD' ? 'Calidad' : 'Supervisor'}</h1>
                <p className="text-xs text-slate-400">
                  {displayName}
                  {role === 'JEFE_SECCION' && section && (
                    <span className="ml-2 text-cyan-400 font-semibold">· {SECTION_LABEL[section]}</span>
                  )}
                </p>
              </div>
            </div>
            <button onClick={onLogout} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700">Cerrar Sesión</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain p-6 pb-20">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black text-white mb-1">🎯 Tu Rol: {role === 'CALIDAD' ? 'Control de Calidad' : 'Supervisor'}</h2>
              {role === 'JEFE_SECCION' && section && (
                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-900/40 border border-cyan-700/50 rounded-xl">
                  <span className="text-cyan-300 text-sm font-black tracking-wide">{SECTION_LABEL[section]}</span>
                  <span className="text-cyan-500 text-xs">· tu sección</span>
                </div>
              )}
              {role === 'JEFE_SECCION' && !section && (
                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-900/40 border border-amber-700/50 rounded-xl">
                  <span className="text-amber-300 text-sm font-semibold">Sin sección asignada</span>
                  <span className="text-amber-500 text-xs">· pide a un SUPERADMIN que te asigne una</span>
                </div>
              )}
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
                      disabled={!shelfCode}
                      className="w-full py-4 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!shelfCode ? 'Debes tener una sección asignada para operar' : 'Accede al modo de escaneo y operativa'}
                    >
                      <span>📸</span> MODO OPERATIVO (Escanear)
                    </button>

                    {section && shelfCode && (
                      <>
                        <div className="border-t border-cyan-800/40 pt-3 mt-1">
                          <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Solicitudes al Carretillero</p>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => startAvisar('recogida')}
                              disabled={processing}
                              className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                              <span>🚚</span> AVISAR CARRETILLERO (Recoger)
                            </button>
                            <button
                              onClick={() => startAvisar('traer')}
                              disabled={processing}
                              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                              <span>📦</span> SOLICITAR ARTÍCULO (Traer)
                            </button>
                          </div>
                        </div>
                      </>
                    )}
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

      <CarretilleroPicker
        open={showCarretilleroPicker}
        onSelect={handleCarretilleroPicked}
        onClose={() => { setShowCarretilleroPicker(false); setPendingAvisar(null); }}
      />

      <ConfirmationModal
        open={showAvisarConfirm}
        onClose={() => setShowAvisarConfirm(false)}
        title="🚚 Avisar Carretillero"
        message={`¿Solicitar recogida para la estantería de ${SECTION_LABEL[section!]}?${selectedCarretillero ? ` Carretillero: ${selectedCarretillero.name}.` : ''} El carretillero se desplazará a tu sección para recoger los artículos pendientes.`}
        icon="🚚"
        variant="warning"
        confirmText="SÍ, AVISAR"
        onConfirm={handleAvisarConfirm}
        loading={processing}
      />

      {showTraerModal && (
        <TraerArticuloModal
          open={showTraerModal}
          currentShelfCode={shelfCode!}
          targetCarretilleroName={selectedCarretillero?.name}
          onClose={() => setShowTraerModal(false)}
          onConfirm={handleDeliveryRequest}
          loading={processing}
        />
      )}
    </>
  );
};

export default ManagerInfoView;


