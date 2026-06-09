# ⚙️ Configuración - Ubicaciones Urgentes SOLDADURA
**Fecha:** 2026-06-09  
**Deploy:** ✅ En progreso  

---

## 📝 Qué se ha hecho

### 1. Frontend - Schema Visual ✅
**Archivo:** `APP/frontend/lib/schema/shelves.ts` (línea 182-190)

```typescript
{
  code: 'SOL',
  name: 'Soldadura',
  section: 'SOLDADURA',
  type: 'shelf',
  locationCount: 73,
  layout: {
    zones: [
      { name: 'URGENTE', range: [1, 4], color: '#ef4444', isUrgent: true },
      { name: 'PRINCIPAL', range: [5, 73], color: '#3b82f6' },
    ],
    // ...
  },
},
```

**Efecto:**
- Ubicaciones 001-004 aparecen en ROJO en la interfaz
- Ubicaciones 005-073 aparecen en AZUL

---

### 2. Backend - Función Admin ✅
**Archivo:** `APP/backend/src/admin.ts` (línea 134-152)

```typescript
if (op === 'updateUrgentLocations') {
  try {
    const locationsToAdd = Array.isArray(payload?.locationsToAdd) 
      ? payload.locationsToAdd : [];
    const configRef = db.collection('config').doc('app');
    const configSnap = await configRef.get();
    const config = configSnap.data() || {};
    const currentUrgent = Array.isArray(config.urgentLocations) 
      ? [...config.urgentLocations] : [];
    const newUrgent = [...new Set([...currentUrgent, ...locationsToAdd])];
    await configRef.update({
      urgentLocations: newUrgent,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, urgentLocations: newUrgent };
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Error: ${err}`);
  }
}
```

**Efecto:**
- Permite actualizar la configuración de ubicaciones urgentes
- Agrega ubicaciones a lista existente (sin duplicados)
- Registra timestamp de actualización

---

### 3. Backend - Notificaciones ✅
**Archivo:** `APP/backend/src/notifications.ts` (línea 161-184)

```typescript
if (isUrgent) {
  const chiefEmails = Array.isArray(chiefMapping[section]) 
    ? chiefMapping[section] : [];
  const urgentChiefEmails = [...chiefEmails, ...extraUrgentEmails];
  
  await Promise.all([
    notifyUsersByEmails(urgentChiefEmails, {
      title: 'Articulo urgente ubicado',
      body: `${articleCode} ${orderFab} ubicado en ${locationId}`,
      data: { type: 'URGENT_LOCATION', ... },
    }),
    notifyUsersByEmails(qualityEmails, {
      title: 'Articulo urgente ubicado',
      body: `${articleCode} ${orderFab} ubicado en ${locationId}`,
      data: { type: 'URGENT_LOCATION_QUALITY', ... },
    }),
  ]);
}
```

**Efecto:**
- Se dispara automáticamente cuando se ubica en SOL-001 a SOL-004
- Notifica a jefe de SOLDADURA + Calidad
- Soporta Email + FCM Push simultáneamente

---

## 🔧 Cómo Usar

### Actualizar Ubicaciones Urgentes (SUPERADMIN)

**Desde la App:**
```javascript
const response = await firebase.functions()
  .httpsCallable('adminOperate')({
    op: 'updateUrgentLocations',
    payload: {
      locationsToAdd: [
        'SOL-001',
        'SOL-002',
        'SOL-003',
        'SOL-004',
      ]
    }
  });

console.log(response.data); 
// { ok: true, urgentLocations: [...] }
```

**Desde Firestore Console:**
```
config/app → urgentLocations = ['SOL-001', 'SOL-002', 'SOL-003', 'SOL-004']
```

### Agregar Más Ubicaciones (Si es necesario)

**Ejemplo: Agregar SOL-073 como urgente**

```javascript
await firebase.functions()
  .httpsCallable('adminOperate')({
    op: 'updateUrgentLocations',
    payload: {
      locationsToAdd: ['SOL-073']
    }
  });
```

---

## 📊 Verificación de Configuración

### Verificar en Firestore

```
Collection: config
Document: app
Campo: urgentLocations

✓ Tipo: Array
✓ Valores: ['SOL-001', 'SOL-002', 'SOL-003', 'SOL-004', ...]
✓ Actualizado: timestamp presente
```

### Verificar Notificaciones

**Cuando se ubique en SOL-001:**

```
Trigger: onWrite(shelves/SOL/locations/001)
  ├─ Check: config.urgentLocations.includes('SOL-001') → true
  ├─ Check: isUrgent → true
  ├─ Send Email: Jefe SOLDADURA
  ├─ Send Email: CALIDAD
  ├─ Send FCM Push: Jefe SOLDADURA
  ├─ Send FCM Push: CALIDAD
  └─ Log: notificationHistory
```

---

## 🎯 Destinatarios de Notificaciones

### Jefe de Sección SOLDADURA
- **Obtenido de:** `config.chiefMapping.SOLDADURA`
- **Emails:** Configurados en Firestore
- **Canales:** Email + FCM Push

### Equipo CALIDAD
- **Obtenido de:** `config.qualityEmails`
- **Emails:** Configurados en Firestore
- **Canales:** Email + FCM Push (solo para QA)

### Configuración en Firestore

```json
{
  "chiefMapping": {
    "SOLDADURA": ["jefe@company.com"]
  },
  "qualityEmails": ["calidad@company.com"]
}
```

---

## 🚨 Troubleshooting

### ¿Las ubicaciones 1-4 no aparecen rojas?
1. Hard refresh del navegador: `Ctrl+Shift+R`
2. Verificar que el deploy completó exitosamente
3. Verificar que `shelves.ts` tiene la zona URGENTE

### ¿Las notificaciones no llegan?
1. Verificar que usuario tiene FCM token registrado
2. Verificar que `config.chiefMapping` está completo
3. Revisar Cloud Functions logs en Firebase Console

### ¿"updateUrgentLocations" no funciona?
1. Verificar que el usuario es SUPERADMIN
2. Verificar que `config/app` existe en Firestore
3. Revisar error en Cloud Functions console

---

## 📋 Checklist de Verificación

- [ ] Deploy completó exitosamente
- [ ] Ubicaciones 1-4 aparecen ROJAS en UI
- [ ] Ubicaciones 5-73 aparecen AZULES en UI
- [ ] config/app.urgentLocations contiene SOL-001 a SOL-004
- [ ] Notificación recibida al ubicar en SOL-001
- [ ] Email recibido por jefe de SOLDADURA
- [ ] Email recibido por CALIDAD
- [ ] Registro en notificationHistory

---

**Status:** ✅ Listo para testing  
**Última actualización:** 2026-06-09 14:00  
**Responsable:** Claude Code
