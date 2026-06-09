# 📋 Plan de Testing - Ubicaciones Urgentes SOLDADURA
**Fecha:** 2026-06-09  
**Status:** Listo para testing manual  

---

## ✅ Cambios Desplegados

### 1. Marcado Visual (UI)
- **Ubicaciones 1-4 de SOLDADURA:** Ahora aparecen en ROJO (#ef4444)
- **Ubicaciones 5-73 de SOLDADURA:** Aparecen en AZUL (#3b82f6)

### 2. Sistema de Notificaciones
- Al ubicar artículo en SOL-001 a SOL-004:
  - Notificación a **Jefe de Sección SOLDADURA**
  - Notificación a **Equipo CALIDAD**
  - Tipo: `URGENT_LOCATION`

### 3. Configuración Firestore
- Documento: `config/app`
- Campo: `urgentLocations`
- Valor: `['SOL-001', 'SOL-002', 'SOL-003', 'SOL-004', ...]`

---

## 🧪 TESTING MANUAL

### Test #1: Verificar Ubicaciones Rojas en UI ✅

**Pasos:**
1. Ir a la sección SOLDADURA
2. Ver el grid de ubicaciones
3. Verificar que posiciones 1-4 tengan fondo ROJO

**Resultado esperado:**
- Células 1-4 con color rojo
- Células 5-73 con color azul

---

### Test #2: Activar Notificaciones ✅

**Pasos:**
1. Abrir la app en navegador como CARRETILLERO
2. Ir a SOLDADURA
3. Ubicar un artículo en SOL-001:
   ```
   Código: ABC123
   OF: ORD-001
   ```

**Resultado esperado:**
- Notificación push en dispositivo
- Email a jefe de SOLDADURA
- Email a CALIDAD
- Registro en `notificationHistory`

---

### Test #3: Verificar Transición de Zonas ✅

**Pasos:**
1. Ubicar en SOL-005 (PRINCIPAL)
2. Ubicar en SOL-004 (URGENTE)
3. Comparar notificaciones

**Resultado esperado:**
- SOL-005: Notificación estándar ("Artículo ubicado en zona de Soldadura")
- SOL-004: Notificación urgente ("Articulo urgente ubicado")

---

### Test #4: Verificar Base de Datos ✅

**En Firestore Console:**

```
firestore.database.google.com
  └─ config
      └─ app
          └─ urgentLocations: ['SOL-001', 'SOL-002', 'SOL-003', 'SOL-004']
```

**Verificar:**
- Array no vacío ✓
- Contiene SOL-001 a SOL-004 ✓
- Tipos de datos string ✓

---

## 🔧 Función Admin para Actualizar (Si es necesario)

Si necesitas agregar más ubicaciones urgentes:

```javascript
// En Firebase Console → Functions → adminOperate
// O llamar desde app:

const response = await functions.httpsCallable('adminOperate')({
  op: 'updateUrgentLocations',
  payload: {
    locationsToAdd: [
      'SOL-001', 'SOL-002', 'SOL-003', 'SOL-004',
      'SOL-073'  // ejemplo: agregar otra
    ]
  }
});
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "urgentLocations": ["SOL-001", "SOL-002", "SOL-003", "SOL-004", "SOL-073"]
}
```

---

## 📊 Verificación de Notificaciones

### Canal 1: Push Notifications (FCM)
- **Destinatarios:** Todos los dispositivos del jefe + CALIDAD
- **Título:** "Articulo urgente ubicado"
- **Body:** "{ArticleCode} {OrderFab} ha sido ubicado en SOL-001"

### Canal 2: Email
- **Para:** Jefe de Sección SOLDADURA + Emails de CALIDAD
- **Asunto:** "Articulo urgente ubicado"
- **Cuerpo:** Mismo que push

### Canal 3: Historial
- **Colección:** `notificationHistory`
- **Campos:**
  - `title`: "Articulo urgente ubicado"
  - `body`: "[artículo] [OF] ubicado en SOL-XXX"
  - `data.type`: "URGENT_LOCATION"
  - `sentAt`: timestamp
  - `successCount`: número de notificaciones exitosas

---

## ✅ Checklist Final

| Test | Esperado | Actual | ✓ |
|------|----------|--------|---|
| Ubicaciones 1-4 rojas en UI | Rojo (#ef4444) | | ☐ |
| Ubicaciones 5-73 azules | Azul (#3b82f6) | | ☐ |
| Notificación al jefe SOLDADURA | Recibida | | ☐ |
| Notificación a CALIDAD | Recibida | | ☐ |
| Tipo de notificación | URGENT_LOCATION | | ☐ |
| Registro en notificationHistory | Presente | | ☐ |
| Config/app.urgentLocations | Array completo | | ☐ |
| Mensaje error/success clara | Visibles | | ☐ |

---

## 🚨 Si Algo Sale Mal

### Error: "Ubicaciones no aparecen rojas"
→ Verificar cache del navegador (Ctrl+Shift+R)
→ Verificar deploy completó exitosamente

### Error: "Notificaciones no llegan"
→ Verificar que usuario tiene FCM token registrado
→ Verificar config/app.chiefMapping tiene emails
→ Revisar Cloud Functions logs

### Error: "config/app.urgentLocations vacío"
→ Llamar a adminOperate con op='updateUrgentLocations'
→ Verificar que responda con array actualizado

---

**Status:** ✅ Listo para testing  
**Deploy:** ✅ Completado  
**Documentación:** ✅ Generada  

Cualquier duda contactar a: d.soler@favram.com
