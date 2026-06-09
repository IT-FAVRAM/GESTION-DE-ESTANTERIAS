# 🔴 AUDITORÍA OPERACIONAL — BUGS DE USO DIARIO
**Fecha:** 2026-06-09  
**Tipo:** Escenarios reales de fallo en producción  
**Total:** 20 BUGS (4 CRÍTICOS + 5 ALTOS + 6 MEDIOS + 5 BAJOS)

---

## 🔴 BUGS CRÍTICOS (Pérdida de datos / Bloqueo)

### **CRÍTICO #1: Race Condition en Ubicar — API Response Timing**
- **Ubicación:** `useShelf.ts:134-177`
- **Escenario:** Usuario ubica artículo → optimistic update aplicado ANTES de validar respuesta API
- **Problema:**
  ```
  1. setLocations(applyUbicar(...)) ← optimistic, inmediato
  2. inventoryApi.ubicar(...) ← API async
  3. Si API timeout/corte → ubicarResult?.ok falla
  4. Rollback ocurre pero UI ya mostró datos
  5. Si usuario reload antes del rollback → datos fantasma persisten
  ```
- **Impacto:** ⚠️ CRÍTICO — Artículos fantasma en BD; se pierden al reload
- **Test:** Ubicar → cortocircuito red → grid muestra ubicación → reload → desaparece
- **Solución:** Validar API response ANTES de optimistic update

---

### **CRÍTICO #2: Duplicación en URG MEC-PRE Sin Deduplicación de Escrituras**
- **Ubicación:** `inventory.ts:335-380`
- **Problema:**
  ```
  - ubicarMulti reintentada 2x en transacción incompleta
  - presenceId puede duplicarse en ubicaciones gemelas (PRE + MEC)
  - mirrorAppend() NO valida si presenceId ya existe
  - Backend NO deduplica por presenceId en escritura
  ```
- **Impacto:** ⚠️ CRÍTICO — Artículo aparece 2x en PRE y MEC
- **Test:** Ubicar URG MEC-PRE 001 → reintento backend → item 2 veces en grid
- **Solución:** Validar presenceId antes de mirror append

---

### **CRÍTICO #3: Estado Inconsistente si Falla Uno en Lote**
- **Ubicación:** `useOperativeShelf.ts:1021-1053`
- **Problema:**
  ```
  - Ubica lote 5 artículos
  - Artículo #3 falla (offline)
  - Artículos #4-5 quedan pendientes
  - Si user reload → localStorage persiste TODO lote
  - Reintenta → #1-2 YA están en BD → duplicación garantizada
  ```
- **Impacto:** ⚠️ CRÍTICO — Duplicación en reintentos de lotes
- **Test:** Ubicar 5 → #3 falla → reintenta → duplicados
- **Solución:** Marcar presenceId en localStorage para skip en retry

---

### **CRÍTICO #4: Retirada Incompleta si Usuario Deselecciona Accidentalmente**
- **Ubicación:** `RetirarCellModal.tsx:30-56`
- **Problema:**
  ```
  - Modal abre con item auto-seleccionado
  - User click accidental en checkbox → deselecciona
  - User toca CONFIRMAR con selectedKeys vacío
  - onConfirm([]) → no se ejecuta
  - Modal cierra → NADA se retira
  - User no ve feedback
  ```
- **Impacto:** ⚠️ CRÍTICO — Retirada silenciosa fallida
- **Test:** Retirar → modal → click accidental → deselecciona → confirmar → nada pasa
- **Solución:** Validar que selectedKeys NO esté vacío antes de confirmar

---

## 🟠 BUGS ALTOS (UX rota / Operación falla)

### **ALTO #1: Cambio de Estantería Durante Lote Causa Pérdida de Contexto**
- **Ubicación:** `useOperativeShelf.ts:256-259`
- **Problema:** User ubica 5 en PRE, 2 ubicados → cambia a MEC → lote recovery modal confunde
- **Solución:** Auto-cancelar lote si se cambia estantería

### **ALTO #2: Reprocesos Modal Sin Validación Tiempo Real**
- **Ubicación:** `ReprocesosUbicacionModal.tsx:27-53`
- **Problema:** Validación solo en confirm, no en input. User escribe `-999` sin feedback
- **Solución:** Validar en onChange con debounce

### **ALTO #3: Mover Sin Validar que Destino No Está Ocupado**
- **Ubicación:** `useOperativeShelf.ts:905-916`
- **Problema:** Selecciona destino ocupado sin validación → potencial sobrescritura
- **Solución:** Validar `loc.isEmpty === true` antes de permitir selección

### **ALTO #4: Retirada Lote Falla si Posición Desaparece**
- **Ubicación:** `useOperativeShelf.ts:1135-1177`
- **Problema:** User abre RETIRAR → otro user retira la posición → operación falla silenciosamente
- **Solución:** Validar posiciones aún existen antes de procesar lote

### **ALTO #5: Multi-sección Sin Sincronización si Falla una Sección**
- **Ubicación:** `useOperativeShelf.ts:944-966`
- **Problema:** Ubica en PRE (éxito) + MEC (falla) → incompleto sin compensación
- **Solución:** Rollback multi-sección si falla cualquier parte

---

## 🟡 BUGS MEDIOS (Confusión / Inconsistencia)

### **MEDIO #1: Grid No Refleja Cambios Offline Durante Reconexión**
- **Ubicación:** `offlineQueue.ts:48-115`
- **Problema:** Grid desincronizado visualmente mientras se sincronizan entries
- **Solución:** Actualizar locations dinámicamente durante drainOfflineQueue()

### **MEDIO #2: Validación Contigüidad No Aplica Consistentemente**
- **Ubicación:** `useOperativeShelf.ts:876-903`
- **Problema:** Reprocesos NO valida, normal SÍ valida → inconsistencia de reglas
- **Solución:** Documentar por qué reprocesos está excepto

### **MEDIO #3: PresenceId No Se Genera Consistentemente Offline**
- **Ubicación:** `inventory.ts:343`
- **Problema:** Offline presenceId diferente del BD → deduplicación falla
- **Solución:** Generar presenceId en frontend ANTES de offline

### **MEDIO #4: Historial Timestamp Incorrecto para Operaciones Offline**
- **Ubicación:** `inventory.ts:322-332`
- **Problema:** Timestamp es de sincronización, no del momento offline
- **Solución:** Preservar timestamp original con operación offline

### **MEDIO #5: CellFirst Reprocesos Sin Validación de Tiempo**
- **Ubicación:** `useOperativeShelf.ts:833-847`
- **Problema:** User selecciona 10 celdas, no confirma por 5min → celdas pueden estar vacías
- **Solución:** Invalidar selección después de 2min o si hay cambios

### **MEDIO #6: Grid Scroll Pierde Highlight Visual**
- **Ubicación:** `ShelfGrid.tsx`
- **Problema:** Scroll re-renderiza grid → visualmente pierde highlight de selección
- **Solución:** Persister selected positions CSS class durante scroll

---

## 🟢 BUGS BAJOS (UX confusión menor)

### **BAJO #1: Modal Backdrop Click Cierra Sin Acción**
- **Solución:** Remover backdrop click o agregar confirmación

### **BAJO #2: Reprocesos Modal Sin Double-Click Prevention**
- **Solución:** Agregar `disabled` a botón durante processing

### **BAJO #3: Sin Feedback Visual de "Sincronizando" Lote**
- **Solución:** Mostrar toast/banner "Sincronizando X entradas..."

### **BAJO #4: Tooltips Falta en Botones Mobile**
- **Solución:** Agregar aria-labels y tooltips

### **BAJO #5: Sin Timeout en Operaciones API**
- **Solución:** Agregar timeout 30s con fallback

---

## 📋 ROADMAP INMEDIATO

**HOY:**
- [ ] CRÍTICO #1: Validar API response ANTES de optimistic
- [ ] CRÍTICO #2: Validar presenceId en mirrorAppend
- [ ] CRÍTICO #3: Marcar presenceId completados
- [ ] CRÍTICO #4: Validar selectedKeys en retirar

**Esta Semana:**
- [ ] ALTO #1-5: Implementar validaciones
- [ ] MEDIO #1-6: Sincronización y consistencia

---

**Status:** 🔴 20 BUGS OPERACIONALES ENCONTRADOS  
**Prioridad:** INMEDIATA — 4 críticos pueden causar pérdida de datos
