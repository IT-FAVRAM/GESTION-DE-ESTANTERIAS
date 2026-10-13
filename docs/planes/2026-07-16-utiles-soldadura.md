# Plan: Estantería Útiles Soldadura (UTS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una estantería de soldadura llamada "UTILES SOLDADURA" con 12 ubicaciones que solo almacenan texto libre, sin artículos ni órdenes de fabricación.

**Architecture:** Nueva estantería en sección SOLDADURA con sistema de almacenamiento simplificado para texto libre. Las ubicaciones se nombran "UTIL SOL. 001" a "UTIL SOL. 012" empezando por abajo a la izquierda.

**Tech Stack:** React, TypeScript, Firebase Firestore

---

## File Structure

### Archivos a modificar:
- `aplicacion/lib/schema/shelves.ts` - Añadir definición UTS
- `aplicacion/lib/schema/sections.ts` - Actualizar mapeo de estanterías
- `aplicacion/components/kiosk/ShelfGridCell.tsx` - Soporte para modo texto
- `aplicacion/hooks/useOperativeShelf.ts` - Lógica simplificada para UTS
- `aplicacion/components/operative/OperativeShelfArea.tsx` - UI específica

### Archivos a crear:
- `aplicacion/components/operative/UtilesSoldaduraModal.tsx` - Modal para añadir/editar texto
- `aplicacion/hooks/useUtilesSoldadura.ts` - Hook para manejo de texto

---

## Tasks

### Task 1: Definición de Estantería UTS

**Files:**
- Modify: `aplicacion/lib/schema/shelves.ts:43-442`
- Modify: `aplicacion/lib/schema/sections.ts:32-50`

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
- Create: `aplicacion/hooks/useUtilesSoldadura.ts`

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
- Create: `aplicacion/components/operative/UtilesSoldaduraModal.tsx`

- [ ] **Step 1: Crear modal con campo de texto simple**

- [ ] **Step 2: Implementar botones AÑADIR/RETIRAR**

- [ ] **Step 3: Añadir validación y estilos**

---

### Task 4: Modificar ShelfGridCell para Texto

**Files:**
- Modify: `aplicacion/components/kiosk/ShelfGridCell.tsx:17-431`

- [ ] **Step 1: Añadir prop isTextOnly**

- [ ] **Step 2: Modificar renderizado para mostrar texto en lugar de artículos**

- [ ] **Step 3: Añadir indicador visual para ubicaciones de texto**

---

### Task 5: Integrar en UseOperativeShelf

**Files:**
- Modify: `aplicacion/hooks/useOperativeShelf.ts:1559-1654`

- [ ] **Step 1: Detectar si es estantería UTS**

- [ ] **Step 2: Modificar handleCellPress para UTS**

- [ ] **Step 3: Abrir modal de texto en lugar del flujo normal**

---

### Task 6: Actualizar OperativeShelfArea

**Files:**
- Modify: `aplicacion/components/operative/OperativeShelfArea.tsx`

- [ ] **Step 1: Importar UtilesSoldaduraModal**

- [ ] **Step 2: Añadir estado para modal de texto**

- [ ] **Step 3: Renderizar modal cuando sea necesario**

---

### Task 7: Pruebas y Verificación

**Files:**
- Create: `aplicacion/components/operative/UtilesSoldaduraModal.test.tsx`

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

### Flujo de Interacción (INVERSO al de artículos):

**DIFERENCIA CRÍTICA:** UTS NO usa el flujo normal (Analizar Artículo → Ubicación).
UTS es **solo texto libre**, sin artículos ni órdenes de fabricación.

#### Paso 1: Pulsar en Ubicación
- Usuario pulsa directamente en una ubicación (UTIL SOL. 001, etc.)
- No hay "Analizar Artículo" ni búsqueda de OF/artículo

#### Paso 2: Evaluar contenido actual
- **Si está VACÍA:** 
  - Abrir modal UtilesSoldaduraModal
  - Mostrar campo de texto vacío
  - Botón "AÑADIR" para meter texto
  - Botón "CERRAR" para cancelar
  
- **Si tiene TEXTO:**
  - Mostrar el texto actual (lectura)
  - Opción "¿Desea AÑADIR MÁS texto aquí?" → abre modal en modo edición
  - Opción "¿Desea RETIRAR este texto?" → pide confirmación y lo borra

#### Paso 3: Modal UtilesSoldaduraModal
- Campo textarea para editar/crear texto
- Botones:
  - "ACTUALIZAR" (si ya hay texto)
  - "AÑADIR" (si está vacía)
  - "RETIRAR" (si hay contenido, opcional)
  - "CERRAR" (cancelar sin guardar)

#### Características clave:
- ✅ SIN búsqueda de artículos
- ✅ SIN OF ni códigos de fabricación
- ✅ SIN selección de cantidad
- ✅ SOLO texto libre (descripciones, notas, herramientas)
- ✅ Guardado inmediato en Firestore (shelves/UTS/locations/{position})

---

## Implementación Técnica del Flujo

### En `useOperativeShelf.ts`:

```typescript
// Detectar si es UTS
const isUtsShelf = shelfCode === 'UTS';

// Override del handleCellPress para UTS
if (isUtsShelf) {
  // En lugar del flujo normal:
  // 1. NO abrir "Analizar Artículo"
  // 2. Abrir directamente UtilesSoldaduraModal
  // 3. Pasar la posición actual (p.ej., "UTIL SOL. 001")
  
  setUtilSoldaduraModalOpen(true);
  setSelectedUtilPosition(position);
  setUtilSoldaduraCurrentText(textFromFirestore[position] || '');
  return;
}

// Flujo normal para otras estanterías sigue como siempre
```

### En `OperativeShelfArea.tsx`:

```typescript
import UtilesSoldaduraModal from './UtilesSoldaduraModal';
import { useUtilesSoldadura } from '../hooks/useUtilesSoldadura';

// Dentro del componente:
const { locations, addText, removeText, updateText } = useUtilesSoldadura();
const [utilModalOpen, setUtilModalOpen] = useState(false);
const [selectedPosition, setSelectedPosition] = useState<string>('');

// Renderizar modal adicional (además del normal):
{utilModalOpen && (
  <UtilesSoldaduraModal
    open={utilModalOpen}
    position={selectedPosition}
    currentText={locations.find(l => l.position === selectedPosition)?.text}
    onClose={() => setUtilModalOpen(false)}
    onSave={(text) => updateText(selectedPosition, text)}
    onRemove={() => removeText(selectedPosition)}
  />
)}
```

### Requisitos:

1. **Detección de UTS:** Hook useOperativeShelf debe reconocer `shelfCode === 'UTS'`
2. **Bypass del flujo normal:** No mostrar "Analizar Artículo" para UTS
3. **Modal directo:** Abrir UtilesSoldaduraModal automáticamente
4. **Sin validación de artículo:** No buscar en BD de artículos/órdenes
5. **Guardado en ubicación correcta:** `shelves/UTS/locations/{position}`

## Testing Plan

1. **Test Unitario:** Verificar que UTS aparece en SHELF_DEFINITIONS
2. **Test Integración:** Probar que la estantería se carga correctamente
3. **Test Flujo:** Verificar flujo inverso:
   - Pulsar ubicación → Abre modal (sin "Analizar Artículo")
   - Meter texto → Guardar → Ver en grid
   - Pulsar ubicación con texto → Opción RETIRAR
4. **Test UI:** Verificar que el modal de texto funciona sin búsqueda de artículos
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
