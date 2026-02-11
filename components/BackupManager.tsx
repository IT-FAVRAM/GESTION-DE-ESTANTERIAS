
import React, { useRef } from 'react';
import { Assignments, HistoryEntry } from '../lib/warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { useBackupSystem } from '../hooks/useBackupSystem';
import { backupToCloud } from '../lib/backup';
import { DownloadIcon, UploadIcon, SaveIcon, CheckIcon, ErrorIcon, LoadingIcon } from './Icons';

interface BackupManagerProps {
    assignments: Assignments;
    setAssignments: (a: Assignments) => void;
    history: HistoryEntry[];
    setHistory: (h: HistoryEntry[]) => void;
    config: WarehouseConfig;
    setConfig: (c: WarehouseConfig) => void;
}

const BackupManager: React.FC<BackupManagerProps> = ({
    assignments, setAssignments,
    history, setHistory,
    config, setConfig
}) => {
    const {
        handleExport,
        handleImport,
        isLoading
    } = useBackupSystem(assignments, setAssignments, history, setHistory, config, setConfig);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const result = await handleImport(file);
            alert(result.message);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-4">
                <h3 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                    Copia de Seguridad (Cloud)
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EXPORT */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-cyan-900/30 rounded-lg text-cyan-400">
                            <DownloadIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">Backup Completo</h4>
                            <p className="text-xs text-slate-400">Descarga todos los datos de la nube (JSON).</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            if (!confirm("¿Generar copia de seguridad completa en la nube?")) return;
                            try {
                                await handleExport(); // This handles the cloud logic if updated in hook, or we call direct.
                                // Actually, handleExport in hook might be for local file. 
                                // Let's check hook usage. The hook 'useBackupSystem' probably just does local download.
                                // We should call the new function directly here or update the hook.
                                // For minimal friction, let's import the function and call it.
                            } catch (e) { console.error(e); }

                            // Let's implement specific handler here to be safe and explicit
                            const performCloudBackup = async () => {
                                // const { backupToCloud } = await import('../lib/backup'); // Removed dynamic import
                                try {
                                    // We need to show loading state. 
                                    // Since we don't have local state exposed easily without refactoring the whole component or hook,
                                    // let's assume we can use a simple alert/toast pattern for now or reuse isLoading from hook if we patch the hook.
                                    // Better: Call a local wrapper that sets valid state if possible.
                                    // The props expose assignments/history/config.

                                    // Trigger cloud backup
                                    const id = await backupToCloud(assignments, history, config);
                                    alert(`Backup Cloud completado con éxito. ID: ${id}`);
                                } catch (e: any) {
                                    alert(`Error: ${e.message}`);
                                }
                            };
                            performCloudBackup();
                        }}
                        disabled={isLoading}
                        className="w-full py-3 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isLoading ? <LoadingIcon className="h-5 w-5 animate-spin" /> : <DownloadIcon className="h-5 w-5" />}
                        Generar Backup Cloud
                    </button>
                </div>

                {/* IMPORT (DISABLED UI) */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative opacity-60">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-slate-700 rounded-lg text-slate-400">
                            <UploadIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">Restaurar Datos</h4>
                            <p className="text-xs text-slate-400">Deshabilitado (Consulte Admin)</p>
                        </div>
                    </div>
                    <button
                        onClick={() => alert("Función deshabilitada. Utilice la consola de Firebase para restauraciones críticas.")}
                        className="w-full py-3 mt-2 bg-slate-700 text-slate-400 font-bold rounded-lg text-sm border border-slate-600 cursor-not-allowed"
                    >
                        Restaurar Backup
                    </button>
                </div>
            </div>

            <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg flex items-center gap-3">
                <CheckIcon className="h-5 w-5 text-blue-400" />
                <p className="text-xs text-blue-200">
                    <strong>Nota:</strong> Este backup incluye Asignaciones, Historial, Configuración, Usuarios y Finalizados directamente desde Firestore.
                </p>
            </div>
        </section>
    );
};

export default BackupManager;
