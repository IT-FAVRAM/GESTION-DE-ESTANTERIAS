# Corrección: Modo Kiosko, Orientación Móvil y Roles de Prueba

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que solo la tablet registrada como KIOSK en Firestore funcione en modo kiosko (horizontal forzado, auto-login OPERARIO, estanterías fijas), mientras el ordenador permite las 4 roles de prueba como acceso rápido, y el móvil se ve en vertical sin overlay de orientación.

**Architecture:** Se añade un hook `useFormFactor` que detecta `mobile | tablet | desktop` según tamaño de pantalla y capacidad táctil. Este factor guía: (1) la orientación forzada en `index.html`, (2) los botones de acceso rápido en `UnifiedLogin`, (3) la vista por defecto para OPERARIO. Se elimina el `kioskId` hardcodeado en `buildGuestSession` para que solo los dispositivos KIOSK reales (con entrada en `dispositivos`) entren en modo kiosko.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 3, Firebase, react-router-dom 7, Zustand 5

---

## Archivos a modificar/crear

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `app/web/hooks/useFormFactor.ts` | **Crear** | Detecta mobile/tablet/desktop por screen width y touch |
| `app/web/hooks/useAuth.ts:116` | **Modificar** | Eliminar `kioskId` hardcodeado en `buildGuestSession` |
| `app/web/components/auth/UnifiedLogin.tsx` | **Modificar** | Mostrar ADMIN y CALIDAD como acceso rápido en desktop |
| `app/web/AppV3.tsx` | **Modificar** | OPERARIO en desktop usa vista con selector de estantería |
| `app/web/index.html` | **Modificar** | Orientation overlay solo para tablet |

---

### Task 1: Crear hook `useFormFactor`

**Files:**
- Create: `app/web/hooks/useFormFactor.ts`

- [ ] **Step 1: Crear el hook**

```typescript
import { useState, useEffect } from 'react';

export type FormFactor = 'mobile' | 'tablet' | 'desktop';

const getFormFactor = (): FormFactor => {
  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (width < 768) return 'mobile';
  if (hasTouch && width >= 768 && width < 1200) return 'tablet';
  return 'desktop';
};

export const useFormFactor = (): FormFactor => {
  const [formFactor, setFormFactor] = useState<FormFactor>(getFormFactor);

  useEffect(() => {
    const onResize = () => setFormFactor(getFormFactor());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return formFactor;
};

export default useFormFactor;
```

- [ ] **Step 2: Verificar que el hook funciona en los 3 casos**

No hay tests específicos para hooks. Se verifica manualmente abriendo en Chrome DevTools con distintos tamaños de pantalla.

---

### Task 2: Eliminar `kioskId` hardcodeado en `buildGuestSession`

**Files:**
- Modify: `app/web/hooks/useAuth.ts:116`

- [ ] **Step 1: Reemplazar la línea del kioskId hardcodeado**

```typescript
// ANTES (línea 116):
    kioskId: role === 'OPERARIO' ? 'kiosko-mecanizado' : null,

// DESPUÉS:
    kioskId: null,
```

**Contexto:** En `loginAsGuest` (líneas 393-396) ya se preserva `state.kioskId` que proviene de la configuración real del dispositivo (`deviceConfig.kioskId`). Para auto-login de kioskos (líneas 225-231) también se sobreescribe con `deviceConfig.kioskId`. Por tanto, eliminar el hardcodeado es seguro — solo los dispositivos registrados como KIOSK en Firestore obtendrán `kioskId`.

- [ ] **Step 2: Verificar que no hay regresiones**

Buscar en el código cualquier otro lugar que dependa del `kioskId` hardcodeado `'kiosko-mecanizado'`:

```bash
rg "kiosko-mecanizado" --type ts --type tsx
```

Confirmar que solo aparece en:
- `useKiosk.ts` (fallback cuando el doc no existe en Firestore — correcto, sigue funcionando para desarrollo)
- `useAuth.ts` (solo la línea que acabamos de eliminar)

---

### Task 3: Orientation overlay solo para tablet

**Files:**
- Modify: `app/web/index.html`

- [ ] **Step 1: Modificar el script `updateOrientationOverlay` para que solo actúe en tablet**

Reemplazar el script inline (líneas 59-89) con:

```html
    <script>
      (function () {
        var isTablet = function () {
          var width = window.innerWidth;
          var hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          return hasTouch && width >= 768;
        };

        function updateOrientationOverlay() {
          var overlay = document.getElementById('orientation-overlay');
          if (!overlay) return;
          // Solo mostrar overlay en tablets (no en móviles ni ordenadores)
          if (!isTablet()) {
            overlay.style.display = 'none';
            return;
          }
          var isPortrait = window.matchMedia('(orientation: portrait)').matches;
          overlay.style.display = isPortrait ? 'flex' : 'none';
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', updateOrientationOverlay);
        } else {
          updateOrientationOverlay();
        }

        var mq = window.matchMedia('(orientation: portrait)');
        if (mq.addEventListener) {
          mq.addEventListener('change', updateOrientationOverlay);
        } else if (mq.addListener) {
          mq.addListener(updateOrientationOverlay);
        }
        window.addEventListener('resize', updateOrientationOverlay);
        window.addEventListener('orientationchange', function () {
          setTimeout(updateOrientationOverlay, 200);
        });
      })();
    </script>
```

- [ ] **Step 2: Verificar que el overlay se comporta correctamente**

Probar con DevTools:
1. Modo móvil (< 768px) en vertical → overlay NO debe aparecer
2. Modo tablet (>= 768px, touch simulado) en vertical → overlay DEBE aparecer
3. Modo escritorio (> 1200px) → overlay NO debe aparecer

---

### Task 4: UnifiedLogin — 4 roles como acceso rápido en desktop

**Files:**
- Modify: `app/web/components/auth/UnifiedLogin.tsx`

- [ ] **Step 1: Importar `useFormFactor`**

```typescript
import { useFormFactor } from '../../hooks/useFormFactor';
```

- [ ] **Step 2: Obtener formFactor en el componente**

```typescript
const UnifiedLogin: React.FC = () => {
  const { loginWithEmail, loginAsGuest, loading, error: authError } = useAuth();
  const formFactor = useFormFactor(); // <-- añadir
  ...
```

- [ ] **Step 3: Convertir ADMIN y CALIDAD en acceso rápido cuando el factor es `desktop`**

Modificar el grid de 4 tarjetas (aproximadamente líneas 123-162):

```typescript
        {/* Role Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <RoleCard 
            icon={<div className="text-4xl">🏭</div>}
            title="KIOSKO"
            description="Operario · MEC"
            color="blue"
            onClick={() => handleQuickAccess('OPERARIO', 'MECANIZADO')}
            disabled={localLoading || loading}
          />
          <RoleCard 
            icon={<div className="text-4xl">🚜</div>}
            title="CARRETILLA"
            description="Logística"
            color="amber"
            onClick={() => handleQuickAccess('CARRETILLERO')}
            disabled={localLoading || loading}
          />
          <RoleCard 
            icon={<div className="text-4xl">🛡️</div>}
            title="ADMIN"
            description={formFactor === 'desktop' ? 'Acceso rápido' : 'Con cuenta'}
            color="slate"
            onClick={() => {
              if (formFactor === 'desktop') {
                handleQuickAccess('ADMIN');
              } else {
                setEmailLoginHint('Para operar manualmente y navegar estanterias como ADMIN o SUPERADMIN entra con cuenta autorizada.');
                setShowEmailLogin(true);
              }
            }}
            disabled={localLoading || loading}
          />
          <RoleCard 
            icon={<div className="text-4xl">🔍</div>}
            title="CALIDAD"
            description={formFactor === 'desktop' ? 'Acceso rápido' : 'Con cuenta'}
            color="emerald"
            onClick={() => {
              if (formFactor === 'desktop') {
                handleQuickAccess('CALIDAD');
              } else {
                setEmailLoginHint('Para editar reprocesos, cantidades e importes entra con correo y contraseña de CALIDAD.');
                setShowEmailLogin(true);
              }
            }}
            disabled={localLoading || loading}
          />
        </div>
```

- [ ] **Step 4: Verificar que `loginAsGuest` acepta ADMIN y CALIDAD**

En `useAuth.ts:364`, actualmente `loginAsGuest` solo permite `OPERARIO` y `CARRETILLERO`:

```typescript
if (!['OPERARIO', 'CARRETILLERO'].includes(role)) {
  setState((prev) => ({
    ...prev,
    loading: false,
    error: 'Este perfil requiere acceso con cuenta autorizada.',
  }));
  return false;
}
```

**Modificar para permitir ADMIN y CALIDAD en desktop.** Cambiar la línea 364:

```typescript
// ANTES:
if (!['OPERARIO', 'CARRETILLERO'].includes(role)) {

// DESPUÉS:
if (role !== 'OPERARIO' && role !== 'CARRETILLERO' && role !== 'ADMIN' && role !== 'CALIDAD') {
```

- [ ] **Step 5: Asegurar que `buildGuestSession` funciona para ADMIN y CALIDAD**

Verificar que `buildGuestSession` (líneas 96-119) maneja ADMIN y CALIDAD:

```typescript
const displayNameByRole: Record<UserRole, string> = {
  OPERARIO: 'Operario Desarrollo',
  CARRETILLERO: 'Carretillero Desarrollo',
  JEFE_SECCION: 'Jefe Desarrollo',
  CALIDAD: 'Calidad Desarrollo',
  ADMIN: 'Admin Desarrollo',
  SUPERADMIN: 'Superadmin Desarrollo',
};
```

Ya están cubiertos. La función `resolveAssignedShelfForRole` para ADMIN devuelve `'*'` (todas las estanterías), y para CALIDAD devuelve `'CAL'`.

---

### Task 5: AppV3 — OPERARIO en desktop sin modo kiosko

**Files:**
- Modify: `app/web/AppV3.tsx`

- [ ] **Step 1: Importar `useFormFactor` y componente `AdminShelfBrowser`**

```typescript
import { useFormFactor } from './hooks/useFormFactor';
```

`AdminShelfBrowser` ya está lazy-importado.

- [ ] **Step 2: Obtener formFactor en el componente principal**

```typescript
const AppV3: React.FC = () => {
  const state = useAuth();
  const formFactor = useFormFactor(); // <-- añadir
  ...
```

- [ ] **Step 3: Modificar el bloque de OPERARIO para que en desktop use otra vista**

Reemplazar el bloque `if (role === 'OPERARIO')` (líneas 122-133) con:

```typescript
  if (role === 'OPERARIO') {
    // En desktop (ordenador), OPERARIO usa vista con selector de estanterías
    // en lugar de modo kiosko fijo
    if (formFactor === 'desktop') {
      return (
        <Suspense fallback={<AppLoadingScreen />}>
          <>
            <OfflineIndicator />
            <OfflineDebugPanel />
            <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
            <div className="flex flex-col h-dvh bg-slate-50 dark:bg-slate-950">
              <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">OPERARIO • Escritorio</h1>
                <button onClick={logout} className="text-sm text-red-500 font-bold px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Cerrar Sesión
                </button>
              </header>
              <div className="flex-1 min-h-0">
                <AdminShelfBrowser />
              </div>
            </div>
          </>
        </Suspense>
      );
    }

    // En tablet (incluyendo kiosko real) o móvil, usar KioskView normal
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <>
          <OfflineIndicator />
          <OfflineDebugPanel />
          <PushToast notification={pushNotif} onClose={() => setPushNotif(null)} />
          <KioskView />
        </>
      </Suspense>
    );
  }
```

- [ ] **Step 4: Verificar el comportamiento completo**

Comprobar la lógica de routing final en AppV3:

| Condición | Vista |
|---|---|
| `loading` | AppLoadingScreen |
| No autenticado | UnifiedLogin |
| OPERARIO + desktop | Header + AdminShelfBrowser |
| OPERARIO + tablet/mobile | KioskView |
| CARRETILLERO | CarretilleroView |
| JEFE_SECCION | ManagerInfoView / KioskView (operativo) |
| CALIDAD | CalidadView |
| ADMIN / SUPERADMIN | AdminHomeView con sub-vistas |

---

## Verificación final

- [ ] **Compilar sin errores**

```bash
cd "app/web"
npx tsc --noEmit
```

- [ ] **Ejecutar lint si existe**

```bash
cd "app/web"
# Buscar comando de lint en package.json
npm run lint 2>/dev/null || echo "No lint config"
```

- [ ] **Pruebas de regresión automatizadas**

```bash
cd "app/web"
npx vitest run 2>/dev/null || echo "No vitest config"
```

- [ ] **Prueba manual: ordenador**
  1. Abrir en navegador de escritorio (localhost:3000)
  2. Ver las 4 tarjetas de rol
  3. Click en ADMIN → debe loguear como guest ADMIN sin pedir email
  4. Click en CALIDAD → debe loguear como guest CALIDAD sin pedir email
  5. Click en OPERARIO → debe mostrar AdminShelfBrowser (no KioskView)

- [ ] **Prueba manual: móvil**
  1. Emular dispositivo móvil (< 768px) en Chrome DevTools
  2. Ver que el overlay de orientación NO aparece en vertical
  3. La app debe verse correctamente en vertical

- [ ] **Prueba manual: tablet (kiosko real)**
  1. Abrir en tablet registrada como KIOSK en Firestore
  2. Debe auto-loguear como OPERARIO
  3. Debe mostrar KioskView con las estanterías asignadas
  4. En vertical debe mostrar overlay "Gira la tablet"
