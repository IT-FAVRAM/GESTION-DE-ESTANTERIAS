# Plan: Estantería Útiles Soldadura (UTS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una estantería de soldadura llamada "UTILES SOLDADURA" con 12 ubicaciones que solo almacenan texto libre, sin artículos ni órdenes de fabricación.

**Architecture:** Nueva estantería en sección SOLDADURA con sistema de almacenamiento simplificado para texto libre. Las ubicaciones se nombran "UTIL SOL. 001" a "UTIL SOL. 012" empezando por abajo a la izquierda.

**Tech Stack:** React, TypeScript, Firebase Firestore

---

## File Structure

### Archivos a modificar:
- `APP/frontend/lib/schema/shelves.ts` - Añadir definición UTS
- `APP/frontend/lib/schema/sections.ts` - Actualizar mapeo de estanterías
- `APP/frontend/components/kiosk/ShelfGridCell.tsx` - Soporte para modo texto
- `APP/frontend/hooks/useOperativeShelf.ts` - Lógica simplificada para UTS
- `APP/frontend/components/operative/OperativeShelfArea.tsx` - UI específica

### Archivos a crear:
- `APP/frontend/components/operative/UtilesSoldaduraModal.tsx` - Modal para añadir/editar texto
- `APP/frontend/hooks/useUtilesSoldadura.ts` - Hook para manejo de texto

---

## Tasks

### Task 1: Definición de Estantería UTS

**Files:**
- Modify: `APP/frontend/lib/schema/shelves.ts:43-442`
- Modify: `APP/frontend/lib/schema/sections.ts:32-50`

- [ ] **Step 1: Añadir UTS a SHELF_DEFINITIONS**

```typescript
{
  code: 'UTS',
  name: 'Útiles Soldadura',
  section: 'SOLDADURA',
  type: 'shelf',
  locationCount: 12,
  layout: {
    zones: [{ name: 'UTILIDADES', range: [1, 12], color: '#8b5cf6' }],
    physicalBlocks: [
      {
        id: 'uts-main',
        title: 'Útiles Soldadura',
        subtitle: '2 columnas x 6 filas · UTIL SOL. 001-012',
        zoneName: 'UTILIDADES',
        fullWidth: true,
        rows: [
          ['UTIL SOL. 011', 'UTIL SOL. 012'],
          ['UTIL SOL. 009', 'UTIL SOL. 010'],
          ['UTIL SOL. 007', 'UTIL SOL. 008'],
          ['UTIL SOL. 005', 'UTIL SOL. 006'],
          ['UTIL SOL. 003', 'UTIL SOL. 004'],
          ['UTIL SOL. 001', 'UTIL SOL. 002'],
        ],
      },
    ],
  },
},
```

- [ ] **Step 2: Actualizar SHELF_TO_SECTION**

```typescript
UTS: 'SOLDADURA',
```

- [ ] **Step 3: Verificar que UTS aparece en la sección SOLDADURA**

---

### Task 2: Hook para Manejo de Texto

**Files:**
- Create: `APP/frontend/hooks/useUtilesSoldadura.ts`

- [ ] **Step 1: Crear interfaz para ubicaciones de texto**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TextLocation {
  position: string;
  text: string;
  lastModified?: Date;
}

export interface UseUtilesSoldaduraReturn {
  locations: TextLocation[];
  loading: boolean;
  error: string | null;
  addText: (position: string, text: string) => Promise<boolean>;
  removeText: (position: string) => Promise<boolean>;
  updateText: (position: string, text: string) => Promise<boolean>;
}
```

- [ ] **Step 2: Implementar suscripción a Firestore**

- [ ] **Step 3: Implementar funciones CRUD para texto**

---

### Task 3: Componente Modal para Texto

**Files:**
- Create: `APP/frontend/components/operative/UtilesSoldaduraModal.tsx`

- [ ] **Step 1: Crear modal con campo de texto simple**

- [ ] **Step 2: Implementar botones AÑADIR/RETIRAR**

- [ ] **Step 3: Añadir validación y estilos**

---

### Task 4: Modificar ShelfGridCell para Texto

**Files:**
- Modify: `APP/frontend/components/kiosk/ShelfGridCell.tsx:17-431`

- [ ] **Step 1: Añadir prop isTextOnly**

- [ ] **Step 2: Modificar renderizado para mostrar texto en lugar de artículos**

- [ ] **Step 3: Añadir indicador visual para ubicaciones de texto**

---

### Task 5: Integrar en UseOperativeShelf

**Files:**
- Modify: `APP/frontend/hooks/useOperativeShelf.ts:1559-1654`

- [ ] **Step 1: Detectar si es estantería UTS**

- [ ] **Step 2: Modificar handleCellPress para UTS**

- [ ] **Step 3: Abrir modal de texto en lugar del flujo normal**

---

### Task 6: Actualizar OperativeShelfArea

**Files:**
- Modify: `APP/frontend/components/operative/OperativeShelfArea.tsx`

- [ ] **Step 1: Importar UtilesSoldaduraModal**

- [ ] **Step 2: Añadir estado para modal de texto**

- [ ] **Step 3: Renderizar modal cuando sea necesario**

---

### Task 7: Pruebas y Verificación

**Files:**
- Create: `APP/frontend/components/operative/UtilesSoldaduraModal.test.tsx`

- [ ] **Step 1: Crear tests para el modal de texto**

- [ ] **Step 2: Probar flujo completo de añadir/retirar texto**

- [ ] **Step 3: Verificar que UTS aparece en la UI**

---

## Data Model

### Firestore Structure para UTS:

```
shelves/
  └─ UTS (doc)
     ├─ code: 'UTS'
     ├─ name: 'Útiles Soldadura'
     ├─ section: 'SOLDADURA'
     └─ sub: locations/
        ├─ UTIL SOL. 001 (doc)
        │  ├─ position: 'UTIL SOL. 001'
        │  ├─ text: 'Martillo de soldar'
        │  └─ lastModified: timestamp
        ├─ UTIL SOL. 002 (doc)
        │  ├─ position: 'UTIL SOL. 002'
        │  └─ text: ''
        └─ ...
```

---

## UI/UX Specifications

### Grid Layout:
- 2 columnas verticales
- 6 filas (de abajo hacia arriba)
- Total: 12 ubicaciones
- Empezando por abajo a la izquierda

### Nombre de Posiciones (empezando por abajo a la izquierda):
**Fila 1 (abajo):**
- UTIL SOL. 001 (izquierda)
- UTIL SOL. 002 (derecha)

**Fila 2:**
- UTIL SOL. 003 (izquierda)
- UTIL SOL. 004 (derecha)

**Fila 3:**
- UTIL SOL. 005 (izquierda)
- UTIL SOL. 006 (derecha)

**Fila 4:**
- UTIL SOL. 007 (izquierda)
- UTIL SOL. 008 (derecha)

**Fila 5:**
- UTIL SOL. 009 (izquierda)
- UTIL SOL. 010 (derecha)

**Fila 6 (arriba):**
- UTIL SOL. 011 (izquierda)
- UTIL SOL. 012 (derecha)

### Interacción:
1. Pulsar en ubicación
2. Si está vacía: mostrar opción "AÑADIR"
3. Si tiene texto: mostrar texto + opción "RETIRAR"
4. Modal simple con campo de texto y botones

---

## Testing Plan

1. **Test Unitario:** Verificar que UTS aparece en SHELF_DEFINITIONS
2. **Test Integración:** Probar que la estantería se carga correctamente
3. **Test UI:** Verificar que el modal de texto funciona
4. **Test Funcional:** Probar flujo completo de añadir/retirar texto
5. **Test Visual:** Verificar que el layout es correcto (2x6)

---

## Rollback Plan

Si hay problemas:
1. Eliminar UTS de SHELF_DEFINITIONS
2. Eliminar UTS de SHELF_TO_SECTION
3. Los datos en Firestore se mantendrán pero no serán visibles
4. No hay dependencias críticas que romper

---

## Notes

- **No se necesita OF ni ARTÍCULO:** Esta estantería solo maneja texto libre
- **Formato consistente:** Usa el mismo patrón de layouts que las demás estanterías
- **Sección existente:** UTS va en SOLDADURA, no crea una nueva sección
- **Backward compatible:** No afecta a otras estanterías
- **Simple:** Solo funcionalidad básica de añadir/retirar texto
