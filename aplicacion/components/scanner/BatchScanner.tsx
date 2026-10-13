
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CloseIcon, TrashIcon, PlusCircleIcon, CheckIcon } from './Icons';
import { BatchItem } from '../types/batch';
import { useOfLookup } from '../../hooks/useOfLookup';
import OfLookupIndicator from '../erp/OfLookupIndicator';
import type { ErpOfArticle } from '../../lib/erp/ofLookupApi';
import { defaultOfPrefix } from '../../lib/erp/ofNormalize';

interface BatchScannerProps {
  onComplete: (items: BatchItem[]) => void;
  onClose: () => void;
  mode?: 'assign' | 'request';
}

const BatchScanner: React.FC<BatchScannerProps> = ({ onComplete, onClose, mode = 'assign' }) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [articleInput, setArticleInput] = useState('');
  const [orderInput, setOrderInput] = useState(defaultOfPrefix);
  const articleRef = useRef<HTMLInputElement>(null);

  // Autorrelleno del artículo desde el ERP al teclear la OF del ítem en curso.
  // Solo pisa el artículo si sigue vacío o si es el que puso el autorrelleno
  // anterior: cambiar de OF refresca el artículo, pero nunca se pisa lo que
  // el operario haya escrito a mano.
  //
  // El chequeo se hace fuera del updater de setState a propósito: React (en
  // desarrollo/StrictMode) invoca dos veces la función de un updater
  // funcional, y mutar la ref ahí dentro hacía que la 2ª invocación viera la
  // ref ya cambiada por la 1ª y deshiciera la actualización.
  const articleInputRef = useRef(articleInput);
  useEffect(() => {
    articleInputRef.current = articleInput;
  }, [articleInput]);

  const lastAutoFilledRef = useRef<string | null>(null);

  const applyErpArticle = useCallback((article: ErpOfArticle) => {
    const code = article.code.toUpperCase();
    lastAutoFilledRef.current = code;
    setArticleInput(code);
  }, []);

  const ofLookup = useOfLookup(orderInput, {
    enabled: isFormOpen,
    onResolved: (article) => {
      const code = article.code.toUpperCase();
      const current = articleInputRef.current;
      const untouched = current.trim() === '' || current === lastAutoFilledRef.current;
      if (untouched) {
        lastAutoFilledRef.current = code;
        setArticleInput(code);
      }
    },
  });

  const title = mode === 'request' ? "Crear Solicitud" : "Escaneo de Lote";
  const actionLabel = mode === 'request' ? "REVISAR SOLICITUD" : "FINALIZAR Y UBICAR";

  const openForm = () => {
    setArticleInput('');
    setOrderInput(defaultOfPrefix());
    lastAutoFilledRef.current = null;
    setIsFormOpen(true);
    setTimeout(() => articleRef.current?.focus(), 50);
  };

  const handleAddItem = () => {
    const article = articleInput.trim().toUpperCase();
    const order = orderInput.trim().toUpperCase();
    // El prefijo precargado ("OF26-") sin dígitos detrás cuenta como vacío.
    if (!article || !order || order === defaultOfPrefix()) return;
    setItems(prev => [...prev, { article, order }]);
    setIsFormOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="relative z-20 p-4 flex justify-between items-center bg-slate-800 border-b border-slate-700 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-slate-400 text-sm">{items.length} artículos en lista</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors">
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Add Item Form */}
      {isFormOpen && (
        <div className="p-4 bg-slate-800 border-b border-slate-700 space-y-3">
          <input
            ref={articleRef}
            type="text"
            value={articleInput}
            onChange={(e) => setArticleInput(e.target.value.toUpperCase())}
            placeholder="Código Artículo"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 text-white font-bold rounded-xl uppercase outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            value={orderInput}
            onChange={(e) => setOrderInput(e.target.value.toUpperCase())}
            onFocus={(e) => {
              const el = e.target;
              const end = el.value.length;
              requestAnimationFrame(() => el.setSelectionRange(end, end));
            }}
            onKeyDown={(e) => e.key === 'Enter' && articleInput.trim() && orderInput.trim() && handleAddItem()}
            placeholder="Orden Fabricación (OF)"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 text-white font-bold rounded-xl uppercase outline-none focus:border-purple-500"
          />
          <OfLookupIndicator
            status={ofLookup.status}
            article={ofLookup.article}
            articles={ofLookup.articles}
            normalizedOf={ofLookup.normalizedOf}
            typedArticle={articleInput}
            onPickArticle={applyErpArticle}
            tone="dark"
          />
          <div className="flex gap-3">
            <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 bg-rose-700 text-rose-300 font-bold rounded-xl hover:bg-rose-600">
              Cancelar
            </button>
            <button
              onClick={handleAddItem}
              disabled={!articleInput.trim() || !orderInput.trim()}
              className="flex-[2] py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 disabled:opacity-50"
            >
              Añadir
            </button>
          </div>
        </div>
      )}

      {/* List Area */}
      <div className="flex-grow p-4 overflow-hidden flex flex-col">
        <div className="flex-grow overflow-y-auto space-y-3 pb-24">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
              <div className="p-4 bg-slate-800 rounded-full">
                <PlusCircleIcon className="h-12 w-12 opacity-50" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-slate-300">Lista Vacía</p>
                <p className="text-sm mt-1 max-w-xs mx-auto text-slate-400">
                  Pulsa el botón <strong>(+)</strong> para añadir un artículo manualmente.
                </p>
              </div>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm animate-slide-in-right">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">ART</span>
                    <span className="font-bold text-white text-lg">{item.article}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">OF</span>
                    <span className="font-mono text-purple-400">{item.order}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveItem(idx)}
                  className="p-3 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Add Button */}
      {!isFormOpen && (
        <div className="absolute bottom-24 right-6 z-30">
          <button
            onClick={openForm}
            className="h-16 w-16 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg flex items-center justify-center border-4 border-slate-900 active:scale-95 transition-all"
            title="Añadir Artículo"
          >
            <PlusCircleIcon className="h-8 w-8" />
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 flex gap-3 z-30 safe-area-inset-bottom">
        <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-rose-400 bg-rose-800 hover:bg-rose-700 border border-rose-700">
          Cancelar
        </button>
        <button
          onClick={() => onComplete(items)}
          disabled={items.length === 0}
          className={`flex-[2] py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
            ${mode === 'request' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-cyan-600 hover:bg-cyan-500'}
          `}
        >
          {mode !== 'request' && <CheckIcon className="h-5 w-5" />}
          <span>{actionLabel} ({items.length})</span>
        </button>
      </div>
    </div>
  );
};

export default BatchScanner;


