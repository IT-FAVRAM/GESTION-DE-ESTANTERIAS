import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import type { PinnedUrgency } from '../../lib/schema/chat';

interface PinnedUrgenciesBarProps {
  urgencies: PinnedUrgency[];
  currentUid: string | null;
  currentRole?: string | null;
  onRefresh?: () => void;
}

/**
 * Barra sticky superior que muestra los avisos fijados.
 * Color llamativo (rojo/naranja) como Microsoft Teams.
 * Los autorizados pueden eliminar (botón X).
 */
export const PinnedUrgenciesBar: React.FC<PinnedUrgenciesBarProps> = ({
  urgencies,
  currentUid,
  currentRole,
  onRefresh,
}) => {
  const [removing, setRemoving] = useState<string | null>(null);

  const isAuthorized = currentRole === 'ADMIN' || currentRole === 'SUPERADMIN';

  const handleRemove = async (pinnedId: string) => {
    if (!isAuthorized) return;

    setRemoving(pinnedId);
    try {
      const functions = getFunctions();
      const removeFn = httpsCallable(functions, 'removePinnedUrgency');
      await removeFn({ pinnedId });
      onRefresh?.();
    } catch (e) {
      console.error('Error removing urgency:', e);
    } finally {
      setRemoving(null);
    }
  };

  if (urgencies.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 space-y-1 bg-gradient-to-r from-red-900 via-orange-800 to-red-900 border-b-2 border-orange-600 p-3 shadow-lg">
      {urgencies.map((urgency) => (
        <div
          key={urgency.id}
          className="flex items-center justify-between gap-3 bg-black/30 rounded-md p-3 backdrop-blur-sm border border-orange-500/50"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertCircle className="h-5 w-5 text-orange-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-100 truncate">
                {urgency.articleCode}{urgency.articleName ? ` — ${urgency.articleName}` : ''}
              </p>
              <p className="text-xs text-orange-200 mt-1">
                OF: <span className="font-mono font-bold">{urgency.orderNumber || urgency.orderId}</span>
              </p>
              {urgency.text && (
                <p className="text-xs text-orange-50 mt-1 line-clamp-2">{urgency.text}</p>
              )}
              <p className="text-xs text-orange-200/60 mt-1">
                Fijado por {urgency.pinnedByName}
              </p>
            </div>
          </div>

          {isAuthorized && (
            <button
              onClick={() => handleRemove(urgency.id!)}
              disabled={removing === urgency.id}
              className="p-1.5 hover:bg-red-700 rounded-md transition-colors flex-shrink-0 disabled:opacity-50"
              title="Desfijar aviso"
            >
              <X className="h-4 w-4 text-orange-300" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
