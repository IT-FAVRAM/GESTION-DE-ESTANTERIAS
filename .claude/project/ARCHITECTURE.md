---
name: architecture-overview
description: Stack, colecciones Firestore, componentes principales y flujos
metadata:
  type: reference
---

# Arquitectura WMS v3.0

## Stack Tecnológico

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand + Custom hooks
- **Offline**: Service Worker + localStorage cache
- **Auth**: Firebase Auth v12 + custom kiosk auth

### Backend
- **Runtime**: Cloud Functions (Node.js)
- **Database**: Firestore (NoSQL)
- **Real-time**: Firestore listeners
- **External APIs**: Google Cloud Vision (OCR), WhatsApp OpenWA, Telegram

### Infrastructure
- **Hosting**: Firebase Hosting (frontend) + Cloud Functions (backend)
- **Files**: Cloud Storage
- **Notifications**: FCM (Firebase Cloud Messaging)
- **Config**: Firestore + `.env.keys.json`

---

## Colecciones Firestore (Críticas)

### Estructura Principal

```
📦 config/
  ├─ app (doc)          → appConfig: shelves, sections, comodines, etc
  └─ (otros configs globales)

📦 usuarios/
  ├─ {uid}               → UserProfile: role, assignedShelf, email, fcmToken
  └─ sub: devices/       → Dispositivos registrados

📦 shelves/
  ├─ {shelfCode}         → Shelf: name, section, type, layout
  └─ sub: locations/     → Location: slot, items[], state, lastActivity
       └─ sub: items/    → Item: article, quantity, code, etc

📦 items/
  ├─ {itemId}            → Item: article, originalCode, quantity, shelf, location

📦 itemAggregates/
  ├─ {articleCode}       → Totals: cantidad, shelves[], lastSeen

📦 kiosks/
  ├─ {kioskId}           → Kiosk: name, location, ipAddress, fcmToken, lastSeen

📦 history/
  ├─ {timestamp}_{action} → HistoryEntry: action, article, user, location, etc

📦 pickupQueue/
  ├─ {queueId}           → PickupOrder: article, quantity, assignedShelf, status

📦 urgent_alerts/
  ├─ {alertId}           → Alert: title, message, resolved, owner, createdAt

📦 conversations/ (private admin rooms)
  ├─ {conversationId}    → Conversation: participants, messages, topic

📦 chat/
  ├─ {messageId}         → Message: text, sender, timestamp, role, likes

📦 dispositivos/
  ├─ {deviceId}          → Device: userId, type, ipAddress, lastActivity

📦 conexion_estado/
  ├─ {kioskId}           → ConnectionState: status, bandwidth, latency, lastCheck

📦 conexion_logs/
  ├─ {timestamp}         → ConnectionLog: kioskId, status, duration
```

---

## Componentes Principales

### Auth & Sessions
- `authTypes.ts` → SessionCapabilities interface
- `authCapabilities.ts` → resolveCapabilities(role, authMethod, assignedShelf)
- `useAuth.ts` → Login, logout, session management
- `useRoles.ts` → Role-based access control
- `authStorage.ts` → localStorage persistence

### Shelf Management
- `useShelf.ts` → Core shelf state, locations, items
- `useOperativeShelf.ts` → Ubicar + Retirar operations
- `shelfAccess.ts` → Validación de acceso por rol

### Views by Role
- **Operario/Carretillero**: `KioskView`, `CarrosView`
- **Calidad**: `CalidadView` (CAL-001 a CAL-022)
- **Jefe Sección**: `ConsoleView` (su sección)
- **Admin**: `AdminConsole` (todas las estanterías)

### Critical Hooks
| Hook | Purpose |
|------|---------|
| `useShelf` | Firestore real-time listeners para estantería |
| `useOperativeShelf` | Ubicar/Retirar logic + optimistic updates |
| `useAuth` | Auth state + capabilities resolution |
| `usePickupQueue` | Órdenes de compra/entrega |
| `useUrgentAlerts` | Alertas urgentes con resolved flag |
| `usePinnedUrgencies` | Avisos fijados (sticky banner) |
| `useHistory` | Auditoría de operaciones |
| `useCarts` | Estado de carros (CARRETILLERO) |
| `useInventoryOperations` | Batch operations (Excel import/export) |
| `useConnectionMonitor` | WiFi status + offline handling |

### Notificaciones
- **FCM Triggers**: 5 eventos → notificaciones push
- **Chat**: Salas privadas (conversations/) + canal general (chat/)
- **Urgentes**: urgent_alerts/ + auto-dismiss
- **Sistema**: Notificaciones de estado de operaciones

---

## Flujos Clave

### 1️⃣ UBICAR (Colocar artículo)

```
USER INPUT (QR/Manual)
  ↓
validateLocation() → shelfAccess check
  ↓
optimisticUpdate() → UI feedback inmediato
  ↓
callOperateLocationApi() → Cloud Function
  ↓
Firestore update:
  - items/ add
  - shelves/{shelf}/locations/{loc}/items add
  - itemAggregates/ update
  ↓
history/ log
  ↓
FCM notification (CARRETILLERO if pickupQueue item)
```

**Posibles errores**:
- ❌ Ubicación inválida (no existe)
- ❌ Rol sin permisos
- ❌ Cantidad negativa
- ❌ Offline + optimistic update pierde datos

---

### 2️⃣ RETIRAR (Quitar artículo)

```
GRID VISUAL (RetirarCellModal)
  ↓
Multi-select items ✅✅
  ↓
"¿Retirar más?" loop
  ↓
callRetireItems() → Cloud Function
  ↓
Firestore delete:
  - items/ remove
  - shelves/{shelf}/locations/{loc}/items remove
  - itemAggregates/ decrement
  ↓
history/ log
  ↓
FCM notification (CALIDAD if CAL shelf)
```

**Posibles errores**:
- ❌ Item no existe
- ❌ Rol sin permisos (ej: OPERARIO retirar de sección ajena)
- ❌ Cantidad > stock

---

### 3️⃣ COMPRA/ENTREGA (CARRETILLERO)

```
pickupQueue/ order
  ↓
CARRETILLERO ve "pendiente" en CarrosView
  ↓
Navega a sección correcta
  ↓
Ubica artículo en estantería
  ↓
Cloud Function marca pickupQueue como completada
  ↓
FCM notifica si está en consola (JEFE_SECCION/ADMIN)
```

---

### 4️⃣ ALERTAS URGENTES

```
Admin crea urgent_alert/
  ↓
FCM broadcast a todos
  ↓
UI: Sticky Teams banner (10s)
  ↓
User puede resolver (resolved: true)
  ↓
Auto-dismissed (closed)
```

---

### 5️⃣ CHAT MULTICANAL

```
Mensaje en chat/
  ↓
Si sender=CALIDAD → visible en conversations/ privado + chat/
Si sender=OPERARIO → solo en chat/
  ↓
FCM notification (4 roles)
  ↓
Rules: 4 roles en chat/, solo ADMIN/CALIDAD en conversations/
```

---

## Validación de Datos Críticos

### LocationState
- ✅ shelfCode existe en config
- ✅ slot [1-N] es válido para shelf
- ✅ items[] no vacío
- ✅ No hay duplicados en items[]

### Item
- ✅ article no vacío
- ✅ quantity > 0
- ✅ originalCode presente
- ✅ shelf + location válidos

### User
- ✅ role en AUTH_ROLES | KIOSK_ROLES
- ✅ assignedShelf (si role=OPERARIO|JEFE_SECCION) debe existir
- ✅ email único (AUTH_ROLES)
- ✅ fcmToken si notificaciones habilitadas

---

## API Contracts (No modificar sin revisar dependencias)

### Cloud Functions
```typescript
// operateLocation(shelf, location, items[], action)
// Expected: returns { success, itemsAdded/Removed, errors[] }

// operateMultiple(operations[])
// Expected: returns { completed, failed[], logs }

// ocrImage(imageData)
// Expected: returns { text, confidence, fallback }
```

### Firestore Rules
- Auth: email (AUTH_ROLES) | customClaims (KIOSK_ROLES)
- Role-based read/write restrictions
- No client-side delete de collections críticas
- Audit trail en history/

---

## Performance & Offline

### Optimistic Updates
- ✅ Ubicar: UI updates antes de respuesta backend
- ✅ Retirar: Grid updates antes de delete en Firestore
- ⚠️ **Risk**: Si offline + actualiza, datos pueden perderse en reload

### Caching
- localStorage: auth tokens, config, últimas búsquedas
- Service Worker: assets estáticos + offline fallback
- Firestore: Real-time listeners (sync automático)

### Connection Monitor
- Monitorea WiFi en tiempo real
- Logs en conexion_logs/
- Dashboard de latencia/bandwidth (ADMIN)

---

## Migraciones & Cleanup

### Collections Deprecated
- ❌ offlineOperations (removido 2026-05-26)
- ❌ oldShelves (removido)
- ✅ Usar items/ + itemAggregates/ en su lugar

### Field Renames
- ❌ KIOSKS → ✅ kiosks (lowercase)
- Revisar firestore.rules al renombrar

---

## Auditoría (v3.0 Estado)

- 🟢 38 bugs identificados, 27 reparados
- 🟡 11 documentados pendientes
- ✅ Zero críticos en producción (2026-06-09)
- ⚠️ Compliance: session tokens, PII en logs
