const docx = require('docx');
const fs = require('fs');

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType } = docx;

const createDocument = () => {
  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "PROYECTO 004 ESTANTERIAS",
              bold: true,
              size: 32,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Informe de Informacion Tecnica",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Arquitectura, integracion, logica funcional y activos generados",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "——————————————————————————————————————————————",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Version 1.1  |  Julio 2026",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Documento tecnico interno - uso confidencial",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "INDICE Y RESUMEN EJECUTIVO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El proyecto 004 ESTANTERIAS ha dado lugar a una aplicacion corporativa para gestion de almacenes y control de inventario capaz de gestionar ubicaciones, escanear productos, sincronizar datos en tiempo real y proporcionar funciones de busqueda, reporting y asistencia mediante inteligencia artificial para las secciones de planta.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "0. ALCANCE TECNICO DEL PROYECTO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La solucion desarrollada cubre de forma integrada frontend de gestion, servicios de negocio, capa de sincronizacion en tiempo real con Firebase, validaciones de persistencia, motor de busqueda con IA y modulos de exportacion e inventario. El proyecto se ha construido como software propio adaptado al proceso interno de la empresa.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Capa\tFuncion principal\tResultado tecnico",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Frontend\tRegistro y gestion operativa de inventario.\tInterfaz unificada para kioscos y moviles industriales.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Servicios de negocio\tAplicacion de reglas para ubicacion, retirada, movimiento y validacion de stock.\tNormalizacion de casuisticas complejas en un flujo unico.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion Firebase\tSincronizacion en tiempo real y persistencia de datos.\tPersistencia fiable y reduccion de inconsistencias.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Motor de IA\tAsistente de busqueda semantica y optimizacion de ubicaciones.\tBase comun para decisiones logisticas asistidas.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "1. ARBOL ACTUAL DEL PROYECTO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "A continuacion se recoge un arbol tecnico resumido del proyecto vigente, actualizado al estado actual del repositorio:",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "ESTANTERIAS/",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── app/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── frontend/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   ├── src/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── components/ (operative, admin, app, shelf, scanner, common, auth, chapero, views)",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── hooks/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── services/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── store/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── utils/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── workers/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── config/, core/, data/, lib/, pages/, legacy/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   │   │   ├── App.tsx, index.tsx, types.ts, constants.ts, firebaseConfig.ts",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   └── backend/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│       ├── src/ (inventory.js, notifications.js, reports.js, admin.js, production.js, chat.js, urgency.js, conversations.js, urgentAlerts.js, inboundOrders.js, carts.js, supplies.js, ocr.js, pieceCounter.js, chapero.js, photos.js, authz.js, firebaseAdmin.js, push.js)",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│       ├── index.js",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│       └── scripts/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── docs/ (funcional/, arquitectura/, reference/, sesiones/)",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── infrastructure/",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── package.json",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "└── package-lock.json",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "2. ARQUITECTURA LOGICA DE LA SOLUCION",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Aplicacion frontend desarrollada en React y TypeScript para operativa diaria y funciones avanzadas de gestion de almacenes.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Servicios especializados para registro de inventario, sincronizacion en tiempo real con Firebase, validacion, exportacion y busqueda asistida por IA.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Capa de integracion con Firebase para escritura y actualizacion de stock con control de errores y resolucion de conflictos de concurrencia.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Persistencia y soporte cloud para sincronizacion, colas offline y continuidad operativa del sistema.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La arquitectura resultante separa interfaz, logica de negocio, integracion y explotacion del dato, facilitando mantenimiento, trazabilidad y evolucion futura.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3. MODULOS FUNCIONALES IMPLEMENTADOS",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Modulo\tContenido funcional\tObservacion tecnica",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Gestion de Ubicaciones\tAlta, baja, modificacion y consulta de ubicaciones en estanterias.\tSincronizacion en tiempo real con Firebase.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Escaneo de Productos\tLectura de codigos de barras y QR para identificacion de articulos.\tCompatible con lectores industriales y camaras moviles.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Gestion de Stock\tControl de inventario por ubicacion, cantidad y estado.\tResolucion de conflictos de concurrencia entre operarios.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Asistente IA\tBusqueda semantica y sugerencias de optimizacion.\tIntegracion con modelos de lenguaje para asistencia operativa.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Reporting y Exportacion\tGeneracion de informes de inventario y movimientos.\tExportacion a Excel y PDF para gestion interna.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4. INNOVACIONES TECNICAS RELEVANTES",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Sincronizacion en tiempo real con Firebase para garantizar que el stock este actualizado en todos los dispositivos al milisegundo.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Web Workers Logisticos para delegacion del procesamiento de inventarios masivos a hilos secundarios y mantener la fluidez de la UI movil.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion de IA generativa (Gemini) para busqueda semantica de mercancia y sugerencias de optimizacion de huecos en estanterias.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Tratamiento especifico de movimientos simultaneos y resolucion de conflictos de concurrencia entre multiples operarios.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Capacidad de soportar operaciones offline con sincronizacion posterior y control de errores.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "5. TRAZABILIDAD DEL DESARROLLO Y ESFUERZO TECNICO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La construccion del proyecto ha requerido una dedicacion estimada de 240 horas, distribuidas entre analisis, arquitectura, implementacion, pruebas, correcciones e implantacion. Este esfuerzo responde a un desarrollo real de software y no a una simple configuracion estandar.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Fase tecnica\tHoras\tDetalle",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Analisis y diseno\t32 h\tDefinicion del modelo funcional y tecnico del sistema.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Arquitectura y modelo de datos\t36 h\tOrganizacion de capas, entidades y flujos de sincronizacion.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Implementacion del nucleo\t96 h\tGestion de ubicaciones, escaneo, stock y movimientos.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion IA y reporting\t40 h\tAsistente de IA, busqueda semantica y exportaciones.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Pruebas, validacion e implantacion\t36 h\tEstabilizacion final y soporte documental.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "6. ACTIVOS TECNICOS Y RESULTADOS GENERADOS",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Activo generado\tDescripcion tecnica\tEstado",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Aplicacion corporativa operativa\tFrontend funcional con modulos de gestion de almacenes.\tImplantado",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Servicios de negocio\tFunciones y servicios para inventario, escaneo y sincronizacion.\tImplantado",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Motor de IA\tAsistente de busqueda semantica y optimizacion.\tImplantado",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Documentacion de soporte\tExcel ejecutivo y memorias justificativa y tecnica.\tDisponible",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "7. CONCLUSION TECNICA",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Desde una perspectiva tecnica, el proyecto 004 ESTANTERIAS ha supuesto el desarrollo de una solucion propia, estructurada y funcionalmente compleja, orientada a resolver necesidades internas especificas de gestion de almacenes, control de inventario y busqueda asistida por IA. El sistema no se limita a almacenar informacion, sino que incorpora reglas, validaciones, sincronizacion en tiempo real y automatizacion que constituyen un activo tecnologico util para la organizacion.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Dato de cierre\tContenido",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Responsable tecnico\tDaniel Soler Perez",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Proyecto\t004 ESTANTERIAS",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Fecha\tJulio 2026",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Dedicacion estimada\t240 horas",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Naturaleza del desarrollo\tSoftware propio para mejora de procesos internos",
              size: 24,
            }),
          ],
        }),
      ],
    }],
  });
};

const saveDocument = async () => {
  const doc = createDocument();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS - DOCUMENTO TECNICO FUNCIONAMIENTO.docx', buffer);
  console.log('Documento tecnico actualizado correctamente');
};

saveDocument().catch(console.error);