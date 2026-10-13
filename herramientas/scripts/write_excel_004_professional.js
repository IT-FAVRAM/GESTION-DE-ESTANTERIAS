const XLSX = require('xlsx');
const path = require('path');

// Crear nuevo libro de trabajo
const wb = XLSX.utils.book_new();

// ==========================================
// HOJA 1: RESUMEN EJECUTIVO
// ==========================================
const resumenData = [
  ["DOSSIER RESUMEN DEL PROYECTO 004 ESTANTERIAS", "", "", "", "", ""],
  ["Soporte para justificacion de deduccion por innovacion tecnologica - Impuesto sobre Sociedades (Espana)", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["1. FICHA IDENTIFICATIVA DEL PROYECTO", "", "", "", "", ""],
  ["Codigo de proyecto", "004 ESTANTERIAS", "", "Ejercicio", "2026", ""],
  ["Denominacion", "Plataforma corporativa WMS para gestion de almacenes y control de inventario con IA", "", "Area promotora", "Direccion / Inversiones", ""],
  ["Estado", "Desarrollado e implantado / GESTION CONTINUA", "", "Periodo estimado de desarrollo", "ABRIL - JULIO 2026", ""],
  ["Responsable tecnico", "Daniel Soler Perez", "", "Dedicacion estimada total", "480 horas aprox.", ""],
  ["Clasificacion fiscal propuesta", "Innovacion Tecnologica - art. 35.2 LIS", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["2. OBJETIVO Y ALCANCE", "", "", "", "", ""],
  ["Objetivo principal", "", "", "", "", "Desarrollar una plataforma corporativa de gestion de almacenes (WMS) capaz de gestionar ubicaciones en tiempo real, escanear productos mediante codigos de barras y QR, proporcionar asistencia logistica mediante inteligencia artificial y soportar operaciones offline en entornos industriales con conectividad limitada."],
  ["Novedad tecnica aplicada", "", "", "", "", "El proyecto combina sincronizacion en tiempo real con Firebase, OCR multi-estrategia (Google Cloud Vision + Tesseract.js), conteo de piezas con IA (Claude Opus), sistema offline completo con cross-tab locking, 8 roles de usuario y 12 secciones de fabricacion en una unica plataforma operativa."],
  ["Resultado empresarial perseguido", "", "", "", "", "Disponer de una herramienta propia, segura y escalable que sustituye procesos dispersos, mejora el control de inventario, reduce errores de stock y facilita auditoria, explotacion y gobierno del dato logistico en planta."],
  ["", "", "", "", "", ""],
  ["3. HITOS TECNICOS Y CONTRIBUCION AL NEGOCIO", "", "", "", "", ""],
  ["Fecha / tramo", "Bloque funcional", "Descripcion tecnica", "Impacto operativo", "Riesgo resuelto", "Estado"],
  ["Q2 2026", "Arquitectura base", "Definicion de frontend React + backend Firebase Cloud Functions + servicios de sincronizacion en tiempo real.", "Unificacion del proceso de gestion de almacenes en una sola plataforma.", "Dependencia de procesos manuales y herramientas inconexas.", "Completado"],
  ["Q2 2026", "Motor de inventario", "Implementacion de 8 operaciones de inventario (ubicar, retirar, mover, reubicar, etc.) con transacciones multi-documento.", "Permite gestionar todo el ciclo de vida de articulos desde ubicacion hasta envio a almacen.", "Errores de stock y duplicaciones criticas.", "Completado"],
  ["Q2 2026", "Sistema de escaneo y OCR", "Desarrollo de pipeline multi-estrategia con Cloud Vision, Tesseract.js y parsing de hojas de ruta.", "Identificacion automatica de productos mediante camara con alta precision.", "Tiempos de busqueda manuales elevados (15-20 min por articulo).", "Completado"],
  ["Q2 2026", "Sistema offline completo", "Cola de 9 tipos de operaciones con cross-tab locking, sync bidireccional y resolucion de conflictos.", "Operatividad completa sin conexion en entornos industriales.", "Perdida de productividad por desconexiones.", "Completado"],
  ["Q2 2026", "Integracion IA", "OCR multi-estrategia + conteo de piezas con Claude Opus 4.8 de Anthropic.", "Asistencia logistica con busqueda semantica y analisis visual.", "Busquedas manuales ineficientes.", "Completado"],
  ["Q2 2026", "Comunicacion interna", "Chat interno, push notifications, alertas urgentes y cola de recogida para carretilleros.", "Mejora de coordinacion entre operarios y respuesta a incidencias.", "Falta de coordinacion y sistematica de comunicacion.", "Completado"],
  ["Q2 2026", "Sistema de seguridad", "8 roles de usuario con autenticacion dual y permisos por seccion.", "Control granular de accesos adaptado a cada rol.", "Riesgos de seguridad y acceso no controlado.", "Completado"]
];

const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);

// Configurar anchos de columna
wsResumen['!cols'] = [
  { wch: 35 }, // Columna A
  { wch: 45 }, // Columna B
  { wch: 55 }, // Columna C
  { wch: 45 }, // Columna D
  { wch: 40 }, // Columna E
  { wch: 60 }  // Columna F
];

// Combinar celdas para titulos
wsResumen['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Titulo principal
  { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Subtitulo
  { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }, // Seccion 1
  { s: { r: 10, c: 0 }, e: { r: 10, c: 5 } }, // Seccion 2
  { s: { r: 14, c: 0 }, e: { r: 14, c: 5 } }, // Seccion 3
  { s: { r: 15, c: 1 }, e: { r: 15, c: 5 } }, // Objetivo principal
  { s: { r: 16, c: 1 }, e: { r: 16, c: 5 } }, // Novedad tecnica
  { s: { r: 17, c: 1 }, e: { r: 17, c: 5 } }  // Resultado empresarial
];

XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Ejecutivo");

// ==========================================
// HOJA 2: DEDICACION ESTIMADA
// ==========================================
const dedicacionData = [
  ["ESTIMACION DE DEDICACION Y TRAZABILIDAD DEL DESARROLLO", "", "", "", "", ""],
  ["Desglose orientativo de horas empleadas en la creacion de la aplicacion y su implantacion operativa.", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["Fase", "Bloque", "Horas estimadas", "% s/ total", "Detalle de actividades", "Naturaleza"],
  ["1", "Analisis funcional y diseno", 48, 0.10, "Definicion de requisitos, alcance del sistema, mapa de procesos de gestion de almacenes e identificacion de casuisticas de planta.", "Ingenieria funcional"],
  ["2", "Arquitectura y modelo de datos", 52, 0.11, "Diseno tecnico del frontend, backend Firebase, sincronizacion en tiempo real y estructura de datos para inventario, escaneo y reporting.", "Ingenieria tecnica"],
  ["3", "Implementacion del nucleo", 168, 0.35, "Motor operativo, inventario (1.440 LOC), escaneo, offline, autenticacion, 8 roles de usuario, 12 secciones de fabricacion.", "Desarrollo software"],
  ["4", "Integracion IA y comunicacion", 72, 0.15, "OCR multi-estrategia (Cloud Vision + Tesseract.js), conteo de piezas (Claude Opus), chat, notificaciones push.", "Desarrollo software"],
  ["5", "Pruebas, validacion e implantacion", 64, 0.13, "Testing multi-dispositivo, correcciones, documentacion y despliegue en entorno de produccion.", "QA / estabilizacion"],
  ["6", "Hardware y equipamiento", 32, 0.07, "Tablets industriales, lectores QR/barcode, soportes, configuracion de dispositivos.", "Infraestructura"],
  ["7", "Documentacion y soporte fiscal", 44, 0.09, "Documentos justificativos, memoria tecnica y soporte al asesor fiscal.", "Implantacion"],
  ["", "TOTAL ESTIMADO", 480, 1.00, "", ""],
  ["", "", "", "", "", ""],
  ["Nota: la dedicacion se expresa como estimacion tecnica razonable a partir del alcance funcional desarrollado, la complejidad de integracion y las tareas de estabilizacion realizadas en el proyecto.", "", "", "", "", ""]
];

const wsDedicacion = XLSX.utils.aoa_to_sheet(dedicacionData);

// Configurar anchos de columna
wsDedicacion['!cols'] = [
  { wch: 10 }, // Columna A
  { wch: 35 }, // Columna B
  { wch: 18 }, // Columna C
  { wch: 12 }, // Columna D
  { wch: 65 }, // Columna E
  { wch: 25 }  // Columna F
];

// Combinar celdas para titulos
wsDedicacion['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Titulo principal
  { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Subtitulo
  { s: { r: 11, c: 0 }, e: { r: 11, c: 5 } }  // Nota
];

XLSX.utils.book_append_sheet(wb, wsDedicacion, "Dedicacion Estimada");

// ==========================================
// HOJA 3: EVIDENCIAS Y VALOR
// ==========================================
const evidenciasData = [
  ["EVIDENCIAS, ACTIVOS GENERADOS Y VALOR EMPRESARIAL", "", "", ""],
  ["", "", "", ""],
  ["Activo / evidencia", "Descripcion", "Contribucion a la deduccion", "Estado"],
  ["Aplicacion WMS corporativa", "Frontend operativo con 157 componentes React para gestion integral de almacenes, escaneo, admin y reportes.", "Materializa una mejora funcional interna mediante software propio no disponible como solucion estandar adaptada.", "Disponible"],
  ["Backend Cloud Functions", "31 funciones cloud con 4.868 lineas de logica de negocio para inventario, notificaciones, IA y produccion.", "Aporta novedad subjetiva en la forma de conectar, validar y asegurar la consistencia del dato corporativo.", "Disponible"],
  ["Motor de IA integrado", "OCR multi-estrategia (Google Cloud Vision + Tesseract.js) y conteo de piezas con Claude Opus 4.8.", "Genera capacidad analitica adicional y mejora sustancial de procesos internos mediante inteligencia artificial.", "Disponible"],
  ["Sistema offline completo", "Cola de 9 tipos de operaciones con cross-tab locking, sync bidireccional y resolucion de conflictos.", "Garantiza operatividad completa sin conexion en entornos industriales con conectividad limitada.", "Disponible"],
  ["Sistema de seguridad", "8 roles de usuario con autenticacion dual y permisos por seccion con 12 secciones de fabricacion.", "Control granular de accesos adaptado a cada rol y seccion de planta.", "Disponible"],
  ["Sistema de comunicacion", "Chat interno, push notifications, alertas urgentes y cola de recogida para carretilleros.", "Mejora de coordinacion entre operarios y respuesta a incidencias.", "Disponible"],
  ["Documentacion justificativa", "Memoria tecnica, justificacion fiscal y trazabilidad de dedicacion estimada.", "Facilita la acreditacion del esfuerzo innovador y la racionalidad economica del proyecto.", "Disponible"],
  ["", "", "", ""],
  ["Conclusion ejecutiva: el proyecto 004 ESTANTERIAS constituye un desarrollo tecnologico interno orientado a mejorar de forma sustancial la gestion de almacenes, el control de inventario y la busqueda asistida por IA, con una dedicacion estimada de 480 horas y un resultado funcional ya implantado.", "", "", ""]
];

const wsEvidencias = XLSX.utils.aoa_to_sheet(evidenciasData);

// Configurar anchos de columna
wsEvidencias['!cols'] = [
  { wch: 35 }, // Columna A
  { wch: 60 }, // Columna B
  { wch: 55 }, // Columna C
  { wch: 15 }  // Columna D
];

// Combinar celdas para titulos
wsEvidencias['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Titulo principal
  { s: { r: 10, c: 0 }, e: { r: 10, c: 3 } }  // Conclusion
];

XLSX.utils.book_append_sheet(wb, wsEvidencias, "Evidencias y Valor");

// ==========================================
// GUARDAR ARCHIVO
// ==========================================
const excelPath = 'f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS.xlsx';
XLSX.writeFile(wb, excelPath);

console.log('Archivo Excel profesional creado correctamente');
console.log('Hojas creadas: Resumen Ejecutivo, Dedicacion Estimada, Evidencias y Valor');