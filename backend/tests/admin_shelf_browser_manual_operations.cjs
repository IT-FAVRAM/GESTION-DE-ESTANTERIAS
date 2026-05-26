const fs = require('fs');

const browser = fs.readFileSync('web/components/admin/AdminShelfBrowser.tsx', 'utf8');

// Must import and use useShelf for operations
if (!browser.includes("from '../../hooks/useShelf'")) {
  throw new Error('AdminShelfBrowser does not import useShelf');
}
if (!browser.includes('ubicar, retirar, mover, findArticle')) {
  throw new Error('AdminShelfBrowser does not destructure ubicar/retirar/mover/findArticle from useShelf');
}

// Must import and use useAuth for operator identity
if (!browser.includes("from '../../hooks/useAuth'")) {
  throw new Error('AdminShelfBrowser does not import useAuth');
}

// Must have all three action modes
if (!browser.includes("'ubicar'")) {
  throw new Error('AdminShelfBrowser missing ubicar action');
}
if (!browser.includes("'retirar'")) {
  throw new Error('AdminShelfBrowser missing retirar action');
}
if (!browser.includes("'mover'")) {
  throw new Error('AdminShelfBrowser missing mover action');
}

// Must have text inputs for manual article/OF entry
if (!browser.includes('articleInput') || !browser.includes('ofInput')) {
  throw new Error('AdminShelfBrowser does not have text inputs for article and OF');
}

// Must use ConfirmationModal for operation confirmations
if (!browser.includes("from '../common/ConfirmationModal'")) {
  throw new Error('AdminShelfBrowser does not import ConfirmationModal');
}

// Compact mode must be dynamic: compact only when idle (overview), full when operating
if (!browser.includes('compact={action === \'idle\'}')) {
  throw new Error('AdminShelfBrowser does not switch grid to non-compact mode during operations');
}

// Must NOT be read-only (no "solo lectura" subtitle)
if (browser.includes('solo lectura')) {
  throw new Error('AdminShelfBrowser still shows "solo lectura" subtitle — it is now operational');
}

console.log('ok');
