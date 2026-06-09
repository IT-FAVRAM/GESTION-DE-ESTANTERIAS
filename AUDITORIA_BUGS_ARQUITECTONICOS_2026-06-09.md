# 🔍 AUDITORÍA EXHAUSTIVA — BUGS ARQUITECTÓNICOS
**Fecha:** 2026-06-09  
**Severidad Total:** 🔴 4 CRÍTICOS + 🟠 3 ALTOS + 🟡 6 MEDIOS + 🟢 5 BAJOS  
**Total:** 18 BUGS

---

## 🔴 CRÍTICOS (Pérdida de datos / Bloquea funcionalidad)

### **BUG CRÍTICO #1: RACE CONDITION EN ROLLBACK DE OPTIMISTIC UPDATES**
- **Ubicación:** `useShelf.ts:140-175` (función ubicar)
- **Problema:** 
  ```
  1. User A ubica artículo → optimistic update guardado
  2. Snapshot llega: User B ubicó en misma estantería → locations cambia
  3. Error en API de User A → rollback a previousLocations (ANTERIOR a B)
  4. RESULTADO: Artículo de B se PIERDE silenciosamente
  ```
- **Impacto:** ⚠️ CRÍTICO — Pérdida de datos
- **Escenario real:** Dos carretilleros en SOL simultáneamente
- **Solución:** 
  - Capturar snapshot version antes de cambios
  - Rollback inteligente que merge cambios propios vs externos
  - Usar `lastModified` para validar qué es actual

---

### **BUG CRÍTICO #2: SINCRONIZACIÓN BIFURCADA — `reprocesosCell` VS `pendingCell`**
- **Ubicación:** `useOperativeShelf.ts:161-184`
- **Problema:**
  ```typescript
  // Línea 183: synchroniza reprocesosCell
  const updatedCell = updatedLocations.find(l => l.position === reprocesosCell?.position);
  if (updatedCell) setReprocesosCell(updatedCell);
  
  // PERO NO sincroniza pendingCell (línea 161)
  // Si pendingCell es el que debería sync, queda desactualizado
  ```
- **Impacto:** 
  - User ubica en celda de reprocesos → `pendingCell` capturada
  - Otro user saca artículo de esa celda
  - Modal muestra `reprocesosCell` actualizado (correcto)
  - Pero `pendingCell` sigue obsoleto → submit con datos viejos
- **Solución:** 
  - Unificar a una sola referencia: `selectedCell` en lugar de 2
  - Sincronizar AMBAS si se mantienen separadas

---

### **BUG CRÍTICO #3: INCONSISTENCIA `locationId` — FRONTEND VS BACKEND DIVERGENTES**
- **Ubicación:** 
  - Frontend: `shelfOptimisticUpdates.ts:62` → `locationId: ${shelfCode}_${position}`
  - Backend: `inventory.ts:334` → `locationId: ${shelfCode}-${position}`
  - useShelf.ts:108 → `getLocationDocId()` que puede variar
- **Problema:**
  ```
  Optimistic: locationId = "SOL_001"
  Backend persiste: "SOL-001"
  Grid renderiza: conflicto de IDs
  saveNota falla: locationId no existe en BD (buscó "SOL_001", existe "SOL-001")
  ```
- **Impacto:** 
  - Notas no guardan en ubicaciones recientes
  - Queries fallan silenciosamente
  - Duplicación de ubicaciones
- **Solución:** 
  - Crear **ÚNICA función compartida:** `generateLocationId(shelfCode, position) → string`
  - Exportar desde `lib/schema/locations.ts`
  - Usar SOLO formato `-` (más legible)

---

### **BUG CRÍTICO #4: PÉRDIDA DE DATOS EN TRANSICIÓN OFFLINE→ONLINE DURANTE BATCH**
- **Ubicación:** `useShelf.ts:154-175` + `offlineQueue.ts:238-241`
- **Problema:**
  ```
  Lote de 5 artículos:
  1. Ubicado ✓
  2. Ubicado ✓
  3. Ubicado ✓
  4. Se cae conexión → offlineQueue intenta retry
  5. Recuperación sin dedup → artículos 1-3 se duplican en Firestore
  ```
- **Root cause:** Sin dedup por operationId único
- **Impacto:** 
  - Artículos duplicados en ubicaciones
  - Inventario inconsistente
  - Data corruption silenciosa
- **Solución:**
  - Backend: Generar `presenceId = ${uid}-${timestamp}-${shelfCode}`
  - Deduplicación: `UNIQUE(presenceId)` en operación
  - Frontend: Guardar presenceId con operación offline

---

## 🟠 ALTOS (Impacta performance/UX severamente)

### **BUG ALTO #5: MEMORY LEAK EN LISTENERS DE FIRESTORE**
- **Ubicación:** `usePickupQueue.ts:72-143`
- **Problema:** 
  ```typescript
  useEffect(() => {
    let unsubscribe = null;
    const setup = async () => {
      // ...
      unsubscribe = onSnapshot(...); // Si cae aquí, nunca se guarda
    };
    setup().catch(err => {
      if (!isMounted) return; // ← Listener activo pero sin cleanup
    });
    return () => unsubscribe?.(); // ← Nunca se llama si setup falló
  }, []);
  ```
- **Impacto:** Listeners huérfanos acumulan memoria con cada navegación
- **Solución:** Usar AbortController o guardar unsubscribe antes de async

### **BUG ALTO #6: RECALCULACIÓN INEFICIENTE O(n) EN CADA RENDER**
- **Ubicación:** `useOperativeShelf.ts:179-184, 404-406, 656` (múltiples `.find()`)
- **Impacto:** Lag perceptible en shelves grandes (100+ ubicaciones)
- **Solución:** Usar `useMemo` + Map para búsquedas O(1)

### **BUG ALTO #7: OFFLINE QUEUE STATE DESINCRONIZADO**
- **Ubicación:** `offlineQueue.ts:100-111`
- **Impacto:** UI muestra "0 pendientes" pero hay operaciones sincronizándose
- **Solución:** Single source of truth con transacción atómica

---

## 🟡 MEDIOS (Inconsistencias/Code smell)

### **BUG MEDIO #8: VALIDACIÓN DE PERMISOS DIVERGENTES**
- **Frontend:** `useShelf.ts:66-81` — valida `canAccessShelf()`
- **Backend:** `inventory.ts:104-107` — solo valida section match
- **Resultado:** Comportamiento inconsistente entre roles
- **Solución:** Compartir función de validación

### **BUG MEDIO #9: PÉRDIDA DE CAMPOS EN OPTIMISTIC UPDATES**
- **Ubicación:** `shelfOptimisticUpdates.ts:44-63`
- **Problema:** newItem NO copia `nota`, `updatedAt`, etc.
- **Solución:** Preservar todos los campos del documento original

### **BUG MEDIO #10: ESTADO ACUMULATIVO EN `selectedPositions`**
- **Problema:** No limpia correctamente en transiciones acción→acción
- **Ejemplo:** RETIRAR → MOVER → aún tiene positions del RETIRAR
- **Solución:** Limpiar explícitamente en cada transición

### **BUG MEDIO #11: FALTA DE IDEMPOTENCIA EN OFFLINE OPS**
- **Problema:** Retry sin dedup puede duplicar artículos
- **Solución:** Backend dedup por presenceId

### **BUG MEDIO #12: NOMENCLATURA INCONSISTENTE**
- **Problema:** `locationId` vs `position` vs `documentId` usados indistintamente
- **Solución:** Estandarizar naming

### **BUG MEDIO #13: DRY VIOLATION — VALIDACIÓN DUPLICADA**
- **Problema:** Importe/cantidad validado en 3+ lugares
- **Solución:** Centralizar en shared validator

---

## 🟢 BAJOS (Mejoras técnicas)

### **BUG BAJO #14-18: Error handling, versionado, rate limiting, type safety**
- Implementar centralized ErrorHandler
- Agregar migration strategy para offline queue
- Implementar backoff exponencial en batch
- Usar discriminated unions en payloads
- Deduplicar cargas de datos

---

## 📊 MATRIZ PRIORIDAD

| ID | Severidad | Impacto | Esfuerzo | ACCIÓN |
|----|-----------|---------|----------|--------|
| #1 | 🔴 CRÍTICO | Pérdida datos | ALTO | **INMEDIATO** |
| #2 | 🔴 CRÍTICO | Datos viejos | ALTO | **INMEDIATO** |
| #3 | 🔴 CRÍTICO | Query falla | MEDIO | **HOY** |
| #4 | 🔴 CRÍTICO | Duplicación | ALTO | **HOY** |
| #5 | 🟠 ALTO | Memory leak | MEDIO | Esta semana |
| #6 | 🟠 ALTO | Performance | BAJO | Esta semana |
| #7 | 🟠 ALTO | UI confusa | BAJO | Esta semana |
| #8-13 | 🟡 MEDIO | Inconsistencia | BAJO | Próximo sprint |
| #14-18 | 🟢 BAJO | Deuda técnica | BAJO | Backlog |

---

**Status:** 🔴 REQUIERE ACCIÓN INMEDIATA
**Recomendación:** Abordar críticos antes de siguiente deploy

