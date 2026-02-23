const fs = require('fs');

const src = fs.readFileSync('components/WorkingItemsList.tsx', 'utf8');

if (!src.includes('await locateItem(item, targetLocation')) {
  throw new Error('Finish and locate flow is not using locateItem');
}

const blockStart = src.indexOf('const handleFinishAndLocate');
const blockEnd = src.indexOf('const initializeLocateTarget');
const block = blockStart >= 0 && blockEnd > blockStart ? src.slice(blockStart, blockEnd) : '';

if (block.includes('finishItem(')) {
  throw new Error('Finish and locate still calls finishItem in WorkingItemsList');
}

console.log('ok');
