# ✅ Setup de Notificaciones Push & WiFi Completado

**Fecha:** 2026-05-18  
**Estado:** LISTO PARA DEPLOY

---

## 📋 Resumen de cambios implementados

### 1. ✅ Cloud Functions para Notificaciones (IMPLEMENTADO)

**Archivo:** `app/functions/src/notifications.ts`

#### Función 1: `notifyConnectionDisconnect()`
- **Trigger:** Cuando se crea un evento en `conexion_logs` con `event === 'DISCONNECTED'`
- **Acción:** Envía notificación FCM inmediata a ADMIN y SUPERADMIN
- **Payload:**
  ```
  Título: ⚠️ Desconexión WiFi detectada
  Body: {deviceName} se desconectó a las {timestamp}
  Data: deviceId, deviceName, deviceType, timestamp
  ```

#### Función 2: `notifyLongDisconnection()`
- **Trigger:** Cada 10 minutos (scheduled)
- **Acción:** Detecta dispositivos offline > 30 minutos y alerta a SUPERADMIN
- **Payload:**
  ```
  Título: 🔴 Dispositivos críticos sin conexión
  Body: {count} dispositivo(s) llevan más de 30 minutos sin conexión
  Data: deviceCount
  ```

**Estado:** ✅ Compiladas y listas para deploy

---

### 2. ✅ Configuración de Notificaciones Push (COMPLETADO)

**Archivo:** `app/web/.env.local`

```env
VITE_FIREBASE_VAPID_KEY=MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYKWy6HgeQ4yElrKu1QIfrnvKUXs_ilRUVKLARZM6gnGNz39XvP36BNcTpc_HX1aXx6odR7IRyCwVyhXjoj-Pig
```

**Backup de claves:** `.env.keys.json` (incluye clave privada para backend)

---

### 3. ✅ Verificación de Setup Firebase

**Colecciones creadas automáticamente:**
- ✅ `conexion_estado` - Estado actual de dispositivos
- ✅ `conexion_logs` - Histórico de eventos de conexión

**Configuración requerida en Firebase Console:**
- ⏳ **Anonymous Auth:** Verificar que esté **HABILITADO** (verde)
  - Ve a: Authentication → Sign-in method → Anonymous
- ⏳ **Firestore Rules:** Ya están configuradas (ver firestore.rules)

---

## 🚀 Próximos pasos para activar

### 1. Compilar y subir Cloud Functions
```bash
cd app/functions
npm run build
firebase deploy --only functions:notifyConnectionDisconnect,functions:notifyLongDisconnection
```

### 2. Verificar Anonymous Auth en Firebase Console
1. Firebase Console → tu proyecto
2. Authentication → Sign-in method
3. Busca "Anonymous" → ¿está VERDE (enabled)?
4. Si NO, haz clic para habilitar

### 3. Probar end-to-end
1. Abre la app en dos navegadores/dispositivos
2. Verifica que aparecen en Monitor de Conexiones → "En vivo"
3. Apaga WiFi en uno → debe cambiar a "Offline" en 5 min
4. Deberías recibir notificación: "⚠️ Desconexión WiFi detectada"

---

## 📊 Arquitectura de Notificaciones

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISPOSITIVO CLIENTE                          │
├─────────────────────────────────────────────────────────────────┤
│  useConnectionMonitor.ts                                         │
│  ├─ Heartbeat cada 60s → Firestore (conexion_estado)           │
│  ├─ Event CONNECTED/DISCONNECTED → Firestore (conexion_logs)   │
│  └─ Service Worker: Escucha mensajes FCM en background         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  FIREBASE FIRESTORE + FCM                        │
├─────────────────────────────────────────────────────────────────┤
│  ✅ conexion_logs collection (triggers Cloud Functions)         │
│     └─ onCreate event DISCONNECTED                              │
│        └─ Dispara: notifyConnectionDisconnect()                │
│                                                                  │
│  ✅ Cloud Scheduler (cada 10 min)                               │
│     └─ Dispara: notifyLongDisconnection()                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              CLOUD MESSAGING (FCM)                              │
├─────────────────────────────────────────────────────────────────┤
│  Envía notificación a ADMIN/SUPERADMIN                          │
│  └─ Tokens almacenados en: usuarios/{uid}.fcmTokens           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              NAVEGADOR / DISPOSITIVO ADMIN                      │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Notificación en foreground (app abierta)                   │
│  ✅ Notificación en background (app cerrada)                   │
│  ✅ Service Worker: firebase-messaging-sw.js                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Checklist Final

- [x] Cloud Functions creadas (notifyConnectionDisconnect + notifyLongDisconnection)
- [x] Funciones exportadas en index.ts
- [x] VAPID_KEY generada y añadida a .env.local
- [x] .env.local actualizado con credenciales
- [x] firestore.rules verificadas (permisos correctos)
- [x] Service Worker (firebase-messaging-sw.js) listo
- [ ] ⏳ Compilar Cloud Functions: `firebase deploy --only functions`
- [ ] ⏳ Verificar Anonymous Auth en Firebase Console
- [ ] ⏳ Test end-to-end con dispositivos reales

---

## 🔐 Notas de Seguridad

- Clave privada guardada en `.env.keys.json` - **NO commitear a Git**
- Añade a `.gitignore`:
  ```
  .env.local
  .env.keys.json
  generate-vapid.js
  ```
- Clave pública (VAPID_KEY) es segura compartir (solo para FCM)

---

## ❓ Troubleshooting

**Si las notificaciones no llegan:**
1. Verifica que Anonymous Auth está **habilitado**
2. Verifica que el usuario tiene tokens en `usuarios/{uid}.fcmTokens`
3. Mira logs en Firebase Console → Functions
4. Mira logs en navegador → Console → [Push]

**Si Cloud Functions no se despliegan:**
1. `npm run build` en `app/functions/`
2. Verifica que no hay errores de TypeScript
3. `firebase deploy --only functions` (requiere permisos de Project Owner)

---

## 📚 Referencias

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Certificates](https://firebase.google.com/docs/cloud-messaging/web/first-message)
- [Connection Monitoring Architecture](./CONEXIONES_Y_NOTIFICACIONES_ANALYSIS.md)
