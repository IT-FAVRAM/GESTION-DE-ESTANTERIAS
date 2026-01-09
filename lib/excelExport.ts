
import * as XLSX from 'xlsx';
import { Assignments, LocationId } from './warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';

import { generateLayoutLocations } from './warehouseLayout';

export const exportInventoryToExcel = (assignments: Assignments, config: WarehouseConfig) => {
    try {
        const X = XLSX;
        if (!X || !X.utils || !X.writeFile) {
            console.error("Error crítico: Librería XLSX no cargada.");
            return;
        }

        const workbook = X.utils.book_new();

        // Helper to sanitize sheet names
        const sanitizeSheetName = (name: string) => {
            return name.replace(/[\\/?*[\]]/g, "").substring(0, 31) || "Hoja";
        };

        // Format location for display
        const formatLocDisplay = (locId: string): string => {
            return locId.split('-').pop() || locId;
        };

        // Sanitize for CSV/Excel Injection (Formula Injection)
        const sanitizeForExcel = (val: any): any => {
            if (val === null || val === undefined) return '';

            let str = String(val).trim();

            // 1. Length Limit (Excel limits cells to 32k chars, but preventing huge payloads is good practice)
            if (str.length > 32000) {
                str = str.substring(0, 32000) + '... (TRUNCATED)';
            }

            // 2. Injection Protection
            if (/^[=+\-@]/.test(str)) {
                return "'" + str;
            }
            return str;
        };

        // Process each warehouse from config
        config.warehouses.forEach(wh => {
            const whCode = wh.code;
            const sheetName = sanitizeSheetName(wh.name);
            const fullLayout = generateLayoutLocations(whCode);

            // Create rows for EVERY defined location in this warehouse
            const sheetData = fullLayout.map(locId => {
                const items = assignments[locId] || [];
                const latestItem = items.reduce((latest, current) => {
                    if (!latest || (current.timestamp && new Date(current.timestamp) > new Date(latest.timestamp))) {
                        return current;
                    }
                    return latest;
                }, null as any);

                return {
                    "Ubicación": sanitizeForExcel(formatLocDisplay(locId)),
                    "Estado": items.length > 0 ? "OCUPADO" : "VACÍO",
                    "Nº Artículos": items.length,
                    "Artículos": sanitizeForExcel(items.map(i => i.barcode).join(" | ")),
                    "OFs": sanitizeForExcel(items.map(i => i.orderId).join(" | ")),
                    "Última Entrada": latestItem?.timestamp ? new Date(latestItem.timestamp).toLocaleString() : '-',
                    "Días en Almacén": latestItem?.timestamp ? Math.floor((Date.now() - new Date(latestItem.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : '-'
                };
            });

            const worksheet = X.utils.json_to_sheet(sheetData);

            // Column Widths
            worksheet['!cols'] = [
                { wch: 15 }, // Ubicación
                { wch: 10 }, // Estado
                { wch: 12 }, // Nº Artículos
                { wch: 40 }, // Artículos
                { wch: 30 }, // OFs
                { wch: 20 }, // Última Entrada
                { wch: 15 }  // Días
            ];

            X.utils.book_append_sheet(workbook, worksheet, sheetName);
        });

        // Handle Orphan Assignments (Locations in data not in any known layout)
        const recordedLocs = new Set(config.warehouses.flatMap(wh => generateLayoutLocations(wh.code)));
        const orphans: any[] = [];

        Object.entries(assignments).forEach(([locId, items]) => {
            if (!recordedLocs.has(locId as LocationId)) {
                orphans.push({
                    "Ubicación": locId,
                    "Artículos": items.map(i => i.barcode).join(" | "),
                    "OFs": items.map(i => i.orderId).join(" | "),
                    "Cantidad": items.length
                });
            }
        });

        if (orphans.length > 0) {
            const orphanSheet = X.utils.json_to_sheet(orphans);
            X.utils.book_append_sheet(workbook, orphanSheet, "EXTRAS");
        }

        const dateStr = new Date().toISOString().split('T')[0];
        X.writeFile(workbook, `Inventario_Global_${dateStr}.xlsx`);

    } catch (error) {
        console.error("Excepción en exportInventoryToExcel:", error);
    }
};
