import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { UrgentAlert } from '../../lib/schema/chat';

interface UrgentAlertsBarProps {
  alerts: UrgentAlert[];
  currentUid: string | null;
  currentRole?: string | null;
  onResolve: (alertId: string) => Promise<void>;
}

/**
 * Barra sticky que muestra las alertas de urgencia activas.
 * ADMIN/SUPERADMIN pueden marcarlas como resueltas.
 */
export const UrgentAlertsBar: React.FC<UrgentAlertsBarProps> = ({
  alerts,
  currentRole,
  onResolve,
}) => {
  const [resolving, setResolving] = useState<string | null>(null);

  const isAuthorized = currentRole === 'ADMIN' || currentRole === 'SUPERADMIN';

  const handleResolve = async (alertId: string) => {
    if (!isAuthorized || !alertId) return;
    setResolving(alertId);
    try {
      await onResolve(alertId);
    } catch (e) {
      console.error('[UrgentAlertsBar] Error resolviendo alerta:', e);
    } finally {
      setResolving(null);
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="sticky top-0 z-50 space-y-1 bg-gradient-to-r from-red-900 via-orange-800 to-red-900 border-b-2 border-orange-600 p-3 shadow-lg">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between gap-3 bg-black/30 rounded-md p-3 backdrop-blur-sm border border-orange-500/50"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertCircle className="h-5 w-5 text-orange-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-100 truncate">
                {alert.articleCode}{alert.articleName ? ` — ${alert.articleName}` : ''}
              </p>
              <p className="text-xs text-orange-200 mt-1">
                OF: <span className="font-mono font-bold">{alert.orderNumber || alert.orderId}</span>
              </p>
              {alert.text && (
                <p className="text-xs text-orange-50 mt-1 line-clamp-2">{alert.text}</p>
              )}
              <p className="text-xs text-orange-200/60 mt-1">
                Creado por {alert.createdByName}
              </p>
            </div>
          </div>

          {isAuthorized && (
            <button
              onClick={() => handleResolve(alert.id!)}
              disabled={resolving === alert.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-700/70 hover:bg-green-600 rounded-md transition-colors flex-shrink-0 disabled:opacity-50 text-xs font-bold text-white"
              title="Marcar como resuelto"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {resolving === alert.id ? '…' : 'Resolver'}
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
