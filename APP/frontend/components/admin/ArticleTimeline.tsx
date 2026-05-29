import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  collection, query, where, orderBy, getDocs, limit, startAfter,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS, getShelfDefinition } from '../../lib/firestoreSchema';

interface TimelineEntry {
  id: string;
  action: string;
  articleCode: string;
  orderFab: string;
  fromLocation: string | null;
  toLocation: string | null;
  shelfCode: string;
  role: string;
  timestamp: string;
  source?: string;
  user?: string;
  uid?: string;
}

const ROLE_BADGES: Record<string, string> = {
  ADMIN: '🛡️',
  SUPERADMIN: '⭐',
  CARRETILLERO: '🔧',
  OPERARIO: '👤',
  JEFE_SECCION: '👔',
  CALIDAD: '✅',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SUPERADMIN: 'Superadmin',
  CARRETILLERO: 'Carretillero',
  OPERARIO: 'Operario',
  JEFE_SECCION: 'Jefe Sección',
  CALIDAD: 'Calidad',
};

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

const PAGE_SIZE = 50;

interface ArticleTimelineProps {
  onBack: () => void;
}

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

const formatTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getDateGroup = (iso: string): string => {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(d, today)) return 'Hoy';
    if (isSameDay(d, yesterday)) return 'Ayer';
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const getShelfName = (code: string): string => {
  const shelf = getShelfDefinition(code);
  return shelf ? shelf.name : code;
};

const actionLabel = (action: string): string =>
  action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const CSV_HEADERS = ['Artículo', 'OF', 'Acción', 'Origen', 'Destino', 'Estantería', 'Rol', 'Fecha', 'Usuario', 'Source'];

const toCSV = (entries: TimelineEntry[]): string => {
  const rows = entries.map((e) => [
    e.articleCode,
    e.orderFab,
    e.action,
    e.fromLocation || '',
    e.toLocation || '',
    e.shelfCode,
    ROLE_LABELS[e.role] || e.role,
    formatDate(e.timestamp),
    e.user || '',
    e.source || '',
  ].map((v) => `"${v.replace(/"/g, '""')}"`).join(','));
  return '\uFEFF' + CSV_HEADERS.join(',') + '\n' + rows.join('\n');
};

const downloadCSV = (entries: TimelineEntry[]) => {
  const csv = toCSV(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historial_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const ArticleTimeline: React.FC<ArticleTimelineProps> = ({ onBack }) => {
  const [searchArticle, setSearchArticle] = useState('');
  const [searchOF, setSearchOF] = useState('');
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'latest' | 'search'>('latest');
  const [initialLoad, setInitialLoad] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const currentQuery = useRef<{ article: string; of: string }>({ article: '', of: '' });

  const mapEntry = (doc: any, d: Record<string, any>): TimelineEntry => ({
    id: doc.id,
    action: d.action || '',
    articleCode: d.articleCode || d.barcode || '',
    orderFab: d.orderFab || d.orderId || '',
    fromLocation: d.fromLocation || null,
    toLocation: d.toLocation || null,
    shelfCode: d.shelfCode || '',
    role: d.role || '',
    timestamp: d.timestamp || '',
    source: d.source || undefined,
    user: d.user || undefined,
    uid: d.uid || undefined,
  });

  const fetchEntries = useCallback(async (
    isLatest: boolean,
    article: string,
    of: string,
    last: DocumentSnapshot | null,
  ): Promise<{ results: TimelineEntry[]; last: DocumentSnapshot | null; hasMore: boolean }> => {
    const historyRef = collection(db, COLLECTIONS.HISTORY);
    const pageSize = PAGE_SIZE;

    let baseQuery;
    if (isLatest) {
      baseQuery = last
        ? query(historyRef, orderBy('timestamp', 'desc'), startAfter(last), limit(pageSize))
        : query(historyRef, orderBy('timestamp', 'desc'), limit(pageSize));
    } else if (article && of) {
      baseQuery = last
        ? query(historyRef, where('articleCode', '==', article), where('orderFab', '==', of), orderBy('timestamp', 'asc'), startAfter(last), limit(pageSize))
        : query(historyRef, where('articleCode', '==', article), where('orderFab', '==', of), orderBy('timestamp', 'asc'), limit(pageSize));
    } else if (article) {
      baseQuery = last
        ? query(historyRef, where('articleCode', '==', article), orderBy('timestamp', 'asc'), startAfter(last), limit(pageSize))
        : query(historyRef, where('articleCode', '==', article), orderBy('timestamp', 'asc'), limit(pageSize));
    } else {
      baseQuery = last
        ? query(historyRef, where('orderFab', '==', of), orderBy('timestamp', 'asc'), startAfter(last), limit(pageSize))
        : query(historyRef, where('orderFab', '==', of), orderBy('timestamp', 'asc'), limit(pageSize));
    }

    const snap = await getDocs(baseQuery);
    const docs = snap.docs;
    const results = docs.map((doc) => {
      const d = doc.data() as Record<string, any>;
      return mapEntry(doc, d);
    });

    return {
      results,
      last: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore: docs.length === pageSize,
    };
  }, []);

  const doSearch = useCallback(async (article: string, of: string) => {
    setLoading(true);
    setSearched(true);
    setSearchError(null);
    setCurrentMode('search');
    setLastDoc(null);
    setHasMore(true);
    currentQuery.current = { article, of };

    try {
      const { results, last, hasMore } = await fetchEntries(false, article, of, null);
      setEntries(results);
      setLastDoc(last);
      setHasMore(hasMore);
      setInitialLoad(false);
    } catch (err: any) {
      console.error('[ArticleTimeline] Search error:', err);
      setEntries([]);
      const code = err?.code || 'unknown';
      const isIndexError = code.includes('failed-precondition') || code.includes('index');
      setSearchError(
        isIndexError
          ? '⚠️ Índice de búsqueda no disponible. Despliega los índices con: firebase deploy --only firestore:indexes'
          : `Error (${code}): ${err?.message || 'Revisa la consola.'}`,
      );
    } finally {
      setLoading(false);
    }
  }, [fetchEntries]);

  const handleSearch = useCallback(() => {
    const article = searchArticle.trim().toUpperCase();
    const of = searchOF.trim().toUpperCase();
    if (!article && !of) return;
    doSearch(article, of);
  }, [searchArticle, searchOF, doSearch]);

  const handleLatest = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setSearchError(null);
    setSearchArticle('');
    setSearchOF('');
    setCurrentMode('latest');
    setLastDoc(null);
    setHasMore(true);
    currentQuery.current = { article: '', of: '' };

    try {
      const { results, last, hasMore } = await fetchEntries(true, '', '', null);
      setEntries(results);
      setLastDoc(last);
      setHasMore(hasMore);
      setInitialLoad(false);
    } catch (err: any) {
      console.error('[ArticleTimeline] Latest error:', err);
      setEntries([]);
      const code = err?.code || 'unknown';
      const isIndexError = code.includes('failed-precondition') || code.includes('index');
      setSearchError(
        isIndexError
          ? '⚠️ Índice de búsqueda no disponible. Despliega los índices con: firebase deploy --only firestore:indexes'
          : `Error (${code}): ${err?.message || 'No se pudieron cargar los últimos movimientos.'}`,
      );
    } finally {
      setLoading(false);
    }
  }, [fetchEntries]);

  const handleLoadMore = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const isLatest = currentMode === 'latest';
      const { article, of } = currentQuery.current;
      const { results, last, hasMore: more } = await fetchEntries(isLatest, article, of, lastDoc);
      setEntries((prev) => [...prev, ...results]);
      setLastDoc(last);
      setHasMore(more);
      setExpandedId(null);
    } catch (err: any) {
      console.error('[ArticleTimeline] Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, loadingMore, hasMore, currentMode, fetchEntries]);

  const handleRefresh = useCallback(() => {
    if (currentMode === 'latest') {
      handleLatest();
    } else {
      const { article, of } = currentQuery.current;
      if (article || of) doSearch(article, of);
    }
  }, [currentMode, handleLatest, doSearch]);

  useEffect(() => {
    handleLatest();
  }, [handleLatest]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const grouped = (() => {
    if (currentMode === 'search') {
      return new Map<string, TimelineEntry[]>();
    }
    const groups = new Map<string, TimelineEntry[]>();
    const sorted = currentMode === 'latest' ? entries : [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const entry of sorted) {
      const key = getDateGroup(entry.timestamp);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return groups;
  })();

  const showGrouped = currentMode === 'latest' && grouped.size > 0;
  const displayEntries = entries;

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 active:scale-90 transition-all"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white">📋 Historial / Trazabilidad</h1>
            <p className="text-xs text-slate-400">Recorrido de artículos por el taller</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 active:scale-90 transition-all disabled:opacity-50"
            title="Recargar"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="p-4 max-w-3xl mx-auto w-full space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchArticle}
            onChange={(e) => setSearchArticle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Código artículo..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
              text-sm text-white placeholder-slate-500
              focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
          />
          <input
            type="text"
            value={searchOF}
            onChange={(e) => setSearchOF(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="OF (ej: OF26-00657)..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
              text-sm text-white placeholder-slate-500
              focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={loading || (!searchArticle.trim() && !searchOF.trim())}
            className="flex-1 py-2.5 bg-cyan-600 text-white font-bold rounded-xl
              hover:bg-cyan-500 active:scale-[0.98] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Buscando...' : '🔍 Buscar recorrido'}
          </button>
          <button
            onClick={handleLatest}
            disabled={loading}
            className="py-2.5 px-4 bg-slate-700 text-white font-bold rounded-xl
              hover:bg-slate-600 active:scale-[0.98] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ⏱ Últimos
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-6 max-w-3xl mx-auto w-full">
        {loading && !loadingMore && (
          <div className="space-y-3 px-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-3 h-3 mt-2 rounded-full bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-800/50 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && searchError && (
          <div className="rounded-xl bg-red-900/30 border border-red-500/40 p-4 text-sm text-red-300">
            ⚠️ {searchError}
          </div>
        )}

        {!loading && !searchError && !initialLoad && entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-slate-400 font-medium">No se encontraron movimientos</p>
            <p className="text-xs text-slate-600 mt-1">
              {currentMode === 'search'
                ? 'Prueba con otro código de artículo u orden de fabricación'
                : 'Aún no hay actividad registrada en el sistema'}
            </p>
          </div>
        )}

        {initialLoad && !loading && entries.length === 0 && !searchError && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">⏱</p>
            <p className="text-slate-400 font-medium">Cargando últimos movimientos...</p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
            {/* Stats bar */}
            {entries.length > 0 && (
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-xs text-slate-500">
                  {entries.length} resultado{entries.length !== 1 ? 's' : ''}
                  {currentMode === 'latest' && (
                    <span className="text-slate-600"> — más recientes</span>
                  )}
                </span>
                <button
                  onClick={() => downloadCSV(entries)}
                  className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                  title="Descargar CSV"
                >
                  📥 CSV
                </button>
              </div>
            )}

            <div className="relative">
              {/* Vertical line - only on desktop */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800 hidden sm:block" />

              {/* Latest mode: grouped by date */}
              {showGrouped ? (
                <div className="space-y-6">
                  {Array.from(grouped.entries()).map(([dateLabel, dateEntries]) => (
                    <div key={dateLabel}>
                      <div className="flex items-center gap-2 mb-2 pl-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {dateLabel}
                        </span>
                        <span className="text-[10px] text-slate-700">{dateEntries.length}</span>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>
                      <div className="space-y-2">
                        {dateEntries.map((entry, idx) => (
                          <TimelineCard
                            key={entry.id}
                            entry={entry}
                            isFirst={idx === 0}
                            isLast={idx === dateEntries.length - 1}
                            isExpanded={expandedId === entry.id}
                            onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Search mode: chronological order (already asc) */
                <div className="space-y-2">
                  {displayEntries.map((entry, idx) => (
                    <TimelineCard
                      key={entry.id}
                      entry={entry}
                      isFirst={idx === 0}
                      isLast={idx === displayEntries.length - 1}
                      isExpanded={expandedId === entry.id}
                      onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    />
                  ))}
                </div>
              )}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="py-2.5 px-6 bg-slate-800 text-slate-300 text-sm font-medium rounded-xl
                      border border-slate-700 hover:bg-slate-700 hover:text-white
                      active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        Cargando...
                      </span>
                    ) : (
                      '📥 Cargar más'
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function TimelineCard({
  entry,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
}: {
  entry: TimelineEntry;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative pl-10 sm:pl-10 group">
      {/* Dot */}
      <div
        className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 z-10 transition-colors
          ${isLast ? 'border-amber-400 bg-amber-400' : 'border-cyan-500 bg-slate-950'}
          group-hover:border-cyan-400`}
      />

      <div
        className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 active:scale-[0.99]
          ${ACTION_COLORS[entry.action] || 'border-slate-700 bg-slate-900'}
          ${isExpanded ? 'ring-1 ring-cyan-500/30' : ''}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-white shrink-0">
              {ACTION_ICONS[entry.action] || '❓'}
            </span>
            <span className={`text-sm font-bold ${isLast && entry.action === 'UBICAR' ? 'text-amber-300' : 'text-white'}`}>
              {entry.action.replace(/_/g, ' ')}
            </span>
            {entry.role && (
              <span className="text-[10px] text-slate-500 flex items-center gap-0.5 shrink-0">
                <span>{ROLE_BADGES[entry.role] || '👤'}</span>
                <span>{ROLE_LABELS[entry.role] || entry.role}</span>
              </span>
            )}
            <span className="sm:hidden text-[10px] text-slate-500 ml-auto">{formatTime(entry.timestamp)}</span>
          </div>
          <span className="hidden sm:block text-[10px] text-slate-500">{formatDate(entry.timestamp)}</span>
        </div>

        {/* Article + OF */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/50 px-1.5 py-0.5 rounded">
            {entry.articleCode}
          </span>
          <span className="text-xs font-mono text-slate-400">{entry.orderFab}</span>
        </div>

        {/* Location info */}
        <div className="text-xs text-slate-300 space-y-0.5">
          {entry.toLocation && entry.toLocation !== 'ALMACEN' && (
            <p>
              → <span className="text-cyan-300 font-bold">{entry.toLocation}</span>
              {entry.shelfCode && (
                <span className="text-slate-500"> ({getShelfName(entry.shelfCode)})</span>
              )}
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
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-600 space-y-0.5">
            {entry.source && <p>Origen: {entry.source}</p>}
            {entry.user && <p>Usuario: {entry.user}</p>}
            {entry.uid && <p>UID: {entry.uid}</p>}
            <p>ID: {entry.id}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArticleTimeline;
