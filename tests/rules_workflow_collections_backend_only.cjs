const fs = require('fs');

const src = fs.readFileSync('firestore.rules', 'utf8');
if (!/match \/workingItems\/{itemId}[\s\S]*?allow write: if isAdmin\(\);/.test(src)) {
  throw new Error('workingItems is not restricted to admin write');
}
if (!/match \/finishedItems\/{itemId}[\s\S]*?allow write: if isAdmin\(\);/.test(src)) {
  throw new Error('finishedItems is not restricted to admin write');
}

console.log('ok');
