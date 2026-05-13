/**
 * ConfirmationModal — Modal de confirmación reutilizable 
 * Gestor de Estanterías WMS v3.0
 * 
 * Modal fullscreen optimizado para tablets con botones grandes.
 */

import React from 'react';

type ConfirmVariant = 'success' | 'danger' | 'warning' | 'info';

interface ConfirmationModalProps {
  /** Si el modal está abierto */
  open: boolean;
  /** Callback al cerrar */
  onClose: () => void;
  /** Título del modal */
  title: string;
  /** Mensaje/descripción */
  message: string | React.ReactNode;
  /** Icono o emoji (ej: "📦", "⚠️") */
  icon?: string;
  /** Variante visual */
  variant?: ConfirmVariant;
  /** Texto del botón de confirmar */
  confirmText?: string;
  /** Callback al confirmar */
  onConfirm?: () => void;
  /** Texto del botón de cancelar */
  cancelText?: string;
  /** Botón extra opcional (ej: "Elegir otra ubicación") */
  extraButton?: {
    text: string;
    onClick: () => void;
    variant?: ConfirmVariant;
  };
  /** Si está procesando */
  loading?: boolean;
  /** Si se puede cerrar con el fondo */
  dismissable?: boolean;
}

const VARIANT_STYLES: Record<ConfirmVariant, { bg: string; btn: string }> = {
  success: {
    bg: 'from-emerald-600/5 to-emerald-700/5',
    btn: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white',
  },
  danger: {
    bg: 'from-red-600/5 to-red-700/5',
    btn: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white',
  },
  warning: {
    bg: 'from-amber-600/5 to-amber-700/5',
    btn: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white',
  },
  info: {
    bg: 'from-cyan-600/5 to-cyan-700/5',
    btn: 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white',
  },
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onClose,
  title,
  message,
  icon,
  variant = 'info',
  confirmText = 'CONFIRMAR',
  onConfirm,
  cancelText = 'CANCELAR',
  extraButton,
  loading = false,
  dismissable = true,
}) => {
  if (!open) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={dismissable && !loading ? onClose : undefined}
    >
      <div
        className={`
          w-full max-w-lg bg-gradient-to-br ${styles.bg} 
          bg-white rounded-3xl shadow-2xl border border-white/30
          p-6 sm:p-8 flex flex-col gap-5 animate-scale-in
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="text-center">
          {icon && (
            <div className="text-5xl mb-3">{icon}</div>
          )}
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
        </div>
        
        {/* Message */}
        <div className="text-center text-base text-slate-600 leading-relaxed">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col gap-3 mt-2">
          {/* Confirm */}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`
                w-full h-14 rounded-2xl text-lg font-black shadow-lg 
                transition-all active:scale-[0.98] disabled:opacity-50
                ${styles.btn}
              `}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  Procesando...
                </span>
              ) : confirmText}
            </button>
          )}
          
          {/* Extra button */}
          {extraButton && (
            <button
              type="button"
              onClick={extraButton.onClick}
              disabled={loading}
              className={`
                w-full h-14 rounded-2xl text-lg font-bold 
                bg-slate-100 text-slate-700 hover:bg-slate-200 
                transition-all active:scale-[0.98] disabled:opacity-50
              `}
            >
              {extraButton.text}
            </button>
          )}
          
          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full h-12 rounded-xl text-base font-bold text-slate-400 
              hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
