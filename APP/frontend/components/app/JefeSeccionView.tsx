/**
 * JefeSeccionView — Vista del jefe de sección en móvil.
 * Acceso directo a su(s) estantería(s). Sin sidebar. Sin carros. Sin almacén.
 *
 * Si la sección agrupa varias estanterías (p.ej. PRENSAS_MECANIZADO → MEC + PRE),
 * muestra pestañas de cambio de estantería en el header.
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { SHELF_DEFINITIONS, getShelvesForSection, getAccessibleShelvesForSection, type WarehouseSection } from '../../lib/firestoreSchema';
import { SECTION_TO_SHELF, normalizeLegacySection } from '../../domain/auth/sectionShelf';
import { buildOperativeConfig, canUseScanTray } from '../../lib/operative/operativeConfig';
import { useOperativeShelf } from '../../hooks/useOperativeShelf';
import OperativeShelfArea from '../operative/OperativeShelfArea';
import OperativeActionButtons from '../operative/OperativeActionButtons';
import OperativeActionBar from '../operative/OperativeActionBar';
import AppHeader from '../common/AppHeader';
import { useFormFactor } from '../../hooks/useFormFactor';
import { getShelfDisplayName } from '../../lib/shelfDisplayNames';

interface JefeSeccionViewProps {
  onBack?: () => void;
  chatButton?: React.ReactNode;
}

/** Componente interno que se renderiza solo cuando hay shelfCode válido */
const JefeSeccionOperativo: React.FC<{
  shelfCode: string;
  onShelfChange: (code: string, force?: boolean) => void;
  sectionShelfCodes: string[];
  onBack?: () => void;
  chatButton?: React.ReactNode;
}> = ({ shelfCode, onShelfChange, sectionShelfCodes, onBack, chatButton }) => {
  const { displayName, operarioId, firebaseUser, section, logout } = useAuth();
  const effectiveOperarioId = operarioId ?? firebaseUser?.uid ?? '';
  const isTouch = useFormFactor() !== 'desktop';

  const shelfDef = SHELF_DEFINITIONS.find((s) => s.code === shelfCode);

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
    enableScanTray: canUseScanTray('JEFE_SECCION', firebaseUser?.email),
  });

  const handleShelfChange = (code: string, force?: boolean) => {
    engine.cancelAction();
    onShelfChange(code, force);
  };

  return (
    <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col overflow-hidden">
      <AppHeader
        title={shelfDef?.name ?? shelfCode ?? 'Mi Sección'}
        center={isTouch ? undefined : <OperativeActionButtons engine={engine} config={config} />}
        chatButton={chatButton}
        onBack={onBack}
        onLogout={logout}
      />

      {/* Pestañas de estantería: solo en táctil. En escritorio se usa el sidebar
          lateral de OperativeShelfArea (enableShelfSidebar) para no duplicar. */}
      {isTouch && sectionShelfCodes.length > 1 && (
        <div className="bg-white border-b border-slate-200 px-3 py-2 flex gap-2 overflow-x-auto">
          {sectionShelfCodes.map((code) => (
            <button
              key={code}
              onClick={() => handleShelfChange(code)}
              className={`px-3 py-1.5 text-xs font-black rounded-lg flex-shrink-0 transition-all ${
                shelfCode === code
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {getShelfDisplayName(code)}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <OperativeShelfArea
          engine={engine}
          config={config}
          fullscreenGrid
          userSection={section}
          setShelfCode={handleShelfChange}
          accessibleShelves={sectionShelfCodes}
          enableShelfSidebar
        />
      </main>

      {isTouch && <OperativeActionBar engine={engine} config={config} />}
    </div>
  );
};

const JefeSeccionView: React.FC<JefeSeccionViewProps> = ({ onBack, chatButton }) => {
  const { section, assignedShelf, logout } = useAuth();

  // Determina las estanterías accesibles para la sección del usuario,
  // incluyendo secciones adicionales (p.ej. Jefe de PLEGADORA también accede a AUTOPLEGADORA)
  const sectionShelfCodes = useMemo(() => {
    if (!section) return [];
    const normalized = (normalizeLegacySection(section) ?? section) as WarehouseSection;
    const codesFromSection = getAccessibleShelvesForSection(normalized as Parameters<typeof getAccessibleShelvesForSection>[0]);
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
  const [forceShelf, setForceShelf] = useState<string | null>(null);
  // Si forceShelf está activo (navegación por búsqueda), usarlo directamente.
  // Si no, validar contra sectionShelfCodes.
  const shelfCode = forceShelf
    || (selectedShelf && sectionShelfCodes.includes(selectedShelf) ? selectedShelf : initialShelf);

  // Si no tiene sección válida, mostrar error
  if (!hasValidSection || !shelfCode) {
    return (
      <div className="h-dvh w-screen max-w-full bg-sky-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
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
      onShelfChange={(code, force) => {
        if (force) {
          setForceShelf(code);
        } else {
          setForceShelf(null);
          setSelectedShelf(code);
        }
      }}
      sectionShelfCodes={sectionShelfCodes}
      onBack={onBack}
      chatButton={chatButton}
    />
  );
};

export default JefeSeccionView;
