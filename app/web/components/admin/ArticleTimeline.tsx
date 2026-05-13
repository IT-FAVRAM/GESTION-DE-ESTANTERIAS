/**
 * ArticleTimeline — Trazabilidad de artículos
 * Gestor de Estanterías WMS v3.0
 *
 * Muestra el recorrido completo de un artículo por el taller,
 * desde su primera ubicación hasta su envío a almacén.
 */

import React, { useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebaseV3';
import { COLLECTIONS, getShelfDefinition } from '../../lib/firestoreSchema';

interface TimelineEntry {
  id: string;
  action: string;
  articleCode: string;
  orderFab: string;
  fromLocation: string | null;
  toLocation: string | null;
  shelfCode: string;
  operarioName: string;
  timestamp: string;
}

interface ArticleTimelineProps {
  onBack: () => void;
}

const ACTION_ICONS: Record<string, string> = {
  UBICAR: '📦',
  RETIRAR: '📤',
  MOVER: '🔄',
  ENVIAR_ALMACEN: '🏭',
  AVISAR_CARRETILLERO: '🚚',
};

const ACTION_COLORS: Record<string, string> = {
  UBICAR: 'border-emerald-500 bg-emerald-500/10',
  RETIRAR: 'border-red-500 bg-red-500/10',
  MOVER: 'border-blue-500 bg-blue-500/10',
  ENVIAR_ALMACEN: 'border-amber-500 bg-amber-500/10',
  AVISAR_CARRETILLERO: 'border-orange-500 bg-orange-500/10',
};

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const getShelfName = (code: string): string => {
  const shelf = getShelfDefinition(code);
  return shelf ? shelf.name : code;
};

const ArticleTimeline: React.FC<ArticleTimelineProps> = ({ onBack }) => {
  const [searchArticle, setSearchArticle] = useState('');
  const [searchOF, setSearchOF] = useState('');
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const article = searchArticle.trim().toUpperCase();
    const of = searchOF.trim().toUpperCase();
    if (!article && !of) return;

    setLoading(true);
    setSearched(true);
    try {
      const historyRef = collection(db, COLLECTIONS.HISTORY);
      let q;
      if (article && of) {
        q = query(
          historyRef,
          where('articleCode', '==', article),
          where('orderFab', '==', of),
          orderBy('timestamp', 'asc'),
          limit(100),
        );
      } else if (article) {
        q = query(
          historyRef,
          where('articleCode', '==', article),
          orderBy('timestamp', 'asc'),
          limit(100),
        );
      } else {
        q = query(
          historyRef,
          where('orderFab', '==', of),
          orderBy('timestamp', 'asc'),
          limit(100),
        );
      }

      const snap = await getDocs(q);
      const results: TimelineEntry[] = snap.docs.map((doc) => {
        const d = doc.data() as Record<string, any>;
        return {
          id: doc.id,
          action: d.action || '',
          articleCode: d.articleCode || '',
          orderFab: d.orderFab || '',
          fromLocation: d.fromLocation || null,
          toLocation: d.toLocation || null,
          shelfCode: d.shelfCode || '',
          operarioName: d.operarioName || d.user || '',
          timestamp: d.timestamp || '',
        };
      });

      setEntries(results);
    } catch (err) {
      console.error('[ArticleTimeline] Search error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [searchArticle, searchOF]);

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-black text-white">📋 Historial / Trazabilidad</h1>
            <p className="text-xs text-slate-400">Recorrido de artículos por el taller</p>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="p-4 max-w-3xl mx-auto w-full space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchArticle}
            onChange={(e) => setSearchArticle(e.target.value)}
            placeholder="Código artículo..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
              text-sm text-white placeholder-slate-500
              focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
          />
          <input
            type="text"
            value={searchOF}
            onChange={(e) => setSearchOF(e.target.value)}
            placeholder="OF (ej: OF26-00657)..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
              text-sm text-white placeholder-slate-500
              focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || (!searchArticle.trim() && !searchOF.trim())}
          className="w-full py-2.5 bg-cyan-600 text-white font-bold rounded-xl
            hover:bg-cyan-500 active:scale-[0.98] transition-all
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Buscando...' : '🔍 Buscar recorrido'}
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 max-w-3xl mx-auto w-full">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && searched && entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-slate-400">No se encontraron movimientos</p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800" />

            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <div key={entry.id} className="relative pl-10">
                  {/* Dot on timeline */}
                  <div
                    className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2
                      ${idx === entries.length - 1 ? 'border-amber-400 bg-amber-400' : 'border-cyan-500 bg-slate-950'}`}
                  />

                  <div
                    className={`rounded-xl border p-3 ${ACTION_COLORS[entry.action] || 'border-slate-700 bg-slate-900'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">
                        {ACTION_ICONS[entry.action] || '❓'} {entry.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDate(entry.timestamp)}</span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-0.5">
                      {entry.toLocation && entry.toLocation !== 'ALMACEN' && (
                        <p>
                          → <span className="text-cyan-300 font-bold">{entry.toLocation}</span>{' '}
                          <span className="text-slate-500">({getShelfName(entry.shelfCode)})</span>
                        </p>
                      )}
                      {entry.fromLocation && (
                        <p>
                          ← <span className="text-slate-400">{entry.fromLocation}</span>
                        </p>
                      )}
                      {entry.toLocation === 'ALMACEN' && (
                        <p className="text-amber-300 font-bold">→ 🏭 ALMACÉN (finalizado)</p>
                      )}
                      <p className="text-slate-500">
                        por {entry.operarioName}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleTimeline;
