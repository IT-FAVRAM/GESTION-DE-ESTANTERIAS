/**
 * OperativeKpiStrip — Franja de KPIs de la estantería activa para escritorio.
 *
 * Se muestra solo en `desktop` y en `idle`, encima del grid. Da a JEFE/ADMIN una
 * lectura de un vistazo (ocupación, huecos, artículos, urgencias) usando datos ya
 * cargados (las `locations` de la estantería actual + alertas). No hace fetch
 * adicional ni afecta a kioskos/tablets.
 */

import React, { useMemo } from 'react';
import { Boxes, PackageOpen, Layers, AlertTriangle } from 'lucide-react';
import type { ShelfLocationState } from '../../lib/schema/locations';
import type { Shelf } from '../../lib/schema/shelves';
import type { UrgentAlert } from '../../lib/firestoreSchema';
import { computeShelfKpis } from '../../lib/shelfKpis';

interface OperativeKpiStripProps {
  locations: ShelfLocationState[];
  shelfDef?: Shelf;
  shelfName?: string;
  /** Alertas de urgencia activas: sus artículos cuentan como urgentes si están en esta estantería. */
  urgentAlerts?: UrgentAlert[];
}

/** Color de la barra/porcentaje según el nivel de ocupación (verde→ámbar→rojo). */
const occupancyTone = (pct: number) => {
  if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-600' };
  if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-600' };
  if (pct >= 40) return { bar: 'bg-sky-500', text: 'text-sky-600' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
};

const OperativeKpiStrip: React.FC<OperativeKpiStripProps> = ({ locations, shelfDef, shelfName, urgentAlerts }) => {
  const urgentAlertCodes = useMemo(
    () => new Set((urgentAlerts ?? []).map((a) => a.articleCode)),
    [urgentAlerts],
  );
  const { totalSlots, occupiedSlots, emptySlots, totalArticles, pct, urgentArticles, urgentZoneArticles, urgentAlertArticles, urgentSlotsOccupied, urgentSlotsTotal } =
    useMemo(() => computeShelfKpis(locations, shelfDef, urgentAlertCodes), [locations, shelfDef, urgentAlertCodes]);

  const tone = occupancyTone(pct);

  // Desglose del KPI de urgentes (tooltip + subtítulo).
  const urgentDetail = [
    urgentSlotsTotal > 0 ? `${urgentZoneArticles} en zona urgente (${urgentSlotsOccupied}/${urgentSlotsTotal} huecos)` : null,
    urgentAlertArticles > 0 ? `${urgentAlertArticles} con alerta de urgencia` : null,
  ].filter(Boolean).join(' · ');

  const cards = [
    { label: 'Huecos libres', value: emptySlots, Icon: PackageOpen, accent: 'text-emerald-600' },
    { label: 'Ocupados', value: occupiedSlots, Icon: Boxes, accent: 'text-sky-600' },
    { label: 'Artículos', value: totalArticles, Icon: Layers, accent: 'text-slate-600' },
    {
      label: 'Urgentes',
      value: urgentArticles,
      Icon: AlertTriangle,
      accent: urgentArticles > 0 ? 'text-red-600' : 'text-slate-400',
      title: urgentDetail || 'Sin artículos urgentes en esta estantería',
      highlight: urgentArticles > 0,
    },
  ];

  return (
    <div className="flex-shrink-0 px-4 pt-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Ocupación{shelfName ? ` · ${shelfName}` : ''}</p>
            <p className={`text-3xl font-black tabular-nums ${tone.text}`}>{pct}%</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:flex-1">
            {cards.map(({ label, value, Icon, accent, title, highlight }) => (
              <div
                key={label}
                title={title}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${highlight ? 'bg-red-50 ring-1 ring-red-200' : 'bg-slate-50'}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${accent}`} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
                  <p className={`text-lg font-black tabular-nums leading-none ${highlight ? 'text-red-700' : 'text-slate-800'}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Barra de ocupación tipo heatmap (color por nivel de llenado). */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-right text-[11px] font-semibold tabular-nums text-slate-400">{occupiedSlots} / {totalSlots} huecos</p>
      </div>
    </div>
  );
};

export default OperativeKpiStrip;
