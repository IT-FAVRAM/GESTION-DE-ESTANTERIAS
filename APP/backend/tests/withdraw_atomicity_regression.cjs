const fs = require('fs');

const hookSrc = fs.readFileSync('web/hooks/useInventoryOperations.ts', 'utf8');
const prodSrc = fs.readFileSync('web/lib/production.ts', 'utf8');

const blockStart = hookSrc.indexOf('const withdrawItem = useCallback');
const blockEnd = hookSrc.indexOf('const copyItem = useCallback');
const withdrawBlock = blockStart >= 0 && blockEnd > blockStart ? hookSrc.slice(blockStart, blockEnd) : '';

if (withdrawBlock.includes('moveToWorking(') || withdrawBlock.includes('removeItemTransaction(')) {
  throw new Error('Legacy non-atomic withdraw flow still present');
}

if (!withdrawBlock.includes('await withdrawToWorkingAtomic(barcode, orderId, location')) {
  throw new Error('withdrawItem is not using atomic helper');
}

if (!prodSrc.includes('export const withdrawToWorkingAtomic')) {
  throw new Error('Missing atomic withdraw helper in production module');
}

console.log('ok');
