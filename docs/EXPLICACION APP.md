# EXPLICACIÓN EXHAUSTIVA DE LA APLICACIÓN 📘

## Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Roles y Permisos](#roles-y-permisos)
4. [Flujos de Trabajo](#flujos-de-trabajo)
5. [Estructura de Datos](#estructura-de-datos)
6. [Almacenes y Ubicaciones](#almacenes-y-ubicaciones)
7. [Funcionalidades Detalladas](#funcionalidades-detalladas)
8. [Stack Tecnológico](#stack-tecnológico)
9. [Integración con Firebase](#integración-con-firebase)
10. [Casos de Uso Avanzados](#casos-de-uso-avanzados)

---

## 1. Resumen Ejecutivo

### ¿Qué es esta aplicación?

**Sistema de Gestión de Estanterías** es una aplicación web progresiva (PWA) diseñada para **optimizar el control de inventario en planta industrial**. Permite rastrear, asignar, mover y gestionar artículos a lo largo de múltiples almacenes y secciones productivas.

### Objetivo principal

Reemplazar sistemas manuales (papel, hojas Excel) con una solución digital en tiempo real que:
- Reduce errores de ubicación
- Mejora la trazabilidad de artículos
- Agiliza la comunicación entre Jefes de Sección y Carretilleros
- Proporciona auditoría completa de movimientos
- Facilita la gestión de producción WIP (Work In Progress)

### Usuarios principales

1. **Carretilleros** (operarios de inventario)
2. **Jefes de Sección** (supervisores de área productiva)
3. **Administradores** (gestores del sistema)

---

## 2. Arquitectura del Sistema

### Diagrama de Alto Nivel

```
┌─────────────────┐
│  Frontend Web   │ ← React + TypeScript + Vite
│   (PWA/SPA)     │
└────────┬────────┘
         │
         ↓ HTTPS
┌─────────────────┐
│  Firebase       │
│  - Auth         │ ← Autenticación de usuarios
│  - Firestore    │ ← Base de datos NoSQL en tiempo real
│  - Storage      │ ← (Opcional: fotos, backups)
│  - Hosting      │ ← Despliegue de la app
└─────────────────┘
```

### Componentes Principales

#### **Frontend (React)**
- **App.tsx**: Componente raíz, maneja estado global, modales, workflows
- **Hooks personalizados**: `useRoles`, `useAssignments`, `useHistory`, `useStorage`, `useInventoryOperations`
- **Store global**: Zustand (`lib/store.ts`) para estado compartido
- **Componentes UI**: +60 componentes modulares (modales, scanners, vistas)

#### **Backend (Firebase)**
- **Firestore Collections**:
  - `assignments`: Ubicaciones y artículos asignados
  - `history`: Registro de acciones (asignación, movimiento, retiro)
  - `users`: Información de usuarios (rol, sección)
  - `config`: Configuración de almacenes
  - `finishedItems`: Artículos que completaron producción
  - `systemMessages`: Notificaciones entre usuarios

#### **Lógica de Negocio**
- **Validación de códigos**: `lib/codeValidation.ts`
- **Operaciones de inventario**: `hooks/useInventoryOperations.ts`
- **Transacciones atómicas**: `lib/inventoryTransactions.ts`
- **Workflows**: `hooks/useInventoryWorkflows.ts`

---

## 3. Roles y Permisos

### Sistema de Roles

El sistema implementa **Role-Based Access Control (RBAC)** con tres roles:

| Rol | Descripción | Sección Asignada |
|-----|-------------|------------------|
| **CARRETILLERO** | Operario de inventario | N/A |
| **JEFE** | Jefe de Sección | SÍ (MECANIZADO, PLEGADORA, SOLDADURA, REPASADO, LASER, ROBOT_PLEGADO) |
| **ADMIN** | Administrador del sistema | N/A |

### Matriz de Permisos

| Función | CARRETILLERO | JEFE | ADMIN |
|---------|-------------|------|-------|
| Escanear artículos | ✅ | ✅ | ✅ |
| Asignar artículos | ✅ | ✅ | ✅ |
| Mover artículos | ✅ | ✅ | ✅ |
| Retirar artículos (cualquier sección) | ✅ | ❌ | ✅ |
| Retirar artículos (su sección) | ✅ | ✅ | ✅ |
| Realizar solicitudes | ❌ | ✅ | ✅ |
| Recibir solicitudes | ✅ | ❌ | ✅ |
| Finalizar producción | ✅ | ✅ | ✅ |
| Exportar Excel | ✅ | ✅ | ✅ |
| Usar filtros avanzados | ❌ | ✅ | ✅ |
| Editar estructura almacenes | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ✅ |
| Analizar anomalías | ❌ | ❌ | ✅ |
| Limpiar ubicaciones masivas | ❌ | ❌ | ✅ |
| Omitir validaciones | ❌ | ❌ | ✅ |

### Implementación Técnica

**Archivo**: `hooks/useRoles.ts`

```typescript
export type UserRole = 'CARRETILLERO' | 'JEFE' | 'ADMIN';
export type WarehouseSection = "PLEGADORA" | "MECANIZADO" | "LASER" | "REPASADO" | "SOLDADURA" | "ROBOT_PLEGADO" | "OTROS";

const PERMISSIONS: Record<UserRole, RolePermissions> = {
  'CARRETILLERO': { canScan: true, canAssign: true, canRequestItems: false, ... },
  'JEFE': { canScan: true, canAssign: true, canRequestItems: true, ... },
  'ADMIN': { canScan: true, canAssign: true, canAnalyzeAnomalies: true, ... }
};
```

**Autenticación**:
1. Firebase Authentication (email + contraseña)
2. Custom Claims (almacenan rol y sección en el token JWT)
3. Firestore Collection `users` (fallback si claims no están disponibles)

**Validación dinámica**:
```typescript
const canRemove = (locationId?: string) => {
  if (role === 'ADMIN' || role === 'CARRETILLERO') return true;
  if (role === 'JEFE') {
    if (!locationId) return true;
    const locSection = getSectionFromLocation(locationId);
    return section === locSection; // Solo su sección
  }
  return false;
};
```

---

## 4. Flujos de Trabajo

### 4.1. Workflow: Asignar Artículo

**Objetivo**: Registrar un artículo en una ubicación específica.

```
[INICIO]
   ↓
[Usuario inicia "Asignar" o "Escanear"]
   ↓
[Escanea/Introduce código de barras del artículo]
   ↓
[Sistema detecta si el artículo ya existe]
   ├─ SÍ EXISTE → [Modal: ¿Mover o Añadir copia?]
   │                    ├─ Mover → [Workflow: Mover Artículo]
   │                    └─ Añadir → [Continúa con asignación normal]
   └─ NO EXISTE → [Continúa]
   ↓
[Escanea/Introduce ubicación de destino]
   ↓
[Sistema valida permisos y disponibilidad]
   ↓
[Ubicación está ocupada?]
   ├─ SÍ → [Modal: ¿Unificar lote o Nuevo lote?]
   │            ├─ Unificar → [Añade al lote existente]
   │            └─ Nuevo → [Crea lote separado, allowMultiLocation=true]
   └─ NO → [Continúa]
   ↓
[Modal: Seleccionar tipo de embalaje]
   ├─ PALLET
   ├─ CAJA_GRANDE
   └─ CAJA_PEQUENA
   ↓
[Sistema ejecuta assignItem()]
   ↓
[Firestore: Guarda en collection 'assignments']
   ↓
[Firestore: Registra en 'history' como 'assigned']
   ↓
[Notificación: "Asignado correctamente"]
   ↓
[FIN]
```

### 4.2. Workflow: Mover Artículo

**Objetivo**: Cambiar un artículo de ubicación A a ubicación B.

```
[INICIO]
   ↓
[Usuario selecciona "Mover" en un artículo O inicia workflow de mover]
   ↓
[Sistema identifica ubicación actual (fromLocation)]
   ↓
[Escanea/Introduce nueva ubicación (toLocation)]
   ↓
[Sistema valida permisos]
   ↓
[Confirmación: "¿Mover {artículo} de {A} a {B}?"]
   ↓ [Usuario confirma]
[Sistema ejecuta moveItem()]
   ├─ Firestore: Retira de assignments[fromLocation]
   ├─ Firestore: Añade a assignments[toLocation]
   └─ Firestore: Registra en 'history' como 'relocated'
   ↓
[Notificación: "Movido correctamente"]
   ↓
[FIN]
```

### 4.3. Workflow: Solicitar Artículo (Jefe → Carretillero)

**Objetivo**: Un Jefe solicita un artículo para su sección.

```
[INICIO - Jefe]
   ↓
[Jefe hace clic en "Realizar Solicitud"]
   ↓
[Escanea/Introduce código de artículo]
   ↓
[Sistema detecta ubicación actual (si existe)]
   ↓
[Confirmación: "Solicitar {artículo} de {ubicación}?"]
   ↓ [Jefe confirma]
[Sistema ejecuta requestItem()]
   ├─ Firestore: Crea mensaje en 'systemMessages'
   │    {
   │      type: "REQUEST",
   │      requester: "Jefe UID",
   │      barcode: "...",
   │      orderId: "...",
   │      location: "...",
   │      timestamp: "..."
   │    }
   └─ Notificación enviada a Carretilleros
   ↓
[FIN - Jefe espera]

[CARRETILLERO recibe notificación]
   ↓
[Ve lista en "Solicitudes Pendientes"]
   ↓
[Localiza artículo físicamente]
   ↓
[Retira artículo de ubicación]
   ↓
[Lleva artículo al Jefe]
   ↓
[Jefe o Carretillero asigna a nueva ubicación]
   ↓
[FIN]
```

### 4.4. Workflow: Finalizar Producción

**Objetivo**: Marcar un artículo como terminado y enviarlo a almacén virtual.

```
[INICIO]
   ↓
[Usuario hace clic en "Producción Finalizada"]
   ↓
[Escanea artículo terminado]
   ↓
[Sistema detecta su ubicación actual]
   ↓
[Confirmación: "¿Finalizar {artículo}?"]
   ↓ [Usuario confirma]
[Sistema ejecuta removeItem() + addFinishedItem()]
   ├─ Firestore: Retira de 'assignments'
   ├─ Firestore: Añade a 'finishedItems' con status='FINALIZADO'
   └─ Firestore: Registra en 'history' como 'process_finished'
   ↓
[Notificación: "Artículo finalizado, movido a ALMACÉN"]
   ↓
[FIN]
```

---

## 5. Estructura de Datos

### 5.1. Collection: `assignments`

**Estructura**:
```typescript
{
  [locationId: string]: AssignmentItem[]
}

// Ejemplo:
{
  "MEC-E-URGENTE-B1-MEC 001": [
    {
      barcode: "ART-12345",
      orderId: "OF-67890",
      timestamp: "2026-01-19T07:50:00Z",
      assignedAt: "2026-01-19T07:50:00Z",
      status: "UBICADO",
      packageType: "PALLET",
      itemKey: "ART-12345__OF-67890"
    }
  ],
  "SOL-E1-B1-SOL 010": [
    {
      barcode: "ART-54321",
      orderId: "OF-11111",
      timestamp: "2026-01-19T08:00:00Z",
      assignedAt: "2026-01-19T08:00:00Z",
      movedAt: "2026-01-19T08:15:00Z",
      status: "UBICADO",
      packageType: "CAJA_GRANDE",
      itemKey: "ART-54321__OF-11111"
    }
  ]
}
```

**Tipos**:
```typescript
interface AssignmentItem {
  barcode: string;          // Código del artículo
  orderId: string;          // Orden de Fabricación (OF)
  timestamp: string;        // Última modificación
  assignedAt?: string;      // Primera asignación
  movedAt?: string;         // Último movimiento
  status?: ItemStatus;      // UBICADO | EN_TRABAJO | FINALIZADO
  packageType?: PackageType; // PALLET | CAJA_GRANDE | CAJA_PEQUENA
  itemKey?: string;         // Clave única: ${barcode}__${orderId}
  notes?: string;           // Notas opcionales
}
```

### 5.2. Collection: `history`

**Estructura**:
```typescript
interface HistoryEntry {
  id: string;              // ID único del registro
  barcode: string;
  orderId?: string;
  action: ActionType;      // 'assigned' | 'removed' | 'relocated' | 'copied' | 'requested' | 'process_finished' | 'admin_cleared' | 'moved_to_working'
  fromLocation?: LocationId;
  toLocation?: LocationId;
  timestamp: string;
  user?: string;           // UID del usuario que ejecutó la acción
  details?: string;        // Información adicional
}
```

**Ejemplo**:
```typescript
{
  id: "hist-abc123",
  barcode: "ART-12345",
  orderId: "OF-67890",
  action: "relocated",
  fromLocation: "MEC-E-URGENTE-B1-MEC 001",
  toLocation: "SOL-E1-B1-SOL 010",
  timestamp: "2026-01-19T08:15:00Z",
  user: "uid-carretillero-1",
  details: "Movido por solicitud de Jefe de Soldadura"
}
```

### 5.3. Collection: `users`

**Estructura**:
```typescript
{
  [uid: string]: {
    email: string;
    role: UserRole;            // 'CARRETILLERO' | 'JEFE' | 'ADMIN'
    section?: WarehouseSection; // 'MECANIZADO' | 'PLEGADORA' | etc. (solo para JEFES)
    createdAt: string;
    lastLogin?: string;
  }
}
```

### 5.4. Collection: `finishedItems`

**Estructura**:
```typescript
interface FinishedItem {
  id: string;              // itemKey
  barcode: string;
  orderId: string;
  timestamp: string;       // Cuándo se finalizó
  finishedAt: string;
  finishedBy?: string;     // UID del usuario
  status: 'FINALIZADO';
  previousStatus?: ItemStatus;
  packageType?: PackageType;
}
```

### 5.5. Collection: `systemMessages`

**Estructura** (para solicitudes):
```typescript
{
  id: string;
  type: 'REQUEST';
  requester: string;       // UID del Jefe solicitante
  requesterName?: string;
  barcode: string;
  orderId: string;
  location?: string;       // Ubicación actual del artículo
  timestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  completedBy?: string;    // UID del Carretillero que completó
  completedAt?: string;
}
```

---

## 6. Almacenes y Ubicaciones

### 6.1. Estructura de ID de Ubicación

**Formato**: `{WAREHOUSE}-E{SHELF}-B{RACK}-{POSITION}`

**Ejemplos**:
- `MEC-E-URGENTE-B1-MEC 001` → Mecanizado, Estantería URGENTE, Balda 1, Posición MEC 001
- `SOL-E1-B1-SOL 010` → Soldadura, Estantería 1, Balda 1, Posición SOL 010
- `PLE-E1-B1-PLE C1-3` → Plegado, Estantería 1, Balda 1, Carro 1, Posición 3

### 6.2. Almacenes Disponibles

| Código | Nombre Completo | Sección | Uso |
|--------|----------------|---------|-----|
| **MEC** | Mecanizado | MECANIZADO | Piezas mecanizadas, estanterías URGENTE, GEN_A, GEN_B, GEN_C, GEN_D |
| **PLE** | Plegado | PLEGADORA | Piezas plegadas, carros C1/C2, estanterías 1_URG, 1_GEN, EST_2, PUNZONADORA |
| **SOL** | Soldadura | SOLDADURA | Piezas para soldar, estanterías 1 (urgente) y 2 |
| **RSO** | Robot Soldadura | SOLDADURA | Soldadura robotizada |
| **REP** | Repasado | REPASADO | Acabados, estanterías URGENTE, ALUMINIO, NORMAL, MODULAR |
| **PIN** | Pintura | REPASADO | Piezas pintadas, estanterías DENTRO, FUERA |
| **SXP** | Soldadura Puntos | SOLDADURA | Soldadura por puntos |
| **COM** | Comodín | OTROS | Uso flexible |
| **RPL** | Robot Plegado | ROBOT_PLEGADO | Plegado robotizado, estanterías 1 y 2 |
| **CAL** | Calidad | OTROS | Control de calidad, RECHAZOS, GENERAL |
| **ZIN** | Zincado | REPASADO | Piezas zincadas, baldas 1-5 |

### 6.3. Mapeo de Sección

**Archivo**: `lib/warehouseData.ts`

```typescript
export const WAREHOUSE_TO_SECTION: Record<string, WarehouseSection> = {
  MEC: "MECANIZADO",
  PLE: "PLEGADORA",
  RPL: "ROBOT_PLEGADO",
  SOL: "SOLDADURA",
  RSO: "SOLDADURA",
  SXP: "SOLDADURA",
  REP: "REPASADO",
  PIN: "REPASADO",
  ZIN: "REPASADO",
  CAL: "OTROS",
  COM: "OTROS"
};

export const getSectionFromLocation = (locationId: string): WarehouseSection | null => {
  // Lógica robusta para extraer sección de un locationId
  const prefix = locationId.split("-")[0];
  return WAREHOUSE_TO_SECTION[prefix] || "OTROS";
};
```

### 6.4. Ubicaciones Urgentes

El sistema identifica automáticamente ubicaciones "URGENTES" basándose en:

```typescript
export const isUrgentLocation = (locationId: string): boolean => {
  // 1. Contiene la palabra "URGENTE"
  if (locationId.includes('URGENTE')) return true;
  
  // 2. SOL: Estantería 1 (SOL-E1-...)
  if (locationId.startsWith('SOL-') && locationId.includes('-E1-')) return true;
  
  // 3. PLE: Posiciones 001 a 006
  if (locationId.startsWith('PLE-')) {
    const posMatch = locationId.match(/PLE\s(\d+)$/);
    if (posMatch && parseInt(posMatch[1]) <= 6) return true;
  }
  
  // 4. CAL: Posiciones específicas 031 y 034
  if (locationId.includes('CAL-') && (locationId.endsWith('031') || locationId.endsWith('034'))) return true;
  
  return false;
};
```

---

## 7. Funcionalidades Detalladas

### 7.1. Escaneo de Códigos

**Tecnologías**:
- **Cámara HTML5**: `getUserMedia()` API
- **OCR (Optical Character Recognition)**: Tesseract.js para reconocimiento de texto
- **Gemini AI**: Para análisis inteligente de imágenes complejas

**Componentes**:
- **Scanner.tsx**: Escáner de códigos de barras QR/DataMatrix/Code128
- **PhotoAnalyzerModal.tsx**: Captura de fotos para análisis con IA
- **ValidationScanner.tsx**: Validación de ubicación mediante escaneo

**Workflow de Escaneo**:
```
[Usuario abre escáner]
   ↓
[Cámara se activa]
   ↓
[Usuario enfoca código de barras]
   ↓
[Sistema detecta código automáticamente]
   ↓
[Validación del código (lib/codeValidation.ts)]
   ├─ Normalización (elimina espacios, guiones)
   ├─ Validación de formato
   └─ Detección de tipo (artículo, ubicación, especial)
   ↓
[Código procesado → Continúa workflow correspondiente]
```

### 7.2. Gestión de Lotes (Multi-Location)

**Problema**: Un artículo puede ocupar múltiples ubicaciones si el volumen es grande.

**Solución**: Sistema de lotes múltiples.

**Implementación**:
```typescript
// Asignar el mismo artículo a varias ubicaciones
assignItem(barcode, orderId, [locationA, locationB, locationC], { allowMultiLocation: true });

// Firestore resultante:
{
  "MEC-E-URGENTE-B1-MEC 001": [{barcode: "ART-123", orderId: "OF-456", ...}],
  "MEC-E-URGENTE-B1-MEC 002": [{barcode: "ART-123", orderId: "OF-456", ...}],
  "MEC-E-URGENTE-B1-MEC 003": [{barcode: "ART-123", orderId: "OF-456", ...}]
}
```

**Casos de uso**:
- Artículos en palets que ocupan 3+ posiciones
- Distribución de cajas de un mismo pedido

**Componente**: `MultiLocationSelector.tsx`

### 7.3. Tipos de Embalaje

El sistema registra cómo está empaquetado cada artículo:

```typescript
export type PackageType = 'PALLET' | 'CAJA_GRANDE' | 'CAJA_PEQUENA';
```

**Ventajas**:
- Facilita estimación de espacio necesario
- Permite filtros por tipo de embalaje
- Mejora la organización física

**Componente**: `PackageTypeModal.tsx` (se abre al asignar a ubicación vacía)

### 7.4. Historial y Trazabilidad

**Todas las acciones quedan registradas permanentemente en `history`**:

**Tipos de acciones**:
- `assigned`: Artículo asignado a ubicación
- `removed`: Artículo retirado de ubicación
- `relocated`: Artículo movido entre ubicaciones
- `copied`: Artículo copiado (duplicado en otra ubicación)
- `requested`: Jefe solicita artículo
- `process_finished`: Artículo finaliza producción
- `admin_cleared`: Admin vació ubicación masivamente
- `moved_to_working`: Artículo movido a "EN_TRABAJO" (retirado para trabajar)

**Visualización**:
- **Componente**: `HistoryView.tsx`
- **Filtros**: Por artículo, por acción, por usuario, por fecha

### 7.5. Búsqueda Inteligente

**Indexación**:
- **Hook**: `useIndexing.ts`
- **Tecnología**: Índices en memoria (Map + Set) para búsqueda O(1)

**Búsqueda por**:
- Código de barcode (exacto o parcial)
- Número de OF (exacto o parcial)
- Ubicación (exacto)

**Función principal**:
```typescript
const searchAssignments = (query: string) => {
  // Busca en assignments y history
  // Retorna coincidencias ordenadas por relevancia
};
```

### 7.6. Exportación a Excel

**Biblioteca**: `xlsx` (SheetJS)

**Función**: `lib/excelExport.ts`

**Contenido del Excel**:
- Hoja 1: **Inventario Actual**
  - Ubicación | Artículo | OF | Estado | Tipo Embalaje | Fecha Asignación
- Hoja 2: **Historial** (opcional)
  - Fecha | Usuario | Acción | Artículo | OF | Desde | Hacia

**Generación**:
```typescript
exportInventoryToExcel(assignments, history);
// Descarga automática de archivo .xlsx
```

### 7.7. Sistema de Notificaciones

**Tipos**:
- **Notificaciones internas (UI)**: Toast notifications (`NotificationToast.tsx`)
- **Notificaciones sistema**: Solicitudes de Jefes a Carretilleros

**Hook**: `useSystemNotifications.ts`

**Función**:
```typescript
const { sendSystemAlert, unreadRequestsCount } = useSystemNotifications(role, notify);

// Jefe solicita artículo
sendSystemAlert({
  type: 'REQUEST',
  requester: jefe_uid,
  barcode: 'ART-123',
  orderId: 'OF-456',
  location: 'MEC-E-URGENTE-B1-MEC 001'
});

// Carretillero ve contador en banner
// <ForkliftBanner unreadCount={unreadRequestsCount} />
```

### 7.8. Panel de Administración

**Componente**: `AdminPanel.tsx` (lazy-loaded)

**Pestañas**:
1. **Configuración de Almacenes**
   - Crear/Editar/Eliminar almacenes
   - Definir número de estanterías
2. **Gestión de Usuarios**
   - Ver lista de usuarios
   - Asignar roles (CARRETILLERO, JEFE, ADMIN)
   - Asignar secciones a Jefes
3. **Limpieza Masiva**
   - Vaciar ubicaciones completas
   - Vaciar estanterías enteras
4. **Backup y Restauración** (futuro)
5. **Análisis de Anomalías** (futuro)

---

## 8. Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| **React** | 18.x | Framework principal |
| **TypeScript** | 5.x | Tipado estático |
| **Vite** | 5.x | Build tool y dev server |
| **Zustand** | 4.x | State management global |
| **Firebase SDK** | 10.x | Backend as a Service |
| **Lucide React** | Iconos |  Librería de iconos |
| **Tesseract.js** | OCR | Reconocimiento de texto |
| **xlsx** (SheetJS) | Excel | Exportación Excel |

### Backend (Firebase)

| Servicio | Uso |
|----------|-----|
| **Firebase Authentication** | Login con email + contraseña |
| **Cloud Firestore** | Base de datos NoSQL en tiempo real |
| **Firebase Hosting** | Despliegue de la PWA |
| **Firebase Storage** | (Opcional) Fotos, backups |
| **Cloud Functions** | (Futuro) Lógica serverless |

### Herramientas de Desarrollo

- **Git**: Control de versiones
- **npm**: Gestor de paquetes
- **ESLint**: Linter
- **Prettier**: Formateador
- **Gemini API**: IA para análisis de imágenes

---

## 9. Integración con Firebase

### 9.1. Configuración

**Archivo**: `lib/firebase.ts`

```typescript
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = firebase.initializeApp(firebaseConfig);
export const db = firebaseApp.firestore();
export const auth = firebaseApp.auth();
```

### 9.2. Operaciones de Firestore

**Ejemplo: Asignar artículo**

```typescript
const assignItem = async (barcode: string, orderId: string, locationId: LocationId) => {
  const assignmentsRef = db.collection('assignments').doc('current');
  
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(assignmentsRef);
    const data = doc.data() || {};
    
    if (!data[locationId]) data[locationId] = [];
    data[locationId].push({
      barcode,
      orderId,
      timestamp: new Date().toISOString(),
      assignedAt: new Date().toISOString(),
      status: 'UBICADO',
      itemKey: `${barcode}__${orderId}`
    });
    
    transaction.set(assignmentsRef, data);
  });
  
  // Registrar en historial
  await db.collection('history').add({
    barcode,
    orderId,
    action: 'assigned',
    toLocation: locationId,
    timestamp: new Date().toISOString(),
    user: auth.currentUser?.uid
  });
};
```

### 9.3. Sincronización en Tiempo Real

**Hook**: `useAssignments.ts`

```typescript
export const useAssignments = () => {
  const [assignments, setAssignments] = useState<Assignments>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubscribe = db.collection('assignments').doc('current')
      .onSnapshot((snapshot) => {
        setAssignments(snapshot.data() || {});
        setLoading(false);
      });
    
    return () => unsubscribe();
  }, []);
  
  return { assignments, setAssignments, loading };
};
```

**Ventaja**: Los cambios se propagan automáticamente a todos los usuarios conectados en <1 segundo.

---

## 10. Casos de Uso Avanzados

### 10.1. Relocate Location Contents

**Objetivo**: Mover TODO el contenido de una ubicación A a una ubicación B (masivamente).

**Código** (`useInventoryOperations.ts`):
```typescript
const relocateLocationContents = (fromLocation: LocationId, toLocation: LocationId) => {
  const items = assignments[fromLocation] || [];
  
  items.forEach(item => {
    moveItem(item.barcode, fromLocation, toLocation, item.orderId);
  });
  
  notify('success', 'Relocate Complete', `Moved ${items.length} items from ${fromLocation} to ${toLocation}`);
};
```

**Uso**: Cuando una estantería se mueve físicamente o se reorganiza.

### 10.2. Empty Shelf (Admin)

**Objetivo**: Vaciar TODOS los artículos de una estantería completa.

**Código**:
```typescript
const emptyShelf = (shelfId: string) => {
  Object.keys(assignments).forEach(locId => {
    if (locId.includes(shelfId)) {
      const items = assignments[locId] || [];
      items.forEach(item => removeItem(item.barcode, locId as LocationId, item.orderId));
    }
  });
  
  addHistoryEntry({
    barcode: 'MULTIPLE',
    action: 'admin_cleared',
    details: `Shelf ${shelfId} emptied by admin`,
    timestamp: new Date().toISOString(),
    user: auth.currentUser?.uid
  });
};
```

**⚠️ Requiere confirmación doble** para evitar pérdida accidental de datos.

### 10.3. Batch Assignment

**Objetivo**: Asignar múltiples artículos a la vez (útil para recepciones masivas).

**Componente**: `BatchAssignmentModal.tsx`

**Workflow**:
1. Usuario introduce lista de artículos (manualmente o CSV)
2. Sistema valida cada artículo
3. Usuario selecciona ubicación de destino
4. Sistema asigna en lote

**Código**:
```typescript
const batchAssign = (items: BatchItem[], location: LocationId) => {
  items.forEach(item => {
    assignItem(item.article, item.order, location, { allowMultiLocation: true });
  });
};
```

### 10.4. Find Item Location (Búsqueda)

**Objetivo**: Localizar dónde está un artículo específico.

**Función**:
```typescript
const findItemLocation = (barcode: string, orderId?: string): LocationId | null => {
  for (const [locId, items] of Object.entries(assignments)) {
    const match = items.find(i => 
      i.barcode === barcode && 
      (!orderId || i.orderId === orderId)
    );
    if (match) return locId as LocationId;
  }
  return null;
};
```

**UI**: Resalta la ubicación en la vista de mapa.

### 10.5. Duplicate Item Detection

**Objetivo**: Detectar si un artículo (barcode + OF) ya existe en el sistema.

**Modal**: `DuplicateItemModal.tsx`

**Opciones**:
- **Mover**: Cambiar ubicación del existente
- **Añadir copia**: Crear lote adicional (multi-location)
- **Cancelar**: Abortar operación

---

## Diagrama de Componentes React

```
App.tsx
├── LoginScreen.tsx
├── MainLayout.tsx
│   ├── Header (logo, user, notifications)
│   ├── Navigation (almacén selector)
│   └── Content Area
│       ├── AssignmentList.tsx (Vista principal)
│       │   ├── WarehouseMap.tsx
│       │   ├── ShelfRow.tsx
│       │   └── WorkingItemsList.tsx
│       ├── HistoryView.tsx
│       ├── StorageView.tsx (ALMACÉN items)
│       ├── MessagesView.tsx (Solicitudes)
│       └── AdminPanel.tsx
├── Modals (Lazy-loaded)
│   ├── Scanner.tsx
│   ├── PhotoAnalyzerModal.tsx
│   ├── ValidationScanner.tsx
│   ├── ManualEntryModal.tsx
│   ├── LocationDetailModal.tsx
│   ├── ShelfDetailModal.tsx
│   ├── MoveItemModal.tsx
│   ├── OccupiedLocationModal.tsx
│   ├── PackageTypeModal.tsx
│   ├── DuplicateItemModal.tsx
│   ├── MoveConfirmationModal.tsx
│   ├── RemoveConfirmationModal.tsx
│   ├── ProcessFinishedModal.tsx
│   ├── RequestConfirmationModal.tsx
│   ├── MultiLocationSelector.tsx
│   ├── EmptyLocationsModal.tsx
│   └── (20+ más...)
├── NotificationToast.tsx
├── ForkliftBanner.tsx (Solicitudes banner)
├── GeminiButton.tsx
└── ThemeToggle.tsx
```

---

## Seguridad y Validaciones

### Validaciones de Negocio

1. **No retirar de sección ajena** (JEFES)
2. **No asignar a ubicación inexistente** (salvo ADMIN con bypass)
3. **No duplicar itemKey** sin allowMultiLocation=true
4. **No realizar solicitudes si eres CARRETILLERO** (UI bloqueada)

### Seguridad Firebase

**Reglas de Firestore** (archivo `firestore.rules`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /assignments/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      (request.auth.token.role == 'ADMIN' || 
                       request.auth.token.role == 'CARRETILLERO' ||
                       request.auth.token.role == 'JEFE');
    }
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.role == 'ADMIN';
    }
    match /history/{document=**} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

---

## Despliegue

### Build de Producción

```bash
npm run build
```

**Output**: `/dist` (archivos estáticos optimizados)

### Deploy a Firebase Hosting

```bash
firebase deploy --only hosting
```

**URL**: https://{project-id}.web.app

---

## Glosario de Términos

| Término | Definición |
|---------|-----------|
| **OF** | Orden de Fabricación (Order ID) |
| **Artículo** | Código de pieza (barcode) |
| **Ubicación** | Posición física en estantería (LocationId) |
| **Lote** | Conjunto de artículos idénticos en una ubicación |
| **Multi-Location** | Artículo distribuido en múltiples ubicaciones |
| **WIP** | Work In Progress (artículos en proceso) |
| **itemKey** | Clave única: `${barcode}__${orderId}` |
| **Sección** | Área productiva (MECANIZADO, SOLDADURA, etc.) |
| **Embalaje** | Tipo de paquete (PALLET, CAJA_GRANDE, CAJA_PEQUENA) |

---

## Información de Versión

**Versión actual**: 2.0  
**Última actualización**: Enero 2026  
**Desarrollado por**: Equipo Técnico Interno

**Contacto**: Administrador del sistema

---

**FIN DE LA DOCUMENTACIÓN TÉCNICA**
