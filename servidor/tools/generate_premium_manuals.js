
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, Header, Footer, PageNumber, NumberFormat } from 'docx';
import fs from 'fs';

// --- CONFIGURACIÓN DE ESTILOS ---
const FONTS = {
    TITLE: "Arial",
    BODY: "Calibri",
    CODE: "Consolas"
};

const COLORS = {
    PRIMARY: "2E74B5",    // Azul corporativo principal
    SECONDARY: "5B9BD5",  // Azul claro
    ACCENT: "1F4E79",     // Azul oscuro
    WARNING_BG: "FFF2CC", // Fondo amarillo claro
    WARNING_BORDER: "bf9000", // Borde dorado/naranja
    TIP_BG: "DEEBF7",     // Fondo azul muy claro
    TIP_BORDER: "2E74B5", // Borde azul
    TABLE_HEADER: "E7E6E6", // Gris claro para cabeceras
    WHITE: "FFFFFF",
    BLACK: "000000"
};

// --- HELPER FUNCTIONS: LAYOUT & COMPONENTS ---

// 1. Cover Page
const createCoverPage = (title, subtitle, version) => {
    return [
        new Paragraph({
            text: "MANUAL DE USUARIO",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { before: 3000, after: 400 },
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: title,
                    font: FONTS.TITLE,
                    size: 48, // 24pt
                    bold: true,
                    color: COLORS.ACCENT
                })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
        }),
        new Paragraph({
            text: subtitle,
            alignment: AlignmentType.CENTER,
            spacing: { after: 4000 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Versión: ", bold: true }),
                new TextRun({ text: version }),
                new TextRun({ text: "\nFecha: ", bold: true, break: 1 }),
                new TextRun({ text: new Date().toLocaleDateString() }),
            ],
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
            text: "",
            pageBreakBefore: true // Forzar salto de página después de la portada
        })
    ];
};

// 2. Sections & Headers
const createSectionHeader = (text) => new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { color: COLORS.PRIMARY, space: 1, value: "single", size: 12 } }
});

const createSubHeader = (text) => new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    color: COLORS.ACCENT
});

// 3. Text Components
const createPara = (text) => new Paragraph({
    children: [new TextRun({ text, font: FONTS.BODY, size: 24 })],
    spacing: { after: 150 },
    alignment: AlignmentType.JUSTIFIED
});

// 4. Special Boxes (Warning, Tip, Note)
const createInfoBox = (title, text, bgColor, borderColor) => {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: title, bold: true, size: 24, font: FONTS.BODY }),
                                    new TextRun({ text: "\n" + text, size: 24, font: FONTS.BODY })
                                ],
                                spacing: { before: 100, after: 100 }
                            })
                        ],
                        shading: { fill: bgColor },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
                            bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
                            left: { style: BorderStyle.SINGLE, size: 12, color: borderColor }, // Borde izquierdo grueso
                            right: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
                        },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    })
                ]
            })
        ],
        spacing: { after: 200 } // Espacio después de la tabla
    });
};

// 5. Visual Step Table (Instruction | Image Placeholder)
const createStepTable = (steps) => {
    const rows = steps.map((step, index) => {
        return new TableRow({
            children: [
                // Columna 1: Instrucción
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${index + 1}. `, bold: true, size: 28, color: COLORS.PRIMARY }),
                                new TextRun({ text: step.title, bold: true, size: 24 }),
                                new TextRun({ text: "\n\n" + step.description, size: 22 })
                            ],
                            spacing: { after: 100 }
                        })
                    ],
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    verticalAlign: AlignmentType.CENTER,
                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                }),
                // Columna 2: Placeholder visual
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `[CAPTURA: ${step.visual}]`,
                                    font: FONTS.CODE,
                                    size: 20,
                                    color: "666666"
                                })
                            ],
                            alignment: AlignmentType.CENTER
                        })
                    ],
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    verticalAlign: AlignmentType.CENTER,
                    shading: { fill: "F2F2F2" }, // Fondo gris para el placeholder
                    borders: {
                        top: { style: BorderStyle.DASHED, size: 2, color: "CCCCCC" },
                        bottom: { style: BorderStyle.DASHED, size: 2, color: "CCCCCC" },
                        left: { style: BorderStyle.DASHED, size: 2, color: "CCCCCC" },
                        right: { style: BorderStyle.DASHED, size: 2, color: "CCCCCC" },
                    },
                    margins: { top: 400, bottom: 400, left: 100, right: 100 } // Margen interno grande para "espacio"
                })
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows,
        spacing: { after: 300 }
    });
};

// --- CONTENIDO MANUALES ---

const ManualCarretillero = {
    title: "OPERATIVA DE CARRETILLEROS",
    role: "OPERARIO DE LOGÍSTICA",
    content: [
        createSectionHeader("1. Introducción y Acceso"),
        createPara("Este manual describe el flujo de trabajo para la ubicación de material sin uso de escáneres, seleccionando manualmente el Artículo y la Orden de Fabricación (OF)."),

        createSubHeader("1.1 Inicio de Sesión"),
        createStepTable([
            { title: "Acceder a la Web", description: "Abra el navegador en la tablet y entre en la dirección de la aplicación.", visual: "Pantalla de Login" },
            { title: "Introducir Credenciales", description: "Escriba su usuario y contraseña. Pulse 'ENTRAR'.", visual: "Formulario de usuario y contraseña" },
            { title: "Seleccionar Rol", description: "Si se le pregunta, elija 'CARRETILLERO'.", visual: "Selector de rol" }
        ]),

        createSectionHeader("2. Entrada de Material (Asignación)"),
        createInfoBox("IMPORTANTE", "NO se utilizan códigos QR. Debe tener clara la referencia del artículo y la OF antes de empezar.", COLORS.WARNING_BG, COLORS.WARNING_BORDER),

        createSubHeader("2.1 Selección de Artículo y OF"),
        createStepTable([
            { title: "Pantalla Principal", description: "Verá un panel de control. Pulse en 'ENTRADA DE MATERIAL' o 'ASIGNAR'.", visual: "Dashboard Principal" },
            { title: "Buscar Artículo", description: "En el campo 'Artículo', empiece a escribir el nombre o código. Seleccione el correcto de la lista desplegable.", visual: "Dropdown de búsqueda de artículo" },
            { title: "Ingresar OF", description: "Escriba manualmente el número de la Orden de Fabricación (OF) en el campo correspondiente.", visual: "Campo de texto para OF" },
            { title: "Validar", description: "Pulse 'BUSCAR UBICACIÓN' o 'SIGUIENTE'. El sistema verificará si el artículo existe.", visual: "Botón de acción" }
        ]),

        createSubHeader("2.2 Asignación de Ubicación"),
        createStepTable([
            { title: "Mapa del Almacén", description: "Se mostrará un mapa visual. \nVerde = Libre \nRojo = Ocupado \nNaranja = Prioridad.", visual: "Mapa de racks con colores" },
            { title: "Seleccionar Hueco", description: "Toque sobre un recuadro VERDE en el rack deseado.", visual: "Dedo pulsando una ubicación verde" },
            { title: "Confirmación", description: "Aparecerá una ventana resumen. Verifique: Artículo, OF y Ubicación. Pulse 'CONFIRMAR'.", visual: "Modal de confirmación" },
            { title: "Éxito", description: "Verá un mensaje verde 'Asignación Correcta'.", visual: "Toast de éxito" }
        ]),

        createSectionHeader("3. Movimiento de Material"),
        createPara("Para cambiar un palet de sitio sin sacarlo del sistema."),
        createStepTable([
            { title: "Ir a 'Mover'", description: "En el menú, seleccione 'MOVER MERCANCÍA'.", visual: "Icono de movimiento" },
            { title: "Identificar Origen", description: "Seleccione manualmente el Artículo y OF, o la ubicación de origen en el mapa.", visual: "Selección de origen" },
            { title: "Seleccionar Destino", description: "Toque la nueva ubicación (debe estar VERDE) en el mapa.", visual: "Selección de destino" },
            { title: "Ejecutar Movimiento", description: "Pulse 'CONFIRMAR MOVIMIENTO'.", visual: "Botón confirmar" }
        ]),

        createSectionHeader("4. Solución de Problemas"),
        createTable_Troubleshooting([
            { problem: "El artículo no aparece en la lista", cause: "No está dado de alta en el sistema", solution: "Avise al Jefe de Sección para que lo cree." },
            { problem: "Mapa en blanco", cause: "Fallo de conexión", solution: "Recargue la página (F5) o verifique el Wifi." },
            { problem: "Error 'OF Duplicada'", cause: "Esa OF ya está ubicada", solution: "Use la función 'BUSCAR' para ver dónde está." }
        ])
    ]
};

const ManualJefe = {
    title: "GESTIÓN Y SUPERVISIÓN",
    role: "JEFE DE SECCIÓN",
    content: [
        createSectionHeader("1. Funciones de Supervisión"),
        createPara("El Jefe de Sección tiene control total sobre el inventario y la estructura del almacén."),

        createSubHeader("1.1 Búsqueda Avanzada"),
        createStepTable([
            { title: "Acceder a 'Inventario'", description: "Pulse en la pestaña 'INVENTARIO' del menú superior.", visual: "Pestaña Inventario" },
            { title: "Usar Filtros", description: "Puede filtrar por: \n- Artículo \n- OF \n- Cliente \n- Estado (Bloqueado/Disponible).", visual: "Barra de filtros avanzados" },
            { title: "Visualizar Detalles", description: "Pulse en cualquier fila para ver el historial de movimientos de ese palet.", visual: "Detalle de item" }
        ]),

        createSectionHeader("2. Gestión de Estructura"),
        createInfoBox("PRECAUCIÓN", "Modificar la estructura (añadir/borrar racks) afecta a las ubicaciones existentes. Hágalo con cuidado.", COLORS.TIP_BG, COLORS.TIP_BORDER),
        createStepTable([
            { title: "Panel de Administración", description: "Entre en 'ADMINISTRACIÓN' > 'ESTRUCTURA'.", visual: "Menú estructura" },
            { title: "Añadir Ubicación", description: "Seleccione el Pasillo y Rack. Pulse '+ AÑADIR HUECO'.", visual: "Botón añadir" },
            { title: "Bloquear Ubicación", description: "Si una estantería está rota, márquela como 'BLOQUEADA' para que nadie asigne carga ahí.", visual: "Toggle de bloqueo" }
        ]),

        createSectionHeader("3. Reportes"),
        createPara("Exportación de datos para análisis externo."),
        createStepTable([
            { title: "Exportar Excel", description: "En la vista de Inventario, pulse el botón 'EXPORTAR EXCEL'.", visual: "Botón Excel" },
            { title: "Reporte de Ocupación", description: "Vaya a 'ANÁLISIS' para ver gráficas de % de ocupación por pasillo.", visual: "Gráficos de tarta/barras" }
        ])
    ]
};

const ManualAdmin = {
    title: "ADMINISTRACIÓN DEL SISTEMA",
    role: "ADMINISTRADOR GLOBAL",
    content: [
        createSectionHeader("1. Configuración Global"),
        createPara("Configuraciones que afectan a toda la aplicación."),
        createStepTable([
            { title: "Gestión de Usuarios", description: "Crear, Editar y Eliminar usuarios. Asignar roles (Carretillero, Jefe, Admin).", visual: "Tabla de usuarios" },
            { title: "Backups", description: "Descargar copia de seguridad de la base de datos (JSON).", visual: "Botón Backup" }
        ]),

        createSectionHeader("2. Mensajería Global"),
        createStepTable([
            { title: "Nueva Notificación", description: "Escriba un mensaje para que aparezca en las tablets de todos los operarios.", visual: "Formulario de mensaje" },
            { title: "Prioridad", description: "Alta (Rojo, requiere confirmación) o Normal (Azul, informativo).", visual: "Selector de prioridad" }
        ])
    ]
};

// Helper específico para troubleshooting
function createTable_Troubleshooting(items) {
    const rows = [
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({ children: [new Paragraph({ text: "PROBLEMA", bold: true })], shading: { fill: COLORS.TABLE_HEADER }, width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: "POSIBLE CAUSA", bold: true })], shading: { fill: COLORS.TABLE_HEADER }, width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: "SOLUCIÓN", bold: true })], shading: { fill: COLORS.TABLE_HEADER }, width: { size: 40, type: WidthType.PERCENTAGE } }),
            ]
        })
    ];

    items.forEach(item => {
        rows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph(item.problem)] }),
                new TableCell({ children: [new Paragraph(item.cause)] }),
                new TableCell({ children: [new Paragraph(item.solution)] }),
            ]
        }));
    });

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows, borders: { insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" } } });
}


// --- GENERACIÓN DE ARCHIVOS ---

async function generateDoc(filename, manualData) {
    const doc = new Document({
        styles: {
            default: {
                heading1: { run: { font: FONTS.TITLE, size: 32, bold: true, color: COLORS.PRIMARY } }, // 16pt
                heading2: { run: { font: FONTS.TITLE, size: 28, bold: true, color: COLORS.ACCENT } },  // 14pt
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } // Márgenes normales
                }
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "GESTOR DE ESTANTERÍAS - DANI", size: 18, color: "999999" })
                            ],
                            alignment: AlignmentType.RIGHT,
                            border: { bottom: { color: "CCCCCC", space: 1, value: "single", size: 6 } }
                        })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Página ", size: 20 }),
                                PageNumber.CURRENT,
                                new TextRun({ text: " de ", size: 20 }),
                                PageNumber.TOTAL_PAGES
                            ],
                            alignment: AlignmentType.CENTER,
                            border: { top: { color: "CCCCCC", space: 1, value: "single", size: 6 } }
                        })
                    ]
                })
            },
            children: [
                ...createCoverPage(manualData.title, manualData.role, "2.0"),
                ...manualData.content
            ],
        }],
    });

    try {
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(filename, buffer);
        console.log(`✅ Documento generado: ${filename}`);
    } catch (error) {
        console.error(`❌ Error generando ${filename}:`, error);
    }
}

async function main() {
    console.log("🚀 Iniciando generación de manuales PREMIUM (v2.0)...");

    await generateDoc("Manual_Carretillero_v2.docx", ManualCarretillero);
    await generateDoc("Manual_Jefe_Seccion_v2.docx", ManualJefe);
    await generateDoc("Manual_Admin_v2.docx", ManualAdmin);

    console.log("✨ Proceso completado. Manuales generados con estilo profesional.");
}

main();
