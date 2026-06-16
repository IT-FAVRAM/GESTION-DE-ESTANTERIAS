import React from 'react';
import OperativeActionButtons from './OperativeActionButtons';
import type { RoleOperativeConfig } from '../../lib/operative/operativeConfig';
import type { UseOperativeShelfReturn } from '../../hooks/useOperativeShelf';

interface OperativeActionBarProps {
  engine: UseOperativeShelfReturn;
  config: RoleOperativeConfig;
}

/**
 * OperativeActionBar — Barra de acciones primarias fija al pie, para móvil y
 * tablet táctil. Sustituye a los botones diminutos del header (que en táctil
 * quedaban en ~24px) por objetivos de ≥48px a ancho completo.
 *
 * Se renderiza como hijo flex (no fixed) al final de la columna de la vista, de
 * modo que no solapa el contenido y libera su espacio durante un flujo activo
 * (OperativeActionButtons devuelve null cuando engine.action !== 'idle').
 */
const OperativeActionBar: React.FC<OperativeActionBarProps> = ({ engine, config }) => {
  if (engine.action !== 'idle') return null;

  return (
    <div className="flex-shrink-0 bg-white border-t border-slate-200 px-3 pt-2 pb-safe shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
      <OperativeActionButtons engine={engine} config={config} size="bar" />
    </div>
  );
};

export default OperativeActionBar;
