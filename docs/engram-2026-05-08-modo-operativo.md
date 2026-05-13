# Engram: Modo Operativo para Admin y Jefes

## Fecha
8 de mayo de 2026

## Descripción General
Se ha implementado una nueva funcionalidad que permite a los usuarios con roles de `ADMIN`, `SUPERADMIN` o `JEFE_SECCION` acceder a un "Modo Operativo" directamente desde sus paneles. Este modo reutiliza la vista de `CarretilleroView` (optimizada para uso móvil y escaneo de etiquetas) y permite a los gestores ubicar, retirar y escanear de manera ágil sin necesidad de cambiar temporalmente su rol.

## Cambios Implementados
1. **Reutilización de `CarretilleroView`:**
   - Se añadió la propiedad opcional `onBack` a `CarretilleroViewProps` en `app/web/components/carretillero/CarretilleroView.tsx`.
   - Se actualizó el botón de la cabecera: si se provee `onBack`, muestra "Volver" y ejecuta dicha función; de lo contrario, muestra "Salir" y cierra la sesión.

2. **Gestión de Estado en el Enrutador (`AppV3.tsx`):**
   - Se introdujo el estado `showOperativeMode`.
   - Se añadieron condicionales para renderizar `CarretilleroView` cuando este estado es verdadero para los roles `JEFE_SECCION` y `ADMIN/SUPERADMIN`.
   - Se pasó la propiedad `onOpenOperativeMode` a los componentes `ManagerInfoView` y `AdminHomeView`.

3. **Mejoras en el Panel de Jefe de Sección (`ManagerInfoView.tsx`):**
   - Se añadió la propiedad `onOpenOperativeMode`.
   - Se reemplazó el texto estático de "Sin Acceso Operativo" por un gran botón interactivo de "📸 MODO OPERATIVO (Escanear)" para la operativa móvil en terreno.

4. **Mejoras en el Panel de Administración (`AdminHomeView.tsx`):**
   - Se añadió la propiedad `onOpenOperativeMode`.
   - Se incluyó una nueva tarjeta destacada en el "dashboard" titulada "Modo Operativo", la cual activa el acceso a la vista de escáner.

## Verificación
- El compilador de TypeScript (`npx tsc --noEmit`) se ejecutó exitosamente.
- La navegación fue validada lógicamente para prevenir problemas de cierres de sesión no intencionados.