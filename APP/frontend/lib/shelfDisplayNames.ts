/**
 * Mapeo de códigos de estantería/carro a nombres amigables para mostrar en UI
 */

export const SHELF_DISPLAY_NAMES: Record<string, string> = {
  'PLE': 'Plegadora',
  'CP1': 'Carro Plegadora 1',
  'CP2': 'Carro Plegadora 2',
  'CAM': 'Carro Plegadora Amada',
  'CRP': 'Carro Robot de Plegado',
  'RPL': 'Autoplegadora',
  'ARO': 'Autoroscadora',
  'PRE': 'Prensas',
  'MEC': 'Mecanizado',
  'SOL': 'Soldadura',
  'CS': 'Carro Soldadura',
  'REP': 'Repasado',
  'PIN': 'Pintura',
  'CAL': 'Calidad',
};

export const getShelfDisplayName = (code: string): string => {
  return SHELF_DISPLAY_NAMES[code] || code;
};
