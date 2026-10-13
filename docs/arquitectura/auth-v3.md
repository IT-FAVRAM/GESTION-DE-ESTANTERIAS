# Contrato técnico: sesión y capacidades — WMS v3

**Fecha de cierre:** 2026-04-28  
**Estado:** ACTIVO

---

## Vocabulario canónico

| Término | Tipo | Descripción |
|---|---|---|
| `role` | `UserRole` | Rol del usuario: OPERARIO, CARRETILLERO, JEFE_SECCION, CALIDAD, ADMIN, SUPERADMIN |
| `section` | `WarehouseSection` | Sección física de la nave (MECANIZADO, CALIDAD, etc.) |
| `authMethod` | `'guest' \| 'email'` | Cómo se inició la sesión |
| `sessionKind` | `'kiosk' \| 'authenticated' \| 'none'` | Tipo de sesión activa |
| `assignedShelf` | `string \| null` | Estantería física asignada al dispositivo o al rol |
| `capabilities` | `SessionCapabilities` | Capacidades derivadas de rol + authMethod |

---

## Métodos de acceso

| authMethod | Descripción | Roles posibles |
|---|---|---|
| `guest` | Acceso rápido sin Firebase Auth. Sesión en localStorage. | OPERARIO, CARRETILLERO, ADMIN (solo dev) |
| `email` | Firebase Auth con email + contraseña. Perfil en Firestore. | JEFE_SECCION, CALIDAD, ADMIN, SUPERADMIN |

**Regla:** Los roles `OPERARIO` y `CARRETILLERO` siempre usan `authMethod = 'guest'` en producción.  
Los roles de oficina (`JEFE_SECCION`, `CALIDAD`, `ADMIN`, `SUPERADMIN`) usan `authMethod = 'email'`.

---

## Matriz de capacidades

| Contexto | canViewReprocessCosts | canEditReprocesses | canBrowseAllShelves | canOperateShelf |
|---|:---:|:---:|:---:|:---:|
| OPERARIO (guest) | ✗ | ✗ | ✗ | ✓ (solo assignedShelf) |
| CARRETILLERO (guest) | ✗ | ✗ | ✓ | ✓ |
| JEFE_SECCION (email) | ✗ | ✗ | ✓ | ✗ |
| CALIDAD (guest/visual) | ✗ | ✗ | ✗ (solo CAL) | ✓ (solo CAL) |
| CALIDAD (email) | ✓ | ✓ | ✗ (solo CAL) | ✓ (solo CAL) |
| ADMIN (email) | ✓ | ✓ | ✓ | ✓ |
| SUPERADMIN (email) | ✓ | ✓ | ✓ | ✓ |

---

## Storage keys

| Clave | Storage | Propósito |
|---|---|---|
| `wms_device_id` | localStorage | ID único de dispositivo (persistente) |
| `wms_guest_session` | localStorage | Sesión guest activa (JSON con rol/operario/estantería) |
| `wms_operario_session` | sessionStorage | Legacy — en retirada |

**Regla:** Al cambiar de sesión se borra `wms_guest_session` y se hace signOut de Firebase antes de iniciar la nueva sesión.

---

## Flujo de logout

1. Borrar `wms_operario_session` de sessionStorage
2. Borrar `wms_guest_session` de localStorage
3. `signOut(auth)` si hay usuario Firebase activo
4. Resetear estado en memoria → `onAuthStateChanged` disparará con `user = null` → App muestra UnifiedLogin

**Sin `window.location.reload()`**: el estado se resetea limpiamente por el callback de `onAuthStateChanged`.

---

## Fuente de verdad única

- **Tipos:** `app/web/domain/auth/authTypes.ts`
- **Storage:** `app/web/domain/auth/authStorage.ts`
- **Capacidades:** `app/web/domain/auth/authCapabilities.ts`
- **Hook:** `app/web/hooks/useAuth.ts` (fachada del dominio)

El hook legacy `useRoles.ts` y `permissionMatrix.ts` están en retirada y no deben usarse en código nuevo.
