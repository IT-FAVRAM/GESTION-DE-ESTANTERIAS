# Full Hardening Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir todos los riesgos detectados de seguridad, funcionamiento, estructura y consistencia de flujos de artículos sin romper la operativa diaria.

**Architecture:** El plan se ejecuta en fases: primero bugs críticos de flujo (escaneo y persistencia), luego consistencia de ubicaciones y operaciones atómicas, después hardening de reglas/seguridad, y finalmente deuda técnica (tests de comportamiento, docs y dependencias). Cada tarea sigue ciclo TDD corto (falla -> fix mínimo -> pasa -> commit).

**Tech Stack:** React + TypeScript + Vite, Firebase Auth/Firestore Rules, Cloud Functions TypeScript, scripts Node en `tests/*.cjs`.

---

### Task 1: Consumir acciones de escaneo (dispatcher completo)

**Files:**
- Modify: `hooks/useAppLogic.ts`
- Modify: `hooks/useInventoryWorkflows.ts`
- Test: `tests/scan_action_dispatcher_regression.cjs`

**Step 1: Write the failing test**

```js
// tests/scan_action_dispatcher_regression.cjs
const fs = require('fs');
const src = fs.readFileSync('hooks/useAppLogic.ts', 'utf8');
if (!src.includes('handleScanActionResult')) throw new Error('Missing action dispatcher');
if (!src.includes("case 'remove'")) throw new Error('Missing remove action handling');
if (!src.includes("case 'request'")) throw new Error('Missing request action handling');
if (!src.includes("case 'finish'")) throw new Error('Missing finish action handling');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scan_action_dispatcher_regression.cjs`
Expected: FAIL with missing dispatcher/action.

**Step 3: Write minimal implementation**

```ts
// useAppLogic.ts
type ScanResult = { action: 'remove'|'request'|'finish'|'duplicate'|'assign_to_target'; data: any } | null;
const handleScanActionResult = (result: ScanResult) => { ...switch(result.action)... };
// Use it in handlePhotoAnalysisResult + handleWorkflowScan
```

**Step 4: Run test to verify it passes**

Run: `node tests/scan_action_dispatcher_regression.cjs`
Expected: PASS (`ok`).

**Step 5: Commit**

```bash
git add hooks/useAppLogic.ts hooks/useInventoryWorkflows.ts tests/scan_action_dispatcher_regression.cjs
git commit -m "fix: execute scan workflow actions through unified dispatcher"
```

### Task 2: Persistir schema completo de AssignmentItem

**Files:**
- Modify: `hooks/useAssignments.ts`
- Modify: `lib/warehouseData.ts`
- Test: `tests/assignments_full_schema_persistence.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('hooks/useAssignments.ts', 'utf8');
const required = ['status', 'packageType', 'itemKey', 'quantity', 'containerId', 'notes'];
for (const key of required) if (!src.includes(key)) throw new Error(`Missing persisted field: ${key}`);
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/assignments_full_schema_persistence.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// saveAssignments serialization
{ barcode, orderId, timestamp, assignedAt, movedAt, status, packageType, itemKey, quantity, containerId, notes }
```

**Step 4: Run test to verify it passes**

Run: `node tests/assignments_full_schema_persistence.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/useAssignments.ts lib/warehouseData.ts tests/assignments_full_schema_persistence.cjs
git commit -m "fix: preserve full assignment item schema on persistence"
```

### Task 3: Corregir `activeWarehouseId` roto en EmptyLocationsModal

**Files:**
- Modify: `components/AppModals.tsx`
- Modify: `App.tsx`
- Test: `tests/empty_locations_modal_props.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('components/AppModals.tsx', 'utf8');
if (src.includes('config.activeWarehouseId')) throw new Error('Broken prop still used');
if (!src.includes('activeWarehouseId={props.activeWarehouse}')) throw new Error('Modal not wired to activeWarehouse');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/empty_locations_modal_props.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```tsx
// AppModals.tsx
activeWarehouseId={props.activeWarehouse}
```

**Step 4: Run test to verify it passes**

Run: `node tests/empty_locations_modal_props.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/AppModals.tsx App.tsx tests/empty_locations_modal_props.cjs
git commit -m "fix: wire empty locations modal to current active warehouse"
```

### Task 4: Hacer atómico el flujo “Retirar a trabajo”

**Files:**
- Modify: `lib/production.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Test: `tests/withdraw_atomicity_regression.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('hooks/useInventoryOperations.ts', 'utf8');
if (src.includes('await moveToWorking(item, location);') && src.includes('await removeItemTransaction(')) {
  throw new Error('Non-atomic withdraw flow still present');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/withdraw_atomicity_regression.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// production.ts
export const withdrawToWorkingAtomic = async (item, fromLocation, user) => { transaction: remove from assignments + set workingItems + history }
// useInventoryOperations.ts -> call withdrawToWorkingAtomic only
```

**Step 4: Run test to verify it passes**

Run: `node tests/withdraw_atomicity_regression.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/production.ts hooks/useInventoryOperations.ts tests/withdraw_atomicity_regression.cjs
git commit -m "fix: make withdraw-to-working transition atomic"
```

### Task 5: Preservar metadatos completos al “Terminar y ubicar”

**Files:**
- Modify: `lib/production.ts`
- Modify: `hooks/useWorkingItems.ts`
- Test: `tests/locate_working_preserves_metadata.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('lib/production.ts', 'utf8');
const required = ['quantity', 'containerId', 'notes', 'itemKey', 'packageType'];
for (const key of required) if (!src.includes(key)) throw new Error(`Missing metadata in locateWorkingItem: ${key}`);
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/locate_working_preserves_metadata.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// locateWorkingItem assigned object includes full metadata from working item
```

**Step 4: Run test to verify it passes**

Run: `node tests/locate_working_preserves_metadata.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/production.ts hooks/useWorkingItems.ts tests/locate_working_preserves_metadata.cjs
git commit -m "fix: preserve full item metadata when relocating from working"
```

### Task 6: Unificar layouts en todos los modales operativos

**Files:**
- Modify: `components/MoveItemModal.tsx`
- Modify: `components/RelocateLocationModal.tsx`
- Modify: `components/MultiLocationSelector.tsx`
- Modify: `components/EmptyLocationsModal.tsx`
- Modify: `components/AssignmentList.tsx`
- Modify: `lib/warehouseLayout.ts`
- Test: `tests/layout_single_source_all_modals.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const files = ['components/MoveItemModal.tsx','components/RelocateLocationModal.tsx','components/MultiLocationSelector.tsx','components/EmptyLocationsModal.tsx'];
for (const f of files) {
  const src = fs.readFileSync(f,'utf8');
  if (!src.includes('generateLayoutLocations')) throw new Error(`${f} not using central layout`);
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/layout_single_source_all_modals.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// Replace local per-warehouse branches with generateLayoutLocations(warehouse)
```

**Step 4: Run test to verify it passes**

Run: `node tests/layout_single_source_all_modals.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/MoveItemModal.tsx components/RelocateLocationModal.tsx components/MultiLocationSelector.tsx components/EmptyLocationsModal.tsx components/AssignmentList.tsx lib/warehouseLayout.ts tests/layout_single_source_all_modals.cjs
git commit -m "refactor: use single layout source across all location modals"
```

### Task 7: Resolver incoherencia PIN (parser + layout + lista)

**Files:**
- Modify: `lib/warehouseLayout.ts`
- Modify: `lib/locationParser.ts`
- Modify: `components/AssignmentList.tsx`
- Test: `tests/pin_layout_consistency.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const parser = fs.readFileSync('lib/locationParser.ts','utf8');
const layout = fs.readFileSync('lib/warehouseLayout.ts','utf8');
if (!parser.includes('15') || !layout.includes('15')) throw new Error('PIN ranges not aligned');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/pin_layout_consistency.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// Establish canonical PIN ranges in warehouseLayout and reuse in parser/UI generation.
```

**Step 4: Run test to verify it passes**

Run: `node tests/pin_layout_consistency.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/warehouseLayout.ts lib/locationParser.ts components/AssignmentList.tsx tests/pin_layout_consistency.cjs
git commit -m "fix: align PIN ranges across layout parser and views"
```

### Task 8: Identidad robusta para multi-pallet/multi-OF

**Files:**
- Modify: `lib/warehouseData.ts`
- Modify: `lib/inventoryTransactions.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Modify: `components/LocationDetailModal.tsx`
- Test: `tests/item_identity_container_aware.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const tx = fs.readFileSync('lib/inventoryTransactions.ts','utf8');
if (!tx.includes('containerId')) throw new Error('Container-aware identity not implemented');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/item_identity_container_aware.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// find/remove/move operations use itemKey first, fallback barcode+orderId for backwards compatibility
```

**Step 4: Run test to verify it passes**

Run: `node tests/item_identity_container_aware.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/warehouseData.ts lib/inventoryTransactions.ts hooks/useInventoryOperations.ts components/LocationDetailModal.tsx tests/item_identity_container_aware.cjs
git commit -m "feat: make item operations container-aware for multi-pallet scenarios"
```

### Task 9: Endurecer rules de `history` y notificaciones

**Files:**
- Modify: `firestore.rules`
- Modify: `functions/src/index.ts`
- Modify: `hooks/useSystemNotifications.ts`
- Test: `docs/security/rules-matrix-history-notifications.md`

**Step 1: Write the failing rules matrix**

```md
- Authenticated non-staff cannot create history entry -> DENY
- Staff cannot spoof senderRole different from own claims -> DENY
- Request completion by forklift owner -> ALLOW
```

**Step 2: Run emulator checks to verify failures first**

Run: `firebase emulators:start --only firestore`
Expected: matrix reveals current gaps.

**Step 3: Write minimal implementation**

```rules
// history create restricted (admin or backend-only marker)
// notifications create validates senderRole == getRole()
// per-type RBAC constraints
```

**Step 4: Run rules checks to verify pass**

Run: `firebase emulators:start --only firestore`
Expected: matrix passes.

**Step 5: Commit**

```bash
git add firestore.rules functions/src/index.ts hooks/useSystemNotifications.ts docs/security/rules-matrix-history-notifications.md
git commit -m "security: tighten history and notification authorization rules"
```

### Task 10: Alinear almacenes dinámicos con sincronización y sección

**Files:**
- Modify: `hooks/useWarehouseConfig.ts`
- Modify: `hooks/useAssignments.ts`
- Modify: `firestore.rules`
- Test: `tests/dynamic_warehouse_sync_regression.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('hooks/useAssignments.ts','utf8');
if (src.includes('WAREHOUSES.forEach')) throw new Error('Still using static warehouse list');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/dynamic_warehouse_sync_regression.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// subscribe using config.warehouses map, with fallback safe defaults
```

**Step 4: Run test to verify it passes**

Run: `node tests/dynamic_warehouse_sync_regression.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/useWarehouseConfig.ts hooks/useAssignments.ts firestore.rules tests/dynamic_warehouse_sync_regression.cjs
git commit -m "fix: synchronize assignments using dynamic warehouse configuration"
```

### Task 11: Hacer `finishedItems` fuente remota principal

**Files:**
- Modify: `hooks/useStorage.ts`
- Modify: `lib/production.ts`
- Modify: `components/ProcessFinishedModal.tsx`
- Test: `tests/finished_items_remote_source_regression.cjs`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const src = fs.readFileSync('hooks/useStorage.ts','utf8');
if (!src.includes("collection('finishedItems')") && !src.includes('collection("finishedItems")')) {
  throw new Error('finishedItems still local-only');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/finished_items_remote_source_regression.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// useStorage subscribes Firestore finishedItems, localStorage as cache fallback
```

**Step 4: Run test to verify it passes**

Run: `node tests/finished_items_remote_source_regression.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/useStorage.ts lib/production.ts components/ProcessFinishedModal.tsx tests/finished_items_remote_source_regression.cjs
git commit -m "fix: use firestore as source of truth for finished items"
```

### Task 12: Reforzar tests de comportamiento (no solo string checks)

**Files:**
- Create: `tests/behavior/scan-flow.behavior.cjs`
- Create: `tests/behavior/withdraw-working.behavior.cjs`
- Create: `tests/behavior/multi-pallet.behavior.cjs`
- Modify: `package.json`

**Step 1: Write failing behavior tests**

```js
// scenario-driven tests with mocked state/actions
throw new Error('behavior tests not implemented yet');
```

**Step 2: Run to verify they fail**

Run: `node tests/behavior/scan-flow.behavior.cjs`
Expected: FAIL.

**Step 3: Implement minimal behavior harness**

```js
// lightweight node assertions for state transitions
```

**Step 4: Run to verify pass**

Run: `node tests/behavior/scan-flow.behavior.cjs && node tests/behavior/withdraw-working.behavior.cjs && node tests/behavior/multi-pallet.behavior.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/behavior package.json
git commit -m "test: add behavior-level regressions for critical inventory flows"
```

### Task 13: Alinear documentación de seguridad con implementación real

**Files:**
- Modify: `docs/SECURITY.md`
- Create: `docs/security/OPERATIONS_SECURITY_MATRIX.md`

**Step 1: Write failing doc assertion**

```js
// tests/security_docs_alignment.cjs
const fs = require('fs');
const src = fs.readFileSync('docs/SECURITY.md', 'utf8');
if (src.includes('Schema Validation') && src.includes('assignments') && src.includes('strict schema') ) {
  throw new Error('Doc still overstates assignments schema validation');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/security_docs_alignment.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```md
// SECURITY.md reflects exact current rule guarantees + limitations.
```

**Step 4: Run test to verify pass**

Run: `node tests/security_docs_alignment.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/SECURITY.md docs/security/OPERATIONS_SECURITY_MATRIX.md tests/security_docs_alignment.cjs
git commit -m "docs: align security documentation with enforced controls"
```

### Task 14: Dependencias vulnerables (plan de upgrade controlado)

**Files:**
- Modify: `package.json`
- Modify: `functions/package.json`
- Modify: `functions/package-lock.json`
- Create: `docs/security/dependency-upgrade-playbook.md`

**Step 1: Write failing audit gate**

```bash
npm audit --omit=dev
npm --prefix functions audit --omit=dev
```

Expected: FAIL (xlsx/firebase-admin chain vulnerabilities).

**Step 2: Implement minimal safe upgrade path**

```md
// playbook with canary deploy + rollback for firebase-admin major
```

**Step 3: Apply dependency updates incrementally**

```bash
npm install <safe-version>
npm --prefix functions install firebase-admin@^13.6.1
```

**Step 4: Verify**

Run: `npm audit --omit=dev && npm --prefix functions audit --omit=dev && npm run build && npm --prefix functions run build`
Expected: no critical/high or documented accepted risk with compensating controls.

**Step 5: Commit**

```bash
git add package.json functions/package.json functions/package-lock.json docs/security/dependency-upgrade-playbook.md
git commit -m "chore: reduce production dependency vulnerabilities with controlled upgrades"
```

### Task 15: Verificación integral final

**Files:**
- Test: `tests/*.cjs`
- Test: `tests/behavior/*.cjs`

**Step 1: Run full regression + builds**

```bash
node tests/scan_action_dispatcher_regression.cjs && node tests/assignments_full_schema_persistence.cjs && node tests/empty_locations_modal_props.cjs && node tests/withdraw_atomicity_regression.cjs && node tests/locate_working_preserves_metadata.cjs && node tests/layout_single_source_all_modals.cjs && node tests/pin_layout_consistency.cjs && node tests/item_identity_container_aware.cjs && node tests/dynamic_warehouse_sync_regression.cjs && node tests/finished_items_remote_source_regression.cjs && node tests/security_docs_alignment.cjs && node tests/behavior/scan-flow.behavior.cjs && node tests/behavior/withdraw-working.behavior.cjs && node tests/behavior/multi-pallet.behavior.cjs && npm run build && npm --prefix functions run build
```

Expected: all checks PASS.

**Step 2: Commit final stabilization**

```bash
git add .
git commit -m "chore: complete full hardening remediation across security flows and data integrity"
```
