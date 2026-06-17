/**
 * useGlobalSearchWithCache.ts — Búsqueda global con fallback a caché offline
 * Gestor de Estanterías WMS v3.0
 *
 * Usa queries on-demand con debounce. Fallback a caché local cuando offline.
 */

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, type ItemDoc, type HistoryEntryDoc } from '../lib/firestoreSchema';
import { parseLocationId } from '../lib/schema/shelves';
import { listenForCacheUpdates } from '../lib/offline/bidirectionalSync';

export type GlobalSearchResult = {
  articleCode: string;
  orderFab: string;
  aggregateKey: string;
  shelfCode: string;
  positions: string[];
  locationIds: string[];
  matchesCurrentShelf: boolean;
  matchLabel: string;
  // Ghost result (fallback a última ubicación conocida)
  isGhost?: boolean;
  lastLocation?: { shelfCode: string; position: string; timestamp: number; operarioName?: string };
  lastWithdrawal?: { shelfCode: string; position: string; timestamp: number; operarioName?: string };
  hasMultipleLocations?: boolean;
};

type UseGlobalSearchReturn = {
  results: GlobalSearchResult[];
  loading: boolean;
  hasQuery: boolean;
  hasExactShelfMatch: boolean;
  isCached: boolean;
  cacheInfo?: { age: number | null; itemCount: number };
  clear: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;
const MAX_RESULTS = 50;

const groupAndFilter = (
  items: ItemDoc[],
  searchTerms: string[],
  currentShelfCode: string,
): GlobalSearchResult[] => {
  const groupedResults = new Map<string, {
    articleCode: string;
    orderFab: string;
    aggregateKey: string;
    shelfCode: string;
    locationIds: string[];
  }>();

  items.forEach((item) => {
    const aggregateKey = `${item.articleCode}|${item.orderFab}`;
    const groupKey = `${aggregateKey}|${item.shelfCode}`;

    const existing = groupedResults.get(groupKey);
    if (existing) {
      const combinedLocationIds = Array.from(new Set([...existing.locationIds, ...item.locationIds]));
      groupedResults.set(groupKey, { ...existing, locationIds: combinedLocationIds });
    } else {
      groupedResults.set(groupKey, {
        articleCode: item.articleCode,
        orderFab: item.orderFab,
        aggregateKey,
        shelfCode: item.shelfCode,
        locationIds: [...item.locationIds],
      });
    }
  });

  const filteredResults: GlobalSearchResult[] = [];

  groupedResults.forEach((group) => {
    const { articleCode, orderFab, aggregateKey, shelfCode, locationIds } = group;
    const matchesQuery = searchTerms.some((term) => articleCode.includes(term) || orderFab.includes(term));
    if (!matchesQuery) return;

    const positionObjects = locationIds
      .map((id) => parseLocationId(id))
      .filter((pos): pos is { shelfCode: string; position: string } => pos !== null)
      .sort((a, b) => {
        if (a.shelfCode !== b.shelfCode) return a.shelfCode.localeCompare(b.shelfCode);
        return parseInt(a.position, 10) - parseInt(b.position, 10);
      });

    const positions = positionObjects.map((pos) => `${pos.shelfCode}_${pos.position}`);
    const uniquePositions = Array.from(new Set(positions));
    const matchesCurrentShelf = shelfCode === currentShelfCode;
    const matchLabel = `${articleCode} ${orderFab}`.trim();

    filteredResults.push({
      articleCode, orderFab, aggregateKey, shelfCode,
      positions: uniquePositions, locationIds, matchesCurrentShelf, matchLabel,
    });
  });

  filteredResults.sort((a, b) => {
    // No-ghost results primero
    if (!a.isGhost && b.isGhost) return -1;
    if (a.isGhost && !b.isGhost) return 1;
    // Entre los del mismo tipo, current shelf first
    if (a.matchesCurrentShelf && !b.matchesCurrentShelf) return -1;
    if (!a.matchesCurrentShelf && b.matchesCurrentShelf) return 1;
    return a.matchLabel.localeCompare(b.matchLabel);
  });

  return filteredResults;
};

export const useGlobalSearchWithCache = (
  queryText: string,
  currentShelfCode: string
): UseGlobalSearchReturn => {
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0);

  const tryLoadFromCache = (): ItemDoc[] | null => {
    try {
      const cached = localStorage.getItem('wms-items-cache');
      const timestamp = localStorage.getItem('wms-items-cache-timestamp');
      if (cached) {
        const items = JSON.parse(cached) as ItemDoc[];
        if (timestamp) {
          setCacheAge((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60));
        }
        return items;
      }
    } catch (e) {
      console.warn('[useGlobalSearchWithCache] Error loading cache', e);
    }
    return null;
  };

  // Búsqueda on-demand con debounce + fallback a caché offline
  useEffect(() => {
    const trimmed = queryText.trim().toUpperCase();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const searchGeneration = ++abortRef.current;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const searchTerms = trimmed.split(/\s+/).filter((t) => t.length > 0);

      try {
        const articleQuery = query(
          collection(db, COLLECTIONS.ITEMS),
          where('active', '==', true),
          where('articleCode', '>=', trimmed),
          where('articleCode', '<=', trimmed + '\uf8ff'),
          limit(MAX_RESULTS),
        );

        const orderQuery = query(
          collection(db, COLLECTIONS.ITEMS),
          where('active', '==', true),
          where('orderFab', '>=', trimmed),
          where('orderFab', '<=', trimmed + '\uf8ff'),
          limit(MAX_RESULTS),
        );

        const [articleSnap, orderSnap] = await Promise.all([
          getDocs(articleQuery),
          getDocs(orderQuery),
        ]);

        if (searchGeneration !== abortRef.current) return;

        const docMap = new Map<string, ItemDoc>();
        for (const doc of [...articleSnap.docs, ...orderSnap.docs]) {
          if (!docMap.has(doc.id)) docMap.set(doc.id, doc.data() as ItemDoc);
        }

        const items = Array.from(docMap.values());
        let results = groupAndFilter(items, searchTerms, currentShelfCode);

        // Si no hay resultados activos, buscar en history (fallback)
        if (results.length === 0) {
          try {
            const historyArticleQuery = query(
              collection(db, COLLECTIONS.HISTORY),
              where('articleCode', '>=', trimmed),
              where('articleCode', '<=', trimmed + ''),
              orderBy('timestamp', 'desc'),
              limit(20),
            );

            const historySnap = await getDocs(historyArticleQuery);
            if (historySnap.docs.length > 0) {
              const ghostMap = new Map<string, {
                articleCode: string;
                orderFab: string;
                lastLocation?: { shelfCode: string; position: string; timestamp: number; operarioName?: string };
                lastWithdrawal?: { shelfCode: string; position: string; timestamp: number; operarioName?: string };
                locationHistory: Set<string>;
              }>();

              historySnap.docs.forEach((historyDoc) => {
                const data = historyDoc.data() as HistoryEntryDoc;
                const matchesQuery = searchTerms.some((term) =>
                  data.articleCode.includes(term) || data.orderFab.includes(term)
                );
                if (!matchesQuery) return;

                const key = `${data.articleCode}|${data.orderFab}`;
                let entry = ghostMap.get(key);

                if (!entry) {
                  entry = {
                    articleCode: data.articleCode,
                    orderFab: data.orderFab,
                    locationHistory: new Set(),
                  };
                  ghostMap.set(key, entry);
                }

                const timestamp = new Date(data.timestamp).getTime();

                if ((data.action === 'UBICAR' || data.action === 'UBICAR_MULTI') && data.toLocation && !entry.lastLocation) {
                  const parsed = parseLocationId(data.toLocation);
                  if (parsed) {
                    entry.lastLocation = {
                      shelfCode: parsed.shelfCode,
                      position: parsed.position,
                      timestamp,
                      operarioName: data.operarioName,
                    };
                    entry.locationHistory.add(parsed.shelfCode);
                  }
                }

                if ((data.action === 'RETIRAR' || data.action === 'RETIRAR_DE_UBICACION') && data.fromLocation && !entry.lastWithdrawal) {
                  const parsed = parseLocationId(data.fromLocation);
                  if (parsed) {
                    entry.lastWithdrawal = {
                      shelfCode: parsed.shelfCode,
                      position: parsed.position,
                      timestamp,
                      operarioName: data.operarioName,
                    };
                  }
                }
              });

              ghostMap.forEach((entry) => {
                if (entry.lastLocation || entry.lastWithdrawal) {
                  const shelfCode = entry.lastLocation?.shelfCode || entry.lastWithdrawal?.shelfCode || '';
                  const position = entry.lastLocation?.position || entry.lastWithdrawal?.position || '';
                  const matchLabel = `${entry.articleCode} ${entry.orderFab}`.trim();

                  results.push({
                    articleCode: entry.articleCode,
                    orderFab: entry.orderFab,
                    aggregateKey: `${entry.articleCode}|${entry.orderFab}`,
                    shelfCode,
                    positions: position ? [`${shelfCode}_${position}`] : [],
                    locationIds: [],
                    matchesCurrentShelf: shelfCode === currentShelfCode,
                    matchLabel,
                    isGhost: true,
                    lastLocation: entry.lastLocation,
                    lastWithdrawal: entry.lastWithdrawal,
                    hasMultipleLocations: entry.locationHistory.size > 1,
                  });
                }
              });
            }
          } catch (historyErr) {
            console.warn('[useGlobalSearchWithCache] History fallback failed', historyErr);
          }
        }

        setResults(results);
        setIsCached(false);
        setCacheAge(null);

        // Actualizar caché
        try {
          localStorage.setItem('wms-items-cache', JSON.stringify(items));
          localStorage.setItem('wms-items-cache-timestamp', new Date().toISOString());
        } catch { /* cache full, ignore */ }
      } catch (err) {
        console.warn('[useGlobalSearchWithCache] Online search failed, trying cache', err);
        // Fallback a caché offline
        const cached = tryLoadFromCache();
        if (cached && cached.length > 0) {
          setResults(groupAndFilter(cached, searchTerms, currentShelfCode));
          setIsCached(true);
        } else {
          setResults([]);
        }
      } finally {
        if (searchGeneration === abortRef.current) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [queryText, currentShelfCode]);

  // Escuchar actualizaciones de caché desde sincronización bidireccional
  useEffect(() => {
    const unsubscribeCache = listenForCacheUpdates((event) => {
      if (event.type === 'items' && isCached) {
        const cached = tryLoadFromCache();
        if (cached) {
          const searchTerms = queryText.trim().toUpperCase().split(/\s+/).filter((t) => t.length > 0);
          if (searchTerms.length > 0) {
            setResults(groupAndFilter(cached, searchTerms, currentShelfCode));
          }
        }
      }
    });
    return unsubscribeCache;
  }, [isCached, queryText, currentShelfCode]);

  const hasQuery = queryText.trim().length > 0;
  const hasExactShelfMatch = results.some((r) => r.matchesCurrentShelf);

  return {
    results,
    loading,
    hasQuery,
    hasExactShelfMatch,
    isCached,
    cacheInfo: cacheAge !== null ? { age: cacheAge, itemCount: results.length } : undefined,
    clear: () => setResults([]),
  };
};
