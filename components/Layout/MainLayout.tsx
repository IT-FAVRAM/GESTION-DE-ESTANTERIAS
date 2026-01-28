import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { LogoIcon, MapIcon, ListIcon, BoxIcon, HistoryIcon, MessageSquareIcon, LayersIcon, ShoppingCartIcon, FactoryIcon, LogOutIcon, UserIcon, SettingsIcon, TrashIcon } from '../Icons';
import ThemeToggle from '../ThemeToggle';
import SyncStatus from '../SyncStatus';
import ForkliftBanner from '../ForkliftBanner';


interface MainLayoutProps {
    children: React.ReactNode;
    user: any;
    role: any;
    section?: string;
    unreadRequestsCount: number;
    handleLogout: () => void;
    handleSyncData: () => void;
    canAccessChapero: () => boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({
    children, user, role, section, unreadRequestsCount, handleLogout, handleSyncData, canAccessChapero
}) => {
    const { setModal, activeWarehouse } = useAppStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Default to current active warehouse or fallback to MEC
    const warehouseLink = `/warehouse/${activeWarehouse || 'MEC'}`;

    const navItems = [
        { id: 'warehouse', icon: MapIcon, label: 'Almacén', path: warehouseLink, color: 'bg-cyan-600', matchPattern: /^\/warehouse/ }, // Match any /warehouse/...
        { id: 'storage', icon: BoxIcon, label: 'Cerrados', path: '/storage', color: 'bg-emerald-600' },
        { id: 'working', icon: FactoryIcon, label: 'En Trabajo', path: '/working', color: 'bg-indigo-600' },
        { id: 'history', icon: HistoryIcon, label: 'Historial', path: '/history', color: 'bg-purple-600' },
        { id: 'messages', icon: MessageSquareIcon, label: 'Chat', path: '/messages', color: 'bg-pink-600' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-cyan-500/30">
            {/* HEADER */}
            <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 safe-area-inset-top">
                <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex justify-between items-center">
                    <div className="flex items-center gap-2 md:gap-3">
                        <LogoIcon className="h-7 w-7 md:h-8 md:w-8 text-cyan-600 dark:text-cyan-400" />
                        <div className="leading-tight">
                            <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white tracking-tight">GESTOR</h1>
                            {role !== 'CARRETILLERO' && (
                                <div className="flex flex-col">
                                    <span className="text-[10px] md:text-xs font-bold bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-300 uppercase w-fit">{role}</span>
                                    {role === 'JEFE' && section && <span className="text-[8px] md:text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-0.5 uppercase">{section}</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {navItems.map(item => {
                            const isActive = item.matchPattern
                                ? item.matchPattern.test(location.pathname)
                                : location.pathname === item.path;

                            return (
                                <NavLink
                                    key={item.id}
                                    to={item.path}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${isActive ? `${item.color} text-white shadow` : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                                >
                                    {item.label}
                                </NavLink>
                            );
                        })}
                        {canAccessChapero() && (
                            <NavLink
                                to="/chapero"
                                className={({ isActive }) => `px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isActive ? 'bg-orange-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'} `}
                            >
                                Chapero
                            </NavLink>
                        )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <SyncStatus onSync={handleSyncData} />

                        <div className="hidden md:flex gap-2">
                            <ThemeToggle />
                            {role === 'ADMIN' && (
                                <button onClick={() => setModal('emptyLocations', true)} className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 transition-colors">
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            )}
                            <button onClick={() => setModal('userProfile', true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full hover:bg-slate-200 transition-colors">
                                <UserIcon className="h-5 w-5" />
                            </button>
                            {(role === 'ADMIN' || role === 'JEFE') && (
                                <button onClick={() => setModal('adminPanel', true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full hover:bg-slate-200 transition-colors">
                                    <SettingsIcon className="h-5 w-5" />
                                </button>
                            )}
                            <button onClick={handleLogout} className="p-3 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full hover:bg-red-100 transition-colors">
                                <LogOutIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Mobile profile/logout icons */}
                        <div className="md:hidden flex gap-2 items-center">
                            <button onClick={() => setModal('userProfile', true)} className="p-2 text-slate-500"><UserIcon className="h-6 w-6" /></button>
                            <button onClick={handleLogout} className="p-2 text-red-500"><LogOutIcon className="h-6 w-6" /></button>
                        </div>
                    </div>
                </div>

                {/* CARRETILLERO ALERT BANNER */}
                {role === 'CARRETILLERO' && (
                    <ForkliftBanner
                        count={unreadRequestsCount}
                        onClick={() => navigate('/messages')}
                    />
                )}
            </header>

            <main className="flex-grow p-3 md:p-4 max-w-7xl mx-auto w-full flex flex-col gap-4 md:gap-6">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
