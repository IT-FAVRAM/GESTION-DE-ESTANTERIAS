import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { SECTION_DISPLAY_NAMES } from '../../lib/firestoreSchema';
import { ChartIcon, LoadingIcon, ErrorIcon } from '../icons/Icons';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface LeadTimeRow {
  barcode: string;
  orderId: string;
  entryDate: string;
  exitDate: string;
  durationDays: number;
  shelfCode: string;
  section: string;
}

type SortKey = 'durationDays' | 'exitDate' | 'entryDate' | 'barcode' | 'section';

// ── Utilidades de fecha / formato ────────────────────────────────────────────────
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
};
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const sectionName = (s: string) => SECTION_DISPLAY_NAMES[s as keyof typeof SECTION_DISPLAY_NAMES] || s || 'Otros';
const round1 = (n: number) => Math.round(n * 10) / 10;

const median = (sorted: number[]) => {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const percentile = (sorted: number[], p: number) => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

// Cubos de distribución de permanencia (días).
const BUCKETS: Array<{ label: string; min: number; max: number; color: string }> = [
  { label: '0–1 d', min: 0, max: 1, color: '#22c55e' },
  { label: '1–3 d', min: 1, max: 3, color: '#84cc16' },
  { label: '3–7 d', min: 3, max: 7, color: '#eab308' },
  { label: '7–15 d', min: 7, max: 15, color: '#f97316' },
  { label: '15–30 d', min: 15, max: 30, color: '#ef4444' },
  { label: '+30 d', min: 30, max: Infinity, color: '#b91c1c' },
];

const durationColor = (d: number) => (d > 30 ? '#f87171' : d > 7 ? '#facc15' : '#4ade80');

interface Analytics {
  count: number;
  avg: number;
  median: number;
  p90: number;
  max: number;
  min: number;
  slowCount: number;
  bySection: Array<{ section: string; name: string; count: number; avg: number; max: number }>;
  buckets: Array<{ label: string; count: number; color: string }>;
  top: LeadTimeRow[];
}

const computeAnalytics = (rows: LeadTimeRow[]): Analytics => {
  const durations = rows.map((r) => r.durationDays).sort((a, b) => a - b);
  const total = durations.reduce((a, b) => a + b, 0);
  const count = rows.length;

  const sectionMap = new Map<string, { count: number; total: number; max: number }>();
  for (const r of rows) {
    const s = r.section || 'OTROS';
    const cur = sectionMap.get(s) || { count: 0, total: 0, max: 0 };
    cur.count += 1;
    cur.total += r.durationDays;
    cur.max = Math.max(cur.max, r.durationDays);
    sectionMap.set(s, cur);
  }
  const bySection = Array.from(sectionMap.entries())
    .map(([section, v]) => ({ section, name: sectionName(section), count: v.count, avg: round1(v.total / v.count), max: round1(v.max) }))
    .sort((a, b) => b.avg - a.avg);

  const buckets = BUCKETS.map((b) => ({
    label: b.label,
    color: b.color,
    count: rows.filter((r) => r.durationDays >= b.min && r.durationDays < b.max).length,
  }));

  return {
    count,
    avg: count ? round1(total / count) : 0,
    median: round1(median(durations)),
    p90: round1(percentile(durations, 90)),
    max: count ? round1(durations[durations.length - 1]) : 0,
    min: count ? round1(durations[0]) : 0,
    slowCount: rows.filter((r) => r.durationDays > 30).length,
    bySection,
    buckets,
    top: rows.slice().sort((a, b) => b.durationDays - a.durationDays).slice(0, 10),
  };
};

// ── exceljs bajo demanda (igual patrón que ProfessionalInventoryExport) ──────────
let _excelJs: typeof import('exceljs') | null = null;
const loadExcelJS = async (): Promise<typeof import('exceljs')> => {
  if (!_excelJs) {
    const mod = await import('exceljs');
    _excelJs = ((mod as { default?: typeof import('exceljs') }).default ?? mod);
  }
  return _excelJs;
};

// ── Mini-barra horizontal (SVG-free, puro CSS) ───────────────────────────────────
const Bar: React.FC<{ value: number; max: number; color: string; label: string; right: string; sub?: string }> = ({ value, max, color, label, right, sub }) => (
  <div className="flex items-center gap-3">
    <div className="w-32 shrink-0 text-right text-xs font-bold text-slate-300 truncate" title={label}>{label}</div>
    <div className="flex-1 h-6 bg-slate-800 rounded-md overflow-hidden relative">
      <div className="h-full rounded-md transition-all" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, backgroundColor: color }} />
    </div>
    <div className="w-24 shrink-0 text-xs font-mono font-bold text-white text-right">
      {right}{sub && <span className="text-slate-500 font-normal ml-1">{sub}</span>}
    </div>
  </div>
);

export const LeadTimeReport: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeadTimeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('durationDays');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);

  const analytics = useMemo(() => (data ? computeAnalytics(data) : null), [data]);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return data.slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'durationDays') cmp = a.durationDays - b.durationDays;
      else if (sortKey === 'exitDate') cmp = new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime();
      else if (sortKey === 'entryDate') cmp = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
      else cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return cmp * dir;
    });
  }, [data, sortKey, sortDir]);

  const setQuickRange = (months: number) => {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  };

  const fetchDataset = async () => {
    setLoading(true);
    setError(null);
    try {
      const callable = httpsCallable(functions, 'leadTimeDataset');
      const result = await callable({
        dateFrom: new Date(dateFrom + 'T00:00:00').toISOString(),
        dateTo: new Date(dateTo + 'T23:59:59').toISOString(),
      });
      const payload = result.data as { rows: LeadTimeRow[]; generatedAt?: string };
      setData(payload.rows || []);
      setGeneratedAt(payload.generatedAt || new Date().toISOString());
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar datos');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'barcode' || key === 'section' ? 'asc' : 'desc'); }
  };

  // ── Export Excel ───────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!data || !analytics) return;
    setExporting(true);
    try {
      const wb = new (await loadExcelJS()).Workbook();
      wb.creator = 'WMS — Análisis Lead Time';
      const period = `${fmtDate(dateFrom)} a ${fmtDate(dateTo)}`;

      // Hoja Resumen
      const sum = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
      sum.columns = [{ width: 34 }, { width: 18 }];
      const titleRow = sum.addRow(['Análisis de Lead Time (Permanencia en almacén)']);
      titleRow.font = { bold: true, size: 16, color: { argb: 'FF0E7490' } };
      sum.addRow([`Periodo (por fecha de salida): ${period}`]).font = { italic: true, color: { argb: 'FF64748B' } };
      sum.addRow([]);
      const kpiHeader = sum.addRow(['Indicador', 'Valor']);
      kpiHeader.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } }; c.alignment = { horizontal: 'left' }; });
      const kpis: Array<[string, string | number]> = [
        ['Ciclos analizados', analytics.count],
        ['Permanencia media (días)', analytics.avg],
        ['Mediana (días)', analytics.median],
        ['Percentil 90 (días)', analytics.p90],
        ['Máxima permanencia (días)', analytics.max],
        ['Mínima permanencia (días)', analytics.min],
        ['Rotación lenta (>30 días)', analytics.slowCount],
      ];
      kpis.forEach(([k, v]) => { const r = sum.addRow([k, v]); r.getCell(1).font = { bold: true, color: { argb: 'FF334155' } }; r.getCell(2).alignment = { horizontal: 'right' }; });
      sum.addRow([]);
      const secHdr = sum.addRow(['Sección', 'Ciclos', 'Media (d)', 'Máx (d)']);
      sum.getColumn(3).width = 14; sum.getColumn(4).width = 14;
      secHdr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } }; });
      analytics.bySection.forEach((s) => sum.addRow([s.name, s.count, s.avg, s.max]));

      // Hoja Detalle
      const det = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
      det.columns = [
        { header: 'Artículo', key: 'barcode', width: 22 },
        { header: 'OF', key: 'orderId', width: 18 },
        { header: 'Sección', key: 'section', width: 22 },
        { header: 'Estantería', key: 'shelfCode', width: 12 },
        { header: 'Entrada', key: 'entryDate', width: 20 },
        { header: 'Salida', key: 'exitDate', width: 20 },
        { header: 'Días en almacén', key: 'durationDays', width: 16 },
      ];
      det.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; });
      sortedRows.forEach((r) => {
        const row = det.addRow({
          barcode: r.barcode, orderId: r.orderId, section: sectionName(r.section), shelfCode: r.shelfCode,
          entryDate: fmtDateTime(r.entryDate), exitDate: fmtDateTime(r.exitDate), durationDays: r.durationDays,
        });
        const dc = row.getCell('durationDays');
        dc.numFmt = '0.0';
        dc.font = { bold: true, color: { argb: r.durationDays > 30 ? 'FFB91C1C' : r.durationDays > 7 ? 'FFB45309' : 'FF15803D' } };
      });
      det.autoFilter = { from: 'A1', to: 'G1' };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead-time_${dateFrom}_${dateTo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[LeadTime] Excel export error', err);
      setError('No se pudo generar el Excel.');
    } finally {
      setExporting(false);
    }
  };

  // ── Export PDF (ventana imprimible → "Guardar como PDF") ─────────────────────────
  const exportPDF = () => {
    if (!data || !analytics) return;
    const period = `${fmtDate(dateFrom)} a ${fmtDate(dateTo)}`;
    const maxSecAvg = Math.max(1, ...analytics.bySection.map((s) => s.avg));
    const maxBucket = Math.max(1, ...analytics.buckets.map((b) => b.count));

    const kpiCards = [
      ['Ciclos analizados', String(analytics.count), '#0369a1'],
      ['Permanencia media', `${analytics.avg} d`, '#0891b2'],
      ['Mediana', `${analytics.median} d`, '#0d9488'],
      ['Percentil 90', `${analytics.p90} d`, '#7c3aed'],
      ['Máx. permanencia', `${analytics.max} d`, '#ea580c'],
      ['Rotación lenta >30d', String(analytics.slowCount), '#dc2626'],
    ].map(([l, v, c]) => `<div class="kpi"><div class="kpi-l">${l}</div><div class="kpi-v" style="color:${c}">${v}</div></div>`).join('');

    const secBars = analytics.bySection.map((s) => `
      <div class="barrow">
        <div class="barlabel">${s.name}</div>
        <div class="bartrack"><div class="barfill" style="width:${(s.avg / maxSecAvg) * 100}%;background:#0891b2"></div></div>
        <div class="barval">${s.avg} d <span class="muted">(${s.count})</span></div>
      </div>`).join('');

    const bucketBars = analytics.buckets.map((b) => `
      <div class="barrow">
        <div class="barlabel">${b.label}</div>
        <div class="bartrack"><div class="barfill" style="width:${(b.count / maxBucket) * 100}%;background:${b.color}"></div></div>
        <div class="barval">${b.count}</div>
      </div>`).join('');

    const rowsHtml = sortedRows.map((r) => `
      <tr>
        <td class="mono">${r.barcode}</td>
        <td>${r.orderId}</td>
        <td>${sectionName(r.section)}</td>
        <td>${r.shelfCode}</td>
        <td>${fmtDate(r.entryDate)}</td>
        <td>${fmtDate(r.exitDate)}</td>
        <td class="num" style="color:${durationColor(r.durationDays)};font-weight:700">${round1(r.durationDays)}</td>
      </tr>`).join('');

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Análisis Lead Time ${period}</title>
    <style>
      *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:32px;font-size:12px}
      h1{font-size:22px;margin:0 0 4px} .sub{color:#64748b;margin:0 0 18px}
      .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px}
      .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}
      .kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700}
      .kpi-v{font-size:24px;font-weight:800;margin-top:2px}
      h2{font-size:14px;margin:22px 0 10px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
      .charts{display:grid;grid-template-columns:1fr 1fr;gap:24px}
      .barrow{display:flex;align-items:center;gap:8px;margin:5px 0}
      .barlabel{width:120px;font-size:10px;text-align:right;color:#334155;font-weight:600}
      .bartrack{flex:1;height:14px;background:#f1f5f9;border-radius:6px;overflow:hidden}
      .barfill{height:100%;border-radius:6px}
      .barval{width:70px;font-size:10px;font-weight:700;text-align:right}
      .muted{color:#94a3b8;font-weight:400}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
      th{background:#1e40af;color:#fff;font-size:10px;text-transform:uppercase}
      td.mono{font-family:ui-monospace,Menlo,monospace;font-weight:700} td.num{text-align:right}
      tr:nth-child(even) td{background:#f8fafc}
      @media print{body{margin:12mm} .charts{break-inside:avoid}}
    </style></head><body>
      <h1>Análisis de Lead Time</h1>
      <p class="sub">Permanencia de artículos en almacén · Periodo (fecha de salida): <b>${period}</b> · Generado: ${fmtDateTime(generatedAt)}</p>
      <div class="kpis">${kpiCards}</div>
      <div class="charts">
        <div><h2>Permanencia media por sección</h2>${secBars || '<p class="muted">Sin datos</p>'}</div>
        <div><h2>Distribución de permanencia</h2>${bucketBars}</div>
      </div>
      <h2>Detalle (${sortedRows.length} ciclos)</h2>
      <table><thead><tr><th>Artículo</th><th>OF</th><th>Sección</th><th>Est.</th><th>Entrada</th><th>Salida</th><th>Días</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { setError('Permite las ventanas emergentes para exportar a PDF.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const SortableTh: React.FC<{ k: SortKey; children: React.ReactNode; align?: string }> = ({ k, children, align }) => (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-cyan-300 ${align || ''}`}
      onClick={() => toggleSort(k)}
    >
      {children}{sortKey === k && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );

  return (
    <div className="space-y-6">
      {/* CONTROLES */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Desde (salida)</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Hasta (salida)</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
          </div>
          <button onClick={fetchDataset} disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2">
            {loading ? <LoadingIcon className="animate-spin h-5 w-5" /> : <ChartIcon className="h-5 w-5" />}
            Analizar
          </button>
          {data && (
            <div className="flex gap-2 ml-auto">
              <button onClick={exportExcel} disabled={exporting || data.length === 0} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm">
                {exporting ? <LoadingIcon className="animate-spin h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />} Excel
              </button>
              <button onClick={exportPDF} disabled={data.length === 0} className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" aria-hidden /> PDF
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-bold uppercase">Rangos rápidos:</span>
          {[['1 mes', 1], ['3 meses', 3], ['6 meses', 6], ['1 año', 12]].map(([lbl, m]) => (
            <button key={lbl} onClick={() => setQuickRange(m as number)} className="text-xs bg-slate-900 border border-slate-600 hover:border-cyan-500 text-slate-300 rounded px-3 py-1.5 transition-colors">
              {lbl}
            </button>
          ))}
          <p className="text-xs text-slate-500 italic ml-2">Mide los días que cada artículo permaneció ubicado (UBICAR → RETIRAR) antes de salir.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg flex items-center gap-2">
          <ErrorIcon className="h-5 w-5" /> {error}
        </div>
      )}

      {data && data.length === 0 && !loading && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
          <p className="text-slate-300 font-bold">No hay ciclos completos en este periodo</p>
          <p className="text-slate-500 text-sm mt-1">Un ciclo necesita una ubicación (UBICAR) y su retirada (RETIRAR). Prueba a ampliar el rango de fechas.</p>
        </div>
      )}

      {analytics && data && data.length > 0 && (
        <div className="animate-fade-in space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { l: 'Ciclos analizados', v: analytics.count, c: 'text-white' },
              { l: 'Permanencia media', v: `${analytics.avg}`, u: 'días', c: 'text-cyan-400' },
              { l: 'Mediana', v: `${analytics.median}`, u: 'días', c: 'text-teal-400' },
              { l: 'Percentil 90', v: `${analytics.p90}`, u: 'días', c: 'text-violet-400' },
              { l: 'Máx. permanencia', v: `${analytics.max}`, u: 'días', c: 'text-orange-400' },
              { l: 'Rotación lenta >30d', v: analytics.slowCount, c: 'text-red-400' },
            ].map((k) => (
              <div key={k.l} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p className="text-slate-400 text-[11px] font-bold uppercase leading-tight">{k.l}</p>
                <p className={`text-2xl font-bold ${k.c}`}>{k.v}{k.u && <span className="text-xs text-slate-500 ml-1">{k.u}</span>}</p>
              </div>
            ))}
          </div>

          {/* CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700">
              <h3 className="text-sm font-black text-white uppercase tracking-wide mb-4">Permanencia media por sección</h3>
              <div className="space-y-2.5">
                {analytics.bySection.length === 0 ? <p className="text-slate-500 text-sm">Sin datos</p> : analytics.bySection.map((s) => (
                  <Bar key={s.section} label={s.name} value={s.avg} max={Math.max(...analytics.bySection.map((x) => x.avg))} color="#22d3ee" right={`${s.avg} d`} sub={`(${s.count})`} />
                ))}
              </div>
            </div>

            <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700">
              <h3 className="text-sm font-black text-white uppercase tracking-wide mb-4">Distribución de permanencia</h3>
              <div className="space-y-2.5">
                {analytics.buckets.map((b) => (
                  <Bar key={b.label} label={b.label} value={b.count} max={Math.max(...analytics.buckets.map((x) => x.count))} color={b.color} right={`${b.count}`} sub={analytics.count ? `${Math.round((b.count / analytics.count) * 100)}%` : ''} />
                ))}
              </div>
            </div>
          </div>

          {/* TOP 10 más lentos */}
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700">
            <h3 className="text-sm font-black text-white uppercase tracking-wide mb-4">Top 10 — Mayor permanencia</h3>
            <div className="space-y-2.5">
              {analytics.top.map((r) => (
                <Bar key={`${r.barcode}-${r.exitDate}`} label={r.barcode} value={r.durationDays} max={analytics.top[0]?.durationDays || 1} color={durationColor(r.durationDays)} right={`${round1(r.durationDays)} d`} sub={sectionName(r.section)} />
              ))}
            </div>
          </div>

          {/* TABLA DETALLE */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">Detalle — {sortedRows.length} ciclos</h3>
              <span className="text-xs text-slate-500">Clic en cabecera para ordenar</span>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-400 sticky top-0 z-10">
                  <tr>
                    <SortableTh k="barcode">Artículo</SortableTh>
                    <th className="px-4 py-3">OF</th>
                    <SortableTh k="section">Sección</SortableTh>
                    <SortableTh k="entryDate" align="text-right">Entrada</SortableTh>
                    <SortableTh k="exitDate" align="text-right">Salida</SortableTh>
                    <SortableTh k="durationDays" align="text-right">Días en almacén</SortableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sortedRows.map((row, idx) => (
                    <tr key={`${row.barcode}-${idx}`} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-white font-bold">{row.barcode}</td>
                      <td className="px-4 py-3 text-slate-400">{row.orderId}</td>
                      <td className="px-4 py-3 text-slate-400">{sectionName(row.section)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmtDate(row.entryDate)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmtDate(row.exitDate)}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: durationColor(row.durationDays) }}>
                        {round1(row.durationDays)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
