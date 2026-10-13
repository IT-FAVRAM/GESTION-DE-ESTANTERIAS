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
              text: "Justificacion de Deduccion por Innovacion Tecnologica",
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
              text: "Memoria de mejora de procesos, impacto operativo y racionalidad economica",
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
              text: "Documento interno de soporte fiscal - uso confidencial",
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
              text: "El presente documento tiene por finalidad justificar, desde una perspectiva funcional, economica y organizativa, la deduccion asociada al proyecto 004 ESTANTERIAS. El sistema desarrollado mejora de manera sustancial los procesos de gestion de almacenes, control de inventario, busqueda de productos y asistencia logistica mediante inteligencia artificial para las secciones de planta.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "0. CONTEXTO - SITUACION DE PARTIDA",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Antes del desarrollo de la aplicacion, la gestion de almacenes y control de inventario estaba expuesta a dependencias manuales, busquedas ineficientes, riesgo de errores de stock y baja trazabilidad de los movimientos de productos. El proyecto se concibe para resolver esa situacion con una herramienta propia y adaptada al proceso real de la empresa.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Existencia de multiples secciones de planta con estanterias fisicas que requieren un control preciso de ubicaciones y stock.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Necesidad de disponer de un sistema de busqueda eficiente para localizar productos en un entorno industrial con cientos de ubicaciones.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Necesidad de sincronizar el inventario en tiempo real entre multiples dispositivos (tablets, kioscos, lectores) para evitar errores de concurrencia.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "1. OBJETO DEL PROYECTO Y NATURALEZA DE LA MEJORA",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El proyecto 004 ESTANTERIAS consiste en el diseno, desarrollo e implantacion de una plataforma corporativa de gestion de almacenes que integra escaneo de productos, control de ubicaciones, sincronizacion en tiempo real y busqueda asistida por IA. La mejora no se limita a digitalizar una tarea existente, sino que reorganiza y automatiza un proceso critico de negocio.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Ambito\tSituacion anterior\tSituacion tras el proyecto",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Gestion de ubicaciones\tControl manual y propenso a errores.\tSistema guiado, normalizado y trazable desde una sola aplicacion.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Busqueda de productos\tProcesos manuales y tiempo de localizacion elevado.\tBusqueda semantica asistida por IA con resultados instantaneos.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Control de stock\tInventario disperso y dependiente de procesos manuales.\tSincronizacion en tiempo real y control de concurrencia.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Control interno\tMayor dificultad para revisar movimientos y justificar decisiones.\tMayor auditabilidad, consistencia y seguimiento por parte de operarios y direccion.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "2. MEJORAS DE PROCESO E IMPACTO ORGANIZATIVO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "A efectos de soporte a la deduccion, el proyecto genera mejoras operativas directas y verificables sobre procesos internos de gestion de almacenes. Las cifras que siguen se expresan como estimaciones razonables de negocio derivadas del rediseño del proceso y de la automatizacion incorporada.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Area de mejora\tEfecto conseguido\tEstimacion razonable de impacto",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Tiempo de busqueda de productos\tReduccion drastic del tiempo para localizar articulos en estanterias.\tAhorro estimado de 40% a 60% del tiempo de busqueda manual.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Errores de inventario\tMenor probabilidad de errores de stock y ubicacion.\tReduccion estimada de errores recurrentes en torno al 50% - 70% respecto a un proceso manual.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Conflictos de concurrencia\tControl de movimientos simultaneos entre multiples operarios.\tDisminucion material del riesgo de duplicidades y inconsistencias.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Tiempo de gestion administrativa\tMayor claridad en movimientos, ubicaciones y reportes.\tAhorro estimado de 15 a 30 minutos por turno en tareas administrativas.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Explotacion y reporting\tDisponibilidad de informes de inventario y movimientos.\tReduccion del tiempo de consolidacion y preparacion de informacion periodica.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3. RELACION ENTRE ESFUERZO DESARROLLADO Y BENEFICIO OBTENIDO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La empresa ha destinado una dedicacion estimada de 240 horas tecnicas a un desarrollo propio que impacta sobre un proceso transversal. Ese esfuerzo se traduce en un activo interno con capacidad de uso continuado, escalabilidad y mejoras futuras, superando claramente la simple compra o parametrizacion de una herramienta estandar.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Bloque de trabajo\tHoras estimadas\tResultado aportado",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Analisis funcional y diseno\t32 h\tDefinicion del proceso objetivo y casuisticas de negocio.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Arquitectura y modelo de datos\t36 h\tBase tecnica para sincronizacion, persistencia y calculo.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Desarrollo nucleo de gestion\t96 h\tRegistro fiable de ubicaciones, escaneo y movimientos.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Desarrollo IA y reporting\t40 h\tAsistente de busqueda semantica y exportaciones.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion, pruebas y correcciones\t36 h\tEstabilizacion y validacion funcional de todos los tipos de registro.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4. ELEMENTOS QUE REFUERZAN LA CALIFICACION COMO INNOVACION TECNOLOGICA",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Existencia de desarrollo propio especificamente orientado a resolver necesidades internas no cubiertas de forma suficiente por herramientas genericas.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion tecnica con Firebase para sincronizacion en tiempo real y resolucion de conflictos de concurrencia.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Desarrollo de logica de negocio especifica para gestion de almacenes, escaneo de productos y busqueda asistida por IA.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Mejora sustancial de procesos administrativos y de control interno mediante automatizacion, trazabilidad y consistencia del dato.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Generacion de un activo reutilizable y escalable para futuras ampliaciones funcionales del ecosistema logistico.",
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "5. CONCLUSION FISCAL Y DE NEGOCIO",
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "A juicio de esta memoria, el proyecto 004 ESTANTERIAS cumple con los rasgos propios de una actuacion de innovacion tecnologica orientada a la mejora sustancial de procesos internos. El sistema desarrollado introduce nuevas capacidades funcionales, reduce tiempos administrativos, disminuye errores y refuerza la fiabilidad del flujo entre operativa interna y gestion de almacenes. Por ello, el esfuerzo incurrido presenta una base razonable para su consideracion dentro del marco de deduccion por innovacion tecnologica previsto en el articulo 35.2 de la LIS.",
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
              text: "Departamento promotor\tDireccion / Inversiones",
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
              text: "Fecha de emision\tJulio 2026",
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
              text: "Proyecto\t004 ESTANTERIAS",
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
  fs.writeFileSync('f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS - JUSTIFICACION DEDUCCION.docx', buffer);
  console.log('Documento de justificacion actualizado correctamente');
};

saveDocument().catch(console.error);