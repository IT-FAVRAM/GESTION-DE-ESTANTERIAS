
import { Assignments, LocationId } from './warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';

import { generateLayoutLocations } from './warehouseLayout';

export const exportInventoryToExcel = (assignments: Assignments, config: WarehouseConfig) => {
    try {
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

        const rows: Record<string, any>[] = [];

        // Process each warehouse from config
        config.warehouses.forEach((wh) => {
            const whCode = wh.code;
            const fullLayout = generateLayoutLocations(whCode);

            // Create rows for EVERY defined location in this warehouse
            const sheetData = fullLayout.map((locId) => {
                const items = assignments[locId] || [];
                const latestItem = items.reduce((latest, current) => {
                    if (!latest || (current.timestamp && new Date(current.timestamp) > new Date(latest.timestamp))) {
                        return current;
                    }
                    return latest;
                }, null as any);

                return {
                    "Almacén": sanitizeForExcel(wh.name),
                    "Ubicación": sanitizeForExcel(formatLocDisplay(locId)),
                    "Estado": items.length > 0 ? "OCUPADO" : "VACÍO",
                    "Nº Artículos": items.length,
                    "Artículos": sanitizeForExcel(items.map(i => i.barcode).join(" | ")),
                    "OFs": sanitizeForExcel(items.map(i => i.orderId).join(" | ")),
                    "Última Entrada": latestItem?.timestamp ? new Date(latestItem.timestamp).toLocaleString() : '-',
                    "Días en Almacén": latestItem?.timestamp ? Math.floor((Date.now() - new Date(latestItem.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : '-'
                };
            });

            rows.push(...sheetData);
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

        if (orphans.length > 0) rows.push(...orphans.map((o) => ({ "Almacén": "EXTRAS", ...o })));

        const headers = Object.keys(rows[0] || {
            "Almacén": '',
            "Ubicación": '',
            "Estado": '',
            "Nº Artículos": '',
            "Artículos": '',
            "OFs": '',
            "Última Entrada": '',
            "Días en Almacén": ''
        });

        const csvEscape = (value: any) => {
            const stringValue = String(value ?? '');
            const escaped = stringValue.replace(/"/g, '""');
            return `"${escaped}"`;
        };

        const csvLines = [
            headers.map(csvEscape).join(','),
            ...rows.map((row) => headers.map((h) => csvEscape(row[h] ?? '')).join(','))
        ];

        const bom = '\uFEFF';
        const blob = new Blob([bom + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `Inventario_Global_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);


    } catch (error) {
        console.error("Excepción en exportInventoryToExcel:", error);
    }
};


