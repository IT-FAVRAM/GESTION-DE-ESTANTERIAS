---
name: roles-matrix
description: Matriz de roles, permisos y flujos del WMS
metadata:
  type: reference
---

# Roles & Permisos del WMS

## Matriz de Roles

| Rol | Auth | Acceso | Puede Ubicar | Puede Retirar | Acceso Shelves | Reprocess Costs |
|-----|------|--------|--------------|---------------|----------------|-----------------|
| **OPERARIO** | Kiosk (ID) | Estantería asignada | ✅ | ✅ (PRE/MEC) | Solo asignada | ❌ |
| **CARRETILLERO** | Kiosk (ID) | Todas (compras) | ✅ | ✅ | Todas | ❌ |
| **CALIDAD** | Email + Pwd | CAL-001 a CAL-022 | ✅ | ✅ | Solo CAL | ✅ (Email only) |
| **JEFE_SECCION** | Email + Pwd | Sección asignada | ✅ | ✅ | Su sección | ❌ |
| **ADMIN** | Email + Pwd | Todas | ✅ | ✅ | Todas | ✅ |
| **SUPERADMIN** | Email + Pwd | Todas | ✅ | ✅ | Todas | ✅ |

---

## Autenticación

### KIOSK_ROLES (ID numérico)
- **OPERARIO**, **CARRETILLERO**
- Login: número de empleado en kiosk
- Sesión: localStorage (recordar sesión posible)
- Permisos: Basados en `assignedShelf` del usuario

### AUTH_ROLES (Firebase Auth)
- **JEFE_SECCION**, **CALIDAD**, **ADMIN**, **SUPERADMIN**
- Login: email + password
- Sesión: Firebase Auth token
- Permisos: Basados en rol + `assignedShelf` (opcional)

---

## Permisos Detallados por Flujo

### 📍 UBICAR (colocar artículos en estantería)
- ✅ OPERARIO: Su estantería asignada (PRE/MEC)
- ✅ CARRETILLERO: Cualquier estantería
- ✅ CALIDAD: Solo CAL (reprocesos)
- ✅ JEFE_SECCION: Su sección
- ✅ ADMIN/SUPERADMIN: Todas

### 🎯 RETIRAR (quitar artículos de estantería)
- ✅ OPERARIO: Su estantería (PRE/MEC)
- ✅ CARRETILLERO: Todas
- ✅ CALIDAD: Solo CAL
- ✅ JEFE_SECCION: Su sección
- ✅ ADMIN/SUPERADMIN: Todas

### 💰 Ver Costos de Reprocesos
- ✅ CALIDAD (solo si auth=email)
- ✅ ADMIN/SUPERADMIN

### 📊 Editar Reprocesos
- ✅ CALIDAD (solo si auth=email)
- ✅ ADMIN/SUPERADMIN

### 🏢 Navegar por Estantería
- ✅ CARRETILLERO: Todas (compras/entregas)
- ✅ JEFE_SECCION: Su sección
- ✅ ADMIN/SUPERADMIN: Todas
- ❌ OPERARIO: Solo si es carretillero asignado

---

## Datos Visibles por Rol

### OPERARIO
- Estantería asignada solamente
- Artículos de su ubicación
- Estado de operaciones (ubicación actual)

### CARRETILLERO
- Todas las estanterías + almacén
- Carros de compras/entregas
- Rutas de navegación entre secciones

### CALIDAD
- Shelves CAL-001 a CAL-022 (reprocesos)
- Costos EUR e importe
- Alertas urgentes

### JEFE_SECCION
- Su sección (ej: PLEGADORA)
- Artículos de su sección
- Dashboard operacional

### ADMIN
- Todas las estanterías + config
- Usuarios, dispositivos, kiosks
- Alertas urgentes, chat
- Excel export/import

### SUPERADMIN
- Todo (incluye cambios en Firestore rules, usuarios, config)

---

## Ubicaciones Especiales

### PRE (Prensas - Mecanizado)
- **Zonas**: URG MEC-PRE (compartida), PRENSAS (1-9), MECANIZADO (14-46)
- **Acceso**: OPERARIO (PRE), CARRETILLERO, ADMIN
- **Nota**: URG MEC-PRE es zona compartida entre MEC y PRE

### MEC (Mecanizado)
- **Zonas**: URG MEC-PRE (compartida), MECANIZADO zona
- **Acceso**: OPERARIO (MEC), CARRETILLERO, ADMIN

### CAL (Calidad - Reprocesos)
- **Ubicaciones**: CAL-001 a CAL-022
- **Acceso**: CALIDAD, ADMIN
- **Especial**: Requiere EUR/pzas para ciertos reprocesos

---

## Casos Especiales

### Juanma (ADMIN + JEFE_SECCION)
- Email: juanma.soler@..
- Roles: ADMIN, asignado a sección PLEGADORA
- Comportamiento: ADMIN accede a todo (section opcional para filtro UI)

### CALIDAD + FCM Notifications
- Solo si auth=email recibe notificaciones de costos/reprocesos
- Accede a `conversations/` privadas (chat interno)

---

## Flujos de Autenticación

```
KIOSK FLOW (OPERARIO, CARRETILLERO)
  1. Ingresa número de empleado
  2. Valida en collection usuarios
  3. Carga assignedShelf + role
  4. Almacena en localStorage
  5. Redirige a kiosk/[role]

AUTH FLOW (CALIDAD, JEFE_SECCION, ADMIN, SUPERADMIN)
  1. Ingresa email + password
  2. Firebase Auth login
  3. Carga doc from usuarios collection
  4. Valida role + assignedShelf
  5. Carga capabilities via resolveCapabilities()
  6. Redirige a [role]/dashboard
```
