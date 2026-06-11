import React, { useState, useEffect } from 'react';
import type { AppConfig } from '../../lib/firestoreSchema';
import { SHELF_DEFINITIONS } from '../../lib/firestoreSchema';

interface AdminSpecialLocationsTabProps {
  config: AppConfig;
  urgentDraft: string;
  techDraft: string;
  setUrgentDraft: React.Dispatch<React.SetStateAction<string>>;
  setTechDraft: React.Dispatch<React.SetStateAction<string>>;
  onSaveConfig: (updates: Partial<AppConfig>) => Promise<void>;
}

// Obtener todas las ubicaciones especiales desde código
const getPredefinedLocations = (): { urgente: string[]; revision: string[]; aluminio: string[] } => {
  const urgente: string[] = [];
  const revision: string[] = [];
  const aluminio: string[] = [];

  SHELF_DEFINITIONS.forEach(shelf => {
    shelf.layout.zones.forEach(zone => {
      if (zone.isUrgent) {
        for (let i = zone.range[0]; i <= zone.range[1]; i++) {
          urgente.push(`${shelf.code}-${i.toString().padStart(3, '0')}`);
        }
      }
      if (zone.isTechReview) {
        for (let i = zone.range[0]; i <= zone.range[1]; i++) {
          revision.push(`${shelf.code}-${i.toString().padStart(3, '0')}`);
        }
      }
      if (zone.name === 'ALUMINIO') {
        for (let i = zone.range[0]; i <= zone.range[1]; i++) {
          aluminio.push(`${shelf.code}-${i.toString().padStart(3, '0')}`);
        }
      }
    });
  });

  return { urgente, revision, aluminio };
};

const AdminSpecialLocationsTab: React.FC<AdminSpecialLocationsTabProps> = ({ config, urgentDraft, techDraft, setUrgentDraft, setTechDraft, onSaveConfig }) => {
  const [activeTab, setActiveTab] = useState<'urgentes' | 'tecnica' | 'aluminio'>('urgentes');
  const [newLocation, setNewLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const predefined = getPredefinedLocations();

  // Inicializar: coaleszar config existente con predefinidas
  useEffect(() => {
    const parseAndMerge = (existing: string, predefined: string[]): string[] => {
      const existingLocs = existing.split('\n')
        .map(l => l.trim().toUpperCase())
        .filter(l => l && /^[A-Z]{2,3}-\d{1,3}$/.test(l));
      // Ya incluidas por defecto, solo añadir las que faltan
      const all = [...new Set([...predefined, ...existingLocs])];
      return all.sort((a, b) => {
        const aCode = a.split('-')[0];
        const bCode = b.split('-')[0];
        return aCode.localeCompare(bCode) || a.localeCompare(b);
      });
    };

    // Solo inicializar si está vacío o contiene datos
    if (!urgentDraft && !techDraft) {
      setUrgentDraft(predefined.urgente.join('\n'));
      setTechDraft(predefined.revision.join('\n'));
    }
  }, []);

  const parseLocations = (text: string): string[] => {
    return text.split('\n')
      .map(l => l.trim().toUpperCase())
      .filter(l => l && /^[A-Z]{2,3}-\d{1,3}$/.test(l));
  };

  const allUrgent = parseLocations(urgentDraft);
  const allTech = parseLocations(techDraft);

  const addLocation = (type: 'urgent' | 'tech') => {
    const loc = newLocation.trim().toUpperCase();
    if (!loc) return;
    if (!/^[A-Z]{2,3}-\d{1,3}$/.test(loc)) return;
    
    if (type === 'urgent') {
      if (!allUrgent.includes(loc)) {
        setUrgentDraft([...allUrgent, loc].sort((a, b) => {
          const aCode = a.split('-')[0];
          const bCode = b.split('-')[0];
          return aCode.localeCompare(bCode) || a.localeCompare(b);
        }).join('\n'));
      }
    } else {
      if (!allTech.includes(loc)) {
        setTechDraft([...allTech, loc].sort((a, b) => {
          const aCode = a.split('-')[0];
          const bCode = b.split('-')[0];
          return aCode.localeCompare(bCode) || a.localeCompare(b);
        }).join('\n'));
      }
    }
    setNewLocation('');
  };

  const toggleLocation = (type: 'urgent' | 'tech', loc: string) => {
    if (type === 'urgent') {
      const filtered = allUrgent.includes(loc) 
        ? allUrgent.filter(l => l !== loc)
        : [...allUrgent, loc];
      setUrgentDraft(filtered.sort((a, b) => {
        const aCode = a.split('-')[0];
        const bCode = b.split('-')[0];
        return aCode.localeCompare(bCode) || a.localeCompare(b);
      }).join('\n'));
    } else {
      const filtered = allTech.includes(loc) 
        ? allTech.filter(l => l !== loc)
        : [...allTech, loc];
      setTechDraft(filtered.sort((a, b) => {
        const aCode = a.split('-')[0];
        const bCode = b.split('-')[0];
        return aCode.localeCompare(bCode) || a.localeCompare(b);
      }).join('\n'));
    }
  };

  const handleSave = async (type: 'urgent' | 'tech') => {
    setSaving(true);
    try {
      if (type === 'urgent') {
        await onSaveConfig({ urgentLocations: allUrgent });
      } else {
        await onSaveConfig({ techReviewLocations: allTech });
      }
    } finally {
      setSaving(false);
    }
  };

  const renderChips = (locations: string[], type: 'urgent' | 'tech', predefinedSet: string[]) => {
    if (locations.length === 0) {
      return <span className="text-sm text-slate-500">Sin ubicaciones configuradas</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {locations.map(loc => {
          const isPredefined = predefinedSet.includes(loc);
          const isActive = type === 'urgent' ? allUrgent.includes(loc) : allTech.includes(loc);
          return (
            <button
              key={loc}
              onClick={() => toggleLocation(type, loc)}
              className={`px-2.5 py-1.5 text-sm font-bold rounded-lg transition-all ${
                type === 'urgent' 
                  ? isActive 
                    ? 'bg-red-600 text-white'
                    : 'bg-red-900/50 text-red-400 border border-red-800'
                  : isActive
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-900/50 text-amber-400 border border-amber-800'
              }`}
              title={isPredefined ? 'Predefinida (clic para desactivar)' : 'Custom'}
            >
              {loc}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl bg-slate-900 p-1.5">
        <button
          onClick={() => setActiveTab('urgentes')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'urgentes' 
              ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          🔴 URGENTES ({allUrgent.length})
        </button>
        <button
          onClick={() => setActiveTab('tecnica')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'tecnica' 
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          🟠 REV. TÉCNICA ({allTech.length})
        </button>
        <button
          onClick={() => setActiveTab('aluminio')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'aluminio' 
              ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/30' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          🟡 ALUMINIO ({predefined.aluminio.length})
        </button>
      </div>

      {/* Contenido: URGENTES */}
      {activeTab === 'urgentes' && (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-black text-white">Ubicaciones Urgentes</h2>
            <p className="text-sm text-red-100/70">Notifican a supervisores y calidad cuando se ubica un artículo aquí.</p>
          </div>

          {/* Añadir nuevo */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value.toUpperCase())}
              placeholder="Nueva ubicación (ej: CAL-001)"
              className="flex-1 bg-slate-950 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600"
              onKeyDown={(e) => e.key === 'Enter' && addLocation('urgent')}
            />
            <button
              onClick={() => addLocation('urgent')}
              disabled={!newLocation}
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-30 hover:bg-red-500"
            >
              +
            </button>
          </div>

          {/* Lista */}
          <div className="min-h-[120px] p-4 rounded-2xl bg-slate-950/50 border border-red-500/10">
            {renderChips(allUrgent, 'urgent', predefined.urgente)}
          </div>

          {/* Guardar */}
          <button
            onClick={() => handleSave('urgent')}
            disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-red-900/20 disabled:opacity-50 hover:from-red-500 hover:to-red-600"
          >
            {saving ? '⏳ Guardando...' : '💾 GUARDAR UBICACIONES URGENTES'}
          </button>
        </div>
      )}

      {/* Contenido: REV. TÉCNICA */}
      {activeTab === 'tecnica' && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-black text-white">Revisión Técnica</h2>
            <p className="text-sm text-amber-100/70">Alertas dirigidas al equipo de calidad para revisión.</p>
          </div>

          {/* Añadir nuevo */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value.toUpperCase())}
              placeholder="Nueva ubicación (ej: PIN-015)"
              className="flex-1 bg-slate-950 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600"
              onKeyDown={(e) => e.key === 'Enter' && addLocation('tech')}
            />
            <button
              onClick={() => addLocation('tech')}
              disabled={!newLocation}
              className="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl disabled:opacity-30 hover:bg-amber-500"
            >
              +
            </button>
          </div>

          {/* Lista */}
          <div className="min-h-[120px] p-4 rounded-2xl bg-slate-950/50 border border-amber-500/10">
            {renderChips(allTech, 'tech', predefined.revision)}
          </div>

          {/* Guardar */}
          <button
            onClick={() => handleSave('tech')}
            disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-amber-900/20 disabled:opacity-50 hover:from-amber-500 hover:to-amber-600"
          >
            {saving ? '⏳ Guardando...' : '💾 GUARDAR REVISIÓN TÉCNICA'}
          </button>
        </div>
      )}

      {/* Contenido: ALUMINIO - Solo informativo */}
      {activeTab === 'aluminio' && (
        <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-black text-white">Zonas de Aluminio</h2>
            <p className="text-sm text-yellow-100/70">
              Zonas de aluminio en repasado. Se detectan automáticamente por código.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/50 border border-yellow-500/10">
            <div className="flex flex-wrap gap-1.5">
              {predefined.aluminio.map(loc => (
                <span key={loc} className="px-2.5 py-1.5 text-sm font-bold bg-yellow-500/30 text-yellow-200 rounded-lg">
                  {loc}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Frecuencia refresco */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white">⏱ Frecuencia de Refresco</h3>
            <p className="text-sm text-slate-400">Caché de datos de operarios</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl text-cyan-400 font-bold">{(config.operarioRefreshInterval / 60000).toFixed(0)} min</span>
            <button
              onClick={() => void onSaveConfig({ operarioRefreshInterval: 5 * 60 * 1000 })}
              className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500"
            >
              🔄
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSpecialLocationsTab;

