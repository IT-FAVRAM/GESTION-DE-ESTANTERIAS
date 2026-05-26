# Plan de Testing E2E — 7 Scenarios Críticos

**Ambiente:** https://localhost:3000  
**Fecha:** 2026-05-25  
**Status:** Build ✅ compilado sin errores

---

## Test 1: Ubicar multi-posición — OPERARIO en KIOSK

**Objetivo:** Verificar que `totalActivePresences` en Firestore es igual al número de posiciones ubicadas.

**Pasos:**
1. Abrir https://localhost:3000
2. Login como **OPERARIO** (guest login)
3. Seleccionar estantería **SOL**
4. Buscar o escanear un artículo (ej: `ART-001`)
5. **Ubicar en 3 posiciones distintas** (ej: 10, 15, 20)
6. Presionar "Ubicar múltiple"
7. **Verificar en Firestore Console:**
   - Ir a `itemAggregates/normalize(ART-001)__normalize(ORDER_FAB)`
   - Confirmar: `totalActivePresences = 3`
   - Confirmar: `activePresenceIds` tiene exactamente 3 elementos

**Resultado esperado:** ✅ El conteo es exacto (no suma solo 1)

---

## Test 2: Mover a posición nueva — CARRETILLERO

**Objetivo:** Verificar que al mover un artículo a una posición inexistente, el UI no lo hace desaparecer.

**Pasos:**
1. Como **CARRETILLERO**, ir a estantería donde hay un artículo (ej: SOL)
2. Buscar un artículo que esté ubicado (ej: `ART-002` en posición 5)
3. Presionar "Mover"
4. **Mover a una posición nueva** que no tiene artículos (ej: posición 99)
5. **Observar el grid en tiempo real:**
   - El artículo NO debe desaparecer
   - Debe verse inmediatamente en la nueva posición (optimistic update)
6. Esperar a que el listener de Firestore confirme

**Resultado esperado:** ✅ Artículo visible inmediatamente en nueva posición

---

## Test 3: enviarAlmacen scope — CARRETILLERO

**Objetivo:** Verificar que "Enviar a almacén" solo afecta la estantería actual.

**Pasos:**
1. **Preparación (ADMIN):** Ubicar mismo artículo en 2 estanterías distintas
   - Ubicar `ART-003` en **SOL** posición 5
   - Ubicar `ART-003` en **CAL** posición 10
2. Como **CARRETILLERO**, ir a **SOL**
3. Buscar y seleccionar `ART-003`
4. Presionar "Enviar a Almacén"
5. Confirmar
6. **Verificar:**
   - `ART-003` desaparece de **SOL**
   - `ART-003` **sigue en CAL** posición 10 (visible)
   - En Firestore: presencias con `shelfCode='CAL'` son `active=true`

**Resultado esperado:** ✅ Artículo permanece en CAL, solo se retira de SOL

---

## Test 4: CALIDAD puede solicitar TRAER — CALIDAD

**Objetivo:** Verificar que CALIDAD tiene opción TRAER además de RECOGER.

**Pasos:**
1. Login como **CALIDAD**
2. Presionar botón **AVISAR**
3. **Verificar modal:**
   - Botón principal: "☑️ RECOGER — Que venga a recoger"
   - Botón secundario: "📦 TRAER — Que me traigan un artículo"
4. Presionar **TRAER**
5. Modal `TraerArticuloModal` abre
6. Ingresar código de artículo a traer
7. Presionar "Solicitar"
8. **Verificar en Firestore:**
   - Nueva entrada en `pickupQueue` con `requestType: 'TRAER'`
   - Campo `articleCode` completado

**Resultado esperado:** ✅ CALIDAD puede hacer solicitudes de tipo TRAER

---

## Test 5: Offline ubicarMulti — OPERARIO en avión

**Objetivo:** Verificar que ubicar múltiple funciona offline y sincroniza al reconectar.

**Pasos:**
1. Como **OPERARIO** en KIOSK, go to **SOL**
2. **Activar modo avión** (o desconectar red)
3. Buscar artículo `ART-004`
4. **Ubicar en 2 posiciones** (ej: 25, 30)
5. Presionar "Ubicar múltiple"
6. **Observar:**
   - UI actualiza optimistamente (artículo aparece en ambas posiciones)
   - En la consola del navegador: hay un mensaje indicando que se encoló
7. **Reconectar red**
8. Abrir DevTools → Network → Filter "pickupQueue" o "inventoryApi"
9. **Verificar:**
   - Requests se envían (cola se drena)
   - Firestore confirma las 2 posiciones
   - Listener actualiza con datos del servidor

**Resultado esperado:** ✅ Operación se encolra y sincroniza al reconectar

---

## Test 6: OCR retry — Escaneo con cámara

**Objetivo:** Verificar que presionar "Reintentar" después de error OCR reinicia el stream.

**Pasos:**
1. En KIOSK o CALIDAD, presionar **Cámara OCR**
2. Modal de OCR abre con stream de cámara (indicador cyan)
3. **Provocar error:**
   - Tapar la cámara completamente
   - O esperar timeout (OCR tardará >10s)
4. Modal muestra **❌ Error de cámara**
5. **Presionar botón "🔄 Reintentar captura"**
6. **Observar:**
   - Stream se reinicia (indicador cyan vuelve)
   - Video ref activo nuevamente
   - Puedes intentar captura de nuevo

**Resultado esperado:** ✅ Stream se reinicia correctamente, no hay error de stream parado

---

## Test 7: Audit log operarioId — ADMIN email-auth

**Objetivo:** Verificar que admins email-auth quedan registrados con UID, no string vacío.

**Pasos:**
1. **Login como ADMIN** (email/password, no guest)
2. Ir a estantería (ej: **SOL**)
3. Ubicar un artículo `ART-005`
4. **Abrir Firebase Console:**
   - Firestore → `history` collection
   - Filtrar por `articleCode = 'ART-005'`
5. **Verificar el documento:**
   - Campo `operarioId` = UID del usuario ADMIN (ej: `abc123xyz...`)
   - **NO debe ser** string vacío `""`
   - Campo `operarioName` = email del admin (ej: `admin@company.com`)

**Resultado esperado:** ✅ operarioId es UID válido, audit trail correcto

---

## Checklist Rápido

- [ ] Test 1: totalActivePresences = N (no 1)
- [ ] Test 2: Mover a nueva posición (optimistic update)
- [ ] Test 3: enviarAlmacen scope (solo current shelf)
- [ ] Test 4: CALIDAD TRAER option visible
- [ ] Test 5: Offline ubicarMulti (encolado + sync)
- [ ] Test 6: OCR retry reinicia stream
- [ ] Test 7: Audit log ADMIN tiene UID

---

## Notas Adicionales

**Si algún test falla:**
1. Abrir DevTools (F12) → Console para errores JS
2. Network tab para ver requests
3. Firestore Console para verificar datos
4. Buscar logs de error con patrón: `[useShelf]`, `[useAuth]`, `[CameraOCRScanner]`

**Variables de interés para debugging:**
- `localStorage` → `wms-auth-*` keys
- `IndexedDB` → Firebase data sync
- Network requests → `inventoryApi.ubicarMulti`, `pickupQueueApi.create`

**Rollback si es necesario:**
```bash
git checkout -- .
npm run build
```

