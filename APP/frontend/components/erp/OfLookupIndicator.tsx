/**
 * OfLookupIndicator — feedback visual del autorrelleno de artículo por OF.
 *
 * Se usa igual en las 4 pantallas donde se teclea una OF. Como `ScannerInput`
 * vive sobre fondo claro y el resto de modales sobre fondo oscuro, acepta
 * `tone` para no desentonar.
 *
 * Si el ERP devuelve varios artículos para la misma OF no adivinamos: pintamos
 * los candidatos y que elija el operario.
 */

import React from 'react';
import type { OfLookupState } from '../../hooks/useOfLookup';
import type { ErpOfArticle } from '../../lib/erp/ofLookupApi';

interface OfLookupIndicatorProps extends Pick<OfLookupState, 'status' | 'article' | 'articles' | 'normalizedOf'> {
  /** Paleta del contenedor. `ScannerInput` es claro; los modales, oscuros. */
  tone?: 'light' | 'dark';
  /** Llamado cuando el operario resuelve una OF ambigua eligiendo un artículo. */
  onPickArticle?: (article: ErpOfArticle) => void;
  /**
   * Lo que hay ahora mismo en el campo artículo. Si no coincide con lo que dice
   * el ERP, avisamos: suele ser una errata al teclear o una etiqueta cambiada.
   */
  typedArticle?: string;
}

const TONES = {
  light: {
    muted: 'text-slate-500',
    ok: 'text-emerald-600',
    warn: 'text-amber-600',
    pickBtn: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300',
  },
  dark: {
    muted: 'text-slate-400',
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    pickBtn: 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600',
  },
} as const;

const OfLookupIndicator: React.FC<OfLookupIndicatorProps> = ({
  status,
  article,
  articles,
  normalizedOf,
  tone = 'light',
  onPickArticle,
  typedArticle = '',
}) => {
  const c = TONES[tone];

  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <p className={`text-xs font-bold flex items-center gap-1.5 ${c.muted}`} aria-live="polite">
        <span
          className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        Consultando ERP…
      </p>
    );
  }

  if (status === 'found' && article) {
    const typed = typedArticle.trim().toUpperCase();
    const fromErp = article.code.trim().toUpperCase();

    // El operario tenía otro código escrito. No lo pisamos, pero lo señalamos:
    // casi siempre es una errata de tecleo o una etiqueta equivocada.
    if (typed && typed !== fromErp) {
      return (
        <div className="space-y-1.5" aria-live="polite">
          <p className={`text-xs font-bold ${c.warn}`}>
            El ERP indica <span className="font-mono">{article.code}</span> para {normalizedOf}
          </p>
          <button
            type="button"
            onClick={() => onPickArticle?.(article)}
            className={`px-2.5 py-1.5 rounded-lg border font-bold text-xs transition-colors ${c.pickBtn}`}
          >
            Usar el del ERP
          </button>
        </div>
      );
    }

    return (
      <p className={`text-xs font-bold ${c.ok}`} aria-live="polite">
        ✓ Artículo obtenido del ERP ({normalizedOf})
      </p>
    );
  }

  if (status === 'ambiguous') {
    return (
      <div className="space-y-1.5" aria-live="polite">
        <p className={`text-xs font-bold ${c.warn}`}>
          La OF {normalizedOf} tiene {articles.length} artículos. Elige uno:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {articles.map((article) => (
            <button
              key={article.code}
              type="button"
              onClick={() => onPickArticle?.(article)}
              className={`px-2.5 py-1.5 rounded-lg border font-bold text-xs transition-colors ${c.pickBtn}`}
            >
              {article.code}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <p className={`text-xs font-bold ${c.warn}`} aria-live="polite">
        El ERP no tiene datos de {normalizedOf}. Escribe el artículo a mano.
      </p>
    );
  }

  // 'timeout' | 'error' — el bridge está caído o sin red. No es un fallo del
  // operario: se lo decimos sin alarma y que siga a mano, como siempre.
  return (
    <p className={`text-xs font-bold ${c.muted}`} aria-live="polite">
      Sin conexión con el ERP. Escribe el artículo a mano.
    </p>
  );
};

export default OfLookupIndicator;
