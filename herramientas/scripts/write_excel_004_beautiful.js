const ExcelJS = require('exceljs');
const path = require('path');

async function createBeautifulExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Daniel Soler Perez';
  workbook.created = new Date();

  // ==========================================
  // COLORES PROFESIONALES
  // ==========================================
  const colors = {
    primary: '1F4E79',      // Azul oscuro profesional
    secondary: '2E75B6',    // Azul medio
    accent: '5B9BD5',       // Azul claro
    light: 'D6E4F0',        // Azul muy claro
    white: 'FFFFFF',
    black: '000000',
    gray: 'F2F2F2',
    darkGray: '404040',
    success: '70AD47',      // Verde
    headerBg: '1F4E79',     // Fondo azul oscuro
    rowAlt: 'F2F7FB',       // Fila alternativa
    border: 'B4C6E7'       // Borde azul claro
  };

  // ==========================================
  // HOJA 1: RESUMEN EJECUTIVO
  // ==========================================
  const ws1 = workbook.addWorksheet('Resumen Ejecutivo', {
    properties: { tabColor: { argb: colors.primary } },
    pageSetup: { orientation: 'landscape', fitToPage: true }
  });

  // Configurar anchos de columna
  ws1.columns = [
    { width: 35 },  // A
    { width: 50 },  // B
    { width: 20 },  // C
    { width: 35 },  // D
    { width: 25 },  // E
    { width: 55 }   // F
  ];

  // Fila 1: Titulo principal
  ws1.mergeCells('A1:F1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = 'DOSSIER RESUMEN DEL PROYECTO 004 ESTANTERIAS';
  titleCell.font = { bold: true, size: 18, color: { argb: colors.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 45;

  // Fila 2: Subtitulo
  ws1.mergeCells('A2:F2');
  const subtitleCell = ws1.getCell('A2');
  subtitleCell.value = 'Soporte para justificación de deducción por innovación tecnológica - Impuesto sobre Sociedades (España)';
  subtitleCell.font = { italic: true, size: 12, color: { argb: colors.darkGray } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 30;

  // Fila 3: Espaciado
  ws1.getRow(3).height = 15;

  // Fila 4: Seccion 1
  ws1.mergeCells('A4:F4');
  const section1Cell = ws1.getCell('A4');
  section1Cell.value = '1. FICHA IDENTIFICATIVA DEL PROYECTO';
  section1Cell.font = { bold: true, size: 14, color: { argb: colors.white } };
  section1Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.secondary } };
  section1Cell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws1.getRow(4).height = 35;

  // Filas de información
  const infoData = [
    ['Código de proyecto', '004 ESTANTERIAS', 'Ejercicio', '2026'],
    ['Denominación', 'Plataforma corporativa WMS para gestión de almacenes y control de inventario con IA', 'Área promotora', 'Dirección / Inversiones'],
    ['Estado', 'Desarrollado e implantado / GESTIÓN CONTINUA', 'Período estimado de desarrollo', 'ABRIL - JULIO 2026'],
    ['Responsable técnico', 'Daniel Soler Pérez', 'Dedicación estimada total', '480 horas aprox.'],
    ['Clasificación fiscal propuesta', 'Innovación Tecnológica - art. 35.2 LIS', '', '']
  ];

  let rowNum = 5;
  infoData.forEach((row, index) => {
    const currentRow = ws1.getRow(rowNum);
    currentRow.height = 25;
    
    // Columna A (etiqueta)
    const cellA = ws1.getCell(`A${rowNum}`);
    cellA.value = row[0];
    cellA.font = { bold: true, size: 11, color: { argb: colors.darkGray } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? colors.light : colors.white } };
    cellA.alignment = { vertical: 'middle', wrapText: true };
    cellA.border = {
      bottom: { style: 'thin', color: { argb: colors.border } }
    };

    // Columna B (valor)
    const cellB = ws1.getCell(`B${rowNum}`);
    cellB.value = row[1];
    cellB.font = { size: 11, color: { argb: colors.black } };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? colors.light : colors.white } };
    cellB.alignment = { vertical: 'middle', wrapText: true };
    cellB.border = {
      bottom: { style: 'thin', color: { argb: colors.border } }
    };

    // Columna C (etiqueta)
    const cellC = ws1.getCell(`C${rowNum}`);
    cellC.value = row[2];
    cellC.font = { bold: true, size: 11, color: { argb: colors.darkGray } };
    cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? colors.light : colors.white } };
    cellC.alignment = { vertical: 'middle', wrapText: true };
    cellC.border = {
      bottom: { style: 'thin', color: { argb: colors.border } }
    };

    // Columna D (valor)
    const cellD = ws1.getCell(`D${rowNum}`);
    cellD.value = row[3];
    cellD.font = { size: 11, color: { argb: colors.black } };
    cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? colors.light : colors.white } };
    cellD.alignment = { vertical: 'middle', wrapText: true };
    cellD.border = {
      bottom: { style: 'thin', color: { argb: colors.border } }
    };

    rowNum++;
  });

  // Espaciado
  rowNum++;
  ws1.getRow(rowNum).height = 15;
  rowNum++;

  // Fila: Seccion 2
  ws1.mergeCells(`A${rowNum}:F${rowNum}`);
  const section2Cell = ws1.getCell(`A${rowNum}`);
  section2Cell.value = '2. OBJETIVO Y ALCANCE';
  section2Cell.font = { bold: true, size: 14, color: { argb: colors.white } };
  section2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.secondary } };
  section2Cell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws1.getRow(rowNum).height = 35;
  rowNum++;

  // Objetivo principal
  const objectiveData = [
    ['Objetivo principal', 'Desarrollar una plataforma corporativa de gestión de almacenes (WMS) capaz de gestionar ubicaciones en tiempo real, escanear productos mediante códigos de barras y QR, proporcionar asistencia logística mediante inteligencia artificial y soportar operaciones offline en entornos industriales con conectividad limitada.'],
    ['Novedad tecnológica aplicada', 'El proyecto combina sincronización en tiempo real con Firebase, OCR multi-estrategia (Google Cloud Vision + Tesseract.js), conteo de piezas con IA (Claude Opus), sistema offline completo con cross-tab locking, 8 roles de usuario y 12 secciones de fabricación en una única plataforma operativa.'],
    ['Resultado empresarial perseguido', 'Disponer de una herramienta propia, segura y escalable que sustituye procesos dispersos, mejora el control de inventario, reduce errores de stock y facilita auditoría, explotación y gobierno del dato logístico en planta.']
  ];

  objectiveData.forEach((row, index) => {
    const currentRow = ws1.getRow(rowNum);
    currentRow.height = 45;
    
    // Columna A (etiqueta)
    const cellA = ws1.getCell(`A${rowNum}`);
    cellA.value = row[0];
    cellA.font = { bold: true, size: 11, color: { argb: colors.darkGray } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
    cellA.alignment = { vertical: 'middle', wrapText: true };
    cellA.border = {
      bottom: { style: 'thin', color: { argb: colors.border } }
    };

    // Columnas B-F (valor fusionado)
    ws1.mergeCells(`B${rowNum}:F${rowNum}`);
    const cellB = ws1.getCell(`B${rowNum}`);
    cellB.value = row[1];
    cellB.font = { size: 11, color: { argb: colors.black } };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.white } };
    cellB.alignment = { vertical: 'middle', wrapText: true };
    cellB.border = {
      bottom: { style: 'thin', color: { argb: colors.border } }
    };

    rowNum++;
  });

  // Espaciado
  rowNum++;
  ws1.getRow(rowNum).height = 15;
  rowNum++;

  // Fila: Seccion 3
  ws1.mergeCells(`A${rowNum}:F${rowNum}`);
  const section3Cell = ws1.getCell(`A${rowNum}`);
  section3Cell.value = '3. HITOS TÉCNICOS Y CONTRIBUCIÓN AL NEGOCIO';
  section3Cell.font = { bold: true, size: 14, color: { argb: colors.white } };
  section3Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.secondary } };
  section3Cell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws1.getRow(rowNum).height = 35;
  rowNum++;

  // Headers de la tabla
  const tableHeaders = ['Fecha / tramo', 'Bloque funcional', 'Descripción técnica', 'Impacto operativo', 'Riesgo resuelto', 'Estado'];
  const headerRow = ws1.getRow(rowNum);
  headerRow.height = 30;
  
  tableHeaders.forEach((header, index) => {
    const cell = ws1.getCell(`${String.fromCharCode(65 + index)}${rowNum}`);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: colors.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: colors.primary } },
      bottom: { style: 'medium', color: { argb: colors.primary } },
      left: { style: 'thin', color: { argb: colors.border } },
      right: { style: 'thin', color: { argb: colors.border } }
    };
  });
  rowNum++;

  // Datos de hitos
  const hitosData = [
    ['Q2 2026', 'Arquitectura base', 'Definición de frontend React + backend Firebase Cloud Functions + servicios de sincronización en tiempo real.', 'Unificación del proceso de gestión de almacenes en una sola plataforma.', 'Dependencia de procesos manuales y herramientas inconexas.', 'Completado'],
    ['Q2 2026', 'Motor de inventario', 'Implementación de 8 operaciones de inventario (ubicar, retirar, mover, reubicar, etc.) con transacciones multi-documento.', 'Permite gestionar todo el ciclo de vida de artículos desde ubicación hasta envío a almacén.', 'Errores de stock y duplicaciones críticas.', 'Completado'],
    ['Q2 2026', 'Sistema de escaneo y OCR', 'Desarrollo de pipeline multi-estrategia con Cloud Vision, Tesseract.js y parsing de hojas de ruta.', 'Identificación automática de productos mediante cámara con alta precisión.', 'Tiempos de búsqueda manuales elevados (15-20 min por artículo).', 'Completado'],
    ['Q2 2026', 'Sistema offline completo', 'Cola de 9 tipos de operaciones con cross-tab locking, sync bidireccional y resolución de conflictos.', 'Operatividad completa sin conexión en entornos industriales.', 'Pérdida de productividad por desconexiones.', 'Completado'],
    ['Q2 2026', 'Integración IA', 'OCR multi-estrategia + conteo de piezas con Claude Opus 4.8 de Anthropic.', 'Asistencia logística con búsqueda semántica y análisis visual.', 'Búsquedas manuales ineficientes.', 'Completado'],
    ['Q2 2026', 'Comunicación interna', 'Chat interno, push notifications, alertas urgentes y cola de recogida para carretilleros.', 'Mejora de coordinación entre operarios y respuesta a incidencias.', 'Falta de coordinación y sistemática de comunicación.', 'Completado'],
    ['Q2 2026', 'Sistema de seguridad', '8 roles de usuario con autenticación dual y permisos por sección.', 'Control granular de accesos adaptado a cada rol.', 'Riesgos de seguridad y acceso no controlado.', 'Completado']
  ];

  hitosData.forEach((row, index) => {
    const currentRow = ws1.getRow(rowNum);
    currentRow.height = 50;
    
    row.forEach((value, colIndex) => {
      const cell = ws1.getCell(`${String.fromCharCode(65 + colIndex)}${rowNum}`);
      cell.value = value;
      cell.font = { size: 10, color: { argb: colors.black } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? colors.rowAlt : colors.white } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: colors.border } },
        left: { style: 'thin', color: { argb: colors.border } },
        right: { style: 'thin', color: { argb: colors.border } }
      };

      // Formato especial para columna Estado
      if (colIndex === 5) {
        cell.font = { bold: true, size: 10, color: { argb: colors.success } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    
    rowNum++;
  });

  // ==========================================
  // HOJA 2: DEDICACION ESTIMADA
  // ==========================================
  const ws2 = workbook.addWorksheet('Dedicación Estimada', {
    properties: { tabColor: { argb: colors.secondary } },
    pageSetup: { orientation: 'landscape', fitToPage: true }
  });

  // Configurar anchos de columna
  ws2.columns = [
    { width: 10 },  // A
    { width: 35 },  // B
    { width: 18 },  // C
    { width: 12 },  // D
    { width: 65 },  // E
    { width: 25 }   // F
  ];

  // Fila 1: Titulo principal
  ws2.mergeCells('A1:F1');
  const titleCell2 = ws2.getCell('A1');
  titleCell2.value = 'ESTIMACIÓN DE DEDICACIÓN Y TRAZABILIDAD DEL DESARROLLO';
  titleCell2.font = { bold: true, size: 18, color: { argb: colors.white } };
  titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
  titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 45;

  // Fila 2: Subtitulo
  ws2.mergeCells('A2:F2');
  const subtitleCell2 = ws2.getCell('A2');
  subtitleCell2.value = 'Desglose orientativo de horas empleadas en la creación de la aplicación y su implantación operativa.';
  subtitleCell2.font = { italic: true, size: 12, color: { argb: colors.darkGray } };
  subtitleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
  subtitleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 30;

  // Fila 3: Espaciado
  ws2.getRow(3).height = 15;

  // Fila 4: Headers de la tabla
  const tableHeaders2 = ['Fase', 'Bloque', 'Horas estimadas', '% s/ total', 'Detalle de actividades', 'Naturaleza'];
  const headerRow2 = ws2.getRow(4);
  headerRow2.height = 30;
  
  tableHeaders2.forEach((header, index) => {
    const cell = ws2.getCell(`${String.fromCharCode(65 + index)}4`);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: colors.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: colors.primary } },
      bottom: { style: 'medium', color: { argb: colors.primary } },
      left: { style: 'thin', color: { argb: colors.border } },
      right: { style: 'thin', color: { argb: colors.border } }
    };
  });

  // Datos de dedicación
  const dedicacionData = [
    ['1', 'Análisis funcional y diseño', 48, 0.10, 'Definición de requisitos, alcance del sistema, mapa de procesos de gestión de almacenes e identificación de casuísticas de planta.', 'Ingeniería funcional'],
    ['2', 'Arquitectura y modelo de datos', 52, 0.11, 'Diseño técnico del frontend, backend Firebase, sincronización en tiempo real y estructura de datos para inventario, escaneo y reporting.', 'Ingeniería técnica'],
    ['3', 'Implementación del núcleo', 168, 0.35, 'Motor operativo, inventario (1.440 LOC), escaneo, offline, autenticación, 8 roles de usuario, 12 secciones de fabricación.', 'Desarrollo software'],
    ['4', 'Integración IA y comunicación', 72, 0.15, 'OCR multi-estrategia (Cloud Vision + Tesseract.js), conteo de piezas (Claude Opus), chat, notificaciones push.', 'Desarrollo software'],
    ['5', 'Pruebas, validación e implantación', 64, 0.13, 'Testing multi-dispositivo, correcciones, documentación y despliegue en entorno de producción.', 'QA / estabilización'],
    ['6', 'Hardware y equipamiento', 32, 0.07, 'Tablets industriales, lectores QR/barcode, soportes, configuración de dispositivos.', 'Infraestructura'],
    ['7', 'Documentación y soporte fiscal', 44, 0.09, 'Documentos justificativos, memoria técnica y soporte al asesor fiscal.', 'Implantación']
  ];

  let rowNum2 = 5;
  dedicacionData.forEach((row, index) => {
    const currentRow = ws2.getRow(rowNum2);
    currentRow.height = 40;
    
    row.forEach((value, colIndex) => {
      const cell = ws2.getCell(`${String.fromCharCode(65 + colIndex)}${rowNum2}`);
      cell.value = value;
      cell.font = { size: 10, color: { argb: colors.black } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? colors.rowAlt : colors.white } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: colors.border } },
        left: { style: 'thin', color: { argb: colors.border } },
        right: { style: 'thin', color: { argb: colors.border } }
      };

      // Formato especial para horas
      if (colIndex === 2) {
        cell.font = { bold: true, size: 11, color: { argb: colors.primary } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Formato especial para porcentaje
      if (colIndex === 3) {
        cell.numFmt = '0%';
        cell.font = { size: 10, color: { argb: colors.darkGray } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    
    rowNum2++;
  });

  // Fila de total
  ws2.getRow(rowNum2).height = 35;
  const totalRowData = ['', 'TOTAL ESTIMADO', 480, 1.00, '', ''];
  totalRowData.forEach((value, colIndex) => {
    const cell = ws2.getCell(`${String.fromCharCode(65 + colIndex)}${rowNum2}`);
    cell.value = value;
    cell.font = { bold: true, size: 12, color: { argb: colors.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: colors.primary } },
      bottom: { style: 'medium', color: { argb: colors.primary } },
      left: { style: 'thin', color: { argb: colors.border } },
      right: { style: 'thin', color: { argb: colors.border } }
    };

    // Formato especial para horas
    if (colIndex === 2) {
      cell.font = { bold: true, size: 14, color: { argb: colors.white } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Formato especial para porcentaje
    if (colIndex === 3) {
      cell.numFmt = '0%';
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // Espaciado
  rowNum2 += 2;

  // Fila de nota
  ws2.mergeCells(`A${rowNum2}:F${rowNum2}`);
  const noteCell = ws2.getCell(`A${rowNum2}`);
  noteCell.value = 'Nota: la dedicación se expresa como estimación técnica razonable a partir del alcance funcional desarrollado, la complejidad de integración y las tareas de estabilización realizadas en el proyecto.';
  noteCell.font = { italic: true, size: 10, color: { argb: colors.darkGray } };
  noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
  noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  ws2.getRow(rowNum2).height = 30;

  // ==========================================
  // HOJA 3: EVIDENCIAS Y VALOR
  // ==========================================
  const ws3 = workbook.addWorksheet('Evidencias y Valor', {
    properties: { tabColor: { argb: colors.success } },
    pageSetup: { orientation: 'landscape', fitToPage: true }
  });

  // Configurar anchos de columna
  ws3.columns = [
    { width: 35 },  // A
    { width: 60 },  // B
    { width: 55 },  // C
    { width: 15 }   // D
  ];

  // Fila 1: Titulo principal
  ws3.mergeCells('A1:D1');
  const titleCell3 = ws3.getCell('A1');
  titleCell3.value = 'EVIDENCIAS, ACTIVOS GENERADOS Y VALOR EMPRESARIAL';
  titleCell3.font = { bold: true, size: 18, color: { argb: colors.white } };
  titleCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
  titleCell3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 45;

  // Fila 2: Espaciado
  ws3.getRow(2).height = 15;

  // Fila 3: Headers de la tabla
  const tableHeaders3 = ['Activo / evidencia', 'Descripción', 'Contribución a la deducción', 'Estado'];
  const headerRow3 = ws3.getRow(3);
  headerRow3.height = 30;
  
  tableHeaders3.forEach((header, index) => {
    const cell = ws3.getCell(`${String.fromCharCode(65 + index)}3`);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: colors.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: colors.primary } },
      bottom: { style: 'medium', color: { argb: colors.primary } },
      left: { style: 'thin', color: { argb: colors.border } },
      right: { style: 'thin', color: { argb: colors.border } }
    };
  });

  // Datos de evidencias
  const evidenciasData = [
    ['Aplicación WMS corporativa', 'Frontend operativo con 157 componentes React para gestión integral de almacenes, escaneo, admin y reportes.', 'Materializa una mejora funcional interna mediante software propio no disponible como solución estándar adaptada.', 'Disponible'],
    ['Backend Cloud Functions', '31 funciones cloud con 4.868 líneas de lógica de negocio para inventario, notificaciones, IA y producción.', 'Aporta novedad subjetiva en la forma de conectar, validar y asegurar la consistencia del dato corporativo.', 'Disponible'],
    ['Motor de IA integrado', 'OCR multi-estrategia (Google Cloud Vision + Tesseract.js) y conteo de piezas con Claude Opus 4.8.', 'Genera capacidad analítica adicional y mejora sustancial de procesos internos mediante inteligencia artificial.', 'Disponible'],
    ['Sistema offline completo', 'Cola de 9 tipos de operaciones con cross-tab locking, sync bidireccional y resolución de conflictos.', 'Garantiza operatividad completa sin conexión en entornos industriales con conectividad limitada.', 'Disponible'],
    ['Sistema de seguridad', '8 roles de usuario con autenticación dual y permisos por sección con 12 secciones de fabricación.', 'Control granular de accesos adaptado a cada rol y sección de planta.', 'Disponible'],
    ['Sistema de comunicación', 'Chat interno, push notifications, alertas urgentes y cola de recogida para carretilleros.', 'Mejora de coordinación entre operarios y respuesta a incidencias.', 'Disponible'],
    ['Documentación justificativa', 'Memoria técnica, justificación fiscal y trazabilidad de dedicación estimada.', 'Facilita la acreditación del esfuerzo innovador y la racionalidad económica del proyecto.', 'Disponible']
  ];

  let rowNum3 = 4;
  evidenciasData.forEach((row, index) => {
    const currentRow = ws3.getRow(rowNum3);
    currentRow.height = 50;
    
    row.forEach((value, colIndex) => {
      const cell = ws3.getCell(`${String.fromCharCode(65 + colIndex)}${rowNum3}`);
      cell.value = value;
      cell.font = { size: 10, color: { argb: colors.black } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? colors.rowAlt : colors.white } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: colors.border } },
        left: { style: 'thin', color: { argb: colors.border } },
        right: { style: 'thin', color: { argb: colors.border } }
      };

      // Formato especial para columna Estado
      if (colIndex === 3) {
        cell.font = { bold: true, size: 10, color: { argb: colors.success } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    
    rowNum3++;
  });

  // Espaciado
  rowNum3++;
  ws3.getRow(rowNum3).height = 15;
  rowNum3++;

  // Fila de conclusion
  ws3.mergeCells(`A${rowNum3}:D${rowNum3}`);
  const conclusionCell = ws3.getCell(`A${rowNum3}`);
  conclusionCell.value = 'Conclusión ejecutiva: el proyecto 004 ESTANTERIAS constituye un desarrollo tecnológico interno orientado a mejorar de forma sustancial la gestión de almacenes, el control de inventario y la búsqueda asistida por IA, con una dedicación estimada de 480 horas y un resultado funcional ya implantado.';
  conclusionCell.font = { bold: true, size: 11, color: { argb: colors.darkGray } };
  conclusionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
  conclusionCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  ws3.getRow(rowNum3).height = 40;

  // ==========================================
  // GUARDAR ARCHIVO
  // ==========================================
  const excelPath = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS.xlsx';
  await workbook.xlsx.writeFile(excelPath);
  
  console.log('✅ Excel profesional creado correctamente');
  console.log('📊 Hojas: Resumen Ejecutivo, Dedicación Estimada, Evidencias y Valor');
  console.log('🎨 Formato: Colores profesionales, bordes, fusiones, fuentes optimizadas');
}

createBeautifulExcel().catch(console.error);