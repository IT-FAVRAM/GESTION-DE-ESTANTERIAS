

import React, { useState, useMemo } from 'react';
import { CartItem } from '../hooks/useCarts';
import { CloseIcon, PlusCircleIcon, TrashIcon, MoveIcon, CheckIcon, BoxIcon } from './Icons';
import { UserRole } from '../hooks/useRoles';

interface ShelfDetailModalProps {
    cartName: string;
    shelfId: string;
    shelfLabel: string;
    items: CartItem[];
    onClose: () => void;
    onAddItem: (type: 'article' | 'plain', data: any) => Promise<void>;
    onRemoveItems: (ids: string[]) => Promise<void>;
    onMoveItems: (ids: string[], targetShelfId: string) => Promise<void>;
    availableShelves: number[]; // e.g. [1, 2, 3, 4]
    userRole: UserRole;
    initialMode?: 'view' | 'add_choice';
}

const ShelfDetailModal: React.FC<ShelfDetailModalProps> = ({
    cartName,
    shelfId,
    shelfLabel,
    items,
    onClose,
    onAddItem,
    onRemoveItems,
    onMoveItems,
    availableShelves,
    userRole,
    initialMode = 'view'
}) => {
    const [mode, setMode] = useState<'view' | 'add_choice' | 'add_article' | 'add_text' | 'select'>(initialMode);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Inputs
    const [articleCode, setArticleCode] = useState('');
    const [orderId, setOrderId] = useState('');
    const [freeText, setFreeText] = useState('');
    const [targetShelf, setTargetShelf] = useState<string>('');

    const canEdit = userRole === 'CARRETILLERO' || userRole === 'JEFE' || userRole === 'ADMIN';

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSaveArticle = async () => {
        if (!articleCode.trim() || !orderId.trim()) return;
        await onAddItem('article', {
            description: `ART: ${articleCode.toUpperCase()} | OF: ${orderId.toUpperCase()}`,
            barcode: articleCode.toUpperCase(),
            orderId: orderId.toUpperCase()
        });
        setArticleCode('');
        setOrderId('');
        setMode('view');
    };

    const handleSaveText = async () => {
        if (!freeText.trim()) return;
        await onAddItem('plain', {
            description: freeText.toUpperCase()
        });
        setFreeText('');
        setMode('view');
    };

    const handleConfirmDelete = async () => {
        if (confirm(`¿Eliminar ${selectedIds.length} elementos?`)) {
            await onRemoveItems(selectedIds);
            setSelectedIds([]);
            setMode('view');
        }
    };

    const handleConfirmMove = async () => {
        if (!targetShelf) return;
        await onMoveItems(selectedIds, targetShelf);
        setSelectedIds([]);
        setMode('view');
    };

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [items]);

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-0 md:p-4" role="dialog">
            <div className="w-full h-full md:h-auto md:max-w-lg bg-slate-50 dark:bg-slate-900 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <header className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">{cartName}</p>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{shelfLabel}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-slate-100 dark:bg-black/20">
                    
                    {/* LIST */}
                    {mode === 'view' || mode === 'select' ? (
                        <>
                            {sortedItems.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <BoxIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                    <p>Balda Vacía</p>
                                </div>
                            ) : (
                                sortedItems.map(item => (
                                    <div 
                                        key={item.id} 
                                        onClick={() => mode === 'select' && handleToggleSelect(item.id)}
                                        className={`bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm flex items-center gap-3 transition-all ${
                                            mode === 'select' && selectedIds.includes(item.id) 
                                                ? 'border-cyan-500 ring-1 ring-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' 
                                                : 'border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {mode === 'select' && (
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedIds.includes(item.id) ? 'bg-cyan-500 border-cyan-500' : 'border-slate-400'}`}>
                                                {selectedIds.includes(item.id) && <CheckIcon className="h-3 w-3 text-white" />}
                                            </div>
                                        )}
                                        <div className="flex-grow">
                                            {item.type === 'article' ? (
                                                <>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">ART</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{item.barcode}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">OF</span>
                                                        <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{item.orderId}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="font-medium text-slate-700 dark:text-slate-200 uppercase">{item.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    ) : null}

                    {/* ADD FORMS */}
                    {mode === 'add_choice' && (
                        <div className="flex flex-col gap-4 mt-8">
                            <button onClick={() => setMode('add_article')} className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-left hover:border-cyan-500 transition-colors">
                                <span className="block text-lg font-bold text-slate-900 dark:text-white mb-1">📦 Artículo + OF</span>
                                <span className="text-slate-500 text-sm">Registro estructurado de material de producción.</span>
                            </button>
                            <button onClick={() => setMode('add_text')} className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-left hover:border-purple-500 transition-colors">
                                <span className="block text-lg font-bold text-slate-900 dark:text-white mb-1">📝 Texto Libre</span>
                                <span className="text-slate-500 text-sm">Notas rápidas, material vario, tornillería, etc.</span>
                            </button>
                            <button onClick={() => setMode('view')} className="text-center text-slate-500 p-4">Cancelar</button>
                        </div>
                    )}

                    {mode === 'add_article' && (
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Artículo</label>
                                <input autoFocus value={articleCode} onChange={e => setArticleCode(e.target.value.toUpperCase())} className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border-2 border-transparent focus:border-cyan-500 outline-none text-lg font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">OF</label>
                                <input value={orderId} onChange={e => setOrderId(e.target.value.toUpperCase())} className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border-2 border-transparent focus:border-purple-500 outline-none text-lg font-mono" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setMode('view')} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold">Cancelar</button>
                                <button onClick={handleSaveArticle} className="flex-1 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow-lg">Guardar</button>
                            </div>
                        </div>
                    )}

                    {mode === 'add_text' && (
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Descripción</label>
                                <textarea autoFocus rows={3} value={freeText} onChange={e => setFreeText(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border-2 border-transparent focus:border-purple-500 outline-none text-lg" placeholder="Ej: Tornillos M8..." />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setMode('view')} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold">Cancelar</button>
                                <button onClick={handleSaveText} className="flex-1 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow-lg">Guardar</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                {mode === 'view' && canEdit && (
                    <footer className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 grid grid-cols-2 gap-3">
                        <button onClick={() => setMode('add_choice')} className="col-span-2 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                            <PlusCircleIcon className="h-6 w-6" /> Añadir Elemento
                        </button>
                        {items.length > 0 && (
                            <>
                                <button onClick={() => setMode('select')} className="py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2">
                                    <MoveIcon className="h-5 w-5" /> Mover / Borrar
                                </button>
                            </>
                        )}
                    </footer>
                )}

                {mode === 'select' && (
                    <footer className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
                        {targetShelf ? (
                             <button onClick={handleConfirmMove} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg">
                                Confirmar Mover a Balda {targetShelf}
                            </button>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mover a:</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {availableShelves.filter(s => String(s) !== shelfId).map(s => (
                                            <button 
                                                key={s} 
                                                onClick={() => setTargetShelf(String(s))}
                                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg whitespace-nowrap font-bold text-sm"
                                            >
                                                Balda {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleConfirmDelete} disabled={selectedIds.length === 0} className="py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl flex items-center justify-center gap-2 border border-red-200 dark:border-red-800">
                                    <TrashIcon className="h-5 w-5" /> Borrar ({selectedIds.length})
                                </button>
                                <button onClick={() => { setMode('view'); setSelectedIds([]); }} className="py-3 bg-slate-200 dark:bg-slate-800 font-bold rounded-xl">
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </footer>
                )}
            </div>
        </div>
    );
};

export default ShelfDetailModal;