/**
 * Generador del Excel Maestro — WMS Gestor de Estanterías
 * Versión profesional con ExcelJS (colores, bordes, estilos)
 * Ejecutar: node generate-master-excel.cjs
 */
const ExcelJS = require('./frontend/node_modules/exceljs');
const path = require('path');

const wb = new ExcelJS.Workbook();
wb.creator = 'WMS Gestor de Estanterías';
wb.created = new Date();

// ─── PALETA DE COLORES ───────────────────────────────────────────────────────
const C = {
  navy:       '0F2A4A',
  blue:       '1E4D8C',
  teal:       '0D7C7C',
  green:      '155724',
  red:        '7B1C1C',
  amber:      '7B4D00',
  slate:      '2D3748',
  lightBlue:  'D6E4F5',
  lightGreen: 'D4EDDA',
  lightRed:   'F8D7DA',
  lightAmber: 'FFF3CD',
  lightGray:  'F2F4F7',
  white:      'FFFFFF',
  offWhite:   'FAFBFC',
  border:     'CBD5E0',
  headerBg:   'EBF2FA',
};

// ─── ESTILOS BASE ────────────────────────────────────────────────────────────
function solidFill(hex) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } }; }
function border(hex = C.border) {
  const s = { style: 'thin', color: { argb: 'FF' + hex } };
  return { top: s, left: s, bottom: s, right: s };
}
function borderBottom(hex = C.border) {
  return { bottom: { style: 'medium', color: { argb: 'FF' + hex } } };
}

function applyTitle(row, text, colSpan = 8) {
  const cell = row.getCell(1);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF' + C.white } };
  cell.fill = solidFill(C.navy);
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = border(C.navy);
  row.height = 40;
  // merge is done outside
}

function applySubtitle(row, text, colSpan = 8) {
  const cell = row.getCell(1);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 12, italic: true, color: { argb: 'FF' + C.lightBlue } };
  cell.fill = solidFill(C.blue);
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 24;
}

function applySection(row, text) {
  const cell = row.getCell(1);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF' + C.navy } };
  cell.fill = solidFill(C.lightBlue);
  cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + C.blue } } };
  row.height = 22;
}

function applyHeader(row, values) {
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + C.navy } };
    cell.fill = solidFill(C.headerBg);
    cell.border = border();
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 20;
}

function applyData(row, values, altRow = false) {
  const bg = altRow ? C.offWhite : C.white;
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v === undefined ? '' : v;
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF' + C.slate } };
    cell.fill = solidFill(bg);
    cell.border = border();
    cell.alignment = { vertical: 'top', wrapText: true };
  });
  row.height = 18;
}

function applyNote(row, text) {
  const cell = row.getCell(1);
  cell.value = '  ℹ  ' + text;
  cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF' + C.teal } };
  cell.fill = solidFill(C.offWhite);
  row.height = 16;
}

function applyBadge(cell, text, type = 'neutral') {
  const map = {
    yes:     { bg: C.lightGreen, fg: C.green },
    no:      { bg: C.lightRed,   fg: C.red },
    warn:    { bg: C.lightAmber, fg: C.amber },
    neutral: { bg: C.lightBlue,  fg: C.blue },
    info:    { bg: C.lightGray,  fg: C.slate },
  };
  const { bg, fg } = map[type] || map.neutral;
  cell.value = text;
  cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF' + fg } };
  cell.fill = solidFill(bg);
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = border(fg);
}

// ─── CONSTRUCTOR UNIVERSAL DE HOJAS ─────────────────────────────────────────
// sections: array de { type, ... }
// type: 'title' | 'subtitle' | 'section' | 'header' | 'data' | 'note' | 'blank' | 'badge-row'
function buildSheet(name, tabColor, colDefs, sections) {
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: 'FF' + tabColor } },
  });
  ws.columns = colDefs.map(d => ({ width: d.width || 20 }));

  let rowIdx = 0;

  for (const sec of sections) {
    rowIdx++;
    const row = ws.getRow(rowIdx);

    if (sec.type === 'title') {
      applyTitle(row, sec.text);
      const span = colDefs.length;
      ws.mergeCells(rowIdx, 1, rowIdx, span);
      row.height = 40;
    } else if (sec.type === 'subtitle') {
      applySubtitle(row, sec.text);
      ws.mergeCells(rowIdx, 1, rowIdx, colDefs.length);
    } else if (sec.type === 'section') {
      applySection(row, sec.text);
      ws.mergeCells(rowIdx, 1, rowIdx, colDefs.length);
    } else if (sec.type === 'header') {
      applyHeader(row, sec.values);
      ws.views = [{ state: 'frozen', ySplit: rowIdx }];
    } else if (sec.type === 'data') {
      applyData(row, sec.values, sec.alt);
      // optional badge overrides
      if (sec.badges) {
        sec.badges.forEach(({ col, type }) => {
          const cell = row.getCell(col);
          applyBadge(cell, cell.value, type);
        });
      }
    } else if (sec.type === 'note') {
      applyNote(row, sec.text);
      ws.mergeCells(rowIdx, 1, rowIdx, colDefs.length);
    } else if (sec.type === 'blank') {
      row.height = sec.height || 10;
    }

    row.commit();
  }

  return ws;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. PORTADA
// ════════════════════════════════════════════════════════════════════════════
const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

buildSheet('PORTADA', C.navy, [
  { width: 8 }, { width: 55 }, { width: 30 }, { width: 20 },
], [
  { type: 'title', text: 'WMS — GESTOR DE ESTANTERÍAS' },
  { type: 'subtitle', text: 'Excel Maestro de Referencia  ·  Documento vivo, regenerar con: node generate-master-excel.cjs' },
  { type: 'blank', height: 12 },
  { type: 'section', text: 'INFORMACIÓN GENERAL' },
  { type: 'data', values: ['Campo', 'Valor', '', ''] },
  { type: 'data', values: ['Fecha de generación', fechaHoy], alt: true },
  { type: 'data', values: ['Versión app', 'WMS v3.0'] },
  { type: 'data', values: ['URL producción', 'https://gestion-de-estanterias.web.app'], alt: true },
  { type: 'data', values: ['Proyecto Firebase', 'gestion-de-estanterias'] },
  { type: 'data', values: ['Email contacto', 'd.soler@favram.com'], alt: true },
  { type: 'blank', height: 12 },
  { type: 'section', text: 'ÍNDICE DE PESTAÑAS' },
  { type: 'header', values: ['Nº', 'Pestaña', 'Descripción'] },
  { type: 'data', values: ['01', 'PORTADA', 'Este documento — índice y datos generales'] },
  { type: 'data', values: ['02', 'PROYECTO', 'Descripción general, stack técnico, arquitectura'], alt: true },
  { type: 'data', values: ['03', 'ROLES', 'Roles de usuario, acceso, permisos y login'] },
  { type: 'data', values: ['04', 'FUNCIONALIDADES', 'Acciones disponibles por rol (ubicar, retirar, mover…)'], alt: true },
  { type: 'data', values: ['05', 'ESTANTERIAS', 'Todas las estanterías físicas con baldas y ubicaciones'] },
  { type: 'data', values: ['06', 'CARROS', 'Los 4 carros como estanterías móviles'], alt: true },
  { type: 'data', values: ['07', 'FIRESTORE', 'Colecciones Firestore y estructura de documentos'] },
  { type: 'data', values: ['08', 'CLOUD FUNCTIONS', 'Funciones backend, triggers y operaciones'], alt: true },
  { type: 'data', values: ['09', 'NOTIFICACIONES', 'Sistema de alertas push y condiciones de disparo'] },
  { type: 'data', values: ['10', 'MOVIL', 'Comportamiento responsive y diferencias de roles en móvil'], alt: true },
  { type: 'data', values: ['11', 'SEGURIDAD', 'Reglas de autorización por operación'] },
  { type: 'data', values: ['12', 'OCR ESCANER', 'Pipeline de captura de artículos: OCR, pistola, QR'], alt: true },
  { type: 'data', values: ['13', 'FLUJOS', 'Flujos principales paso a paso'] },
]);

// ════════════════════════════════════════════════════════════════════════════
// 2. PROYECTO
// ════════════════════════════════════════════════════════════════════════════
buildSheet('PROYECTO', C.blue, [
  { width: 28 }, { width: 50 }, { width: 30 },
], [
  { type: 'title', text: 'PROYECTO — Descripción General y Stack Técnico' },
  { type: 'subtitle', text: 'WMS Gestor de Estanterías v3.0 — Sistema de gestión de almacén en tiempo real' },
  { type: 'blank' },
  { type: 'section', text: 'DESCRIPCIÓN DEL PROYECTO' },
  { type: 'data', values: ['Nombre', 'WMS Gestor de Estanterías'] },
  { type: 'data', values: ['Versión', 'v3.0 (arquitectura Cloud Functions)'], alt: true },
  { type: 'data', values: ['Propósito', 'Sistema de gestión de almacén (WMS) para control de ubicaciones, movimientos y recogidas de artículos en estanterías físicas y carros móviles'] },
  { type: 'data', values: ['URL', 'https://gestion-de-estanterias.web.app'], alt: true },
  { type: 'data', values: ['Proyecto Firebase', 'gestion-de-estanterias'] },
  { type: 'data', values: ['Región Functions', 'europe-west1'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'STACK TÉCNICO — FRONTEND' },
  { type: 'header', values: ['Tecnología', 'Versión / Detalle', 'Rol en el proyecto'] },
  { type: 'data', values: ['React', '19.x', 'UI framework principal'] },
  { type: 'data', values: ['TypeScript', '5.x', 'Tipado estático'], alt: true },
  { type: 'data', values: ['Vite', '6.x', 'Build tool y dev server HMR'] },
  { type: 'data', values: ['Tailwind CSS', '3.x', 'Utility-first styling'], alt: true },
  { type: 'data', values: ['Zustand', 'latest', 'Estado global de la app'] },
  { type: 'data', values: ['Firebase SDK', 'v12.x (modular)', 'Auth, Firestore, Messaging'], alt: true },
  { type: 'data', values: ['Tesseract.js', 'latest', 'OCR en el navegador'] },
  { type: 'data', values: ['Playwright', 'latest', 'Tests de auditoría mobile'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'STACK TÉCNICO — BACKEND' },
  { type: 'header', values: ['Tecnología', 'Versión / Detalle', 'Rol en el proyecto'] },
  { type: 'data', values: ['Firebase Cloud Functions', 'v2, Node 18', 'Backend serverless 100%'] },
  { type: 'data', values: ['Firestore', 'NoSQL (tiempo real)', 'Base de datos principal'], alt: true },
  { type: 'data', values: ['Firebase Auth', 'Email/Password', 'Autenticación de usuarios'] },
  { type: 'data', values: ['Firebase Hosting', 'CDN global', 'Despliegue del frontend'], alt: true },
  { type: 'data', values: ['Firebase Cloud Messaging', 'FCM v1', 'Push notifications'] },
  { type: 'blank' },
  { type: 'section', text: 'ARQUITECTURA' },
  { type: 'data', values: ['Patrón', 'SPA (Single Page Application) + Backend-as-a-Service'] },
  { type: 'data', values: ['Operaciones escritura', 'SIEMPRE via Cloud Functions — nunca escritura directa desde cliente'], alt: true },
  { type: 'data', values: ['Lecturas', 'Directas desde Firestore (onSnapshot tiempo real)'] },
  { type: 'data', values: ['Autorización', 'Cloud Functions validan rol+sección antes de cualquier operación'], alt: true },
  { type: 'data', values: ['Transacciones', 'Todas las operaciones críticas usan Firestore transactions'] },
  { type: 'data', values: ['Offline', 'Service Worker + localStorage para auth cache + Firestore offline persistence'], alt: true },
]);

// ════════════════════════════════════════════════════════════════════════════
// 3. ROLES
// ════════════════════════════════════════════════════════════════════════════
buildSheet('ROLES', C.teal, [
  { width: 18 }, { width: 30 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 35 },
], [
  { type: 'title', text: 'ROLES — Usuarios, Acceso y Permisos' },
  { type: 'subtitle', text: 'Roles definidos en frontend/lib/schema/roles.ts' },
  { type: 'blank' },
  { type: 'section', text: 'TABLA DE ROLES' },
  { type: 'header', values: ['Rol', 'Nombre visible', 'Tipo de login', 'Sección asignada', 'Nivel de acceso', 'Descripción'] },
  { type: 'data', values: ['OPERARIO', 'KIOSKO', 'Quick Access (sin contraseña)', 'Una sección fija', 'Básico — solo su sección', 'Operario de sala asignado a una sección. Acceso rápido sin contraseña desde tablet/kiosk. Solo puede ubicar/retirar en su estantería asignada.'], badges: [{ col: 3, type: 'warn' }] },
  { type: 'data', values: ['CARRETILLERO', 'CARRETILLERO', 'Quick Access (sin contraseña)', 'Todas', 'Medio — todas las secciones + carros', 'Operario de almacén con acceso a todas las estanterías y a los 4 carros móviles. Puede mover artículos entre ubicaciones.'], alt: true, badges: [{ col: 3, type: 'warn' }] },
  { type: 'data', values: ['CALIDAD', 'CALIDAD', 'Email + Contraseña', 'Reprocesos (CAL-001…CAL-022)', 'Medio — solo zona calidad', 'Técnico de calidad. Login con credenciales en escritorio. En móvil SIEMPRE requiere email+contraseña (seguridad). Gestiona artículos en zona de reprocesos.'], badges: [{ col: 3, type: 'no' }] },
  { type: 'data', values: ['JEFE_SECCION', 'JEFE DE SECCIÓN', 'Email + Contraseña', 'Administrada', 'Alto — toda su sección', 'Jefe de una sección. Puede ver y gestionar todas las ubicaciones de su sección.'], alt: true, badges: [{ col: 3, type: 'no' }] },
  { type: 'data', values: ['ADMIN', 'ADMINISTRADOR', 'Email + Contraseña', 'Todas', 'Total', 'Acceso completo a todas las funciones. Puede ver toda la app, exportar datos, gestionar usuarios y configuración.'], badges: [{ col: 3, type: 'no' }] },
  { type: 'data', values: ['VISUALIZADOR', 'VISUALIZADOR', 'Email + Contraseña', 'Según config', 'Solo lectura', 'Acceso de solo lectura. Puede ver el estado de las estanterías pero no realizar operaciones.'], alt: true, badges: [{ col: 3, type: 'no' }] },
  { type: 'blank' },
  { type: 'section', text: 'GRUPOS DE ROLES' },
  { type: 'header', values: ['Grupo', 'Roles incluidos', 'Descripción'] },
  { type: 'data', values: ['AUTH_ROLES', 'CALIDAD, JEFE_SECCION, ADMIN, VISUALIZADOR', 'Requieren autenticación con email+contraseña. Nunca quick access.'] },
  { type: 'data', values: ['KIOSK_ROLES', 'OPERARIO, CARRETILLERO', 'Usan quick access sin contraseña desde dispositivos kiosk fijos o tablets.'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'COLECCIONES DE USUARIOS EN FIRESTORE' },
  { type: 'header', values: ['Colección', 'Descripción', 'Campos clave'] },
  { type: 'data', values: ['users', 'Usuarios con auth (email+pass)', 'uid, email, role, displayName, section, fcmTokens[]'] },
  { type: 'data', values: ['kiosks', 'Dispositivos kiosk (sin auth Firebase)', 'operarioId, role, assignedShelf, assignedSection, displayName'], alt: true },
  { type: 'note', text: 'Los operarios KIOSK no tienen cuenta Firebase Auth — se identifican por operarioId en la colección kiosks' },
]);

// ════════════════════════════════════════════════════════════════════════════
// 4. FUNCIONALIDADES
// ════════════════════════════════════════════════════════════════════════════
buildSheet('FUNCIONALIDADES', C.green, [
  { width: 22 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 40 },
], [
  { type: 'title', text: 'FUNCIONALIDADES — Acciones por Rol' },
  { type: 'subtitle', text: 'Qué puede hacer cada rol en el sistema' },
  { type: 'blank' },
  { type: 'header', values: ['Funcionalidad', 'OPERARIO', 'CARRETILLERO', 'CALIDAD', 'JEFE SEC.', 'ADMIN', 'VISUAL.', 'Descripción'] },
  { type: 'data', values: ['UBICAR artículo', 'SI (su sec.)', 'SI (todas)', 'SI (CAL)', 'SI', 'SI', 'NO', 'Colocar un artículo en una celda concreta de la estantería'], badges: [{ col: 2, type: 'yes' }, { col: 3, type: 'yes' }, { col: 4, type: 'yes' }, { col: 5, type: 'yes' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['RETIRAR artículo', 'SI (su sec.)', 'SI (todas)', 'SI (CAL)', 'SI', 'SI', 'NO', 'Sacar un artículo de su ubicación actual'], alt: true, badges: [{ col: 2, type: 'yes' }, { col: 3, type: 'yes' }, { col: 4, type: 'yes' }, { col: 5, type: 'yes' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['MOVER artículo', 'NO', 'SI', 'NO', 'SI', 'SI', 'NO', 'Mover artículo de una ubicación a otra en la misma o distinta estantería'], badges: [{ col: 2, type: 'no' }, { col: 3, type: 'yes' }, { col: 4, type: 'no' }, { col: 5, type: 'yes' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['Ver todas las secciones', 'NO', 'SI', 'NO', 'Propia', 'SI', 'Config.', 'Navegar por todas las estanterías del almacén'], alt: true, badges: [{ col: 2, type: 'no' }, { col: 3, type: 'yes' }, { col: 4, type: 'no' }, { col: 6, type: 'yes' }] },
  { type: 'data', values: ['Acceso a CARROS', 'NO', 'SI', 'NO', 'NO', 'SI', 'NO', 'Gestionar los 4 carros móviles como estanterías'], badges: [{ col: 2, type: 'no' }, { col: 3, type: 'yes' }, { col: 4, type: 'no' }, { col: 5, type: 'no' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['Cola de RECOGIDAS', 'NO', 'SI', 'NO', 'SI', 'SI', 'NO', 'Ver solicitudes de recogida pendientes con badge contador'], alt: true, badges: [{ col: 2, type: 'no' }, { col: 3, type: 'yes' }, { col: 4, type: 'no' }, { col: 5, type: 'yes' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['Reprocesos (importes/pzas)', 'NO', 'NO', 'SI', 'NO', 'SI', 'NO', 'Al ubicar en zonas CAL-001…CAL-022, solicita importe EUR y cantidad pzas'], badges: [{ col: 2, type: 'no' }, { col: 3, type: 'no' }, { col: 4, type: 'yes' }, { col: 5, type: 'no' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['Exportar Excel/datos', 'NO', 'NO', 'NO', 'Parcial', 'SI', 'NO', 'Descargar inventario en Excel'], alt: true, badges: [{ col: 2, type: 'no' }, { col: 3, type: 'no' }, { col: 4, type: 'no' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['Gestionar usuarios', 'NO', 'NO', 'NO', 'NO', 'SI', 'NO', 'Crear/editar/eliminar usuarios y kiosks'], badges: [{ col: 2, type: 'no' }, { col: 3, type: 'no' }, { col: 4, type: 'no' }, { col: 5, type: 'no' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['Notificaciones push', 'NO', 'SI', 'SI', 'SI', 'SI', 'NO', 'Recibir alertas de artículos estancados y operaciones urgentes'], alt: true, badges: [{ col: 2, type: 'no' }, { col: 3, type: 'yes' }, { col: 4, type: 'yes' }, { col: 5, type: 'yes' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'data', values: ['Dashboard conexiones', 'NO', 'NO', 'NO', 'NO', 'SI', 'NO', 'Monitor en tiempo real de conexiones de dispositivos'], badges: [{ col: 2, type: 'no' }, { col: 3, type: 'no' }, { col: 4, type: 'no' }, { col: 5, type: 'no' }, { col: 6, type: 'yes' }, { col: 7, type: 'no' }] },
  { type: 'blank' },
  { type: 'section', text: 'MÉTODOS DE ESCANEO DISPONIBLES' },
  { type: 'header', values: ['Método', 'Tecnología', 'Descripción', '', '', '', '', ''] },
  { type: 'data', values: ['Pistola / Teclado', 'Input text nativo', 'Escáner de código de barras USB o teclado. Input directo al campo.'] },
  { type: 'data', values: ['QR (cámara)', 'jsQR + getUserMedia', 'Lector QR con cámara del dispositivo. Decodifica en tiempo real.'], alt: true },
  { type: 'data', values: ['OCR (cámara)', 'Tesseract.js LSTM', 'Reconocimiento óptico de caracteres. Pipeline GPU con binarización Otsu, PSM 6, whitelist caracteres.'] },
]);

// ════════════════════════════════════════════════════════════════════════════
// 5. ESTANTERIAS
// ════════════════════════════════════════════════════════════════════════════
buildSheet('ESTANTERIAS', C.slate, [
  { width: 14 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 35 },
], [
  { type: 'title', text: 'ESTANTERIAS — Estructura Física del Almacén' },
  { type: 'subtitle', text: 'Definidas en frontend/lib/schema/shelves.ts — Secciones y baldas físicas' },
  { type: 'blank' },
  { type: 'section', text: 'SECCIONES DEL ALMACÉN' },
  { type: 'header', values: ['Sección', 'Código', 'Responsable', 'Nº Estanterías', 'Total Baldas', 'Total Celdas', 'Descripción'] },
  { type: 'data', values: ['SOLDADURA', 'SOL', 'OPERARIO + CARRETILLERO', '~10', 'Variable', 'Variable', 'Zona de soldadura. Acceso rápido por operarios asignados.'] },
  { type: 'data', values: ['CARPINTERÍA', 'CAR', 'OPERARIO + CARRETILLERO', '~8', 'Variable', 'Variable', 'Zona de carpintería.'], alt: true },
  { type: 'data', values: ['REPROCESOS', 'CAL', 'CALIDAD', '22 zonas', '3-4 por zona', '2 por balda', 'Zona de calidad. CAL-001 a CAL-022. Requiere importe EUR y cantidad pzas al ubicar.'] },
  { type: 'data', values: ['ALMACÉN GRAL.', 'ALM', 'CARRETILLERO', 'Variable', 'Variable', 'Variable', 'Almacén general. Solo accesible desde ALMACÉN button en CARRETILLERO.'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'ESTRUCTURA DE UNA CELDA' },
  { type: 'header', values: ['Campo', 'Ejemplo', 'Descripción', '', '', '', ''] },
  { type: 'data', values: ['shelfCode', 'CS-01', 'Código de la estantería (sección + número)'] },
  { type: 'data', values: ['block', 'A', 'Bloque físico dentro de la estantería (A, B, C…)'], alt: true },
  { type: 'data', values: ['row', '3', 'Balda (fila) dentro del bloque (1 = superior, N = inferior)'] },
  { type: 'data', values: ['col', '2', 'Columna/posición dentro de la balda'], alt: true },
  { type: 'data', values: ['cellId', 'CS-01-A-3-2', 'ID único de celda: shelfCode + block + row + col'] },
  { type: 'blank' },
  { type: 'section', text: 'ESTADOS DE CELDA' },
  { type: 'header', values: ['Estado', 'Color UI', 'Significado', '', '', '', ''] },
  { type: 'data', values: ['VACÍO', 'Verde claro', 'Celda sin artículo — disponible para ubicar'] },
  { type: 'data', values: ['OCUPADO', 'Azul/slate', 'Celda con artículo — referencia visible en la UI'], alt: true },
  { type: 'data', values: ['URGENTE', 'Rojo pulsante', 'Artículo urgente — máxima prioridad de recogida'] },
  { type: 'data', values: ['STALE', 'Ámbar', 'Artículo lleva más de 5 días sin movimiento — genera alerta'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'FORMATOS DE CÓDIGO DE ARTÍCULO' },
  { type: 'header', values: ['Formato', 'Ejemplo', 'Descripción', '', '', '', ''] },
  { type: 'data', values: ['Orden de Fabricación', 'OF25-07521', 'Formato más común. OF + año 2 dígitos + guión + número'] },
  { type: 'data', values: ['Referencia', 'REF-ABC123', 'Referencia directa de artículo'], alt: true },
  { type: 'data', values: ['Código libre', 'CUALQUIER-COD', 'Cualquier código alfanumérico aceptado por el sistema'] },
]);

// ════════════════════════════════════════════════════════════════════════════
// 6. CARROS
// ════════════════════════════════════════════════════════════════════════════
buildSheet('CARROS', C.green, [
  { width: 14 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 40 },
], [
  { type: 'title', text: 'CARROS — Estanterías Móviles' },
  { type: 'subtitle', text: 'Los 4 carros del almacén se gestionan como estanterías con baldas físicas' },
  { type: 'blank' },
  { type: 'section', text: 'DEFINICIÓN DE LOS 4 CARROS' },
  { type: 'header', values: ['Código', 'Nombre', 'Sección', 'Nº Baldas', 'Posiciones/Balda', 'Uso'] },
  { type: 'data', values: ['CS', 'Carro Soldadura', 'SOLDADURA', '4', '1', 'Carro de recogida en zona de soldadura. 4 baldas independientes.'] },
  { type: 'data', values: ['CP1', 'Carro Plegado 1', 'PLEGADORA', '4', '1', 'Carro de plegado 1. 4 baldas independientes.'] },
  { type: 'data', values: ['CP2', 'Carro Plegado 2', 'PLEGADORA', '4', '1', 'Carro de plegado 2. 4 baldas independientes.'] },
  { type: 'data', values: ['CRP', 'Carro Robot Plegado', 'AUTOPLEGADORA', '4', '1', 'Carro de robot plegado. 4 baldas independientes.'] },
  { type: 'blank' },
  { type: 'section', text: 'FUNCIONAMIENTO' },
  { type: 'data', values: ['Acceso', 'Solo desde la pestaña CARROS en la vista CARRETILLERO (y ADMIN)'] },
  { type: 'data', values: ['Selector', 'Barra horizontal con los 4 carros. Tap para seleccionar.'], alt: true },
  { type: 'data', values: ['Vista', 'ShelfNavigator bloqueado al carro seleccionado (prop shelfCode)'] },
  { type: 'data', values: ['Botón ALMACÉN', 'OCULTO en carros (solo visible en estanterías físicas). Grid 3 col en carros, 4 col en estanterías.'], alt: true },
  { type: 'data', values: ['Acciones', 'UBICAR / RETIRAR / MOVER — idéntico a estanterías físicas'] },
  { type: 'data', values: ['Backend', 'cartOperate Cloud Function — misma lógica que operaciones estantería'], alt: true },
  { type: 'blank' },
  { type: 'note', text: 'Cada balda es una posición independiente. Los carros NO tienen secciones — son entidades propias en Firestore.' },
]);

// ════════════════════════════════════════════════════════════════════════════
// 7. FIRESTORE
// ════════════════════════════════════════════════════════════════════════════
buildSheet('FIRESTORE', C.navy, [
  { width: 26 }, { width: 22 }, { width: 22 }, { width: 16 }, { width: 40 },
], [
  { type: 'title', text: 'FIRESTORE — Colecciones y Estructura de Datos' },
  { type: 'subtitle', text: 'Base de datos NoSQL en tiempo real. Escrituras SIEMPRE via Cloud Functions.' },
  { type: 'blank' },
  { type: 'section', text: 'COLECCIONES PRINCIPALES' },
  { type: 'header', values: ['Colección', 'Tipo de doc', 'Clave doc (ID)', 'TTL / Retención', 'Descripción'] },
  { type: 'data', values: ['locations/{shelfCode}', 'ShelfLocationState', 'shelfCode (ej: CS-01)', 'Permanente', 'Estado completo de una estantería. Contiene mapa de celdas con artículos.'] },
  { type: 'data', values: ['items/{articleCode}', 'ItemDoc / ItemAggregateDoc', 'Código artículo', 'Permanente', 'Artículo y su ubicación actual. shelfCode + block + row + col.'], alt: true },
  { type: 'data', values: ['users/{uid}', 'UserDoc', 'Firebase Auth UID', 'Permanente', 'Usuario autenticado. role, section, fcmTokens[], displayName.'] },
  { type: 'data', values: ['kiosks/{operarioId}', 'KioskDoc', 'operarioId (ej: K001)', 'Permanente', 'Dispositivo kiosk. role, assignedShelf, assignedSection, displayName.'], alt: true },
  { type: 'data', values: ['pickup_queue/{id}', 'PickupRequest', 'Auto-ID Firestore', '7 días / manual', 'Cola de solicitudes de recogida. status: pending|completed.'] },
  { type: 'data', values: ['app_config/main', 'AppConfig', 'Documento único "main"', 'Permanente', 'Config global. urgentLocations[], chiefMapping{}, notificationsEnabled.'], alt: true },
  { type: 'data', values: ['devices/{deviceId}', 'DeviceDoc', 'deviceId', 'Permanente', 'Dispositivos registrados. type: KIOSK|CARRETILLERO, fcmToken.'] },
  { type: 'data', values: ['conexion_estado/{id}', 'ConnectionState', 'deviceId', '24h', 'Estado conexión en tiempo real. online/offline, lastSeen.'], alt: true },
  { type: 'data', values: ['logs/{id}', 'LogEntry', 'Auto-ID', '30 días', 'Log de actividad. operationType, actor, timestamp, details.'] },
  { type: 'data', values: ['sections/{section}', 'SectionDoc', 'section code', 'Permanente', 'Metadata de sección. shelfCodes[], chiefId.'], alt: true },
  { type: 'data', values: ['notifications/{id}', 'NotificationDoc', 'Auto-ID', '7 días', 'Notificaciones enviadas. fcmMessageId, recipients[], type.'] },
  { type: 'blank' },
  { type: 'section', text: 'ESTRUCTURA: locations/{shelfCode}' },
  { type: 'header', values: ['Campo', 'Tipo', 'Ejemplo', '', 'Descripción'] },
  { type: 'data', values: ['shelfCode', 'string', 'CS-01', '', 'Código de la estantería'] },
  { type: 'data', values: ['cells', 'map<cellId, CellData>', '{A-1-1: {articleCode, ...}}', '', 'Mapa de todas las celdas con su contenido'], alt: true },
  { type: 'data', values: ['cells.{id}.articleCode', 'string | null', 'OF25-07521', '', 'Artículo en la celda. null = vacía.'] },
  { type: 'data', values: ['cells.{id}.placedAt', 'Timestamp', '2026-05-26T09:30:00Z', '', 'Cuándo se ubicó el artículo'], alt: true },
  { type: 'data', values: ['cells.{id}.placedBy', 'string', 'K001 / CS', '', 'Quién ubicó (operarioId o shelfCode de carro)'] },
  { type: 'data', values: ['cells.{id}.isUrgent', 'boolean', 'false', '', 'Si el artículo es urgente (rojo pulsante en UI)'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'REGLAS FIRESTORE (RESUMEN)' },
  { type: 'data', values: ['Lecturas locations', 'Permitidas a usuario autenticado (cualquier rol)', '', '', ''] },
  { type: 'data', values: ['Escrituras locations', 'DENEGADAS al cliente — solo Cloud Functions pueden escribir', '', '', ''], alt: true },
  { type: 'data', values: ['Lecturas kiosks', 'Permitidas públicamente (kiosks sin auth)', '', '', ''] },
  { type: 'data', values: ['Escrituras users', 'Solo el propio usuario o ADMIN', '', '', ''], alt: true },
]);

// ════════════════════════════════════════════════════════════════════════════
// 8. CLOUD FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════
buildSheet('CLOUD FUNCTIONS', C.blue, [
  { width: 26 }, { width: 18 }, { width: 22 }, { width: 14 }, { width: 40 },
], [
  { type: 'title', text: 'CLOUD FUNCTIONS — Backend Serverless' },
  { type: 'subtitle', text: 'Todas las operaciones de escritura pasan por aquí. Región: europe-west1' },
  { type: 'blank' },
  { type: 'section', text: 'FUNCIONES HTTPS CALLABLE (operaciones de usuario)' },
  { type: 'header', values: ['Función', 'Roles permitidos', 'Operación principal', 'Transacción', 'Descripción'] },
  { type: 'data', values: ['ubicar', 'OPERARIO, CARRETILLERO, CALIDAD, JEFE_SECCION, ADMIN', 'Colocar artículo en celda', 'SI', 'Valida actor+sección, verifica celda vacía, escribe en locations y en items. Si zona CAL, guarda importe+pzas.'] },
  { type: 'data', values: ['retirar', 'Todos (cada uno su sección)', 'Retirar artículo de celda', 'SI', 'Valida actor+sección, borra artículo de celda, actualiza items. Puede retirar varios a la vez (multi-select).'], alt: true },
  { type: 'data', values: ['mover', 'CARRETILLERO, JEFE_SECCION, ADMIN', 'Mover artículo entre celdas', 'SI', 'Operación atómica: retira de origen y ubica en destino en la misma transacción.'] },
  { type: 'data', values: ['retirarDeUbicacion', 'CARRETILLERO, ADMIN', 'Retirar desde ubicación por referencia', 'SI', 'Variante de retirar: busca el artículo por código y lo retira de donde esté.'], alt: true },
  { type: 'data', values: ['cartOperate', 'CARRETILLERO, ADMIN', 'Operar en carro (ubicar/retirar/mover)', 'SI', 'Equivalente de ubicar/retirar/mover pero para los 4 carros móviles (CS, CP1, CP2, CRP).'] },
  { type: 'data', values: ['updateReproceso', 'CALIDAD, ADMIN', 'Actualizar datos de reproceso', 'SI', 'Actualiza importe EUR y cantidad pzas de un artículo en zona de calidad.'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'FUNCIONES HTTPS CALLABLE (gestión)' },
  { type: 'header', values: ['Función', 'Roles permitidos', 'Operación principal', 'Transacción', 'Descripción'] },
  { type: 'data', values: ['createUser', 'ADMIN', 'Crear usuario Auth + doc Firestore', 'NO', 'Crea cuenta Firebase Auth + documento en users/. Asigna role y section.'] },
  { type: 'data', values: ['updateUser', 'ADMIN', 'Actualizar datos de usuario', 'NO', 'Edita displayName, role, section de un usuario.'], alt: true },
  { type: 'data', values: ['deleteUser', 'ADMIN', 'Eliminar usuario', 'NO', 'Borra Firebase Auth + documento users/.'] },
  { type: 'data', values: ['registerDevice', 'Auth requerida', 'Registrar dispositivo/FCM token', 'NO', 'Guarda FCM token del dispositivo para recibir push notifications.'], alt: true },
  { type: 'data', values: ['requestPickup', 'JEFE_SECCION, ADMIN', 'Crear solicitud de recogida', 'NO', 'Añade entrada a pickup_queue con artículos y prioridad.'] },
  { type: 'blank' },
  { type: 'section', text: 'FUNCIONES SCHEDULED (automáticas)' },
  { type: 'header', values: ['Función', 'Frecuencia', 'Operación principal', '', 'Descripción'] },
  { type: 'data', values: ['checkStaleItems', 'Diaria (cron)', 'Detectar artículos estancados', '', 'Recorre todas las celdas. Si artículo lleva >5 días: envía push notification a jefes de sección y admins.'] },
  { type: 'blank' },
  { type: 'section', text: 'AUTORIZACIÓN (backend/src/authz.ts)' },
  { type: 'data', values: ['assertActorMayOperateShelf', 'Verifica que el actor (user/kiosk) tenga permiso para operar en ese shelfCode según su sección asignada', '', '', ''] },
  { type: 'data', values: ['getUserContext', 'Resuelve el contexto completo del actor: uid, role, section, operarioId', '', '', ''], alt: true },
  { type: 'data', values: ['resolveOperationalActor', 'Para kiosks: obtiene el doc de la colección kiosks. Para users: obtiene el doc de users/', '', '', ''] },
]);

// ════════════════════════════════════════════════════════════════════════════
// 9. NOTIFICACIONES
// ════════════════════════════════════════════════════════════════════════════
buildSheet('NOTIFICACIONES', C.amber, [
  { width: 26 }, { width: 22 }, { width: 18 }, { width: 14 }, { width: 40 },
], [
  { type: 'title', text: 'NOTIFICACIONES — Sistema de Alertas Push' },
  { type: 'subtitle', text: 'Firebase Cloud Messaging (FCM v1). Tokens guardados en users.fcmTokens[] y devices.' },
  { type: 'blank' },
  { type: 'section', text: 'TIPOS DE NOTIFICACIÓN' },
  { type: 'header', values: ['Tipo', 'Disparador', 'Destinatarios', 'Prioridad', 'Descripción'] },
  { type: 'data', values: ['Artículo estancado', 'checkStaleItems (diaria)', 'JEFE_SECCION + ADMIN', 'Normal', 'Artículo lleva >5 días en la misma celda sin movimiento. Se envía una notif por artículo.'] },
  { type: 'data', values: ['Ubicación urgente', 'ubicar con isUrgent=true', 'CARRETILLERO + ADMIN', 'Alta', 'Se ubicó un artículo marcado como urgente. Requiere recogida inmediata.'], alt: true },
  { type: 'data', values: ['Solicitud de recogida', 'requestPickup', 'CARRETILLERO de la sección', 'Alta', 'Un jefe de sección ha creado una solicitud de recogida.'] },
  { type: 'blank' },
  { type: 'section', text: 'INFRAESTRUCTURA' },
  { type: 'data', values: ['Protocolo', 'FCM v1 HTTP API (OAuth2 Service Account)', '', '', ''] },
  { type: 'data', values: ['Service Worker', 'firebase-messaging-sw.js en public/', '', '', ''], alt: true },
  { type: 'data', values: ['Tokens', 'Se guardan en users.fcmTokens[] (array — múltiples dispositivos por usuario)', '', '', ''] },
  { type: 'data', values: ['Limpieza tokens', 'Tokens inválidos se eliminan automáticamente en el siguiente envío', '', '', ''], alt: true },
  { type: 'data', values: ['Permiso usuario', 'Se solicita en el primer login con auth (CALIDAD, ADMIN, JEFE_SECCION)', '', '', ''] },
]);

// ════════════════════════════════════════════════════════════════════════════
// 10. MOVIL
// ════════════════════════════════════════════════════════════════════════════
buildSheet('MOVIL', C.teal, [
  { width: 20 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 36 },
], [
  { type: 'title', text: 'MOVIL — Comportamiento Responsive' },
  { type: 'subtitle', text: 'Auditoría completada 2026-05-26: 20/20 PASS en iPhone 14 (390x844px)' },
  { type: 'blank' },
  { type: 'section', text: 'DIFERENCIAS DESKTOP vs MÓVIL' },
  { type: 'header', values: ['Aspecto', 'Desktop (>=768px)', 'Móvil (<768px)', 'Hook', 'Nota'] },
  { type: 'data', values: ['CALIDAD login', 'Quick access disponible', 'SIEMPRE email+contraseña', 'useFormFactor', 'Seguridad: no quick access en móvil para CALIDAD'] },
  { type: 'data', values: ['ADMIN login', 'Selector de rol visible', 'Email+contraseña en móvil', 'useFormFactor', ''], alt: true },
  { type: 'data', values: ['Botones KIOSK', '2 cols, h-32 (128px)', '2 cols, h-32 (128px)', 'Tailwind responsive', 'Touch-friendly: >44px mínimo'] },
  { type: 'data', values: ['Botones CARRETILLERO', 'h-11 (44px) flexible', 'h-11 (44px) flexible', 'Tailwind responsive', '~86px ancho en 390px'], alt: true },
  { type: 'data', values: ['Scroll vertical', 'overflow-y-auto en grid', 'overflow-y-auto en grid', 'flex-shrink-0 wrappers', 'Tabs/status/search con flex-shrink-0 para que el grid tome el espacio restante'] },
  { type: 'blank' },
  { type: 'section', text: 'LAYOUT RESPONSIVO — NAVIGATOR' },
  { type: 'data', values: ['Estructura flex', 'flex-col h-full — columna vertical con altura completa', '', '', ''] },
  { type: 'data', values: ['Elementos fijos', 'Tabs + Status + SearchBar + Feedback: flex-shrink-0', '', '', ''], alt: true },
  { type: 'data', values: ['Grid scrollable', 'flex-1 min-h-0 overflow-y-auto — toma el espacio restante', '', '', ''] },
  { type: 'data', values: ['Botones acción', 'flex-shrink-0 en la parte inferior', '', '', ''], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'RESULTADOS AUDITORÍA MOBILE (20/20)' },
  { type: 'header', values: ['Rol', 'Tests', 'Resultado', '', 'Detalle'] },
  { type: 'data', values: ['KIOSK (OPERARIO)', '4', 'PASS 4/4', '', 'Login quick access, botones touch-friendly, RETIRAR overlay, UBICAR ScanMethodPicker (3 métodos)'] },
  { type: 'data', values: ['CARRETILLERO', '12', 'PASS 12/12', '', '3 tabs visibles, botones UBICAR/RETIRAR/MOVER, CARROS tab con 4 carros como baldas, navegación sin problemas'], alt: true },
  { type: 'data', values: ['CALIDAD', '3', 'PASS 3/3', '', 'Móvil muestra email login (diseño intencional). Form con email+pass, botón volver.'] },
  { type: 'data', values: ['ADMIN', '2', 'PASS 2/2', '', 'Login y selección de rol accesibles en móvil'], alt: true },
  { type: 'note', text: 'Script de auditoría: audit-mobile.cjs (Playwright headless, emulación iPhone 14). Eliminado del repo tras verificación.' },
]);

// ════════════════════════════════════════════════════════════════════════════
// 11. SEGURIDAD
// ════════════════════════════════════════════════════════════════════════════
buildSheet('SEGURIDAD', C.red, [
  { width: 24 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 36 },
], [
  { type: 'title', text: 'SEGURIDAD — Autorizacion y Acceso' },
  { type: 'subtitle', text: 'Autorización en backend (Cloud Functions). Reglas Firestore como segunda capa.' },
  { type: 'blank' },
  { type: 'section', text: 'CAPAS DE SEGURIDAD' },
  { type: 'data', values: ['Capa 1 — Cloud Functions', 'assertActorMayOperateShelf(): valida role + sección antes de cualquier escritura', '', '', ''] },
  { type: 'data', values: ['Capa 2 — Firestore Rules', 'Escrituras a locations/ bloqueadas desde cliente. Solo Functions Admin SDK puede escribir.', '', '', ''], alt: true },
  { type: 'data', values: ['Capa 3 — Frontend', 'UI oculta opciones no permitidas según rol (defensa en profundidad, no única capa)', '', '', ''] },
  { type: 'blank' },
  { type: 'section', text: 'AUTORIZACION POR OPERACION' },
  { type: 'header', values: ['Operación', 'Condición de acceso', 'Validación adicional', '', 'Qué pasa si falla'] },
  { type: 'data', values: ['ubicar', 'rol en [OPERARIO, CARRETILLERO, CALIDAD, JEFE_SECCION, ADMIN]', 'actor.section === shelf.section (o ADMIN/CARRETILLERO bypass)', '', 'Error 403: "No autorizado para operar en esta sección"'] },
  { type: 'data', values: ['retirar', 'Mismo que ubicar', 'Celda debe tener artículo (no vacía)', '', 'Error 404: "Celda vacía"'], alt: true },
  { type: 'data', values: ['mover', 'CARRETILLERO, JEFE_SECCION, ADMIN', 'Origen y destino en secciones permitidas', '', 'Error 403'] },
  { type: 'data', values: ['cartOperate', 'CARRETILLERO, ADMIN', 'shelfCode debe ser CS/CP1/CP2/CRP', '', 'Error 403'], alt: true },
  { type: 'data', values: ['updateReproceso', 'CALIDAD, ADMIN', 'shelfCode debe ser CAL-xxx', '', 'Error 403'] },
  { type: 'data', values: ['createUser', 'ADMIN únicamente', 'Verifica custom claim en Firebase Auth token', '', 'Error 403'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'KIOSKS — AUTORIZACION SIN AUTH' },
  { type: 'data', values: ['Identificación', 'operarioId en el body de la request (no Firebase Auth token)', '', '', ''] },
  { type: 'data', values: ['Lookup', 'Cloud Function busca kiosks/{operarioId} y verifica que existe y tiene rol válido', '', '', ''], alt: true },
  { type: 'data', values: ['Restricción', 'OPERARIO solo puede operar en su assignedShelf. CARRETILLERO puede operar en todo.', '', '', ''] },
  { type: 'note', text: 'IMPORTANTE: Los kiosks no tienen Firebase Auth token. La verificación se basa en el ID de operario y el documento Firestore.' },
]);

// ════════════════════════════════════════════════════════════════════════════
// 12. OCR ESCANER
// ════════════════════════════════════════════════════════════════════════════
buildSheet('OCR ESCANER', C.teal, [
  { width: 26 }, { width: 40 }, { width: 16 }, { width: 28 },
], [
  { type: 'title', text: 'OCR / ESCANER — Pipeline de Captura de Articulos' },
  { type: 'subtitle', text: 'Tres métodos de entrada: Pistola/Teclado, QR (cámara), OCR (cámara + Tesseract.js)' },
  { type: 'blank' },
  { type: 'section', text: 'MÉTODO 1 — PISTOLA / TECLADO' },
  { type: 'data', values: ['Input', 'Campo de texto nativo (input[type=text])', 'Tecnología', 'HTML nativo'] },
  { type: 'data', values: ['Activación', 'El escáner USB actúa como teclado. Introduce código y pulsa Enter.', '', ''], alt: true },
  { type: 'data', values: ['Ventajas', 'Más rápido, sin latencia, funciona offline', '', ''] },
  { type: 'blank' },
  { type: 'section', text: 'MÉTODO 2 — QR (CÁMARA)' },
  { type: 'data', values: ['Tecnología', 'jsQR + getUserMedia API', '', ''] },
  { type: 'data', values: ['Proceso', 'Captura frame de video → jsQR decodifica en tiempo real (30fps) → devuelve string', '', ''], alt: true },
  { type: 'data', values: ['Soporte', 'QR Code estándar (ISO 18004). No EAN/Code128 en este método — usar pistola para esos.', '', ''] },
  { type: 'blank' },
  { type: 'section', text: 'MÉTODO 3 — OCR (CÁMARA + TESSERACT.JS)' },
  { type: 'header', values: ['Parámetro', 'Valor', 'Alternativa considerada', 'Por qué esta config'] },
  { type: 'data', values: ['Motor', 'Tesseract.js LSTM (OEM 1)', 'OEM 0 (Legacy)', 'LSTM más preciso con texto mezclado'] },
  { type: 'data', values: ['PSM', 'PSM 6 (SINGLE_BLOCK)', 'PSM 3 (auto)', 'Más estable para texto en una línea'], alt: true },
  { type: 'data', values: ['Idioma', 'eng únicamente', 'spa+eng', 'Reduce falsos positivos en códigos alfanuméricos'] },
  { type: 'data', values: ['Whitelist', '0-9 A-Z - /', 'Ninguna', 'Filtra caracteres imposibles en códigos de OF'] },
  { type: 'data', values: ['Pre-proceso imagen', 'Grayscale + contrast via CSS filter', 'Canvas manual', 'GPU-acelerado, más rápido'], alt: true },
  { type: 'data', values: ['Binarización', "Otsu's method (threshold true 0|255)", 'JPEG compresión', 'Elimina ruido de fondo, mejora precisión'] },
  { type: 'data', values: ['Formato salida', 'PNG lossless', 'JPEG 0.9', 'Sin artefactos de compresión que confunden OCR'], alt: true },
  { type: 'data', values: ['Worker', 'Singleton a nivel de módulo (reutilizado entre scans)', 'Nuevo worker por scan', 'Evita cold-start de 2-3s en cada scan'] },
  { type: 'blank' },
  { type: 'section', text: 'CORRECCIONES POST-OCR' },
  { type: 'data', values: ['Prefijo OF', 'Se añade "OF" si falta. "25-07521" → "OF25-07521"', '', ''] },
  { type: 'data', values: ['Normalización', '.toUpperCase() + trim()', '', ''], alt: true },
  { type: 'data', values: ['Regla eliminada', 'ELIMINADA: dígito-5-dígito → S (corrompía OF25-07521 → OF25-07S21)', '', ''] },
]);

// ════════════════════════════════════════════════════════════════════════════
// 13. FLUJOS
// ════════════════════════════════════════════════════════════════════════════
buildSheet('FLUJOS', C.navy, [
  { width: 6 }, { width: 28 }, { width: 40 }, { width: 30 },
], [
  { type: 'title', text: 'FLUJOS — Procesos Principales Paso a Paso' },
  { type: 'subtitle', text: 'Los flujos más importantes del sistema, documentados para referencia rápida' },
  { type: 'blank' },
  { type: 'section', text: 'FLUJO A — UBICAR ARTÍCULO (OPERARIO / KIOSK)' },
  { type: 'header', values: ['Paso', 'Acción usuario', 'Qué hace el sistema', 'Firestore afectado'] },
  { type: 'data', values: ['1', 'Tap en botón UBICAR', 'Abre ScanMethodPicker (Pistola/QR/OCR)', '—'] },
  { type: 'data', values: ['2', 'Escanea o teclea código artículo', 'Valida formato (OF / alfanumérico)', '—'], alt: true },
  { type: 'data', values: ['3', 'Tap en celda vacía de la estantería', 'Resalta la celda seleccionada', '—'] },
  { type: 'data', values: ['4', 'Confirma ubicación', 'Llama Cloud Function "ubicar"', 'locations/{shelfCode}'] },
  { type: 'data', values: ['5', '—', 'CF valida actor+sección. Si OK: escribe en locations y actualiza items/', 'locations + items'], alt: true },
  { type: 'data', values: ['6', '—', 'UI actualiza en tiempo real via onSnapshot', '—'] },
  { type: 'blank' },
  { type: 'section', text: 'FLUJO B — RETIRAR ARTÍCULO (MULTI-SELECT)' },
  { type: 'header', values: ['Paso', 'Acción usuario', 'Qué hace el sistema', 'Firestore afectado'] },
  { type: 'data', values: ['1', 'Tap en botón RETIRAR', 'Abre grid visual de la estantería en modo selección', '—'] },
  { type: 'data', values: ['2', 'Tap en celdas ocupadas a retirar', 'Selecciona múltiples celdas (multi-select)', '—'], alt: true },
  { type: 'data', values: ['3', 'Confirma', 'Llama Cloud Function "retirar" con lista de celdas', 'locations/{shelfCode}'] },
  { type: 'data', values: ['4', '—', 'CF itera celdas, valida cada una y elimina artículos', 'locations + items'], alt: true },
  { type: 'data', values: ['5', 'Dialog "¿Retirar más?"', 'Ofrece seguir retirando o terminar', '—'] },
  { type: 'blank' },
  { type: 'section', text: 'FLUJO C — MOVER ARTÍCULO (CARRETILLERO)' },
  { type: 'header', values: ['Paso', 'Acción usuario', 'Qué hace el sistema', 'Firestore afectado'] },
  { type: 'data', values: ['1', 'Tap en botón MOVER', 'Activa modo selección origen', '—'] },
  { type: 'data', values: ['2', 'Tap en celda origen (ocupada)', 'Muestra artículo seleccionado, pide destino', '—'], alt: true },
  { type: 'data', values: ['3', 'Navega a destino (puede cambiar estantería)', 'Mantiene origen en memoria de estado', '—'] },
  { type: 'data', values: ['4', 'Tap en celda destino (vacía)', 'Llama Cloud Function "mover"', 'locations x2'], alt: true },
  { type: 'data', values: ['5', '—', 'CF: retira de origen y ubica en destino en transacción atómica', 'locations + items'] },
  { type: 'blank' },
  { type: 'section', text: 'FLUJO D — LOGIN KIOSK (SIN CONTRASEÑA)' },
  { type: 'header', values: ['Paso', 'Acción usuario', 'Qué hace el sistema', 'Firestore afectado'] },
  { type: 'data', values: ['1', 'Abre la app en el tablet/kiosk', 'Muestra cards de quick access', '—'] },
  { type: 'data', values: ['2', 'Tap en su card (ej: "KIOSKO A")', 'Busca kiosks/{operarioId} en Firestore', 'kiosks'], alt: true },
  { type: 'data', values: ['3', '—', 'Carga assignedShelf y assignedSection del documento', '—'] },
  { type: 'data', values: ['4', '—', 'Muestra la estantería asignada con botones UBICAR/RETIRAR', '—'], alt: true },
  { type: 'blank' },
  { type: 'section', text: 'FLUJO E — REPROCESO (CALIDAD)' },
  { type: 'header', values: ['Paso', 'Acción usuario', 'Qué hace el sistema', 'Firestore afectado'] },
  { type: 'data', values: ['1', 'Tap en UBICAR en zona CAL-xxx', 'Abre ScanMethodPicker', '—'] },
  { type: 'data', values: ['2', 'Escanea artículo', 'Detecta que destino es zona CAL', '—'], alt: true },
  { type: 'data', values: ['3', 'Tap en celda de zona calidad', 'Abre modal adicional de reproceso', '—'] },
  { type: 'data', values: ['4', 'Introduce importe EUR y cantidad pzas (opcional)', 'Incluye datos en la llamada a "ubicar"', 'locations + items'], alt: true },
  { type: 'data', values: ['5', '—', 'CF guarda importe y pzas junto con el artículo en la celda', 'locations/{CAL-xxx}'] },
]);

// ─── GUARDAR FICHERO ─────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, 'WMS_MAESTRO.xlsx');
wb.xlsx.writeFile(outputPath).then(() => {
  console.log('');
  console.log('✅ Excel generado correctamente:');
  console.log('   ' + outputPath);
  console.log('');
  console.log('   13 hojas con formato profesional:');
  console.log('   PORTADA · PROYECTO · ROLES · FUNCIONALIDADES · ESTANTERIAS');
  console.log('   CARROS · FIRESTORE · CLOUD FUNCTIONS · NOTIFICACIONES');
  console.log('   MOVIL · SEGURIDAD · OCR ESCANER · FLUJOS');
  console.log('');
}).catch(err => {
  console.error('❌ Error al generar el Excel:', err.message);
  process.exit(1);
});
