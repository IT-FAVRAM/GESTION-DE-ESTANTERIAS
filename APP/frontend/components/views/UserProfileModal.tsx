
import React, { useState } from 'react';
import { UserRole } from '../hooks/useRoles';
import { WarehouseSection } from '../lib/warehouseData';
import { db, auth } from '../legacy/firebaseCompat';
import { CloseIcon, UserIcon, CheckIcon, SettingsIcon, BellIcon } from './Icons';
import { initPush, checkPushStatus, PushStatus } from '../lib/push';

interface UserProfileModalProps {
    onClose: () => void;
    currentRole: any;
    onRoleChange: (role: any) => void; 
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ onClose, currentRole }) => {
    // Read only now
    const selectedRole = currentRole;
    // We don't have section here easily without extra props, but we could pass it or just show basic info
    // However, looking at the previous code, section was partially manage internally or passed.
    // Let's assume we want to show current role as main info.

    const roles: { id: UserRole; label: string; desc: string }[] = [
        {
            id: 'CARRETILLERO',
            label: 'CARRETILLERO',
            desc: 'Operario: Mover, Asignar, Finalizar.'
        },
        {
            id: 'JEFE',
            label: 'SUPERVISOR',
            desc: 'Gestor: Retirar (su zona), Solicitar, Ver Historial.'
        },
        {
            id: 'ADMIN',
            label: 'ADMINISTRACIÓN',
            desc: 'Control Total: Configuración, Backups, IA.'
        },
    ];

    const roleInfo = roles.find(r => r.id === selectedRole);

    const [pushState, setPushState] = useState<PushStatus | null>(null);

    React.useEffect(() => {
        checkPushStatus().then(setPushState);
    }, []);

    const handleEnablePush = async () => {
        const token = await initPush();
        if (token) {
            setPushState({ isSupported: true, permission: 'granted', token });
        } else {
            // Re-check status
            checkPushStatus().then(setPushState);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-800 max-h-[90vh]">
                <header className="p-5 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-full text-cyan-400">
                            <UserIcon className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Perfil de Usuario</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </header>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
                        <div className="w-20 h-20 bg-cyan-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-400 border border-cyan-500/30">
                            <UserIcon className="h-10 w-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-white truncate">{auth.currentUser?.email?.split('@')[0].toUpperCase()}</h3>
                        <p className="text-slate-400 text-sm">{auth.currentUser?.email}</p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Rol Asignado</label>
                        <div className="bg-cyan-900/20 border-2 border-cyan-500/50 p-4 rounded-xl flex justify-between items-center">
                            <div>
                                <p className="font-bold text-lg text-cyan-400">
                                    {roleInfo?.label || selectedRole}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">{roleInfo?.desc}</p>
                            </div>
                            <CheckIcon className="h-6 w-6 text-cyan-400" />
                        </div>
                    </div>

                    {/* PUSH NOTIFICATIONS */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Notificaciones</label>
                        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${pushState?.permission === 'granted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                    <BellIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">Push Notifications</p>
                                    <p className="text-xs text-slate-400">
                                        {pushState?.permission === 'granted' ? 'Activas en este dispositivo' :
                                            pushState?.permission === 'denied' ? 'Bloqueadas por navegador' :
                                                'Recibe alertas con la app cerrada'}
                                    </p>
                                </div>
                            </div>

                            {pushState?.permission === 'default' && (
                                <button
                                    onClick={handleEnablePush}
                                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    Activar
                                </button>
                            )}

                            {pushState?.permission === 'granted' && (
                                <span className="text-xs text-emerald-500 font-bold px-2">ACTIVADO</span>
                            )}

                            {pushState?.permission === 'denied' && (
                                <span className="text-xs text-red-500 font-bold px-2">BLOQUEADO</span>
                            )}
                        </div>
                    </div>

                    <div className="bg-amber-900/10 border border-amber-500/20 p-4 rounded-xl">
                        <p className="text-amber-200/70 text-xs leading-relaxed italic text-center">
                            Para cambiar tu rol o sección, por favor contacta con el administrador del sistema.
                        </p>
                    </div>
                </div>

                <footer className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-center shrink-0">
                    <button onClick={onClose} className="w-full px-6 py-3 bg-rose-800 text-white font-bold rounded-xl hover:bg-rose-700 border border-rose-700 transition-colors">
                        Cerrar
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default UserProfileModal;


