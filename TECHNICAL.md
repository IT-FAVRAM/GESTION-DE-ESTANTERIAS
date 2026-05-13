# Gestor de Estanterías - Documentación Técnica

## 1. Visión General

**Aplicación WMS (Warehouse Management System)** para gestión de inventario en estanterías industriales.  
 stack: React + TypeScript + Vite (frontend), Cloud Functions (backend), Firebase (auth + Firestore + push).

```
app/
├── web/              # Frontend Vite + React + TS
│   ├── components/   # Componentes React
│   │   ├── admin/    # Panel admin (SuperAdminPanel, AdminShelfBrowser...)
│   │   ├── app/      # Vistas principales (AdminHomeView, CalidadView...)
│   │   ├── carretillero/ # Vista carretillero
│   │   ├── kiosk/    # Vistas operario (KioskView, ShelfGrid...)
│   │   └── common/   # Componentes compartidos
│   ├── hooks/       # useShelf, useAuth, usePickupQueue...
│   ├── lib/        # API clients, schema Firestore
│   │   └── schema/  # Definiciones (shelves.ts, locations.ts...)
│   ├── domain/      # Lógica de dominio pura
│   └── legacy/      # Componientes legacy (congelados)
├── functions/       # Cloud Functions Firebase
└── scripts/       # Seed y utilities
```

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Estilos | Tailwind CSS 3 |
| Estado | React Context + hooks |
| Backend | Firebase Cloud Functions (Node.js) |
| Database | Firestore |
| Auth | Firebase Auth (email + QR) |
| Push | FCM (Firebase Cloud Messaging) |

## 3. Base de Datos (Firestore)

### 3.1 Colecciones principales

```
appConfig/           # Configuración global (único documento: "config")
  ├── urgentLocations: string[]      # Ubicaciones que notifican como urgentes
  ├── techReviewLocations: string[] # Ubicaciones de revisión técnica
  ├── chiefMapping: Record<string, string[]>  # Email jefe por sección
  └── operarioRefreshInterval: number     # ms

shelves/{shelfCode}/locations/{position}
  # Ej: shelves/MEC/locations/001
  ├── position: string     # "001", "002"...
  ├── items: LocationItem[]
  │   ├── articleCode: string
  │   ├── orderFab: string
  │   ├── quantity: number
  │   ├── importe?: number
  │   └── timestamp: string (ISO)
  └── isEmpty: boolean

devices/
  ├── deviceId: string   # ID único
  ├── lastSeen: timestamp
  ├── assignedUser?: string
  └── status: "active" | "inactive"

notifications/
  ├── createdAt: timestamp
  ├── type: "ubicado" | "retirado" | "urgente" | "avisado"
  ├── locationId: string
  ├── articleCode: string
  ├── orderFab: string
  └── readBy: string[]
```

### 3.2 Códigos de estanterías

```
PRE  = Prensas (9 posiciones)
MEC  = Mecanizado (34 pos, col 1 urgente)
PLE  = Plegado (53 pos, urgentes + punzonadora)
SOL  = Soldadura (54 pos, urgente)
RSO  = Robot Soldadura (8 pos)
REP  = Repasado (39 pos, urgentes + aluminio)
PIN  = Pintura (24 pos, dentro/fuera)
SXP  = Soldadura Puntos (10 pos)
COM  = Comodín (32 pos)
RPL  = Robot Plegado (21 pos)
CAL  = Calidad (34 pos, reprocesos + revisión técnica)
ZIN  = Zincado (5 pos)
RSOL = Repuestos Soldadura (carro)
CSOL = Carro Soldadura (carro)
```

### 3.3 Zonas especiales

Las zonas se definen en `lib/schema/shelves.ts` en cada Shelf:

```typescript
{
  code: 'REP',
  layout: {
    zones: [
      { name: 'URGENTE', range: [1, 4], isUrgent: true },
      { name: 'ALUMINIO', range: [5, 14] },
      { name: 'GENERAL', range: [15, 24] },
      { name: 'MODULAR', range: [25, 39] }
    ]
  }
}
```

## 4. Roles de Usuario

| Rol | Descripción | Acceso estanterías |
|-----|-------------|-------------------|
| OPERARIO | Operario en turno | Solo assignedShelf |
| CARRETILLERO | Carretillero multi-sección | Todas |
| JEFE_SECCION | Jefe de sección | Todas (solo vista) |
| CALIDAD | Control de calidad | Solo CAL |
| ADMIN | Administrador | Todas + panel analítico |
| SUPERADMIN | Superadministrador | Todas + panel completo |

### 4.1 Roles en Firestore (auth)

Se guardan en documento de usuario en `users/{uid}`:
```typescript
{
  role: "OPERARIO" | "CARRETILLERO" | "JEFE_SECCION" | "CALIDAD" | "ADMIN" | "SUPERADMIN",
  assignedShelf?: string,  // Solo para OPERARIO
  section?: string        // Sección del usuario
}
```

## 5. Autenticación

### 5.1 Métodos

1. **QR Login**: Operarios con código QR → `authSession` en localStorage
2. **Email Login**: ADMIN/CALIDAD con email + contraseña Firebase

### 5.2 Flujo QR

```typescript
// 1. Escaneo QR → 获取 device ID
// 2. POST /auth/loginQr → 获取 session token
// 3. Guardar en localStorage: { sessionToken, role, capabilities }
```

## 6. APIs y Cloud Functions

### 6.1 Inventory Functions

```
POST /inventory/ubicar
  Input: { articleCode, orderFab, position, shelfCode, operarioId, operarioName }
  Output: { success }

POST /inventory/retirar
  Input: { articleCode, orderFab, shelfCode, operarioId }
  Output: { success, positions[] }

POST /inventory/mover
  Input: { articleCode, orderFab, newPositions[], shelfCode, operarioId, operarioName }
  Output: { success }
```

### 6.2 Notification Functions

```
POST /notifications/send
  Input: { type, locationId, articleCode, orderFab, targetRoles[] }
  Output: { sentCount }
```

## 7. Componentes Principales

### 7.1 Vistas por Rol

| Rol | Vista principal | Componente |
|-----|---------------|-----------|
| OPERARIO | KioskView | Scanner → ubicar/retirar |
| CARRETILLERO | ShelfNavigator | Multi-estantería + acciones |
| JEFE_SECCION | ManagerInfoView | Solo información |
| CALIDAD | CalidadView | Reprocesos CAL-001-022 |
| ADMIN | AdminHomeView + AdminShelfBrowser | Panel + gestión estanterías |
| SUPERADMIN | SuperAdminPanel | Panel completo + config |

### 7.2 AdminShelfBrowser

Panel de gestión para ADMIN/SUPERADMIN con:
- **UBICAR**: Introducir artículo + OF → click celda
- **RETIRAR**: Introducir artículo + OF → confirmar
- **REUBICAR**: Click celda origen → click celda destino
- **MOVER**: Buscar → seleccionar destino

### 7.3 ShelfGrid / ShelfGridCell

Componentes de visualización de estanterías:
- Renderizado por zonas físicas (physicalBlocks)
- Detección de tipos especiales:
  - `isUrgentLocation(code, pos)`
  - `isTechReviewLocation(code, pos)`
  - `isAluminioLocation(code, pos)`

## 8. Offline y Queue

### 8.1 Offline Queue

```typescript
// localStorage: offlineQueue[]
{
  operation: "ubicar" | "retirar" | "mover",
  payload: object,
  timestamp: ISO,
  retries: number
}
```

### 8.2 Sync

- Se procesa al recuperar conexión
- Retry con backoff exponencial
- Notificación de estado en UI

## 9. Push Notifications (FCM)

### 9.1 Tipos de notificación

| Tipo | Destinatarios | Trigger |
|-----|--------------|---------|
| URGENTE | Jefes sección + Calidad | Artículo en ubicación urgente |
| REVISION | Calidad | Artículo en revisión técnica |
| UBICADO | Jefe sección | Artículo ubicado |
| RETIRADO | Jefe sección | Artículo retirado |

### 9.2 Suscripción por rol

- `ubicado`: Todos los roles operativos
- `urgente`: ADMIN, SUPERADMIN, JEFE_SECCION, CALIDAD
- `avisado`: ADMIN, SUPERADMIN, CALIDAD

## 10. Configuraciones Especiales

### 10.1 Ubicaciones Urgentes

Se configuran en `appConfig/config` en Firestore:
- `urgentLocations`: string[] (ubicaciones custom adicionales)
- Las predefinidas vienen del código (zonas con `isUrgent: true`)

### 10.2 Revisión Técnica

- `techReviewLocations`: string[]
- Las predefinidas vienen del código (zonas con `isTechReview: true`)

### 10.3 Chief Mapping

```typescript
{
  "MECANIZADO": ["email@jefe.com"],
  "PRENSAS": ["email@jefe.com"],
  // ...
}
```

## 11. Workflows de Usuario

### 11.1 Operario - Ubicar

```
1. Escanear código QR artículo
2. Scanner pide posición
3. Escanear/introducir posición
4. Confirmar → API ubicar → Notificación a jefe
5. Feedback SUCCESS/ERROR
```

### 11.2 Operario - Retirar

```
1. Escanear código QR
2. API buscar en todas estanterías
3. Mostrar ubicación(es)
4. Confirmar retirada
5. API retirar → Notificación
```

### 11.3 Admin - Reubicar

```
1. Click botón REUBICAR
2. Click celda ORIGEN (con artículo)
3. Click celda DESTINO
4. Confirmación si hay artículo
5. API mover
```

## 12. Build y Deploy

### 12.1 Frontend

```bash
cd app/web
npm install
npm run build  # → dist/
firebase deploy --only hosting
```

### 12.2 Functions

```bash
cd app/functions
npm install
npm run build
firebase deploy --only functions
```

### 12.3 Seed

```bash
cd app
npm run seed  # Ejecuta scripts/seedDatabase.ts
```

## 13. Variables de Entorno

### app/web/.env.local

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

## 14. Testing

### 14.1 Tests existentes

```
app/tests/
├── validation_test.cjs
└── sanitization_test.cjs
```

### 14.2 Build check

```bash
npm run build  # Verifica TypeScript + build
```

## 15. Glosario

| Término | Definición |
|---------|------------|
| OF | Orden de Fabricación |
|ubicación | Posición en estantería (ej: MEC-001) |
| ubicacionDoc | Documento Firestore de una posición |
| reproceso | Artículo en CAL-001-022 con importe |
|isEmpty | Boolean que indica si hay artículos |
| physicalBlock | Grupo físico de posiciones |

## 16. Contactos y Empresas

- **Empresa**: FAVRAM
- **Calidad emails**: calidad@favram.com
- **Jefe sección**: Definidos en chiefMapping

---

*Última actualización: Mayo 2026*