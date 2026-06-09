# 🐛 BUGS OPERATIVOS ENCONTRADOS Y SOLUCIONES
**Fecha:** 2026-06-09  
**Status:** 🔴 CRÍTICOS + 🟡 MENORES

---

## 🔴 BUGS CRÍTICOS

### 1. **Mensaje de Error Confuso en MOVER** ⚠️ SEVERIDAD: MEDIA
**Ubicación:** `useOperativeShelf.ts` línea 762  
**Problema:** Dice "no encontrado en esta sección" pero busca en estantería actual
```typescript
// ACTUAL (INCORRECTO):
showToast('error', `${articleCode} no encontrado en esta sección`);

// DEBERÍA SER:
showToast('error', `${articleCode} no encontrado en esta estantería`);
```
**Impacto:** Usuario confundido - piensa que el artículo está en otra sección cuando no existe

**Solución:** Cambiar mensaje de error
**Línea a editar:** 762

---

### 2. **Validación de Contigüidad DEMASIADO RESTRICTIVA** ⚠️ SEVERIDAD: ALTA
**Ubicación:** `contiguityValidator.ts` línea 66-74  
**Problema:** Requiere que ubicaciones estén en el MISMO BLOQUE FÍSICO
```typescript
// LÍNEA 68-73:
const blockIds = new Set(gridPositions.map(p => p.grid!.blockId));
if (blockIds.size > 1) {
  return {
    isContiguous: false,
    direction: null,
    message: 'Las posiciones deben estar en el mismo bloque físico',
  };
}
```
**Impacto:** 
- ❌ No se pueden ubicar artículos en posiciones de diferentes bloques
- ❌ En PLEGADORA con 2 bloques físicos, NO se puede ubicar en ambos
- ❌ En REPASADO con estantería FUERA + DENTRO, NO se puede ubicar en ambas

**Ejemplo de lo que FALLA:**
- Quiero ubicar 1 artículo en 2 posiciones
- Pos 1 = Estantería 1, Pos 2 = Estantería 2
- ❌ "Las posiciones deben estar en el mismo bloque físico"
- Pero el usuario tiene una carretilla de 2 espacios y necesita ocupar ambos

**Solución:** Permitir múltiples bloques SOLO si están en la misma sección/estantería
**Línea a editar:** 68-74 (agregar excepción para bloques en la misma estantería)

---

### 3. **Restricción Injustificada en MOVER** ⚠️ SEVERIDAD: ALTA
**Ubicación:** `useOperativeShelf.ts` línea 758-768  
**Problema:** `findArticle` solo busca en la estantería actual
```typescript
// LÍNEA 759-766:
if (action === 'mover') {
  const found = findArticle(articleCode, orderFab);
  if (found.length === 0) {
    showToast('error', `${articleCode} no encontrado en esta sección`);
    setScanData(null);
    setScannerActive(true);
    return;
  }
```
**Impacto:**
- ❌ CARRETILLERO cambia de estantería A → B
- ❌ Intenta MOVER artículo de estantería A
- ❌ `findArticle` busca solo en estantería B (la actual)
- ❌ No encuentra artículo y rechaza la operación
- ❌ Usuario confundido

**Solución:** Permitir mover ENTRE estanterías para CARRETILLERO/ADMIN/SUPERADMIN

---

### 4. **Vaciar Estantería Restringido Solo a ADMIN** ⚠️ SEVERIDAD: MEDIA
**Ubicación:** `inventory.ts` línea 191-198  
**Problema:** `emptyShelf` solo permite ADMIN/SUPERADMIN
```typescript
// LÍNEA 192-198:
if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
  throw new functions.https.HttpsError(
    'permission-denied',
    'Solo admin puede vaciar estanteria'
  );
}
```
**Impacto:**
- ❌ JEFE_SECCION NO puede vaciar su sección
- ❌ OPERARIO NO puede vaciar su estantería asignada
- ❌ Necesitan pedir ayuda de ADMIN

**Solución:** Permitir JEFE_SECCION en su sección, OPERARIO en su estantería

---

## 🟡 BUGS MENORES

### 5. **Nombre Confuso: askMultiArticle**  
**Ubicación:** `operativeConfig.ts` línea 40, 107, 125, etc.  
**Problema:** `askMultiArticle` pregunta si es "LOTE", no si es "MULTI-ARTÍCULO"
```typescript
// ACTUAL:
ubicar: { askMultiArticle: true, allowMultiSection: false }

// CONFUSO PORQUE:
// - Nombre sugiere: "¿Múltiples artículos en una posición?"
// - Realidad es: "¿Lote (múltiples del mismo artículo)?"
```
**Solución:** Renombrar a `askBatchMode` o `askMultipleQuantity`

---

### 6. **Mensajes de Toast sin Contexto**
**Ubicación:** Varias líneas  
**Problema:** Algunos errores no dicen QUÉ salió mal
```typescript
// ACTUAL:
showToast('error', 'Error al enviar la solicitud'); // Línea 484

// MEJOR:
showToast('error', 'Error al enviar solicitud de traer artículo - intenta de nuevo');
```

---

### 7. **Validación de Contigüidad NO Aplica a ADMIN**
**Ubicación:** `useOperativeShelf.ts` línea 829, 859  
**Problema:** Incluso ADMIN/SUPERADMIN deben respetar contigüidad
```typescript
// LÍNEA 829:
if (!validation.isContiguous && newPositions.length > 1) {
  showToast('error', `❌ ${validation.message}`);
  return;
}
```
**Impacto:** ADMIN no puede ubicar en posiciones no contiguas aunque tenga permiso

**Pregunta:** ¿Debería ADMIN poder ubicar en posiciones no contiguas?

---

## 📋 MATRIZ DE PROBLEMAS POR OPERACIÓN

| Operación | Problema | Severidad | Afecta a |
|-----------|----------|-----------|----------|
| UBICAR | Contigüidad restrictiva | 🔴 ALTA | Todos |
| UBICAR | No se pueden usar múltiples bloques | 🔴 ALTA | PLEGADORA, REPASADO |
| MOVER | Busca solo en estantería actual | 🔴 ALTA | CARRETILLERO, ADMIN |
| MOVER | Mensaje error confuso | 🟡 MEDIA | Todos |
| VACIAR | Solo ADMIN/SUPERADMIN | 🔴 ALTA | JEFE_SECCION, OPERARIO |
| - | askMultiArticle nombre confuso | 🟡 BAJA | UX |

---

## 🔧 PLAN DE FIXES

### PRIORIDAD 1 (Hoy):
- [ ] FIX: Mensaje de error en MOVER (línea 762)
- [ ] FIX: Permitir JEFE_SECCION a vaciar su sección
- [ ] FIX: Permitir OPERARIO a vaciar su estantería

### PRIORIDAD 2 (Esta semana):
- [ ] REVIEW: Validación de contigüidad - ¿Es correcta?
- [ ] FIX: Mover ENTRE estanterías para CARRETILLERO
- [ ] RENAME: askMultiArticle → askBatchMode

### PRIORIDAD 3 (Mejoras):
- [ ] Mejorar mensajes de error con contexto
- [ ] Documentar restricciones en UI

---

## ✅ FIXES RECOMENDADOS (Ready to Apply)

### FIX #1: Cambiar mensaje de error MOVER
```typescript
// FILE: useOperativeShelf.ts, LÍNEA 762
// ANTES:
showToast('error', `${articleCode} no encontrado en esta sección`);

// DESPUÉS:
showToast('error', `${articleCode} no encontrado en ${shelfCode}`);
```

### FIX #2: Permitir JEFE_SECCION vaciar su sección
```typescript
// FILE: inventory.ts, LÍNEA 192-198
// ANTES:
if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
  throw new functions.https.HttpsError('permission-denied', '...');
}

// DESPUÉS:
if (role !== 'ADMIN' && role !== 'SUPERADMIN' && 
    !(role === 'JEFE_SECCION' && section === sectionForWarehouse(warehouse))) {
  throw new functions.https.HttpsError('permission-denied', '...');
}
```

### FIX #3: Permitir OPERARIO vaciar estantería asignada
```typescript
// FILE: inventory.ts, LÍNEA 192-198
// ANTES:
if (role !== 'ADMIN' && role !== 'SUPERADMIN') {

// DESPUÉS:
if (role !== 'ADMIN' && role !== 'SUPERADMIN' && 
    !(role === 'OPERARIO' && lockedShelfCode === warehouse)) {
```

---

## 🔍 VALIDACIONES RECOMENDADAS

### Pregunta 1: ¿Contigüidad para ADMIN?
- ¿ADMIN/SUPERADMIN deberían poder ubicar en posiciones NO contiguas?
- Recomendación: SÍ - agregar flag en config

### Pregunta 2: ¿Múltiples bloques?
- ¿Permitir ubicar en bloques físicos diferentes de la MISMA estantería?
- Recomendación: SÍ - cambiar validación

### Pregunta 3: ¿Mover entre estanterías?
- ¿CARRETILLERO puede mover artículos entre estanterías diferentes?
- Recomendación: SÍ - scope es 'all'

---

**Resumen:** 🔴 3 bugs críticos encontrados, 🟡 4 menores. 3 fixes listos para aplicar inmediatamente.
