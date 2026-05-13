import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
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

/**
 * Hook para búsqueda global en todos los items activos.
 * Agrupa por aggregateKey + shelfCode para evitar duplicados.
 */
export const useGlobalSearch = (queryText: string, currentShelfCode: string): UseGlobalSearchReturn => {
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suscripción a items activos (mismo patrón que useAnalytics)
  useEffect(() => {
    const itemsQuery = query(collection(db, COLLECTIONS.ITEMS), where('active', '==', true));
    const unsubscribe = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const nextItems = snapshot.docs.map((doc) => doc.data() as ItemDoc);
        setItems(nextItems);
        setLoading(false);
      },
      (snapshotError) => {
        console.error('[useGlobalSearch] items snapshot error', snapshotError);
        setError('No se pudieron cargar los articulos activos.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
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
        // Combinar locationIds evitando duplicados
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

    // Filtrar por términos de búsqueda
    const filteredResults: GlobalSearchResult[] = [];

    groupedResults.forEach((group) => {
      const { articleCode, orderFab, aggregateKey, shelfCode, locationIds } = group;

      // Verificar si coincide con algún término de búsqueda
      const matchesQuery = searchTerms.some((term) =>
        articleCode.includes(term) || orderFab.includes(term)
      );

      if (!matchesQuery) return;

       // Convertir locationIds a posiciones legibles
       const positionObjects = locationIds
         .map((id) => parseLocationId(id))
         .filter((pos): pos is { shelfCode: string; position: string } => pos !== null)
         .sort((a, b) => {
           // Ordenar por estantería primero, luego por posición
           if (a.shelfCode !== b.shelfCode) return a.shelfCode.localeCompare(b.shelfCode);
           return parseInt(a.position, 10) - parseInt(b.position, 10);
         });
         
       // Formatear como "shelf-position" para mantener compatibilidad con el resto del código
       const positions = positionObjects.map(pos => `${pos.shelfCode}_${pos.position}`);

      // Eliminar duplicados de posiciones manteniendo orden
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

    // Ordenar: primero coincidencias exactas de estantería, luego por artículo
    filteredResults.sort((a, b) => {
      if (a.matchesCurrentShelf && !b.matchesCurrentShelf) return -1;
      if (!a.matchesCurrentShelf && b.matchesCurrentShelf) return 1;
      return a.matchLabel.localeCompare(b.matchLabel);
    });

    // Limitar a máximo 10 resultados visibles
    const limitedResults = filteredResults.slice(0, 10);

    return {
      results: limitedResults,
      hasQuery: true,
      hasExactShelfMatch: limitedResults.some((r) => r.matchesCurrentShelf),
    };
  }, [items, queryText, currentShelfCode]);

  return {
    results: processedResults.results,
    loading,
    hasQuery: processedResults.hasQuery,
    hasExactShelfMatch: processedResults.hasExactShelfMatch,
    clear: () => {}, // El limpiado se maneja desde el componente llamante
  };
};