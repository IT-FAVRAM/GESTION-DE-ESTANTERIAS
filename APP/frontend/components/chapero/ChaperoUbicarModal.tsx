import React, { useState } from 'react';
import { CHAPERO_MATERIALS, CHAPERO_ESPESORES } from '../../lib/schema/chapero';

interface ChaperoUbicarModalProps {
  positionId: string;
  onConfirm: (material: string, espesor: string, spec?: string, albaran?: string) => void;
  onClose: () => void;
  loading?: boolean;
}

const ChaperoUbicarModal: React.FC<ChaperoUbicarModalProps> = ({ positionId, onConfirm, onClose, loading }) => {
  const [material, setMaterial] = useState('ACERO');
  const [customMaterial, setCustomMaterial] = useState('');
  const [espesor, setEspesor] = useState('1.0');
  const [customEspesor, setCustomEspesor] = useState('');
  const [spec, setSpec] = useState('');
  const [albaran, setAlbaran] = useState('');

  const effectiveMaterial = material === 'OTRO' ? customMaterial.trim().toUpperCase() : material;
  const effectiveEspesor = espesor === 'custom' ? customEspesor.trim() : espesor;
  const canConfirm = !!effectiveMaterial && !!effectiveEspesor && !!albaran.trim() && !loading;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(effectiveMaterial, effectiveEspesor, spec.trim() || undefined, albaran.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-slate-800 px-5 py-4">
          <h2 className="text-lg font-black text-white">Colocar chapa</h2>
          <p className="text-xs text-slate-400 mt-0.5">Posición <span className="font-bold text-slate-200">{positionId}</span></p>
        </div>

        <div className="p-5 space-y-4">
          {/* Material */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Material *</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CHAPERO_MATERIALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMaterial(m)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                    material === m ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {material === 'OTRO' && (
              <input
                type="text"
                value={customMaterial}
                onChange={(e) => setCustomMaterial(e.target.value)}
                placeholder="Nombre del material..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                autoFocus
              />
            )}
          </div>

          {/* Especificación (opcional) */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">
              Especificación <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="DC11, S235JR, 304..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          {/* Nº de albarán */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Nº de albarán *</label>
            <input
              type="text"
              value={albaran}
              onChange={(e) => setAlbaran(e.target.value)}
              placeholder="Ej: A-2026-00123"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          {/* Espesor */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Espesor (mm) *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CHAPERO_ESPESORES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEspesor(e)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-colors ${
                    espesor === e ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEspesor('custom')}
                className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-colors ${
                  espesor === 'custom' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Otro
              </button>
            </div>
            {espesor === 'custom' && (
              <input
                type="text"
                inputMode="decimal"
                value={customEspesor}
                onChange={(e) => setCustomEspesor(e.target.value)}
                placeholder="Ej: 7.0"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                autoFocus
              />
            )}
          </div>

          {/* Resumen */}
          {effectiveMaterial && effectiveEspesor && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-200">
              <span className="font-black">{effectiveMaterial}</span>
              {spec.trim() && <span className="text-slate-500"> {spec.trim().toUpperCase()}</span>}
              <span className="text-slate-500"> · {effectiveEspesor} mm</span>
              {albaran.trim() && <span className="text-slate-500"> · Alb. {albaran.trim()}</span>}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
              canConfirm
                ? 'bg-slate-800 text-white active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Colocando...' : 'Colocar chapa'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChaperoUbicarModal;
