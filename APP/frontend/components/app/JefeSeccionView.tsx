/**
 * JefeSeccionView — Vista del jefe de sección en móvil.
 * Acceso directo a su(s) estantería(s). Sin sidebar. Sin carros. Sin almacén.
 *
 * Si la sección agrupa varias estanterías (p.ej. PRENSAS_MECANIZADO → MEC + PRE),
 * muestra pestañas de cambio de estantería en el header.
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { SHELF_DEFINITIONS, getShelvesForSection, type WarehouseSection } from '../../lib/firestoreSchema';
import { SECTION_TO_SHELF, normalizeLegacySection } from '../../domain/auth/sectionShelf';
import { buildOperativeConfig } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';
import PieceCounterCamera from '../common/PieceCounterCamera';

interface JefeSeccionViewProps {
  onBack?: () => void;
}

/** Componente interno que se renderiza solo cuando hay shelfCode válido */
const JefeSeccionOperativo: React.FC<{
  shelfCode: string;
  onShelfChange: (code: string) => void;
  sectionShelfCodes: string[];
  onBack?: () => void;
}> = ({ shelfCode, onShelfChange, sectionShelfCodes, onBack }) => {
  const { displayName, operarioId, firebaseUser, section, logout } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';

  const shelfDef = SHELF_DEFINITIONS.find((s) => s.code === shelfCode);

  // Herramienta de conteo de piezas: solo para el jefe de sección de PUNZONADO.
  const isPunzonado = ((normalizeLegacySection(section ?? '') ?? section) === 'PUNZONADO');
  const [showCounter, setShowCounter] = useState(false);

  const config = useMemo(
    () => buildOperativeConfig('JEFE_SECCION', { lockedShelfCode: shelfCode, section }),
    [shelfCode, section],
  );

  const engine = useOperativeShelf({
    config,
    shelfCode,
    setShelfCode: onShelfChange,
    operarioId: effectiveOperarioId,
    displayName,
  });

  const handleShelfChange = (code: string) => {
    engine.cancelAction();
    onShelfChange(code);
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

          {isPunzonado && (
            <button
              onClick={() => setShowCounter(true)}
              className="px-2.5 py-1.5 text-xs font-black rounded-lg bg-cyan-600 text-white shadow-sm hover:bg-cyan-500 whitespace-nowrap flex-shrink-0">
              📐 Contar
            </button>
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

      {showCounter && <PieceCounterCamera onClose={() => setShowCounter(false)} />}
    </div>
  );
};

const JefeSeccionView: React.FC<JefeSeccionViewProps> = ({ onBack }) => {
  const { section, assignedShelf, logout } = useAuth();

  // Determina las estanterías accesibles para la sección del usuario
  const sectionShelfCodes = useMemo(() => {
    if (!section) return [];
    const normalized = (normalizeLegacySection(section) ?? section) as WarehouseSection;
    const codesFromSection = getShelvesForSection(normalized as Parameters<typeof getShelvesForSection>[0]);
    if (codesFromSection.length > 0) return codesFromSection;
    // Fallback: algunas secciones (p.ej. PUNZONADO) comparten su estantería
    // canónica con otra sección (PUNZONADO → PLE) y no aparecen en el mapa
    // inverso de getShelvesForSection. Usamos el mapa canónico sección→estantería
    // (el mismo que resuelve assignedShelf en useAuth) para no dejar al jefe sin vista.
    const canonical = SECTION_TO_SHELF[normalized];
    return canonical ? [canonical] : [];
  }, [section]);

  // Si no hay sección o no tiene estanterías, mostrar error
  const hasValidSection = section && sectionShelfCodes.length > 0;

  // Estantería por defecto de la sección: assignedShelf si pertenece a la sección,
  // si no la primera navegable.
  const initialShelf = useMemo(() => {
    if (!hasValidSection) return null;
    if (assignedShelf && sectionShelfCodes.includes(assignedShelf)) return assignedShelf;
    return sectionShelfCodes[0];
  }, [assignedShelf, sectionShelfCodes, hasValidSection]);

  // Solo guardamos la selección EXPLÍCITA del usuario (cambio de pestaña). La
  // estantería activa se deriva de forma reactiva: si el usuario no ha elegido
  // nada (o su elección no aplica a la sección actual), se usa `initialShelf`.
  // IMPORTANTE: no inicializamos el estado con `initialShelf` vía useState porque
  // `section` llega de forma asíncrona (auth/Firestore); congelar el valor del
  // primer render dejaba `shelfCode` en null para siempre y mostraba
  // "Sección no configurada" aunque la sección sí estuviera asignada (regresión b8e661a).
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const shelfCode =
    selectedShelf && sectionShelfCodes.includes(selectedShelf) ? selectedShelf : initialShelf;

  // Si no tiene sección válida, mostrar error
  if (!hasValidSection || !shelfCode) {
    return (
      <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <span className="text-5xl block mb-4">⚠️</span>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Sección no configurada</h2>
          <p className="text-slate-600 mb-4">
            Tu cuenta no tiene una sección asignada. Contacta con el administrador para que te asigne una sección.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Sección actual: {section || 'No asignada'}
          </p>
          <button
            onClick={logout}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <JefeSeccionOperativo
      shelfCode={shelfCode}
      onShelfChange={setSelectedShelf}
      sectionShelfCodes={sectionShelfCodes}
      onBack={onBack}
    />
  );
};

export default JefeSeccionView;
