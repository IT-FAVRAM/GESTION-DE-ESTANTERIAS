const XLSX = require('xlsx');
const path = require('path');

const excelPath = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\001 PRESENCIA.xlsx';
const wb = XLSX.readFile(excelPath);

console.log('Hojas en el archivo Excel 001:');
console.log(wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  console.log(`\n=== Hoja: ${sheetName} ===`);
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws);
  console.log(JSON.stringify(data, null, 2));
  
  // Also show the range
  console.log('\nRango de la hoja:', ws['!ref']);
  
  // Show column widths if they exist
  if (ws['!cols']) {
    console.log('Anchos de columna:', ws['!cols']);
  }
});