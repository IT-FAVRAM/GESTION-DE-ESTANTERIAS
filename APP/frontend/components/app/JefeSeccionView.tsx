/**
 * JefeSeccionView — Vista del jefe de sección en móvil.
 * Acceso directo a su(s) estantería(s). Sin sidebar. Sin carros. Sin almacén.
 *
 * Si la sección agrupa varias estanterías (p.ej. PRENSAS_MECANIZADO → MEC + PRE),
 * muestra pestañas de cambio de estantería en el header.
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { SHELF_DEFINITIONS, getSectionForShelf, getShelvesForSection } from '../../lib/firestoreSchema';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';

interface JefeSeccionViewProps {
  onBack?: () => void;
}

const JefeSeccionView: React.FC<JefeSeccionViewProps> = ({ onBack }) => {
  const { displayName, operarioId, firebaseUser, section, assignedShelf, logout } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  // Determina las estanterías accesibles para la sección del usuario
  const sectionKey = section ? getSectionForShelf(assignedShelf ?? '') || (section as ReturnType<typeof getSectionForShelf>) : null;
  const sectionShelfCodes = useMemo(() => {
    if (!section) return [assignedShelf ?? SHELF_DEFINITIONS[0]?.code ?? 'PRE'];
    const codesFromSection = getShelvesForSection(section as Parameters<typeof getShelvesForSection>[0]);
    if (codesFromSection.length > 0) return codesFromSection;
    return [assignedShelf ?? SHELF_DEFINITIONS[0]?.code ?? 'PRE'];
  }, [section, assignedShelf]);

  // Estantería activa (por defecto la primera, o la assignedShelf si pertenece a la sección)
  const defaultShelf = sectionShelfCodes.includes(assignedShelf ?? '') ? (assignedShelf ?? sectionShelfCodes[0]) : sectionShelfCodes[0];
  const [shelfCode, setShelfCode] = useState<string>(defaultShelf);

  const shelfDef = SHELF_DEFINITIONS.find((s) => s.code === shelfCode);

  const config = useMemo(
    () => buildOperativeConfig('JEFE_SECCION', { lockedShelfCode: shelfCode, section }),
    [shelfCode, section],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode,
    setShelfCode,
    operarioId: effectiveOperarioId,
    displayName,
  });

  const handleShelfChange = (code: string) => {
    engine.cancelAction();
    setShelfCode(code);
  };

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <span className="text-2xl">🏭</span>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none truncate">
                {shelfDef?.name ?? shelfCode ?? 'Mi Sección'}
              </h1>
              <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">{displayName} · {operarioId}</p>
            </div>
          </div>

          {/* Selector de estantería si la sección tiene varias */}
          {sectionShelfCodes.length > 1 && (
            <div className="flex gap-1 flex-shrink-0">
              {sectionShelfCodes.map((code) => {
                const def = SHELF_DEFINITIONS.find((s) => s.code === code);
                return (
                  <button
                    key={code}
                    onClick={() => handleShelfChange(code)}
                    className={`px-2.5 py-1.5 text-xs font-black rounded-lg transition-all ${
                      shelfCode === code
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {def?.name ?? code}
                  </button>
                );
              })}
            </div>
          )}

          <OperativeActionButtons engine={engine} config={config} />

          <button
            onClick={onBack ? onBack : logout}
            className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap flex-shrink-0">
            {onBack ? 'Volver' : 'Salir'}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <OperativeShelfArea engine={engine} config={config} fullscreenGrid />
      </main>
    </div>
  );
};

export default JefeSeccionView;
