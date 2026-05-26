const fs = require('fs');

const modalSrc = fs.readFileSync('web/components/AssignmentModal.tsx', 'utf8');

if (!modalSrc.includes('generateLayoutLocations(activeWarehouse)')) {
  throw new Error('AssignmentModal is not using centralized layout generation');
}

if (modalSrc.includes("if (activeWarehouse === 'MEC')") || modalSrc.includes("if (activeWarehouse === 'PLE')")) {
  throw new Error('AssignmentModal still contains warehouse-specific hardcoded layout branches');
}

console.log('ok');
