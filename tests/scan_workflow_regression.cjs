const fs = require('fs');

const source = fs.readFileSync('App.tsx', 'utf8');

if (source.includes('processScanInput: async (barcode: string, intent: any) => true')) {
  throw new Error('Stub processScanInput still present in App.tsx');
}

if (!source.includes('processScanInput: processWorkflowScanInput')) {
  throw new Error('App.tsx is not wired to real workflow scan handler');
}

console.log('ok');
