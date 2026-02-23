
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import fs from 'fs';

// --- CONFIGURACIÓN DE ESTILOS ---
const FONTS = {
    TITLE: "Arial",
    BODY: "Calibri",
    CODE: "Consolas"
};

const COLORS = {
    PRIMARY: "2E74B5", // Azul corporativo
    WARNING: "C65911", // Naranja
    ERROR: "C00000",   // Rojo
    SUCCESS: "548235"  // Verde
};

// --- HELPER FUNCTIONS ---

const createTitle = (text) => new Paragraph({
    text: text,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    border: { bottom: { color: "auto", space: 1, value: "single", size: 6 } }
});

const createHeading1 = (text) => new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { color: COLORS.PRIMARY, space: 1, value: "single", size: 6 } }
});

const createHeading2 = (text) => new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 }
});

const createPara = (text, bold = false, color = "000000") => new Paragraph({
    children: [new TextRun({ text, font: FONTS.BODY, size: 24, bold, color })], // size 24 = 12pt
    spacing: { after: 150 }
});

const createStep = (text, stepNumber) => new Paragraph({
    children: [
        new TextRun({ text: `${stepNumber}. `, font: FONTS.BODY, size: 24, bold: true, color: COLORS.PRIMARY }),
        new TextRun({ text: text, font: FONTS.BODY, size: 24 })
    ],
    spacing: { after: 150, left: 400 },
    indent: { left: 400, hanging: 400 } // Sangría francesa para pasos largos
});

const createNote = (text) => new Paragraph({
    children: [
        new TextRun({ text: "NOTA: ", font: FONTS.BODY, size: 22, bold: true, color: "666666" }),
        new TextRun({ text: text, font: FONTS.BODY, size: 22, italics: true, color: "666666" })
    ],
    spacing: { before: 100, after: 100, left: 800 },
    border: { left: { color: "CCCCCC", space: 5, value: "single", size: 12 } } // Borde lateral estilo cita
});

const createWarning = (text) => new Paragraph({
    children: [
        new TextRun({ text: "⚠️ IMPORTANTE: ", font: FONTS.BODY, size: 22, bold: true, color: COLORS.WARNING }),
        new TextRun({ text: text, font: FONTS.BODY, size: 22, color: COLORS.WARNING })
    ],
    spacing: { before: 100, after: 200, left: 800 }
});

const createScreenshotPlaceholder = (description) => {
    return new Paragraph({
        children: [
            new TextRun({
                text: `[CAPTURA DE PANTALLA: ${description}]`,
                font: FONTS.CODE,
                size: 20,
                color: "FFFFFF",
                bold: true
            })
        ],
        alignment: AlignmentType.CENTER,
        shading: { fill: "5B9BD5" }, // Fondo azul claro para destacar
        spacing: { before: 200, after: 200 },
        border: {
            top: { style: "dashed", size: 2, color: "888888" },
            bottom: { style: "dashed", size: 2, color: "888888" },
            left: { style: "dashed", size: 2, color: "888888" },
            right: { style: "dashed", size: 2, color: "888888" },
        }
    });
};

// --- CONTENIDO DE LOS MANUALES ---

const MANUAL_CARRETILLERO = [
    createTitle("MANUAL DE OPERACIONES: CARRETILLERO"),
    createPara("Este documento detalla los procedimientos estándar para la gestión de inventario utilizando la aplicación 'Gestor de Estanterías'."),

    // CAPÍTULO 1: ACCESO
    createHeading1("1. Acceso y Configuración Inicial"),
    createStep("Abra la aplicación en su dispositivo móvil o tablet.", 1),
    createStep("Introduzca sus credenciales (Usuario y Contraseña) proporcionadas por el administrador.", 2),
    createScreenshotPlaceholder("Pantalla de Login con campos de usuario y contraseña"),
    createStep("Seleccione su rol como 'CARRETILLERO' si se le solicita.", 3),
    createWarning("Asegúrese de tener permisos de cámara habilitados en el navegador para usar el escáner."),

    // CAPÍTULO 2: ESCANEO
    createHeading1("2. Escaneo de Mercancía"),
    createPara("El escáner es la herramienta principal para identificar productos y ubicaciones."),
    createStep("En la pantalla principal, pulse el botón grande 'ESCANEAR QR'.", 1),
    createScreenshotPlaceholder("Botón principal 'Escanear QR'"),
    createStep("Apunte la cámara hacia el código QR o de barras del producto.", 2),
    createNote("Mantenga el dispositivo estable a unos 15-20cm del código."),
    createStep("El sistema emitirá una vibración (feedback háptico) y un sonido al leer correctamente.", 3),
    createStep("Si el código es válido, se abrirá automáticamente la ventana de asignación.", 4),
    createStep("Si hay un error, verá un mensaje en rojo. Limpie la etiqueta o mejore la iluminación.", 5),

    // CAPÍTULO 3: ASIGNACIÓN
    createHeading1("3. Asignación de Ubicaciones (Entrada de Material)"),
    createPara("Una vez escaneado un producto, debe asignarlo a una estantería."),
    createStep("Verifique que la información del producto (Nombre, ID) en la ventana emergente es correcta.", 1),
    createScreenshotPlaceholder("Modal de Asignación con datos del producto"),
    createStep("Observe el mapa visual del almacén. Los colores indican el estado:", 2),
    createPara("   • Verde: Ubicación Libre (Disponible)", false, COLORS.SUCCESS),
    createPara("   • Rojo: Ubicación Ocupada", false, COLORS.ERROR),
    createPara("   • Naranja: Ubicación Sugerida/Urgente (Prioridad)", false, COLORS.WARNING),
    createStep("Pulse sobre una ubicación 'Verde' para seleccionarla.", 3),
    createNote("Para asignación masiva, active el interruptor 'Modo Lote' y seleccione múltiples casillas."),
    createStep("Una vez seleccionada la ubicación, el botón 'CONFIRMAR' se activará.", 4),
    createStep("Pulse 'CONFIRMAR' para guardar la ubicación.", 5),
    createStep("Verifique que aparece el mensaje 'Asignación completada con éxito'.", 6),

    // CAPÍTULO 4: MOVER MERCANCÍA
    createHeading1("4. Mover Mercancía (Reubicación)"),
    createPara("Utilice esta función para cambiar un palet o caja de sitio."),
    createStep("En el menú principal, seleccione 'MOVER MERCANCÍA'.", 1),
    createStep("Escanee el código del producto que desea mover.", 2),
    createScreenshotPlaceholder("Modal de Movimiento mostrando ubicación origen"),
    createStep("El sistema mostrará la 'Ubicación Actual' del producto.", 3),
    createStep("Seleccione la 'Nueva Ubicación' en el mapa visual.", 4),
    createWarning("No puede mover un producto a una ubicación que ya está ocupada (Rojo)."),
    createStep("Pulse 'CONFIRMAR MOVIMIENTO'.", 5),

    // CAPÍTULO 5: INCIDENCIAS
    createHeading1("5. Reporte de Incidencias"),
    createPara("Si encuentra material dañado o ubicaciones en mal estado."),
    createStep("Pulse el botón 'REPORTAR INCIDENCIA' (icono de alerta).", 1),
    createScreenshotPlaceholder("Formulario de Incidencias"),
    createStep("Seleccione el tipo de incidencia (Ej: 'Material Dañado', 'Etiqueta Ilegible').", 2),
    createStep("Si es necesario, pulse 'TOMAR FOTO' para adjuntar evidencia visual.", 3),
    createStep("Añada una breve descripción en el campo de texto.", 4),
    createStep("Pulse 'ENVIAR REPORTE'.", 5)
];

const MANUAL_JEFE = [
    createTitle("MANUAL DE OPERACIONES: JEFE DE SECCIÓN"),
    createPara("Este documento incluye las funciones avanzadas de supervisión y gestión de estructura."),

    // (Incluir funciones básicas si se desea, o referenciar al manual de carretillero. Aquí las resumimos para completitud)
    createHeading1("1. Funciones de Operario"),
    createPara("Como Jefe de Sección, tiene acceso a todas las funciones de los carretilleros (Escaneo, Asignación, Movimiento). Consulte el Manual de Carretillero para detalles operativos básicos."),

    // CAPÍTULO 2: GESTIÓN DE ESTRUCTURA
    createHeading1("2. Gestión de Estructura del Almacén"),
    createPara("Puede modificar la disposición física del almacén desde el panel de control."),
    createStep("Navegue a la pestaña 'ESTRUCTURA' en el Panel de Administración.", 1),
    createScreenshotPlaceholder("Pestaña Estructura en Panel Admin"),
    createStep("Para AÑADIR elementos:", 2),
    createPara("   a. Seleccione el Almacén objetivo."),
    createPara("   b. Introduzca el número de Pasillo, Rack y Altura."),
    createPara("   c. Pulse 'AÑADIR UBICACIÓN'."),
    createStep("Para ELIMINAR elementos:", 3),
    createPara("   a. Seleccione la ubicación específica en el listado."),
    createPara("   b. Pulse el icono de 'Papelera' junto a la ubicación."),
    createWarning("Eliminar una ubicación con stock asignado generará una alerta de inconsistencia."),

    // CAPÍTULO 3: ANÁLISIS
    createHeading1("3. Análisis de Inventario e IA"),
    createPara("Utilice las herramientas de IA para optimizar el flujo de trabajo."),
    createStep("Vaya a la pestaña 'ANÁLISIS'.", 1),
    createScreenshotPlaceholder("Dashboard de Análisis con gráficos"),
    createStep("Pulse 'EJECUTAR ANÁLISIS DE INVENTARIO' para obtener un resumen del estado actual.", 2),
    createStep("Revise el gráfico de 'Ocupación por Pasillo' para detectar cuellos de botella.", 3),
    createStep("Pulse 'DETECTAR ANOMALÍAS' para que la IA busque ubicaciones incoherentes (ej: productos mezclados).", 4),

    // CAPÍTULO 4: REPORTES
    createHeading1("4. Generación de Reportes"),
    createStep("En la pestaña 'DATOS', localice la sección 'Exportar'.", 1),
    createStep("Pulse 'DESCARGAR EXCEL' para obtener un volcado completo del inventario.", 2),
    createStep("El archivo se guardará automáticamente en su carpeta de descargas.", 3)
];

const MANUAL_ADMIN = [
    createTitle("MANUAL DE ADMINISTRACIÓN DEL SISTEMA"),
    createPara("Guía técnica para la configuración global, seguridad y mantenimiento de datos."),

    createHeading1("1. Gestión Global de Almacenes"),
    createStep("Acceda al Panel de Administración > Pestaña 'ALMACENES'.", 1),
    createScreenshotPlaceholder("Gestión de Almacenes (Crear/Borrar)"),
    createStep("Para CREAR un nuevo almacén:", 2),
    createPara("   - Pulse 'NUEVO ALMACÉN'."),
    createPara("   - Asigne un ID único y un nombre descriptivo."),
    createPara("   - Defina las dimensiones iniciales (X, Y)."),
    createStep("Para BORRAR un almacén:", 3),
    createWarning("Esta acción es irreversible y eliminará todo el historial de ese almacén."),
    createPara("   - Seleccione el almacén y pulse 'ELIMINAR'."),
    createPara("   - Confirme la acción escribiendo el nombre del almacén."),

    createHeading1("2. Gestión de Datos y Backups"),
    createStep("Vaya a la pestaña 'DATOS'.", 1),
    createStep("BACKUP MANUAL: Pulse 'REALIZAR COPIA DE SEGURIDAD' para guardar el estado actual en local.", 2),
    createStep("RESTAURACIÓN: Use 'IMPORTAR DATOS' seleccionando un archivo .json previo.", 3),
    createStep("MIGRACIÓN: Pulse 'INICIAR MIGRACIÓN' para transferir datos entre versiones de la base de datos.", 4),

    createHeading1("3. Mensajería Global"),
    createPara("Envíe notificaciones a todos los operarios conectados."),
    createStep("Acceda a la pestaña 'MENSAJERÍA'.", 1),
    createScreenshotPlaceholder("Panel de Mensajería Global"),
    createStep("Escriba el mensaje en el campo de texto (Ej: 'Parada técnica en 10 min').", 2),
    createStep("Seleccione la prioridad: Info, Alerta, o Crítica.", 3),
    createStep("Pulse 'ENVIAR A TODOS'.", 4),
    createNote("Las alertas 'Críticas' requieren que el operario pulse 'Entendido' para cerrar la ventana.")
];

// --- GENERACIÓN DE ARCHIVOS ---

async function generateDoc(filename, content) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: content,
        }],
    });

    try {
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(filename, buffer);
        console.log(`✅ Documento generado con éxito: ${filename}`);
    } catch (error) {
        console.error(`❌ Error generando ${filename}:`, error);
    }
}

async function main() {
    console.log("🚀 Iniciando generación de manuales detallados...");

    await generateDoc("Manual_Carretillero.docx", MANUAL_CARRETILLERO);
    await generateDoc("Manual_Jefe_Seccion.docx", MANUAL_JEFE);
    await generateDoc("Manual_Admin.docx", MANUAL_ADMIN); // Admin contiene todo

    console.log("✨ Proceso completado. Los manuales están listos para revisión.");
}

main();
