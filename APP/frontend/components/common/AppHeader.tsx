import React from 'react';
import { useFormFactor } from '../../hooks/useFormFactor';

/**
 * AppHeader — Cabecera única y compartida de todas las vistas operativas
 * (Kiosk / Calidad / Jefe de sección / Punzonado / Carretillero).
 *
 * Antes cada rol reimplementaba su propio `<header>` inline con tipografías,
 * tamaños de subtítulo (8/9/10/12px) y botones de salir divergentes. Este
 * componente fija una sola escala visual para garantizar consistencia entre
 * roles en los 3 formatos (desktop / tablet / móvil).
 *
 * Tema claro fijo (la app no usa modo oscuro — ver decisión de consolidación UX).
 */

export interface AppHeaderProps {
  /** Emoji/icono de marca de la vista (opcional). */
  icon?: string;
  /** Título principal (nombre de estantería o de la vista). */
  title: string;
  /** Subtítulo secundario (operario · id, etc.). */
  subtitle?: string;
  /** Slot central inline — típicamente <OperativeActionButtons />. */
  center?: React.ReactNode;
  /** Botones extra a la derecha, antes de Salir (p.ej. RECOGIDAS). */
  right?: React.ReactNode;
  /** Botón de chat inline (roles autorizados). */
  chatButton?: React.ReactNode;
  /** Botón ℹ️ de info de dispositivo (kiosko). */
  onInfo?: () => void;
  /** Cierra sesión. Si se pasa onBack, se ignora y se muestra "‹ Volver". */
  onLogout?: () => void;
  /** Vuelve atrás (modo "Operar" de admin). Tiene prioridad sobre onLogout. */
  onBack?: () => void;
  /** Fila inferior a ancho completo (p.ej. botonera de acciones en móvil). */
  secondRow?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  icon,
  title,
  subtitle,
  center,
  right,
  chatButton,
  onInfo,
  onLogout,
  onBack,
  secondRow,
}) => {
  // En táctil (móvil/tablet) los controles secundarios deben cumplir el mínimo
  // de target táctil (≥44px). En escritorio (ratón) se mantiene la densidad alta.
  const touch = useFormFactor() !== 'desktop';
  return (
  <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 shadow-sm">
    <div className="flex items-center justify-between gap-2 min-h-10">
      {/* Marca + título */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        {icon && <span className="text-2xl flex-shrink-0" aria-hidden>{icon}</span>}
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-slate-500 truncate leading-none mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Slot central (acciones inline) */}
      {center && (
        <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden min-w-0">
          {center}
        </div>
      )}

      {/* Chat + acciones derechas + Salir */}
      <div className={`flex items-center flex-shrink-0 ${touch ? 'gap-2' : 'gap-1'}`}>
        {chatButton}
        {right}
        {onInfo && (
          <button
            onClick={onInfo}
            className={`text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center ${
              touch ? 'min-h-11 min-w-11 text-base' : 'px-2 py-1 text-[10px]'
            }`}
            title="Información del dispositivo"
            aria-label="Información del dispositivo"
          >
            <span aria-hidden>ℹ️</span>
          </button>
        )}
        {(onBack || onLogout) && (
          <button
            onClick={onBack ?? onLogout}
            className={`font-bold bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap transition-colors hover:bg-slate-200 flex items-center justify-center ${
              touch ? 'min-h-11 px-4 text-sm' : 'px-2.5 py-1.5 text-[11px]'
            }`}
            title={onBack ? 'Volver' : 'Cambiar operario'}
          >
            {onBack ? '‹ Volver' : 'Salir'}
          </button>
        )}
      </div>
    </div>

    {/* Fila inferior opcional (acciones a ancho completo) */}
    {secondRow && (
      <div className="pt-1 mt-0.5 border-t border-slate-100">{secondRow}</div>
    )}
  </header>
  );
};

export default AppHeader;
