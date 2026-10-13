---
name: claude-navigation-guide
description: Índice reversible - preguntas frecuentes → archivos del código
metadata:
  type: reference
---

# 🗺️ Guía de Navegación para Claude

**Propósito**: Mapa de la app. Si alguien pregunta sobre X, ve a este archivo.

---

## 🔐 Autenticación & Roles

| Pregunta | Ve a | Líneas |
|----------|------|--------|
| ¿Qué permisos tiene cada rol? | `domain/auth/authCapabilities.ts` | 14-58 |
| ¿Cómo se resuelven capabilities? | `domain/auth/authCapabilities.ts` | resolveCapabilities() |
| ¿Qué diferencia hay entre KIOSK_ROLES y AUTH_ROLES? | `lib/schema/roles.ts` | 1-14 |
| ¿Cómo se valida acceso a una estantería? | `domain/shelves/shelfAccess.ts` | canAccessShelf() |
| ¿Dónde se guardan/cargan sesiones? | `domain/auth/authStorage.ts` | - |
| ¿Cómo funciona login OPERARIO? | `hooks/useKiosk.ts` | - |
| ¿Cómo funciona login CALIDAD/ADMIN? | `hooks/useAuth.ts` | - |
| ¿Qué es SessionCapabilities? | `domain/auth/authTypes.ts` | 5-11 |

---

## 📦 Colecciones & Base de Datos

| Pregunta | Archivo | Info |
|----------|---------|------|
| ¿Qué colecciones existen? | `lib/schema/collections.ts` | COLLECTIONS object |
| ¿Cómo está estructurada Firestore? | `ARCHITECTURE.md` | Sección "Colecciones Firestore" |
| ¿Qué campos tiene un Shelf? | `lib/schema/shelves.ts` | 1-40 |
| ¿Qué es ShelfLayout y ShelfZone? | `lib/schema/shelves.ts` | 12-26 |
| ¿Cómo se definen PRE/MEC/CAL? | `lib/schema/shelves.ts` | SHELF_DEFINITIONS |
| ¿Qué es un Location? | `hooks/useShelf.ts` | LocationState type |
| ¿Qué es itemAggregates? | `ARCHITECTURE.md` | Sección "itemAggregates" |
| ¿Cómo se relacionan items con shelves? | `ARCHITECTURE.md` | Diagrama de colecciones |

---

## 🎯 Flujos Operacionales

### Ubicar (Poner artículo)
| Pregunta | Ve a |
|----------|------|
| ¿Cuál es el flujo completo de UBICAR? | `ARCHITECTURE.md` → "Flujos Clave → UBICAR" |
| ¿Cómo se valida una ubicación? | `lib/operativeShelfLogic.ts` |
| ¿Cuál es la Cloud Function para ubicar? | `servidor/functions/operateLocation.ts` |
| ¿Cómo se hace optimistic update? | `hooks/useOperativeShelf.ts` |
| ¿Cuál es la estructura de callOperateLocationApi? | `hooks/useOperativeShelf.ts` |

### Retirar (Quitar artículo)
| Pregunta | Ve a |
|----------|------|
| ¿Cuál es el flujo completo de RETIRAR? | `ARCHITECTURE.md` → "Flujos Clave → RETIRAR" |
| ¿Cómo funciona RetirarCellModal? | `components/RetirarCellModal.tsx` |
| ¿Cómo se hace multi-select? | `components/RetirarCellModal.tsx` |
| ¿Cómo se dispara Cloud Function de retirar? | `hooks/useOperativeShelf.ts` → callRetireItems |

### Compra/Entrega (CARRETILLERO)
| Pregunta | Ve a |
|----------|------|
| ¿Cómo funciona pickupQueue? | `hooks/usePickupQueue.ts` |
| ¿Dónde ve CARRETILLERO sus órdenes? | `components/CarrosView.tsx` |
| ¿Cómo se completa una orden? | `hooks/usePickupQueue.ts` → completeOrder |

---

## 🔔 Notificaciones & Alertas

| Pregunta | Ve a |
|----------|------|
| ¿Cómo funciona FCM? | `ARCHITECTURE.md` → "Notificaciones" |
| ¿Cuáles son los 5 triggers de FCM? | `notifications_system_analysis.md` |
| ¿Dónde se guardan fcmTokens? | `usuarios/{uid}/devices/` |
| ¿Cómo se disparan push notifications? | `servidor/functions/` → sendFCMMessage |
| ¿Cómo funcionan alertas urgentes? | `hooks/useUrgentAlerts.ts` |
| ¿Cuál es urgent_alerts collection? | `lib/schema/collections.ts` → URGENT_ALERTS |
| ¿Cómo funciona sticky banner (Teams)? | `components/UrgentBanner.tsx` |
| ¿Cómo se resuelven alertas? | `hooks/useUrgentAlerts.ts` → resolveAlert |
| ¿Cómo funciona chat multicanal? | `hooks/useChat.ts` + `hooks/useChatSystem.ts` |
| ¿Qué es conversations/ vs chat/? | `Chat Multicanal + Alertas Urgencia.md` |

---

## 👁️ Componentes por Vista

### Kiosk (OPERARIO, CARRETILLERO)
| Pregunta | Ve a |
|----------|------|
| ¿Dónde es KioskView? | `components/KioskView.tsx` |
| ¿Dónde es CarrosView? | `components/CarrosView.tsx` |
| ¿Cómo se autentican en kiosk? | `hooks/useKiosk.ts` |
| ¿Dónde está el grid de ubicaciones? | `components/ShelfGrid.tsx` |
| ¿Cómo funciona QR scanner? | `lib/qrProcessing.ts` |

### Calidad (CALIDAD)
| Pregunta | Ve a |
|----------|------|
| ¿Dónde es CalidadView? | `components/CalidadView.tsx` |
| ¿Qué shelves ve CALIDAD? | `ROLES.md` → CAL-001 a CAL-022 |
| ¿Cómo ve costos en reprocesos? | `components/CalidadView.tsx` → costDisplay |
| ¿Cómo edita reprocesos? | `hooks/useOperativeShelf.ts` → editReprocess |

### Consola (JEFE_SECCION, ADMIN)
| Pregunta | Ve a |
|----------|------|
| ¿Dónde es ConsoleView? | `components/ConsoleView.tsx` |
| ¿Dónde es AdminConsole? | `components/AdminConsole.tsx` |
| ¿Qué ve JEFE_SECCION? | `ROLES.md` → Su sección solamente |
| ¿Qué ve ADMIN? | `ROLES.md` → Todo |
| ¿Dónde está el dashboard de conexión? | `components/AdminConsole.tsx` → ConnectionMonitor |

---

## 🔗 Hooks Principales

| Hook | Para qué | Dónde |
|------|----------|-------|
| `useAuth` | Auth state + session | `hooks/useAuth.ts` |
| `useShelf` | Firestore listeners + shelf state | `hooks/useShelf.ts` |
| `useOperativeShelf` | Ubicar/Retirar logic | `hooks/useOperativeShelf.ts` |
| `useKiosk` | Kiosk login | `hooks/useKiosk.ts` |
| `usePickupQueue` | Compras/entregas | `hooks/usePickupQueue.ts` |
| `useUrgentAlerts` | Alertas urgentes | `hooks/useUrgentAlerts.ts` |
| `usePinnedUrgencies` | Avisos fijados (sticky) | `hooks/usePinnedUrgencies.ts` |
| `useChat` | Mensajes real-time | `hooks/useChat.ts` |
| `useHistory` | Auditoría de ops | `hooks/useHistory.ts` |
| `useConnectionMonitor` | WiFi status | `hooks/useConnectionMonitor.ts` |
| `useInventoryOperations` | Excel export/import | `hooks/useInventoryOperations.ts` |
| `useCarts` | Estado carros (CARRETILLERO) | `hooks/useCarts.ts` |

---

## 🐛 Debugging & Solución de Problemas

| Problema | Sospecha | Ve a | Comando |
|----------|----------|------|---------|
| Usuario no ve opción de ubicar | Permisos incorrectos | `domain/auth/authCapabilities.ts` | Revisar `canOperateShelf` |
| Ubicación rechazada | Validación fallida | `lib/operativeShelfLogic.ts` | Logs en Cloud Function |
| itemAggregates desincronizado | Batch operation rota | `hooks/useOperativeShelf.ts` | Verificar Firestore listeners |
| FCM no llega | fcmToken vacío o rules bloqueadas | `hooks/useAuth.ts` + `firestore.rules` | `adb logcat Firebase` |
| Datos pierden al recargar | Optimistic update sin validación | `hooks/useOperativeShelf.ts` + `RULES.md` | Offline test |
| Chat no aparece | Listeners no inician | `hooks/useChat.ts` | Revisar `useChatSystem` |
| CARRETILLERO no ve todas las estanterías | assignedShelf demasiado restrictivo | `domain/shelves/shelfAccess.ts` | Revisar: `canBrowseAllShelves` |
| PRE/MEC zonas confundidas | URG compartida mal usada | `lib/schema/shelves.ts` | Revisar SHELF_DEFINITIONS |

---

## 📄 Tipos TypeScript Clave

| Tipo | Dónde | Propiedades |
|------|-------|-------------|
| `UserRole` | `lib/schema/roles.ts` | 'OPERARIO' \| 'CARRETILLERO' \| ... |
| `SessionCapabilities` | `domain/auth/authTypes.ts` | canViewReprocessCosts, canOperateShelf, etc |
| `Shelf` | `lib/schema/shelves.ts` | code, name, section, type, locationCount, layout |
| `ShelfLocation` | `hooks/useShelf.ts` | slot, items[], state, lastActivity |
| `InventoryItem` | `lib/schema/` | article, quantity, originalCode, shelf, location |
| `UserProfile` | `lib/schema/users.ts` | role, assignedShelf, email, fcmToken |

---

## 🚀 Cloud Functions

| Función | Para | Dónde | Parámetros |
|---------|------|-------|-----------|
| `operateLocation` | Ubicar artículo | `servidor/functions/operateLocation.ts` | shelf, location, items[], action |
| `operateMultiple` | Batch ubicar/retirar | `servidor/functions/operateMultiple.ts` | operations[] |
| `ocrImage` | Procesar QR/OCR | `servidor/functions/ocrImage.ts` | imageData, method |
| `sendFCMMessage` | Push notification | `servidor/functions/fcm.ts` | topic, title, message |
| `logHistory` | Auditoría | `servidor/functions/history.ts` | action, user, article, shelf |

---

## 📋 Firestore Rules & Seguridad

| Pregunta | Ve a |
|----------|------|
| ¿Cuáles son las rules de Firestore? | `/firestore.rules` |
| ¿Quién puede leer usuarios/? | `firestore.rules` → usuarios collection |
| ¿Quién puede escribir en shelves/? | `firestore.rules` → shelves collection |
| ¿Cómo se autentica kiosk? | `firestore.rules` → customClaims check |
| ¿Cuál es la regla de history/? | `firestore.rules` → append-only (admin solo) |

---

## 🔄 Flujos Especiales

| Flujo | Descripción | Ve a |
|-------|-------------|------|
| **Soldadura siempre notifica** | Cuando se ubica en sección SOLDADURA → FCM | `hooks/useOperativeShelf.ts` → checkWeldingNotification |
| **Dual-field campos separados** | Algunos artículos tienen field1 + field2 | `lib/schema/` → Item fields |
| **Excel export profesional** | 4 hojas (portada, resumen, global, por sección) | `components/ProfessionalInventoryExport.tsx` |
| **Excel import con validación** | Carga + valida + resumen previo | `hooks/useInventoryOperations.ts` → importExcel |
| **Reubicar diferido** | Cambiar ubicación sin retirar | `useOperativeShelf.ts` → moveItemDifferent |
| **Almacén global** | Ubicaciones que no pertenecen a shelf | `lib/schema/shelves.ts` → WAREHOUSE section |

---

## 🏗️ Estructura de Carpetas Rápida

```
aplicacion/
├── components/           ← Componentes React por view
│   ├── KioskView.tsx
│   ├── CalidadView.tsx
│   ├── ConsoleView.tsx
│   ├── AdminConsole.tsx
│   ├── ShelfGrid.tsx
│   ├── RetirarCellModal.tsx
│   └── ...
├── domain/              ← Lógica de dominio (auth, shelves)
│   ├── auth/
│   │   ├── authCapabilities.ts    ← PERMISOS
│   │   ├── authTypes.ts
│   │   └── ...
│   ├── shelves/
│   │   └── shelfAccess.ts
│   └── ...
├── hooks/               ← Custom React hooks
│   ├── useAuth.ts       ← AUTENTICACIÓN
│   ├── useShelf.ts      ← SHELF STATE
│   ├── useOperativeShelf.ts  ← UBICAR/RETIRAR
│   ├── useKiosk.ts
│   └── ...
├── lib/                 ← Utilities + schema
│   ├── schema/          ← TypeScript interfaces
│   │   ├── roles.ts
│   │   ├── collections.ts
│   │   ├── shelves.ts   ← SHELF_DEFINITIONS
│   │   └── ...
│   ├── firestoreSchema.ts  ← Barrel export
│   ├── operativeShelfLogic.ts  ← VALIDACIÓN
│   └── ...
└── public/              ← Assets estáticos

servidor/
├── functions/           ← Cloud Functions
│   ├── operateLocation.ts    ← UBICAR
│   ├── operateMultiple.ts
│   ├── ocrImage.ts
│   ├── fcm.ts
│   └── ...
└── config/              ← Firebase config
```

---

## 🔍 Buscar Algo Rápido

```bash
# Buscar por palabra clave
grep -r "canAccessShelf" aplicacion/src

# Buscar por tipo
grep -r "interface Shelf" aplicacion/src

# Buscar por función
grep -r "operateLocation" aplicacion/ servidor/

# Buscar referencias de Cloud Function
grep -r "callOperateLocationApi" aplicacion/src
```

---

## 📞 Cuando Alguien Te Pregunta...

### Sobre PERMISOS
→ `ROLES.md` + `domain/auth/authCapabilities.ts`

### Sobre UBICAR/RETIRAR
→ `ARCHITECTURE.md` (Flujos Clave) + `hooks/useOperativeShelf.ts`

### Sobre COLECCIONES
→ `lib/schema/collections.ts` + `ARCHITECTURE.md` (Estructura Principal)

### Sobre NOTIFICACIONES
→ `hooks/useUrgentAlerts.ts` + `notifications_system_analysis.md`

### Sobre FIRESTORE RULES
→ `/firestore.rules` + `RULES.md` (Checklist)

### Sobre COMPONENTES
→ `components/{nombre}.tsx` directamente

### Sobre BUGS
→ `RULES.md` (Cosas que rompemos frecuentemente)

### Sobre FLUJOS
→ `ARCHITECTURE.md` (Flujos Clave)

---

## 💡 Tips Prácticos

1. **Si no sabes por dónde empezar**: Lee `ROLES.md` + `ARCHITECTURE.md`
2. **Si vas a cambiar algo**: Mira `RULES.md` primero
3. **Si hay bug**: Búscalo en `RULES.md` → "Cosas que rompemos frecuentemente"
4. **Si necesitas entender un hook**: Lee la firma en `hooks/useXxx.ts` + donde se usa
5. **Si necesitas saber qué hace una Cloud Function**: Lee el comentario inicial + parámetros

---

## 🗂️ Documentos Base (¡Lee primero!)

- **ROLES.md** — Qué rol ve/hace qué
- **ARCHITECTURE.md** — Cómo funciona todo junto
- **RULES.md** — Qué cuidar antes de cambiar
- **CLAUDE_GUIDE.md** (este) — Mapa de navegación
