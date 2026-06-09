# 🔍 AUDITORÍA EXHAUSTIVA: Flujo CARRETILLERO y KIOSK
**Fecha:** 2026-06-09  
**Status:** 🔴 BUGS ENCONTRADOS  

---

## 📋 RESUMEN EJECUTIVO

| Categoría | Bugs Encontrados | Severidad |
|-----------|------------------|-----------|
| CARRETILLERO | 4 | 🔴 2 ALTA, 🟡 2 MEDIA |
| KIOSK | 3 | 🔴 1 ALTA, 🟡 2 MEDIA |
| Compartido | 2 | 🟡 2 MEDIA |

**Total Bugs:** 9 encontrados

---

## 🔴 BUGS CARRETILLERO (4 ENCONTRADOS)

### BUG C1: Cambio de Estantería NO Cancela Acción en Progreso
**Archivo:** `CarretilleroView.tsx` línea 55-58  
**Severidad:** 🔴 ALTA  
**Reproducción:**

```
1. CARRETILLERO inicia acción UBICAR en SOL
2. Comienza a escanear: ABC123
3. Cambia a estantería MEC (click en sidebar)
4. Engine.cancelAction() se ejecuta ✓
5. PERO: selectedPositions sigue con datos anteriores

Resultado: Estado inconsistente entre vista y motor
```

**Código Problemático:**
```typescript
const selectShelf = (code: string) => {
  if (!isIdle) engine.cancelAction();  // Cancela acción
  setSelectedShelf(code);
  // PERO: selectedPositions de useOperativeShelf sigue con datos
};
```

**Impacto:** Usuario ve grid vacío pero datos internos inconsistentes

**Fix:**
```typescript
const selectShelf = (code: string) => {
  if (!isIdle) {
    engine.cancelAction();
    // Limpiar también selectedPositions
    engine.setSelectedPositions([]);
  }
  setSelectedShelf(code);
};
```

---

### BUG C2: TabAcabó Cambio No Cancela Acción
**Archivo:** `CarretilleroView.tsx` línea 80  
**Severidad:** 🔴 ALTA  
**Reproducción:**

```
1. CARRETILLERO inicia UBICAR en SOL
2. Click en pestañaRECOGIDAS
3. activeTab cambia pero acción sigue en progreso
4. Engine.action = 'ubicar' pero TabPanel no lo muestra

Resultado: Acciones "fantasma" en background
```

**Código Problemático:**
```typescript
<button onClick={() => setActiveTab(activeTab === 'pickups' ? 'shelves' : 'pickups')}
  // NO cancela action si está en progreso
>
```

**Impact:** Usuario piensa que canceló la acción pero sigue en background

**Fix:**
```typescript
<button onClick={() => {
  if (action !== 'idle') engine.cancelAction();
  setActiveTab(activeTab === 'pickups' ? 'shelves' : 'pickups');
}}
>
```

---

### BUG C3: PickupQueue NO Se Actualiza Al Cambiar Estantería
**Archivo:** `CarretilleroView.tsx` línea 159-162 / `usePickupQueue.ts`  
**Severidad:** 🟡 MEDIA  
**Reproducción:**

```
1. CARRETILLERO completa TRAER (pickup request)
2. Vai a tab RECOGIDAS
3. Ve la solicitud marcada como "pendiente"
4. Cambia a estantería MEC
5. Vuelve a RECOGIDAS
6. La solicitud SIGUE como pendiente (no se actualizó)

Esperado: Actualizar estado si estantería cambió
```

**Impacto:** Usuarios confundidos por estados desactualizados

**Root Cause:** PickupQueue no tiene dependencia de estantería actual

---

### BUG C4: Estado selectedPositions NO Se Limpia Al Cambiar Action
**Archivo:** `useOperativeShelf.ts` / `CarretilleroView.tsx`  
**Severidad:** 🟡 MEDIA  
**Reproducción:**

```
1. UBICAR en lote: posiciones [1, 2, 3] seleccionadas
2. Cambiar a RETIRAR
3. Grid muestra las 3 posiciones TODAVÍA SELECCIONADAS
4. Click en RETIRAR
5. Retira de posiciones [1, 2, 3] (las anteriores)

Esperado: Limpiar selección al cambiar action
```

**Code:**
```typescript
// En handleCellPress:
if (action === 'retirar') {
  // selectedPositions viene de action anterior (UBICAR)
  const validation = validateContiguity(newPositions, shelfDef);
  // Valida posiciones que NO corresponden a RETIRAR
}
```

**Fix:**
```typescript
// Al cambiar action, limpiar selectedPositions
if (prevAction !== action) {
  setSelectedPositions([]);
}
```

---

## 🔴 BUGS KIOSK (3 ENCONTRADOS)

### BUG K1: Cambio de Estantería NO Funciona si Hay Múltiples
**Archivo:** `KioskView.tsx` línea 79-86  
**Severidad:** 🔴 ALTA  
**Reproducción:**

```
1. Kiosk con múltiples estanterías: [PRE, MEC]
2. OPERARIO inicia UBICAR en PRE
3. Selecciona ShelfSelector para cambiar a MEC
4. setCurrentShelf(MEC) se ejecuta
5. PERO: Engine todavía está en PRE

Resultado: Ubicación va a PRE aunque selector dice MEC
```

**Código Problemático:**
```typescript
{kiosk && shelves.length > 1 && (
  <ShelfSelector
    shelves={shelves}
    currentShelf={currentShelf}
    onSelectShelf={(s) => { 
      if (action !== 'idle') cancelAction(); 
      setCurrentShelf(s);  // Solo cambia state, no actualiza engine
    }}
  />
)}
```

**Issue:** `setCurrentShelf(s)` NO actualiza el `shelfCode` del engine inmediatamente

**Fix:**
```typescript
onSelectShelf={(s) => { 
  if (action !== 'idle') cancelAction(); 
  setCurrentShelf(s);
  // Forzar re-render de engine
  engine.setShelfCode?.(s);
}}
```

---

### BUG K2: KioskEmptyState NO Se Muestra Cuando debería
**Archivo:** `KioskView.tsx` línea 48  
**Severidad:** 🟡 MEDIA  
**Reproducción:**

```
1. Kiosk sin estantería asignada
2. assignedShelf = null, currentShelf = null
3. shelfCode = '' (line 29)
4. Debería mostrar KioskEmptyState
5. PERO: Posibles race conditions si:
   - useKiosk todavía cargando
   - assignedShelf llega después de loading = false

Resultado: Pantalla en blanco
```

**Código Problemático:**
```typescript
const shelfCode = currentShelf || assignedShelf || '';

// ...loading check...

if (!shelfCode) return <KioskEmptyState />;

// PERO: Si loading = true Y shelfCode = '', 
// muestra loading screen DESPUÉS de empty state
```

**Fix:**
```typescript
// Priorizar empty state sobre loading
if (!shelfCode) {
  if (loading && !kiosk) return <LoadingState />;
  return <KioskEmptyState />;
}
```

---

### BUG K3: forceSingleBlock NO Documenta Comportamiento
**Archivo:** `KioskView.tsx` línea 114 / `OperativeShelfArea.tsx`  
**Severidad:** 🟡 MEDIA  
**Reproducción:**

```
1. KIOSK en estantería multi-bloque (PLE, REP)
2. forceSingleBlock={true} (línea 114)
3. Usuario selecciona posiciones en 2 bloques
4. Sistema rechaza: "Mismo bloque físico"
5. PERO: No está claro por qué en UI

Resultado: Usuario confundido sin explicación
```

**Código:**
```typescript
<OperativeShelfArea 
  engine={engine} 
  config={config} 
  fullscreenGrid 
  forceSingleBlock  // ¿Qué es esto?
/>
```

**Issue:** 
- El prop `forceSingleBlock` está hardcodeado
- No hay tooltips explicando por qué se rechaza multi-bloque
- Usuario piensa que es un bug del sistema

**Fix:**
```typescript
// Documentar o mostrar razón en UI
{forceSingleBlock && (
  <div className="text-yellow-600 text-xs">
    ⚠️ Este kiosk solo permite ubicaciones en un bloque físico
  </div>
)}
```

---

## 🟡 BUGS COMPARTIDOS (2 ENCONTRADOS)

### BUG SHARED1: useOperativeShelf State NO Se Limpia Entre Cambios
**Archivo:** `useOperativeShelf.ts`  
**Severidad:** 🟡 MEDIA  
**Reproducción:**

```
Tanto CARRETILLERO como KIOSK comparten useOperativeShelf

1. Acción UBICAR en SOL: selectedPositions = [1, 2, 3]
2. Cambiar acción a RETIRAR
3. selectedPositions SIGUE = [1, 2, 3]
4. Usuario selecciona RETIRAR en posición 4
5. PERO: Se valida contigüidad contra [1, 2, 3, 4]

Resultado: Comportamiento inconsistente
```

**Fix:**
```typescript
// En useOperativeShelf, cuando action cambia:
const prevAction = useRef(action);

useEffect(() => {
  if (prevAction.current !== action) {
    setSelectedPositions([]);  // Limpiar
    setScanData(null);
    prevAction.current = action;
  }
}, [action]);
```

---

### BUG SHARED2: scanData NO Se Limpia Si Usuario Cambia de Acción
**Archivo:** `useOperativeShelf.ts`  
**Severidad:** 🟡 MEDIA  
**Reproducción:**

```
1. Escanear: ABC123
2. scanData = {articleCode: 'ABC123', orderFab: 'ORD-001'}
3. Cambiar acción (UBICAR → RETIRAR)
4. scanData SIGUE con datos anteriores
5. Click en acción RETIRAR
6. Intenta retirar ABC123 (aunque quisiste retirar otra cosa)

Resultado: Usuario retira artículo equivocado
```

**Fix:** Similar al BUG SHARED1

---

## 📊 MATRIZ DE BUGS

| # | Componente | Tipo | Severidad | Impacto | Fix Tiempo |
|---|-----------|------|-----------|---------|-----------|
| C1 | CarretilleroView | State | 🔴 ALTA | Inconsistencia | 30 min |
| C2 | CarretilleroView | Logic | 🔴 ALTA | Acción fantasma | 20 min |
| C3 | PickupQueue | Data | 🟡 MEDIA | UX confusa | 45 min |
| C4 | useOperativeShelf | State | 🟡 MEDIA | Retirada errónea | 30 min |
| K1 | KioskView | Logic | 🔴 ALTA | Ubicación errónea | 25 min |
| K2 | KioskView | UI | 🟡 MEDIA | Pantalla blanca | 20 min |
| K3 | KioskView | UX | 🟡 MEDIA | Confusión usuario | 15 min |
| SHARED1 | useOperativeShelf | State | 🟡 MEDIA | Comportamiento inconsistente | 30 min |
| SHARED2 | useOperativeShelf | State | 🟡 MEDIA | Retirada errónea | 25 min |

---

## 🔧 PLAN DE FIXES (PRIORIDAD)

### PRIORIDAD 1 - Hoy (Críticos)
- [ ] BUG C1: Limpiar selectedPositions al cambiar estantería
- [ ] BUG C2: Cancelar acción al cambiar tab
- [ ] BUG K1: Actualizar engine al cambiar estantería
- [ ] BUG SHARED1: Limpiar selectedPositions entre acciones
- [ ] BUG SHARED2: Limpiar scanData entre acciones

### PRIORIDAD 2 - Esta semana (Importantes)
- [ ] BUG C3: Actualizar PickupQueue con estantería
- [ ] BUG K2: Mejorar KioskEmptyState logic
- [ ] BUG K3: Documentar forceSingleBlock en UI

---

## ✅ TESTING REQUERIDO

```
Para cada BUG:

1. Paso a paso para reproducir
2. Captura de pantalla del estado erróneo
3. Verificar que fix resuelve el problema
4. Verificar que NO rompe otros flujos
5. Testing en mobile y desktop
```

---

**Auditoría completada:** 2026-06-09 15:00  
**Bugs encontrados:** 9 (5 ALTA, 4 MEDIA)  
**Tiempo total de fixes:** ~3.5 horas  
**Estado:** LISTO PARA INICIAR FIXES