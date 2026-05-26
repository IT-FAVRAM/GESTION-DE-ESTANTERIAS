# Arquitectura de Código — Plan de Refactorización

**Estado:** En progreso — Fase 1 completada  
**Último actualizado:** 2026-05-13

---

## ✅ Fase 1: Eliminar código muerto y migrar lógica de servidor (COMPLETADO)

### C-01: ✅ Migrar `production.ts` → Cloud Function `productionOperate`
- **Cambios:**
  - Creada CF `app/functions/src/production.ts` con ops: `withdrawToWorking`, `finishWorking`, `locateWorking`
  - Creado cliente wrapper `app/web/lib/productionApi.ts`
  - Actualizado `useWorkingItems.ts` para usar `productionApi`
  - Actualizado `useInventoryOperations.ts` para usar `productionApi.withdrawToWorking`
  - Marcado `app/web/lib/production.ts` como `@deprecated`
  
- **Resultado:**
  - ✅ Lógica transaccional multi-colección ahora en servidor (segura, auditada)
  - ✅ Elimina compat SDK de estos caminos críticos
  - ✅ Respeta Firestore security rules

### C-02: ✅ Eliminar `offlineOperations.ts`
- **Cambios:**
  - Eliminado archivo de 350 líneas sin importaciones
  - Verificado que `offlineQueue.ts` ya usa `inventoryApi` correctamente
  
- **Resultado:**
  - ✅ Menos código muerto
  - ✅ Una sola ruta de escritura (Cloud Functions)

---

## ⏳ Fase 2: Dividir `useAppLogic.ts` (god hook de 725 líneas)

### Estrategia: Extraer workflows a hooks independientes

La estructura actual mezcla 8 flujos de trabajo en un solo hook. Dividir así:

```
hooks/workflows/
  useAssignWorkflow.ts        (~140 líneas)
    - handleInitiateAdd
    - handleSelectManualAdd, handleSelectPhotoAdd
    - handlePackageTypeSelect
    - handleDirectAssign
    - checkLocationAndAssign

  useMoveWorkflow.ts          (~120 líneas)
    - handleInitiateMove
    - handlePasteMovedItem
    - handleMoveItemModalConfirm
    - handleDragMove

  useRemoveWorkflow.ts        (~100 líneas)
    - handleInitiateRemoveWorkflow
    - handleInitiateDelete
    - handleConfirmRemove
    - handleDirectRemove

  useRequestWorkflow.ts       (~90 líneas)
    - handleInitiateRequest
    - handleConfirmRequest
    - handleInitiateRequestWorkflow

  useFinishWorkflow.ts        (~80 líneas)
    - handleInitiateFinishWorkflow
    - handleConfirmProcessFinish
    - handleFinishProduction

  useBatchWorkflow.ts         (~100 líneas)
    - handleConfirmBatchRequest
    - handleInitiateMultiOccupancy
    - handleMultiLocationSelectionConfirm

  useRelocationWorkflow.ts    (~60 líneas)
    - handleInitiateRelocate
    - handleRelocate

useAppLogicComposed.ts        (~150 líneas - nuevo orquestador)
  - Importa todos los workflows
  - Coordina la lógica transversal (resetScanWorkflow, etc.)
```

### Ventajas:
- Cada archivo < 150 líneas (legible)
- Cambios a un workflow sin conflictos con otros
- Testeable: cada workflow es independiente
- Nuevo dev puede entender 1 flujo sin leer 725 líneas

---

## ⏳ Fase 3: Reorganizar `lib/` (actualmente cajón de sastre)

### Estructura actual ❌
```
lib/
├── firebaseV3.ts              # Firebase init
├── inventoryApi.ts            # Cloud Function wrapper
├── adminApi.ts                # Cloud Function wrapper
├── operarioApi.ts             # Cloud Function wrapper
├── cartApi.ts                 # Cloud Function wrapper
├── productionApi.ts           # Cloud Function wrapper
├── pickupQueueApi.ts          # Cloud Function wrapper
├── reprocesosApi.ts           # Cloud Function wrapper
├── production.ts              # @deprecated - lógica de servidor
├── offlineOperations.ts       # @deleted
├── offlineQueue.ts            # Offline replay logic
├── offlineManager.ts          # Offline state
├── shelfOptimisticUpdates.ts  # Optimistic updates
├── warehouseData.ts           # tipos + funciones
├── warehouseLayout.ts         # Utilities
├── schema/                    # ✅ Bien organizado
│   ├── shelves.ts
│   ├── appConfig.ts
│   ├── users.ts
│   ├── devices.ts
│   └── ...
└── [20+ más archivos sin orden]
```

### Estructura propuesta ✅
```
lib/
├── api/                       # Cloud Function wrappers
│   ├── inventoryApi.ts       # shelfOperate, inventoryOperate
│   ├── adminApi.ts
│   ├── operarioApi.ts
│   ├── cartApi.ts
│   ├── productionApi.ts
│   ├── pickupQueueApi.ts
│   ├── reprocesosApi.ts
│   └── index.ts             # Re-exports
│
├── firebase/                  # Firebase initialization
│   ├── index.ts             # firebaseV3 renamed
│   └── config.ts            # Config constants
│
├── schema/                    # ✅ Already good
│   ├── types/               # Type definitions only
│   │   ├── warehouse.ts
│   │   ├── user.ts
│   │   └── ...
│   └── ... (rest as is)
│
├── domain/                    # Pure TS business logic (NO React, NO Firebase client)
│   ├── inventory/            # NEW
│   │   ├── rules.ts         # Validation rules
│   │   ├── operations.ts    # Domain operations
│   │   └── index.ts
│   ├── auth/               # ✅ Already exists
│   ├── shelves/            # ✅ Already exists
│   └── reprocesos/         # ✅ Already exists
│
├── offline/                   # Offline queueing & sync
│   ├── offlineQueue.ts
│   ├── offlineManager.ts
│   └── index.ts
│
├── utils/                     # Utilities (no Firebase, no React)
│   ├── warehouseHelpers.ts  # formatLocation, etc.
│   ├── csv.ts
│   ├── excelExport.ts
│   ├── metrics.ts
│   └── index.ts
│
├── optimistic/                # Optimistic update helpers
│   ├── shelfOptimisticUpdates.ts
│   └── index.ts
│
└── [Legacy - to be eliminated]
    └── production.ts (@deprecated)
```

### Migraciones necesarias:
1. Mover `warehouseData.ts` types → `schema/types/warehouse.ts`
2. Mover `warehouseData.ts` funciones → `utils/warehouseHelpers.ts`
3. Mover API wrappers → `api/`
4. Crear `domain/inventory/` con lógica pura
5. Actualizar todos los imports

---

## ⏳ Fase 4: Limpiar `legacy/` (3000+ líneas de código v1)

### Decisión requerida:
- ¿Aún se renderiza `AppLegacy.tsx` en algún path de producción?
- Si NO → Eliminar toda la carpeta `legacy/`
- Si SÍ → Migración completa a V3 es bloqueador

### Archivos en legacy/:
```
legacy/
├── README.md
├── AppLegacy.tsx              (456 líneas)
├── firebaseCompat.ts          (SDK compat v8)
└── components/
    ├── AdminPanel.tsx         (794 líneas)
    ├── AppModals.tsx          (543 líneas)
    ├── AssignmentList.tsx     (1335 líneas) ← LARGEST
    ├── ChaperoCountView.tsx   (529 líneas)
    ├── PhotoAnalyzerModal.tsx (407 líneas)
    ├── ShelfDetailModal.tsx   (252 líneas)
    ├── WarehouseHeader.tsx    (369 líneas)
    ├── WarehouseMap.tsx       (298 líneas)
    └── WorkingItemsList.tsx   (372 líneas)
```

---

## Estimaciones de esfuerzo

| Tarea | Estimado | Impacto | Prioridad |
|-------|----------|---------|-----------|
| Fase 1: ✅ DONE | 2 horas | CRÍTICO | ✅ |
| Fase 2: Dividir `useAppLogic` | 4-6 horas | CRÍTICO | 🔴 Después de tests |
| Fase 3: Reorganizar `lib/` | 3-4 horas | MODERADO | 🟡 Antes de nuevas features |
| Fase 4: Eliminar `legacy/` | 1-2 horas | MODERADO | 🟡 Cuando V3 100% |
| **Total** | **10-14 horas** | | |

---

## Próximos pasos inmediatos

1. **Tests:** Ejecutar suite de tests completa para verificar que Fase 1 no rompió nada
2. **Fase 2 - Kick-off:** Crear primer hook `useAssignWorkflow.ts` como prototipo
3. **Documentar cambios:** Actualizar memoria del proyecto

---

## Referencias

- **Auditoría anterior:** `Architecture_Audit_2026-05-13.md`
- **Git commits:** `b5341e4` (consolidate-location-validation branch)
