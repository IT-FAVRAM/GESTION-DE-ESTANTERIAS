import type { ShelfLocationState } from '../../hooks/useShelf';

export type Tone = 'default' | 'urgent' | 'review' | 'special';

export const createEmptyLocation = (position: string, shelfCode?: string): ShelfLocationState => ({
  position,
  items: [],
  isEmpty: true,
  locationId: `${shelfCode || ''}-${position}`,
});

export const getZoneTone = (zoneName?: string): Tone => {
  if (!zoneName) return 'default';
  const normalized = zoneName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (normalized.includes('URGENTE')) return 'urgent';
  if (normalized.includes('REVISION')) return 'review';
  if (normalized.includes('ALUMINIO') || normalized.includes('PUNZONADORA') || normalized.includes('MODULAR')) return 'special';
  return 'default';
};

export const getBlockClasses = (tone: Tone, compact: boolean) => {
  if (compact) return 'border-slate-800 bg-slate-900/70';
  switch (tone) {
    case 'urgent': return 'border-red-500/25 bg-gradient-to-br from-red-500/10 via-slate-900 to-slate-950';
    case 'review': return 'border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950';
    case 'special': return 'border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-slate-900 to-slate-950';
    default: return 'border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950';
  }
};

export const getBadgeClasses = (tone: Tone) => {
  switch (tone) {
    case 'urgent': return 'border-red-500/30 bg-red-500/15 text-red-300';
    case 'review': return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
    case 'special': return 'border-orange-500/30 bg-orange-500/15 text-orange-200';
    default: return 'border-slate-700 bg-slate-800/80 text-slate-300';
  }
};

export const getBlockAccent = (tone: Tone) => {
  switch (tone) {
    case 'urgent': return 'text-red-300';
    case 'review': return 'text-amber-300';
    case 'special': return 'text-orange-200';
    default: return 'text-cyan-200';
  }
};

export const getItemKey = (articleCode: string, orderFab: string) => `${articleCode}__${orderFab}`;
export const truncateArticle = (value: string) => (value.length > 8 ? `${value.slice(0, 6)}..` : value);
export const shortOrder = (value: string) => (value.length > 8 ? value.slice(-8) : value);
