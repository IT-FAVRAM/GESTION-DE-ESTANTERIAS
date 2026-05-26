# Análisis: Conexiones WiFi & Notificaciones SUPERADMIN

## 1. MONITOR DE CONEXIONES WiFi ✅ **BIEN IMPLEMENTADO**

### Estado Actual
**Ubicación:** `app/web/components/admin/ConnectionMonitorTab.tsx`

El sistema de monitoreo está **correctamente implementado** con:

#### Vista En Vivo 📡
- ✅ Estado de cada dispositivo: **Online | Uncertain | Offline**
- ✅ Indicador visual animado (punto verde pulsante = online)
- ✅ Timestamps: última vez visto, conectado, desconectado
- ✅ Resistencia de conexión (heartbeat < 2 min = online; 2-5 min = uncertain; > 5 min = offline)
- ✅ Filtros por tipo de dispositivo (Kiosk, Carretillero, Admin)

#### Vista de Análisis 📊
- ✅ **Período seleccionable:** 24h, 7 días, 30 días
- ✅ **Timeline visual:** Gráfica de barras mostrando online (verde) / offline (rojo)
- ✅ **Estadísticas por dispositivo:**
  - Uptime % (con color: verde ≥99%, ámbar ≥95%, rojo <95%)
  - Total desconexiones
  - Duración media de desconexión
  - Desconexión máxima
  - Tiempo total offline
  
#### Métricas Resumen
- Dispositivos en línea / inciertos / offline (pills coloridos en header)
- Contador de eventos de desconexión (últimas 20)

---

### Implementación Técnica

#### **Captura de Datos** (`useConnectionMonitor.ts`)
```
Cada dispositivo envía:
- heartbeat cada 60 segundos → colección 'conexion_estado'
- eventos CONNECTED/DISCONNECTED → colección 'conexion_logs'
- con: authUid, deviceId, deviceName, deviceType, timestamp, sessionId
```

#### **Reglas Firestore** (firestore.rules)
```
✅ conexion_estado/{uid}:
   - read: isAdminLike() [ADMIN, SUPERADMIN]
   - write: isAuthenticated() && uid == request.auth.uid

✅ conexion_logs/{logId}:
   - read: isAdminLike() [ADMIN, SUPERADMIN]
   - create: isAuthenticated() && authUid == request.auth.uid
```

#### **Ciclo de Vida**
1. Al conectarse: escribe CONNECTED + lastConnectedAt
2. Cada 60s (online): actualiza lastSeen
3. Al desconectarse: escribe DISCONNECTED + lastDisconnectedAt
4. Al reconectar: calcula lastOfflineDurationMs

---

## 2. NOTIFICACIONES PUSH ⚠️ **PARCIALMENTE IMPLEMENTADO**

### Estado Actual

#### ✅ Lo que SÍ funciona:

**Frontend (pushService.ts):**
- ✅ Solicita permiso Notification.requestPermission()
- ✅ Obtiene token FCM (requiere VITE_FIREBASE_VAPID_KEY)
- ✅ Guarda token en documento usuario → fcmTokens: [...]
- ✅ Escucha mensajes en foreground (app abierta)
- ✅ Service Worker recibe mensajes en background (app cerrada)

**Service Worker (firebase-messaging-sw.js):**
- ✅ Inicializa Firebase Messaging compat v9.22.0
- ✅ onBackgroundMessage: muestra Notification nativa
- ✅ Maneja notificationclick → redirige según data.url

#### ❌ Lo que FALTA:

1. **Cloud Functions para enviar notificaciones**
   - No existe función para enviar automáticamente cuando:
     - Dispositivo se desconecta
     - Se crean alertas críticas
     - Se actualizan ubicaciones
   - Actualmente solo soporta notificaciones manuales

2. **Integración de desconexiones WiFi**
   - El monitor de conexiones detecta desconexiones
   - PERO no dispara notificaciones push automáticas
   - Solo registra en logs

3. **Colección de notificaciones antigua**
   - useSystemNotifications.ts usa `avisos` (compat API)
   - Mezcla dos sistemas: legacy `avisos` + nuevo FCM
   - No hay Cloud Functions que procesen estos avisos

---

## 3. REQUISITOS PARA COMPLETAR NOTIFICACIONES

### Paso 1: Verificar VAPID Key en Firebase Console
```
1. Ir a: Firebase Console → Proyecto → Project Settings
2. Buscar: Cloud Messaging → Servidor Credentials
3. Copiar: Server API Key y Web Push Certificates
4. En tu .env.local:
   VITE_FIREBASE_VAPID_KEY=<tu-vapid-key>
```

### Paso 2: Cloud Functions para Disparo de Notificaciones
Necesitas crear en `app/functions/src/` una función como:

```typescript
// notificationTrigger.ts (EJEMPLO - no implementado aún)
export const notifyDeviceDisconnection = onDocumentWrite(
  'conexion_logs/{logId}',
  async (change, context) => {
    const log = change.after.data();
    if (log.event !== 'DISCONNECTED') return;
    
    // Obtener token FCM del dispositivo
    const userRef = admin.firestore().collection('usuarios').doc(log.authUid);
    const userDoc = await userRef.get();
    const tokens = userDoc.data()?.fcmTokens || [];
    
    // Enviar a ADMINS + SUPERADMINS
    const adminSnapshot = await admin.firestore()
      .collection('usuarios')
      .where('role', 'in', ['ADMIN', 'SUPERADMIN'])
      .get();
    
    const adminTokens = adminSnapshot.docs
      .flatMap(d => d.data().fcmTokens || []);
    
    await admin.messaging().sendMulticast({
      tokens: adminTokens,
      notification: {
        title: `⚠️ Desconexión detectada`,
        body: `${log.deviceName} desconectado a las ${new Date(log.timestamp).toLocaleTimeString('es')}`,
      },
      data: { deviceId: log.deviceId, type: 'DEVICE_DISCONNECTED' }
    });
  }
);
```

### Paso 3: Configuración del Service Worker
✅ Ya está: `firebase-messaging-sw.js` registrado en Vite

---

## 4. CHECKLIST DE CONFIGURACIÓN ACTUAL

### Conexiones WiFi
- [x] Monitor en vivo con estado de dispositivos
- [x] Vista de análisis con histórico
- [x] Heartbeat cada 60 segundos
- [x] Reglas Firestore correctas
- [x] Colecciones: conexion_estado, conexion_logs
- [x] Métricas: uptime, desconexiones, timeline

### Notificaciones
- [x] Solicitud de permiso (Notification API)
- [x] Obtención de token FCM
- [x] Service Worker para background messages
- [ ] ❌ Cloud Functions para disparo automático
- [ ] ❌ Notificaciones en desconexiones WiFi
- [ ] ❌ Integración completa FCM ↔ Connection Monitor

---

## 5. RECOMENDACIONES PRIORITARIAS

### 🟢 Priority 1: Verificar que funciona lo existente
1. Abre la app en dos dispositivos
2. Verifica que el Monitor muestra ambos como "En línea"
3. Apaga WiFi en uno → debe cambiar a "Offline" en 5 min
4. Enciende WiFi → debe volver a "En línea" en 60s

### 🟡 Priority 2: Habilitar notificaciones push
1. Verifica VAPID_KEY en Firebase Console
2. Copia la clave a `.env.local`
3. Abre app → debe pedir permiso de notificaciones
4. Acepta → debe obtener token FCM

### 🔴 Priority 3: Cloud Functions (siguiente fase)
1. Crear función para disparar notificaciones en desconexión
2. Crear función para alertas críticas
3. Conectar: conexion_logs → FCM notification

---

## 6. CÓDIGO DE CONFIGURACIÓN REQUERIDO

### .env.local (FALTA)
```
VITE_FIREBASE_VAPID_KEY=tu_vapid_key_aqui
```

### Comprobación: ¿Está configurado?
```bash
# En app/web/:
grep -r "VITE_FIREBASE_VAPID_KEY" . | grep -v node_modules
```

Si no aparece nada → **FALTA CONFIGURACIÓN**

---

## CONCLUSIÓN

✅ **Conexiones WiFi:** Sistema robusto y listo para producción
⚠️  **Notificaciones:** Infraestructura lista, pero falta Cloud Functions

**Para habilitar completamente:**
1. Configurar VAPID_KEY
2. Crear Cloud Functions que escuchen conexion_logs y envíen notificaciones FCM
3. Probar extremo a extremo
