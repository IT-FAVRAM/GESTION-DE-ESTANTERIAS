# Operational Risk Remediation Master Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar vulnerabilidades operativas criticas (falsos positivos, bypass de permisos, auditoria debil y cuellos de rendimiento) sin romper la operativa diaria de almacen.

**Architecture:** Se migran operaciones criticas de inventario a una unica callable backend con validacion de rol y reglas de negocio. Firestore Rules se endurece para denegar escrituras directas peligrosas en `assignments`, `workingItems`, `finishedItems` y `history`, dejando al cliente solo lecturas y acciones no criticas. Se cierran falsos "OK" en frontend, se mejora rendimiento de listeners y se añade verificacion integral con tests de regresion operativa.

**Tech Stack:** React 19 + TypeScript + Vite, Firebase Auth Claims, Firestore Rules v2, Firebase Cloud Functions (Node/TS), tests Node `tests/*.cjs`.

---

### Task 1: Eliminar falsos positivos en retirada de articulos

**Files:**
- Modify: `lib/inventoryTransactions.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Create: `tests/remove_not_found_must_fail.cjs`

**Step 1: Write the failing test**

```js
// tests/remove_not_found_must_fail.cjs
const fs = require('fs');
const src = fs.readFileSync('lib/inventoryTransactions.ts', 'utf8');
if (!src.includes("throw new Error('ITEM_NOT_FOUND')") && !src.includes('throw new Error("ITEM_NOT_FOUND")')) {
  throw new Error('removeItemTransaction still allows not-found as success');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/remove_not_found_must_fail.cjs`
Expected: FAIL with missing `ITEM_NOT_FOUND` throw.

**Step 3: Write minimal implementation**

```ts
// lib/inventoryTransactions.ts (inside removeItemTransaction)
if (itemIndex === -1) {
  throw new Error('ITEM_NOT_FOUND');
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/remove_not_found_must_fail.cjs`
Expected: PASS (`ok`).

**Step 5: Commit**

```bash
git add lib/inventoryTransactions.ts hooks/useInventoryOperations.ts tests/remove_not_found_must_fail.cjs
git commit -m "fix: fail explicitly when removing missing inventory items"
```

### Task 2: Evitar exito parcial en vaciado de estanteria

**Files:**
- Modify: `hooks/useInventoryOperations.ts`
- Create: `tests/empty_shelf_partial_failure_must_fail.cjs`

**Step 1: Write the failing test**

```js
// tests/empty_shelf_partial_failure_must_fail.cjs
const fs = require('fs');
const src = fs.readFileSync('hooks/useInventoryOperations.ts', 'utf8');
if (!src.includes('if (!result.success)')) {
  throw new Error('emptyShelf does not validate transaction result');
}
if (src.includes('successCount++;') && !src.includes('if (result.success)')) {
  throw new Error('emptyShelf can count failed removals as success');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/empty_shelf_partial_failure_must_fail.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
const result = await removeItemTransaction(...);
if (result.success) successCount++;
else failed.push({ locId, barcode: item.barcode, error: result.error });

if (failed.length > 0) {
  notify?.('warning', 'Vaciado parcial', `${successCount} OK, ${failed.length} con error`);
  return;
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/empty_shelf_partial_failure_must_fail.cjs`
Expected: PASS (`ok`).

**Step 5: Commit**

```bash
git add hooks/useInventoryOperations.ts tests/empty_shelf_partial_failure_must_fail.cjs
git commit -m "fix: prevent false success reporting in shelf emptying"
```

### Task 3: Crear gateway backend unico para operaciones criticas

**Files:**
- Modify: `functions/src/index.ts`
- Create: `lib/inventoryApi.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Create: `tests/inventory_operate_gateway_contract.cjs`

**Step 1: Write the failing test**

```js
// tests/inventory_operate_gateway_contract.cjs
const fs = require('fs');
const fn = fs.readFileSync('functions/src/index.ts', 'utf8');
const client = fs.existsSync('lib/inventoryApi.ts') ? fs.readFileSync('lib/inventoryApi.ts', 'utf8') : '';
if (!fn.includes('export const inventoryOperate')) throw new Error('Missing inventoryOperate callable');
if (!client.includes("httpsCallable") || !client.includes('inventoryOperate')) throw new Error('Client gateway missing');
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/inventory_operate_gateway_contract.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// functions/src/index.ts
export const inventoryOperate = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'auth required');
  const role = context.auth.token.role as string;
  const op = data?.op as string;
  // validate op + payload + role
  // run transaction
  return { ok: true, opId: data?.opId || null };
});
```

**Step 4: Run test to verify it passes**

Run: `node tests/inventory_operate_gateway_contract.cjs && npm --prefix functions run build && npm run build`
Expected: PASS and compilacion correcta.

**Step 5: Commit**

```bash
git add functions/src/index.ts lib/inventoryApi.ts hooks/useInventoryOperations.ts tests/inventory_operate_gateway_contract.cjs
git commit -m "feat: route critical inventory operations through backend callable gateway"
```

### Task 4: Bloquear escrituras directas en assignments para roles no admin

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules_assignments_no_direct_staff_writes.cjs`

**Step 1: Write the failing test**

```js
// tests/rules_assignments_no_direct_staff_writes.cjs
const fs = require('fs');
const src = fs.readFileSync('firestore.rules', 'utf8');
if (src.includes('allow write: if canWriteAssignments(warehouseId);')) {
  throw new Error('Assignments still allow direct staff writes');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/rules_assignments_no_direct_staff_writes.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```rules
match /assignments/{warehouseId}/locations/{locationId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/rules_assignments_no_direct_staff_writes.cjs && npm run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add firestore.rules tests/rules_assignments_no_direct_staff_writes.cjs
git commit -m "security: deny direct assignment writes for non-admin roles"
```

### Task 5: Endurecer writes directos en workingItems y finishedItems

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules_workflow_collections_backend_only.cjs`

**Step 1: Write the failing test**

```js
// tests/rules_workflow_collections_backend_only.cjs
const fs = require('fs');
const src = fs.readFileSync('firestore.rules', 'utf8');
if (src.includes('match /workingItems/{itemId}') && src.includes('allow write: if isStaff();')) {
  throw new Error('workingItems still writable by staff');
}
if (src.includes('match /finishedItems/{itemId}') && src.includes('allow write: if isStaff();')) {
  throw new Error('finishedItems still writable by staff');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/rules_workflow_collections_backend_only.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```rules
match /workingItems/{itemId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}
match /finishedItems/{itemId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/rules_workflow_collections_backend_only.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add firestore.rules tests/rules_workflow_collections_backend_only.cjs
git commit -m "security: restrict workflow collection writes to trusted backend path"
```

### Task 6: Fortalecer auditoria de historial (uid/role/opId/source obligatorios)

**Files:**
- Modify: `functions/src/index.ts`
- Modify: `firestore.rules`
- Create: `docs/audit/inventory_audit_contract.md`
- Create: `tests/history_audit_contract_required_fields.cjs`

**Step 1: Write the failing test**

```js
// tests/history_audit_contract_required_fields.cjs
const fs = require('fs');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const fn = fs.readFileSync('functions/src/index.ts', 'utf8');
if (!rules.includes('uid') || !rules.includes('role') || !rules.includes('opId')) {
  throw new Error('Rules do not enforce strong audit contract');
}
if (!fn.includes('uid:') || !fn.includes('role:') || !fn.includes('opId')) {
  throw new Error('Backend does not write strong audit fields');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/history_audit_contract_required_fields.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
const audit = {
  uid: context.auth.uid,
  role,
  user: context.auth.token.email || 'unknown',
  opId,
  source: 'inventoryOperate'
};
```

```rules
function validHistoryCreate() {
  return request.resource.data.keys().hasAll(['barcode','orderId','action','timestamp','uid','role','opId','source'])
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.role == getRole();
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/history_audit_contract_required_fields.cjs && npm --prefix functions run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/src/index.ts firestore.rules docs/audit/inventory_audit_contract.md tests/history_audit_contract_required_fields.cjs
git commit -m "chore: enforce strong audit contract for inventory history events"
```

### Task 7: Alinear permisos UI con backend (sin confiar en cliente)

**Files:**
- Modify: `hooks/useRoles.ts`
- Modify: `hooks/useInventoryOperations.ts`
- Create: `tests/ui_backend_permission_alignment.cjs`

**Step 1: Write the failing test**

```js
// tests/ui_backend_permission_alignment.cjs
const fs = require('fs');
const src = fs.readFileSync('hooks/useInventoryOperations.ts', 'utf8');
if (!src.includes('permission-denied') && !src.includes('OPERACION_NO_PERMITIDA')) {
  throw new Error('UI does not map backend RBAC denials explicitly');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/ui_backend_permission_alignment.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// on backend denial
notify?.('error', 'Sin permisos', 'Tu rol no puede realizar esta operacion');
return false;
```

**Step 4: Run test to verify it passes**

Run: `node tests/ui_backend_permission_alignment.cjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/useRoles.ts hooks/useInventoryOperations.ts tests/ui_backend_permission_alignment.cjs
git commit -m "fix: align UI behavior with backend authorization responses"
```

### Task 8: Optimizar pendientes de carretillero con filtro server-side

**Files:**
- Modify: `hooks/useSystemNotifications.ts`
- Create: `docs/indexes/notifications_pending_index.md`
- Create: `tests/notifications_pending_server_filter.cjs`

**Step 1: Write the failing test**

```js
// tests/notifications_pending_server_filter.cjs
const fs = require('fs');
const src = fs.readFileSync('hooks/useSystemNotifications.ts', 'utf8');
if (!src.includes(".where('status', '==', 'PENDING')")) {
  throw new Error('Pending request query still filters status on client');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/notifications_pending_server_filter.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
const qRequests = db.collection('notifications')
  .where('targetRole', '==', 'CARRETILLERO')
  .where('type', '==', 'request_material')
  .where('status', '==', 'PENDING')
  .orderBy('timestamp', 'desc')
  .limit(500);

setUnreadRequestsCount(snap.size);
```

**Step 4: Run test to verify it passes**

Run: `node tests/notifications_pending_server_filter.cjs && npm run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/useSystemNotifications.ts docs/indexes/notifications_pending_index.md tests/notifications_pending_server_filter.cjs
git commit -m "perf: count pending requests using indexed server-side filters"
```

### Task 9: Reducir carga de sincronizacion por almacen activo

**Files:**
- Modify: `hooks/useAssignments.ts`
- Modify: `App.tsx`
- Modify: `lib/store.ts`
- Create: `tests/assignments_active_warehouse_only_subscription.cjs`

**Step 1: Write the failing test**

```js
// tests/assignments_active_warehouse_only_subscription.cjs
const fs = require('fs');
const src = fs.readFileSync('hooks/useAssignments.ts', 'utf8');
if (src.includes('WAREHOUSES.forEach')) {
  throw new Error('Still subscribing to all warehouses');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/assignments_active_warehouse_only_subscription.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
export const useAssignments = (activeWarehouse?: string) => {
  const targets = activeWarehouse ? [activeWarehouse] : ['MEC'];
  // subscribe only targets
};
```

**Step 4: Run test to verify it passes**

Run: `node tests/assignments_active_warehouse_only_subscription.cjs && npm run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/useAssignments.ts App.tsx lib/store.ts tests/assignments_active_warehouse_only_subscription.cjs
git commit -m "perf: subscribe assignments by active warehouse to reduce operational load"
```

### Task 10: Limitar operaciones AI por rol y tipo de uso

**Files:**
- Modify: `functions/src/index.ts`
- Modify: `lib/gemini.ts`
- Create: `tests/ai_callable_role_guardrails.cjs`

**Step 1: Write the failing test**

```js
// tests/ai_callable_role_guardrails.cjs
const fs = require('fs');
const src = fs.readFileSync('functions/src/index.ts', 'utf8');
if (!src.includes('ALLOWED_AI_TYPES_BY_ROLE')) {
  throw new Error('AI callable does not enforce role/type allowlist');
}
console.log('ok');
```

**Step 2: Run test to verify it fails**

Run: `node tests/ai_callable_role_guardrails.cjs`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
const ALLOWED_AI_TYPES_BY_ROLE: Record<string, string[]> = {
  ADMIN: ['textFromImage', 'combinedData', 'codeFromImage', 'inventorySummary', 'historySummary', 'traceabilityReport', 'anomalyDetection', 'locationPrediction', 'metalCount'],
  JEFE: ['textFromImage', 'combinedData', 'codeFromImage', 'inventorySummary', 'historySummary', 'traceabilityReport', 'metalCount'],
  CARRETILLERO: ['textFromImage', 'combinedData', 'codeFromImage', 'metalCount']
};
```

**Step 4: Run test to verify it passes**

Run: `node tests/ai_callable_role_guardrails.cjs && npm --prefix functions run build`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/src/index.ts lib/gemini.ts tests/ai_callable_role_guardrails.cjs
git commit -m "security: enforce role-based allowlist for AI callable operations"
```

### Task 11: Verificacion integral y checklist de salida

**Files:**
- Create: `docs/verification/operational-risk-remediation-checklist.md`
- Modify: `docs/EXPLICACION APP.md`

**Step 1: Write the checklist with failing boxes**

```md
- [ ] Remove not-found cannot return success
- [ ] Empty shelf cannot report full success on partial failures
- [ ] Assignments writes blocked for non-admin direct clients
- [ ] Critical operations flow through backend gateway
- [ ] History entries include uid, role, opId, source
- [ ] Notifications pending uses server-side status filter
- [ ] Assignments subscription uses active warehouse scope
```

**Step 2: Run verification commands before marking complete**

Run: `node tests/*.cjs && npm run build && npm --prefix functions run build`
Expected: all checks PASS.

**Step 3: Mark checklist as completed and update docs**

```md
## Verification Commands
1. node tests/*.cjs
2. npm run build
3. npm --prefix functions run build
```

**Step 4: Final confirmation run**

Run: `node tests/*.cjs && npm run build && npm --prefix functions run build`
Expected: PASS with no regressions.

**Step 5: Commit**

```bash
git add docs/verification/operational-risk-remediation-checklist.md docs/EXPLICACION APP.md
git commit -m "docs: add operational risk remediation verification checklist and runbook"
```

### Execution Notes

- Priorizar `Task 1` a `Task 6` antes de cualquier optimizacion.
- No introducir bypass en cliente: si backend rechaza, UI debe mostrar error explicito.
- Mantener DRY: matriz de permisos en una sola fuente (`permissionMatrix`) para UX, backend como autoridad final.
- Antes de cerrar cada tarea, usar `@verification-before-completion`.
- Evitar cambios no esenciales (YAGNI): primero cerrar huecos operativos de alto impacto.
