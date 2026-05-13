import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { LogoIcon, MapIcon, ListIcon, BoxIcon, HistoryIcon, MessageSquareIcon, FactoryIcon, LogOutIcon, UserIcon, SettingsIcon, MenuIcon, BellIcon } from '../Icons';
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    // Default to current active warehouse or fallback to MEC
    const warehouseLink = `/warehouse/${activeWarehouse || 'MEC'}`;

    const navItems = [
        { id: 'warehouse', icon: MapIcon, label: 'Almacén', path: warehouseLink, color: 'bg-cyan-600', matchPattern: /^\/warehouse/ },
        { id: 'storage', icon: BoxIcon, label: 'Cerrados', path: '/storage', color: 'bg-emerald-600' },
        { id: 'working', icon: FactoryIcon, label: 'En Trabajo', path: '/working', color: 'bg-indigo-600' },
        ...(role === 'CARRETILLERO'
            ? [{ id: 'requests', icon: BellIcon, label: 'Solicitudes', path: '/requests', color: 'bg-red-600' }]
            : [{ id: 'history', icon: HistoryIcon, label: 'Historial', path: '/history', color: 'bg-purple-600' }]),
        { id: 'messages', icon: MessageSquareIcon, label: 'Chat', path: '/messages', color: 'bg-pink-600' },
    ];

    useEffect(() => {
        if (!mobileMenuOpen) return;

        const onClickOutside = (event: MouseEvent | TouchEvent) => {
            if (!mobileMenuRef.current) return;
            if (!mobileMenuRef.current.contains(event.target as Node)) {
                setMobileMenuOpen(false);
            }
        };

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMobileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onClickOutside);
        document.addEventListener('touchstart', onClickOutside);
        document.addEventListener('keydown', onEscape);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('touchstart', onClickOutside);
            document.removeEventListener('keydown', onEscape);
        };
    }, [mobileMenuOpen]);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-cyan-500/30">
            {/* HEADER */}
            <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 safe-area-inset-top">
                <div className="w-full max-w-7xl md:mx-auto px-4 h-14 md:h-16 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 md:gap-3">
                        <LogoIcon className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
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
                                    {item.id === 'requests' && unreadRequestsCount > 0 && (
                                        <span className="ml-2 inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-1.5">
                                            {unreadRequestsCount > 99 ? '99+' : unreadRequestsCount}
                                        </span>
                                    )}
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

                        <div className="flex gap-2">
                            <div className="hidden md:block">
                                <ThemeToggle />
                            </div>

                            {(role === 'ADMIN' || role === 'JEFE') && (
                                <button onClick={() => setModal('adminPanel', true)} className="hidden md:inline-flex p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full hover:bg-slate-200 transition-colors">
                                    <SettingsIcon className="h-5 w-5" />
                                </button>
                            )}

                            <div className="hidden md:block">
                                <button onClick={() => setModal('userProfile', true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full hover:bg-slate-200 transition-colors">
                                    <UserIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="hidden md:block">
                                <button onClick={handleLogout} className="p-3 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full hover:bg-red-100 transition-colors">
                                    <LogOutIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Mobile Header Actions */}
                            <div className="md:hidden relative flex items-center gap-2" ref={mobileMenuRef}>
                                <button onClick={() => setModal('userProfile', true)} className="h-11 w-11 inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full active:scale-95 transition-transform" aria-label="Perfil">
                                    <UserIcon className="h-5 w-5" />
                                </button>
                                <button onClick={() => setMobileMenuOpen(prev => !prev)} className={`h-11 w-11 inline-flex items-center justify-center rounded-full active:scale-95 transition-transform ${mobileMenuOpen ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}`} aria-label="Más acciones" aria-expanded={mobileMenuOpen} aria-controls="main-mobile-actions-menu">
                                    <MenuIcon className="h-5 w-5" />
                                </button>

                                {mobileMenuOpen && (
                                    <div id="main-mobile-actions-menu" className="absolute top-14 right-0 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 z-50">
                                        {(role === 'ADMIN' || role === 'JEFE') && (
                                            <button
                                                onClick={() => { setModal('adminPanel', true); setMobileMenuOpen(false); }}
                                                className="w-full h-11 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            >
                                                <SettingsIcon className="h-4 w-4" /> Administración
                                            </button>
                                        )}
                                        <div className="h-11 px-2 rounded-lg flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tema</span>
                                            <ThemeToggle />
                                        </div>
                                        <button
                                            onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                                            className="w-full h-11 px-3 rounded-lg flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <LogOutIcon className="h-4 w-4" /> Cerrar sesión
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARRETILLERO ALERT BANNER */}
                {role === 'CARRETILLERO' && (
                    <ForkliftBanner
                        count={unreadRequestsCount}
                        onClick={() => navigate('/requests')}
                    />
                )}
            </header>

            {/* MAIN CONTENT */}
            <main className="p-3 md:p-4 w-full max-w-7xl md:mx-auto flex flex-col gap-4 md:gap-6 pb-mobile-nav md:pb-4 safe-area-inset-bottom min-w-0">
                {children}
            </main>

            {/* MOBILE BOTTOM NAVIGATION */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 z-50 pb-safe">
                <div className="flex justify-around items-center h-16">
                    {navItems.map(item => {
                        const isActive = item.matchPattern
                            ? item.matchPattern.test(location.pathname)
                            : location.pathname === item.path;

                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}
                            >
                                <Icon className={`h-6 w-6 ${isActive ? 'fill-current' : ''}`} />
                                {item.id === 'requests' && unreadRequestsCount > 0 && (
                                    <span className="absolute top-1.5 right-[22%] min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-none font-bold inline-flex items-center justify-center">
                                        {unreadRequestsCount > 99 ? '99+' : unreadRequestsCount}
                                    </span>
                                )}
                                <span className="text-[11px] leading-none font-bold">{item.label}</span>
                            </NavLink>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default MainLayout;
