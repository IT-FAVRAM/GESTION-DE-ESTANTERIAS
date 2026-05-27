
import React from 'react';
import { ChevronLeftIcon } from './Icons';

interface ShelfModuleLayoutProps {
    title: string;
    subTitle?: string;
    children: React.ReactNode;
    onBack?: () => void;
}

export const ShelfModuleLayout: React.FC<ShelfModuleLayoutProps> = ({ title, subTitle, children, onBack }) => {
    return (
        <div className="pb-16 md:pb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-4 md:mb-6 px-1">
                {onBack && (
                    <button onClick={onBack} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 transition-colors mr-2">
                        <ChevronLeftIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                    </button>
                )}
                <h2 className="text-xl md:text-2xl font-bold">🏢 {title}</h2>
            </div>
            
            <div className="bg-slate-50/50 dark:bg-slate-900/30 p-3 md:p-4 rounded-2xl mb-4 md:mb-6 border-2 border-slate-200 dark:border-slate-800 content-visibility-auto">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 px-1">
                    <h3 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-slate-200">
                        {subTitle || title}
                    </h3>
                </div>

                <div className="space-y-6">
                    {children}
                </div>
            </div>
        </div>
    );
};


