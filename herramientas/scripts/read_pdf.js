const fs = require('fs');
const path = require('path');

// Simple PDF text extraction (basic implementation)
function extractTextFromPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('latin1');
    
    // Extract text between BT and ET markers (PDF text objects)
    const textMatches = text.match(/BT[\s\S]*?ET/g);
    if (textMatches) {
      return textMatches.join('\n');
    }
    
    // Alternative: look for readable text
    const readableText = text.replace(/[^\x20-\x7E\n\r]/g, ' ');
    return readableText;
  } catch (error) {
    return `Error reading PDF: ${error.message}`;
  }
}

const expensesDir = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\GASTOS';

console.log('=== ANÁLISIS DE FACTURAS PDF ===\n');

const pdfFiles = fs.readdirSync(expensesDir).filter(file => file.endsWith('.pdf'));

pdfFiles.forEach((file, index) => {
  console.log(`${index + 1}. ${file}`);
  console.log('─'.repeat(80));
  
  const filePath = path.join(expensesDir, file);
  const text = extractTextFromPDF(filePath);
  
  // Show first 2000 characters
  console.log(text.substring(0, 2000));
  console.log('\n');
});