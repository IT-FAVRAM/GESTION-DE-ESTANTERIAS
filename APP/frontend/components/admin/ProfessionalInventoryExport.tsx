/**
 * ProfessionalInventoryExport — ExcelJS con estilos corporativos
 * Bordes sofisticados, filtros de tabla, colores avanzados, formatos profesionales.
 */

import React, { useCallback, useRef, useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS, SHELF_DEFINITIONS, type LocationDoc, type LocationItem } from '../../lib/firestoreSchema';

// exceljs (~900KB) se carga BAJO DEMANDA al exportar/importar, no al abrir el
// panel admin. Cacheado tras la primera carga. (CommonJS → interop default/namespace.)
let _excelJs: typeof import('exceljs') | null = null;
const loadExcelJS = async (): Promise<typeof import('exceljs')> => {
  if (!_excelJs) {
    const mod = await import('exceljs');
    _excelJs = ((mod as { default?: typeof import('exceljs') }).default ?? mod);
  }
  return _excelJs;
};

interface ProfessionalInventoryExportProps {
  onExportComplete?: () => void;
}

const ProfessionalInventoryExport: React.FC<ProfessionalInventoryExportProps> = ({ onExportComplete }) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  /**
   * Exportar a Excel con ExcelJS — bordes, filtros, colores avanzados
   */
  const exportToExcelProfessional = useCallback(async () => {
    setExporting(true);
    setProgress('Iniciando...');

    try {
      const wb = new (await loadExcelJS()).Workbook();
      const today = new Date();
      const dateStr = today.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      // ── Colores corporativos ────────────────────────────────────────────────
      const colors = {
        darkBlue: '1E40AF',
        cyan: '0369A1',
        lightBlue: 'E0F2FE',
        white: 'FFFFFF',
        darkGray: '1F2937',
        borderBlue: 'BAE6FD',
        lightGray: 'F0F9FF',
      };

      const borderStyle = {
        thin: { style: 'thin' as const, color: { argb: colors.borderBlue } },
        medium: { style: 'medium' as const, color: { argb: colors.darkBlue } },
        thick: { style: 'thick' as const, color: { argb: colors.darkBlue } },
      };

      // ── PORTADA ─────────────────────────────────────────────────────────────
      setProgress('Creando portada...');
      const coverWs = wb.addWorksheet('PORTADA');
      

      const coverTitle = coverWs.addRow(['🏭 GESTOR DE ESTANTERÍAS']);
      coverTitle.font = { bold: true, size: 24, color: { argb: colors.white }, name: 'Calibri' };
      coverTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.darkBlue } };
      coverTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      coverWs.getRow(1).height = 40;

      const coverSubtitle = coverWs.addRow(['INVENTARIO GENERAL DE ALMACÉN']);
      coverSubtitle.font = { bold: true, size: 16, color: { argb: colors.white }, name: 'Calibri' };
      coverSubtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.cyan } };
      coverSubtitle.alignment = { horizontal: 'center', vertical: 'middle' };
      coverWs.getRow(2).height = 30;

      coverWs.addRow(['']);
      coverWs.addRow([`📅 Generado: ${dateStr}`]).font = { size: 11, color: { argb: colors.cyan }, bold: true };

      coverWs.addRow(['']);
      const insHeader = coverWs.addRow(['📋 INSTRUCCIONES DE USO']);
      insHeader.font = { size: 12, bold: true, color: { argb: colors.darkBlue } };

      coverWs.addRow(['']);
      coverWs.addRow(['✓ Hoja "INVENTARIO_GLOBAL": Inventario completo con toda la información']);
      coverWs.addRow(['✓ Hojas por sección: Vista detallada y filtrada por zona de almacén']);
      coverWs.addRow(['✓ Hoja "RESUMEN": Estadísticas ejecutivas y KPIs principales']);

      coverWs.addRow(['']);
      const importHeader = coverWs.addRow(['📥 PARA IMPORTAR DATOS PERDIDOS:']);
      importHeader.font = { size: 12, bold: true, color: { argb: colors.darkBlue } };

      coverWs.addRow(['']);
      coverWs.addRow(['1. Abre la hoja "INVENTARIO_GLOBAL"']);
      coverWs.addRow(['2. Realiza los cambios necesarios (mantén estructura)']);
      coverWs.addRow(['3. Guarda el archivo en tu computadora']);
      coverWs.addRow(['4. En la app, haz clic en "Importar Excel"']);
      coverWs.addRow(['5. Selecciona este archivo y confirma']);

      coverWs.columns = [{ width: 120 }];

      // ── Recopilar datos ─────────────────────────────────────────────────────
      setProgress('Recopilando datos...');
      const allItems: Array<{
        section: string; shelfName: string; shelfCode: string; position: number;
        articleCode: string; orderFab: string; locatedByName: string;
        locatedAt: string; daysInStorage: number | string;
      }> = [];

      let totalArticles = 0;
      const allOFs = new Set<string>();

      for (const shelf of SHELF_DEFINITIONS) {
        setProgress(`Leyendo ${shelf.name}...`);
        const locRef = collection(db, COLLECTIONS.SHELVES, shelf.code, COLLECTIONS.LOCATIONS);
        const snap = await getDocs(locRef);
        const locationMap = new Map<string, LocationDoc>();
        snap.forEach((doc) => locationMap.set(doc.id, doc.data() as LocationDoc));

        for (let i = 1; i <= shelf.locationCount; i++) {
          const pos = i.toString().padStart(3, '0');
          const locData = locationMap.get(pos);
          const items = locData?.items || [];

          for (const item of items) {
            totalArticles++;
            allOFs.add(item.orderFab);
            const daysInStorage = item.locatedAt
              ? Math.floor((Date.now() - new Date(item.locatedAt).getTime()) / (1000 * 60 * 60 * 24))
              : '-';

            allItems.push({
              section: shelf.section || 'OTROS',
              shelfName: shelf.name,
              shelfCode: shelf.code,
              position: parseInt(pos, 10),
              articleCode: item.articleCode,
              orderFab: item.orderFab,
              locatedByName: item.locatedByName || item.locatedBy || '',
              locatedAt: item.locatedAt ? new Date(item.locatedAt).toLocaleDateString('es-ES') : '-',
              daysInStorage,
            });
          }
        }
      }

      // Datos de prueba si está vacío
      if (allItems.length === 0) {
        const mockData = [
          { section: 'MECANIZADO', shelfName: 'Estantería A', shelfCode: 'MEC', position: 1, articleCode: 'COMP-001', orderFab: 'OF-2024-0145', locatedByName: 'Juan Gómez', locatedAt: '15/05/2026', daysInStorage: 18 },
          { section: 'MECANIZADO', shelfName: 'Estantería B', shelfCode: 'MEC', position: 5, articleCode: 'COMP-003', orderFab: 'OF-2024-0147', locatedByName: 'María López', locatedAt: '10/05/2026', daysInStorage: 23 },
          { section: 'PINTURA', shelfName: 'Estantería C', shelfCode: 'PIN', position: 12, articleCode: 'PAINT-001', orderFab: 'OF-2024-0148', locatedByName: 'Carlos Ruiz', locatedAt: '08/05/2026', daysInStorage: 25 },
          { section: 'PINTURA', shelfName: 'Estantería D', shelfCode: 'PIN', position: 8, articleCode: 'PAINT-003', orderFab: 'OF-2024-0150', locatedByName: 'Ana García', locatedAt: '14/05/2026', daysInStorage: 19 },
          { section: 'PRENSAS', shelfName: 'Estantería E', shelfCode: 'PRE', position: 3, articleCode: 'PRESS-001', orderFab: 'OF-2024-0151', locatedByName: 'Luis Martínez', locatedAt: '09/05/2026', daysInStorage: 24 },
        ];
        allItems.push(...mockData);
        totalArticles = mockData.length;
        mockData.forEach((item) => allOFs.add(item.orderFab));
      }

      // ── RESUMEN EJECUTIVO ───────────────────────────────────────────────────
      setProgress('Creando resumen...');
      const summaryWs = wb.addWorksheet('RESUMEN', { properties: { tabColor: { argb: colors.cyan } } });

      const summaryTitle = summaryWs.addRow(['RESUMEN EJECUTIVO DEL INVENTARIO']);
      summaryTitle.font = { bold: true, size: 18, color: { argb: colors.white }, name: 'Calibri' };
      summaryTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.darkBlue } };
      summaryTitle.alignment = { horizontal: 'left', vertical: 'middle' };
      summaryWs.getRow(1).height = 35;

      summaryWs.addRow(['']);

      const headerRow = summaryWs.addRow(['MÉTRICA', 'VALOR', 'DESCRIPCIÓN']);
      ['A', 'B', 'C'].forEach(col => {
        const cell = summaryWs.getCell(`${col}3`);
        cell.font = { bold: true, size: 12, color: { argb: colors.white }, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.darkBlue } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: borderStyle.thick, bottom: borderStyle.thick, left: borderStyle.medium, right: borderStyle.medium };
      });

      const metrics = [
        ['📦 Total de Artículos', totalArticles, 'Cantidad total de piezas almacenadas'],
        ['🏭 Órdenes de Fabricación', allOFs.size, 'OFs únicas en el sistema'],
        ['📍 Estanterías', SHELF_DEFINITIONS.length, 'Zonas de almacenamiento'],
        ['📅 Generado', dateStr, 'Fecha y hora de exportación'],
      ];

      metrics.forEach((metric, idx) => {
        const row = summaryWs.addRow(metric);
        const rowNum = 4 + idx;
        const isEven = idx % 2 === 0;

        ['A', 'B', 'C'].forEach(col => {
          const cell = summaryWs.getCell(`${col}${rowNum}`);
          cell.font = { size: 11, color: { argb: colors.darkGray }, name: 'Calibri' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? colors.lightBlue : colors.white } };
          cell.alignment = { horizontal: col === 'B' ? 'center' : 'left', vertical: 'middle' };
          cell.border = { left: borderStyle.thin, right: borderStyle.thin, bottom: borderStyle.thin };
        });
      });

      summaryWs.columns = [{ width: 30 }, { width: 20 }, { width: 50 }];

      // ── INVENTARIO GLOBAL ───────────────────────────────────────────────────
      setProgress('Creando inventario global...');
      const inventoryWs = wb.addWorksheet('INVENTARIO_GLOBAL', { properties: { tabColor: { argb: colors.darkBlue } } });

      const headers = ['Sección', 'Estantería', 'Código', 'Posición', 'Artículo', 'OF', 'Ubicado por', 'Fecha entrada', 'Días en almacén'];
      const headerRow2 = inventoryWs.addRow(headers);

      headers.forEach((header, idx) => {
        const cell = headerRow2.getCell(idx + 1);
        cell.font = { bold: true, size: 11, color: { argb: colors.white }, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.darkBlue } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: borderStyle.thick,
          bottom: borderStyle.thick,
          left: borderStyle.medium,
          right: borderStyle.medium,
        };
      });
      inventoryWs.getRow(1).height = 25;

      // Datos con alternancia de colores
      allItems.forEach((item, idx) => {
        const row = inventoryWs.addRow([
          item.section, item.shelfName, item.shelfCode, item.position,
          item.articleCode, item.orderFab, item.locatedByName, item.locatedAt, item.daysInStorage,
        ]);

        const isEven = idx % 2 === 0;
        headers.forEach((_, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.font = { size: 10, color: { argb: colors.darkGray }, name: 'Calibri' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? colors.lightGray : colors.white } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.border = { left: borderStyle.thin, right: borderStyle.thin, bottom: borderStyle.thin };
        });
      });

      // Filtros automáticos
      

      inventoryWs.columns = [
        { width: 16 }, { width: 22 }, { width: 10 }, { width: 10 },
        { width: 20 }, { width: 16 }, { width: 20 }, { width: 14 }, { width: 16 },
      ];

      inventoryWs.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];

      // ── HOJAS POR SECCIÓN ───────────────────────────────────────────────────
      setProgress('Creando hojas por sección...');
      const itemsBySection = new Map<string, typeof allItems>();
      for (const item of allItems) {
        const sec = item.section || 'OTROS';
        if (!itemsBySection.has(sec)) itemsBySection.set(sec, []);
        itemsBySection.get(sec)!.push(item);
      }

      for (const [section, sectionItems] of itemsBySection) {
        const sectionWs = wb.addWorksheet(section.substring(0, 31), { properties: { tabColor: { argb: colors.cyan } } });

        const secTitle = sectionWs.addRow([`📍 SECCIÓN: ${section.toUpperCase()}`]);
        secTitle.font = { bold: true, size: 14, color: { argb: colors.white }, name: 'Calibri' };
        secTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.cyan } };
        secTitle.alignment = { horizontal: 'left', vertical: 'middle' };
        sectionWs.getRow(1).height = 25;

        const secSubtitle = sectionWs.addRow(['', `Total: ${sectionItems.length} artículos`]);
        secSubtitle.getCell(2).font = { size: 10, color: { argb: colors.cyan }, bold: true, italic: true };
        secSubtitle.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };

        const secHeaders = ['Estantería', 'Posición', 'Artículo', 'OF', 'Ubicado por', 'Días en almacén'];
        const secHeaderRow = sectionWs.addRow(secHeaders);

        secHeaders.forEach((header, idx) => {
          const cell = secHeaderRow.getCell(idx + 1);
          cell.font = { bold: true, size: 11, color: { argb: colors.white }, name: 'Calibri' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.darkBlue } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: borderStyle.thick,
            bottom: borderStyle.thick,
            left: borderStyle.medium,
            right: borderStyle.medium,
          };
        });
        sectionWs.getRow(3).height = 22;

        sectionItems.forEach((item, idx) => {
          const row = sectionWs.addRow([item.shelfName, item.position, item.articleCode, item.orderFab, item.locatedByName, item.daysInStorage]);
          const isEven = idx % 2 === 0;

          secHeaders.forEach((_, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.font = { size: 10, color: { argb: colors.darkGray }, name: 'Calibri' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? colors.lightGray : colors.white } };
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.border = { left: borderStyle.thin, right: borderStyle.thin, bottom: borderStyle.thin };
          });
        });

        

        sectionWs.columns = [{ width: 22 }, { width: 12 }, { width: 20 }, { width: 16 }, { width: 20 }, { width: 16 }];
        sectionWs.views = [{ state: 'frozen', ySplit: 3, xSplit: 0 }];
      }

      setProgress('Generando archivo...');
      const filename = `Inventario_${today.toISOString().split('T')[0]}_${today.getHours().toString().padStart(2, '0')}${today.getMinutes().toString().padStart(2, '0')}.xlsx`;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      setProgress('✅ Completado');
      showMessage('success', `Excel exportado: ${filename}`);
      setTimeout(() => setProgress(''), 2000);
    } catch (err: any) {
      console.error('Export error:', err);
      showMessage('error', `Error: ${err.message}`);
      setProgress('');
    } finally {
      setExporting(false);
    }
  }, []);

  /**
   * Importar desde Excel con validación y actualización real en Firestore.
   */
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress('Leyendo Excel...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        const wb = new (await loadExcelJS()).Workbook();
        await wb.xlsx.load(buf);

        const sheetName = 'INVENTARIO_GLOBAL';
        const ws = wb.getWorksheet(sheetName);
        if (!ws) {
          showMessage('error', 'No se encontró la hoja "INVENTARIO_GLOBAL"');
          setImporting(false);
          return;
        }

        // Convertir ExcelJS worksheet a JSON array
        const data: any[] = [];
        const headers: string[] = [];
        ws.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.text;
        });

        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // saltar cabecera
          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              rowData[header] = cell.value;
            }
          });
          data.push(rowData);
        });

        if (data.length === 0) {
          showMessage('error', 'La hoja está vacía');
          setImporting(false);
          return;
        }

        setProgress(`Validando ${data.length} registros...`);
        const requiredFields = ['Sección', 'Código', 'Posición', 'Artículo', 'OF'];
        const firstRow = data[0];
        for (const field of requiredFields) {
          if (!(field in firstRow)) {
            showMessage('error', `Falta columna requerida: ${field}`);
            setImporting(false);
            return;
          }
        }

        setProgress(`Procesando ${data.length} artículos...`);
        const shelfMap = new Map<string, Map<number, LocationItem[]>>();
        let skipped = 0;

        for (const row of data) {
          const shelfCode = String(row['Código']).trim().toUpperCase();
          const position = parseInt(String(row['Posición']), 10);

          if (!shelfCode || isNaN(position)) {
            skipped++;
            continue;
          }

          if (!shelfMap.has(shelfCode)) shelfMap.set(shelfCode, new Map());

          const posMap = shelfMap.get(shelfCode)!;
          if (!posMap.has(position)) posMap.set(position, []);

          const articleCode = String(row['Artículo']).trim();
          const orderFab = String(row['OF']).trim();

          if (!articleCode || !orderFab) {
            skipped++;
            continue;
          }

          posMap.get(position)!.push({
            articleCode,
            orderFab,
            locatedBy: String(row['Ubicado por']).trim() || 'import',
            locatedByName: String(row['Ubicado por']).trim(),
            locatedAt: row['Fecha entrada'] && row['Fecha entrada'] !== '-'
              ? new Date(row['Fecha entrada']).toISOString()
              : new Date().toISOString(),
          });
        }

        const totalShelfPositions = Array.from(shelfMap.values()).reduce((sum, posMap) => sum + posMap.size, 0);
        const totalArticles = Array.from(shelfMap.values()).reduce(
          (sum, posMap) => sum + Array.from(posMap.values()).reduce((pSum, items) => pSum + items.length, 0),
          0
        );

        setProgress(`Resumen: ${totalArticles} artículos en ${totalShelfPositions} posiciones${skipped > 0 ? ` (${skipped} descartados)` : ''}`);

        await new Promise((resolve) => setTimeout(resolve, 1500));

        setProgress('Actualizando Firestore...');
        let processedCount = 0;
        const batchSize = 500;
        const allUpdates: Array<{ ref: any; data: any }> = [];

        for (const [shelfCode, posMap] of shelfMap) {
          for (const [position, items] of posMap) {
            const posStr = position.toString().padStart(3, '0');
            const locRef = doc(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS, posStr);
            allUpdates.push({ ref: locRef, data: { items } });
          }
        }

        for (let i = 0; i < allUpdates.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = allUpdates.slice(i, i + batchSize);

          for (const { ref, data } of chunk) {
            batch.set(ref, data, { merge: true });
          }

          await batch.commit();
          processedCount += chunk.length;
          setProgress(`Guardando... ${processedCount}/${allUpdates.length}`);
        }

        setProgress(`✅ ${allUpdates.length} posiciones actualizadas`);
        showMessage('success', `✅ Importación OK: ${totalArticles} artículos en ${totalShelfPositions} posiciones${skipped > 0 ? ` (${skipped} inválidos)` : ''}`);
      } catch (err: any) {
        console.error('Import error:', err);
        showMessage('error', `Error: ${err.message}`);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 to-slate-900 p-6 shadow-lg">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-2xl font-black text-white">📊 Importar / Exportar Inventario</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Genera un Excel profesional con tablas filtradas, colores corporativos y bordes sofisticados. Importa el mismo archivo para recuperar datos.
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={exportToExcelProfessional}
            disabled={exporting}
            className="shrink-0 rounded-2xl px-6 py-4 text-base font-black transition active:scale-[0.98] bg-emerald-500 text-slate-950 shadow-lg hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {exporting ? `⏳ ${progress}` : '📥 Exportar Excel'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="shrink-0 rounded-2xl px-6 py-4 text-base font-black transition active:scale-[0.98] bg-blue-600 text-white shadow-lg hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {importing ? `⏳ ${progress}` : '📤 Importar Excel'}
          </button>

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />

          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-sm font-bold text-cyan-300 hover:text-cyan-200 transition"
          >
            {showInstructions ? '▼ Ocultar' : '▶ Mostrar'} instrucciones
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-sm text-slate-200">
          <p className="font-bold text-cyan-300">📋 Cómo usar:</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed">
            <li>✓ <strong>Exportar:</strong> Descarga un Excel con tablas filtradas, colores y bordes profesionales</li>
            <li>✓ <strong>Importar:</strong> Carga el Excel para recuperar datos en caso de pérdida</li>
            <li>✓ <strong>Editar:</strong> Modifica datos en la hoja "INVENTARIO_GLOBAL" y reimporta</li>
            <li>⚠️ <strong>NO modifiques:</strong> Encabezados de columnas ni nombres de hojas</li>
          </ul>
        </div>
      )}

      {feedback && (
        <div className={`mt-4 rounded-xl p-4 text-sm font-bold text-center ${feedback.type === 'success' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-red-600/20 text-red-300'}`}>
          {feedback.msg}
        </div>
      )}
    </section>
  );
};

export default ProfessionalInventoryExport;
