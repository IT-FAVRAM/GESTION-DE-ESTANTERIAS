

import React from 'react';
import { UserIcon, SettingsIcon, LogoIcon, BellIcon } from './Icons';
import { UserRole } from '../hooks/useRoles';

interface LandingScreenProps {
    onSelectRole: (role: UserRole) => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onSelectRole }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 animate-fade-in overflow-y-auto">
            <div className="mb-8 md:mb-12 flex flex-col items-center mt-10 md:mt-0">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl mb-4">
                    <LogoIcon className="h-16 w-16 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white text-center tracking-tight">
                    GESTOR ESTANTERÍAS
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Seleccione su perfil para acceder</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-8 w-full max-w-5xl justify-center items-center pb-10">
                {/* Botón Carretillero */}
                <button 
                    onClick={() => onSelectRole('CARRETILLERO')}
                    className="group relative w-full md:w-64 h-48 md:h-64 rounded-3xl bg-white dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-105 hover:border-cyan-500 active:scale-95"
                >
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-full group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40 transition-colors">
                        <UserIcon className="h-12 w-12 md:h-16 md:w-16 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider">Carretillero</h2>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Acceso Operario</p>
                    </div>
                </button>

                {/* Botón Supervisor */}
                <button 
                    onClick={() => onSelectRole('JEFE')}
                    className="group relative w-full md:w-64 h-48 md:h-64 rounded-3xl bg-white dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-105 hover:border-purple-500 active:scale-95"
                >
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-full group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-colors">
                        <BellIcon className="h-12 w-12 md:h-16 md:w-16 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider">Jefe Sección</h2>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Solicitudes y Análisis</p>
                    </div>
                </button>

                {/* Botón Administración */}
                <button 
                    onClick={() => onSelectRole('ADMIN')}
                    className="group relative w-full md:w-64 h-48 md:h-64 rounded-3xl bg-white dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-105 hover:border-slate-500 active:scale-95"
                >
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                        <SettingsIcon className="h-12 w-12 md:h-16 md:w-16 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider">Administración</h2>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Control Total</p>
                    </div>
                </button>
            </div>

            <div className="mt-auto md:mt-16 pb-4 text-slate-400 text-sm font-mono">
                v2.1.0 - Sistema de Gestión
            </div>
        </div>
    );
};

export default LandingScreen;

