const docx = require('docx');
const fs = require('fs');

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = docx;

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
              text: "Informe de Informacion Tecnica",
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
              text: "Arquitectura, integracion, logica funcional y activos generados",
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
              text: "Documento tecnico interno - uso confidencial",
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
              text: "El proyecto 004 ESTANTERIAS ha dado lugar a una aplicacion corporativa para gestion de almacenes y control de inventario capaz de gestionar ubicaciones en tiempo real, escanear productos mediante codigos de barras y QR, proporcionar asistencia logistica mediante inteligencia artificial y soportar operaciones offline en entornos industriales con conectividad limitada. El sistema integra 31 funciones cloud, 157 componentes React, un motor OCR multi-estrategia y un sistema completo de comunicacion interna para las secciones de planta.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 0. ALCANCE TECNICO DEL PROYECTO
        new Paragraph({
          children: [
            new TextRun({
              text: "0. ALCANCE TECNICO DEL PROYECTO",
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
              text: "La solucion desarrollada cubre de forma integrada frontend de gestion, servicios de negocio, capa de sincronizacion en tiempo real con Firebase, validaciones de persistencia, motor de busqueda con IA, sistema offline completo, OCR multi-estrategia, comunicacion interna y modulos de exportacion. El proyecto se ha construido como software propio adaptado al proceso interno de la empresa, con un total estimado de 54.666 lineas de codigo fuente distribuidas en 304 archivos.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Capa\tFuncion principal\tResultado tecnico",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Frontend (React + TypeScript)\t157 componentes para gestion de estanterias, escaneo, admin y reportes.\tInterfaz unificada para kioscos, tablets industriales y escritorios.",
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Backend (Firebase Cloud Functions)\t31 funciones cloud para inventario, notificaciones, IA y produccion.\tLogica de negocio escalable con transacciones multi-documento.",
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion Firebase\tFirestore, Auth, Functions, Storage, Cloud Messaging.\tSincronizacion en tiempo real y persistencia fiable.",
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Motor de IA\tOCR (Google Cloud Vision + Tesseract.js) y conteo de piezas (Claude Opus).\tAsistencia logistica con busqueda semantica y analisis visual.",
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Sistema Offline\tCola de 9 tipos de operaciones con cross-tab locking y sync bidireccional.\tOperatividad completa sin conexion con resolucion automatica de conflictos.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 1. ARBOL ACTUAL DEL PROYECTO
        new Paragraph({
          children: [
            new TextRun({
              text: "1. ARBOL ACTUAL DEL PROYECTO",
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
              text: "A continuacion se recoge un arbol tecnico resumido del proyecto vigente, actualizado al estado actual del repositorio:",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "ESTANTERIAS/",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── aplicacion/ (157 componentes React + 147 modulos TS = 54.666 LOC)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── components/ (operative, admin, app, shelf, scanner, common, auth, chapero, views)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── hooks/ (47 hooks personalizados + 8 workflows)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── lib/ (api/ 17 modulos, schema/ 18 archivos, offline/ 9 archivos, optimistic/)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   └── domain/ (auth, reprocesos, shelves - logica pura de negocio)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── servidor/ (20 modulos TypeScript = 4.868 LOC)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── inventory.ts (1.440 LOC) - Core de inventario con 8 operaciones",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── notifications.ts (577 LOC) - Sistema de notificaciones multi-tipo",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── admin.ts (391 LOC) - Gestion de usuarios, dispositivos y auditoria",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── production.ts (366 LOC) - Maquina de estados de produccion",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   ├── ocr.ts + pieceCounter.ts - Integracion IA (Cloud Vision + Claude Opus)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "│   └── chat.ts, conversations.ts, urgency.ts, urgentAlerts.ts - Comunicacion",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── docs/ (funcional/, arquitectura/, reference/, sesiones/)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "├── scripts/ (26 scripts operacionales + 1 migracion + 16 utilidades)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "└── infrastructure/ + package.json + firebase.json",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 2. ARQUITECTURA LOGICA DE LA SOLUCION
        new Paragraph({
          children: [
            new TextRun({
              text: "2. ARQUITECTURA LOGICA DE LA SOLUCION",
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
              text: "La arquitectura del sistema sigue un patron Feature-Based Hybrid que combina organizacion por dominio funcional, capa de hooks personalizados, dominio de logica pura, API layer encapsulada y sistema offline dedicado. Esta disenada para mantenibilidad, escalabilidad y operatividad en entornos industriales con conectividad limitada.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Stack Tecnologico:",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Frontend: React 19.2 + TypeScript 5.8 + Vite 6.2 + Zustand 5.0 + Tailwind CSS 3.4",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Backend: Firebase Cloud Functions (Node.js 22) + Firestore + Auth + Storage + FCM",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "IA: Google Cloud Vision (OCR) + Anthropic Claude Opus 4.8 (conteo de piezas) + Tesseract.js (fallback local)",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Escaneo: html5-qrcode + BarcodeDetector API nativa",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Exportacion: ExcelJS para informes y reportes",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Flujo de Datos:",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Usuario → Componente (TSX) → Hook (useShelf, useOperativeShelf) → API Module (lib/api/*) → Firebase Firestore/Cloud Functions → Firestore onSnapshot → Zustand Store → Componente re-render",
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Offline: → Offline Queue (lib/offline/) → Cuando hay conexion: drain queue → Sync bidireccional → Conflict resolution",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 3. MODULOS FUNCIONALES IMPLEMENTADOS
        new Paragraph({
          children: [
            new TextRun({
              text: "3. MODULOS FUNCIONALES IMPLEMENTADOS",
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
              text: "El sistema consta de 12 modulos funcionales principales, cada uno con responsabilidades claras y bien delimitadas:",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.1 Motor Operativo Unico (OperativeShelfArea - 1.200+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El corazon del sistema. Un componente compartido por KIOSKO, CARRETILLERO, JEFE_SECCION, CALIDAD y ADMIN que garantiza comportamiento identico de flujo para todos los roles. Incluye 6 acciones principales (UBICAR, RETIRAR, MOVER, REUBICAR, ENVIAR ALMACEN, AVISAR), modo lote para multiples articulos, validacion de contiguidad, soporte multi-seccion y deteccion automatica de fantasma (ghost detection) para evitar duplicaciones.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.2 Sistema de Escaneo y OCR (6 componentes - 2.500+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Pipeline multi-estrategia: Cloud Vision (premium) → Tesseract.js local con 4 variantes de preprocessing y 2 modos PSM. Incluye deteccion de nitidez en tiempo real (Laplacian variance), early exit al 72% de confianza y parsing de hojas de ruta de Solmicro ERP. Soporte para codigos de barras, QR y OCR de etiquetas industriales.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.3 Sistema Offline Completo (9 archivos - 3.000+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Cola de 9 tipos de operaciones (UBICAR, RETIRAR, MOVER, AVISAR, etc.) con persistencia en localStorage, schema versioning, exponential backoff, cross-tab locking para evitar drain concurrente, sync bidireccional y resolucion automatica de conflictos. Garantiza operatividad completa sin conexion en entornos industriales.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.4 Panel de Administracion (8 tabs - 4.000+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Gestion completa de usuarios, dispositivos, estanterias, ubicaciones especiales, jefes de seccion, monitorizacion de conexiones, deteccion de duplicados y sistema de mensajes. Incluye operaciones manuales completas con drag-and-drop, batch mode y ghost check.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.5 Sistema de Autenticacion y Permisos (8 roles - 1.500+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "8 roles de usuario (SUPERADMIN, ADMIN, JEFE_SECCION, CARRETILLERO, OPERARIO, CALIDAD, RECEPCIONES, SOLO_VISUAL) con autenticacion dual (Firebase Anonymous para kioscos + Email/Password para usuarios registrados). Sistema de permisos por seccion con reglas de acceso cruzado entre secciones relacionadas.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.6 Sistema de Comunicacion Interna (chat, mensajes, alertas - 2.000+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Chat general con auto-cleanup, conversaciones privadas con resolucion de miembros, push notifications via FCM con multicast batch de 500 tokens, alertas urgentes con sistema de fallback modal para dispositivos offline, cola de recogida para carretilleros y monitorizacion de conexiones en tiempo real.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.7 Integracion con Produccion (maquina de estados - 366 lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Flujo de 3 pasos: withdrawToWorking (estanteria → EN_TRABAJO) → finishWorking (EN_TRABAJO → FINALIZADO) → locateWorking (FINALIZADO → nueva estanteria). Todas las operaciones son transacciones atomicas que mantienen consistencia entre ubicaciones, presencias, agregados e historial.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.8 Motor de Inventario Core (shelfOperate - 1.440 lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "8 operaciones de inventario: ubicar, ubicarMulti, retirar, retirarDeUbicacion, mover, reubicar, enviarAlmacen, emptyShelf. Incluye espejo URG MEC-PRE para ubicaciones compartidas, deduplicacion por presenceId, limite de seguridad de 500 presencias por agregado, normalizacion MEC/PME y transacciones compensatorias para emptyShelf con control docs.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.9 Sistema de Reprocesos (calidad - 1.000+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Gestion de articulos de reproceso en ubicaciones CAL 001-022 con控制 de cantidad e importe para conocimiento del capital parado en reprocesos. Editor integrado en celda con visibilidad segun configuracion de estanteria.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.10 Sistema de Carros y Suministros (carts + supplies - 155 lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Gestion de carros de soldadura (CSO, CXP, CRP) con operaciones de agregar, retirar y mover items. Sistema de suministros para soldadura con gestion de stock por seccion.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.11 Workflow System (7 workflows - 2.500+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Workflows especializados: Assign (asignacion), Batch (lotes), Finish (finalizacion), Move (movimiento), Relocation (reubicacion completa), Remove (retirada), Request (solicitudes de materiales). Cada workflow encapsula un flujo de negocio complejo con validaciones y pasos secuenciales.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "3.12 Schema Layer (18 archivos - 3.000+ lineas)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Definicion completa de tipos TypeScript para collections, appConfig, shelves, locations, devices, users, roles, sections, kiosks, chat, connectionStatus y documents. Schema-driven data modeling para consistencia y mantenibilidad.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 4. INNOVACIONES TECNICAS RELEVANTES
        new Paragraph({
          children: [
            new TextRun({
              text: "4. INNOVACIONES TECNICAS RELEVANTES",
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
              text: "El proyecto incorpora multiples innovaciones tecnicas que lo diferencian de soluciones WMS comerciales estandar:",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.1 Motor Operativo Unico (Shared UI Pattern)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Un solo componente (OperativeShelfArea) alimentado por un hook generico (useOperativeShelf) sirve para 5 roles diferentes. La configuracion por rol (RoleOperativeConfig) determina que acciones estan habilitadas, pero el JSX es identico. Esto garantiza que es imposible que los flujos diverjan entre roles.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.2 Ghost Detection (Deteccion de Ya Ubicado)",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Antes de ubicar un articulo, el sistema verifica globalmente si ya existe en alguna estanteria. Si existe, pregunta si es un parcial adicional o si hay que quitarlo de la ubicacion anterior. Esto evita duplicaciones criticas en inventario.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.3 Contiguity Validation",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Al ubicar en multiples posiciones, el sistema valida que las posiciones sean contiguas (adyacentes). Si no lo son, muestra un error con el motivo, evitando configuraciones fisicamente imposibles en la estanteria.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.4 URG MEC-PRE Twin Mirroring",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Las secciones PRENSAS y MECANIZADO comparten fisicamente 4 ubicaciones urgentes. El sistema crea un gemelo digital que espeja automaticamente cada operacion entre ambas secciones, garantizando consistencia del dato en tiempo real.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.5 OCR Multi-estrategia con Fallback Inteligente",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El sistema intenta Cloud Vision (premium) primero, y si falla o no esta disponible, cae automaticamente a Tesseract.js local con 4 variantes de preprocessing y 2 modos PSM. Incluye deteccion de nitidez en tiempo real y early exit al 72% de confianza.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.6 Offline Queue con Cross-Tab Locking",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La cola de operaciones offline usa un mecanismo de locking entre pestanas del navegador para evitar que multiples pestanas drenen la cola simultaneamente, lo que causaria duplicados. Incluye schema versioning para migraciones futuras.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.7 Unified Scanner Pipeline",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Todos los metodos de entrada (barras, QR, OCR, manual) convergen en un unico parser (qrParser.ts, 458 lineas) que soporta multiples formatos de codificacion y normaliza la salida.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.8 Kiosk Detection Automatica",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "El sistema detecta automaticamente si se esta ejecutando en un kiosko (dispositivo fijo) o en un navegador general, ajustando la interfaz y permisos sin configuracion manual.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.9 AI-Powered Piece Counting",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion del modelo Claude Opus 4.8 de Anthropic con thinking adaptativo para conteo de piezas de chapa apilada. Incluye modos stacked y loose, prompts personalizados para entorno industrial y retorno de count, confidence, range, reasoning y warnings.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "4.10 Urgent Alert Fallback System",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Sistema dual de alertas urgentes: push notification para dispositivos online + documento persistente pendingAlerts para dispositivos offline. Al reconectarse, el dispositivo muestra un modal rojo bloqueante hasta que se reconozca la alerta.",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 5. TRAZABILIDAD DEL DESARROLLO Y ESFUERZO TECNICO
        new Paragraph({
          children: [
            new TextRun({
              text: "5. TRAZABILIDAD DEL DESARROLLO Y ESFUERZO TECNICO",
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
              text: "La construccion del proyecto ha requerido una dedicacion estimada de 480 horas, distribuidas entre analisis, arquitectura, implementacion, pruebas, correcciones e implantacion. Este esfuerzo responde a un desarrollo real de software y no a una simple configuracion estandar. La complejidad del sistema justifica esta inversion dado que integra multiples areas especializadas: arquitectura de aplicaciones React de gran escala, integracion con servicios cloud, computer vision, sistemas offline-first, seguridad por roles y experiencia de usuario en entornos industriales.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Fase tecnica\tHoras\tDetalle",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Analisis y diseno\t48 h\tDefinicion del modelo funcional y tecnico del sistema, casuisticas de negocio.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Arquitectura y modelo de datos\t52 h\tOrganizacion de capas, entidades, flujos de sincronizacion y esquemas.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Implementacion del nucleo\t168 h\tMotor operativo, inventario, escaneo, offline, autenticacion.",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Integracion IA y comunicacion\t72 h\tOCR multi-estrategia, conteo de piezas, chat, notificaciones.",
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
              text: "Hardware y equipamiento\t32 h\tTablets, lectores, soportes, configuracion de dispositivos.",
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

        // 6. ACTIVOS TECNICOS Y RESULTADOS GENERADOS
        new Paragraph({
          children: [
            new TextRun({
              text: "6. ACTIVOS TECNICOS Y RESULTADOS GENERADOS",
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
              text: "Activo generado\tDescripcion tecnica\tEstado",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Aplicacion corporativa operativa\t54.666 lineas de codigo en 304 archivos con 157 componentes React.\tImplantado",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Backend Cloud Functions\t31 funciones cloud con 4.868 lineas de logica de negocio.\tImplantado",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Sistema de IA\tOCR multi-estrategia (Cloud Vision + Tesseract.js) y conteo de piezas (Claude Opus).\tImplantado",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Sistema offline\tCola de 9 tipos de operaciones con cross-tab locking y sync bidireccional.\tImplantado",
              size: 24,
            }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Documentacion de soporte\tExcel ejecutivo, memorias justificativa y tecnica, documentos fiscales.\tDisponible",
              size: 24,
            }),
          ],
          spacing: { after: 400 },
        }),

        // 7. CONCLUSION TECNICA
        new Paragraph({
          children: [
            new TextRun({
              text: "7. CONCLUSION TECNICA",
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
              text: "Desde una perspectiva tecnica, el proyecto 004 ESTANTERIAS ha supuesto el desarrollo de una solucion propia, estructurada y funcionalmente compleja, orientada a resolver necesidades internas especificas de gestion de almacenes, control de inventario y busqueda asistida por IA. El sistema no se limita a almacenar informacion, sino que incorpora reglas, validaciones, sincronizacion en tiempo real, resolucion de conflictos de concurrencia, operatividad offline y automatizacion que constituyen un activo tecnologico util para la organizacion.",
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "La complejidad técnica del sistema es de nivel empresarial alto, con 54.666 lineas de codigo, 31 funciones cloud, 8 roles de usuario, 12 secciones de fabricacion y multiples integraciones con servicios de IA. Las innovaciones tecnicas identificadas (motor operativo unico, ghost detection, contiguity validation, OCR multi-estrategia, cross-tab offline locking, URG twin mirroring) son soluciones proprietary que no existen en soluciones WMS comerciales estandar.",
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
              text: "Responsable tecnico\tDaniel Soler Perez",
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
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Fecha\tJulio 2026",
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
              text: "Lineas de codigo\t54.666 (frontend: 54.666 + backend: 4.868)",
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
              text: "Naturaleza del desarrollo\tSoftware propio para mejora de procesos internos",
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
  fs.writeFileSync('f:\\01_ADMINISTRACIÓN\\05 DIRECCION = INVERSIONES\\2026\\00 AUTOMATIZACIONES IA --\\004 ESTANTERIAS\\004 ESTANTERIAS - DOCUMENTO TECNICO FUNCIONAMIENTO.docx', buffer);
  console.log('Documento tecnico v2.0 actualizado correctamente');
};

saveDocument().catch(console.error);