const fs = require('fs');

const src = fs.readFileSync(require('path').join(__dirname, '../../config/firestore.rules'), 'utf8');
if (!/match \/shelves\/\{shelfCode\}\s*\{[\s\S]*?allow write: if false;/.test(src)) {
  throw new Error('shelves collection no longer routes writes through backend-only gate');
}
if (!/match \/history\/\{document=\*\*\}[\s\S]*?allow write: if false;/.test(src)) {
  throw new Error('history collection no longer routes writes through backend-only gate');
}

console.log('ok');
