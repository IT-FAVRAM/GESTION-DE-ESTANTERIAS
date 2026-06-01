# SESIÓN IDE: Chat interno estilo Telegram + Auditoría Firebase

> **Usuarios de referencia:** ver [`usuarios-iniciales.xlsx`](./usuarios-iniciales.xlsx) en la raíz del proyecto.

---

## Contexto de la app

Sistema WMS de gestión de estanterías en nave industrial.
Stack: React + TypeScript + Vite (frontend), Firebase Firestore + Cloud Functions + Auth (backend).
Tailwind CSS para estilos.

### Roles (`lib/schema/roles.ts`)
- AUTH_ROLES (Firebase email/password): SUPERADMIN, ADMIN, JEFE_SECCION, CALIDAD
- KIOSK_ROLES (PIN numérico): CARRETILLERO, OPERARIO

### Infraestructura de notificaciones existente (`backend/src/push.ts`)
- `sendPushToUsers(userDocs, payload)` — envía FCM a array de usuarios
- `getUsersByRole(role)` — obtiene usuarios por rol desde Firestore
- `getUsersByEmails(emails)` — obtiene usuarios por emails
- `getAppConfig()` — lee `config/app` de Firestore
- Los tokens FCM se guardan en `UserDoc.fcmTokens[]` (colección `usuarios`)
- Historial de notificaciones en colección `notificationHistory`

### `UserDoc` (`lib/schema/users.ts`)
```typescript
interface UserDoc {
  email: string;
  displayName: string;
  role: UserRole;
  section?: WarehouseSection;
  additionalSections?: WarehouseSection[];
  fcmTokens: string[];
  lastLoginAt?: string;
}
```

### COLLECTIONS actuales (`lib/schema/collections.ts`)
`CONFIG, SHELVES, LOCATIONS, ITEMS, ITEM_AGGREGATES, USERS (='usuarios'), DEVICES, KIOSKS, PICKUP_QUEUE, HISTORY, CONNECTION_STATUS, CONNECTION_LOGS`

### Trabajo previo ya implementado
- Script `scripts/update-quality-emails.ts` para actualizar `qualityEmails` en `config/app`
- Script de auditoría de BD: `scripts/audit-collections.ts`
- Plan de limpieza: `docs/DATABASE_CLEANUP_PLAN.md`
- Login de CARRETILLERO por selección de nombre (Oscar / Raul) con emails ficticios internos (`oscar@carretillero.wms.local`, `raul@carretillero.wms.local`)

---

## BLOQUE 1 — AUDITORÍA FIREBASE (hacer PRIMERO, vía MCP Firebase)

Antes de tocar nada, auditar el estado real de la BD.

### 1.1 — Verificar colecciones
Listar todas las colecciones existentes en Firestore y cruzar con `COLLECTIONS.ts`.
Colecciones legacy conocidas a investigar: `estanterias`, `historial`, `configuracion`, `piezas`, `tablets`, `avisos`, `meta`.
Para cada una: ¿tiene documentos? ¿algún código las referencia aún?

### 1.2 — Verificar usuarios
Listar todos los documentos en colección `usuarios` y verificar que existen con los campos correctos (`role`, `fcmTokens`, `email`, `displayName`).
Lista completa de usuarios esperados en [`usuarios-iniciales.xlsx`](./usuarios-iniciales.xlsx). Resumen:

| Nombre          | Email                        | Rol          |
|-----------------|------------------------------|--------------|
| luis asensio    | l.asensio@favram.com         | SUPERADMIN   |
| jorge díaz      | J.diaz@favram.com            | SUPERADMIN   |
| dani soler      | d.soler@favram.com           | SUPERADMIN   |
| alberto         | a.barrientos@favram.com      | ADMIN        |
| juanma          | jm.gomez@favram.com          | ADMIN        |
| arturo          | a.aguado@favram.com          | JEFE_SECCION |
| victor          | v.torbellino@favram.com      | JEFE_SECCION |
| hector          | h.juvera@favram.com          | JEFE_SECCION |
| ivan            | i.hernandez@favram.com       | JEFE_SECCION |
| santi           | s.raboso@favram.com          | JEFE_SECCION |
| adri            | a.cuevas@favram.com          | JEFE_SECCION |
| david soler     | d.fernandez@favram.com       | JEFE_SECCION |
| juan carlos     | jc.rodriguez@favram.com      | JEFE_SECCION |
| luis gil        | l.gil@favram.com             | CALIDAD      |
| elisabetta      | e.sancetta@favram.com        | CALIDAD      |
| roberto         | r.mendieta@favram.com        | CALIDAD      |
| oscar           | oscar@carretillero.wms.local | CARRETILLERO |
| raul            | raul@carretillero.wms.local  | CARRETILLERO |

### 1.3 — Verificar `config/app`
Leer el documento `config/app` y verificar:
- `qualityEmails` contiene: `r.mendieta@favram.com`, `l.gil@favram.com`, `e.sancetta@favram.com`
- `chiefMapping` tiene todas las secciones mapeadas a emails de jefes de sección
- `jorge` (J.diaz@favram.com) está incluido en notificaciones urgentes de repasado

### 1.4 — Verificar notificaciones
- Revisar `notificationHistory`: ¿hay envíos recientes? ¿hubo fallos?
- Listar usuarios con `fcmTokens` vacío o ausente — no recibirán push
- Confirmar que los 3 usuarios de CALIDAD reciben notificaciones tras el script `update-quality-emails.ts`

### 1.5 — Informe de auditoría
Generar resumen con:
- ✅ Lo que está correcto
- ⚠️ Lo que falta o está mal configurado
- 🔧 Acciones correctivas a aplicar antes de continuar

---

## BLOQUE 2 — CHAT INTERNO ESTILO TELEGRAM

Implementar **solo después** de completar el Bloque 1 y aplicar sus correcciones.

### Participantes
- Con acceso: **ADMIN, SUPERADMIN, JEFE_SECCION, CARRETILLERO**
- Sin acceso: OPERARIO, CALIDAD

### Arquitectura Firestore

Nueva colección `chat` — añadir `CHAT: 'chat'` a `COLLECTIONS` en `lib/schema/collections.ts`.

```
// Sala general
chat/general { createdAt: Timestamp }

// Mensajes (subcolección)
chat/general/messages/{messageId} {
  text:       string
  senderId:   string      // uid Firebase
  senderName: string      // displayName
  senderRole: UserRole
  timestamp:  Timestamp   // serverTimestamp()
  readBy:     string[]    // uids que han leído
}
```

Crear `lib/schema/chat.ts` con el tipo `ChatMessage` y re-exportarlo desde `lib/schema/firestoreSchema.ts`.

### Firestore Rules
- Lectura/escritura de mensajes: rol en `[ADMIN, SUPERADMIN, JEFE_SECCION, CARRETILLERO]`
- Escritura nuevo mensaje: `senderId == request.auth.uid`
- Actualización `readBy`: solo añadir el propio uid
- Cloud Function de limpieza: conservar los últimos 200 mensajes

### Cloud Function `chatSendMessage` (`backend/src/chat.ts`)
- Recibe: `{ text: string }`
- Valida que el rol del caller está autorizado
- Escribe en `chat/general/messages` con `serverTimestamp()`
- Dispara push a todos los participantes del chat excepto al emisor
  - Usar `getUsersByRole` para los 4 roles autorizados
  - Título: nombre del emisor | Cuerpo: primeros 80 chars del texto
  - `data: { type: 'CHAT_MESSAGE', messageId }`
- Exportar en `backend/src/index.ts`

### Hook `useChat.ts` (`frontend/hooks/useChat.ts`)
```typescript
// Expone:
{
  messages:     ChatMessage[]   // últimos 60, orden cronológico
  sendMessage:  (text: string) => Promise<void>
  unreadCount:  number          // mensajes sin uid en readBy
  markAllRead:  () => void
}
```
- `onSnapshot` en `chat/general/messages`, orderBy timestamp desc, limit 60
- Enviar via Cloud Function `chatSendMessage` (no escritura directa a Firestore)

### Componente `ChatPanel.tsx` (`frontend/components/app/ChatPanel.tsx`)

Estilo visual tipo Telegram/WhatsApp:
- Panel lateral deslizante (drawer) o modal full-height en móvil
- Burbujas: mensaje propio → derecha, color primario; ajeno → izquierda, gris
- Cada mensaje muestra: avatar con inicial + nombre + badge de rol + hora
- Input fijo en la parte inferior con botón enviar
- Auto-scroll al último mensaje al abrir y al recibir nuevo
- Al abrir: llamar `markAllRead()`
- Estado vacío: "Aún no hay mensajes"
- Estado de carga con skeleton o spinner

### Integración en navegación
- Icono de chat visible solo para los 4 roles autorizados
- Badge rojo con `unreadCount` cuando hay mensajes no leídos
- Al pulsar: abre `ChatPanel`
- Componente: `frontend/components/app/ChatButton.tsx`

### Nota sobre CARRETILLERO
Oscar y Raul tienen Firebase Auth con emails ficticios internos y uid propio.
El chat funciona igual que para el resto. Verificar que su `role` en Firestore es `CARRETILLERO` para que las reglas de seguridad les den acceso.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `lib/schema/collections.ts` | Añadir `CHAT: 'chat'` |
| `lib/schema/chat.ts` | Nuevo — tipo `ChatMessage` |
| `lib/schema/firestoreSchema.ts` | Re-exportar `chat.ts` |
| `frontend/hooks/useChat.ts` | Nuevo — lógica Firestore + estado |
| `frontend/components/app/ChatPanel.tsx` | Nuevo — UI estilo Telegram |
| `frontend/components/app/ChatButton.tsx` | Nuevo — botón con badge para nav |
| `backend/src/chat.ts` | Nuevo — Cloud Function `chatSendMessage` |
| `backend/src/index.ts` | Añadir export de `chatSendMessage` |
| `firestore.rules` | Añadir reglas para colección `chat` |

### Lo que NO debe tocarse
- Lógica de roles en `domain/` y `lib/schema/roles.ts`
- Flujos de kiosco y de OPERARIO/CALIDAD
- Cloud Functions existentes (solo añadir, nunca modificar las existentes)

---

## Orden de ejecución

1. Ejecutar **Bloque 1** (auditoría MCP Firebase) → generar informe
2. Aplicar correcciones detectadas
3. Implementar **Bloque 2** (chat) partiendo de BD limpia y verificada

**No empezar el Bloque 2 sin haber revisado y aprobado el informe del Bloque 1.**
