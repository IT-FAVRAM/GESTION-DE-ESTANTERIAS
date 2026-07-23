const {
  Document, Packer, Paragraph, TextRun, ImageRun, PageBreak,
  AlignmentType, HeadingLevel, VerticalAlign, TabStopType, TabStopPosition,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  convertInchesToTwip, convertMillimetersToTwip
} = require('docx');
const fs = require('fs');
const path = require('path');

const CAPTURES_DIR = path.join(__dirname, 'capturas');
const CROP_DIR = path.join(__dirname, '..', 'manual-capturas', 'crop');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'MANUAL_KIOSKO_UBICAR_RETIRAR.docx');

// Helper to read image as buffer
function readImage(filename) {
  const imgPath = path.join(CROP_DIR, filename);
  if (!fs.existsSync(imgPath)) {
    console.warn(`⚠️ Imagen no encontrada: ${imgPath}`);
    return null;
  }
  return fs.readFileSync(imgPath);
}

// Colors
const GREEN = '16a34a';
const GREEN_LIGHT = 'f0fdf4';
const GREEN_BORDER = 'bbf7d0';
const RED = 'e11d48';
const RED_LIGHT = 'fff1f2';
const RED_BORDER = 'fecdd3';
const DARK = '0f172a';
const GRAY = '64748b';
const WHITE = 'ffffff';

// Page dimensions (A4)
const PAGE_WIDTH_TWIP = convertMillimetersToTwip(210);
const PAGE_HEIGHT_TWIP = convertMillimetersToTwip(297);
const MARGIN_TWIP = convertMillimetersToTwip(7);

// Helper: Create a numbered step paragraph
function createStep(number, text, color) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    children: [
      new TextRun({
        text: `${number}`,
        bold: true,
        color: WHITE,
        size: 18,
        font: 'Segoe UI',
      }),
      new TextRun({
        text: `  ${text}`,
        color: DARK,
        size: 19,
        font: 'Segoe UI',
      }),
    ],
  });
}

// Helper: Create a step with bold keywords
function createStepRich(number, parts, color) {
  const children = [
    new TextRun({
      text: `${number}`,
      bold: true,
      color: WHITE,
      size: 18,
      font: 'Segoe UI',
    }),
    new TextRun({ text: '  ' }),
  ];

  parts.forEach(part => {
    children.push(new TextRun({
      text: part.text,
      bold: part.bold || false,
      color: part.bold ? color : DARK,
      size: 19,
      font: 'Segoe UI',
    }));
  });

  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 },
    children,
  });
}

// Helper: Create image paragraph
function createImage(imageBuffer, widthMm, caption) {
  const children = [];

  if (imageBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 20 },
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: {
              width: convertMillimetersToTwip(widthMm) / 914400 * 96,
              height: 0, // Will be auto
            },
            type: 'png',
          }),
        ],
      })
    );
  }

  if (caption) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({
            text: caption,
            italics: true,
            color: GRAY,
            size: 16,
            font: 'Segoe UI',
          }),
        ],
      })
    );
  }

  return children;
}

// Helper: Create title banner
function createBanner(title, subtitle, bgColor) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: bgColor },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                spacing: { before: 120, after: 20 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    color: WHITE,
                    size: 32,
                    font: 'Segoe UI',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 120 },
                children: [
                  new TextRun({
                    text: subtitle,
                    color: WHITE,
                    size: 18,
                    font: 'Segoe UI',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Helper: Create tips section
function createTipsSection(tips, color) {
  const tipParagraphs = tips.map(tip => {
    return new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [
        new TextRun({
          text: '  ',
          size: 18,
        }),
        new TextRun({
          text: tip,
          color: DARK,
          size: 17,
          font: 'Segoe UI',
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: color === GREEN ? GREEN_LIGHT : RED_LIGHT },
            borders: {
              top: { style: BorderStyle.SINGLE, color: color === GREEN ? GREEN_BORDER : RED_BORDER, size: 1 },
              bottom: { style: BorderStyle.SINGLE, color: color === GREEN ? GREEN_BORDER : RED_BORDER, size: 1 },
              left: { style: BorderStyle.SINGLE, color: color === GREEN ? GREEN_BORDER : RED_BORDER, size: 1 },
              right: { style: BorderStyle.SINGLE, color: color === GREEN ? GREEN_BORDER : RED_BORDER, size: 1 },
            },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 60 },
                children: [
                  new TextRun({
                    text: 'CONSEJOS',
                    bold: true,
                    color: color,
                    size: 18,
                    font: 'Segoe UI',
                  }),
                ],
              }),
              ...tipParagraphs,
              new Paragraph({ spacing: { after: 60 }, children: [] }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Helper: Section divider line
function createDivider(color) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: color },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: ' ', size: 4 })] }),
            ],
          }),
        ],
      }),
    ],
  });
}

async function main() {
  console.log('📄 Generando manual del kiosko...');

  // Read images
  const principalImg = readImage('principal.png');
  const ubicarOpcionesImg = readImage('ubicar-opciones.png');
  const ubicarCeldaImg = readImage('ubicar-celda.png');
  const ubicarConfirmImg = readImage('ubicar-confirm.png');
  const retirarImg = readImage('retirar.png');

  console.log(`📸 Imágenes cargadas: principal=${!!principalImg}, ubicar-opciones=${!!ubicarOpcionesImg}, ubicar-celda=${!!ubicarCeldaImg}, ubicar-confirm=${!!ubicarConfirmImg}, retirar=${!!retirarImg}`);

  // ============================================
  // PAGE1: UBICAR (Green theme)
  // ============================================
  const ubicarChildren = [
    // Banner
    createBanner('UBICAR ARTÍCULOS', 'Cómo guardar un artículo en la estantería', GREEN),
    new Paragraph({ spacing: { before: 120 }, children: [] }),

    // Main screen
    ...createImage(principalImg, 160, 'Pantalla principal del kiosko'),
    new Paragraph({ spacing: { before: 80 }, children: [] }),

    // Divider
    createDivider(GREEN),
    new Paragraph({ spacing: { before: 100 }, children: [] }),

    // Steps title
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: 'PASOS PARA UBICAR',
          bold: true,
          color: GREEN,
          size: 22,
          font: 'Segoe UI',
        }),
      ],
    }),

    // Step1
    createStepRich('1', [
      { text: 'Pulsa el botón verde ', bold: false },
      { text: 'UBICAR', bold: true },
      { text: ' en la pantalla principal.', bold: false },
    ], GREEN),

    // Step2 with image
    ...createImage(ubicarOpcionesImg, 120, 'Elige el método de captura'),
    new Paragraph({ spacing: { before: 40 }, children: [] }),

    createStepRich('2', [
      { text: 'Elige cómo capturar: ', bold: false },
      { text: 'QR/pistola', bold: true },
      { text: ', ', bold: false },
      { text: 'cámara', bold: true },
      { text: ', ', bold: false },
      { text: 'a mano', bold: true },
      { text: ' o ', bold: false },
      { text: 'lote', bold: true },
      { text: '.', bold: false },
    ], GREEN),

    // Step3
    createStepRich('3', [
      { text: 'Escribe o escanea el ', bold: false },
      { text: 'código del artículo', bold: true },
      { text: ' y la ', bold: false },
      { text: ' Orden de Fabricación (OF)', bold: true },
      { text: '.', bold: false },
    ], GREEN),

    // Step4 with image
    ...createImage(ubicarCeldaImg, 120, 'Toca las celdas donde quieres dejarlo'),
    new Paragraph({ spacing: { before: 40 }, children: [] }),

    createStepRich('4', [
      { text: 'Toca la ', bold: false },
      { text: 'celda', bold: true },
      { text: ' de la estantería donde lo dejas. Las celdas seleccionadas se ponen en verde.', bold: false },
    ], GREEN),

    // Step5 with confirmation image
    ...createImage(ubicarConfirmImg, 120, 'Barra de confirmación'),
    new Paragraph({ spacing: { before: 40 }, children: [] }),

    createStepRich('5', [
      { text: 'Pulsa ', bold: false },
      { text: '✓ Ubicar', bold: true },
      { text: ' para guardar. ¡Listo!', bold: false },
    ], GREEN),

    new Paragraph({ spacing: { before: 100 }, children: [] }),

    // Tips
    createTipsSection([
      'Cancelar: botón rojo arriba a la derecha, en cualquier momento.',
      'Posiciones: formato fila-columna (p. ej. 001, 002…).',
      'QR / pistola: la forma más rápida y precisa de capturar.',
      '¿Dudas?: avisa al responsable de tu sección.',
    ], GREEN),

    // Footer
    new Paragraph({ spacing: { before: 80 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'WMS CONTROL · Gestión de Almacén — capturas reales de la aplicación',
          color: GRAY,
          size: 14,
          font: 'Segoe UI',
        }),
      ],
    }),
  ];

  // ============================================
  // PAGE2: RETIRAR (Red theme) - with PageBreak
  // ============================================
  const retirarChildren = [
    // Page break
    new Paragraph({
      children: [new PageBreak()],
    }),

    // Banner
    createBanner('RETIRAR ARTÍCULOS', 'Cómo sacar artículos de la estantería', RED),
    new Paragraph({ spacing: { before: 120 }, children: [] }),

    // Main screen
    ...createImage(principalImg, 160, 'Pantalla principal del kiosko'),
    new Paragraph({ spacing: { before: 80 }, children: [] }),

    // Divider
    createDivider(RED),
    new Paragraph({ spacing: { before: 100 }, children: [] }),

    // Steps title
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: 'PASOS PARA RETIRAR',
          bold: true,
          color: RED,
          size: 22,
          font: 'Segoe UI',
        }),
      ],
    }),

    // Step1
    createStepRich('1', [
      { text: 'Pulsa el botón rojo ', bold: false },
      { text: 'RETIRAR', bold: true },
      { text: ' en la pantalla principal.', bold: false },
    ], RED),

    // Step2 with image
    ...createImage(retirarImg, 120, 'Lista de artículos disponibles por posición'),
    new Paragraph({ spacing: { before: 40 }, children: [] }),

    createStepRich('2', [
      { text: 'Verás la lista de artículos por ', bold: false },
      { text: 'posición', bold: true },
      { text: '. Los urgentes aparecen primero.', bold: false },
    ], RED),

    // Step3
    createStepRich('3', [
      { text: 'Toca para ', bold: false },
      { text: 'marcar los artículos', bold: true },
      { text: ' que sacas (aparece una casilla marcada).', bold: false },
    ], RED),

    // Step4
    createStepRich('4', [
      { text: 'Pulsa ', bold: false },
      { text: 'RETIRAR · X artículos', bold: true },
      { text: ' en la barra inferior.', bold: false },
    ], RED),

    // Step5
    createStepRich('5', [
      { text: 'Confirma y ¡listo! El artículo queda registrado como retirado.', bold: false },
    ], RED),

    new Paragraph({ spacing: { before: 60 }, children: [] }),

    // Divider
    createDivider(RED),
    new Paragraph({ spacing: { before: 100 }, children: [] }),

    // Alternative method
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: 'MÉTODO ALTERNATIVO: RETIRAR DESDE LA CELDA',
          bold: true,
          color: RED,
          size: 20,
          font: 'Segoe UI',
        }),
      ],
    }),

    createStepRich('1', [
      { text: 'Toca directamente una ', bold: false },
      { text: 'celda ocupada', bold: true },
      { text: ' en la grilla de la estantería.', bold: false },
    ], RED),

    createStepRich('2', [
      { text: 'Se abre un ', bold: false },
      { text: 'modal inferior', bold: true },
      { text: ' con los artículos de esa posición.', bold: false },
    ], RED),

    createStepRich('3', [
      { text: 'Marca los que quieres retirar y pulsa ', bold: false },
      { text: 'RETIRAR', bold: true },
      { text: '.', bold: false },
    ], RED),

    new Paragraph({ spacing: { before: 100 }, children: [] }),

    // Tips
    createTipsSection([
      'Puedes seleccionar artículos de varias celdas antes de confirmar.',
      'Los artículos urgentes aparecen siempre arriba.',
      'Para cancelar, pulsa el botón rojo o toca fuera del modal.',
      '¿Dudas?: avisa al responsable de tu sección.',
    ], RED),

    // Footer
    new Paragraph({ spacing: { before: 80 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'WMS CONTROL · Gestión de Almacén — capturas reales de la aplicación',
          color: GRAY,
          size: 14,
          font: 'Segoe UI',
        }),
      ],
    }),
  ];

  // ============================================
  // CREATE DOCUMENT
  // ============================================
  const doc = new Document({
    creator: 'WMS CONTROL',
    title: 'Manual Kiosko - Ubicar y Retirar',
    description: 'Guía rápida paso a paso para los procesos de Ubicar y Retirar artículos en el kiosko de estanterías',
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_TWIP,
              height: PAGE_HEIGHT_TWIP,
              orientation: 'portrait',
            },
            margin: {
              top: MARGIN_TWIP,
              right: MARGIN_TWIP,
              bottom: MARGIN_TWIP,
              left: MARGIN_TWIP,
            },
          },
        },
        children: [...ubicarChildren, ...retirarChildren],
      },
    ],
  });

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate file
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_FILE, buffer);

  console.log(`\n✅ Manual generado exitosamente:`);
  console.log(`   📁 ${OUTPUT_FILE}`);
  console.log(`   📄2 páginas (UBICAR + RETIRAR)`);
  console.log(`   📏 Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
