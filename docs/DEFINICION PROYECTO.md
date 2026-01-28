# DEFINICIÓN DEL PROYECTO - GESTOR DE ESTANTERÍAS

## Resumen del Proyecto

**Gestor de Estanterías** es una aplicación web Progressive Web App (PWA) diseñada para la gestión integral de inventario de almacenes industriales en tiempo real. La aplicación permite a los operarios de carretilla elevadora, supervisores y administradores controlar el flujo de materiales a través de múltiples secciones de producción (Mecanizado, Plegado, Soldadura, Robot de Plegado, Repasado, Pintura, Calidad, Zincado, etc.).

### Usuarios Objetivo
- **ADMIN**: Administradores del sistema con acceso completo a configuración y reportes
- **JEFE**: Supervisores con capacidades de gestión y análisis
- **CARRETILLERO**: Operarios de almacén que realizan movimientos de material diarios
- **CHAPERO**: Personal de chapistería con acceso limitado para consulta de conteo

### Funcionalidades Principales
1. **Gestión de Ubicaciones Multi-almacén**: Sistema de códigos estructurados para identificar ubicaciones exactas (ej: `MEC-E1-B2-IZQ`)
2. **Trazabilidad Completa**: Seguimiento histórico de cada artículo desde su entrada hasta su salida
3. **Workflows de Producción**: Estados EN_TRABAJO y FINALIZADO para seguimiento de ciclo productivo
4. **Escaneo QR/Código de Barras**: Integración con `html5-qrcode` para captura rápida de artículos y ubicaciones
5. **Integración IA (Gemini)**: Reconocimiento OCR de etiquetas físicas, análisis de anomalías, predicción de ubicaciones y conteo visual de chapas metálicas
6. **Sistema de Notificaciones Push**: Alertas en tiempo real mediante Firebase Cloud Messaging
7. **Lead Time Tracking**: Seguimiento de tiempos de recepción y disponibilidad de pedidos inbound
8. **Sistema de Chat Interno**: Comunicación entre usuarios del sistema
9. **Reportes y Analytics**: Exportación a Excel, reportes de anomalías, métricas de rotación

---

## Stack Tecnológico

### Frontend
| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **React** | 19.2.0 | Framework principal para UI declarativa y componentes reutilizables |
| **TypeScript** | ~5.8.2 | Tipado estático para mayor robustez y mantenibilidad del código |
| **Vite** | 6.2.0 | Build tool ultrarrápido con Hot Module Replacement (HMR) |
| **TailwindCSS** | CDN | Framework CSS utility-first para diseño responsive rápido |
| **Lucide React** | 0.562.0 | Librería de iconos moderna y ligera |

### Backend & Infraestructura
| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **Firebase Firestore** | 12.6.0 | Base de datos NoSQL en tiempo real para sincronización instantánea |
| **Firebase Auth** | 12.6.0 | Autenticación segura con gestión de roles (Custom Claims) |
| **Firebase Functions** | Node.js | Cloud Functions para lógica serverless (triggers, callable functions) |
| **Firebase Hosting** | - | Hosting estático con CDN global |
| **Firebase Cloud Messaging** | 12.6.0 | Notificaciones push multiplataforma |

### Integraciones de IA
| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **Google Gemini API** | @google/genai 0.14.0 | Modelo LLM multi-modal para OCR, análisis de inventario, detección de anomalías |
| **Modelo Utilizado** | gemini-1.5-flash | Optimizado para velocidad y costo en operaciones frecuentes |

### Utilidades
| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **html5-qrcode** | 2.3.8 | Lectura de códigos QR y códigos de barras mediante cámara del dispositivo |
| **XLSX (SheetJS)** | latest | Generación de archivos Excel para reportes de inventario |
| **React Markdown** | 10.1.0 | Renderizado de respuestas formateadas de Gemini AI |

### Justificación de Arquitectura
- **Firebase**: Elegido por su capacidad de sincronización en tiempo real crítica para operaciones de almacén donde múltiples usuarios acceden simultáneamente
- **React + TypeScript**: Garantiza escalabilidad con componentes modulares fuertemente tipados
- **Gemini AI**: Permite automatización de tareas manuales (lectura de etiquetas físicas, conteo visual) reduciendo errores humanos
- **Progressive Web App**: Funcionalidad offline y experiencia nativa sin instalación desde tiendas

---

## Arquitectura y Estructura

### Patrón de Diseño
La aplicación sigue una **arquitectura modular basada en componentes** con separación clara de responsabilidades:

```
APP -- ESTANTERIAS/
│
├── App.tsx                    # Componente raíz, lógica de estado global y orquestación
├── index.tsx                  # Entry point de React
├── index.html                 # Shell HTML con configuración PWA
│
├── components/                # 62 componentes React reutilizables
│   ├── LoginScreen.tsx
│   ├── LandingScreen.tsx
│   ├── AdminPanel.tsx        # Panel de administración
│   ├── Scanner.tsx           # Lector QR/Barcode
│   ├── AssignmentList.tsx    # Vista principal de inventario
│   ├── MoveItemModal.tsx     # Flujo de movimiento de artículos
│   ├── WarehouseMap.tsx      # Visualización geolocalizada
│   ├── GeminiButton.tsx      # Integración IA
│   ├── PhotoAnalyzerModal.tsx # OCR de etiquetas físicas
│   ├── LeadTimeModal.tsx     # Gestión de tiempos logísticos
│   └── ...                   # Otros 52 componentes especializados
│
├── lib/                      # 15 módulos de lógica de negocio
│   ├── firebase.ts          # Configuración SDK Firebase
│   ├── warehouseData.ts     # Tipos TypeScript y constantes del dominio
│   ├── inventoryTransactions.ts # Transacciones ACID en Firestore
│   ├── gemini.ts            # Cliente API Gemini con rate limiting
│   ├── excelExport.ts       # Generación de reportes Excel
│   ├── production.ts        # Lógica de estados EN_TRABAJO/FINALIZADO
│   ├── push.ts              # Sistema de notificaciones FCM
│   └── ...
│
├── hooks/                    # 18 React Hooks personalizados
│   ├── useAssignments.ts    # Gestión estado de asignaciones
│   ├── useRoles.ts          # Control de acceso basado en roles
│   ├── useInventoryOperations.ts # Operaciones CRUD de inventario
│   ├── useGeminiAnalysis.ts # Interfaz con Gemini AI
│   ├── useChatSystem.ts     # Sistema de mensajería
│   └── ...
│
├── functions/                # Firebase Cloud Functions (Backend)
│   └── src/
│       └── index.ts         # 650 líneas - Triggers y Callable Functions
│
├── firestore.rules          # Reglas de seguridad Firestore (190 líneas)
├── firestore.indexes.json   # Índices compuestos optimizados
├── firebase.json            # Configuración deploy y hosting
└── .env.local               # Variables de entorno (API keys)
```

### Principios Arquitectónicos

1. **Atomic Design**: Componentes pequeños y enfocados que se combinan en vistas complejas
2. **Custom Hooks Pattern**: Lógica de negocio encapsulada en hooks reutilizables para separar UI de lógica
3. **Transactional Updates**: Uso de transacciones Firestore (`inventoryTransactions.ts`) para garantizar consistencia de datos en operaciones críticas
4. **Offline-First**: LocalStorage para caché y Firestore offline persistence
5. **Role-Based Access Control (RBAC)**: Validación tanto en cliente (hooks/useRoles.ts) como en Firestore Rules

### Flujo de Datos

```mermaid
graph TD
    A[Usuario en Dispositivo Móvil/Desktop] -->|Autenticación| B[Firebase Auth]
    B --> C[App.tsx - Estado Global]
    C --> D[Custom Hooks]
    D --> E[Firestore - Base de Datos]
    D --> F[Cloud Functions]
    E --> G[Real-time Listeners]
    G --> C
    F --> H[Gemini API]
    F --> I[Firebase Cloud Messaging]
    I --> A
    E --> J[Firestore Rules - Validación]
```

**Sincronización en Tiempo Real**:
- Los componentes suscriben listeners a colecciones Firestore mediante hooks
- Cambios de cualquier usuario propagan automáticamente a todos los dispositivos conectados
- Conflictos gestionados mediante transacciones optimistas con `runTransaction()`

---

## Flujos Principales

### 1. Autenticación y Control de Acceso

**Implementación**: `components/LoginScreen.tsx`, `hooks/useRoles.ts`, `firestore.rules`

**Flujo**:
1. Usuario introduce credenciales → Firebase Auth valida
2. Sistema consulta documento `users/{uid}` para obtener rol (ADMIN/JEFE/CARRETILLERO/CHAPERO)
3. Custom Claims se sincronizan con el token de autenticación
4. UI renderiza funcionalidades según rol (ej: ADMIN ve panel de configuración, CARRETILLERO no)
5. Firestore Rules validan operaciones en servidor independientemente del cliente

**Roles y Permisos**:
| Rol | Lectura | Escritura Inventario | Admin Panel | Reportes IA | Gestión Usuarios |
|-----|---------|---------------------|-------------|-------------|-----------------|
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| JEFE | ✓ | ✓ | Parcial | ✓ | ✗ |
| CARRETILLERO | ✓ | ✓ | ✗ | ✗ | ✗ |
| CHAPERO | ✓ | ✗ | ✗ | ✗ | ✗ |

---

### 2. Asignación de Material a Ubicación (Workflow Principal)

**Implementación**: `App.tsx::processScanInput()`, `components/AssignmentModal.tsx`, `lib/inventoryTransactions.ts`

**Flujo Técnico**:
```
1. Usuario escanea código QR/Barcode del artículo
   ↓ [Scanner.tsx + html5-qrcode]
2. Sistema valida código mediante lib/codeValidation.ts
   ↓
3. Usuario escanea ubicación destino (ej: "MEC-E1-B2-MEC 045")
   ↓ [LocationScanner.tsx]
4. Sistema verifica:
   - Ubicación existe en configuración dinámica (meta/warehouseConfig)
   - No hay duplicados exactos (barcode + orderId)
   - Ubicación no está al 100% capacidad
   ↓
5. Si ubicación ocupada → Modal de confirmación (merge/new_batch)
   ↓
6. Transacción Firestore:
   - Leer estado actual de assignments/{warehouse}/locations/{locationId}
   - Agregar nuevo item a array 'items'
   - Crear entrada en collection 'history' (action: 'assigned')
   - Timestamp automático con serverTimestamp()
   ↓ [assignItemTransaction()]
7. Real-time update → UI se actualiza en todos los dispositivos
```

**Validación de Integridad**:
- **Client-side**: Validación optimista para UX rápida
- **Server-side**: Firestore Rules validan schema (firestore.rules líneas 66-73)
- **Transacciones**: Evitan race conditions cuando múltiples usuarios asignan simultáneamente

---

### 3. Workflow de Producción (EN_TRABAJO → FINALIZADO)

**Implementación**: `lib/production.ts`, `hooks/useWorkingItems.ts`, `components/WorkingItemsList.tsx`

**Estados del Ciclo de Vida**:
```
UBICADO (en estantería)
    ↓ [Usuario inicia trabajo]
EN_TRABAJO (retirado de estantería, en zona productiva)
    ↓ [Usuario marca como terminado]
FINALIZADO (material procesado, listo para siguiente fase)
```

**Flujo Técnico**:
1. **Inicio de Trabajo**:
   - Carretillero escanea artículo en ubicación
   - Sistema mueve registro de `assignments/{wh}/locations/{loc}` a `workingItems/{itemKey}`
   - Item se asocia a sección productiva: `PLEGADORA`, `MECANIZADO`, `SOLDADURA`, etc. (getSectionFromLocation())
   - Timestamp `withdrawnAt` para métricas de tiempo

2. **Finalización**:
   - Usuario confirma proceso terminado desde vista "En Trabajo"
   - Sistema mueve de `workingItems/` a `finishedItems/`
   - Entry en `history` con action: 'process_finished'
   - Trigger Cloud Function actualiza Lead Time si es pedido inbound

**Secciones Productivas** (definidas en `warehouseData.ts`):
```typescript
WAREHOUSE_TO_SECTION = {
  MEC: "MECANIZADO",
  PLE: "PLEGADORA",
  RPL: "ROBOT_PLEGADO",
  SOL/RSO/SXP: "SOLDADURA",
  REP/PIN/ZIN: "REPASADO",
  CAL: "OTROS" (Calidad),
  COM: "OTROS" (Comodín)
}
```

---

### 4. Integración con Gemini AI - Casos de Uso

**Implementación**: `lib/gemini.ts` (client), `functions/src/index.ts::generateGeminiResponse()` (server)

#### 4.1 OCR de Etiquetas Físicas
**Caso de Uso**: Operario fotografía etiqueta pegada en pallet para extraer artículo + orden

**Flow**:
```
Usuario captura foto → [PhotoAnalyzerModal.tsx]
  ↓
Imagen base64 enviada a Cloud Function
  ↓
Cloud Function llama Gemini 1.5-flash con prompt:
  "Extrae JSON {article, orderId} de la etiqueta. Article: código alfanumérico. OrderId: empieza por OF."
  ↓
Response Schema validado (Gemini JSON Mode):
  { "article": string, "orderId": string }
  ↓
Sistema rellena automáticamente campos del formulario
```

**Prompt Engineering** (líneas 108-111 de functions/src/index.ts):
- Instrucciones específicas sobre patrones (ej: "OF" para órdenes)
- Fallback a string vacío si dato no encontrado (evita errores)

#### 4.2 Detección de Anomalías en Inventario
**Caso de Uso**: Admin audita estado del almacén buscando artículos duplicados, ubicaciones sobrecargadas, movimientos sospechosos

**Datos Analizados**:
- Artículos con multiple ubicaciones simultáneas (duplicados)
- Ubicaciones con >3 items (alta densidad)
- Historial de 50 últimas transacciones (patrones anómalos)

**Output Estructurado**:
```typescript
{
  summary: string (markdown),
  anomalies: [{
    type: 'duplicate' | 'overload' | 'suspicious_movements' | 'underused',
    severity: 'low' | 'medium' | 'high',
    locationId: string,
    articleId: string,
    description: string,
    suggestions: string
  }],
  recommendations: string
}
```

#### 4.3 Predicción de Ubicación Probable
**Caso de Uso**: Usuario busca artículo no localizado, IA predice dónde podría estar basado en histórico

**Algoritmo** (determinista + IA):
1. Sistema consulta historial del artículo (20 registros recientes)
2. Identifica ubicaciones actuales en Firestore
3. Gemini analiza patrones históricos y sugiere ubicaciones con probabilidad 0-100

#### 4.4 Conteo Visual de Chapas Metálicas
**Implementación**: `ChaperoCountView.tsx`, function `metalCount` en Cloud Function

**Problema Resuelto**: Contar manualmente chapas en pilas es tedioso y propenso a errores

**Flujo**:
```
Usuario captura foto lateral de pila de chapas
  ↓
Introduce material (ej: "Acero") y grosor nominal (ej: 3mm)
  ↓
Gemini recibe prompt científico avanzado:
  - Detectar patrón repetitivo luz-sombra en bordes
  - Discriminar sombras vs separaciones físicas
  - Validar coherencia altura teórica vs real
  ↓
Response: { estimatedCount, theoreticalBlockHeightMm, confidence, reasoning, visualNotes }
```

**Prompt Especializado** (líneas 260-295):
- Técnicas de visión artificial (escaneo de patrones, validación de espesor)
- Sanity checks (altura física = N chapas × grosor)
- Instrucciones conservadoras ("ante la duda, NO cuentes")

---

### 5. Sistema de Notificaciones Push

**Implementación**: `lib/push.ts`, `functions/src/index.ts::notifyCarretilleroRequest()`

**Trigger**: Cuando un usuario crea solicitud de material (notification con targetRole="CARRETILLERO")

**Arquitectura**:
```
1. Usuario ADMIN/JEFE crea solicitud desde AdminPanel.tsx
   ↓
2. Sistema inserta doc en collection 'notifications' con targetRole
   ↓
3. Cloud Function trigger (onCreate) se dispara
   ↓
4. Query Firestore: WHERE role == 'CARRETILLERO'
   ↓
5. Extrae FCM tokens de cada Carretillero
   ↓
6. Firebase Cloud Messaging envía multicast a todos los tokens
   ↓
7. Service Worker (firebase-messaging-sw.js) muestra notificación nativa
   ↓
8. Cleanup: Tokens inválidos se eliminan automáticamente
```

**Payload de Notificación**:
```javascript
{
  tokens: string[],
  notification: {
    title: "Nueva Solicitud - [Material]",
    body: "Tienes una nueva solicitud pendiente."
  },
  data: {
    url: "/?view=requests",
    requestId: string,
    priority: "high"
  }
}
```

---

### 6. Lead Time y Tracking Inbound

**Implementación**: `components/LeadTimeModal.tsx`, `hooks/useInboundOrders.ts`, Cloud Functions

**Propósito**: Medir tiempos de recepción de pedidos a proveedores para identificar cuellos de botella

**Timestamps Clave**:
- **T0 - fecha_solicitud**: Cuando se solicita pedido al proveedor
- **T1 - fecha_prometida**: Fecha comprometida por proveedor
- **T2 - fecha_recepcion_muelle**: Cuando llega a muelle de recepción
- **T3 - fecha_disponible_estanteria**: Cuando está ubicado en estantería (automático via trigger)

**Métricas Calculadas**:
```typescript
leadTimeTotalDays = T3 - T0         // Ciclo completo
leadTimeExternalDays = T2 - T0      // Responsabilidad proveedor
leadTimeInternalDays = T3 - T2      // Responsabilidad operaciones internas
deviationDays = T2 - T1             // Retraso vs. promesa
isLate = (deviationDays > 0)
```

**Cloud Function Trigger** (onAssignmentWrite):
- Detecta nuevos items ubicados en estantería
- Actualiza automáticamente `fecha_disponible_estanteria` en `inboundOrders/{orderNumber}`
- Marca estado como 'DISPONIBLE'

**Reporte IA** (leadTimeAIReport):
- Analiza dataset de pedidos finalizados
- Identifica artículos con permanencia excesiva (>30 días)
- Genera recomendaciones operativas en Markdown

---

### 7. Sistema de Chat Interno

**Implementación**: `components/MessagesView.tsx`, `hooks/useChatSystem.ts`

**Colecciones Firestore**:
```
chats/{chatId}
  ├── participants: string[]           // UIDs participantes
  ├── lastMessage: string
  └── updatedAt: timestamp
  └── messages/{messageId}
      ├── text: string
      ├── senderId: string
      ├── timestamp: timestamp
      └── read: boolean
```

**Seguridad** (firestore.rules líneas 128-156):
- Solo participantes pueden leer mensajes del chat
- Validación de `participants` array en creación
- Subcollection messages hereda control de acceso del parent

**Features**:
- Lista de conversaciones con último mensaje
- Badge de mensajes no leídos
- Real-time updates mediante onSnapshot()

---

### 8. Configuración Dinámica de Almacenes

**Implementación**: `components/AdminPanel.tsx`, `hooks/useWarehouseConfig.ts`

**Problema**: El código original tenía almacenes hardcodeados. Nueva implementación permite agregar/eliminar almacenes sin deploy.

**Document Firestore** (`meta/warehouseConfig`):
```typescript
{
  warehouses: string[],                    // ["MEC", "PLE", "SOL", ...]
  warehouseNames: Record<string, string>,  // { "MEC": "Mecanizado", ... }
  shelves: number[],                       // [1, 2, 3]
  racks: number[],                         // [1, 2, 3]
  positions: string[]                      // ["IZQ", "CENTRO", "DRCH"]
}
```

**Beneficios**:
- Admin puede crear "ROB.PLE" (Robot Plegado) sin modificar código
- Cambios se reflejan en tiempo real en todos los dispositivos
- Validaciones de ubicación se adaptan dinámicamente

---

## Configuración Técnica

### Prerrequisitos
- **Node.js**: v18+ (recomendado v20)
- **npm**: v9+
- **Cuenta Firebase**: Plan Blaze (funciones requieren facturación)
- **Gemini API Key**: Obtenible en [Google AI Studio](https://ai.google.dev/)

### Variables de Entorno

Archivo: `.env.local`
```bash
GEMINI_API_KEY=your_gemini_api_key_here
VITE_FIREBASE_VAPID_KEY=your_firebase_vapid_key_for_push_notifications
```

**Configuración en Firebase Functions**:
```bash
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
```

### Configuración de Firebase

**Config hardcodeada en `lib/firebase.ts`**:
```typescript
{
  apiKey: "AIzaSyARd3U4v2dLciTswSbnaKI2YgXnzUTap70",
  authDomain: "gestion-de-estanterias.firebaseapp.com",
  projectId: "gestion-de-estanterias",
  storageBucket: "gestion-de-estanterias.firebasestorage.app",
  messagingSenderId: "570794350818",
  appId: "1:570794350818:web:ba71424870eb1a87f0e6bb",
  measurementId: "G-6VPFSYWH8M"
}
```

### Instalación y Ejecución Local

#### 1. Clonar e Instalar Dependencias
```bash
cd "C:\-- APLICACIONES DANI --\APP -- ESTANTERIAS"
npm install
```

#### 2. Configurar Variables de Entorno
```bash
# Crear archivo .env.local con las claves correspondientes
echo "GEMINI_API_KEY=tu_clave_aqui" > .env.local
echo "VITE_FIREBASE_VAPID_KEY=tu_vapid_key_aqui" >> .env.local
```

#### 3. Ejecutar en Desarrollo
```bash
npm run dev
# Servidor Vite se inicia en http://localhost:5173
```

#### 4. Build de Producción
```bash
npm run build
# Output en carpeta ./dist
```

#### 5. Preview de Build
```bash
npm run preview
# Sirve build de producción localmente para pruebas
```

### Deploy a Firebase Hosting

#### 1. Instalar Firebase CLI (si no está instalado)
```bash
npm install -g firebase-tools
firebase login
```

#### 2. Deploy de Functions + Hosting
```bash
# Deploy completo
firebase deploy

# Solo hosting
firebase deploy --only hosting

# Solo functions
firebase deploy --only functions
```

**Proceso**:
1. Build: `npm run build` → genera `./dist`
2. Firebase uploa `./dist` a CDN global
3. Cloud Functions se despliegan en regiones configuradas
4. Firestore Rules e Indexes se actualizan

### Índices Firestore Requeridos

**Archivo**: `firestore.indexes.json`

Los índices compuestos críticos son:
```json
{
  "collectionGroup": "history",
  "fields": [
    { "fieldPath": "barcode", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

**Deployment**:
```bash
firebase deploy --only firestore:indexes
```

**Nota**: Índices se crean automáticamente al desplegar. Si Firestore lanza error de "index required", la consola Firebase proporcionará link directo para crear el índice.

---

### Testing

#### Testing Manual (No hay tests automatizados implementados)

**Flujo Crítico a Validar**:
1. **Login**: Probar cada rol (ADMIN, JEFE, CARRETILLERO) y verificar permisos
2. **Asignación**: Escanear artículo → escanear ubicación → verificar aparece en tabla
3. **Movimiento**: Mover item de una ubicación a otra → verificar histórico registra 'relocated'
4. **Workflow Producción**: Marcar EN_TRABAJO → verificar desaparece de estantería → Marcar FINALIZADO → verificar aparece en finalizados
5. **Gemini OCR**: Fotografiar etiqueta física → verificar extracción correcta de datos
6. **Notificaciones**: Crear solicitud → verificar Carretillero recibe push
7. **Concurrencia**: Dos usuarios asignando al mismo tiempo → verificar no hay duplicados

#### Testing de Seguridad

**Firestore Rules Test** (archivo incluido: `firestore.rules`):
```bash
# Ejecutar emulator local con reglas
firebase emulators:start
```

**Validaciones**:
- Usuario no autenticado no puede leer/escribir
- CARRETILLERO no puede escribir en `meta/warehouseConfig`
- Solo participantes de chat pueden leer mensajes

---

### Monitoreo y Logs

**Firebase Console**:
- Functions logs: https://console.firebase.google.com/project/gestion-de-estanterias/functions
- Firestore usage: Métricas de reads/writes por día
- Auth users: Panel de usuarios registrados

**Client-side Logging**:
- Errores se capturan con `console.error()` (considerar integrar Sentry en producción)

**Rate Limiting**:
- Gemini API: 10 requests/minuto/usuario (configurado en functions/src/index.ts línea 16)
- Implementación in-memory (no persiste entre cold starts)

---

### Resolución de Problemas Comunes

#### 1. "Gemini API Key not configured"
**Solución**:
```bash
firebase functions:config:set gemini.key="YOUR_API_KEY"
firebase deploy --only functions
```

#### 2. "Index required" en Firestore
**Solución**: Hacer clic en el link del error o ejecutar:
```bash
firebase deploy --only firestore:indexes
```

#### 3. Notificaciones push no funcionan
**Checklist**:
- VAPID key configurada en `.env.local`
- Service Worker registrado correctamente (check DevTools → Application → Service Workers)
- Usuario concedió permisos de notificaciones en navegador
- Token FCM guardado en `users/{uid}.fcmTokens`

#### 4. Transacciones fallan con "Document not found"
**Causa**: Race condition entre lectura y escritura
**Solución**: Verificar que `inventoryTransactions.ts` usa `runTransaction()` correctamente (ya implementado)

---

### Estructura de Datos Firestore

#### Collections Principales

##### 1. `users/{uid}`
```typescript
{
  email: string,
  role: 'ADMIN' | 'JEFE' | 'CARRETILLERO' | 'CHAPERO',
  displayName: string,
  fcmTokens?: string[],        // Tokens para push notifications
  createdAt: timestamp,
  lastLogin?: timestamp
}
```

##### 2. `assignments/{warehouseCode}/locations/{locationId}`
```typescript
{
  items: AssignmentItem[],     // Array de artículos en esa ubicación
  updatedAt: serverTimestamp
}

// AssignmentItem structure:
{
  barcode: string,             // Código artículo (ej: "ABC-12345")
  orderId: string,             // Orden de Fabricación (ej: "OF-98765")
  timestamp: ISO8601,          // Última modificación
  assignedAt?: ISO8601,        // Primera asignación
  movedAt?: ISO8601,           // Último movimiento
  status?: 'UBICADO',
  packageType?: 'PALLET' | 'CAJA_GRANDE' | 'CAJA_PEQUENA',
  notes?: string
}
```

##### 3. `workingItems/{itemKey}`
```typescript
{
  barcode: string,
  orderId: string,
  status: 'EN_TRABAJO',
  section: 'PLEGADORA' | 'MECANIZADO' | 'SOLDADURA' | ...,
  fromLocationId: LocationId,
  withdrawnAt: ISO8601,
  withdrawnBy?: string (uid)
}
```

##### 4. `finishedItems/{itemKey}`
```typescript
{
  id: string,                  // itemKey (barcode__orderId)
  barcode: string,
  orderId: string,
  status: 'FINALIZADO',
  finishedAt: ISO8601,
  finishedBy?: string,
  packageType?: PackageType,
  timestamp: ISO8601
}
```

##### 5. `history/{entryId}`
```typescript
{
  barcode: string,
  orderId?: string,
  action: 'assigned' | 'removed' | 'relocated' | 'copied' | 'requested' | 'process_finished' | 'admin_cleared' | 'moved_to_working',
  fromLocation?: LocationId,
  toLocation?: LocationId,
  timestamp: ISO8601,
  user?: string (uid),
  details?: string,
  opId?: string                // Idempotency key
}
```

##### 6. `inboundOrders/{orderNumber}`
```typescript
{
  orderNumber: string,
  supplierId: string,
  supplierName: string,
  status: 'BORRADOR' | 'SOLICITADO' | 'EN_TRANSITO' | 'EN_MUELLE' | 'PARCIAL' | 'DISPONIBLE' | 'CANCELADO',
  
  // Timestamps Lead Time
  fecha_solicitud: ISO8601,
  fecha_prometida?: ISO8601,
  fecha_recepcion_muelle?: ISO8601,
  fecha_disponible_estanteria?: ISO8601 (auto),
  
  createdAt: ISO8601,
  createdBy: uid,
  updatedAt: ISO8601,
  updatedBy: uid
}
```

##### 7. `notifications/{notificationId}`
```typescript
{
  type: string,
  title: string,
  message: string,
  targetRole?: 'CARRETILLERO' | 'ADMIN',
  fromUid: string,
  toUid?: string,              // Si es notification individual
  timestamp: ISO8601,
  read: boolean,
  metadata?: {
    priority: 'normal' | 'high',
    requestId?: string
  }
}
```

##### 8. `chats/{chatId}/messages/{messageId}`
```typescript
// Chat document
{
  participants: string[],      // Array de UIDs
  lastMessage: string,
  updatedAt: timestamp
}

// Message subdocument
{
  text: string,
  senderId: string (uid),
  timestamp: ISO8601,
  read: boolean
}
```

##### 9. `meta/warehouseConfig`
```typescript
{
  warehouses: string[],        // ["MEC", "PLE", "SOL", ...]
  warehouseNames: { [code: string]: string },
  shelves: number[],
  racks: number[],
  positions: string[],
  updatedAt: timestamp,
  updatedBy: uid
}
```

---

## Características Técnicas Avanzadas

### 1. Transacciones ACID
**Archivo**: `lib/inventoryTransactions.ts`

**Operaciones Implementadas**:
- `assignItemTransaction()`: Asignación atómica con validación de duplicados
- `removeItemTransaction()`: Eliminación segura con fuzzy matching si solo hay 1 barcode
- `moveItemTransaction()`: Movimiento atómico entre ubicaciones (remove + assign en single transaction)

**Beneficios**:
- Evita race conditions cuando 2 usuarios asignan al mismo tiempo
- Rollback automático si cualquier paso falla
- Historial consistente siempre

### 2. Real-Time Synchronization
**Implementación**: Custom Hooks con `onSnapshot()`

```typescript
// Ejemplo de useAssignments.ts
const unsubscribe = onSnapshot(query, (snapshot) => {
  const newData = {};
  snapshot.forEach(doc => {
    newData[doc.id] = doc.data().items;
  });
  setAssignments(newData);
});
```

**Optimización**:
- Queries con índices compuestos para reducir reads
- Pagination en listas grandes (implementado en History)
- Unsubscribe on unmount para evitar memory leaks

### 3. Progressive Web App (PWA)
**Configuración**: `index.html`, `public/manifest.webmanifest`

**Features**:
- **Installable**: Icono en home screen mobile
- **Offline Capability**: Service Worker cachea assets estáticos
- **Push Notifications**: Integración con Firebase Cloud Messaging
- **Theme Color**: Meta tags para barra de estado nativa

**Service Worker** (firebase-messaging-sw.js):
```javascript
// Registrado en index.html líneas 75-86
navigator.serviceWorker.register('/firebase-messaging-sw.js')
```

### 4. Rate Limiting y Seguridad
**Cloud Functions** (functions/src/index.ts líneas 14-31):

```typescript
const RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 10;

checkRateLimit(uid);  // Throws error si excede límite
```

**Input Sanitization** (líneas 33-49):
- Eliminación de caracteres de control
- Limitación a 5000 caracteres por string
- Sanitización recursiva de objetos/arrays

**Firestore Rules Schema Validation**:
```javascript
function isValidHistoryEntry() {
  let data = request.resource.data;
  return data.keys().hasAll(['action', 'timestamp']) 
         && (data.action is string)
         && (data.timestamp is string);
}
```

### 5. Error Handling Robusto
**Patrón Utilizado**: Result Pattern

```typescript
export type TransactionResult<T = void> = {
    success: boolean;
    data?: T;
    error?: string;
};

// Usage
const result = await assignItemTransaction(...);
if (!result.success) {
  alert(`Error: ${result.error}`);
  return;
}
```

**Gemini Error Types**:
```typescript
class GeminiError extends Error {
  type: 'PARSE' | 'NETWORK' | 'API' | 'UNKNOWN';
  originalError?: any;
}
```

### 6. Idempotency en Operaciones Críticas
**Implementación**: Campo `opId` opcional en transacciones

```typescript
// Si se reinstaúra misma operación con mismo opId, se ignora
const exists = currentItems.some(i => i.barcode === barcode && i.orderId === orderId);
if (exists) return; // Idempotent success
```

---

## Roadmap y Mejoras Futuras

Basándome en el código actual, potenciales mejoras incluirían:

### Testing
- Implementar tests unitarios con Vitest
- Tests E2E con Playwright para workflows críticos
- Tests de Firestore Rules con Firebase Emulator Suite

### Performance
- Implementar virtual scrolling para listas de >1000 items
- Lazy loading de componentes pesados con React.lazy()
- Optimizar bundle size (actualmente sin code splitting)

### Monitoring
- Integrar Sentry para error tracking
- Google Analytics para métricas de uso
- Custom events para tracking de workflows

### Features
- Multi-idioma (i18n) para expansión internacional
- Dark mode mejorado (actualmente implementado con Tailwind)
- Bulk operations para mover múltiples items simultáneamente
- Integración con ERP externo vía API

---

## Conclusión

**Gestor de Estanterías** es una solución enterprise-grade para gestión de inventario en tiempo real, combinando tecnologías modernas (React, Firebase, Gemini AI) con patrones arquitectónicos robustos (transacciones ACID, RBAC, rate limiting). El sistema está diseñado para escalar horizontalmente gracias a Firestore y soporta operaciones concurrentes de múltiples usuarios sin conflictos.

La integración de IA mediante Gemini automatiza tareas manuales críticas (OCR, conteo visual, análisis de anomalías), reduciendo errores humanos y aumentando eficiencia operativa. El diseño PWA garantiza experiencia nativa en dispositivos móviles, fundamental para operarios de almacén que trabajan con scanners portátiles.

**Métricas Clave del Proyecto**:
- **Líneas de Código**: ~150,000+ líneas (incluyendo dependencias)
- **Componentes React**: 62
- **Custom Hooks**: 18
- **Cloud Functions**: 5 (1 callable principal + 4 triggers/callables)
- **Colecciones Firestore**: 9 principales
- **Roles de Usuario**: 4 (ADMIN, JEFE, CARRETILLERO, CHAPERO)
- **Secciones Productivas**: 7 (MECANIZADO, PLEGADORA, SOLDADURA, etc.)
