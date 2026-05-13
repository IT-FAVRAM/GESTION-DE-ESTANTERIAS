# Engram: Flexibilidad en Login y Acceso Directo (Kiosko/Pruebas)

**Fecha:** 2026-04-27
**Contexto:** Fase de formación y pruebas de la app WMS. El login era demasiado rígido requiriendo siempre credenciales.

## Cambios Realizados

### 1. Interfaz de Login (`LoginScreen.tsx`)
- Se ha añadido una sección de **Acceso Rápido (Pruebas)** debajo del formulario tradicional.
- Tres botones nuevos:
  - **KIOSKO:** Acceso como JEFE con sección MECANIZADO.
  - **CARRETILLA:** Acceso como CARRETILLERO.
  - **ADMIN:** Acceso como ADMINISTRADOR.
- Al pulsar, se utiliza `auth.signInAnonymously()` para mantener la integridad del sistema (que `auth.currentUser` no sea null).

### 2. Gestión de Roles (`useRoles.ts`)
- El hook ahora comprueba `localStorage` para ver si hay un `guest_role` o `guest_section`.
- Si existen, estos valores **sobreescriben** cualquier rol de Firebase. Esto permite asignar roles específicos a sesiones anónimas de prueba.

### 3. Lógica Principal (`App.tsx`)
- Se ha adaptado el listener de autenticación para permitir el modo invitado.
- La función `handleLogout` ahora limpia correctamente los datos de invitado en `localStorage` (`guest_role`, `guest_section`).
- Se crea un usuario ficticio inicial si se detecta modo invitado al cargar para evitar bloqueos por falta de sesión.

## Cómo probar
1. En la pantalla de login, pulsar cualquiera de los botones de la parte inferior.
2. La app entrará directamente con las funcionalidades del rol seleccionado.
3. Para volver al login real, simplemente pulsar "Cerrar Sesión" en el menú lateral.

## Impacto Técnico
- **Seguridad:** El modo invitado usa sesiones anónimas de Firebase, por lo que las reglas de seguridad de Firestore siguen aplicando (aunque se recomienda configurar reglas específicas para usuarios anónimos si se va a producción así).
- **Estabilidad:** Al usar un usuario anónimo real, todos los hooks que dependen de `auth.currentUser.uid` (como el sistema de mensajes o suministros) siguen funcionando sin errores de "null pointer".
