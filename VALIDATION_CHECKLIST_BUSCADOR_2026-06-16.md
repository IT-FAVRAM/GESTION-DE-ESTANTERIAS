# ✅ Checklist de Validación: Buscador Global + Fallback Última Ubicación
**Fecha:** 2026-06-16  
**Rama:** `feature/consolidate-location-validation`  
**Estado:** Listo para testing pre-deploy

---

## 📋 Cambios Implementados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `frontend/hooks/useGlobalSearch.ts` | 1-24, 56-181 | Tipo `GlobalSearchResult` con campos ghost + query history fallback |
| `frontend/hooks/useGlobalSearchWithCache.ts` | 1-20, 39-109 | Idéntico + función `groupAndFilter` mejorada para ordenamiento ghost |
| `frontend/components/kiosk/KioskSearchBar.tsx` | 180-310 | Renderizado condicional ghost results (dashed border, ⏰ badge) |
| `firestore.indexes.json` | 69-76 | Nuevo índice compuesto: `(articleCode ASC, timestamp DESC)` |

---

## ✅ Verificación Pre-Deploy

### 1️⃣ TypeScript Compilation
```bash
cd APP/frontend && npm run typecheck
```
**Resultado esperado:** Sin errores  
**Status:** ✅ PASS (ejecutado 2026-06-16)

---

### 2️⃣ Testing Manual en DEV

#### **Prerequisito: Crear datos de prueba**
1. Ubicar un artículo (ej. "PERNO-001") en estantería PRE, posición 5
2. Esperar a que aparezca en `items` collection con `active=true`
3. Retirar el artículo completamente
4. Verificar que genera entrada en `history` con `action=RETIRAR`

#### **Test Caso 1: Artículo Activo (No Ghost)**
**Escenario:** Artículo está ubicado activamente  
**Pasos:**
1. Buscar "PERNO-001" en KioskSearchBar
2. Debe aparecer en dropdown (NO dashed border)
3. Click → selecciona, muestra ubicación actual: "PRE, posición 5"
4. Si `canNavigateToShelf=true` → botón navega a estantería

**Resultado esperado:**
- ✅ Dropdown normal (bg-white, border-slate-200)
- ✅ Click navega o destaca en grid
- ✅ Sin badge "⏰ Sin ubicación"

---

#### **Test Caso 2: Artículo Retirado (Ghost Result)**
**Escenario:** Artículo NO en `items`, SÍ en `history`  
**Pasos:**
1. Buscar "PERNO-001" (que fue retirado)
2. Dropdown debe mostrar ghost result
3. Observar estilo: dashed border, bg-slate-50, badge "⏰ Sin ubicación"
4. Mostrar: "Última ubicación: PRE, pos. 5 · [fecha/hora]"
5. Mostrar: "Última retirada: PRE, pos. 5 · [fecha/hora]"
6. Click → selecciona ficha ghost
7. Botón "Solicitar traer" disponible

**Resultado esperado:**
- ✅ Resultado con borde punteado (border-dashed)
- ✅ Icono ⏰ en badge
- ✅ Texto "Sin ubicación"
- ✅ Muestra última ubicación y retirada con fechas
- ✅ "Solicitar traer" clickeable
- ✅ Click no intenta navegar

---

#### **Test Caso 3: Jefe de Sección (JEFE_SECCION)**
**Escenario:** Usuario con `shelfScope='section'`  
**Pasos:**
1. Login como JEFE_SECCION
2. Buscar un artículo en otra sección
3. Observar que:
   - Buscador funciona (no hay restricción)
   - Resultado fuera de sección muestra "Solicitar traer"
   - `canNavigateToShelf=false` (no navega, solo selecciona)

**Resultado esperado:**
- ✅ Búsqueda funciona sin restricciones
- ✅ "Solicitar traer" disponible para out-of-section
- ✅ Acceso universal al buscador confirmado

---

#### **Test Caso 4: Artículo Sin Resultados**
**Escenario:** Artículo no existe en `items` ni en `history`  
**Pasos:**
1. Buscar "NOEXISTE-999"
2. Dropdown debe mostrar: "Sin resultados para..."

**Resultado esperado:**
- ✅ Mensaje vacío normal
- ✅ Sin errores en consola

---

#### **Test Caso 5: Offline + Caché (si aplica)**
**Escenario:** Desactivar WiFi mientras se busca  
**Pasos:**
1. Buscar artículo activo mientras online
2. Caché en localStorage actualizado
3. Desactivar WiFi
4. Buscar mismo artículo
5. Resultado desde caché (badge "📦 Búsqueda en caché (0.5h)")
6. Nota: Ghost results requieren online (history query)

**Resultado esperado:**
- ✅ Caché funciona igual que antes
- ✅ Badge indica age de caché
- ✅ Sin cambios en comportamiento offline

---

### 3️⃣ Validación de Índices Firestore

**Antes de deploy:**
```bash
firebase deploy --only firestore:indexes
```

**Después de deploy:**
1. Ir a [Firebase Console > Firestore > Índices](https://console.firebase.google.com/u/0/project/gestor-estanterias-wms/firestore/indexes)
2. Buscar índice con campos: `articleCode (ASC), timestamp (DESC)`
3. Status debe ser "✅ Enabled" (tras 2-5 min)

**Si hay error "index not found":**
- Firestore aún no creó el índice
- Esperar 5 minutos
- Reintentar búsqueda ghost

---

## 📊 Cobertura de Testing

| Caso | Status | Evidencia | Blocker |
|------|--------|-----------|---------|
| Artículo activo (no ghost) | ⏳ Pendiente | Manual test | No |
| Artículo retirado (ghost) | ⏳ Pendiente | Manual test | No |
| JEFE_SECCION acceso universal | ⏳ Pendiente | Manual test | No |
| Sin resultados | ⏳ Pendiente | Manual test | No |
| Offline + caché | ⏳ Pendiente | Manual test | No |
| Índice Firestore activado | ⏳ Pendiente | Console check | **SÍ** |
| TypeScript compile | ✅ PASS | `npm run typecheck` | No |

---

## 🔍 Debugging: Si Algo Falla

### Ghost Result no aparece
**Checklist:**
- [ ] `history` colección tiene entradas (usar Firestore Console)
- [ ] Entrada tiene `articleCode`, `toLocation` o `fromLocation`
- [ ] `timestamp` es válido (formato ISO 8601 string)
- [ ] Consola: buscar error `[useGlobalSearch] History fallback failed`
- [ ] Índice Firestore está en status "Enabled"

### Ghost Result no muestra fecha/hora
- [ ] Verificar `lastLocation.timestamp` es number (milisegundos)
- [ ] Formato: `new Date(timestamp).toLocaleDateString('es-ES')`

### "Solicitar traer" no funciona
- [ ] Verificar `canSolicitarTraer = config.role !== 'CARRETILLERO'` (línea 103 OperativeShelfArea)
- [ ] Ghost results sí deben pasar a `onSolicitarTraer` handler

### Buscador lento / timeouts
- [ ] Índice Firestore aún no creado (esperar 5 min post-deploy)
- [ ] `limit(20)` en history query debería ser suficiente
- [ ] Verificar metrics en Firebase Performance

---

## 🚀 Deploy Checklist

- [ ] Git status limpio (no hay cambios sin commit)
- [ ] TypeScript: `npm run typecheck` → sin errores
- [ ] Cambios en 4 archivos:
  - [ ] `useGlobalSearch.ts`
  - [ ] `useGlobalSearchWithCache.ts`
  - [ ] `KioskSearchBar.tsx`
  - [ ] `firestore.indexes.json`
- [ ] Hacer commit con mensaje:
  ```
  feat: Buscador global + fallback última ubicación desde history
  
  - Ghost results (⏰) para artículos retirados
  - Query history con timestamp DESC + índice compuesto
  - Todos los roles acceden universalmente al buscador
  - Renderizado condicional: dashed border, "Sin ubicación" badge
  
  Fixes: JEFE_SECCION acceso universal garantizado
  ```
- [ ] Push a `feature/consolidate-location-validation`
- [ ] Ejecutar: `firebase deploy` (despliega indexes + functions si hay cambios)
- [ ] Esperar ~2-5 min a que Firestore cree el índice
- [ ] Iniciar testing manual en aplicación en vivo

---

## 📝 Post-Deploy Validation

**Día 1 (después del deploy):**
- [ ] Verificar índice activo en [Firebase Console](https://console.firebase.google.com)
- [ ] Buscar un artículo retirado → ghost result aparece
- [ ] "Solicitar traer" en ghost result → abre modal
- [ ] JEFE_SECCION busca artículo out-of-section → ve resultado + "Solicitar traer"
- [ ] Performance: Ghost results no causan lag perceptible

**Monitoreo continuo:**
- Revisar Firebase Performance > Top Queries (buscar history queries)
- Revisar error logs para `[useGlobalSearch] History fallback failed`

---

## 🔗 Referencias

- **Documentación:** [memory/feature_buscador_fallback_ubicacion_2026-06-16.md](../memory/feature_buscador_fallback_ubicacion_2026-06-16.md)
- **Firestore Rules:** Línea 160-163 (permiso lectura history ya existe)
- **HistoryEntryDoc Schema:** `frontend/lib/schema/documents.ts` línea 38-48

---

**Creado por:** Claude Code  
**Última actualización:** 2026-06-16 15:48 UTC
