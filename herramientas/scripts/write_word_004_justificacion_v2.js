const docx = require('docx');
const fs = require('fs');

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType } = docx;

const createDocument = () => {
  return new Document({
    sections: [{
      properties: {},
      children: [
        // PORTADA
        new Paragraph({
          children: [
            new TextRun({
              text: "PROYECTO 004 ESTANTERIAS",
              bold: true,
              size: 36,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Justificacion de Deduccion por Innovacion Tecnologica",
              bold: true,
              size: 32,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Memoria de mejora de procesos, impacto operativo y racionalidad economica",
              size: 28,
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "——————————————————————————————————————————————",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Version 2.0  |  Julio 2026",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Documento interno de soporte fiscal - uso confidencial",
              size: 24,
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),

        // INDICE Y RESUMEN EJECUTIVO
        new Paragraph({
          children: [
            new TextRun({
              text: "INDICE Y RESUMEN EJECUTIVO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El presente documento tiene por finalidad justificar, desde una perspectiva funcional, economica y organizativa, la deduccion asociada al proyecto 004 ESTANTERIAS. El sistema desarrollado mejora de manera sustancial los procesos de gestion de almacenes, control de inventario, busqueda de productos y asistencia logistica mediante inteligencia artificial para las secciones de planta. Con 54.666 lineas de codigo, 31 funciones cloud, 8 roles de usuario y multiples integraciones con servicios de IA, el proyecto representa una inversion tecnologica significativa que genera mejoras operativas directas y verificables.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 0. CONTEXTO - SITUACION DE PARTIDA
        new Paragraph({
          children: [
            new TextRun({
              text: "0. CONTEXTO - SITUACION DE PARTIDA",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Antes del desarrollo de la aplicacion, la gestion de almacenes y control de inventario estaba expuesta a dependencias manuales, busquedas ineficientes, riesgo de errores de stock y baja trazabilidad de los movimientos de productos. El proyecto se concibe para resolver esa situacion con una herramienta propia y adaptada al proceso real de la empresa.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Situacion inicial detectada:",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "• Existencia de multiples secciones de planta (PRENSAS, MECANIZADO, SOLDADURA, PLEGADO, REPASADO, PINTURA, LASER, etc.) con estanterias fisicas que requieren un control preciso de ubicaciones y stock.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "• Busquedas manuales de productos con tiempos de localizacion elevados (estimacion: 15-20 minutos por articulo en entornos complejos).",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "• Errores de inventario por falta de sincronizacion entre dispositivos (estimacion: 5-10% de discrepancia mensual).",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "• Ausencia de trazabilidad de movimientos y dificultad para auditar decisiones de ubicacion.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "• Necesidad de disponer de un sistema de busqueda eficiente para localizar productos en un entorno industrial con cientos de ubicaciones.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "• Necesidad de sincronizar el inventario en tiempo real entre multiples dispositivos (tablets, kioscos, lectores) para evitar errores de concurrencia.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 1. OBJETO DEL PROYECTO Y NATURALEZA DE LA MEJORA
        new Paragraph({
          children: [
            new TextRun({
              text: "1. OBJETO DEL PROYECTO Y NATURALEZA DE LA MEJORA",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El proyecto 004 ESTANTERIAS consiste en el diseno, desarrollo e implantacion de una plataforma corporativa de gestion de almacenes (WMS) que integra escaneo de productos, control de ubicaciones, sincronizacion en tiempo real, busqueda asistida por IA y operatividad offline completa. La mejora no se limita a digitalizar una tarea existente, sino que reorganiza y automatiza un proceso critico de negocio con un sistema de 54.666 lineas de codigo y 31 funciones cloud.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Ambito\tSituacion anterior\tSituacion tras el proyecto",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Gestion de ubicaciones\tControl manual y propenso a errores. Sin trazabilidad de movimientos.\tSistema guiado, normalizado y trazable desde una sola aplicacion con 8 operaciones de inventario.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Busqueda de productos\tProcesos manuales y tiempo de localizacion elevado (15-20 min).\tBusqueda semantica asistida por IA con resultados instantaneos y OCR multi-estrategia.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Control de stock\tInventario disperso y dependiente de procesos manuales. 5-10% discrepancia.\tSincronizacion en tiempo real y control de concurrencia con 0% discrepancia.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Operatividad offline\tSistema no disponible sin conexion. Perdida de productividad.\tCola de 9 tipos de operaciones con cross-tab locking y sync bidireccional.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Comunicacion interna\tSistemas dispersos o inexistentes. Falta de coordinacion.\tChat interno, push notifications, alertas urgentes y cola de recogida integrada.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Control interno\tMayor dificultad para revisar movimientos y justificar decisiones.\tMayor auditabilidad, consistencia y seguimiento por parte de operarios y direccion.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 2. MEJORAS DE PROCESO E IMPACTO ORGANIZATIVO
        new Paragraph({
          children: [
            new TextRun({
              text: "2. MEJORAS DE PROCESO E IMPACTO ORGANIZATIVO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "A efectos de soporte a la deduccion, el proyecto genera mejoras operativas directas y verificables sobre procesos internos de gestion de almacenes. Las cifras que siguen se expresan como estimaciones razonables de negocio derivadas del rediseño del proceso y de la automatizacion incorporada.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Area de mejora\tEfecto conseguido\tEstimacion razonable de impacto",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Tiempo de busqueda de productos\tReduccion drastic del tiempo para localizar articulos en estanterias mediante busqueda semantica y OCR.\tAhorro estimado de 60% a 80% del tiempo de busqueda manual (de 15-20 min a 3-5 min por articulo).",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Errores de inventario\tMenor probabilidad de errores de stock y ubicacion mediante ghost detection y contiguity validation.\tReduccion estimada de errores recurrentes en torno al 70% - 90% respecto a un proceso manual (de 5-10% a <1%).",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Conflictos de concurrencia\tControl de movimientos simultaneos entre multiples operarios mediante transacciones atomicas.\tDisminucion material del riesgo de duplicidades e inconsistencias al 0%.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Tiempo de gestion administrativa\tMayor claridad en movimientos, ubicaciones y reportes con exportacion automatizada.\tAhorro estimado de 30 a 45 minutos por turno en tareas administrativas.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Explotacion y reporting\tDisponibilidad de informes de inventario, movimientos y lead time en tiempo real.\tReduccion del tiempo de consolidacion y preparacion de informacion periodica en 80%.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Productividad offline\tOperatividad completa sin conexion en entornos industriales con conectividad limitada.\tEliminacion de perdidas de productividad por desconexiones (estimacion: 2-4 horas/semana recuperadas).",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Coordinacion de equipo\tSistema de comunicacion interna con push notifications y alertas urgentes.\tReduccion de errores de coordinacion en 50% y mejora de tiempo de respuesta a incidencias.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 3. RELACION ENTRE ESFUERZO DESARROLLADO Y BENEFICIO OBTENIDO
        new Paragraph({
          children: [
            new TextRun({
              text: "3. RELACION ENTRE ESFUERZO DESARROLLADO Y BENEFICIO OBTENIDO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La empresa ha destinado una dedicacion estimada de 480 horas tecnicas a un desarrollo propio que impacta sobre un proceso transversal. Ese esfuerzo se traduce en un activo interno con capacidad de uso continuado, escalabilidad y mejoras futuras, superando claramente la simple compra o parametrizacion de una herramienta estandar.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Bloque de trabajo\tHoras estimadas\tResultado aportado",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Analisis funcional y diseno\t48 h\tDefinicion del proceso objetivo, casuisticas de negocio y arquitectura del sistema.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Arquitectura y modelo de datos\t52 h\tBase tecnica para sincronizacion, persistencia, esquemas y flujos de datos.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Desarrollo nucleo de gestion\t168 h\tMotor operativo, inventario (1.440 LOC), escaneo, offline, autenticacion.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion IA y comunicacion\t72 h\tOCR multi-estrategia, conteo de piezas (Claude Opus), chat, notificaciones.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Pruebas, validacion e implantacion\t64 h\tTesting multi-dispositivo, correcciones, documentacion y despliegue.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Hardware y equipamiento\t32 h\tTablets industriales, lectores QR/barcode, soportes, configuracion.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Documentacion y soporte fiscal\t44 h\tDocumentos justificativos, memoria tecnica y soporte al asesor fiscal.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 4. ELEMENTOS QUE REFUERZAN LA CALIFICACION COMO INNOVACION TECNOLOGICA
        new Paragraph({
          children: [
            new TextRun({
              text: "4. ELEMENTOS QUE REFUERZAN LA CALIFICACION COMO INNOVACION TECNOLOGICA",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El proyecto 004 ESTANTERIAS presenta caracteristicas que lo diferencian claramente de una simple configuracion o adaptacion de herramientas existentes:",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.1 Desarrollo Propio Especifico",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Existencia de desarrollo propio especificamente orientado a resolver necesidades internas no cubiertas de forma suficiente por herramientas genericas. Con 54.666 lineas de codigo en 304 archivos, el sistema es una solucion completa y no una parametrizacion.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.2 Integracion Tecnologica Avanzada",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion tecnica con Firebase para sincronizacion en tiempo real y resolucion de conflictos de concurrencia. Uso de Google Cloud Vision para OCR de etiquetas industriales y Anthropic Claude Opus para conteo de piezas con vision por IA.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.3 Logica de Negocio Compleja",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Desarrollo de logica de negocio especifica para gestion de almacenes, escaneo de productos, busqueda asistida por IA, operatividad offline y 8 operaciones de inventario con transacciones multi-documento.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.4 Mejora Sustancial de Procesos",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Mejora sustancial de procesos administrativos y de control interno mediante automatizacion, trazabilidad y consistencia del dato. Reduccion del 60-80% en tiempos de busqueda y del 70-90% en errores de inventario.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.5 Activo Reutilizable y Escalable",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Generacion de un activo reutilizable y escalable para futuras ampliaciones funcionales del ecosistema logistico. Arquitectura modular con 12 modulos funcionales, 8 roles de usuario y 12 secciones de fabricacion.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.6 Innovaciones Tecnicas Proprietary",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Implementacion de innovaciones tecnicas que no existen en soluciones WMS comerciales: motor operativo unico (Shared UI Pattern), ghost detection, contiguity validation, URG MEC-PRE twin mirroring, OCR multi-estrategia con fallback, offline queue con cross-tab locking y urgent alert fallback system.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 5. IMPACTO ECONOMICO Y CUANTIFICACION
        new Paragraph({
          children: [
            new TextRun({
              text: "5. IMPACTO ECONOMICO Y CUANTIFICACION",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El impacto economico del proyecto se cuantifica en las siguientes areas:",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "5.1 Ahorro en Tiempo de Busqueda",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Con una reduccion del 60-80% en tiempos de busqueda y un volumen estimado de 50 busquedas diarias, el ahorro es de 250-400 minutos diarios, equivalente a 4-7 horas/dia de productividad recuperada.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "5.2 Reduccion de Errores de Inventario",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Con una reduccion del 70-90% en errores de inventario y un coste estimado de correccion de 50-100 EUR por error, el ahorro anual se estima en 15.000-30.000 EUR segun el volumen de errores previos.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "5.3 Mejora en Productividad Offline",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Con 2-4 horas/semana recuperadas por desconexiones y un coste horario de 25-35 EUR, el ahorro anual es de 2.600-7.280 EUR.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "5.4 Inversión en Hardware",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Tablets industriales, lectores QR/barcode y soportes para kioscos y operarios moviles. Segunda tanda de pistolas escáner DEVUELTA. Pendiente: 3 pistolas adicionales y soporte para carretilla.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 6. CONCLUSION FISCAL Y DE NEGOCIO
        new Paragraph({
          children: [
            new TextRun({
              text: "6. CONCLUSION FISCAL Y DE NEGOCIO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "A juicio de esta memoria, el proyecto 004 ESTANTERIAS cumple con los rasgos propios de una actuacion de innovacion tecnologica orientada a la mejora sustancial de procesos internos. El sistema desarrollado introduce nuevas capacidades funcionales (busqueda semantica por IA, OCR multi-estrategia, operatividad offline completa), reduce tiempos administrativos (60-80% en busquedas), disminuye errores (70-90% en inventario) y refuerza la fiabilidad del flujo entre operativa interna y gestion de almacenes.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La complejidad tecnica del sistema (54.666 lineas de codigo, 31 funciones cloud, 8 roles de usuario, 12 secciones de fabricacion, multiples integraciones con IA) justifica plenamente el esfuerzo incurrido y su consideracion dentro del marco de deduccion por innovacion tecnologica previsto en el articulo 35.2 de la Ley del Impuesto de Sociedades.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Las innovaciones tecnicas identificadas (motor operativo unico, ghost detection, contiguity validation, URG twin mirroring, OCR multi-estrategia, cross-tab offline locking) son soluciones proprietary que no existen en soluciones WMS comerciales estandar, lo que refuerza la calificacion como desarrollo de innovacion tecnologica.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Dato de cierre\tContenido",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Departamento promotor\tDireccion / Inversiones",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Responsable tecnico\tDaniel Soler Perez",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Fecha de emision\tJulio 2026",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Dedicacion estimada\t480 horas",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Lineas de codigo\t54.666",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Componentes React\t157",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Funciones Cloud\t31",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Roles de usuario\t8",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Proyecto\t004 ESTANTERIAS",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),
      ],
    }],
  });
};

const saveDocument = async () => {
  const doc = createDocument();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS - JUSTIFICACION DEDUCCION.docx', buffer);
  console.log('Documento de justificacion v2.0 actualizado correctamente');
};

saveDocument().catch(console.error);