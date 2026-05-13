# Auth Sync And Expand Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reparar el acceso rapido, el logout entre roles y la coherencia visual de los controles de expandir/contraer sin reintroducir recargas completas de pagina.

**Architecture:** la causa raiz del login rapido roto es que `useAuth()` se usa en varios componentes como estado local independiente; por eso un login guest o un logout pueden actualizar una instancia del hook pero no la que decide el routing en `AppV3`. La solucion inmediata es sincronizar todas las instancias del hook mediante un evento de sesion compartido y limpieza atomica de storage; en paralelo, los controles de expandir/contraer deben usar una convencion visual unica: colapsado apunta hacia abajo y expandido apunta hacia arriba.

**Tech Stack:** React 19, TypeScript, Vite, Firebase Auth, localStorage/sessionStorage, Tailwind CSS.

---

## File Map

- Modify: `app/web/domain/auth/authStorage.ts`
- Modify: `app/web/hooks/useAuth.ts`
- Modify: `app/web/components/kiosk/ShelfGrid.tsx`
- Verify: `app/web/components/kiosk/ShelfGridCell.tsx`
- Verify: `app/web/AppV3.tsx`
- Test: `app/web` build and manual role-switch flow

### Task 1: Broadcast de sesion compartida

**Files:**
- Modify: `app/web/domain/auth/authStorage.ts`

- [ ] **Step 1: Añadir un evento global de cambio de sesion**

```ts
export const AUTH_SESSION_CHANGED_EVENT = 'wms:auth-session-changed';

const notifyAuthSessionChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
};
```

- [ ] **Step 2: Emitir el evento al escribir o limpiar sesion**

```ts
export const clearAllSessionData = (): void => {
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.OPERARIO_SESSION);
  localStorage.removeItem(AUTH_STORAGE_KEYS.GUEST_SESSION);
  localStorage.removeItem('guest_role');
  localStorage.removeItem('guest_section');
  notifyAuthSessionChanged();
};

export const writeGuestSession = (session: unknown): void => {
  localStorage.setItem(AUTH_STORAGE_KEYS.GUEST_SESSION, JSON.stringify(session));
  localStorage.removeItem('guest_role');
  localStorage.removeItem('guest_section');
  notifyAuthSessionChanged();
};
```

- [ ] **Step 3: Verificar que no quedan claves guest legacy activas**

Run: `rg "guest_role|guest_section" app/web`
Expected: solo apariciones legacy o de limpieza controlada.

### Task 2: Sincronizar todas las instancias de `useAuth`

**Files:**
- Modify: `app/web/hooks/useAuth.ts`

- [ ] **Step 1: Extraer un estado canonico de cierre de sesion**

```ts
const buildSignedOutState = (prev: AuthState): AuthState => ({
  ...prev,
  loading: false,
  firebaseUser: null,
  role: null,
  section: null,
  operario: null,
  operarioId: null,
  displayName: '',
  email: null,
  isKioskSession: false,
  assignedShelf: null,
  authMethod: null,
  error: null,
});
```

- [ ] **Step 2: Escuchar el evento compartido y resincronizar el hook**

```ts
useEffect(() => {
  const syncGuestSession = () => {
    const session = readGuestSession<GuestSession>();
    if (session) {
      setState((prev) => ({
        ...prev,
        loading: false,
        firebaseUser: auth.currentUser,
        role: session.role,
        section: session.section || null,
        operario: session.operario,
        operarioId: session.operarioId,
        assignedShelf: session.assignedShelf || prev.assignedShelf,
        displayName: session.displayName || session.operario?.name || '',
        email: auth.currentUser?.email || null,
        isKioskSession: true,
        authMethod: 'guest',
        error: null,
      }));
      return;
    }

    if (!auth.currentUser) {
      setState((prev) => buildSignedOutState(prev));
    }
  };

  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncGuestSession);
  window.addEventListener('storage', syncGuestSession);
  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncGuestSession);
    window.removeEventListener('storage', syncGuestSession);
  };
}, []);
```

- [ ] **Step 3: Limpiar sesion previa antes de login guest o email**

```ts
clearAllSessionData();
try {
  await signOut(auth);
} catch {
  // no-op if there is no Firebase session
}
```

- [ ] **Step 4: Reusar el estado canonico al hacer logout**

```ts
const logout = useCallback(async () => {
  clearAllSessionData();
  try {
    await signOut(auth);
  } catch {}
  setState((prev) => buildSignedOutState(prev));
}, []);
```

- [ ] **Step 5: Validar el flujo manual completo**

Run manually:
- entrar con `CALIDAD` acceso rapido
- pulsar `Salir`
- entrar con `ADMIN`
- salir y entrar con `KIOSKO`

Expected: el router principal cambia de vista sin recarga completa y sin quedarse bloqueado en la sesion anterior.

### Task 3: Corregir la semantica visual de expandir/contraer

**Files:**
- Modify: `app/web/components/kiosk/ShelfGrid.tsx`
- Verify: `app/web/components/kiosk/ShelfGridCell.tsx`

- [ ] **Step 1: Unificar la direccion del chevron de bloque**

```tsx
className={`w-4 h-4 shrink-0 transition-transform duration-200 text-slate-500 ${collapsed ? '' : 'rotate-180'}`}
```

- [ ] **Step 2: Mantener la misma convencion en celdas**

```tsx
aria-label={isOpen ? 'Contraer' : 'Expandir'}
className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
```

- [ ] **Step 3: Verificacion visual**

Manual:
- bloque cerrado -> flecha abajo
- bloque abierto -> flecha arriba
- celda cerrada -> flecha abajo
- celda abierta -> flecha arriba

### Task 4: Verificacion final

**Files:**
- Verify: `app/web/package.json`

- [ ] **Step 1: Ejecutar build completa**

Run: `npm --prefix app/web run build`
Expected: exit code 0.

- [ ] **Step 2: Revisar que no haya errores de compilacion ni auth**

Expected:
- sin errores TypeScript
- sin errores de bundle
- el warning restante de chunk grande no bloquea el arreglo funcional

- [ ] **Step 3: Comprobacion funcional final**

Checklist:
- login rapido entra al primer clic
- logout vuelve a login
- tras logout se puede entrar con otro rol
- `CALIDAD` acceso rapido no queda enganchado
- los chevrons coinciden con la accion mostrada

## Self-review

- Cubre los dos fallos reportados: acceso rapido/logout y expandir/contraer.
- No deja placeholders.
- Los archivos afectados son exactos y minimos para el fix inmediato.
