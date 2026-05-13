
import { useMemo } from 'react';
import { Assignments, HistoryEntry, LocationId, AssignmentItem, ActionType } from '../lib/warehouseData';

export const useIndexing = (assignments: Assignments, history: HistoryEntry[]) => {

    // Index 1: Barcode -> Location[] (O(1) lookup for duplicates)
    const articleLocationIndex = useMemo(() => {
        const index = new Map<string, LocationId[]>();
        for (const locId in assignments) {
            const items = assignments[locId as LocationId];
            for (const item of items) {
                if (!index.has(item.barcode)) {
                    index.set(item.barcode, []);
                }
                index.get(item.barcode)?.push(locId as LocationId);
            }
        }
        return index;
    }, [assignments]);

    // Index 2: Flat List for Search (Optimized text search)
    const flatAssignments = useMemo(() => {
        const flat: { location: LocationId; item: AssignmentItem }[] = [];
        for (const locId in assignments) {
            const items = assignments[locId as LocationId];
            for (const item of items) {
                flat.push({ location: locId as LocationId, item });
            }
        }
        return flat;
    }, [assignments]);

    // Index 3: History by Barcode
    const historyByBarcode = useMemo(() => {
        const index = new Map<string, HistoryEntry[]>();
        for (const entry of history) {
            if (!index.has(entry.barcode)) {
                index.set(entry.barcode, []);
            }
            index.get(entry.barcode)?.push(entry);
        }
        return index;
    }, [history]);

    // Functions exposed to UI

    /**
     * Normalizes a string for search: lowercase and removes all whitespace.
     */
    const normalize = (str: string = "") => str.toLowerCase().replace(/\s+/g, "");

    const searchAssignments = (query: string) => {
        if (!query) return [];

        const qNorm = normalize(query);
        if (qNorm.length < 2) {
            // If query is very short, only allow exact location matches or very specific hits
            if (assignments[query as LocationId]) {
                return assignments[query as LocationId].map(item => ({ location: query as LocationId, item }));
            }
            return [];
        }

        const results: { location: LocationId; item: AssignmentItem; score: number }[] = [];

        for (const entry of flatAssignments) {
            const bNorm = normalize(entry.item.barcode);
            const oNorm = normalize(entry.item.orderId);
            const lNorm = normalize(entry.location);

            let bestScore = 100; // No match

            // Check each field and determine the best (lowest) score
            [bNorm, oNorm, lNorm].forEach(fieldVal => {
                let score = 100;
                if (fieldVal === qNorm) score = 0; // Exact
                else if (fieldVal.startsWith(qNorm)) score = 1; // Starts with
                else if (fieldVal.includes(qNorm)) score = 2; // Contains

                if (score < bestScore) bestScore = score;
            });

            if (bestScore < 100) {
                results.push({ ...entry, score: bestScore });
            }
        }

        // Sort by score (asc) and then by location/barcode
        return results
            .sort((a, b) => {
                if (a.score !== b.score) return a.score - b.score;
                return a.location.localeCompare(b.location);
            })
            .map(({ score, ...rest }) => rest);
    };

    const getLocationsByBarcode = (barcode: string) => {
        return articleLocationIndex.get(barcode) || [];
    };

    const getHistoryByBarcode = (barcode: string) => {
        return historyByBarcode.get(barcode) || [];
    };

    return {
        articleLocationIndex,
        searchAssignments,
        getLocationsByBarcode,
        getHistoryByBarcode
    };
};
