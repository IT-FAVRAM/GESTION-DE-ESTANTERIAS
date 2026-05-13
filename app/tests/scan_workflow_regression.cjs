const fs = require('fs');

const source = fs.readFileSync('web/legacy/AppLegacy.tsx', 'utf8');

if (source.includes('processScanInput: async (barcode: string, intent: any) => true')) {
  throw new Error('Stub processScanInput still present in AppLegacy.tsx');
}

if (!source.includes('processScanInput: processWorkflowScanInput')) {
  throw new Error('AppLegacy.tsx is not wired to real workflow scan handler');
}

console.log('ok');
