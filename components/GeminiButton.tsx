
import React, { ReactNode } from 'react';
import { LoadingIcon, SparklesIcon } from './Icons';

interface GeminiButtonProps {
  onClick: () => void;
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}

const GeminiButton: React.FC<GeminiButtonProps> = ({ onClick, isLoading, children, className, title }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      title={title}
      className={`flex flex-col md:flex-row items-center justify-center gap-2 bg-slate-800 dark:bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-70 disabled:cursor-wait disabled:active:scale-100 ${className}`}
    >
      {isLoading ? (
        <LoadingIcon className="h-6 w-6 md:h-5 md:w-5" />
      ) : (
        <SparklesIcon className="h-6 w-6 md:h-5 md:w-5 text-purple-400" />
      )}
      <span className="text-sm md:text-base">{children}</span>
    </button>
  );
};

export default GeminiButton;
