---
name: firestore-schema-visual
description: Diagrama visual de colecciones, documentos, campos y relaciones
metadata:
  type: reference
---

# 📊 Firestore Schema — Diagrama Visual

**Propósito**: Entender la estructura de datos, relaciones y dónde encontrar cada cosa.

---

## 🗂️ Jerarquía Completa

```
FIRESTORE (Database)
│
├─ config/
│  └─ app (doc)
│     ├─ shelves[]              → SHELF_DEFINITIONS
│     ├─ sections[]             → warehouse sections
│     ├─ comodines{}            → special article codes
│     ├─ genericSupplies[]       → generic supplies
│     └─ metadata
│
├─ usuarios/
│  ├─ {uid} (doc)               → UserProfile
│  │  ├─ role: 'OPERARIO' | 'CARRETILLERO' | 'CALIDAD' | 'JEFE_SECCION' | 'ADMIN' | 'SUPERADMIN'
│  │  ├─ email: string (AUTH_ROLES only)
│  │  ├─ assignedShelf?: 'PRE' | 'MEC' | 'CAL' | 'PLEGADORA' etc
│  │  ├─ fcmTokens: string[]    [DEPRECATED → use devices/]
│  │  ├─ lastLogin: timestamp
│  │  └─ sub: devices/ (subcollection)
│  │     └─ {deviceId} (doc)
│  │        ├─ fcmToken: string
│  │        ├─ platform: 'ios' | 'android' | 'web'
│  │        ├─ ipAddress: string
│  │        └─ lastSeen: timestamp
│  │
│  ├─ {uid2} (doc)
│  └─ ...
│
├─ shelves/
│  ├─ PRE (doc)                 → Shelf: Prensas-Mecanizado
│  │  ├─ code: 'PRE'
│  │  ├─ name: 'Prensas - Mecanizado'
│  │  ├─ section: 'PRENSAS_MECANIZADO'
│  │  ├─ type: 'shelf'
│  │  ├─ locationCount: 50
│  │  ├─ layout: ShelfLayout (zones, physicalBlocks)
│  │  └─ sub: locations/ (subcollection)
│  │     ├─ 1 (doc)             → Location (URG MEC-PRE)
│  │     │  ├─ slot: 'URG MEC-PRE 001'
│  │     │  ├─ items: ['ITEM-001', 'ITEM-002']
│  │     │  ├─ state: 'full' | 'partial' | 'empty'
│  │     │  ├─ lastActivity: timestamp
│  │     │  └─ sub: items/ (subcollection)
│  │     │     ├─ ITEM-001 (doc)
│  │     │     │  ├─ article: 'ART-12345'
│  │     │     │  ├─ quantity: 5
│  │     │     │  ├─ originalCode: 'QR-CODE-1'
│  │     │     │  ├─ importedFrom?: 'EXCEL' | 'MANUAL'
│  │     │     │  ├─ field1?: string (dual-field)
│  │     │     │  └─ field2?: string (dual-field)
│  │     │     └─ ITEM-002 (doc)
│  │     │
│  │     ├─ 2 (doc)             → PRENSAS 001
│  │     │  ├─ slot: 1 (número)
│  │     │  ├─ items: []
│  │     │  └─ sub: items/
│  │     │
│  │     └─ ...50 docs
│  │
│  ├─ MEC (doc)
│  │  ├─ code: 'MEC'
│  │  ├─ ...similar structure
│  │  └─ sub: locations/ (46 slots)
│  │
│  ├─ CAL (doc)
│  │  ├─ code: 'CAL'
│  │  ├─ ...similar structure
│  │  └─ sub: locations/ (22 slots: CAL-001 to CAL-022)
│  │
│  ├─ PLE (doc)
│  │  └─ sub: locations/ (65 slots)
│  │
│  └─ ...more shelves
│
├─ items/
│  ├─ ITEM-001 (doc)            → InventoryItem
│  │  ├─ article: 'ART-12345'
│  │  ├─ quantity: 5
│  │  ├─ shelf: 'PRE'
│  │  ├─ location: 'URG MEC-PRE 001'
│  │  ├─ originalCode: 'QR-CODE-1'
│  │  ├─ importedFrom?: 'EXCEL' | 'MANUAL'
│  │  ├─ createdAt: timestamp
│  │  └─ lastModified: timestamp
│  │
│  └─ ...more items
│
├─ itemAggregates/
│  ├─ ART-12345 (doc)           → Aggregated totals
│  │  ├─ article: 'ART-12345'
│  │  ├─ cantidad: 15            [TOTAL en todos los shelves]
│  │  ├─ shelves: ['PRE', 'MEC']  [Dónde está]
│  │  ├─ byShelf: {              [Desglose por shelf]
│  │  │    'PRE': 5,
│  │  │    'MEC': 10
│  │  │  }
│  │  ├─ lastSeen: timestamp
│  │  └─ lastModified: timestamp
│  │
│  └─ ...more articles
│
├─ pickupQueue/
│  ├─ ORDER-001 (doc)           → PickupOrder (compra/entrega)
│  │  ├─ id: 'ORDER-001'
│  │  ├─ article: 'ART-12345'
│  │  ├─ quantity: 10
│  │  ├─ assignedShelf: 'PRE'
│  │  ├─ status: 'pending' | 'in_progress' | 'completed'
│  │  ├─ createdBy: uid (CARRETILLERO)
│  │  ├─ completedAt?: timestamp
│  │  └─ notes?: string
│  │
│  └─ ...more orders
│
├─ kiosks/
│  ├─ KIOSK-PRE-001 (doc)       → Kiosk device
│  │  ├─ id: 'KIOSK-PRE-001'
│  │  ├─ name: 'Kiosko Prensas'
│  │  ├─ location: 'PRE shelf area'
│  │  ├─ ipAddress: '192.168.1.100'
│  │  ├─ fcmToken: 'token-xyz'
│  │  ├─ lastSeen: timestamp
│  │  └─ status: 'online' | 'offline'
│  │
│  └─ ...more kiosks
│
├─ history/
│  ├─ {timestamp}_{action} (doc) → HistoryEntry (auditoría)
│  │  ├─ timestamp: milliseconds
│  │  ├─ action: 'UBICAR' | 'RETIRAR' | 'MOVE' | 'IMPORT' | 'EXPORT'
│  │  ├─ userId: uid
│  │  ├─ userName: string
│  │  ├─ role: 'OPERARIO' | ...
│  │  ├─ article?: string
│  │  ├─ quantity?: number
│  │  ├─ shelf?: string
│  │  ├─ location?: string
│  │  ├─ fromShelf?: string (para moves)
│  │  ├─ toShelf?: string
│  │  ├─ details?: object (datos extra)
│  │  └─ success: boolean
│  │
│  └─ ...chronological entries (append-only)
│
├─ urgent_alerts/
│  ├─ ALERT-001 (doc)           → UrgentAlert
│  │  ├─ id: 'ALERT-001'
│  │  ├─ title: string
│  │  ├─ message: string
│  │  ├─ resolved: boolean
│  │  ├─ createdBy: uid (ADMIN)
│  │  ├─ createdAt: timestamp
│  │  ├─ resolvedBy?: uid
│  │  ├─ resolvedAt?: timestamp
│  │  └─ priority: 'high' | 'medium' | 'low'
│  │
│  └─ ...more alerts
│
├─ conversations/
│  ├─ CONV-001 (doc)            → Private Admin Conversation
│  │  ├─ id: 'CONV-001'
│  │  ├─ participants: ['uid1', 'uid2']
│  │  ├─ topic: 'Plegadora Issues' | etc
│  │  ├─ createdAt: timestamp
│  │  ├─ createdBy: uid
│  │  └─ sub: messages/ (subcollection)
│  │     ├─ {msgId} (doc)
│  │     │  ├─ text: string
│  │     │  ├─ sender: uid
│  │     │  ├─ senderRole: 'ADMIN' | 'CALIDAD'
│  │     │  ├─ timestamp: timestamp
│  │     │  └─ likes: { [uid]: true }
│  │     └─ ...more messages
│  │
│  └─ ...more conversations (admin only)
│
├─ chat/
│  ├─ {msgId} (doc)             → Public Chat Message
│  │  ├─ text: string
│  │  ├─ sender: uid
│  │  ├─ senderName: string
│  │  ├─ senderRole: 'OPERARIO' | 'CARRETILLERO' | 'CALIDAD' | 'ADMIN'
│  │  ├─ timestamp: timestamp
│  │  ├─ likes: { [uid]: true }
│  │  └─ reactions?: { emoji: count }
│  │
│  └─ ...more messages (4 roles can access)
│
├─ dispositivos/
│  ├─ DEVICE-001 (doc)          → Device registration
│  │  ├─ id: 'DEVICE-001'
│  │  ├─ userId: uid
│  │  ├─ type: 'kiosk' | 'tablet' | 'phone'
│  │  ├─ platform: 'ios' | 'android' | 'web'
│  │  ├─ ipAddress: string
│  │  ├─ fcmToken: string
│  │  ├─ firstSeen: timestamp
│  │  └─ lastActivity: timestamp
│  │
│  └─ ...more devices
│
├─ conexion_estado/
│  ├─ {kioskId} (doc)           → Current WiFi status
│  │  ├─ kioskId: 'KIOSK-PRE-001'
│  │  ├─ status: 'online' | 'offline' | 'unstable'
│  │  ├─ bandwidth: number (Mbps)
│  │  ├─ latency: number (ms)
│  │  ├─ signalStrength: number (-30 to -120 dBm)
│  │  └─ lastCheck: timestamp
│  │
│  └─ ...more kiosks
│
└─ conexion_logs/
   ├─ {timestamp}_{kioskId} (doc) → Connection history
   │  ├─ kioskId: string
   │  ├─ timestamp: milliseconds
   │  ├─ status: 'online' | 'offline'
   │  ├─ duration: number (ms connected)
   │  ├─ reason?: 'router restart' | 'WiFi dropout' | etc
   │  └─ details: object
   │
   └─ ...more logs
```

---

## 🔗 Relaciones Clave

### Items Flow (Ubicación de artículos)

```
config/app
  └─ SHELF_DEFINITIONS[]
     └─ { code: 'PRE', locations: 50 }

usuarios/{uid}
  └─ { role: 'OPERARIO', assignedShelf: 'PRE' }

User ubica artículo en PRE loc-001
  │
  ├─ shelves/PRE/locations/1/items/
  │  └─ ITEM-001 { article: 'ART-123', qty: 5 }
  │
  ├─ items/ITEM-001
  │  └─ { article, qty, shelf: 'PRE', location: '1' }
  │
  ├─ itemAggregates/ART-123
  │  └─ { cantidad: 5, byShelf: { 'PRE': 5 } }
  │
  └─ history/
     └─ { action: 'UBICAR', article, user, shelf, location }
```

### FCM Notification Flow

```
Cloud Function dispara operación
  │
  ├─ usuarios/{uid}/devices/{deviceId}
  │  └─ { fcmToken: 'token-xyz' }
  │
  ├─ Cloud Messaging API
  │  └─ sends push notification
  │
  └─ public/firebase-messaging-sw.js
     └─ receives onBackgroundMessage()
        └─ shows notification to user
```

### Permissions Validation Flow

```
User login
  │
  ├─ firebase auth
  ├─ usuarios/{uid} load
  │  └─ { role, assignedShelf, email }
  │
  ├─ authCapabilities.resolveCapabilities()
  │  └─ { canOperateShelf, canAccessShelf() }
  │
  ├─ localStorage save
  │  └─ session = { role, capabilities, ... }
  │
  └─ Frontend checks localStorage
     └─ canAccessShelf(role, assignedShelf, targetShelf)
        ├─ OPERARIO: assignedShelf === targetShelf?
        ├─ CARRETILLERO: always true
        ├─ CALIDAD: targetShelf === 'CAL'?
        └─ JEFE_SECCION: sameSection?
```

---

## 📍 Size & Performance Notes

### Collection Sizes (Estimated)

| Collection | Docs | Growth | Notes |
|-----------|------|--------|-------|
| usuarios/ | ~50 | Low | One per user + devices subcollection |
| shelves/ | ~10 | Static | PRE, MEC, CAL, PLE, etc + 50+ locations per shelf |
| items/ | ~5,000 | High | Grows with inventory, pruned on RETIRAR |
| itemAggregates/ | ~1,000 | Medium | One per unique article |
| history/ | ~10,000/month | High | Append-only audit trail |
| chat/ | ~100/day | Medium | Messages accumulate |
| urgent_alerts/ | ~50/month | Low | Temporary alerts |
| pickupQueue/ | ~100 | Medium | Current pending orders |

### Firestore Indexes (Critical)

Revisar `firestore.indexes.json`:
- `usuarios: { role, assignedShelf }`
- `items: { article, shelf }`
- `itemAggregates: { article }`
- `history: { timestamp DESC }`
- `chat: { timestamp DESC }`

---

## ⚠️ Data Integrity Rules

### Must Be True

```
✅ items/{itemId}.article exists in itemAggregates/
✅ itemAggregates[article].cantidad === sum(items[].quantity)
✅ shelves/{code} exists in config/app SHELF_DEFINITIONS
✅ usuarios/{uid}.role in AUTH_ROLES | KIOSK_ROLES
✅ usuarios/{uid}.assignedShelf exists in SHELF_DEFINITIONS (if required)
✅ (CALIDAD users) must have email field (not null/empty)
```

### Never Do

```
❌ Delete from shelves/PRE/locations/{loc}/items/ without updating itemAggregates
❌ Modify items/ without updating history/
❌ Store fcmToken in usuarios/ root (use devices/ subcollection)
❌ Allow client-side delete of history/ or config/
❌ Write to config/app without admin role check
```

---

## 🔍 Querying Examples

### Get all items for an article
```javascript
const items = await db.collection('items')
  .where('article', '==', 'ART-12345')
  .get();
```

### Get all items in PRE shelf
```javascript
const locations = await db.collection('shelves')
  .doc('PRE')
  .collection('locations')
  .get();
// Then iterate locations to get items
```

### Get current FCM token for user
```javascript
const devices = await db.collection('usuarios')
  .doc(userId)
  .collection('devices')
  .get();
const tokens = devices.docs.map(d => d.data().fcmToken);
```

### Get audit trail
```javascript
const history = await db.collection('history')
  .where('userId', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(100)
  .get();
```

### Get unresolved alerts
```javascript
const alerts = await db.collection('urgent_alerts')
  .where('resolved', '==', false)
  .orderBy('createdAt', 'desc')
  .get();
```

---

## 🛠️ Common Maintenance Tasks

### Backfill itemAggregates
```bash
# After bulk import or fix:
node scripts/backfill-aggregates.js
# Recalculates: cantidad, shelves[], byShelf from items/
```

### Archive history (> 1 year)
```bash
# Keep only recent history
node scripts/archive-history.js --before=2025-06-10
# Moves old entries to history_archive/ collection
```

### Cleanup deprecated fields
```bash
# Remove old fcmTokens from usuarios/ root
node scripts/cleanup-deprecated-fcmtokens.js
# (already migrated to devices/ subcollection)
```

### Validate data integrity
```bash
firebase firestore:shell
# Run integrity checks
include('scripts/validate-schema.js')
validateSchema()
```

---

## 🔑 Field Naming Conventions

### Document IDs
- Users: Firebase UID (auto-generated)
- Shelves: Uppercase code (PRE, MEC, CAL)
- Locations: Number or "ZONE-NNN" string
- Items: Auto-generated ID
- History: `{timestamp}_{action}_random`

### Fields
- Timestamps: `createdAt`, `lastModified`, `timestamp`
- Identifiers: `userId`, `shelCode`, `article`
- Status: lowercase enum (pending, completed, online)
- Boolean: `active`, `resolved`, `verified` (not `isActive`)
- Arrays: plural (items, shelves, participants)
- Maps: camelCase ({ byShelf, metadata })

---

## 📖 Related Documents

- `ROLES.md` → Who can read/write which collections
- `ARCHITECTURE.md` → How collections interact
- `RULES.md` → What breaks when you change schema
- `firestore.rules` → Actual security rules (authoritative)
