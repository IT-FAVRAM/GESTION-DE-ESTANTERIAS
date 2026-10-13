---
name: change-impact-rules
description: Qué puede romper qué + checklist de cambios por área
metadata:
  type: feedback
---

# REGLA INAMOVIBLE: nada se despliega sin permiso de Dani

**Nunca** se ejecuta `firebase deploy` (hosting, functions, firestore:rules, storage ni ninguna variante), ni se publica
nada en Firebase o en producción, sin que Dani lo haya autorizado de forma expresa para ese despliegue concreto.
Una autorización anterior no vale para otro despliegue. Preparar, compilar y probar en local sí está permitido.
Aplica a personas y a agentes de IA. Ante la duda, no se despliega y se pregunta.

---

# Reglas de Cambios (Impact Matrix)

**Propósito**: Cuando hagas cambios, revisa esta matriz para saber qué más puede romperse.

---

## 🔴 Cambios CRÍTICOS

### ❌ Modificar `authCapabilities.ts` o roles
**Si cambias**: Matriz de permisos (quién puede ver/hacer qué)

**Revisar**:
- [ ] Login flows para cada rol (especialmente kiosk vs auth)
- [ ] Todos los `canAccessShelf(role, assignedShelf, targetShelf)` calls
- [ ] Shelves CAL-001 a CAL-022 acceso CALIDAD
- [ ] URG MEC-PRE zona compartida (OPERARIO PRE vs MEC)
- [ ] CARRETILLERO debe ver todas las estanterías
- [ ] OPERARIO debe estar restringido a `assignedShelf`

**Test**:
```bash
# Kiosk flow cada rol
npm run dev # Login como OPERARIO, CARRETILLERO, CALIDAD, ADMIN
# Verificar: qué ve cada rol en shelf/location grid
```

---

### ❌ Cambiar Firestore collections/estructura
**Si cambias**: Schema de collections (items/, shelves/, usuarios/, etc)

**Revisar**:
- [ ] `useShelf.ts` listeners → rutas de colecciones
- [ ] `useOperativeShelf.ts` queries → referencias correctas
- [ ] Cloud Functions queries/writes
- [ ] Firestore rules (lee/escribe correctas colecciones)
- [ ] Migration scripts si cambio es destructivo
- [ ] Índices en firestore.indexes.json

**No toques sin revisar**:
- `items/{itemId}` estructura (usado en aggregates)
- `shelves/{code}/locations/{slot}/items` referencia
- `usuarios/{uid}` → role, assignedShelf (login flow)

**Test**:
```bash
# Ubicar + Retirar en cada estantería
npm run dev
# Verificar: datos persisten en Firestore
```

---

### ❌ Cambiar `resolveCapabilities(role, authMethod, assignedShelf)`
**Si cambias**: Lógica central de permisos

**Revisar**:
- [ ] ¿CALIDAD email-only para costos? (línea 34)
- [ ] ¿JEFE_SECCION acceso solo su sección? (línea 41-45)
- [ ] ¿ADMIN siempre retorna true? (línea 53)
- [ ] Todos los view components que usan capabilities
- [ ] FCM notifications (CALIDAD email-only para alerts de reproceso)

**Test**:
```bash
# Login como CALIDAD, cambiar auth method → verificar costos visibles/ocultos
```

---

## 🟡 Cambios MEDIOS

### ⚠️ Modificar flujos de Ubicar/Retirar
**Si cambias**: `useOperativeShelf.ts`, `operateLocation` Cloud Function

**Revisar**:
- [ ] Validación de ubicación → no rompa slots inválidos
- [ ] Optimistic updates en UI (puede desincronizar si API falla)
- [ ] itemAggregates/ actualiza cuando añades/quitas
- [ ] history/ logs cada operación
- [ ] FCM notifications si es pickupQueue item
- [ ] Todos los roles: OPERARIO, CARRETILLERO, CALIDAD, ADMIN

**Test**:
```bash
# Ubicar artículo → verificar:
# - Item aparece en shelf
# - itemAggregates incrementa
# - history/ logged
# - Retirar después
```

---

### ⚠️ Cambiar colecciones no-críticas
**Si cambias**: chat/, conversations/, urgent_alerts/, pickupQueue/

**Revisar**:
- [ ] Firestore rules lectura/escritura
- [ ] FCM listeners actualizados
- [ ] Real-time components reaccionan (ChatPanel, UrgentBanner, etc)
- [ ] Permisos (ej: conversations/ solo ADMIN+CALIDAD)

**No olvides**:
- Saga multicanal: mensaje → chat/ Y si CALIDAD → conversations/
- Alertas urgentes: auto-dismiss después 10s

---

### ⚠️ Modificar validaciones de entrada
**Si cambias**: Validación de QR, cantidad, ubicación, etc

**Revisar**:
- [ ] Validación en frontend + backend (double-check)
- [ ] Mensajes de error claros para usuarios
- [ ] ¿Bloquea operación o solo advierte?
- [ ] Offline: ¿se valida local también?

---

## 🟢 Cambios SEGUROS

### ✅ Cambios cosméticos
- Tailwind CSS clases (colores, spacing)
- Textos de UI
- Orden de elementos (si no cambia funcionalidad)

**Revisar**: Responsive en mobile (390x844 iPhone 14)

---

### ✅ Cambios en componentes aislados
- `CalidadView`, `CarrosView`, `AdminConsole` (si solo UI)
- Nueva sección de código sin dependencias externas

**Revisar**: Tests pass, build OK

---

### ✅ Añadir logs/debugging
- console.log, logging en history/
- Métricas en connectionMonitor

**No hagas**: Logs con datos sensibles (tokens, passwords)

---

## 📋 Checklist Post-Cambios

Después de cambios, **siempre** ejecuta:

```bash
# Frontend
cd aplicacion
npm run typecheck
npm run build
npm run test  # si existen tests

# Backend
cd functions
npm run build
npm run test

# Deploy
firebase deploy
firebase deploy --only functions
```

---

## 🔗 Dependencias Clave (No romper)

### Auth Flow
```
authTypes.ts → resolveCapabilities → useAuth → {RoleComponent}
```
**Si cambias authTypes**: Revisar `resolveCapabilities` y todos los view components

---

### Shelf Data
```
config/app → Shelf definitions
useShelf → listeners shelves/{code}/locations
firestore.rules → read/write permissions
```
**Si cambias Shelf definitions**: Regenerar layout blocks, revisar PRE/MEC zonas

---

### Operaciones
```
useOperativeShelf → callOperateLocationApi → Cloud Functions
→ shelves/ + items/ + itemAggregates/ + history/
```
**Si cambias Cloud Function signature**: Actualiza `callOperateLocationApi` en frontend

---

### Notificaciones
```
FCM token (usuarios/{uid}/devices)
→ Cloud Functions dispara mensajes
→ Service Worker recibe + muestra
```
**Si cambias Cloud Function triggers**: Verifica FCM delivery, listeners actualizados

---

## ⚡ Cosas que Rompemos Frecuentemente

### 1. Roles y permisos
**Síntoma**: Usuario ve opciones que no debería / accede a shelf inválido
**Causa**: `assignedShelf` no cargado o `canAccessShelf()` lógica rota
**Fix**: Revisar `authCapabilities.ts` + `useAuth` session loading

---

### 2. Ubicación perdida en offline
**Síntoma**: Usuario ubica offline, recarga → artículo desaparece
**Causa**: Optimistic update en UI pero no persiste (validación en backend rechaza)
**Fix**: Revisar `useOperativeShelf.ts` validación + `useConnectionMonitor` estado

---

### 3. itemAggregates desincronizado
**Síntoma**: Grid dice 5 unidades pero cuando ubicas 10, dice 12
**Causa**: itemAggregates no actualiza correctamente en batch operations
**Fix**: Revisar `callOperateLocationApi` batch logic + transaction atomicity

---

### 4. CAL-XXX acceso restringido a CALIDAD
**Síntoma**: OPERARIO o JEFE_SECCION ve CAL shelves
**Causa**: `shelfAccess.ts` lógica incorrecta o rule bypass
**Fix**: Revisar `canAccessShelf('CAL', assignedShelf)` para cada rol

---

### 5. FCM no dispara
**Síntoma**: Push notification no llega
**Causa**: fcmToken vacío, Cloud Function no dispara, rules bloquean read
**Fix**: 
- Revisar `usuarios/{uid}/devices/` tiene fcmToken
- Verificar Cloud Function está registrado en triggers
- Revisar firestore.rules permite leer FCM config

---

### 6. Shelf definiciones inconsistentes
**Síntoma**: Frontend dice "ubicación 50 válida" pero backend rechaza
**Causa**: config/app definiciones no sincronizadas
**Fix**: Revisar `SHELF_DEFINITIONS` en `shelves.ts` + firestore.indexes.json

---

## 📍 Dónde Encontrar Qué

| Si necesitas cambiar | Archivo |
|---------------------|---------|
| Permisos por rol | `domain/auth/authCapabilities.ts` |
| Definición de shelves | `lib/schema/shelves.ts` |
| Estructura Firestore | `lib/schema/collections.ts` |
| Validación ubicación | `lib/operativeShelfLogic.ts` |
| Cloud Functions | `servidor/` |
| Firestore rules | `/firestore.rules` |
| FCM triggers | `servidor/functions/` |
| Componentes views | `aplicacion/components/{role}/` |

---

## 🧪 Tests Críticos (Siempre verificar)

1. **Ubicar + Retirar** cada rol
2. **Permisos**: OPERARIO no puede ver sección ajena
3. **CAL**: Solo CALIDAD accede a CAL-XXX
4. **Offline**: Ubica offline, va online → datos persisten
5. **FCM**: Push notification llega a dispositivo correcto
6. **Excel**: Export + Import no pierde datos
7. **Mobile**: Responsive en 390x844 (iPhone 14)

**Comando rápido**:
```bash
npm run build && firebase emulators:start
# Luego test manual cada flow
```
