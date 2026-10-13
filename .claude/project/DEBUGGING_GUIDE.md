---
name: debugging-procedures
description: Guía paso a paso para debuggear bugs frecuentes
metadata:
  type: reference
---

# 🐛 Debugging Guide — Procedimientos Paso a Paso

**Propósito**: Cuando algo no funciona, sigue estos pasos. Cada bug frecuente tiene un árbol de diagnóstico.

---

## 🔴 Los 7 Bugs Más Frecuentes

### 1️⃣ Usuario No Ve Opción de Ubicar

**Síntoma**: 
- OPERARIO entra al kiosk, no ve botón "Ubicar"
- O JEFE_SECCION ve opciones de secciones que no son suyas

**Árbol de Diagnóstico**:

```
Usuario no ve "Ubicar"
  ├─ ¿Es OPERARIO sin assignedShelf?
  │  └─ Revisar: usuarios/{uid}/assignedShelf en Firestore
  │  └─ Comando: firebase firestore:shell
  │     > db.collection('usuarios').doc('{uid}').get()
  │  └─ Debe tener: assignedShelf = 'PRE' o 'MEC'
  │
  ├─ ¿Es JEFE_SECCION?
  │  └─ Revisar: authCapabilities.ts línea 41-45
  │  └─ Debe cumplir: role='JEFE_SECCION' + assignedShelf cargado
  │  └─ Comando: Browser DevTools → localStorage.getItem('session')
  │  └─ Buscar: "capabilities": { "canOperateShelf": true }
  │
  ├─ ¿Es ADMIN?
  │  └─ Siempre debe poder (línea 29)
  │  └─ Si no puede → error en login, revisar paso 3
  │
  └─ ¿Es OPERARIO restringido a sección?
     └─ Revisar: canAccessShelf('OPERARIO', assignedShelf, targetShelf)
     └─ Archivo: domain/shelves/shelfAccess.ts línea 9
     └─ Debe: assignedShelf === targetShelf (exacto)
```

**Pasos para Arreglar**:

```bash
# 1. Verificar que el usuario existe en Firestore
firebase firestore:shell
> db.collection('usuarios').doc('USER_ID').get()
# Debe tener: role, assignedShelf, email

# 2. Verificar que el shelf asignado existe
> db.collection('config').doc('app').get()
# Debe tener: SHELF_DEFINITIONS con PRE/MEC/CAL

# 3. Revisar capabilities en localStorage (frontend)
# Browser DevTools → Applications → Local Storage
# Buscar clave "session" → debe tener "canOperateShelf: true"

# 4. Si localStorage muestra false, revisar login
# Archivo: hooks/useAuth.ts o hooks/useKiosk.ts
# Buscar: resolveCapabilities() call
```

---

### 2️⃣ Ubicación Rechazada (No Guarda Artículo)

**Síntoma**:
- Usuario ubica artículo en la grid
- UI muestra que se ubicó (feedback visual)
- Pero al recargar → desaparece
- O error: "Ubicación inválida"

**Árbol de Diagnóstico**:

```
Ubicación rechazada
  ├─ ¿Error: "Ubicación inválida"?
  │  └─ Slot no existe para el shelf
  │  └─ Revisar: lib/schema/shelves.ts → SHELF_DEFINITIONS
  │  └─ Verificar: ¿slot está en rango valid para shelf?
  │     PRE: 1-50, MEC: 1-46, CAL: 1-22
  │  └─ Si custom shelf → revisar config/app
  │
  ├─ ¿Artículo desaparece al recargar (offline)?
  │  └─ = Data loss por optimistic update sin validación
  │  └─ Revisar: hooks/useOperativeShelf.ts
  │  └─ Problema: updateOptimistic() en UI pero Cloud Function rechaza
  │  └─ Solución: Validación antes de optimistic update
  │  └─ Ver: RULES.md → "Ubicación perdida en offline"
  │
  ├─ ¿Cloud Function error (backend logs)?
  │  └─ Comando: firebase functions:log
  │  └─ Buscar: "operateLocation" error
  │  └─ Causas comunes:
  │     - Firestore rules bloquean write
  │     - itemAggregates no updatea (transaction failure)
  │     - Validación backend falla (quantity <= 0)
  │
  └─ ¿Usuario sin permisos para ese shelf?
     └─ Revisar: domain/auth/authCapabilities.ts
     └─ Comando: Browser → localStorage.getItem('session')
     └─ Buscar: "canOperateShelf": true
```

**Pasos para Arreglar**:

```bash
# 1. Verificar validación en frontend
# Archivo: lib/operativeShelfLogic.ts (no existe en el repositorio)
# Función: validateLocation(shelf, slot)
# Debe retornar: { valid: true, error?: null }

# 2. Verificar validación en backend
firebase functions:log
# Buscar líneas con "operateLocation"
# Revisar: qué validation falla?

# 3. Revisar Cloud Function completo
# Archivo: servidor/src/inventory.ts
# Checklista:
#   ✅ shelf existe en config
#   ✅ location/slot válido
#   ✅ items[] no vacío
#   ✅ quantity > 0
#   ✅ user tiene permisos

# 4. Si es offline + optimistic update
npm run dev
# Desconectar WiFi (DevTools → Network → Offline)
# Ubicar artículo
# Reconectar WiFi
# ¿Persiste? Si no → data loss, reportar en RULES.md
```

---

### 3️⃣ itemAggregates Desincronizado

**Síntoma**:
- Grid dice "5 unidades de ARTICULO-001"
- Usuario ubica 3 unidades más
- Grid dice "7" (correcto)
- Pero itemAggregates/{ARTICULO-001} dice "5" (viejo)

**Árbol de Diagnóstico**:

```
itemAggregates desincronizado
  ├─ ¿Es batch operation (múltiples items)?
  │  └─ Revisar: hooks/useOperativeShelf.ts → callOperateLocationApi
  │  └─ Problema: writeBatch no es atomic
  │  └─ Solución: Transaction en Cloud Function
  │  └─ Archivo: servidor/src/inventory.ts
  │
  ├─ ¿Es single item?
  │  └─ Revisar: itemAggregates update logic
  │  └─ Debe hacer: increment(quantity) cuando ubica
  │  └─ Debe hacer: decrement(quantity) cuando retira
  │  └─ Comando Firebase shell:
  │     > db.collection('itemAggregates').doc('ARTICULO-001').get()
  │     > Check "cantidad" field
  │
  ├─ ¿Hay listeners cacheados?
  │  └─ Real-time listeners pueden quedar stale
  │  └─ Revisar: useShelf.ts → Firestore listeners
  │  └─ Solución: Force refresh con listeners.unsubscribe()
  │
  └─ ¿Excel import no updatea agregates?
     └─ Revisar: hooks/useInventoryOperations.ts
     └─ Función: importExcelToFirestore()
     └─ Debe hacer: writeBatch actualizar itemAggregates
```

**Pasos para Arreglar**:

```bash
# 1. Verificar itemAggregates en Firestore
firebase firestore:shell
> db.collection('itemAggregates').doc('ARTICULO-001').get()
# Debe tener: cantidad, shelves[], lastSeen

# 2. Comparar con suma manual de items/
> db.collection('items')
>   .where('article', '==', 'ARTICULO-001')
>   .get()
# Contar docs, verificar cantidad === sum(items[])

# 3. Si no coincide, ejecutar script de backfill
# Script retirado: ya no existe en el repositorio

# 4. Revisar Cloud Function
# Archivo: servidor/src/inventory.ts
# Verificar: ¿updatea itemAggregates después de items?

# 5. Test manual
npm run dev
# Ubicar 1 artículo
# Verificar: itemAggregates incrementó en Firestore
# Recargar
# ¿Sigue igual? Si no → hay bug en listeners
```

---

### 4️⃣ CAL (Calidad) Acceso Roto

**Síntoma**:
- CALIDAD no ve shelves CAL-001 a CAL-022
- O OPERARIO ve CAL (no debería)
- O CAL ve otras secciones (no debería)

**Árbol de Diagnóstico**:

```
CAL acceso roto
  ├─ ¿CALIDAD no ve CAL?
  │  └─ Revisar: authCapabilities.ts línea 40
  │  └─ Debe ser: role === 'CALIDAD' → canAccessShelf('CAL')
  │  └─ Verificar: canAccessShelf() retorna true para CAL
  │  └─ Archivo: domain/shelves/shelfAccess.ts línea 10
  │
  ├─ ¿OPERARIO ve CAL?
  │  └─ BUG: authCapabilities línea 39
  │  └─ OPERARIO debe: assignedShelf === targetShelf exacto
  │  └─ Verificar: assignedShelf ≠ 'CAL'
  │  └─ Si assignedShelf='CAL' → eso es error de setup, no código
  │
  ├─ ¿CAL ve reprocesos pero no costos?
  │  └─ Revisar: authCapabilities línea 34
  │  └─ Debe: isCalidadEmail = (role === 'CALIDAD' && authMethod === 'email')
  │  └─ Verificar: authMethod se cargó correctamente en login
  │  └─ Si authMethod=null → issue en useAuth.ts
  │
  └─ ¿Firestore rules bloquean lectura?
     └─ Revisar: /firestore.rules → CAL collection rules
     └─ Debe permitir: read si role='CALIDAD'
     └─ Comando: firebase emulators:start
     └─ Test rules localmente
```

**Pasos para Arreglar**:

```bash
# 1. Verificar que CALIDAD existe en usuarios/
firebase firestore:shell
> db.collection('usuarios').where('role', '==', 'CALIDAD').get()
# Debe retornar docs con role='CALIDAD', email present

# 2. Verificar CAL shelves en config
> db.collection('config').doc('app').get()
# Buscar: SHELF_DEFINITIONS
# Debe tener: { code: 'CAL', name: 'Calidad', ... }

# 3. Revisar capabilities en localStorage
# Browser DevTools → localStorage → session
# Buscar: "canAccessShelf": función
# Test: canAccessShelf('CAL') debe retornar true

# 4. Revisar Firestore rules
cat firestore.rules | grep -A5 "CAL"
# Debe permitir lectura si role=CALIDAD

# 5. Revisar authMethod en login
# Archivo: hooks/useAuth.ts
# Buscar: getAuth().currentUser.email
# Verificar: authMethod se setea a 'email'

# 6. Test manual
firebase emulators:start
# Login como CALIDAD
# Navegar a CAL shelves
# Verificar: ¿ve botones de ubicar/costos?
```

---

### 5️⃣ FCM (Push Notifications) No Llega

**Síntoma**:
- Operación completada pero push notification no llega
- O solo llega a algunos dispositivos
- O llega pero no muestra mensaje correcto

**Árbol de Diagnóstico**:

```
FCM no llega
  ├─ ¿fcmToken vacío en Firestore?
  │  └─ Revisar: usuarios/{uid}/devices/{deviceId}/fcmToken
  │  └─ Comando: firebase firestore:shell
  │     > db.collection('usuarios').doc('{uid}')
  │     > .collection('devices').get()
  │  └─ Si vacío → device no registró token
  │  └─ Revisar: hooks/useAuth.ts → registerFCMToken()
  │
  ├─ ¿Cloud Function no dispara?
  │  └─ Revisar: servidor/src/inventory.ts (triggers onShelfLocationWrite, onAssignmentWrite)
  │  └─ Buscar: sendPushToUsers() calls (servidor/src/push.ts)
  │  └─ Comando: firebase functions:log
  │  └─ Buscar: "FCM" o "messaging"
  │  └─ Si no aparece → trigger no se ejecutó
  │
  ├─ ¿FCM service account inválido?
  │  └─ Revisar: serviceAccount.json (raíz del repo)
  │  └─ Debe tener: "type": "service_account", valid keys
  │  └─ Si error → regenerar service account en Firebase Console
  │
  ├─ ¿Firestore rules bloquean lectura de tokens?
  │  └─ Revisar: firestore.rules → devices collection
  │  └─ Debe permitir: Cloud Function read fcmToken
  │  └─ Regla debe ser: admin=true (en backend)
  │
  └─ ¿Service Worker no recibe message?
     └─ Revisar: public/firebase-messaging-sw.js
     └─ Debe tener: messaging.onBackgroundMessage()
     └─ Comando: Chrome DevTools → Application → Service Workers
     └─ Verificar: status='activated'
```

**Pasos para Arreglar**:

```bash
# 1. Verificar fcmToken en Firestore
firebase firestore:shell
> db.collection('usuarios').doc('USER_ID')
>   .collection('devices').get()
# Debe mostrar docs con fcmToken no vacío

# 2. Si vacío, verificar registration en frontend
# Archivo: hooks/useAuth.ts
# Función: registerFCMToken()
# Revisar: ¿se llama después de login?
# Comando: Browser Console
#   > localStorage.getItem('fcmToken')
#   Debe tener token, no vacío

# 3. Ver Cloud Function logs
firebase functions:log | grep -i "fcm"
# Debe mostrar: sendFCMMessage() calls
# Si no → trigger no se dispara

# 4. Test manual send
firebase functions:call sendFCMMessage --data '{"userId":"...", "title":"Test"}'
# ¿Llega la notificación al teléfono?

# 5. Verificar Service Worker
# Chrome DevTools → Application → Service Workers
# Status debe ser "activated"
# Revisar: public/firebase-messaging-sw.js existe

# 6. Verificar rules
firebase emulators:start
# Test: ¿Cloud Function puede leer fcmToken?
# Si no → actualizar firestore.rules
```

---

### 6️⃣ OPERARIO/CARRETILLERO Restringido en Lugares Equivocados

**Síntoma**:
- OPERARIO ve sección que no debería
- CARRETILLERO no ve todas las estanterías
- JEFE_SECCION ve más de su sección

**Árbol de Diagnóstico**:

```
Restricción rota
  ├─ ¿Es OPERARIO?
  │  └─ Debe ver SOLO su assignedShelf
  │  └─ Revisar: domain/shelves/shelfAccess.ts línea 9
  │  └─ Debe cumplir: assignedShelf === targetShelf
  │  └─ Verificar: assignedShelf se cargó en login
  │  └─ Comando: localStorage.getItem('session')
  │     Buscar: "assignedShelf": "PRE" | "MEC"
  │
  ├─ ¿Es CARRETILLERO?
  │  └─ Debe ver TODAS las estanterías (compras/entregas)
  │  └─ Revisar: authCapabilities.ts línea 36
  │  └─ Debe retornar: canBrowseAllShelves: true
  │  └─ Si false → error en capabilities
  │
  ├─ ¿Es JEFE_SECCION?
  │  └─ Debe ver SOLO su sección
  │  └─ Revisar: authCapabilities.ts línea 41-45
  │  └─ getSectionForShelf() debe mapear shelf → sección correcta
  │  └─ Verificar: lib/firestoreSchema.ts getSectionForShelf()
  │
  └─ ¿Está filtrado en UI pero accesible en API?
     └─ = Security bypass
     └─ Revisar: firestore.rules
     └─ Cloud Function debe validar permisos TAMBIÉN
     └─ No confiar solo en frontend
```

**Pasos para Arreglar**:

```bash
# 1. Verificar assignedShelf en Firestore
firebase firestore:shell
> db.collection('usuarios').doc('OPERARIO_ID').get()
# Debe tener: assignedShelf = 'PRE' | 'MEC'

# 2. Verificar capabilities en localStorage
# Browser Console
#   > JSON.parse(localStorage.getItem('session')).capabilities
#   Revisar: canBrowseAllShelves, canOperateShelf

# 3. Revisar getSectionForShelf() mapping
# Archivo: lib/firestoreSchema.ts
# Función: getSectionForShelf(shelfCode)
# Debe retornar: 'PRENSAS_MECANIZADO' | 'PLEGADORA' | etc
# Verificar: Matches SHELF_DEFINITIONS sections

# 4. Revisar Firestore rules restricciones
# Archivo: firestore.rules
# Buscar: rules para shelves collection
# Debe validar: request.auth.token.role

# 5. Test manual
npm run dev
# Login como cada rol
# Navegar por estanterías
# Verificar: ¿ve solo lo que debería?
```

---

### 7️⃣ Offline + Optimistic Update = Data Loss

**Síntoma**:
- Usuario ubica artículo sin WiFi
- UI muestra "Ubicado ✓"
- Se conecta WiFi
- Recarga página
- Artículo desaparece 💥

**Árbol de Diagnóstico**:

```
Data loss offline
  ├─ ¿Hay optimistic update sin validación?
  │  └─ Revisar: hooks/useOperativeShelf.ts
  │  └─ Función: updateOptimistic()
  │  └─ Problema: setShelf() local pero Cloud Function rechaza
  │  └─ Solución: Validar ANTES de optimistic update
  │
  ├─ ¿Cloud Function rechaza por validación?
  │  └─ Ej: location inválida, quantity <= 0
  │  └─ Revisar: servidor/src/inventory.ts
  │  └─ Debe retornar: { success: false, error: "reason" }
  │  └─ Frontend debe: revertir optimistic update si error
  │
  ├─ ¿Conexión se pierde a mitad de operación?
  │  └─ Revisar: useConnectionMonitor.ts
  │  └─ Debe detectar: connection state changes
  │  └─ Solución: Queue operación offline, enviar cuando online
  │
  └─ ¿localStorage no persiste cambio?
     └─ Revisar: useLocalStorage.ts
     └─ Debe guardar: shelf state a localStorage
     └─ Solución: onOnline → sincronizar con Firestore
```

**Pasos para Arreglar**:

```bash
# 1. Revisar optimistic update logic
# Archivo: hooks/useOperativeShelf.ts
# Función: callOperateLocationApi()
# Debe hacer:
#   1. Validar localmente
#   2. updateOptimistic() UI
#   3. call API
#   4. SI error → revert optimistic update
#   5. SI success → keep update

# 2. Revisar validación pre-update
# Archivo: lib/operativeShelfLogic.ts (no existe en el repositorio)
# Función: validateLocation()
# Debe retornar: { valid: boolean, error?: string }

# 3. Test offline scenario
npm run dev
# Abrir DevTools → Network → Offline
# Ubicar artículo
# Revisar: ¿UI muestra feedback?
# Reconectar WiFi (Online)
# Recargar
# ¿Persiste? Si no:
#   → Revisar Cloud Function response handling
#   → Revisar error revert logic

# 4. Revisar error handling
# Archivo: hooks/useOperativeShelf.ts
# Función: callOperateLocationApi()
# Buscar: try/catch o .catch() handler
# Debe hacer: setShelf() revert si error

# 5. Solución completa: Offline queue
# Implmenta: queue de operaciones offline
# Sync cuando: online
# Ver: useOfflineStatus.ts para inspiración
```

---

## 🧭 Árbol de Decisión Rápido

**¿Algo no funciona? Responde estas preguntas:**

```
1. ¿Es un problema de permisos/acceso?
   SÍ → Bug #1: Usuario No Ve Opción
   → Revisar: authCapabilities.ts + localStorage session

2. ¿Es una ubicación/artículo que no guarda?
   SÍ → Bug #2: Ubicación Rechazada
   → Revisar: validación + Cloud Function logs

3. ¿Números no coinciden? (grid vs aggregates)
   SÍ → Bug #3: itemAggregates Desincronizado
   → Revisar: Firestore listeners + batch operations

4. ¿Es específico de CALIDAD?
   SÍ → Bug #4: CAL Acceso Roto
   → Revisar: authCapabilities.ts línea 34-40

5. ¿No llega notificación?
   SÍ → Bug #5: FCM No Llega
   → Revisar: fcmToken + Cloud Function logs

6. ¿Usuario ve cosas que no debería?
   SÍ → Bug #6: Restricción Rota
   → Revisar: firestore.rules + backend validation

7. ¿Datos desaparecen después de offline?
   SÍ → Bug #7: Data Loss
   → Revisar: optimistic update + error handling
```

---

## 🛠️ Comandos Útiles para Debugging

```bash
# Ver logs de Cloud Functions
firebase functions:log

# Abrir Firestore shell
firebase firestore:shell

# Iniciar emuladores locales
firebase emulators:start

# Deploy solo functions (para testing)
firebase deploy --only functions

# Build frontend
npm run build

# Type check
npm run typecheck

# Ver localStorage en browser
# DevTools → Application → Local Storage

# Ver Firestore en browser
# DevTools → Application → Indexed DB → firebase
```

---

## 📋 Checklist Post-Fix

Después de arreglar cada bug:

- [ ] Frontend `npm run typecheck` ✅
- [ ] Frontend `npm run build` ✅
- [ ] Backend `npm run build` (si cambió functions) ✅
- [ ] `firebase deploy` o `firebase deploy --only functions` ✅
- [ ] Test manual en dev
- [ ] Revisa RULES.md checklist post-cambios
- [ ] Actualiza memory/ con lección aprendida

---

## 📖 Referencias Relacionadas

- `RULES.md` → "Cosas que rompemos frecuentemente" (versión corta)
- `ARCHITECTURE.md` → Flujos completos
- `CLAUDE_GUIDE.md` → Dónde están los archivos
