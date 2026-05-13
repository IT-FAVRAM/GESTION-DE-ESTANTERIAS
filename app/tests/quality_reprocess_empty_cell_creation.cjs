const fs = require('fs');

const calidadView = fs.readFileSync('web/components/app/CalidadView.tsx', 'utf8');
const reprocesosEditor = fs.readFileSync('web/components/kiosk/ReprocesosEditor.tsx', 'utf8');
const firestoreSchema = fs.readFileSync('web/lib/schema/shelves.ts', 'utf8');

// handleCellPress must open the editor for ANY reprocesos cell (not just occupied)
if (calidadView.includes('ocupada') && !calidadView.includes('vacía o con artículos')) {
  throw new Error(
    'CalidadView copy still restricts reprocesos to occupied cells. Must allow empty cells too.',
  );
}

// CalidadView opens editor without checking isEmpty
const handleCellPressBlock = calidadView.match(/const handleCellPress[\s\S]{0,600}setReprocesosCell/);
if (!handleCellPressBlock) {
  throw new Error('handleCellPress does not call setReprocesosCell');
}
if (handleCellPressBlock[0].includes('isEmpty') || handleCellPressBlock[0].includes('!isEmpty')) {
  throw new Error('handleCellPress guards setReprocesosCell with isEmpty check — empty cells will not open editor');
}

// ReprocesosEditor must have a creation form (presenceId empty = new item)
if (!reprocesosEditor.includes("presenceId || '',")) {
  throw new Error('ReprocesosEditor does not call updateReproceso with empty presenceId for new items');
}

// ShelfGridCell must call onPress with createEmptyLocation for cells with no location
if (!fs.readFileSync('web/components/kiosk/ShelfGridCell.tsx', 'utf8')
    .includes('location || createEmptyLocation(position, shelfCode)')) {
  throw new Error('ShelfGridCell does not fall back to createEmptyLocation for empty cells');
}

// isReprocesosLocation must cover range 1-22 for CAL
if (!firestoreSchema.includes("shelfCode === 'CAL' && position >= 1 && position <= 22")) {
  throw new Error('isReprocesosLocation does not correctly map CAL 001-022');
}

console.log('ok');
