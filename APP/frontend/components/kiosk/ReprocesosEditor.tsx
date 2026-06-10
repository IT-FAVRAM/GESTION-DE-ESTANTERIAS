/**
 * ReprocesosEditor — Editor de reprocesos para Calidad
 * Gestor de Estanterías WMS v3.0
 *
 * Modal que permite editar cantidad e importe unitario
 * de artículos en ubicaciones de reproceso (CAL 001-022).
 */

import React, { useState, useCallback } from 'react';
import { updateReproceso, formatEuros } from '../../lib/api/reprocesosApi';

interface ReprocesosItem {
  presenceId?: string;
  articleCode: string;
  orderFab: string;
  quantity?: number;
  unitCost?: number;
  locatedAt?: string;
}

const daysAgo = (isoDate?: string): number | null => {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  if (isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000);
};

interface ReprocesosEditorProps {
  /** Posición de la celda (ej: "005") */
  position: string;
  /** Items en esta celda */
  items: ReprocesosItem[];
  /** Callback al cerrar el editor */
  onClose: () => void;
  /** Callback cuando se actualiza un item con éxito */
  onUpdated?: () => void;
}

type DraftItem = {
  articleCode: string;
  orderFab: string;
  quantity: string;
  unitCost: string;
};

const ReprocesosEditor: React.FC<ReprocesosEditorProps> = ({
  position,
  items,
  onClose,
  onUpdated,
}) => {
  const [editingValues, setEditingValues] = useState<
    Record<number, { quantity: string; unitCost: string }>
  >(() => {
    const initial: Record<number, { quantity: string; unitCost: string }> = {};
    items.forEach((item, idx) => {
      initial[idx] = {
        quantity: item.quantity?.toString() || '0',
        unitCost: item.unitCost?.toString() || '0',
      };
    });
    return initial;
  });
  const [saving, setSaving] = useState<number | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const [draftItem, setDraftItem] = useState<DraftItem>({
    articleCode: '',
    orderFab: '',
    quantity: '0',
    unitCost: '0',
  });
  const [savingDraft, setSavingDraft] = useState(false);

  const handleSave = useCallback(
    async (idx: number) => {
      const item = items[idx];
      const vals = editingValues[idx];
      if (!item || !vals) return;

      const quantity = parseFloat(vals.quantity) || 0;
      const unitCost = parseFloat(vals.unitCost) || 0;

      setSaving(idx);
      const ok = await updateReproceso(
        position,
        item.presenceId || '',
        item.articleCode,
        item.orderFab,
        quantity,
        unitCost,
      );
      setSaving(null);

      if (ok) {
        setSavedIdx(idx);
        setTimeout(() => setSavedIdx(null), 2000);
        onUpdated?.();
      }
    },
    [items, editingValues, position, onUpdated],
  );

  const handleValueChange = useCallback(
    (idx: number, field: 'quantity' | 'unitCost', value: string) => {
      setEditingValues((prev) => ({
        ...prev,
        [idx]: { ...prev[idx], [field]: value },
      }));
    },
    [],
  );

  const handleDraftChange = useCallback((field: keyof DraftItem, value: string) => {
    setDraftItem((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreate = useCallback(async () => {
    const articleCode = draftItem.articleCode.trim();
    const orderFab = draftItem.orderFab.trim();
    const quantity = parseFloat(draftItem.quantity) || 0;
    const unitCost = parseFloat(draftItem.unitCost) || 0;

    if (!articleCode || !orderFab) {
      return;
    }

    setSavingDraft(true);
    const ok = await updateReproceso(
      position,
      '',
      articleCode,
      orderFab,
      quantity,
      unitCost,
    );
    setSavingDraft(false);

    if (ok) {
      setDraftItem({ articleCode: '', orderFab: '', quantity: '0', unitCost: '0' });
      onUpdated?.();
    }
  }, [draftItem, onUpdated, position]);

  // Calculate total for all items
  const total = items.reduce((acc, _, idx) => {
    const vals = editingValues[idx];
    if (!vals) return acc;
    const qty = parseFloat(vals.quantity) || 0;
    const cost = parseFloat(vals.unitCost) || 0;
    return acc + qty * cost;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/50 px-5 py-4 flex items-center justify-between border-b border-slate-700">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              💰 Reprocesos — CAL {parseInt(position, 10).toString().padStart(3, '0')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Edita cantidad e importe de cada artículo
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-rose-700 text-rose-300 hover:bg-rose-600 flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-3 space-y-3">
            <div>
              <p className="text-sm font-bold text-white">Añadir artículo de reproceso</p>
              <p className="text-xs text-slate-400 mt-1">Crea un artículo nuevo en esta celda con su cantidad e importe unitario.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Codigo articulo</span>
                <input
                  type="text"
                  value={draftItem.articleCode}
                  onChange={(e) => handleDraftChange('articleCode', e.target.value)}
                  placeholder="Ej. 31890"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <label className="flex flex-col gap-1.5 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">OF</span>
                <input
                  type="text"
                  value={draftItem.orderFab}
                  onChange={(e) => handleDraftChange('orderFab', e.target.value)}
                  placeholder="Ej. OF-2451"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <label className="flex flex-col gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.08)]">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">Cantidad</span>
                <span className="text-[10px] text-slate-500">Numero de piezas en la celda</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={draftItem.quantity}
                  onChange={(e) => handleDraftChange('quantity', e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-lg font-black text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <label className="flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Precio unitario</span>
                <span className="text-[10px] text-slate-500">Importe por unidad en euros</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={draftItem.unitCost}
                  onChange={(e) => handleDraftChange('unitCost', e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-transparent text-lg font-black text-white outline-none placeholder:text-slate-600"
                />
              </label>
            </div>
            <button
              onClick={handleCreate}
              disabled={savingDraft || !draftItem.articleCode.trim() || !draftItem.orderFab.trim()}
              className="w-full rounded-xl bg-cyan-600 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingDraft ? 'Guardando...' : 'Añadir artículo a la celda'}
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-4">
              Sin artículos aún en esta ubicación.
            </p>
          )}

          {items.map((item, idx) => {
            const vals = editingValues[idx] || { quantity: '0', unitCost: '0' };
            const qty = parseFloat(vals.quantity) || 0;
            const cost = parseFloat(vals.unitCost) || 0;
            const subtotal = qty * cost;

            return (
              <div
                key={idx}
                className="bg-slate-800 rounded-xl border border-slate-700 p-3 space-y-2"
              >
                {/* Article info */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{item.articleCode}</p>
                    <p className="text-xs text-cyan-400">{item.orderFab}</p>
                    {(() => {
                      const days = daysAgo(item.locatedAt);
                      if (days === null) return null;
                      const color = days > 30 ? 'text-red-400' : days > 7 ? 'text-amber-400' : 'text-slate-500';
                      return (
                        <p className={`text-[11px] font-bold mt-0.5 ${color}`}>
                          ⏱ {days === 0 ? 'Hoy' : `${days} día${days !== 1 ? 's' : ''} aquí`}
                          {days > 30 && ' — revisar'}
                        </p>
                      );
                    })()}
                  </div>
                  {savedIdx === idx && (
                    <span className="text-xs text-emerald-400 font-bold animate-pulse shrink-0">
                      ✅ Guardado
                    </span>
                  )}
                </div>

                {/* Editable fields */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={vals.quantity}
                      onChange={(e) => handleValueChange(idx, 'quantity', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5
                        text-sm text-white text-center
                        focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold">
                      Importe €/ud
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={vals.unitCost}
                      onChange={(e) => handleValueChange(idx, 'unitCost', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5
                        text-sm text-white text-center
                        focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Subtotal + save */}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-400">
                    Subtotal: <span className="text-amber-300 font-bold">{formatEuros(subtotal)}</span>
                  </p>
                  <button
                    onClick={() => handleSave(idx)}
                    disabled={saving === idx}
                    className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg
                      hover:bg-emerald-500 active:scale-95 transition-all
                      disabled:opacity-50 disabled:cursor-wait"
                  >
                    {saving === idx ? '...' : 'Guardar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer total */}
        <div className="bg-slate-800/80 border-t border-slate-700 px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Total esta celda:</span>
          </p>
          <p className="text-lg font-black text-amber-300">{formatEuros(total)}</p>
        </div>
      </div>
    </div>
  );
};

export default ReprocesosEditor;


