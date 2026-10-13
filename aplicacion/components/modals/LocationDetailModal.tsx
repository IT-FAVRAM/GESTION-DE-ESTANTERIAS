

import React, { useState } from 'react';
import { Assignments, LocationId, formatLocation } from '../lib/warehouseData';
import { CloseIcon, TrashIcon, MoveIcon, PlusCircleIcon, ListIcon, CheckIcon } from './Icons';
import { useRoles } from '../hooks/useRoles';
import { can } from '../lib/permissionMatrix';

interface LocationDetailModalProps {
  locationId: LocationId;
  assignments: Assignments;
  onClose: () => void;
  onInitiateCopy: (barcode: string, location: LocationId, orderId?: string) => void;
  onInitiateMove: (barcode: string, location: LocationId, orderId?: string) => void;
  onInitiateDelete: (barcode: string, location: LocationId, orderId?: string) => void;
  onInitiateAdd: (locationId: LocationId) => void;
  onPasteItem: () => void;
  onPasteMovedItem: () => void;
  canPasteCopy: boolean;
  canPasteMove: boolean;
  onEmptyLocation?: (locationId: LocationId) => Promise<void>;
}

const LocationDetailModal: React.FC<LocationDetailModalProps> = ({
  locationId,
  assignments,
  onClose,
  onInitiateCopy,
  onInitiateMove,
  onInitiateDelete,
  onInitiateAdd,
  onPasteItem,
  onPasteMovedItem,
  canPasteCopy,
  canPasteMove,
  onEmptyLocation
}) => {
  const items = assignments[locationId] || [];
  const isContainer = false;

  const { role, canAssign, canRemove } = useRoles();
  const canDeleteThis = canRemove(locationId);
  const canEmptyLocation = can(role, 'emptyLocation');

  const [isRemoveMode, setIsRemoveMode] = useState(false);
  const [isEmptyingLocation, setIsEmptyingLocation] = useState(false);

  const handleContainerRemoveClick = (item: { barcode: string, orderId: string }) => {
    if (confirm(`¿Retirar "${item.barcode}" del carro?`)) {
      onInitiateDelete(item.barcode, locationId, item.orderId);
      // If it was the last item, exit remove mode automatically
      if (items.length <= 1) setIsRemoveMode(false);
    }
  };

  const handleEmptyLocation = async () => {
    if (!onEmptyLocation || items.length === 0 || isEmptyingLocation) return;

    const confirmed = window.confirm(
      `¿Vaciar ubicación completa?\n\nSe retirarán ${items.length} artículo(s) de ${formatLocation(locationId)}.`
    );
    if (!confirmed) return;

    setIsEmptyingLocation(true);
    try {
      await onEmptyLocation(locationId);
      setIsRemoveMode(false);
    } finally {
      setIsEmptyingLocation(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-end md:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <header className={`${isRemoveMode ? 'bg-red-50 dark:bg-red-900/30' : 'bg-slate-50 dark:bg-slate-950'} p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0 transition-colors duration-300`}>
          <div>
            <h3 className={`text-lg font-bold ${isRemoveMode ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
              {isRemoveMode ? 'MODO RETIRADA' : 'Contenido'}
            </h3>
            <p className="text-sm font-mono text-cyan-600 dark:text-cyan-400 break-all pr-2">{formatLocation(locationId)}</p>
          </div>
          <button onClick={onClose} className="h-11 w-11 inline-flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-800 rounded-full text-rose-500 dark:text-rose-400 transition-colors">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        {/* MESSAGE BANNER FOR REMOVE MODE */}
        {isRemoveMode && (
          <div className="bg-red-100 dark:bg-red-900/50 p-2 text-center text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wide">
            Selecciona el artículo a retirar
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-grow">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <ListIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Ubicación vacía.</p>
              {canAssign() && <p className="text-sm opacity-70">Pulsa "Asignar" para colocar algo.</p>}
            </div>
          ) : (
            <ul className="space-y-3 pb-4">
              {items.map(item => (
                <li
                  key={`${item.barcode}-${item.orderId}`}
                  onClick={() => isRemoveMode ? handleContainerRemoveClick(item) : null}
                  className={`
                        p-3 rounded-xl border flex justify-between items-center transition-all duration-200
                        ${isRemoveMode
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 shadow-sm transform hover:scale-[1.02]'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'
                    }
                    `}
                >
                  <div className="min-w-0 pr-2">
                    <p className={`font-bold truncate ${isRemoveMode ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-200'}`}>
                      {item.barcode}
                    </p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                      {item.orderId === 'GENERAL' ? 'Nota/Texto' : item.orderId}
                    </p>
                  </div>

                  {/* Standard Actions */}
                  {(!isRemoveMode) && (canAssign() || canDeleteThis) && (
                    <div className="flex gap-1 shrink-0">
                      {canAssign() && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); onInitiateMove(item.barcode, locationId, item.orderId) }} className="h-11 w-11 inline-flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg" title="Mover">
                            <MoveIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {canDeleteThis && (
                        <button onClick={(e) => { e.stopPropagation(); onInitiateDelete(item.barcode, locationId, item.orderId) }} className="h-11 w-11 inline-flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg" title="Eliminar">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Remove Mode Indicator */}
                  {isRemoveMode && (
                    <div className="p-2 bg-red-200 dark:bg-red-800 text-red-700 dark:text-white rounded-full">
                      <TrashIcon className="h-5 w-5" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* STANDARD FOOTER */}
        {!isContainer && canAssign() && (
          <footer className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col gap-2 shrink-0 safe-area-inset-bottom">
            {canPasteCopy && (
              <button onClick={onPasteItem} className="w-full min-h-[44px] py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 touch-manipulation">
                Pegar Artículo Aquí
              </button>
            )}
            {canPasteMove && items.length === 0 && (
              <button onClick={onPasteMovedItem} className="w-full min-h-[44px] py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 touch-manipulation">
                Mover Aquí
              </button>
            )}
            {/* Fallback add button if needed */}
            <button onClick={() => onInitiateAdd(locationId)} className="w-full min-h-[44px] py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300">
              + Asignar Manual
            </button>
            {canEmptyLocation && items.length > 0 && (
              <button
                onClick={handleEmptyLocation}
                disabled={isEmptyingLocation}
                className={`w-full min-h-[44px] py-3 font-bold rounded-xl border transition-colors ${isEmptyingLocation
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/30'
                  }`}
              >
                {isEmptyingLocation ? 'Vaciando ubicacion...' : 'Vaciar ubicacion'}
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
};

export default LocationDetailModal;


