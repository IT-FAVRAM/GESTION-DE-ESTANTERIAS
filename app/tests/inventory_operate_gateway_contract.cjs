const fs = require('fs');

const fn = fs.readFileSync('functions/src/index.ts', 'utf8');
const client = fs.existsSync('web/lib/inventoryApi.ts') ? fs.readFileSync('web/lib/inventoryApi.ts', 'utf8') : '';

if (!fn.includes('inventoryOperate') || !fn.includes('shelfOperate')) throw new Error('Missing inventory callable exports');
if (!client.includes('httpsCallable') || !client.includes("'shelfOperate'")) throw new Error('Client gateway missing shelfOperate callable');

console.log('ok');
