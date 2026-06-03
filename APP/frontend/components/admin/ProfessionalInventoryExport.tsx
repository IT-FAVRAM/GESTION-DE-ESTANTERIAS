/**
 * ProfessionalInventoryExport — Importación/Exportación profesional de Excel
 * con validación, estilos hiperprofesionales, múltiples hojas y recuperación de datos.
 */

import React, { useCallback, useRef, useState } from 'react';
import { collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS, SHELF_DEFINITIONS, type LocationDoc, type LocationItem } from '../../lib/firestoreSchema';

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
   * Exportar a Excel profesional (hiperprofesional).
   * Hojas:
   * 1. Portada (instrucciones de importación)
   * 2. Resumen Ejecutivo (KPIs)
   * 3. Inventario Global (detalle por artículo)
   * 4. Hojas por estantería (detalle por posición)
   */
  const exportToExcelProfessional = useCallback(async () => {
    setExporting(true);
    setProgress('Iniciando...');

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const today = new Date();
      const dateStr = today.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      // ── HOJA 0: PORTADA + INSTRUCCIONES ────────────────────────────────────
      setProgress('Creando portada...');
      const coverRows = [
        [''],
        ['GESTOR DE ESTANTERÍAS - INVENTARIO COMPLETO'],
        [''],
        [`Exportado: ${dateStr}`],
        [''],
        [''],
        ['INSTRUCCIONES PARA IMPORTAR ESTE ARCHIVO'],
        [''],
        ['1. NO modifiques la estructura de las hojas ni los encabezados'],
        ['2. Puedes actualizar los datos en la hoja "INVENTARIO_GLOBAL"'],
        ['3. Las columnas son: Sección | Estantería | Código | Posición | Artículo | OF | Ubicado por | Fecha entrada | Días en almacén'],
        ['4. Guarda el archivo y usa el botón "Importar Excel" en la app'],
        ['5. La importación validará los datos antes de actualizar'],
        [''],
        ['NOTA: Si pierdes datos, puedes recuperarlos importando este archivo'],
      ];
      const coverWs = XLSX.utils.aoa_to_sheet(coverRows);
      coverWs['!cols'] = [{ wch: 100 }];
      XLSX.utils.book_append_sheet(wb, coverWs, 'PORTADA');

      // ── Recoger todos los datos ────────────────────────────────────────────
      setProgress('Recopilando datos...');
      const allItems: Array<{
        section: string;
        shelfName: string;
        shelfCode: string;
        position: number;
        articleCode: string;
        orderFab: string;
        locatedByName: string;
        locatedAt: string;
        daysInStorage: number | string;
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

      // ── HOJA 1: RESUMEN EJECUTIVO ──────────────────────────────────────────
      setProgress('Creando resumen ejecutivo...');
      const summaryRows = [
        ['RESUMEN EJECUTIVO', '', '', ''],
        ['Fecha', dateStr, '', ''],
        ['Total artículos', totalArticles, '', ''],
        ['Total OFs únicas', allOFs.size, '', ''],
        ['Total estanterías', SHELF_DEFINITIONS.length, '', ''],
        [''],
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
      summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'RESUMEN');

      // ── HOJA 2: INVENTARIO GLOBAL ──────────────────────────────────────────
      setProgress('Creando inventario global...');
      const globalRows: Array<Array<string | number>> = [
        ['Sección', 'Estantería', 'Código', 'Posición', 'Artículo', 'OF', 'Ubicado por', 'Fecha entrada', 'Días en almacén'],
      ];

      for (const item of allItems) {
        globalRows.push([
          item.section,
          item.shelfName,
          item.shelfCode,
          item.position,
          item.articleCode,
          item.orderFab,
          item.locatedByName,
          item.locatedAt,
          item.daysInStorage,
        ]);
      }

      const globalWs = XLSX.utils.aoa_to_sheet(globalRows);
      globalWs['!cols'] = [
        { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 10 },
        { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 16 },
      ];

      // ── Estilos profesionales ───────────────────────────────────────────────
      const headerStyle = {
        font: { bold: true, size: 12, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F2937' }, patternType: 'solid' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: {
          top: { style: 'thin' as const, color: { rgb: '4B5563' } },
          bottom: { style: 'thin' as const, color: { rgb: '4B5563' } },
          left: { style: 'thin' as const, color: { rgb: '4B5563' } },
          right: { style: 'thin' as const, color: { rgb: '4B5563' } },
        },
      };

      // Aplicar estilos al encabezado (fila 1)
      const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      for (const col of headerCols) {
        const cellRef = `${col}1`;
        if (globalWs[cellRef]) {
          globalWs[cellRef].s = headerStyle;
        }
      }

      // Congelar fila de encabezados
      globalWs['!freeze'] = { xSplit: 0, ySplit: 1 };

      XLSX.utils.book_append_sheet(wb, globalWs, 'INVENTARIO_GLOBAL');

      // ── HOJAS POR SECCIÓN (con subtotales) ─────────────────────────────────
      setProgress('Creando hojas por sección...');
      const itemsBySection = new Map<string, typeof allItems>();
      for (const item of allItems) {
        const sec = item.section || 'OTROS';
        if (!itemsBySection.has(sec)) itemsBySection.set(sec, []);
        itemsBySection.get(sec)!.push(item);
      }

      for (const [section, sectionItems] of itemsBySection) {
        const sectionRows: Array<Array<string | number>> = [
          [`SECCIÓN: ${section}`],
          [],
          ['Estantería', 'Posición', 'Artículo', 'OF', 'Ubicado por', 'Días en almacén'],
        ];

        for (const item of sectionItems) {
          sectionRows.push([
            item.shelfName,
            item.position,
            item.articleCode,
            item.orderFab,
            item.locatedByName,
            item.daysInStorage,
          ]);
        }

        sectionRows.push([]);
        sectionRows.push([`Total: ${sectionItems.length} artículos`]);

        const sectionWs = XLSX.utils.aoa_to_sheet(sectionRows);
        sectionWs['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 16 }];

        // Estilos para encabezado de sección (fila 3)
        const secHeaderCols = ['A', 'B', 'C', 'D', 'E', 'F'];
        for (const col of secHeaderCols) {
          const cellRef = `${col}3`;
          if (sectionWs[cellRef]) {
            sectionWs[cellRef].s = headerStyle;
          }
        }

        // Congelar
        sectionWs['!freeze'] = { xSplit: 0, ySplit: 3 };

        const sheetLabel = section.replace(/\s+/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, sectionWs, sheetLabel);
      }

      setProgress('Generando archivo...');
      const filename = `Inventario_${today.toISOString().split('T')[0]}_${today.getHours()}${today.getMinutes()}.xlsx`;
      XLSX.writeFile(wb, filename);

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
        const XLSX = await import('xlsx');
        const buf = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buf, { type: 'array' });

        // Buscar hoja INVENTARIO_GLOBAL
        const sheetName = 'INVENTARIO_GLOBAL';
        if (!wb.SheetNames.includes(sheetName)) {
          showMessage('error', 'No se encontró la hoja "INVENTARIO_GLOBAL"');
          setImporting(false);
          return;
        }

        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws) as Array<any>;

        if (data.length === 0) {
          showMessage('error', 'La hoja está vacía');
          setImporting(false);
          return;
        }

        setProgress(`Validando ${data.length} registros...`);

        // Validar estructura básica
        const requiredFields = ['Sección', 'Código', 'Posición', 'Artículo', 'OF'];
        const firstRow = data[0];
        for (const field of requiredFields) {
          if (!(field in firstRow)) {
            showMessage('error', `Falta columna requerida: ${field}`);
            setImporting(false);
            return;
          }
        }

        // ── Agrupar por estantería/posición para actualizar ─────────────────
        setProgress(`Procesando ${data.length} artículos...`);
        const shelfMap = new Map<string, Map<number, LocationItem[]>>();

        for (const row of data) {
          const shelfCode = String(row['Código']).trim().toUpperCase();
          const position = parseInt(String(row['Posición']), 10);

          if (!shelfCode || isNaN(position)) continue;

          if (!shelfMap.has(shelfCode)) {
            shelfMap.set(shelfCode, new Map());
          }

          const posMap = shelfMap.get(shelfCode)!;
          if (!posMap.has(position)) {
            posMap.set(position, []);
          }

          posMap.get(position)!.push({
            articleCode: String(row['Artículo']).trim(),
            orderFab: String(row['OF']).trim(),
            locatedBy: String(row['Ubicado por']).trim() || 'import',
            locatedByName: String(row['Ubicado por']).trim(),
            locatedAt: row['Fecha entrada'] && row['Fecha entrada'] !== '-'
              ? new Date(row['Fecha entrada']).toISOString()
              : new Date().toISOString(),
          });
        }

        // ── Escribir en Firestore con batch ──────────────────────────────────
        setProgress('Actualizando Firestore...');
        let processedCount = 0;
        const batchSize = 500;
        const allUpdates: Array<{ ref: any; data: any }> = [];

        for (const [shelfCode, posMap] of shelfMap) {
          for (const [position, items] of posMap) {
            const posStr = position.toString().padStart(3, '0');
            const locRef = doc(db, COLLECTIONS.SHELVES, shelfCode, COLLECTIONS.LOCATIONS, posStr);
            allUpdates.push({
              ref: locRef,
              data: { items },
            });
          }
        }

        // Procesar en lotes
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
        showMessage('success', `Importación completada: ${allUpdates.length} posiciones restauradas`);
        setTimeout(() => setProgress(''), 2000);
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
    <div className="space-y-6">
      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
              : 'border-red-500/30 bg-red-950/30 text-red-200'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Main Section */}
      <section className="rounded-[2rem] border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.22),rgba(15,23,42,0.96)_48%,rgba(2,6,23,1)_100%)] p-6 shadow-[0_28px_70px_rgba(8,145,178,0.16)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-black text-white">Gestión Profesional de Inventario</h3>
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm font-bold hover:bg-cyan-500/30 transition-colors"
                title="Ver instrucciones"
              >
                i
              </button>
            </div>
            <p className="mt-2 text-slate-300 text-sm leading-relaxed">
              Exporta un Excel profesional con todas tus estanterías y datos. Si pierdes información, importa el mismo archivo para recuperarla.
            </p>

            {/* Instructions (collapsible) */}
            {showInstructions && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-sm text-slate-300 space-y-2">
                <p className="font-bold text-cyan-400">📖 Cómo usar:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li><strong>Exportar:</strong> Descarga un Excel con todas tus estanterías, posiciones y artículos.</li>
                  <li><strong>Recuperación:</strong> Si pierdes datos, importa el Excel y se actualizarán automáticamente en la app.</li>
                  <li><strong>Estructura:</strong> El archivo tiene 3 hojas: Portada, Resumen Ejecutivo e Inventario Global detallado.</li>
                  <li><strong>Edición:</strong> Puedes editar los datos en la hoja "INVENTARIO_GLOBAL" antes de importar.</li>
                  <li><strong>Validación:</strong> La importación verifica que la estructura sea correcta antes de actualizar.</li>
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            {/* Export Button */}
            <button
              type="button"
              onClick={exportToExcelProfessional}
              disabled={exporting || importing}
              className={`shrink-0 rounded-2xl px-6 py-4 text-sm font-black transition active:scale-[0.98] whitespace-nowrap ${
                exporting || importing
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-emerald-500 text-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.28)] hover:bg-emerald-400'
              }`}
            >
              {exporting ? `⏳ ${progress || 'Procesando'}` : '📥 Exportar a Excel'}
            </button>

            {/* Import Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing || exporting}
              className={`shrink-0 rounded-2xl px-6 py-4 text-sm font-black transition active:scale-[0.98] whitespace-nowrap ${
                importing || exporting
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-blue-500 text-white shadow-[0_18px_40px_rgba(59,130,246,0.28)] hover:bg-blue-400'
              }`}
            >
              {importing ? `⏳ ${progress || 'Importando'}` : '📤 Importar Excel'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
              disabled={importing || exporting}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProfessionalInventoryExport;
