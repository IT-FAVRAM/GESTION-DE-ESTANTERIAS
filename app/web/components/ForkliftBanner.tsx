
import React from 'react';
import { BellIcon } from './Icons';

interface ForkliftBannerProps {
    count: number;
    onClick: () => void;
}

const ForkliftBanner: React.FC<ForkliftBannerProps> = ({ count, onClick }) => {
    if (count === 0) return null;

    return (
        <div 
            onClick={onClick}
            className="bg-red-600 text-white px-4 py-3 shadow-md flex items-center justify-between cursor-pointer animate-slide-in-right relative z-40"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full animate-pulse">
                    <BellIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="font-black text-sm uppercase leading-tight">Solicitudes Pendientes</p>
                    <p className="text-xs text-red-100">Tienes {count} {count === 1 ? 'artículo' : 'artículos'} esperando recogida.</p>
                </div>
            </div>
            <button className="bg-white text-red-600 font-bold px-4 py-2 rounded-lg text-sm shadow active:scale-95 transition-transform" aria-label="Ver solicitudes pendientes">
                VER SOLICITUDES
            </button>
        </div>
    );
};

export default ForkliftBanner;
