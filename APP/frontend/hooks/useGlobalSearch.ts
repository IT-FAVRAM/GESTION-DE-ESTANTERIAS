import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  COLLECTIONS,
  type ItemDoc,
} from '../lib/firestoreSchema';
import { parseLocationId } from '../lib/schema/shelves';

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
  clear: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;
const MAX_RESULTS = 50;

/**
 * Hook para búsqueda global en items activos.
 * Usa query on-demand (no subscribe a toda la colección) para evitar
 * cargar miles de documentos en memoria.
 */
export const useGlobalSearch = (queryText: string, currentShelfCode: string): UseGlobalSearchReturn => {
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0);

  // Búsqueda on-demand con debounce
  useEffect(() => {
    const trimmed = queryText.trim().toUpperCase();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Cancelar búsqueda anterior
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const searchGeneration = ++abortRef.current;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Buscar por articleCode que empiece con el término
        const articleQuery = query(
          collection(db, COLLECTIONS.ITEMS),
          where('active', '==', true),
          where('articleCode', '>=', trimmed),
          where('articleCode', '<=', trimmed + '\uf8ff'),
          limit(MAX_RESULTS),
        );

        // Buscar también por orderFab
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

        // Abortar si una nueva búsqueda ya empezó
        if (searchGeneration !== abortRef.current) return;

        // Fusionar resultados sin duplicados por doc.id
        const docMap = new Map<string, ItemDoc>();
        for (const doc of [...articleSnap.docs, ...orderSnap.docs]) {
          if (!docMap.has(doc.id)) {
            docMap.set(doc.id, doc.data() as ItemDoc);
          }
        }

        const items = Array.from(docMap.values());

        // Agrupar por aggregateKey + shelfCode
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
            const combinedLocationIds = Array.from(new Set([
              ...existing.locationIds,
              ...item.locationIds,
            ]));
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

        // Filtrar por términos de búsqueda (doble verificación)
        const searchTerms = trimmed.split(/\s+/).filter((t) => t.length > 0);
        const filteredResults: GlobalSearchResult[] = [];

        groupedResults.forEach((group) => {
          const { articleCode, orderFab, aggregateKey, shelfCode, locationIds } = group;

          const matchesQuery = searchTerms.some((term) =>
            articleCode.includes(term) || orderFab.includes(term)
          );
          if (!matchesQuery) return;

          const positionObjects = locationIds
            .map((id) => parseLocationId(id))
            .filter((pos): pos is { shelfCode: string; position: string } => pos !== null)
            .sort((a, b) => {
              if (a.shelfCode !== b.shelfCode) return a.shelfCode.localeCompare(b.shelfCode);
              return parseInt(a.position, 10) - parseInt(b.position, 10);
            });

          const positions = positionObjects.map(pos => `${pos.shelfCode}_${pos.position}`);
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

        // Ordenar: coincidencias de estantería actual primero
        filteredResults.sort((a, b) => {
          if (a.matchesCurrentShelf && !b.matchesCurrentShelf) return -1;
          if (!a.matchesCurrentShelf && b.matchesCurrentShelf) return 1;
          return a.matchLabel.localeCompare(b.matchLabel);
        });

        setResults(filteredResults.slice(0, 10));
      } catch (err) {
        console.error('[useGlobalSearch] Search error', err);
        setResults([]);
      } finally {
        if (searchGeneration === abortRef.current) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [queryText, currentShelfCode]);

  const hasQuery = queryText.trim().length > 0;
  const hasExactShelfMatch = results.some((r) => r.matchesCurrentShelf);

  return {
    results,
    loading,
    hasQuery,
    hasExactShelfMatch,
    clear: () => setResults([]),
  };
};
