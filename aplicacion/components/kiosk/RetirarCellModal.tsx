import React, { useState, useCallback, useEffect } from 'react';
import type { LocationItem } from '../../lib/schema/locations';
import { fetchParcialesByPresence, type ParcialInfo } from '../../lib/parciales';

interface RetirarCellModalProps {
  open: boolean;
  position: string;
  items: LocationItem[];
  onConfirm: (selectedItems: LocationItem[]) => void;
  onClose: () => void;
  loading?: boolean;
}

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
};

const RetirarCellModal: React.FC<RetirarCellModalProps> = ({
  open,
  position,
  items,
  onConfirm,
  onClose,
  loading = false,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    // Pre-select all if only one item
    if (items.length === 1) return new Set([`${items[0].articleCode}__${items[0].orderFab}__${items[0].presenceId}`]);
    return new Set();
  });

  useEffect(() => {
    if (open) {
      if (items.length === 1) {
        setSelectedKeys(new Set([`${items[0].articleCode}__${items[0].orderFab}__${items[0].presenceId}`]));
      } else {
        setSelectedKeys(new Set());
      }
    }
  }, [open, items]);

  // Parciales: orden de llegada de cada artículo+OF en toda la nave (Parcial N de M).
  const [parciales, setParciales] = useState<Map<string, ParcialInfo>>(new Map());
  useEffect(() => {
    if (!open || items.length === 0) {
      setParciales(new Map());
      return;
    }
    let cancelled = false;
    fetchParcialesByPresence(items.map((i) => ({ articleCode: i.articleCode, orderFab: i.orderFab })))
      .then((map) => { if (!cancelled) setParciales(map); })
      .catch(() => { /* no crítico: simplemente no se muestra el badge */ });
    return () => { cancelled = true; };
  }, [open, items]);

  const handleToggle = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedKeys.size === items.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(items.map((item) => `${item.articleCode}__${item.orderFab}__${item.presenceId}`)));
    }
  }, [items, selectedKeys]);

  const handleConfirm = useCallback(() => {
    if (selectedKeys.size === 0) {
      // CRITICAL FIX: Validate that at least one item is selected
      console.warn('[RetirarCellModal] Attempted confirm with no selection');
      return; // Do not proceed if nothing selected
    }

    const selected = items.filter((item) =>
      selectedKeys.has(`${item.articleCode}__${item.orderFab}__${item.presenceId}`)
    );

    if (selected.length > 0) {
      onConfirm(selected);
    }
  }, [items, selectedKeys, onConfirm]);

  if (!open) return null;

  const posNum = parseInt(position, 10);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={loading ? undefined : onClose}>
      <div
        className="w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Retirar de</p>
              <h2 className="text-2xl font-black text-white">Posición {Number.isNaN(posNum) ? position : posNum}</h2>
            </div>
            <span className="text-sm text-slate-400 font-mono">{items.length} artículo(s)</span>
          </div>
        </div>

        {/* Items list with checkboxes */}
        <div className="px-4 py-4 space-y-2 max-h-72 overflow-y-auto">
          {items.length > 1 && (
            <button
              onClick={handleSelectAll}
              className="w-full px-3 py-2 rounded-xl border border-dashed border-slate-600 text-xs font-bold text-slate-400
                hover:border-slate-400 hover:text-slate-200 transition-colors"
            >
              {selectedKeys.size === items.length ? '— Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          )}

          {items.map((item) => {
            const key = `${item.articleCode}__${item.orderFab}__${item.presenceId}`;
            const isSelected = selectedKeys.has(key);
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'bg-red-950/40 border-red-500/50'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-red-500 border-red-500'
                      : 'bg-slate-800 border-slate-600'
                  }`}>
                    {isSelected && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-white text-base font-mono leading-tight truncate">
                        {item.articleCode}
                      </p>
                      {(() => {
                        const p = item.presenceId ? parciales.get(item.presenceId) : undefined;
                        if (!p || p.total <= 1) return null;
                        return (
                          <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-md px-1.5 py-0.5">
                            Parcial {p.index}/{p.total}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-red-300 font-mono mt-0.5">
                      {item.orderFab}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.locatedByName} · {formatDate(item.locatedAt)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="px-4 pb-6 pt-2 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={selectedKeys.size === 0 || loading}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-500 to-red-600
              text-white font-black text-lg shadow-lg shadow-red-950/40
              active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Retirando...
              </span>
            ) : (
              `RETIRAR ${selectedKeys.size} artículo(s)`
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full h-10 rounded-xl text-sm font-bold text-rose-400
              hover:text-white hover:bg-rose-800 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RetirarCellModal;

