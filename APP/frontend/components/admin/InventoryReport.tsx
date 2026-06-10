/**
 * InventoryReport — Centro de Inteligencia Operativa.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import ExcelJS from 'exceljs';
import { useAnalytics } from '../../hooks/useAnalytics';
import { db } from '../../lib/firebase';
import { COLLECTIONS, SHELF_DEFINITIONS, type LocationDoc } from '../../lib/firestoreSchema';
import { LeadTimeReport } from '../views/LeadTimeReport';
import ProfessionalInventoryExport from './ProfessionalInventoryExport';

type ReportTab = 'overview' | 'performance' | 'alerts';

interface InventoryReportProps {
  onClose?: () => void;
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const InventoryReport: React.FC<InventoryReportProps> = ({ onClose }) => {
  const analytics = useAnalytics();
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  /**
   * Construye las filas detalle de una estantería y acumula datos de resumen global.
   */
  const buildShelfRows = (
    shelf: (typeof SHELF_DEFINITIONS)[number],
    locationMap: Map<string, LocationDoc>,
    dateStr: string,
    globalRows?: Array<Array<string | number>>,
  ): { sheetRows: Array<Array<string | number>>; totalArticles: number; allOFs: Set<string> } => {
    const rows: Array<Array<string | number>> = [];
    rows.push([`Estantería: ${shelf.name} (${shelf.code})`, '', '', '', `Exportado: ${dateStr}`]);
    rows.push([]);
    rows.push(['Posición', 'Estado', 'Nº Artículos', 'Artículos', 'OFs', 'Último Ingreso', 'Días en Almacén']);

    let totalArticles = 0;
    const allOFs = new Set<string>();

    for (let i = 1; i <= shelf.locationCount; i += 1) {
      const pos = i.toString().padStart(3, '0');
      const locData = locationMap.get(pos);
      const items = locData?.items || [];
      const isEmpty = items.length === 0;

      totalArticles += items.length;
      items.forEach((item) => allOFs.add(item.orderFab));

      const latestDate = items.reduce((latest, item) => {
        const date = new Date(item.locatedAt);
        return date > latest ? date : latest;
      }, new Date(0));

      const daysInStorage = items.length > 0
        ? Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24))
        : '-';

      rows.push([
        parseInt(pos, 10),
        isEmpty ? 'VACÍO' : 'OCUPADO',
        items.length,
        items.map((item) => item.articleCode).join(' | '),
        items.map((item) => item.orderFab).join(' | '),
        items.length > 0 ? latestDate.toLocaleDateString('es-ES') : '-',
        daysInStorage,
      ]);

      // Acumular en resumen global (una fila por artículo)
      if (globalRows) {
        for (const item of items) {
          globalRows.push([
            shelf.section || 'OTROS',
            shelf.name,
            shelf.code,
            parseInt(pos, 10),
            item.articleCode,
            item.orderFab,
            item.locatedByName || item.locatedBy || '',
            item.locatedAt ? new Date(item.locatedAt).toLocaleDateString('es-ES') : '-',
            daysInStorage === '-' ? '-' : daysInStorage,
          ]);
        }
      }
    }

    rows.push([]);
    rows.push(['TOTALES', '', totalArticles, `${allOFs.size} OFs únicas`, '', '', '']);
    return { sheetRows: rows, totalArticles, allOFs };
  };

  const exportToExcel = useCallback(async () => {
    setExporting(true);

    try {
      const wb = new ExcelJS.Workbook();
      const today = new Date().toISOString().split('T')[0];
      const dateStr = new Date().toLocaleDateString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });

      // ── 1. Recoger datos de todas las estanterías ─────────────────────────
      const shelfDataList: Array<{ shelf: (typeof SHELF_DEFINITIONS)[number]; locationMap: Map<string, LocationDoc> }> = [];
      for (const shelf of SHELF_DEFINITIONS) {
        setProgress(`Procesando ${shelf.name}...`);
        const locationsRef = collection(db, COLLECTIONS.SHELVES, shelf.code, COLLECTIONS.LOCATIONS);
        const snapshot = await getDocs(locationsRef);
        const locationMap = new Map<string, LocationDoc>();
        snapshot.forEach((docSnap) => locationMap.set(docSnap.id, docSnap.data() as LocationDoc));
        shelfDataList.push({ shelf, locationMap });
      }

      // ── 2. Construir hoja RESUMEN GLOBAL (primero) ────────────────────────
      setProgress('Construyendo resumen global...');
      const globalWs = wb.addWorksheet('RESUMEN GLOBAL');
      globalWs.addRow([`INVENTARIO GLOBAL — ${dateStr}`]);
      globalWs.addRow([`Total estanterías: ${SHELF_DEFINITIONS.length}`]);
      globalWs.addRow([]);
      globalWs.addRow(['Sección', 'Estantería', 'Código', 'Posición', 'Artículo', 'OF', 'Ubicado por', 'Fecha entrada', 'Días en almacén']);
      
      const globalRows: Array<Array<string | number>> = [];

      // ── 3. Generar hojas por estantería + acumular resumen ─────────────────
      for (const { shelf, locationMap } of shelfDataList) {
        const { sheetRows } = buildShelfRows(shelf, locationMap, dateStr, globalRows);
        const ws = wb.addWorksheet(shelf.name.substring(0, 31));
        sheetRows.forEach(row => ws.addRow(row));
        ws.columns = [
          { width: 12 }, { width: 10 }, { width: 14 }, { width: 35 }, { width: 25 }, { width: 16 }, { width: 16 },
        ];
      }

      // ── 4. Añadir datos al RESUMEN GLOBAL ─────────────────────────
      globalRows.forEach(row => globalWs.addRow(row));
      globalWs.columns = [
        { width: 16 }, { width: 22 }, { width: 10 }, { width: 10 },
        { width: 20 }, { width: 16 }, { width: 20 }, { width: 14 }, { width: 16 },
      ];

      setProgress('Generando archivo...');
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Inventario_Global_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setProgress('Completado');
      window.setTimeout(() => {
        setProgress('');
        setExporting(false);
      }, 1800);
    } catch (err: any) {
      console.error('[InventoryReport] Export error:', err);
      setProgress(`Error: ${err.message}`);
      setExporting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [exportingSection, setExportingSection] = useState<string | null>(null);

  const exportSectionToExcel = useCallback(async (sectionName: string) => {
    setExportingSection(sectionName);
    setExporting(true);

    try {
      const wb = new ExcelJS.Workbook();
      const today = new Date().toISOString().split('T')[0];
      const dateStr = new Date().toLocaleDateString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });

      const sectionShelves = SHELF_DEFINITIONS.filter((s) => (s.section || 'OTROS') === sectionName);

      // ── Recoger datos ──────────────────────────────────────────────────────
      const summaryWs = wb.addWorksheet(`RESUMEN ${sectionName}`.substring(0, 31));
      summaryWs.addRow([`INVENTARIO SECCIÓN: ${sectionName} — ${dateStr}`]);
      summaryWs.addRow([`${sectionShelves.length} estantería(s)`]);
      summaryWs.addRow([]);
      summaryWs.addRow(['Estantería', 'Código', 'Posición', 'Artículo', 'OF', 'Ubicado por', 'Fecha entrada', 'Días en almacén']);

      for (const shelf of sectionShelves) {
        setProgress(`${sectionName}: ${shelf.name}...`);
        const locationsRef = collection(db, COLLECTIONS.SHELVES, shelf.code, COLLECTIONS.LOCATIONS);
        const snapshot = await getDocs(locationsRef);
        const locationMap = new Map<string, LocationDoc>();
        snapshot.forEach((docSnap) => locationMap.set(docSnap.id, docSnap.data() as LocationDoc));

        for (let i = 1; i <= shelf.locationCount; i += 1) {
          const pos = i.toString().padStart(3, '0');
          const locData = locationMap.get(pos);
          const items = locData?.items || [];
          for (const item of items) {
            const daysInStorage = item.locatedAt
              ? Math.floor((Date.now() - new Date(item.locatedAt).getTime()) / (1000 * 60 * 60 * 24))
              : '-';
            summaryWs.addRow([
              shelf.name,
              shelf.code,
              parseInt(pos, 10),
              item.articleCode,
              item.orderFab,
              item.locatedByName || item.locatedBy || '',
              item.locatedAt ? new Date(item.locatedAt).toLocaleDateString('es-ES') : '-',
              daysInStorage,
            ]);
          }
        }

        const { sheetRows } = buildShelfRows(shelf, locationMap, dateStr);
        const ws = wb.addWorksheet(shelf.name.substring(0, 31));
        sheetRows.forEach(row => ws.addRow(row));
        ws.columns = [
          { width: 12 }, { width: 10 }, { width: 14 }, { width: 35 }, { width: 25 }, { width: 16 }, { width: 16 },
        ];
      }

      summaryWs.columns = [
        { width: 22 }, { width: 10 }, { width: 10 }, { width: 20 }, { width: 16 }, { width: 20 }, { width: 14 }, { width: 16 },
      ];

      setProgress('Generando archivo...');
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Inventario_${sectionName}_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      setProgress('Completado');
      window.setTimeout(() => {
        setProgress('');
        setExporting(false);
        setExportingSection(null);
      }, 1800);
    } catch (err: any) {
      console.error('[InventoryReport] Section export error:', err);
      setProgress(`Error: ${err.message}`);
      setExporting(false);
      setExportingSection(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const occupancyRate = analytics.totalLocations === 0 ? 0 : analytics.occupiedLocations / analytics.totalLocations;
  const criticalShelves = useMemo(() => analytics.shelfMetrics, [analytics.shelfMetrics]);
  const sectionMetrics = useMemo(() => analytics.sectionMetrics, [analytics.sectionMetrics]);
  const staleItems = useMemo(() => analytics.staleItems, [analytics.staleItems]);
  const repeatedPairs = useMemo(() => analytics.repeatedPairs, [analytics.repeatedPairs]);

  return (
    <div className="flex flex-col space-y-6">
      {/* Header and Tabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2"><span className="text-3xl">📊</span> Inteligencia Operativa</h2>
          <p className="text-slate-400 text-sm mt-1">Métricas unificadas, análisis de cuellos de botella y alertas del almacén.</p>
        </div>
        <div className="bg-slate-900/80 p-1.5 rounded-2xl flex gap-1 border border-slate-800 backdrop-blur-md">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon="📥" label="Exportar y Resumen" />
          <TabButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} icon="⚡" label="Lead Time y Ocupación" />
          <TabButton active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} icon="🚨" label={`Alertas (${staleItems.length + repeatedPairs.length})`} />
        </div>
      </div>

      {analytics.error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-200">
          {analytics.error}
        </div>
      )}

      {/* Tabs Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Professional Import/Export Component */}
          <ProfessionalInventoryExport onExportComplete={() => setProgress('')} />

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Artículos Únicos" value={analytics.totalUniqueItems.toString()} subtitle="Referencias activas" accent="cyan" />
            <MetricCard label="Huecos Ocupados" value={`${analytics.occupiedLocations}`} subtitle={`De ${analytics.totalLocations} totales`} accent="emerald" />
            <MetricCard label="Saturación Global" value={formatPercent(occupancyRate)} subtitle="Ocupación física" accent="amber" />
            <MetricCard label="Pares Duplicados" value={repeatedPairs.length.toString()} subtitle="Ref + OF repetida" accent="rose" />
          </div>

          {/* Critical Shelves */}
          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6">
            <h3 className="text-lg font-black text-white">Estanterías con mayor presión</h3>
            <p className="mt-1 text-sm text-slate-400">Identifica rápidamente dónde hace falta liberar espacio.</p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {criticalShelves.slice(0, 6).map((metric) => (
                  <div key={metric.shelfCode} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex items-center justify-between hover:border-slate-600 transition-colors">
                     <div>
                       <p className="font-bold text-white text-base">{metric.shelfName}</p>
                       <p className="text-xs text-slate-500 mt-1">{metric.shelfCode} · {metric.section}</p>
                     </div>
                     <div className="text-right">
                       <p className={`text-xl font-black ${metric.occupancyRate > 0.8 ? 'text-rose-400' : metric.occupancyRate > 0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatPercent(metric.occupancyRate)}</p>
                       <p className="text-[10px] uppercase font-bold text-slate-500">{metric.placements} presencias</p>
                     </div>
                  </div>
               ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6 animate-fade-in">
           {/* Section Performance */}
           <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6">
             <div className="flex items-center justify-between gap-4 mb-6">
               <div>
                 <h3 className="text-lg font-black text-white">Rendimiento por Sección</h3>
                 <p className="mt-1 text-sm text-slate-400">Balance entre la ocupación actual y la velocidad de salida (Lead Time).</p>
               </div>
               <div className="text-right text-xs font-bold text-slate-500 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                  Total ciclos medidos: <span className="text-white ml-1">{analytics.leadTime?.totals.completedCycles ?? 0}</span>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {sectionMetrics.map((metric) => (
                 <div key={metric.section} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 hover:border-slate-700 transition-colors">
                   <div className="flex justify-between items-start mb-4">
                     <p className="font-black text-white text-lg">{metric.section}</p>
                     <div className="flex items-center gap-2">
                       <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-1 rounded font-bold">{metric.uniqueItems} art.</span>
                       <button
                         onClick={() => exportSectionToExcel(metric.section)}
                         disabled={exporting}
                         title={`Exportar Excel de ${metric.section}`}
                         className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/30 text-[10px] px-2 py-1 rounded font-bold transition-colors disabled:opacity-40"
                       >
                         {exportingSection === metric.section ? '⏳' : '📊 Excel'}
                       </button>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <div>
                       <div className="flex justify-between text-xs font-bold mb-1">
                         <span className="text-slate-400">Saturación</span>
                         <span className={metric.occupancyRate > 0.8 ? 'text-rose-400' : 'text-emerald-400'}>{formatPercent(metric.occupancyRate)}</span>
                       </div>
                       <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                         <div className={`h-full ${metric.occupancyRate > 0.8 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, metric.occupancyRate * 100)}%` }} />
                       </div>
                     </div>
                     <div>
                       <div className="flex justify-between text-xs font-bold mb-1">
                         <span className="text-slate-400">Tiempo Medio (Lead Time)</span>
                         <span className="text-cyan-400">{metric.avgLeadTimeDays !== null ? `${metric.avgLeadTimeDays.toFixed(1)} días` : 'N/A'}</span>
                       </div>
                       <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                         <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, (metric.avgLeadTimeDays || 0) * 5)}%` }} />
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           </section>

           {/* Lead Time Dataset */}
           <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6">
             <h3 className="text-2xl font-black text-white mb-2">Tiempos de Permanencia</h3>
             <p className="text-slate-400 mb-6 max-w-2xl text-sm">
               Análisis de ciclo de vida: tiempo entre ubicar y retirar cada artículo.
             </p>
             <LeadTimeReport />
           </section>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6 animate-fade-in">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TablePanel
                title="⚠️ Estancamiento Crítico"
                subtitle="Artículos con más de 5 días sin moverse de su ubicación."
                emptyText={analytics.loading ? 'Cargando datos...' : '¡Excelente! No hay artículos estancados.'}
                rows={staleItems.slice(0, 15).map((item) => ({
                  title: `${item.articleCode} · ${item.orderFab}`,
                  detail: `Ubicación: ${item.locationIds.join(', ')} (${item.shelfCode})`,
                  badge: `${item.daysInLocation} días`,
                  tone: item.daysInLocation >= 15 ? 'danger' : item.daysInLocation >= 8 ? 'warning' : 'neutral',
                }))}
              />

              <TablePanel
                title="🔄 Duplicidades Activas"
                subtitle="El mismo artículo y OF detectados en múltiples huecos."
                emptyText={analytics.loading ? 'Cargando datos...' : 'No hay duplicidades en el sistema.'}
                rows={repeatedPairs.slice(0, 15).map((pair) => ({
                  title: `${pair.articleCode} · ${pair.orderFab}`,
                  detail: `Estanterías: ${pair.shelfCodes.join(', ')}`,
                  badge: `${pair.placements} huecos`,
                  tone: pair.placements >= 3 ? 'danger' : 'warning',
                }))}
              />
           </div>
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
      active ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
    }`}
  >
    <span>{icon}</span>
    {label}
  </button>
);

const MetricCard: React.FC<{ label: string; value: string; subtitle: string; accent: 'cyan' | 'emerald' | 'amber' | 'rose' }> = ({ label, value, subtitle, accent }) => {
  const accents = {
    cyan: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
    emerald: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    rose: 'border-rose-400/20 bg-rose-500/10 text-rose-200',
  };

  return (
    <div className={`rounded-3xl border p-5 ${accents[accent]}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs opacity-70 font-bold">{subtitle}</p>
    </div>
  );
};

const TablePanel: React.FC<{
  title: string;
  subtitle: string;
  emptyText: string;
  rows: Array<{ title: string; detail: string; badge: string; tone: 'neutral' | 'warning' | 'danger' }>;
}> = ({ title, subtitle, emptyText, rows }) => {
  const toneClasses = {
    neutral: 'bg-slate-800 text-slate-300',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  };

  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 flex flex-col h-full">
      <div className="mb-5">
        <h3 className="text-xl font-black text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {rows.length === 0 && (
          <div className="h-32 flex items-center justify-center border border-dashed border-slate-700 rounded-2xl">
             <p className="text-sm text-slate-500 font-bold">{emptyText}</p>
          </div>
        )}
        {rows.map((row) => (
          <div key={`${row.title}-${row.badge}-${row.detail}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 hover:border-slate-700 transition-colors">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{row.title}</p>
              <p className="mt-1 text-xs text-slate-500 font-medium">{row.detail}</p>
            </div>
            <span className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-black ${toneClasses[row.tone]}`}>{row.badge}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InventoryReport;


