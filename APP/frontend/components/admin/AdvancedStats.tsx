import React from 'react';
import type { AnalyticsSnapshot } from '../../hooks/useAnalytics';

interface AdvancedStatsProps {
  analytics: AnalyticsSnapshot;
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const AdvancedStats: React.FC<AdvancedStatsProps> = ({ analytics }) => {
  if (analytics.loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
        Cargando metricas avanzadas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Inventario Activo</p>
          <p className="mt-3 text-3xl font-black text-white">{analytics.totalUniqueItems}</p>
          <p className="mt-2 text-sm text-emerald-100/80">Parejas articulo + OF activas</p>
        </div>

        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Huecos Ocupados</p>
          <p className="mt-3 text-3xl font-black text-white">{analytics.occupiedLocations}</p>
          <p className="mt-2 text-sm text-cyan-100/80">de {analytics.totalLocations} ubicaciones totales</p>
        </div>

        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Items Estancados</p>
          <p className="mt-3 text-3xl font-black text-white">{analytics.staleItems.length}</p>
          <p className="mt-2 text-sm text-amber-100/80">Con mas de 5 dias sin movimiento</p>
        </div>

        <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">Parejas Repetidas</p>
          <p className="mt-3 text-3xl font-black text-white">{analytics.repeatedPairs.length}</p>
          <p className="mt-2 text-sm text-fuchsia-100/80">Mismo articulo + OF en varias ubicaciones</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white">Lead Time por Seccion</h2>
              <p className="mt-1 text-sm text-slate-400">Media de dias entre ubicar y retirar calculada desde historial.</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Ciclos cerrados</p>
              <p className="mt-1 text-base font-black text-white">{analytics.leadTime?.totals.completedCycles ?? 0}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {analytics.sectionMetrics.map((metric) => {
              const leadTimeDays = metric.avgLeadTimeDays ?? 0;
              const width = Math.min(100, Math.max(12, leadTimeDays * 6));

              return (
                <div key={metric.section} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-white">{metric.section}</span>
                    <span className="text-slate-400">
                      {metric.avgLeadTimeDays === null ? 'Sin retiros aun' : `${metric.avgLeadTimeDays.toFixed(1)} dias`}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-800">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400"
                      style={{ width: `${metric.avgLeadTimeDays === null ? 8 : width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
          <h2 className="text-lg font-black text-white">Puntos Calientes</h2>
          <p className="mt-1 text-sm text-slate-400">Estanterias con mayor ocupacion actual.</p>

          <div className="mt-5 space-y-3">
            {analytics.shelfMetrics.slice(0, 6).map((metric) => (
              <div key={metric.shelfCode} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{metric.shelfName}</p>
                    <p className="text-xs text-slate-500">{metric.shelfCode} · {metric.section}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-cyan-300">{formatPercent(metric.occupancyRate)}</p>
                    <p className="text-xs text-slate-500">{metric.placements} huecos ocupados</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Alertas de Estancamiento</h2>
            <p className="mt-1 text-sm text-slate-400">Listado de articulos con mas de 5 dias en la misma ubicacion.</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Umbral activo: 5 dias</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Articulo</th>
                <th className="px-4 py-3">OF</th>
                <th className="px-4 py-3">Ubicaciones</th>
                <th className="px-4 py-3">Dias</th>
                <th className="px-4 py-3">Aviso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {analytics.staleItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No hay articulos estancados ahora mismo.</td>
                </tr>
              )}

              {analytics.staleItems.slice(0, 12).map((item) => (
                <tr key={`${item.articleCode}-${item.orderFab}`} className="align-top">
                  <td className="px-4 py-3 font-mono font-bold text-white">{item.articleCode}</td>
                  <td className="px-4 py-3 text-slate-300">{item.orderFab}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {item.locationIds.join(', ')}
                    {item.repeatedPair && <span className="ml-2 rounded-full bg-fuchsia-500/15 px-2 py-1 text-[11px] font-bold text-fuchsia-300">repetido</span>}
                  </td>
                  <td className="px-4 py-3 font-black text-amber-300">{item.daysInLocation}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {item.lastAlertAt ? new Date(item.lastAlertAt).toLocaleString('es-ES') : 'Pendiente'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
        <div>
          <h2 className="text-lg font-black text-white">Parejas Articulo + OF Repetidas</h2>
          <p className="mt-1 text-sm text-slate-400">La app ya detecta y expone cuando la misma pareja aparece en mas de una ubicacion.</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {analytics.repeatedPairs.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-500">
              No hay parejas repetidas activas en este momento.
            </div>
          )}

          {analytics.repeatedPairs.slice(0, 8).map((pair) => (
            <div key={`${pair.articleCode}-${pair.orderFab}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-black text-white">{pair.articleCode}</p>
                  <p className="mt-1 text-sm text-slate-400">{pair.orderFab}</p>
                </div>
                <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-black text-fuchsia-300">
                    {pair.activePresences} presencias
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{pair.locationIds.join(', ')}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{pair.sections.join(', ')} · {pair.shelfCodes.join(', ')}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdvancedStats;


