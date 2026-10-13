const fs = require('fs');
const path = require('path');

const expensesDir = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\GASTOS';

console.log('=== ANÁLISIS DE GASTOS DEL PROYECTO 004 ESTANTERIAS ===\n');

// Listar todos los archivos
const files = fs.readdirSync(expensesDir);

console.log('Archivos encontrados:');
files.forEach((file, index) => {
  const stats = fs.statSync(path.join(expensesDir, file));
  console.log(`${index + 1}. ${file}`);
  console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Modificado: ${stats.mtime ? stats.mtime.toLocaleDateString('es-ES') : 'Fecha no disponible'}`);
  console.log('');
});

// Análisis de nombres de archivos para extraer información
console.log('=== ANÁLISIS DE INFORMACIÓN ===\n');

const expenseAnalysis = files.map(file => {
  const info = {
    filename: file,
    type: 'DESCONOCIDO',
    date: null,
    source: 'DESCONOCIDO',
    amount: null,
    status: 'COMPRADO',
    category: 'HARDWARE'
  };

  // Detectar tipo de archivo
  if (file.includes('PISTOLA') || file.includes('ESCANER')) {
    info.type = 'PISTOLA ESCÁNER';
    info.category = 'HARDWARE - LECTORES';
  } else if (file.includes('TABLET')) {
    info.type = 'TABLET';
    info.category = 'HARDWARE - TABLETS';
  } else if (file.includes('FUNDA') || file.includes('PANTALLA')) {
    info.type = 'ACCESORIO TABLET';
    info.category = 'HARDWARE - ACCESORIOS';
  }

  // Detectar fecha
  const dateMatch = file.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (dateMatch) {
    info.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
  }

  // Detectar fuente/comprador
  if (file.includes('AMAZON')) {
    info.source = 'AMAZON';
  } else if (file.includes('ALIEXPRESS')) {
    info.source = 'ALIEXPRESS';
  } else if (file.includes('OSCAR')) {
    info.source = 'COMPRA OSCAR';
  }

  // Detectar estado
  if (file.includes('DEVOLVER')) {
    info.status = 'PARA DEVOLVER';
  }

  // Detectar cantidad
  const amountMatch = file.match(/(\d+[.,]\d{2})€/);
  if (amountMatch) {
    info.amount = parseFloat(amountMatch[1].replace(',', '.'));
  }

  return info;
});

// Mostrar análisis
console.log('Desglose de gastos:\n');
expenseAnalysis.forEach((expense, index) => {
  console.log(`${index + 1}. ${expense.type}`);
  console.log(`   Archivo: ${expense.filename}`);
  console.log(`   Fecha: ${expense.date || 'No especificada'}`);
  console.log(`   Fuente: ${expense.source}`);
  console.log(`   Categoría: ${expense.category}`);
  console.log(`   Estado: ${expense.status}`);
  if (expense.amount) {
    console.log(`   Importe: ${expense.amount}€`);
  }
  console.log('');
});

// Resumen por categorías
console.log('=== RESUMEN POR CATEGORÍAS ===\n');

const categories = {};
expenseAnalysis.forEach(expense => {
  if (!categories[expense.category]) {
    categories[expense.category] = [];
  }
  categories[expense.category].push(expense);
});

Object.keys(categories).forEach(category => {
  console.log(`${category}:`);
  categories[category].forEach(expense => {
    console.log(`  - ${expense.type} (${expense.status})`);
  });
  console.log('');
});

// Notas importantes
console.log('=== NOTAS IMPORTANTES ===\n');
console.log('1. SEGUNDA TANDA DE PISTOLAS: MARCADA PARA DEVOLVER');
console.log('2. FALTAN POR PEDIR: 3 PISTOLAS ADICIONALES IGUALES A LAS ÚLTIMAS');
console.log('3. FALTA POR PEDIR: SOPORTE ADICIONAL PARA CARRETILLA');
console.log('4. TODOS LOS GASTOS DEBEN INCLUIRSE EN LA JUSTIFICACIÓN FISCAL');