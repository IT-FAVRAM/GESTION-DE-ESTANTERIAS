
import React, { useState } from 'react';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { Assignments, HistoryEntry } from '../lib/warehouseData';
import { CloseIcon, TrashIcon, PlusCircleIcon, CheckIcon, ErrorIcon, SettingsIcon, SaveIcon, FlashIcon, DownloadIcon, ChartIcon, SparklesIcon, ListIcon, SendIcon, MessageSquareIcon, BellIcon } from './Icons';
import BackupManager from './BackupManager';
import { exportInventoryToExcel } from '../lib/excelExport';
import { useSystemNotifications } from '../hooks/useSystemNotifications';
import { useRoles, UserRole } from '../hooks/useRoles';
import { migrateAssignments, migrateUserRoles } from '../lib/migration';
// import { InboundManagement } from './InboundManagement';
import { LeadTimeReport } from './LeadTimeReport';

interface AdminPanelProps {
    currentUserRole?: UserRole | null;
    config: WarehouseConfig;
    setConfig: (c: WarehouseConfig) => void;
    addWarehouse: (code: string, name: string) => void;
    removeWarehouse: (code: string) => void;
    addShelf: (num: number) => void;
    removeShelf: (num: number) => void;
    addRack: (num: number) => void;
    removeRack: (num: number) => void;
    addPosition: (pos: string) => void;
    removePosition: (pos: string) => void;
    resetToDefaults: () => void;
    onClose: () => void;
    assignments: Assignments;
    setAssignments: (a: Assignments) => void;
    history: HistoryEntry[];
    setHistory: (h: HistoryEntry[]) => void;
    onRunInventoryAnalysis: () => void;
    onRunAnomalyAnalysis: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
    currentUserRole,
    config, setConfig,
    addWarehouse,
    removeWarehouse,
    addShelf,
    removeShelf,
    addRack,
    removeRack,
    addPosition,
    removePosition,
    resetToDefaults,
    onClose,
    assignments, setAssignments,
    history, setHistory,
    onRunInventoryAnalysis,
    onRunAnomalyAnalysis
}) => {
    const isJefe = currentUserRole === 'JEFE';
    const isAdmin = currentUserRole === 'ADMIN';

    // Tab Management
    // Default to 'leadtime' if JEFE, else 'warehouses' (for ADMIN)
    const [activeTab, setActiveTab] = useState<'warehouses' | 'structure' | 'data' | 'analysis' | 'messaging' | 'leadtime'>(
        isJefe ? 'leadtime' : 'warehouses'
    );

    // Inputs States
    const [newWhCode, setNewWhCode] = useState('');
    const [newWhName, setNewWhName] = useState('');

    const [newShelf, setNewShelf] = useState('');
    const [newRack, setNewRack] = useState('');
    const [newPosition, setNewPosition] = useState('');

    // Messaging State
    const [msgTarget, setMsgTarget] = useState<UserRole | 'ALL'>('ALL');
    const [msgTitle, setMsgTitle] = useState('');
    const [msgBody, setMsgBody] = useState('');
    const [msgPriority, setMsgPriority] = useState<'normal' | 'high'>('normal');
    const { sendSystemAlert } = useSystemNotifications('ADMIN', () => { }); // No need to notify self locally

    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState<string>('');

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleError = (e: unknown) => {
        setError((e as Error).message);
        setTimeout(() => setError(null), 4000);
    };

    // --- HANDLERS ALMACENES ---
    const handleAddWh = () => {
        try {
            addWarehouse(newWhCode, newWhName);
            setNewWhCode('');
            setNewWhName('');
            showSuccess(`Almacén ${newWhCode} creado.`);
        } catch (e) { handleError(e); }
    };

    const handleRemoveWh = (code: string) => {
        if (!confirm(`¿Estás seguro de eliminar el almacén ${code}? Esta acción no se puede deshacer si está vacío.`)) return;
        try {
            removeWarehouse(code);
            showSuccess(`Almacén ${code} eliminado.`);
        } catch (e) { handleError(e); }
    };

    // --- HANDLERS ESTRUCTURA ---
    const handleAddShelf = () => {
        const num = parseInt(newShelf, 10);
        if (isNaN(num)) return handleError(new Error("Debe ser un número válido"));
        try {
            addShelf(num);
            setNewShelf('');
            showSuccess(`Estantería ${num} añadida.`);
        } catch (e) { handleError(e); }
    };

    const handleRemoveShelf = (num: number) => {
        if (!confirm(`¿Eliminar Estantería ${num}?`)) return;
        try {
            removeShelf(num);
            showSuccess(`Estantería ${num} eliminada.`);
        } catch (e) { handleError(e); }
    };

    const handleAddRack = () => {
        const num = parseInt(newRack, 10);
        if (isNaN(num)) return handleError(new Error("Debe ser un número válido"));
        try {
            addRack(num);
            setNewRack('');
            showSuccess(`Rack/Balda ${num} añadida.`);
        } catch (e) { handleError(e); }
    };

    const handleRemoveRack = (num: number) => {
        if (!confirm(`¿Eliminar Rack ${num}?`)) return;
        try {
            removeRack(num);
            showSuccess(`Rack ${num} eliminado.`);
        } catch (e) { handleError(e); }
    };

    const handleAddPosition = () => {
        if (!newPosition.trim()) return;
        try {
            addPosition(newPosition);
            setNewPosition('');
            showSuccess(`Posición ${newPosition} añadida.`);
        } catch (e) { handleError(e); }
    };

    const handleRemovePosition = (pos: string) => {
        if (!confirm(`¿Eliminar Posición ${pos}?`)) return;
        try {
            removePosition(pos);
            showSuccess(`Posición ${pos} eliminada.`);
        } catch (e) { handleError(e); }
    };

    // --- HANDLERS DATA ---
    const handleFactoryReset = () => {
        const confirm1 = confirm("⚠️ PELIGRO: ¿Estás seguro de que quieres borrar TODAS las asignaciones?");
        if (!confirm1) return;

        const confirm2 = confirm("⚠️ CONFIRMACIÓN FINAL: Esta acción no se puede deshacer. ¿Borrar todo?");
        if (confirm2) {
            setAssignments({});
            setHistory([]);
            showSuccess("Base de datos reseteada a fábrica.");
        }
    };

    const handleConfigReset = () => {
        if (confirm("¿Restaurar configuración de almacenes y estructura por defecto?")) {
            resetToDefaults();
            showSuccess("Configuración restaurada.");
        }
    };

    const handleMigration = async () => {
        if (!confirm("¿Iniciar migración a base de datos particionada? Esto puede tardar unos minutos.")) return;
        setIsMigrating(true);
        setMigrationProgress("Iniciando...");
        const result = await migrateAssignments((msg) => setMigrationProgress(msg));
        setIsMigrating(false);
        if (result.success) {
            showSuccess("Migración completada correctamente.");
            setMigrationProgress("Completado.");
        } else {
            handleError(new Error(result.error || "Error desconocido"));
            setMigrationProgress("Falló.");
        }
    };

    // --- HANDLERS MESSAGING ---
    const handleSendMessage = () => {
        if (!msgTitle.trim() || !msgBody.trim()) {
            handleError(new Error("Título y mensaje obligatorios"));
            return;
        }

        sendSystemAlert({
            targetRole: msgTarget,
            type: 'admin_message',
            title: msgTitle,
            message: msgBody,
            metadata: { priority: msgPriority }
        });

        showSuccess(`Mensaje enviado a ${msgTarget}`);
        setMsgTitle('');
        setMsgBody('');
        setMsgPriority('normal');
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="relative w-full max-w-5xl bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] border border-slate-800">

                {/* HEADER */}
                <header className="p-5 border-b border-slate-800 bg-slate-900 rounded-t-2xl flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg text-cyan-400">
                            <SettingsIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                {isAdmin ? 'Panel de Administración' : 'Panel de Gestión'}
                            </h2>
                            <p className="text-sm text-slate-400">
                                {isAdmin ? 'Configuración avanzada del sistema' : 'Herramientas de Jefe de Sección'}
                            </p>
                        </div>
                    </div>

                    {/* TABS NAVIGATION */}
                    <div className="flex bg-slate-800/50 p-1 rounded-lg overflow-x-auto max-w-full">
                        {/* WAREHOUSES - ADMIN ONLY */}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('warehouses')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'warehouses' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Almacenes
                            </button>
                        )}

                        {/* STRUCTURE - ADMIN ONLY */}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('structure')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'structure' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Estructura Base
                            </button>
                        )}

                        {/* LEAD TIME - ADMIN & JEFE */}
                        <button
                            onClick={() => setActiveTab('leadtime')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'leadtime' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <span className="text-lg">📦</span> Lead Time
                        </button>

                        {/* MESSAGING - ADMIN ONLY (For now) */}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('messaging')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'messaging' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                <MessageSquareIcon className="h-4 w-4" /> Mensajería
                            </button>
                        )}

                        {/* ANALYSIS - ADMIN ONLY */}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('analysis')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                <ChartIcon className="h-4 w-4" /> IA
                            </button>
                        )}

                        {/* DATA - ADMIN ONLY */}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('data')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'data' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Datos
                            </button>
                        )}
                    </div>

                    <button onClick={onClose} className="absolute top-4 right-4 md:static p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                <div className="overflow-y-auto p-6 space-y-6 bg-slate-900/95 flex-grow">

                    {/* ALERTS */}
                    {error && (
                        <div className="p-4 bg-red-900/30 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-200 animate-shake mb-4">
                            <ErrorIcon className="h-6 w-6 flex-shrink-0" />
                            <p className="font-semibold">{error}</p>
                        </div>
                    )}
                    {successMsg && (
                        <div className="p-4 bg-green-900/30 border border-green-800/50 rounded-xl flex items-center gap-3 text-green-200 animate-slide-up mb-4">
                            <CheckIcon className="h-6 w-6 flex-shrink-0" />
                            <p className="font-semibold">{successMsg}</p>
                        </div>
                    )}

                    {/* TAB: WAREHOUSES */}
                    {isAdmin && activeTab === 'warehouses' && (
                        <section className="animate-fade-in">
                            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 mb-6">
                                <h3 className="text-lg font-bold text-cyan-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">Crear Nuevo Almacén</h3>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1">Código (Max 5)</label>
                                        <input
                                            type="text"
                                            placeholder="EJ: ALM1"
                                            value={newWhCode}
                                            onChange={e => setNewWhCode(e.target.value.toUpperCase().slice(0, 5))}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono focus:border-cyan-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1">Nombre Descriptivo</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Almacén de Recepción"
                                            value={newWhName}
                                            onChange={e => setNewWhName(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-cyan-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={handleAddWh}
                                            disabled={!newWhCode || !newWhName}
                                            className="h-[50px] px-6 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
                                        >
                                            <PlusCircleIcon className="h-5 w-5" /> Añadir
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {config.warehouses.map(wh => (
                                    <div key={wh.code} className="bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700 group hover:border-cyan-500/50 transition-all shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-lg text-cyan-400 bg-slate-900 px-3 py-1 rounded border border-slate-700 shadow-inner">{wh.code}</span>
                                            <span className="text-slate-300 font-medium">{wh.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveWh(wh.code)}
                                            className="text-slate-500 hover:text-red-500 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                                            title="Eliminar Almacén"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* TAB: LEAD TIME */}
                    {activeTab === 'leadtime' && (
                        <section className="animate-fade-in space-y-8">
                            <div className="bg-orange-900/10 p-6 rounded-2xl border border-orange-900/30">
                                <h3 className="text-lg font-bold text-orange-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    📦 Gestión de Entradas y Lead Time
                                </h3>

                                <div className="space-y-8">
                                    {/* OPERATION ZONE REMOVED AS REQUESTED */}
                                    {/* <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                                        <h4 className="text-white font-bold mb-4 text-base border-b border-slate-700 pb-2">Gestión Operativa (Recepción)</h4>
                                        <InboundManagement role={currentUserRole || 'CARRETILLERO'} />
                                    </div> */}

                                    {/* ANALYSIS ZONE (ADMIN ONLY) */}
                                    {isAdmin && (
                                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                                            <h4 className="text-white font-bold mb-4 text-base border-b border-slate-700 pb-2">Informe y Análisis (Estratégico)</h4>
                                            <LeadTimeReport />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TAB: MESSAGING */}
                    {isAdmin && activeTab === 'messaging' && (
                        <section className="animate-fade-in max-w-2xl mx-auto">
                            <div className="bg-pink-900/10 p-6 rounded-2xl border border-pink-900/30">
                                <h3 className="text-lg font-bold text-pink-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <SendIcon className="h-5 w-5" /> Centro de Notificaciones
                                </h3>

                                <div className="space-y-4">
                                    {/* Target Role */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1">Destinatario</label>
                                        <div className="flex gap-2">
                                            {(['ALL', 'JEFE', 'CARRETILLERO'] as const).map(role => (
                                                <button
                                                    key={role}
                                                    onClick={() => setMsgTarget(role)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${msgTarget === role
                                                        ? 'bg-pink-600 text-white border-pink-600 shadow'
                                                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                                                        }`}
                                                >
                                                    {role === 'ALL' ? 'Todos' : role === 'JEFE' ? 'JEFE SECCIÓN' : role}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Priority */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1">Prioridad</label>
                                        <div className="flex gap-4 items-center bg-slate-900 p-2 rounded-lg border border-slate-700">
                                            <label className="flex items-center gap-2 cursor-pointer p-2">
                                                <input
                                                    type="radio"
                                                    name="priority"
                                                    checked={msgPriority === 'normal'}
                                                    onChange={() => setMsgPriority('normal')}
                                                    className="w-4 h-4 text-pink-600"
                                                />
                                                <span className="text-white text-sm">Normal</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer p-2">
                                                <input
                                                    type="radio"
                                                    name="priority"
                                                    checked={msgPriority === 'high'}
                                                    onChange={() => setMsgPriority('high')}
                                                    className="w-4 h-4 text-red-600"
                                                />
                                                <span className="text-red-400 font-bold text-sm">Urgente (Vibración)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1">Asunto</label>
                                        <input
                                            type="text"
                                            value={msgTitle}
                                            onChange={e => setMsgTitle(e.target.value)}
                                            placeholder="Ej: Reunión en 5 min"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:border-pink-500 outline-none"
                                        />
                                    </div>

                                    {/* Body */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1 block mb-1">Mensaje</label>
                                        <textarea
                                            rows={4}
                                            value={msgBody}
                                            onChange={e => setMsgBody(e.target.value)}
                                            placeholder="Escribe el mensaje..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:border-pink-500 outline-none resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!msgTitle || !msgBody}
                                        className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <SendIcon className="h-5 w-5" />
                                        Enviar Notificación
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TAB: STRUCTURE */}
                    {isAdmin && activeTab === 'structure' && (
                        <section className="animate-fade-in">
                            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-6 flex items-start gap-3">
                                <div className="p-2 bg-purple-900/30 rounded-full text-purple-400 flex-shrink-0">
                                    <SettingsIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-purple-400">Estructura Base Global</h4>
                                    <p className="text-sm text-slate-400 mt-1">
                                        Estos elementos definen la estructura <strong>genérica</strong> (estanterías, racks, posiciones) que se aplicará a los nuevos almacenes creados.
                                        Los almacenes predefinidos (MEC, PLE, etc.) tienen su propia estructura fija.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* SHELVES */}
                                <div className="space-y-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Estanterías (Nº)</label>
                                    </div>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="number"
                                            value={newShelf}
                                            onChange={e => setNewShelf(e.target.value)}
                                            placeholder="#"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-center font-mono focus:border-purple-500 outline-none"
                                        />
                                        <button onClick={handleAddShelf} disabled={!newShelf} className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg disabled:opacity-50 transition-colors">
                                            <PlusCircleIcon className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 content-start">
                                        {config.shelves.map(s => (
                                            <div key={s} className="bg-slate-900 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-700 group hover:border-purple-500/50 transition-colors">
                                                <span className="font-mono font-bold text-white text-sm">{s}</span>
                                                <button onClick={() => handleRemoveShelf(s)} className="text-slate-600 hover:text-red-400 transition-colors"><TrashIcon className="h-3 w-3" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* RACKS */}
                                <div className="space-y-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Racks / Baldas (Nº)</label>
                                    </div>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="number"
                                            value={newRack}
                                            onChange={e => setNewRack(e.target.value)}
                                            placeholder="#"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-center font-mono focus:border-purple-500 outline-none"
                                        />
                                        <button onClick={handleAddRack} disabled={!newRack} className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg disabled:opacity-50 transition-colors">
                                            <PlusCircleIcon className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 content-start">
                                        {config.racks.map(r => (
                                            <div key={r} className="bg-slate-900 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-700 group hover:border-purple-500/50 transition-colors">
                                                <span className="font-mono font-bold text-white text-sm">{r}</span>
                                                <button onClick={() => handleRemoveRack(r)} className="text-slate-600 hover:text-red-400 transition-colors"><TrashIcon className="h-3 w-3" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* POSITIONS */}
                                <div className="space-y-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Posiciones (Texto)</label>
                                    </div>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={newPosition}
                                            onChange={e => setNewPosition(e.target.value.toUpperCase())}
                                            placeholder="Ej: IZQ"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-center font-mono focus:border-purple-500 outline-none"
                                        />
                                        <button onClick={handleAddPosition} disabled={!newPosition} className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg disabled:opacity-50 transition-colors">
                                            <PlusCircleIcon className="h-6 w-6" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 content-start">
                                        {config.positions.map(p => (
                                            <div key={p} className="bg-slate-900 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-700 group hover:border-purple-500/50 transition-colors">
                                                <span className="font-mono font-bold text-white text-xs">{p}</span>
                                                <button onClick={() => handleRemovePosition(p)} className="text-slate-600 hover:text-red-400 transition-colors"><TrashIcon className="h-3 w-3" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TAB: ANALYSIS */}
                    {isAdmin && activeTab === 'analysis' && (
                        <section className="animate-fade-in space-y-6">
                            <div className="bg-indigo-900/10 p-6 rounded-2xl border border-indigo-900/30">
                                <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <ChartIcon className="h-5 w-5" /> Inteligencia de Datos
                                </h3>
                                <p className="text-sm text-slate-400 mb-6">Herramientas de IA para el análisis profundo del estado del almacén.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Inventory Summary */}
                                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col justify-between hover:border-cyan-500/50 transition-all">
                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-3 bg-cyan-900/30 rounded-lg text-cyan-400">
                                                    <ListIcon className="h-6 w-6" />
                                                </div>
                                                <h4 className="font-bold text-white text-lg">Resumen de Inventario</h4>
                                            </div>
                                            <p className="text-sm text-slate-400 mb-4">
                                                Genera un informe ejecutivo sobre la ocupación actual de los almacenes, identificando zonas saturadas y vacías.
                                            </p>
                                        </div>
                                        <button
                                            onClick={onRunInventoryAnalysis}
                                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <SparklesIcon className="h-5 w-5 text-cyan-200" />
                                            Generar Resumen
                                        </button>
                                    </div>

                                    {/* Anomaly Detection */}
                                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col justify-between hover:border-purple-500/50 transition-all">
                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-3 bg-purple-900/30 rounded-lg text-purple-400">
                                                    <FlashIcon className="h-6 w-6" />
                                                </div>
                                                <h4 className="font-bold text-white text-lg">Detección de Anomalías</h4>
                                            </div>
                                            <p className="text-sm text-slate-400 mb-4">
                                                Escanea la base de datos en busca de duplicados, movimientos sospechosos o inconsistencias lógicas.
                                            </p>
                                        </div>
                                        <button
                                            onClick={onRunAnomalyAnalysis}
                                            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <SparklesIcon className="h-5 w-5 text-purple-200" />
                                            Detectar Anomalías
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TAB: DATA & BACKUP */}
                    {isAdmin && activeTab === 'data' && (
                        <section className="animate-fade-in space-y-8">
                            {/* EXCEL INVENTORY REPORT */}
                            <div className="bg-emerald-900/10 p-6 rounded-2xl border border-emerald-900/30">
                                <h3 className="text-lg font-bold text-emerald-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <DownloadIcon className="h-5 w-5" /> Reportes de Inventario
                                </h3>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h4 className="font-bold text-white">Inventario Completo (Excel)</h4>
                                            <p className="text-xs text-slate-400">
                                                Genera un archivo Excel con una pestaña por almacén, listando todos los artículos actuales.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => exportInventoryToExcel(assignments, config)}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                                    >
                                        <DownloadIcon className="h-5 w-5" />
                                        Descargar Excel de Inventario
                                    </button>
                                </div>
                            </div>

                            {/* BACKUPS */}
                            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                                <BackupManager
                                    assignments={assignments}
                                    setAssignments={setAssignments}
                                    history={history}
                                    setHistory={setHistory}
                                    config={config}
                                    setConfig={setConfig}
                                />
                            </div>

                            {/* MIGRATION ZONE */}
                            <div className="bg-blue-900/10 p-6 rounded-2xl border border-blue-900/30">
                                <h3 className="text-lg font-bold text-blue-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <SettingsIcon className="h-5 w-5" /> Mantenimiento Base de Datos
                                </h3>
                                <div className="bg-slate-900 p-4 rounded-xl border border-blue-900/30">
                                    <h4 className="font-bold text-white mb-2">Migración a Particionado (V2)</h4>
                                    <p className="text-xs text-slate-400 mb-4">
                                        Mueve los datos del documento único antiguo a la nueva estructura optimizada por almacén.
                                        Ejecutar solo una vez.
                                    </p>
                                    <button
                                        onClick={handleMigration}
                                        disabled={isMigrating}
                                        className="w-full py-2 bg-blue-600/20 text-blue-400 font-bold rounded-lg border border-blue-600/50 hover:bg-blue-600 hover:text-white transition-all text-sm disabled:opacity-50"
                                    >
                                        {isMigrating ? `Migrando... ${migrationProgress}` : 'Ejecutar Migración de Particionado'}
                                    </button>

                                    <div className="mt-4 pt-4 border-t border-blue-900/30">
                                        <h4 className="font-bold text-white mb-2">Normalización de Roles (Phase 1)</h4>
                                        <p className="text-xs text-slate-400 mb-4">
                                            Estandariza los roles de usuario (ADMIN, JEFE, CARRETILLERO) en la base de datos.
                                        </p>
                                        <button
                                            onClick={async () => {
                                                if (!confirm("¿Normalizar roles de todos los usuarios?")) return;
                                                setIsMigrating(true);
                                                setMigrationProgress("Normalizando roles...");
                                                // const { migrateUserRoles } = await import('../lib/migration'); // Removed
                                                const result = await migrateUserRoles((msg) => setMigrationProgress(msg));
                                                setIsMigrating(false);
                                                if (result.success) {
                                                    showSuccess("Roles normalizados correctamente.");
                                                    setMigrationProgress("Completado.");
                                                } else {
                                                    handleError(new Error(result.error || "Error desconocido"));
                                                }
                                            }}
                                            disabled={isMigrating}
                                            className="w-full py-2 bg-indigo-600/20 text-indigo-400 font-bold rounded-lg border border-indigo-600/50 hover:bg-indigo-600 hover:text-white transition-all text-sm disabled:opacity-50"
                                        >
                                            Ejecutar Normalización de Roles
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* DANGER ZONE */}
                            <div className="bg-red-900/10 p-6 rounded-2xl border border-red-900/30">
                                <h3 className="text-lg font-bold text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <FlashIcon className="h-5 w-5" /> Zona de Peligro
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                        <h4 className="font-bold text-white mb-2">Restaurar Configuración</h4>
                                        <p className="text-xs text-slate-400 mb-4">
                                            Devuelve los almacenes y la estructura a sus valores originales por defecto. No borra asignaciones.
                                        </p>
                                        <button
                                            onClick={handleConfigReset}
                                            className="w-full py-2 bg-slate-800 text-slate-300 font-bold rounded-lg border border-slate-600 hover:bg-slate-700 hover:text-white transition-colors text-sm"
                                        >
                                            Restaurar Configuración
                                        </button>
                                    </div>

                                    <div className="bg-slate-900 p-4 rounded-xl border border-red-900/30">
                                        <h4 className="font-bold text-red-400 mb-2">Factory Reset (Borrar Todo)</h4>
                                        <p className="text-xs text-slate-400 mb-4">
                                            Elimina <strong>todas</strong> las asignaciones y el historial de movimientos. Esta acción es irreversible.
                                        </p>
                                        <button
                                            onClick={handleFactoryReset}
                                            className="w-full py-2 bg-red-600/20 text-red-500 font-bold rounded-lg border border-red-600/50 hover:bg-red-600 hover:text-white transition-all text-sm"
                                        >
                                            Borrar Base de Datos
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                </div>

                <footer className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 hover:border-slate-600 transition-all">
                        Cerrar Panel
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default AdminPanel;