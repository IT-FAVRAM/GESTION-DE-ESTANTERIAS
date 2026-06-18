/**
 * UrgentMissedAlertModal — Modal rojo BLOQUEANTE para avisos urgentes no recibidos.
 *
 * Se muestra al jefe de sección al volver a entrar cuando se ubicó algo urgente en su
 * estantería mientras no estaba conectado (el push se perdió). Lista todos los avisos
 * urgentes pendientes; el botón "Entendido" los marca como reconocidos.
 */
import React from 'react';
import type { PendingUrgentAlert } from '../../hooks/usePendingUrgentAlerts';

interface UrgentMissedAlertModalProps {
  alerts: PendingUrgentAlert[];
  onAcknowledge: () => void;
}

const formatWhen = (iso: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const UrgentMissedAlertModal: React.FC<UrgentMissedAlertModalProps> = ({ alerts, onAcknowledge }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white border-4 border-red-600 shadow-2xl overflow-hidden animate-pulse-once">
        <div className="bg-red-600 px-6 py-5 flex items-center gap-3">
          <span className="text-4xl">🚨</span>
          <div>
            <h2 className="text-2xl font-black text-white leading-tight">
              {alerts.length === 1 ? 'AVISO URGENTE' : `${alerts.length} AVISOS URGENTES`}
            </h2>
            <p className="text-red-100 text-sm font-bold">Se ubicó material urgente en tu estantería</p>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3">
              <p className="text-base font-black text-red-900 leading-tight">{a.title}</p>
              {a.body && <p className="text-sm text-red-800 mt-1 whitespace-pre-line">{a.body}</p>}
              {a.createdAt && (
                <p className="text-[11px] text-red-500 font-mono mt-1.5">{formatWhen(a.createdAt)}</p>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-red-200">
          <button
            onClick={onAcknowledge}
            className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-lg font-black active:scale-[0.98] transition-all touch-manipulation"
          >
            ✓ Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default UrgentMissedAlertModal;
