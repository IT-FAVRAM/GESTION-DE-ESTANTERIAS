const fs = require('fs');
const path = require('path');

const expensesDir = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\GASTOS';

console.log('Archivos de gastos:');
const files = fs.readdirSync(expensesDir);
files.forEach(file => {
  console.log(`- ${file}`);
});