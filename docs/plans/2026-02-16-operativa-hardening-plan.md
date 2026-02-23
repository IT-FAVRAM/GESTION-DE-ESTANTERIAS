# Operativa Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar fallos operativos criticos de planta (escaneo, validacion de ubicaciones, solicitudes, permisos y pallets multi-articulo) sin romper el flujo actual de uso.

**Architecture:** Se aplican hotfixes de bajo riesgo en cliente y reglas Firestore primero, luego consistencia de estados y colas de solicitudes, y finalmente mejoras de modelo para pallets. Cada cambio se valida con prueba enfocada al flujo real y build completo.

**Tech Stack:** React 19 + TypeScript + Vite, Firebase Auth, Firestore Rules, Cloud Functions (Node/TypeScript), tests Node (scripts `tests/*.cjs`).

---

### Task 1: Reconectar flujo real de escaneo

**Files:**
- Modify: `App.tsx:203`
- Modify: `hooks/useInventoryWorkflows.ts:35`
- Modify: `hooks/useAppLogic.ts:435`
- Test: `tests/scan_workflow_regression.cjs`

**Step 1: Write the failing test**

```js
// tests/scan_workflow_regression.cjs
// Expect: processScanInput is real handler, not stub returning true.
const fs = require('fs');
const src = fs.readFileSync('App.tsx', 'utf8');
if (src.includes('processScanInput: async (barcode: string, intent: any) => true')) {
  throw new Error('Stub processScanInput still present');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scan_workflow_regression.cjs`
Expected: FAIL with `Stub processScanInput still present`

**Step 3: Write minimal implementation**

```ts
// App.tsx (idea)
const { processScanInput, resetScanWorkflow } = useInventoryWorkflows(...);
useAppLogic({ ..., processScanInput, ... });
```

**Step 4: Run test to verify it passes**

Run: `node tests/scan_workflow_regression.cjs`
Expected: PASS (`ok`)

**Step 5: Commit**

```bash
git add App.tsx hooks/useInventoryWorkflows.ts hooks/useAppLogic.ts tests/scan_workflow_regression.cjs
git commit -m "fix: reconnect real scan workflow handlers"
```

### Task 2: Endurecer validacion de ubicacion (sin fuzzy inseguro)

**Files:**
- Modify: `components/ValidationScanner.tsx:18`
- Modify: `lib/locationParser.ts`
- Modify: `lib/warehouseLayout.ts`
- Test: `tests/location_validation_strict.cjs`

**Step 1: Write the failing test**

```js
// tests/location_validation_strict.cjs
const assert = require('assert');
// pseudo: target = MEC-E1-B1-MEC 001
// scanned = "MEC 999" must fail
assert.strictEqual(false, false);
```

**Step 2: Run test to verify it fails**

Run: `node tests/location_validation_strict.cjs`
Expected: FAIL until strict matcher is implemented

**Step 3: Write minimal implementation**

```ts
// ValidationScanner.tsx
// parse scanned location to normalized LocationId
// compare strict equality with targetLocation
```

**Step 4: Run test to verify it passes**

Run: `node tests/location_validation_strict.cjs`
Expected: PASS

**Step 5: Commit**

```bash
git add components/ValidationScanner.tsx lib/locationParser.ts lib/warehouseLayout.ts tests/location_validation_strict.cjs
git commit -m "fix: enforce strict location validation matching"
```

### Task 3: Solicitudes carretillero con estado global real

**Files:**
- Modify: `hooks/useSystemNotifications.ts:167`
- Modify: `components/CarretilleroRequestsView.tsx:63`
- Modify: `firestore.rules:107`
- Optional migrate: `functions/src/index.ts`
- Test: `tests/requests_global_status.cjs`

**Step 1: Write the failing test**

```js
// tests/requests_global_status.cjs
const fs = require('fs');
const src = fs.readFileSync('components/CarretilleroRequestsView.tsx', 'utf8');
if (!src.includes('status')) throw new Error('Global status not implemented');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/requests_global_status.cjs`
Expected: FAIL (`Global status not implemented`)

**Step 3: Write minimal implementation**

```ts
// notifications model
status: 'PENDING' | 'COMPLETED'
completedBy?: uid
completedAt?: ISO
```

**Step 4: Run test to verify it passes**

Run: `node tests/requests_global_status.cjs`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/useSystemNotifications.ts components/CarretilleroRequestsView.tsx firestore.rules tests/requests_global_status.cjs
git commit -m "fix: make forklift requests globally completable"
```

### Task 4: Eliminar ventana de 24h para pendientes

**Files:**
- Modify: `components/CarretilleroRequestsView.tsx:41`
- Modify: `hooks/useSystemNotifications.ts:136`
- Test: `tests/requests_no_time_cutoff.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('components/CarretilleroRequestsView.tsx', 'utf8');
if (src.includes('24 * 60 * 60 * 1000')) throw new Error('24h cutoff still present');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/requests_no_time_cutoff.cjs`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// query by status == PENDING, ordered by timestamp desc, paginated
```

**Step 4: Run test to verify it passes**

Run: `node tests/requests_no_time_cutoff.cjs`
Expected: PASS

**Step 5: Commit**

```bash
git add components/CarretilleroRequestsView.tsx hooks/useSystemNotifications.ts tests/requests_no_time_cutoff.cjs
git commit -m "fix: keep pending requests visible beyond 24h"
```

### Task 5: Unificar “Terminar y ubicar” para evitar estado contradictorio

**Files:**
- Modify: `components/WorkingItemsList.tsx:81`
- Modify: `hooks/useWorkingItems.ts:30`
- Modify: `lib/production.ts:70`
- Test: `tests/working_finish_and_locate_consistency.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('components/WorkingItemsList.tsx', 'utf8');
if (src.includes('await finishItem(item') && src.includes('Terminar y Ubicar')) {
  throw new Error('Finish+Locate still uses finishItem path');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/working_finish_and_locate_consistency.cjs`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// use locateItem for "Terminar y ubicar"
// reserve finishItem for final close only
```

**Step 4: Run test to verify it passes**

Run: `node tests/working_finish_and_locate_consistency.cjs`
Expected: PASS

**Step 5: Commit**

```bash
git add components/WorkingItemsList.tsx hooks/useWorkingItems.ts lib/production.ts tests/working_finish_and_locate_consistency.cjs
git commit -m "fix: align finish-and-locate with working item relocation flow"
```

### Task 6: Endurecer permisos de sección en Firestore

**Files:**
- Modify: `firestore.rules:1`
- Reference: `hooks/useRoles.ts:184`
- Test: `docs/security/rules-test-matrix.md`

**Step 1: Write the failing test matrix**

```md
JEFE(SOLDADURA) cannot write MEC location -> expected DENY
JEFE(SOLDADURA) can write SOL location -> expected ALLOW
```

**Step 2: Run rules simulation to verify failure**

Run: `firebase emulators:start --only firestore` + rules-unit checks
Expected: current matrix fails for out-of-section writes

**Step 3: Write minimal implementation**

```rules
function sectionFromLocation(locationId) { ... }
allow write: if isAdmin() || (isJefe() && request.auth.token.section == sectionFromLocation(locationId)) || isCarretillero();
```

**Step 4: Run rules tests to verify pass**

Run: rules-unit checks again
Expected: all matrix checks pass

**Step 5: Commit**

```bash
git add firestore.rules docs/security/rules-test-matrix.md
git commit -m "security: enforce section-scoped writes for jefe role"
```

### Task 7: Fuente unica para layouts de ubicaciones

**Files:**
- Modify: `lib/warehouseLayout.ts`
- Modify: `components/AssignmentModal.tsx:54`
- Modify: `components/AssignmentList.tsx:413`
- Test: `tests/layout_consistency.cjs`

**Step 1: Write the failing test**

```js
// compare generated positions in modal/list/validator source
throw new Error('layout sources mismatch');
```

**Step 2: Run test to verify it fails**

Run: `node tests/layout_consistency.cjs`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// remove local hardcodes and consume generateLayoutLocations()
```

**Step 4: Run test to verify it passes**

Run: `node tests/layout_consistency.cjs`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/warehouseLayout.ts components/AssignmentModal.tsx components/AssignmentList.tsx tests/layout_consistency.cjs
git commit -m "refactor: centralize warehouse layout source of truth"
```

### Task 8: Soporte operativo para pallets multi-articulo/multi-unidad

**Files:**
- Modify: `lib/warehouseData.ts`
- Modify: `lib/inventoryTransactions.ts`
- Modify: `components/LocationDetailModal.tsx`
- Modify: `components/AssignmentList.tsx`
- Test: `tests/pallet_multi_item_regression.cjs`

**Step 1: Write the failing test**

```js
// scenario: same barcode+order appears with quantity > 1 and mixed items in one pallet
// expected deterministic remove/move behavior
throw new Error('quantity/container behavior not implemented');
```

**Step 2: Run test to verify it fails**

Run: `node tests/pallet_multi_item_regression.cjs`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
type AssignmentItem = { ..., quantity?: number, containerId?: string }
// default quantity=1 for backward compatibility
```

**Step 4: Run test to verify it passes**

Run: `node tests/pallet_multi_item_regression.cjs`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/warehouseData.ts lib/inventoryTransactions.ts components/LocationDetailModal.tsx components/AssignmentList.tsx tests/pallet_multi_item_regression.cjs
git commit -m "feat: add low-risk multi-item pallet support"
```

### Task 9: Verificacion final integrada

**Files:**
- Test: `tests/scan_workflow_regression.cjs`
- Test: `tests/location_validation_strict.cjs`
- Test: `tests/requests_global_status.cjs`
- Test: `tests/requests_no_time_cutoff.cjs`
- Test: `tests/working_finish_and_locate_consistency.cjs`
- Test: `tests/layout_consistency.cjs`
- Test: `tests/pallet_multi_item_regression.cjs`

**Step 1: Run full local verification**

```bash
node tests/scan_workflow_regression.cjs && node tests/location_validation_strict.cjs && node tests/requests_global_status.cjs && node tests/requests_no_time_cutoff.cjs && node tests/working_finish_and_locate_consistency.cjs && node tests/layout_consistency.cjs && node tests/pallet_multi_item_regression.cjs && npm run build && npm --prefix functions run build
```

**Step 2: Expected result**

Expected: all checks pass, frontend build OK, functions build OK.

**Step 3: Commit release-safe batch**

```bash
git add .
git commit -m "chore: harden critical warehouse workflows and operational consistency"
```
