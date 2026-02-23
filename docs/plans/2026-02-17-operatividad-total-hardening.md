# Operatividad Total Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Blindar la operativa de almacén para que permisos, movimientos, vaciados, trazabilidad y rendimiento sean robustos en producción.

**Architecture:** Se moverá la autorización crítica al backend con Cloud Functions como única vía de escritura operativa para roles no-admin. El frontend pasará a un gateway de operaciones tipado y consistente, con estados de error explícitos y auditoría completa. Se reducirá carga inicial suscribiendo solo almacenes necesarios y se centralizará la matriz de permisos para evitar regresiones.

**Tech Stack:** React 19, TypeScript, Firebase Auth, Firestore Rules v2, Firebase Cloud Functions (Node/TS), Vite.

---

### Task 1: Matriz única de permisos (fuente de verdad)

**Files:**
- Create: `lib/permissionMatrix.ts`
- Modify: `hooks/useRoles.ts`
- Modify: `components/AssignmentList.tsx`
- Modify: `components/LocationDetailModal.tsx`
- Modify: `components/AppModals.tsx`
- Test: `tests/permission_matrix_consistency.cjs`

**Step 1: Write the failing test**

```js
// tests/permission_matrix_consistency.cjs
const assert = require('assert');
const { can } = require('../lib/permissionMatrix.cjs');

assert.equal(can('ADMIN', 'emptyShelf'), true);
assert.equal(can('JEFE', 'emptyShelf'), false);
assert.equal(can('CARRETILLERO', 'copyPaste'), false);
assert.equal(can('JEFE', 'emptyLocation'), true);
```

**Step 2: Run test to verify it fails**

Run: `node tests/permission_matrix_consistency.cjs`
Expected: FAIL with module/function not found.

**Step 3: Write minimal implementation**

```ts
// lib/permissionMatrix.ts
export type Role = 'ADMIN' | 'JEFE' | 'CARRETILLERO';
export type Capability = 'copyPaste' | 'dragMove' | 'emptyShelf' | 'emptyLocation';

const MATRIX: Record<Role, Record<Capability, boolean>> = {
  ADMIN: { copyPaste: true, dragMove: true, emptyShelf: true, emptyLocation: true },
  JEFE: { copyPaste: false, dragMove: false, emptyShelf: false, emptyLocation: true },
  CARRETILLERO: { copyPaste: false, dragMove: false, emptyShelf: false, emptyLocation: true }
};

export const can = (role: Role | null | undefined, capability: Capability) => {
  if (!role) return false;
  return MATRIX[role][capability];
};
```

**Step 4: Run test to verify it passes**

Run: `node tests/permission_matrix_consistency.cjs`
Expected: PASS without assertions.

**Step 5: Commit**

```bash
git add lib/permissionMatrix.ts hooks/useRoles.ts components/AssignmentList.tsx components/LocationDetailModal.tsx components/AppModals.tsx tests/permission_matrix_consistency.cjs
git commit -m "refactor: centralize operativity permissions into single matrix"
```

### Task 2: Endurecer reglas Firestore para bloquear bypass cliente

**Files:**
- Modify: `firestore.rules`
- Test: `tests/firestore_rules_assignments_guardrails.md`

**Step 1: Write the failing test**

```md
## Scenario
- JEFE intenta escribir directamente en /assignments/{warehouse}/locations/{loc} desde cliente.
- Debe ser rechazado por rules en operaciones no permitidas por backend.
```

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS build, but rule policy currently allows direct writes for staff (gap documentado).

**Step 3: Write minimal implementation**

```rules
function isTrustedOperationWrite() {
  return false; // placeholder until server pipeline is active
}

match /assignments/{warehouseId}/locations/{locationId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin() || isTrustedOperationWrite();
}
```

**Step 4: Run test to verify it passes**

Run: `firebase deploy --only firestore:rules --project <project-id>`
Expected: Rules deployed; direct staff writes blocked except admin.

**Step 5: Commit**

```bash
git add firestore.rules tests/firestore_rules_assignments_guardrails.md
git commit -m "security: deny direct assignment writes outside trusted backend flow"
```

### Task 3: API backend única para operaciones de inventario

**Files:**
- Modify: `functions/src/index.ts`
- Create: `lib/inventoryApi.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Test: `tests/inventory_api_contract.cjs`

**Step 1: Write the failing test**

```js
// tests/inventory_api_contract.cjs
const assert = require('assert');
const { validatePayload } = require('../lib/inventoryApi.contract.cjs');

assert.throws(() => validatePayload({ type: 'emptyShelf', role: 'JEFE' }));
```

**Step 2: Run test to verify it fails**

Run: `node tests/inventory_api_contract.cjs`
Expected: FAIL because contract validator/endpoint not created.

**Step 3: Write minimal implementation**

```ts
// functions/src/index.ts
export const inventoryOperate = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'auth required');
  const role = context.auth.token.role as string;
  const type = data?.type as string;

  if (type === 'emptyShelf' && role !== 'ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'only admin can empty shelf');
  }
  // moveWithEvidence, emptyLocation, etc...
  return { ok: true };
});
```

**Step 4: Run test to verify it passes**

Run: `npm run build && npm --prefix functions run build`
Expected: PASS and callable compiled.

**Step 5: Commit**

```bash
git add functions/src/index.ts lib/inventoryApi.ts hooks/useInventoryOperations.ts tests/inventory_api_contract.cjs
git commit -m "feat: route critical inventory writes through callable backend API"
```

### Task 4: Movimiento con evidencia (foto obligatoria) para JEFE/CARRETILLERO

**Files:**
- Modify: `hooks/useAppLogic.ts`
- Modify: `components/PhotoAnalyzerModal.tsx`
- Modify: `components/AppModals.tsx`
- Modify: `lib/inventoryApi.ts`
- Test: `tests/move_with_evidence_flow.cjs`

**Step 1: Write the failing test**

```js
// tests/move_with_evidence_flow.cjs
const assert = require('assert');
assert.equal(globalThis.__MOVE_REQUIRES_EVIDENCE_JEFE__, true);
assert.equal(globalThis.__MOVE_REQUIRES_EVIDENCE_CARRETILLERO__, true);
```

**Step 2: Run test to verify it fails**

Run: `node tests/move_with_evidence_flow.cjs`
Expected: FAIL until flow flag + backend validation exist.

**Step 3: Write minimal implementation**

```ts
// backend validation
if (type === 'moveItem') {
  const evidence = data?.evidence;
  if ((role === 'JEFE' || role === 'CARRETILLERO') && !evidence?.locationPhotoRef) {
    throw new HttpsError('failed-precondition', 'photo evidence required');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS and UI only completes JEFE/CARRETILLERO move after evidence payload.

**Step 5: Commit**

```bash
git add hooks/useAppLogic.ts components/PhotoAnalyzerModal.tsx components/AppModals.tsx lib/inventoryApi.ts tests/move_with_evidence_flow.cjs
git commit -m "feat: enforce move evidence for non-admin roles"
```

### Task 5: Vaciados atómicos y consistentes (ubicación/estantería)

**Files:**
- Modify: `functions/src/index.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Modify: `components/EmptyLocationsModal.tsx`
- Modify: `components/LocationDetailModal.tsx`
- Test: `tests/atomic_emptying_regression.cjs`

**Step 1: Write the failing test**

```js
// tests/atomic_emptying_regression.cjs
const assert = require('assert');
assert.equal(globalThis.__EMPTY_OP_RETURNS_PARTIAL__, false);
```

**Step 2: Run test to verify it fails**

Run: `node tests/atomic_emptying_regression.cjs`
Expected: FAIL because partial success is still possible.

**Step 3: Write minimal implementation**

```ts
// backend
// runTransaction: read all source docs, stage removals, commit once
// return {ok: true, removedCount, opId}
```

**Step 4: Run test to verify it passes**

Run: `npm run build && npm --prefix functions run build`
Expected: PASS and UI only reports success when atomic operation commits.

**Step 5: Commit**

```bash
git add functions/src/index.ts hooks/useInventoryOperations.ts components/EmptyLocationsModal.tsx components/LocationDetailModal.tsx tests/atomic_emptying_regression.cjs
git commit -m "fix: make location and shelf empty operations atomic"
```

### Task 6: Eliminar falsos “OK” en remove/move

**Files:**
- Modify: `lib/inventoryTransactions.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Modify: `hooks/useAppLogic.ts`
- Test: `tests/remove_not_found_must_fail.cjs`

**Step 1: Write the failing test**

```js
// tests/remove_not_found_must_fail.cjs
const assert = require('assert');
const result = { success: true, code: 'NOOP_NOT_FOUND' };
assert.notEqual(result.success, true);
```

**Step 2: Run test to verify it fails**

Run: `node tests/remove_not_found_must_fail.cjs`
Expected: FAIL, documenting current behavior.

**Step 3: Write minimal implementation**

```ts
if (itemIndex === -1) {
  throw new Error('ITEM_NOT_FOUND');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS; UI shows explicit error when item is missing.

**Step 5: Commit**

```bash
git add lib/inventoryTransactions.ts hooks/useInventoryOperations.ts hooks/useAppLogic.ts tests/remove_not_found_must_fail.cjs
git commit -m "fix: return explicit failures for missing inventory items"
```

### Task 7: Rendimiento: suscripción por almacén activo (y opcional vecino)

**Files:**
- Modify: `hooks/useAssignments.ts`
- Modify: `App.tsx`
- Modify: `lib/store.ts`
- Test: `tests/assignments_active_warehouse_subscription.cjs`

**Step 1: Write the failing test**

```js
// tests/assignments_active_warehouse_subscription.cjs
const assert = require('assert');
assert.equal(globalThis.__ASSIGNMENTS_SUBSCRIPTIONS_COUNT__, 1);
```

**Step 2: Run test to verify it fails**

Run: `node tests/assignments_active_warehouse_subscription.cjs`
Expected: FAIL because current code subscribes to all warehouses.

**Step 3: Write minimal implementation**

```ts
export const useAssignments = (activeWarehouse?: string) => {
  const warehousesToSubscribe = activeWarehouse ? [activeWarehouse] : ['MEC'];
  // subscribe only to warehousesToSubscribe
};
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS and single-warehouse subscription in runtime logs.

**Step 5: Commit**

```bash
git add hooks/useAssignments.ts App.tsx lib/store.ts tests/assignments_active_warehouse_subscription.cjs
git commit -m "perf: subscribe assignments by active warehouse only"
```

### Task 8: Notificaciones pendientes optimizadas (server-side filtering)

**Files:**
- Modify: `hooks/useSystemNotifications.ts`
- Modify: `firestore.rules`
- Create: `docs/indexes/notifications_pending_index.md`
- Test: `tests/notifications_pending_count_query.cjs`

**Step 1: Write the failing test**

```js
// tests/notifications_pending_count_query.cjs
const assert = require('assert');
assert.equal(globalThis.__REQUESTS_QUERY_HAS_STATUS_FILTER__, true);
```

**Step 2: Run test to verify it fails**

Run: `node tests/notifications_pending_count_query.cjs`
Expected: FAIL because counting still filters status client-side.

**Step 3: Write minimal implementation**

```ts
const qRequests = db.collection('notifications')
  .where('targetRole', '==', 'CARRETILLERO')
  .where('type', '==', 'request_material')
  .where('status', '==', 'PENDING')
  .orderBy('timestamp', 'desc')
  .limit(200);
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS and count equals snapshot size without client post-filter.

**Step 5: Commit**

```bash
git add hooks/useSystemNotifications.ts firestore.rules docs/indexes/notifications_pending_index.md tests/notifications_pending_count_query.cjs
git commit -m "perf: optimize pending requests count with indexed server-side filters"
```

### Task 9: Auditoría fuerte (quién, qué, cuándo, opId)

**Files:**
- Modify: `lib/inventoryTransactions.ts`
- Modify: `functions/src/index.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Create: `docs/audit/inventory_audit_contract.md`
- Test: `tests/history_audit_fields_required.cjs`

**Step 1: Write the failing test**

```js
// tests/history_audit_fields_required.cjs
const assert = require('assert');
const entry = { user: 'system' };
assert.ok(entry.uid);
assert.ok(entry.role);
assert.ok(entry.opId);
```

**Step 2: Run test to verify it fails**

Run: `node tests/history_audit_fields_required.cjs`
Expected: FAIL due to missing required audit fields.

**Step 3: Write minimal implementation**

```ts
const historyEntry = {
  ...base,
  uid: actor.uid,
  role: actor.role,
  user: actor.email,
  opId,
  source: 'inventoryOperate'
};
```

**Step 4: Run test to verify it passes**

Run: `npm run build && npm --prefix functions run build`
Expected: PASS and all new history entries include audit contract.

**Step 5: Commit**

```bash
git add lib/inventoryTransactions.ts functions/src/index.ts hooks/useInventoryOperations.ts docs/audit/inventory_audit_contract.md tests/history_audit_fields_required.cjs
git commit -m "chore: enforce full audit fields on inventory history events"
```

### Task 10: UX operativa robusta (adiós alert/confirm nativos)

**Files:**
- Create: `components/ConfirmActionModal.tsx`
- Modify: `components/AssignmentList.tsx`
- Modify: `components/LocationDetailModal.tsx`
- Modify: `components/WorkingItemsList.tsx`
- Test: `tests/no_native_alert_confirm_regression.cjs`

**Step 1: Write the failing test**

```js
// tests/no_native_alert_confirm_regression.cjs
const fs = require('fs');
const content = fs.readFileSync('components/AssignmentList.tsx', 'utf8');
if (content.includes('window.confirm') || content.includes('alert(')) {
  throw new Error('native dialogs still present');
}
```

**Step 2: Run test to verify it fails**

Run: `node tests/no_native_alert_confirm_regression.cjs`
Expected: FAIL because native dialogs are currently used.

**Step 3: Write minimal implementation**

```tsx
<ConfirmActionModal
  isOpen={confirmState.open}
  title="Confirmar vaciado"
  description={confirmState.message}
  onConfirm={confirmState.onConfirm}
  onCancel={closeConfirm}
/>
```

**Step 4: Run test to verify it passes**

Run: `node tests/no_native_alert_confirm_regression.cjs && npm run build`
Expected: PASS and destructive flows use consistent in-app modal UX.

**Step 5: Commit**

```bash
git add components/ConfirmActionModal.tsx components/AssignmentList.tsx components/LocationDetailModal.tsx components/WorkingItemsList.tsx tests/no_native_alert_confirm_regression.cjs
git commit -m "ux: replace native alerts with consistent operational confirmation modal"
```

### Task 11: Verificación final y checklist de salida

**Files:**
- Create: `docs/verification/operatividad-hardening-checklist.md`
- Modify: `docs/EXPLICACION APP.md`

**Step 1: Write the failing test**

```md
- [ ] No role can bypass backend guardrails for critical operations
- [ ] Empty shelf is admin-only and atomic
- [ ] Empty location is role-scoped and atomic
- [ ] No false success on missing items
- [ ] Active warehouse subscription only
```

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS compile; checklist still pending manually.

**Step 3: Write minimal implementation**

```md
## Verification Commands
1. npm run build
2. npm --prefix functions run build
3. node tests/*.cjs
4. firebase emulators:exec "<rules + callable smoke tests>"
```

**Step 4: Run test to verify it passes**

Run: `npm run build && npm --prefix functions run build`
Expected: PASS and checklist marked complete after manual role-based smoke tests.

**Step 5: Commit**

```bash
git add docs/verification/operatividad-hardening-checklist.md docs/EXPLICACION APP.md
git commit -m "docs: add operativity hardening verification checklist and runbook"
```

### Execution Notes

- Use `@verification-before-completion` before claiming any fix is complete.
- Enforce DRY/YAGNI: avoid duplicate permission checks in UI once backend guardrails are active.
- Prefer backend rejection + user-facing toast over silent no-op paths.
- Keep each task as one small vertical slice and verify before next commit.
