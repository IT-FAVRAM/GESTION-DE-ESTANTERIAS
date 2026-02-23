const fs = require('fs');

const scannerSrc = fs.readFileSync('components/ValidationScanner.tsx', 'utf8');

if (!scannerSrc.includes('parseLocationFromText(scannedText, {}, { strict: true })')) {
  throw new Error('ValidationScanner is not using strict location parser');
}

if (scannerSrc.includes('matchesWarehouse && (matchesShelf || matchesShelfPad)')) {
  throw new Error('Legacy fuzzy validation logic still present');
}

const parserSrc = fs.readFileSync('lib/locationParser.ts', 'utf8');
if (!parserSrc.includes('if (matchedLocation && !isValidLayoutLocation(matchedLocation))')) {
  throw new Error('locationParser is not validating parsed location against layout');
}

console.log('ok');
