import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CloseIcon, LoadingIcon, SparklesIcon, ErrorIcon, DownloadIcon } from './Icons';

interface GeminiResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  isLoading: boolean;
  isError: boolean;
}

const GeminiResponseModal: React.FC<GeminiResponseModalProps> = ({ isOpen, onClose, title, content, isLoading, isError }) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-lg shadow-xl border border-slate-800 flex flex-col max-h-[90vh]">
        <header className="p-4 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-purple-400" />
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="overflow-y-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-center text-slate-400 h-48">
              <LoadingIcon className="h-10 w-10 mb-4" />
              <p>Generando resumen...</p>
              <p className="text-sm">Esto puede tardar unos segundos.</p>
            </div>
          )}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center text-center text-red-400 h-48">
              <ErrorIcon className="h-10 w-10 mb-4" />
              <p className="font-bold">Error</p>
              <p>{content}</p>
            </div>
          )}
          {!isLoading && !isError && content && (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-2 text-cyan-400" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-cyan-400" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2 text-cyan-400" {...props} />,
                  ul: ({ node, ...props }) => <ul className="ml-5 list-disc text-slate-300" {...props} />,
                  li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                  strong: ({ node, ...props }) => <strong className="text-white font-bold" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-2 text-slate-300" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-slate-800 flex justify-end gap-4">
          {!isLoading && !isError && content && (
            <button onClick={handleDownload} className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded font-semibold border border-slate-700 flex items-center gap-2">
              <DownloadIcon className="h-4 w-4" />
              Exportar
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 font-semibold text-white">
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default GeminiResponseModal;