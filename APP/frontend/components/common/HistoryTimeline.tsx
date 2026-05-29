




import React from 'react';
import { HistoryEntry, ActionType, formatLocation } from '../lib/warehouseData';
import { AssignedIcon, RelocatedIcon, RemovedIcon, CopyIcon, BellIcon, CheckIcon, UserIcon } from '../icons/Icons';

interface HistoryTimelineProps {
    history: HistoryEntry[];
    isSpecificSearch?: boolean;
}

const actionConfig: Record<ActionType, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
    assigned: { label: 'Entrada / Asignación', color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800', icon: AssignedIcon },
    relocated: { label: 'Movimiento Interno', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800', icon: RelocatedIcon },
    removed: { label: 'Salida / Eliminado', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: RemovedIcon },
    copied: { label: 'Copia Creada', color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800', icon: CopyIcon },
    requested: { label: 'Solicitado por Jefe', color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', icon: BellIcon },
    process_finished: { label: 'Proceso Terminado (Almacén)', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: CheckIcon },
    admin_cleared: { label: 'Vaciado por Admin', color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800', icon: RemovedIcon },
    moved_to_working: { label: 'En Producción', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800', icon: BellIcon },
    UBICAR: { label: 'Ubicación', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: AssignedIcon },
    UBICAR_MULTI: { label: 'Ubicación Múltiple', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: AssignedIcon },
    RETIRAR: { label: 'Retirada', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: RemovedIcon },
    RETIRAR_DE_UBICACION: { label: 'Retirada de Ubicación', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: RemovedIcon },
    MOVER: { label: 'Movimiento', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800', icon: RelocatedIcon },
    AVISAR_CARRETILLERO: { label: 'Aviso Carretillero', color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', icon: BellIcon },
    ENVIAR_ALMACEN: { label: 'Envío a Almacén', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: CheckIcon },
    VACIAR_ESTANTERIA: { label: 'Vaciado de Estantería', color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800', icon: RemovedIcon },
};

const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Optimization: Memoized row to improve large list performance
const HistoryTimelineItem = React.memo(({ entry, showDate }: { entry: HistoryEntry; showDate: boolean }) => {
    const config = actionConfig[entry.action];
    const Icon = config?.icon || BellIcon;

    return (
        <div className="relative animate-slide-in-right">
            {showDate && (
                <div className="sticky top-[140px] z-20 mb-6 -ml-4 md:-ml-8 flex justify-center pointer-events-none">
                    <div className="bg-slate-200 dark:bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-sm backdrop-blur-md">
                        {formatDate(entry.timestamp)}
                    </div>
                </div>
            )}

            <div className="flex items-start gap-4 md:gap-6">
                {/* Timeline Node */}
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-white dark:border-slate-900 shadow-sm shrink-0 ${config?.color || 'text-slate-500'} transition-transform hover:scale-110`}>
                    <Icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>

                {/* Card */}
                <div className="flex-grow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div>
                            <span className={`text-xs font-black uppercase tracking-widest ${config?.color.split(' ')[0]}`}>{config?.label || 'Acción'}</span>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <h4 className="font-black text-xl text-slate-800 dark:text-white">{entry.barcode}</h4>
                                {entry.orderId && <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300 font-bold">{entry.orderId}</span>}
                            </div>
                        </div>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">{formatTime(entry.timestamp)}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 text-sm">
                        {/* From Location */}
                        {entry.fromLocation && (
                            <div className={`flex-1 p-3 rounded-xl border ${entry.action === 'removed' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : entry.action === 'process_finished' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'}`}>
                                <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Origen</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${entry.action === 'process_finished' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                    {formatLocation(entry.fromLocation)}
                                </p>
                            </div>
                        )}

                        {/* Arrow */}
                        {entry.fromLocation && entry.toLocation && (
                            <div className="flex items-center justify-center text-slate-300">
                                <svg className="w-6 h-6 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </div>
                        )}

                        {/* To Location */}
                        {entry.toLocation && (
                            <div className={`flex-1 p-3 rounded-xl border ${entry.action === 'assigned' ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'}`}>
                                <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Destino</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                    {formatLocation(entry.toLocation)}
                                </p>
                            </div>
                        )}

                        {entry.action === 'requested' && (
                            <div className="flex-1 p-3 rounded-xl border bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30">
                                <p className="text-xs font-bold text-amber-500 mb-1 uppercase">Estado</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200">
                                    Pendiente de Entrega
                                </p>
                            </div>
                        )}

                    {entry.action === 'process_finished' && (
                        <div className="flex-1 p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-xs font-bold text-emerald-500 mb-1 uppercase">Estado</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                Sube a Almacén
                            </p>
                        </div>
                    )}
                </div>

                {entry.user && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
                        <UserIcon className="h-3.5 w-3.5" />
                        <span>por <strong className="text-slate-700 dark:text-slate-300">{entry.user}</strong></span>
                    </div>
                )}
            </div>
        </div>
    );
});

const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ history, isSpecificSearch }) => {
    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                    <AssignedIcon className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-lg font-bold text-slate-500 dark:text-slate-400">No se encontraron movimientos.</p>
                <p className="text-sm text-slate-400">Intenta buscar otro código o cambia los filtros.</p>
            </div>
        );
    }

    return (
        <div className={`relative pl-4 md:pl-8 space-y-8 ${isSpecificSearch ? 'before:absolute before:inset-y-4 before:left-[31px] md:before:left-[47px] before:w-1 before:bg-slate-200 dark:before:bg-slate-800 before:rounded-full' : ''}`}>
            {history.map((entry, index) => {
                const showDate = index === 0 || new Date(entry.timestamp).getDate() !== new Date(history[index - 1].timestamp).getDate();
                return (
                    <HistoryTimelineItem key={entry.id} entry={entry} showDate={showDate} />
                );
            })}
        </div>
    );
};

export default HistoryTimeline;

