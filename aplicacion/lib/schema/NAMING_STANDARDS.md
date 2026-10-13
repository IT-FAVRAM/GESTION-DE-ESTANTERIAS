# 📋 NAMING STANDARDS — WMS v3.0

**Convenciones de nomenclatura para TODA la aplicación. Debe ser seguida estrictamente para evitar confusión.**

---

## 🏢 WAREHOUSE / SHELF / POSITION / LOCATION

| Término | Tipo | Formato | Ejemplo | Uso |
|---------|------|---------|---------|-----|
| **shelfCode** | `string` | Mayúsculas, 3 chars | `"SOL"`, `"PRE"`, `"REP"` | Identificador único de estantería/almacén |
| **position** | `string \| number` | Número 0-padded a 3 dígitos o string especial | `"001"`, `"URG MEC-PRE 001"` | Ubicación dentro de una estantería |
| **locationId** | `string` | `{shelfCode}-{position}` (CON GUION) | `"SOL-001"`, `"REP-URG001"` | ID único global de ubicación. **NUNCA usar underscore** |
| **location** | `ShelfLocationState` | Objeto | `{ position, items, isEmpty, locationId, nota }` | Datos completos de una ubicación |

---

## 📦 ARTICLES / ITEMS

| Término | Tipo | Formato | Ejemplo | Uso |
|---------|------|---------|---------|-----|
| **articleCode** | `string` | Código de artículo del ERP | `"A001234"`, `"FRAME-50x30"` | Identificador del artículo |
| **orderFab** | `string` (OF) | Orden de fabricación | `"OF-2024-0001"` | Orden asociada al artículo |
| **presenceId** | `string` | `{uid}-{timestamp}-{shelfCode}-{position}` | `"user123-1717945320000-SOL-001"` | ID único de una instancia de artículo ubicado. **Para deduplicación** |
| **LocationItem** | Objeto | `{ presenceId, articleCode, orderFab, locatedBy, ... }` | — | Datos de un artículo en una ubicación |

---

## 👤 USERS / ROLES

| Término | Tipo | Valores | Uso |
|---------|------|--------|-----|
| **role** | `UserRole` | `'OPERARIO' \| 'CARRETILLERO' \| 'CALIDAD' \| 'JEFE_SECCION' \| 'ADMIN' \| 'SUPERADMIN'` | Rol del usuario |
| **assignedShelf** | `string` | shelfCode (`"SOL"`, `"PRE"`) | Estantería asignada a JEFE_SECCION u OPERARIO |
| **section** | `WarehouseSection` | `'SOLDADURA' \| 'PINTURA' \| ...` | Sección del usuario |

---

## ⚙️ STATE / ACTIONS

| Término | Tipo | Valores | Uso |
|---------|------|--------|-----|
| **action** | `OperativeAction` | `'idle' \| 'ubicar' \| 'retirar' \| 'mover' \| 'reubicar' \| 'almacen' \| 'avisar'` | Acción operativa activa |
| **status** | String | `'pending' \| 'syncing' \| 'synced' \| 'conflict'` (OfflineQueueEntry) | Estado de una operación offline |
| **requestType** | String | `'RECOGER' \| 'TRAER'` (PickupRequest) | Tipo de solicitud |

---

## 📍 HELPERS & FUNCTIONS

| Función | Input | Output | Ubicación |
|---------|-------|--------|-----------|
| `getLocationDocId(shelfCode, position)` | `string, string\|number` | `string` (format: `"SOL-001"`) | `schema/shelves.ts` |
| `getLocationDocId()` **vs** `locationId` | — | — | **SIEMPRE usar función, NUNCA construir string manualmente** |
| `getSectionForShelf(shelfCode)` | `string` | `WarehouseSection` | `schema/shelves.ts` |

---

## ❌ ANTI-PATTERNS (NO HACER)

```typescript
// ❌ INCORRECTO: locationId con underscore
locationId: `${shelfCode}_${position}`  // "SOL_001" ← MAL

// ❌ INCORRECTO: Construir locationId sin función helper
`${shelf}-${pos}`  // Puede haber inconsistencias

// ❌ INCORRECTO: Confundir position con locationId
const position = "SOL-001";  // ← ES locationId, no position

// ❌ INCORRECTO: presenceId sin estructura
presenceId: `offline-${Date.now()}-${random()}`  // No es dedup-friendly
```

## ✅ CORRECT PATTERNS (USAR)

```typescript
// ✅ CORRECTO: Usar función helper
import { getLocationDocId } from './schema/shelves';
const locationId = getLocationDocId('SOL', '001');  // "SOL-001"

// ✅ CORRECTO: presenceId estructurado
presenceId: `${userId}-${Date.now()}-${shelfCode}-${position}`

// ✅ CORRECTO: Separar position de locationId
const position = '001';
const locationId = getLocationDocId(shelfCode, position);  // "SOL-001"
```

---

## 🔑 KEY RULES

1. **locationId SIEMPRE con guion** (`-`), nunca underscore (`_`)
2. **Generar locationId CON FUNCIÓN** `getLocationDocId()`, nunca string literal
3. **presenceId dedup-friendly**: `{uid}-{timestamp}-{shelf}-{pos}`
4. **position** es lo que está DENTRO de una estantería (`"001"`, `"URG001"`)
5. **locationId** es el ID global única (`"SOL-001"`)
6. **shelfCode** SIEMPRE mayúsculas (`"SOL"`, no `"sol"`)

---

**Last updated:** 2026-06-09  
**Maintainer:** Equipo de Desarrollo
