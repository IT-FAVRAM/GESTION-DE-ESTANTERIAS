const fs = require('fs');

const visibility = fs.readFileSync('web/domain/reprocesos/reprocesosVisibility.ts', 'utf8');
const calidadView = fs.readFileSync('web/components/app/CalidadView.tsx', 'utf8');
const reprocesosSection = fs.readFileSync('web/components/app/CalidadReprocesosSection.tsx', 'utf8');
const shelfGridCell = fs.readFileSync('web/components/kiosk/ShelfGridCell.tsx', 'utf8');

if (!visibility.includes("if (role === 'CALIDAD' && authMethod === 'email') return true;")) {
  throw new Error('Reprocess cost visibility is not limited to CALIDAD email access');
}

// Cost banner gating: either inline in CalidadView or delegated to CalidadReprocesosSection
const bannerGatedInView = calidadView.includes('{canViewReprocessCosts && (');
const bannerGatedInSection = reprocesosSection.includes('{canViewReprocessCosts && (');
if (!bannerGatedInView && !bannerGatedInSection) {
  throw new Error('Total reprocess banner is not gated by canViewReprocessCosts');
}

// CalidadView must pass the flag through (either inline or as prop)
if (!calidadView.includes('canViewReprocessCosts')) {
  throw new Error('CalidadView does not pass canViewReprocessCosts to the reprocesos section');
}

if (!shelfGridCell.includes('showReprocessCosts && item.quantity != null && item.unitCost != null')) {
  throw new Error('ShelfGridCell does not guard reprocess cost line with showReprocessCosts');
}

console.log('ok');
