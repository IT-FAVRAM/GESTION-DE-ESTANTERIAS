
import React, { useState, useEffect } from 'react';
import { LoadingIcon, SyncIcon, CheckIcon, ErrorIcon } from './Icons';

type SyncState = 'loading' | 'syncing' | 'synced' | 'error';

interface SyncStatusProps {
  onSync: () => void;
}

const SyncStatus: React.FC<SyncStatusProps> = ({ onSync }) => {
  const [status, setStatus] = useState<SyncState>('loading');

  useEffect(() => {
    const timer = setTimeout(() => setStatus('synced'), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSyncClick = async () => {
    setStatus('syncing');
    try {
      await new Promise(resolve => setTimeout(resolve, 800)); 
      onSync();
      setStatus('synced');
      setTimeout(() => setStatus('synced'), 2000);
    } catch (err) {
      console.error("Sync failed", err);
      setStatus('error');
    }
  };

  const statusMap: Record<SyncState, { icon: React.ReactNode; text: string; color: string }> = {
    loading: { icon: <LoadingIcon className="h-5 w-5" />, text: 'Cargando...', color: 'text-slate-400' },
    syncing: { icon: <SyncIcon className="h-5 w-5 animate-spin" />, text: 'Sincronizando...', color: 'text-cyan-400' },
    synced: { icon: <CheckIcon className="h-5 w-5" />, text: 'Sincronizado', color: 'text-green-500' },
    error: { icon: <ErrorIcon className="h-5 w-5" />, text: 'Error', color: 'text-red-500' },
  };

  return (
    <div className="flex items-center gap-2 md:gap-4">
      <div className={`hidden md:flex items-center gap-2 text-sm font-medium ${statusMap[status].color}`}>
        {statusMap[status].icon}
        <span>{statusMap[status].text}</span>
      </div>
      <button
        onClick={handleSyncClick}
        disabled={status === 'syncing' || status === 'loading'}
        className="h-11 w-11 md:h-auto md:w-auto md:px-4 md:py-2 text-sm font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        title="Sincronizar datos"
        aria-label="Sincronizar datos"
      >
        <SyncIcon className="h-5 w-5 md:hidden" />
        <span className="hidden md:inline">Sincronizar</span>
      </button>
    </div>
  );
};

export default SyncStatus;


