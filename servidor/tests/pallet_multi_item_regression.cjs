const fs = require('fs');

const typesSrc = fs.readFileSync('web/lib/warehouseData.ts', 'utf8');
const txSrc = fs.readFileSync('web/lib/inventoryTransactions.ts', 'utf8');

if (!typesSrc.includes('quantity?: number;') || !typesSrc.includes('containerId?: string;')) {
  throw new Error('AssignmentItem is missing pallet-oriented fields (quantity/containerId)');
}

if (!txSrc.includes('quantity: item.quantity ?? 1') || !txSrc.includes('containerId: item.containerId || null')) {
  throw new Error('Transaction sanitization does not preserve quantity/containerId');
}

if (!txSrc.includes('itemKey: item.itemKey || null') || !txSrc.includes('notes: item.notes || null')) {
  throw new Error('Transaction sanitization does not preserve itemKey/notes');
}

if (!txSrc.includes('quantity: itemData.quantity ?? 1')) {
  throw new Error('New assignments do not default quantity to 1');
}

console.log('ok');
