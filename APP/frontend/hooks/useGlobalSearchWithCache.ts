/**
 * useGlobalSearchWithCache.ts — Búsqueda global con fallback a caché offline
 * Gestor de Estanterías WMS v3.0
 *
 * Implementa búsqueda en tiempo real con fallback automático a caché local
 * cuando no hay conexión a Firestore.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, type ItemDoc } from '../lib/firestoreSchema';
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

export const useGlobalSearchWithCache = (
  queryText: string,
  currentShelfCode: string
): UseGlobalSearchReturn => {
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  // Intentar caché local si está disponible
  const tryLoadFromCache = (): ItemDoc[] | null => {
    try {
      const cached = localStorage.getItem('wms-items-cache');
      const timestamp = localStorage.getItem('wms-items-cache-timestamp');

      if (cached) {
        const items = JSON.parse(cached) as ItemDoc[];

        if (timestamp) {
          const age = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
          setCacheAge(age);
        }

        return items;
      }
    } catch (e) {
      console.warn('[useGlobalSearch] Error loading cache', e);
    }

    return null;
  };

  // Suscripción a items activos desde Firestore
  useEffect(() => {
    let isMounted = true;
    const itemsQuery = query(collection(db, COLLECTIONS.ITEMS), where('active', '==', true));

    const unsubscribe = onSnapshot(
      itemsQuery,
      (snapshot) => {
        if (!isMounted) return;

        const nextItems = snapshot.docs.map((doc) => doc.data() as ItemDoc);
        setItems(nextItems);
        setIsCached(false);
        setCacheAge(null);
        setLoading(false);
        setError(null);

        // Guardar en caché
        try {
          localStorage.setItem('wms-items-cache', JSON.stringify(nextItems));
          localStorage.setItem('wms-items-cache-timestamp', new Date().toISOString());
        } catch (e) {
          console.warn('[useGlobalSearch] Cache storage full', e);
        }
      },
      (snapshotError) => {
        if (!isMounted) return;

        console.warn('[useGlobalSearch] Firestore snapshot error', snapshotError);

        // Intentar cargar desde caché
        const cached = tryLoadFromCache();
        if (cached && cached.length > 0) {
          setItems(cached);
          setIsCached(true);
          setLoading(false);
          setError(null);
        } else {
          setItems([]);
          setLoading(false);
          setError('Sin conexión y sin datos en caché. Conéctate a WiFi para buscar.');
        }
      }
    );

    // Escuchar actualizaciones de caché desde sincronización bidireccional
    const unsubscribeCache = listenForCacheUpdates((event) => {
      if (isMounted && event.type === 'items') {
        const cached = tryLoadFromCache();
        if (cached && isCached) {
          setItems(cached);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeCache();
    };
  }, []);

  // Procesamiento y filtrado de resultados
  const processedResults = useMemo(() => {
    if (!queryText.trim()) {
      return {
        results: [] as GlobalSearchResult[],
        hasQuery: false,
        hasExactShelfMatch: false,
      };
    }

    const searchTerms = queryText
      .toUpperCase()
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      return {
        results: [] as GlobalSearchResult[],
        hasQuery: false,
        hasExactShelfMatch: false,
      };
    }

    const groupedResults = new Map<
      string,
      {
        articleCode: string;
        orderFab: string;
        aggregateKey: string;
        shelfCode: string;
        locationIds: string[];
      }
    >();

    items.forEach((item) => {
      const aggregateKey = `${item.articleCode}|${item.orderFab}`;
      const groupKey = `${aggregateKey}|${item.shelfCode}`;

      const existing = groupedResults.get(groupKey);
      if (existing) {
        const combinedLocationIds = Array.from(
          new Set([...existing.locationIds, ...item.locationIds])
        );
        groupedResults.set(groupKey, {
          ...existing,
          locationIds: combinedLocationIds,
        });
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

      const matchesQuery = searchTerms.some(
        (term) => articleCode.includes(term) || orderFab.includes(term)
      );

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
        articleCode,
        orderFab,
        aggregateKey,
        shelfCode,
        positions: uniquePositions,
        locationIds,
        matchesCurrentShelf,
        matchLabel,
      });
    });

    const exactShelfMatches = filteredResults.filter((r) => r.matchesCurrentShelf);

    return {
      results: filteredResults,
      hasQuery: true,
      hasExactShelfMatch: exactShelfMatches.length > 0,
    };
  }, [queryText, items]);

  return {
    results: processedResults.results,
    loading,
    hasQuery: processedResults.hasQuery,
    hasExactShelfMatch: processedResults.hasExactShelfMatch,
    isCached,
    cacheInfo: cacheAge !== null ? { age: cacheAge, itemCount: items.length } : undefined,
    clear: () => undefined,
  };
};


