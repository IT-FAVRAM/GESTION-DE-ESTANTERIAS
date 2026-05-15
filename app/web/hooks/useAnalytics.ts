import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import {
  ALL_SHELVES,
  COLLECTIONS,
  SHELF_TO_SECTION,
  getItemAggregateId,
  type ItemDoc,
} from '../lib/firestoreSchema';

export interface LeadTimeReportingResult {
  generatedAt: string;
  totals: {
    completedCycles: number;
    averageLeadTimeDays: number | null;
  };
  bySection: Array<{
    section: string;
    completedCycles: number;
    averageLeadTimeDays: number;
  }>;
  byShelf: Array<{
    shelfCode: string;
    completedCycles: number;
    averageLeadTimeDays: number;
  }>;
}

export interface StaleItemView {
  articleCode: string;
  orderFab: string;
  shelfCode: string;
  section: string;
  locationIds: string[];
  daysInLocation: number;
  repeatedPair: boolean;
  lastAlertAt: string | null;
}

export interface RepeatedPairView {
  articleCode: string;
  orderFab: string;
  shelfCodes: string[];
  sections: string[];
  locationIds: string[];
  activePresences: number;
  placements: number;
}

export interface SectionMetric {
  section: string;
  uniqueItems: number;
  placements: number;
  occupancyRate: number;
  avgLeadTimeDays: number | null;
}

export interface ShelfMetric {
  shelfCode: string;
  shelfName: string;
  section: string;
  placements: number;
  occupancyRate: number;
}

export interface AnalyticsSnapshot {
  loading: boolean;
  error: string | null;
  generatedAt: string | null;
  totalUniqueItems: number;
  totalPlacements: number;
  totalLocations: number;
  occupiedLocations: number;
  staleItems: StaleItemView[];
  repeatedPairs: RepeatedPairView[];
  sectionMetrics: SectionMetric[];
  shelfMetrics: ShelfMetric[];
  leadTime: LeadTimeReportingResult | null;
}

const SHELF_CAPACITY = new Map(ALL_SHELVES.map((shelf) => [shelf.code, shelf.locationCount]));
const SHELF_NAMES = new Map(ALL_SHELVES.map((shelf) => [shelf.code, shelf.name]));

const diffDaysFromNow = (isoDate?: string) => {
  if (!isoDate) return 0;
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
};

const normalizeLeadTime = (leadTime: LeadTimeReportingResult | null) => {
  const map = new Map<string, number>();
  if (!leadTime) {
    return map;
  }

  leadTime.bySection.forEach((entry) => {
    map.set(entry.section, entry.averageLeadTimeDays);
  });

  return map;
};

export const useAnalytics = (): AnalyticsSnapshot => {
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [leadTime, setLeadTime] = useState<LeadTimeReportingResult | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingLeadTime, setLoadingLeadTime] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const itemsQuery = query(collection(db, COLLECTIONS.ITEMS), where('active', '==', true));
    const unsubscribe = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const nextItems = snapshot.docs.map((doc) => doc.data() as ItemDoc);
        setItems(nextItems);
        setLoadingItems(false);
      },
      (snapshotError) => {
        console.error('[useAnalytics] items snapshot error', snapshotError);
        setError('No se pudieron cargar los articulos activos.');
        setLoadingItems(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLeadTime = async () => {
      try {
        const callable = httpsCallable(functions, 'leadTimeReporting');
        const result = await callable({});
        if (!cancelled) {
          setLeadTime(result.data as LeadTimeReportingResult);
        }
      } catch (leadTimeError) {
        console.error('[useAnalytics] lead time error', leadTimeError);
        if (!cancelled) {
          setError('No se pudieron cargar las metricas de permanencia.');
        }
      } finally {
        if (!cancelled) {
          setLoadingLeadTime(false);
        }
      }
    };

    loadLeadTime();
    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo(() => {
    const totalLocations = ALL_SHELVES.reduce((sum, shelf) => sum + shelf.locationCount, 0);
    const totalPlacements = items.reduce((sum, item) => sum + item.locationIds.length, 0);
    const occupiedLocations = new Set(items.flatMap((item) => item.locationIds)).size;
    const leadTimeBySection = normalizeLeadTime(leadTime);

    const uniquePairs = new Set<string>();
    const sectionAccumulator = new Map<string, { uniqueItems: number; placements: number }>();
    const shelfAccumulator = new Map<string, number>();
    const staleItems: StaleItemView[] = [];
    const repeatedPairAccumulator = new Map<string, RepeatedPairView>();

    items.forEach((item) => {
      const aggregateKey = getItemAggregateId(item.articleCode, item.orderFab);
      const section = SHELF_TO_SECTION[item.shelfCode] || 'OTROS';
      const shelfPlacements = item.locationIds.length;
      const daysInLocation = diffDaysFromNow(item.locatedAt);
      uniquePairs.add(aggregateKey);

      const sectionStats = sectionAccumulator.get(section) || { uniqueItems: 0, placements: 0 };
      sectionStats.uniqueItems += 1;
      sectionStats.placements += shelfPlacements;
      sectionAccumulator.set(section, sectionStats);

      shelfAccumulator.set(item.shelfCode, (shelfAccumulator.get(item.shelfCode) || 0) + shelfPlacements);

      const repeatedPair = repeatedPairAccumulator.get(aggregateKey) || {
        articleCode: item.articleCode,
        orderFab: item.orderFab,
        shelfCodes: [],
        sections: [],
        locationIds: [],
        activePresences: 0,
        placements: 0,
      };
      repeatedPair.activePresences += 1;
      repeatedPair.placements += shelfPlacements;
      repeatedPair.locationIds.push(...item.locationIds);
      if (!repeatedPair.shelfCodes.includes(item.shelfCode)) {
        repeatedPair.shelfCodes.push(item.shelfCode);
      }
      if (!repeatedPair.sections.includes(section)) {
        repeatedPair.sections.push(section);
      }
      repeatedPairAccumulator.set(aggregateKey, repeatedPair);

      if (daysInLocation >= 5) {
        staleItems.push({
          articleCode: item.articleCode,
          orderFab: item.orderFab,
          shelfCode: item.shelfCode,
          section,
          locationIds: item.locationIds,
          daysInLocation,
          repeatedPair: false,
          lastAlertAt: item.lastAlertAt || null,
        });
      }
    });

    const repeatedPairs = Array.from(repeatedPairAccumulator.values())
      .filter((pair) => pair.activePresences > 1 || pair.locationIds.length > 1)
      .map((pair) => ({
        ...pair,
        locationIds: Array.from(new Set(pair.locationIds)),
      }));

    const repeatedKeys = new Set(repeatedPairs.map((pair) => getItemAggregateId(pair.articleCode, pair.orderFab)));
    staleItems.forEach((item) => {
      item.repeatedPair = repeatedKeys.has(getItemAggregateId(item.articleCode, item.orderFab));
    });

    const sectionMetrics: SectionMetric[] = Array.from(sectionAccumulator.entries())
      .map(([section, stats]) => {
        const sectionShelves = ALL_SHELVES.filter((shelf) => shelf.section === section);
        const sectionCapacity = sectionShelves.reduce((sum, shelf) => sum + shelf.locationCount, 0);
        return {
          section,
          uniqueItems: stats.uniqueItems,
          placements: stats.placements,
          occupancyRate: sectionCapacity === 0 ? 0 : stats.placements / sectionCapacity,
          avgLeadTimeDays: leadTimeBySection.get(section) ?? null,
        };
      })
      .sort((left, right) => right.placements - left.placements);

    const shelfMetrics: ShelfMetric[] = ALL_SHELVES
      .map((shelf) => {
        const placements = shelfAccumulator.get(shelf.code) || 0;
        return {
          shelfCode: shelf.code,
          shelfName: SHELF_NAMES.get(shelf.code) || shelf.code,
          section: shelf.section,
          placements,
          occupancyRate: shelf.locationCount === 0 ? 0 : placements / shelf.locationCount,
        };
      })
      .sort((left, right) => right.occupancyRate - left.occupancyRate);

    staleItems.sort((left, right) => right.daysInLocation - left.daysInLocation);
    repeatedPairs.sort((left, right) => right.placements - left.placements);

    return {
      totalUniqueItems: uniquePairs.size,
      totalLocations,
      totalPlacements,
      occupiedLocations,
      staleItems,
      repeatedPairs,
      sectionMetrics,
      shelfMetrics,
    };
  }, [items, leadTime]);

  return {
    loading: loadingItems || loadingLeadTime,
    error,
    generatedAt: leadTime?.generatedAt || null,
    totalUniqueItems: computed.totalUniqueItems,
    totalPlacements: computed.totalPlacements,
    totalLocations: computed.totalLocations,
    occupiedLocations: computed.occupiedLocations,
    staleItems: computed.staleItems,
    repeatedPairs: computed.repeatedPairs,
    sectionMetrics: computed.sectionMetrics,
    shelfMetrics: computed.shelfMetrics,
    leadTime,
  };
};
