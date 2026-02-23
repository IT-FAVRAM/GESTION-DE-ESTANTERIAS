const fs = require('fs');

const fn = fs.readFileSync('functions/src/index.ts', 'utf8');
const client = fs.existsSync('lib/inventoryApi.ts') ? fs.readFileSync('lib/inventoryApi.ts', 'utf8') : '';

if (!fn.includes('export const inventoryOperate')) throw new Error('Missing inventoryOperate callable');
if (!client.includes('httpsCallable') || !client.includes('inventoryOperate')) throw new Error('Client gateway missing');

console.log('ok');
