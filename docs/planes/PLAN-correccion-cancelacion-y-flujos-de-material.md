# PLAN DEFINITIVO: Corrección cancelación y flujos de material (TODOS LOS ROLES)

## Auditoría completa — Estado por rol

| Rol | Vista principal | Material ops | Estado |
|-----|----------------|--------------|--------|
| **OPERARIO** | `KioskView` | ubicar/retirar/mover | ✅ LIMPIO |
| **JEFE_SECCION** | `ManagerInfoView` → `KioskView` (Modo Operativo) | ubicar/retirar/mover (via KioskView) | ✅ LIMPIO |
| **ADMIN / SUPERADMIN** | `AdminHomeView` → `AdminShelfBrowser` (Operar) | ubicar/retirar/mover/reubicar | ✅ LIMPIO |
| **CARRETILLERO** | `CarretilleroView` → `ShelfNavigator` | ubicar/retirar/mover/almacen | ⚠️ 2 bugs + 2 incidencias menores |
| **CALIDAD** | `CalidadView` | ubicar/retirar/mover/reprocesos | ⚠️ 1 HIGH + 2 MEDIUM + 1 LOW |

---

## BUGS A CORREGIR

### 🔴 B1 — HIGH: CalidadView — Ghost article check NO EXISTE
**Archivo:** `aplicacion/components/app/CalidadView.tsx` — líneas 194-264  
**Problema:** En `handleScan()`, cuando `action === 'ubicar'`, NO se llama a `findArticleGlobal()` para advertir que el artículo ya existe en otra ubicación. Las otras 3 vistas (KioskView, ShelfNavigator, AdminShelfBrowser) SÍ lo hacen.  
**Impacto:** El usuario de Calidad puede re-ubicar artículos duplicados sin advertencia. **Corrupción de datos.**  
**Solución:** Añadir ghost check con `findArticleGlobal` en el flujo `ubicar` dentro de `handleScan()`, siguiendo el patrón exacto de `ShelfNavigator.tsx:252-279`:
  1. Importar `findArticleGlobal` de `../../lib/findArticleGlobal`
  2. Después de `setScanData(...)` y `setScannerActive(false)`, añadir:
  ```ts
  if (action === 'ubicar') {
    setProcessing(true);
    const globalLocs = await findArticleGlobal(articleCode, orderFab);
    setProcessing(false);
    if (globalLocs.length > 0) {
      // Mostrar modal con warning y botón Cancelar que limpia scanData + reactiva scanner
    }
  }
  ```
  3. El "Cancelar" debe hacer: `setScanData(null); setScannerActive(true); cerrar modal`

---

### 🟠 B2 — MEDIUM: CalidadView — Camera QR onClose no reactiva escáner
**Archivo:** `aplicacion/components/app/CalidadView.tsx` — línea 838  
**Problema:** `onClose={() => setShowCameraScanner(false)}` — falta `setScannerActive(true)`  
**Solución:** Cambiar a `onClose={() => { setShowCameraScanner(false); setScannerActive(true); }}`

---

### 🟠 B3 — MEDIUM: CalidadView — Camera OCR onClose no reactiva escáner
**Archivo:** `aplicacion/components/app/CalidadView.tsx` — línea 861  
**Problema:** `onClose={() => setShowOCRScanner(false)}` — falta `setScannerActive(true)`  
**Solución:** Cambiar a `onClose={() => { setShowOCRScanner(false); setScannerActive(true); }}`

---

### 🟠 B4 — MEDIUM: ShelfNavigator — Cambio de pestaña no resetea completamente
**Archivo:** `aplicacion/components/carretillero/ShelfNavigator.tsx` — línea 523  
**Problema:** Al cambiar de estantería vía tabs, solo se resetean `action`, `scanData` y `highlightedSearch`. El sidebar SÍ llama a `resetOperative()`.  
**Solución:** Cambiar a:
```ts
onSelectShelf={(shelfCode) => { setSelectedShelf(shelfCode); resetOperative(); setHighlightedSearch([]); }}
```
Nota: `resetOperative()` ya incluye `setAction('idle'); setScanData(null);` más todo lo demás.

---

### 🟡 B5 — LOW: ShelfNavigator — Cancel en status bar es parcial
**Archivo:** `aplicacion/components/carretillero/ShelfNavigator.tsx` — línea 538  
**Problema:** `onCancel` inline solo resetea 4 estados en lugar de llamar a `resetOperative()`  
**Solución:** Cambiar `onCancel={...}` inline por `onCancel={resetOperative}`

---

### 🟡 B6 — LOW: ShelfNavigator — Estado stale en modal "Añadir estantería"
**Archivo:** `aplicacion/components/carretillero/ShelfNavigator.tsx` — línea 575  
**Problema:** Cerrar modal "Añadir posiciones" vía backdrop no limpia `addShelfCode`/`addShelfPositionText`  
**Solución:** Al hacer dismiss del backdrop, también limpiar los inputs del formulario de estantería adicional.

---

### 🟡 B7 — LOW: ShelfNavigator + CalidadView — finishAction sin cleanup de setTimeout
**Archivo:** `ShelfNavigator.tsx` línea 132-135, `CalidadView.tsx` línea 109-112  
**Problema:** `setTimeout(() => resetOperative/resetAction(), 2800)` sin guardar referencia ni limpiar en unmount. Llamadas rápidas acumulan timeouts.  
**Solución:** Guardar el timer en una ref y limpiar al inicio:
```ts
if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
finishTimerRef.current = setTimeout(() => reset...(), 2800);
```
(KioskView no tiene este problema — resetea inmediatamente)

---

## Archivos a modificar (mínima intervención)

| Archivo | Líneas | Bugs |
|---------|--------|------|
| `aplicacion/components/app/CalidadView.tsx` | ~194-264, 838, 861, 109-112 | B1, B2, B3, B7 |
| `aplicacion/components/carretillero/ShelfNavigator.tsx` | 523, 538, 575, 132-135 | B4, B5, B6, B7 |

## Archivos verificados — SIN CAMBIOS

| Archivo | Rol | Verificación |
|---------|-----|-------------|
| `aplicacion/components/kiosk/KioskView.tsx` | Operario / Jefe Sección | ✅ Completamente correcto |
| `aplicacion/components/admin/AdminShelfBrowser.tsx` | Admin / SuperAdmin | ✅ Completamente correcto |
| `aplicacion/components/app/ManagerInfoView.tsx` | Jefe Sección | ✅ No tiene material ops |
| `aplicacion/components/app/AdminHomeView.tsx` | Admin / SuperAdmin | ✅ No tiene material ops |

## Verificación post-cambio
```bash
cd aplicacion
npx tsc --noEmit          # type-check
npm run build             # build
npm test                  # tests
```
