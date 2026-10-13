const XLSX = require('xlsx');
const path = require('path');

const excelPath = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS.xlsx';
const wb = XLSX.readFile(excelPath);

const ws = wb.Sheets['Deduccion'];
const data = XLSX.utils.sheet_to_json(ws);

console.log('Datos actuales del Excel:');
console.log(JSON.stringify(data, null, 2));

// Actualizar los datos
const updatedData = [
  {
    "PROYECTO: 004 ESTANTERIAS": "FECHA",
    "__EMPTY": "CARACTERISTICAS",
    "__EMPTY_1": "DESCRIPCION DE MEJORA"
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "24/m/2026",
    "__EMPTY": "MÓDULO WMS",
    "__EMPTY_1": "1) Gestión de Ubicaciones Real-Time\n- Control total de estanterías, pasillos y niveles con sincronización instantánea.\n- Escaneo inteligente compatible con lectores de códigos de barras y QR.\n- Resolución de conflictos de concurrencia entre múltiples operarios."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "IA INTEGRADA",
    "__EMPTY_1": "2) Asistente de IA (Gemini)\n- Integración de modelos de lenguaje para asistencia en la toma de decisiones logísticas.\n- Localización de prompts de IA al español para mejora de usabilidad en planta.\n- Búsqueda semántica de mercancía para localización rápida de productos."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "MOBILE OPTIMIZATION",
    "__EMPTY_1": "3) UX Móvil Industrial\n- Rediseño de menú de acciones móviles y optimización de teclados para terminales de mano.\n- Implementación de acciones en lote para movimientos de stock masivos.\n- Soporte offline con sincronización posterior."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "HARDWARE",
    "__EMPTY_1": "4) Equipamiento Industrial\n- Tablets industriales para kioscos y operarios móviles.\n- Lectores de código de barras y QR de alta precisión.\n- Soportes para carretillas y terminales de mano.\n- NOTA: Segunda tanda de pistolas escáner DEVUELTA. Pendiente de solicitar 3 unidades adicionales iguales a las últimas y un soporte adicional para carretilla."
  }
];

// Crear nueva hoja con los datos actualizados
const newWs = XLSX.utils.json_to_sheet(updatedData);

// Actualizar el libro
wb.Sheets['Deduccion'] = newWs;

// Guardar el archivo
XLSX.writeFile(wb, excelPath);

console.log('Archivo Excel actualizado correctamente');