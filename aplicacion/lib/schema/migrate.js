const fs = require('fs');
const path = 'c:/-- APLICACIONES DANI --/APP -- ESTANTERIAS/app/web/lib/schema/shelves.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "locationCount: 53,",
  "locationCount: 65,"
);

content = content.replace(
  "{ name: 'PUNZONADORA', range: [33, 53], color: '#f59e0b' },",
  "{ name: 'PUNZONADORA', range: [33, 65], color: '#f59e0b' },"
);

const newBlock = `        {
          id: 'ple-punz-izq',
          title: 'Punzonadora Izquierda',
          subtitle: 'Estanteria 1 · 054-065',
          zoneName: 'PUNZONADORA',
          rows: [
            [54, 55, 56],
            [57, 58, 59],
            [60, 61, 62],
            [63, 64, 65],
            [null, null, null],
            [null, null, null],
            [null, null, null],
          ],
        },
`;
content = content.replace(
  "        {\n          id: 'ple-punz',",
  newBlock + "        {\n          id: 'ple-punz',"
).replace(
  "        {\r\n          id: 'ple-punz',",
  newBlock + "        {\r\n          id: 'ple-punz',"
);

// Comodín modifications
content = content.replace(
  "{ name: 'ESTANTERIA 2', range: [19, 32], color: '#f97316' },",
  "{ name: 'AUTOPLEGADO', range: [19, 32], color: '#f97316' },"
);

content = content.replace(
  "title: 'Comodín Est. 2',",
  "title: 'Autoplegado',"
);

content = content.replace(
  "zoneName: 'ESTANTERIA 2',",
  "zoneName: 'AUTOPLEGADO',"
);

fs.writeFileSync(path, content);
console.log("Migration successful");
