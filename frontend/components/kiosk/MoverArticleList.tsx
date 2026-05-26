import React, { useMemo } from 'react';
import type { ShelfLocationState } from '../../hooks/useShelf';
import { isSameArticle } from '../../lib/articleIdentity';

interface MoverArticleItem {
  articleCode: string;
  orderFab: string;
  positions: string[];
}

interface MoverArticleListProps {
  locations: ShelfLocationState[];
  shelfCode: string;
  onSelect: (articleCode: string, orderFab: string) => void;
  onClose: () => void;
}

function formatPositions(positions: string[]): string {
  const nums = positions.map(p => parseInt(p, 10)).filter(n => !isNaN(n));
  if (nums.length === 0) return positions.join(', ');
  return nums.map(n => `${n}`).join(', ');
}

const MoverArticleList: React.FC<MoverArticleListProps> = ({ locations, shelfCode, onSelect, onClose }) => {
  const articles = useMemo(() => {
    const seen = new Set<string>();
    const result: MoverArticleItem[] = [];
    for (const loc of locations) {
      if (loc.isEmpty) continue;
      for (const item of loc.items) {
        const key = `${item.articleCode}__${item.orderFab}`;
        if (!seen.has(key)) {
          seen.add(key);
          const allPositions = locations
            .filter(l => l.items.some(i => isSameArticle(i.articleCode, i.orderFab, item.articleCode, item.orderFab)))
            .map(l => l.position);
          result.push({
            articleCode: item.articleCode,
            orderFab: item.orderFab,
            positions: allPositions,
          });
        }
      }
    }
    return result.sort((a, b) => a.articleCode.localeCompare(b.articleCode));
  }, [locations]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <h2 className="text-lg font-black text-white">🔄 Mover artículo</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors px-3 py-1 text-sm font-bold">
          Cancelar
        </button>
      </div>

      {articles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <span className="text-5xl mb-4">📭</span>
          <p className="text-slate-400 font-medium text-lg">No hay artículos en esta estantería</p>
          <p className="text-slate-600 text-sm mt-1">Ubica algún artículo primero para poder moverlo.</p>
        </div>
      ) : (
        <>
          <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              {articles.length} artículo{articles.length !== 1 ? 's' : ''} — toca uno para moverlo
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {articles.map((article) => (
              <button
                key={`${article.articleCode}__${article.orderFab}`}
                onClick={() => onSelect(article.articleCode, article.orderFab)}
                className="w-full text-left rounded-2xl border border-slate-700 bg-slate-900 p-4
                  hover:border-blue-500/50 hover:bg-slate-800 active:scale-[0.98] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-white text-lg font-mono leading-tight truncate">
                      {article.articleCode}
                    </p>
                    <p className="text-sm text-slate-400 font-mono mt-0.5">OF: {article.orderFab}</p>
                  </div>
                  <span className="shrink-0 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full px-2.5 py-1 font-bold">
                    {article.positions.length} pos.
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500">
                    {shelfCode} — pos. {formatPositions(article.positions)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MoverArticleList;

