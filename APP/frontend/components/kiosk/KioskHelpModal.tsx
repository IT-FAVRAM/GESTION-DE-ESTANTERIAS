import React from 'react';
import { ArrowLeftRight, Package, PackageMinus, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * KioskHelpModal — "¿Cómo funciona?" del kiosko.
 *
 * Paso a paso ultra corto de UBICAR / RETIRAR / MOVER / BUSCAR. Los textos
 * reproducen las etiquetas reales de los botones del flujo (formulario de OF,
 * barra de estado, lista de retirar), así que si cambia una etiqueta en
 * OperativeShelfArea / ScannerInput / RetirarArticleList hay que tocarla aquí.
 */

interface HelpSection {
  title: string;
  icon: LucideIcon;
  /** Clases de color de la cabecera y de los números. */
  head: string;
  num: string;
  steps: string[];
}

const SECTIONS: HelpSection[] = [
  {
    title: 'UBICAR',
    icon: Package,
    head: 'bg-emerald-600 text-white',
    num: 'bg-emerald-100 text-emerald-800',
    steps: [
      'Pulsa UBICAR',
      'Escribe el Nº de OF',
      'Pulsa Ubicar',
      'Toca la celda donde lo dejas',
      'Pulsa ✓ Ubicar',
    ],
  },
  {
    title: 'RETIRAR',
    icon: PackageMinus,
    head: 'bg-red-600 text-white',
    num: 'bg-red-100 text-red-800',
    steps: [
      'Pulsa RETIRAR',
      'Marca lo que te llevas',
      'Pulsa RETIRAR',
    ],
  },
  {
    title: 'MOVER',
    icon: ArrowLeftRight,
    head: 'bg-blue-600 text-white',
    num: 'bg-blue-100 text-blue-800',
    steps: [
      'Pulsa MOVER',
      'Escribe el Nº de OF',
      'Pulsa Mover',
      'Toca la celda nueva y pulsa Sí',
      'Pulsa Confirmar mover',
    ],
  },
  {
    title: 'BUSCAR ARTÍCULO',
    icon: Search,
    head: 'bg-slate-700 text-white',
    num: 'bg-slate-200 text-slate-800',
    steps: [
      'Toca la barra Buscar',
      'Escribe el artículo o la OF',
      'Toca el resultado',
      'Mira la celda marcada',
    ],
  },
];

interface KioskHelpModalProps {
  onClose: () => void;
}

const KioskHelpModal: React.FC<KioskHelpModalProps> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="kiosk-help-title"
  >
    <div className="w-full max-w-7xl max-h-full flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200">
        <h2 id="kiosk-help-title" className="text-2xl sm:text-3xl font-black text-slate-900">¿Cómo funciona?</h2>
        <button
          onClick={onClose}
          className="min-h-12 px-5 flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-lg font-black active:scale-95 transition-all touch-manipulation"
        >
          <X className="w-6 h-6" strokeWidth={3} aria-hidden />
          Cerrar
        </button>
      </div>

      {/* Tablets 10": en horizontal las 4 tarjetas en una fila (en 2x2 no cabían
          en ~600px de alto); en vertical 2x2. Sin overflow-hidden en las
          tarjetas: con él la rejilla las encogía y cortaba los últimos pasos
          en vez de desplazarse. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 grid grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:landscape:grid-cols-4 content-start gap-3">
        {SECTIONS.map(({ title, icon: Icon, head, num, steps }) => (
          <section key={title} className="rounded-2xl border border-slate-200">
            <h3 className={`flex items-center gap-2 px-3 py-2.5 rounded-t-2xl text-xl font-black leading-tight ${head}`}>
              <Icon className="w-7 h-7 flex-shrink-0" strokeWidth={2.5} aria-hidden />
              {title}
            </h3>
            <ol className="p-3 space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-lg font-black ${num}`}>
                    {i + 1}
                  </span>
                  <span className="text-lg font-bold text-slate-800 leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  </div>
);

export default KioskHelpModal;
