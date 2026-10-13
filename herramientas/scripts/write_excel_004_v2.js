const XLSX = require('xlsx');
const path = require('path');

const excelPath = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS.xlsx';
const wb = XLSX.readFile(excelPath);

// Actualizar los datos con información más detallada
const updatedData = [
  {
    "PROYECTO: 004 ESTANTERIAS": "FECHA",
    "__EMPTY": "CARACTERISTICAS",
    "__EMPTY_1": "DESCRIPCION DE MEJORA"
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "24/m/2026",
    "__EMPTY": "MÓDULO WMS",
    "__EMPTY_1": "1) Gestión de Ubicaciones Real-Time\n- Control total de estanterías, pasillos y niveles con sincronización instantánea.\n- Escaneo inteligente compatible con lectores de códigos de barras y QR.\n- Resolución de conflictos de concurrencia entre múltiples operarios.\n- 8 operaciones de inventario: ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, reubicar, enviarAlmacen, emptyShelf.\n- Ghost detection para evitar duplicaciones críticas.\n- Contiguity validation para posiciones múltiples."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "IA INTEGRADA",
    "__EMPTY_1": "2) Asistente de IA (Gemini)\n- Integración de modelos de lenguaje para asistencia en la toma de decisiones logísticas.\n- Localización de prompts de IA al español para mejora de usabilidad en planta.\n- Búsqueda semántica de mercancía para localización rápida de productos.\n- OCR multi-estrategia: Google Cloud Vision (premium) + Tesseract.js (fallback local).\n- Conteño de piezas con Claude Opus 4.8 de Anthropic.\n- Detección de nitidez en tiempo real y early exit al 72% de confianza."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "MOBILE OPTIMIZATION",
    "__EMPTY_1": "3) UX Móvil Industrial\n- Rediseño de menú de acciones móviles y optimización de teclados para terminales de mano.\n- Implementación de acciones en lote para movimientos de stock masivos.\n- Soporte offline completo con cola de 9 tipos de operaciones.\n- Cross-tab locking para evitar drain concurrente.\n- Sync bidireccional y resolución automática de conflictos.\n- Detección automática de kiosco vs navegador general."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "HARDWARE",
    "__EMPTY_1": "4) Equipamiento Industrial\n- Tablets industriales para kioscos y operarios móviles.\n- Lectores de código de barras y QR de alta precisión.\n- Soportes para carretillas y terminales de mano.\n- Sistema de notificaciones push con FCM.\n- Alertas urgentes con fallback modal para dispositivos offline.\n- Monitorización de conexiones en tiempo real.\n- NOTA: Segunda tanda de pistolas escáner DEVUELTA. Pendiente de solicitar 3 unidades adicionales iguales a las últimas y un soporte adicional para carretilla."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "COMUNICACIÓN",
    "__EMPTY_1": "5) Sistema de Comunicación Interna\n- Chat general con auto-cleanup y push notifications.\n- Conversaciones privadas con resolución de miembros.\n- Sistema de mensajes para administradores.\n- Cola de recogida para carretilleros.\n- Alertas urgentes con prioridad y sistema de fallback.\n- Monitorización de dispositivos con heartbeat."
  },
  {
    "PROYECTO: 004 ESTANTERIAS": "",
    "__EMPTY": "SEGURIDAD",
    "__EMPTY_1": "6) Sistema de Autenticación y Permisos\n- 8 roles de usuario: SUPERADMIN, ADMIN, JEFE_SECCION, CARRETILLERO, OPERARIO, CALIDAD, RECEPCIONES, SOLO_VISUAL.\n- Autenticación dual: Firebase Anonymous (kioscos) + Email/Password (registrados).\n- Permisos por sección con reglas de acceso cruzado.\n- Custom claims: role, section, validatedDevice.\n- 12 secciones de fabricación con reglas específicas."
  }
];

// Crear nueva hoja con los datos actualizados
const newWs = XLSX.utils.json_to_sheet(updatedData);

// Actualizar el libro
wb.Sheets['Deduccion'] = newWs;

// Guardar el archivo
XLSX.writeFile(wb, excelPath);

console.log('Archivo Excel v2.0 actualizado correctamente');