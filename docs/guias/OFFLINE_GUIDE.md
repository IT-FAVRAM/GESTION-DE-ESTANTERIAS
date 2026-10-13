# Guía Completa: Sistema Offline WMS v3.0

## 📋 Resumen de Implementación

Se ha implementado un sistema **offline-first** robusto que funciona correctamente incluso sin conexión WiFi. El sistema incluye:

1. **Persistencia de Firestore** — Datos cacheados localmente en IndexedDB
2. **Cola offline** — Guarda operaciones si no hay conexión, las sincroniza cuando vuelve
3. **Retry exponencial** — Reintentos inteligentes con backoff y jitter
4. **Resolución automática de conflictos** — Detecta y resuelve automáticamente muchos conflictos
5. **Caché proactivo** — Precarga datos críticos para funcionamiento offline
6. **Búsqueda con fallback** — Búsquedas funcionan offline con datos cacheados
7. **Sincronización bidireccional** — Actualiza caché cuando hay cambios remotos
8. **Auditoría de almacenamiento** — Monitorea y limpia automáticamente
9. **UI mejorada** — Indicadores visuales claros del estado offline
10. **Panel de debug** — Herramienta de desarrollo para testing offline

---

## 🚀 Características Implementadas

### 1. **Retry Exponencial Inteligente**

**Archivo:** `lib/offline/retryStrategy.ts`

- Implementa backoff exponencial: 1s → 2s → 4s → 8s → 16s (máx 30s)
- Añade jitter (±20%) para evitar "thundering herd"
- Máximo 5 intentos antes de marcar como conflicto
- Detecta automáticamente errores transitorios vs permanentes

**Uso automático en:** `offlineQueue.drainOfflineQueue()`

### 2. **Resolución Automática de Conflictos**

**Archivo:** `lib/offline/conflictResolver.ts`

Analiza conflictos comparando estado offline vs servidor:

```
UBICAR: ✅ Resuelto si el artículo ya está en la posición
RETIRAR: ✅ Resuelto si el artículo ya fue retirado
RETIRAR_DE_UBICACION: ✅ Resuelto si la ubicación está vacía
MOVER: ✅ Resuelto si el artículo está en destino
```

**Cómo usa:**
- Usuario ve error de sincronización
- Botón "Analizar automáticamente" en OfflineQueuePanel
- Se compara estado del servidor
- Si es reversible, se resuelve automáticamente ✅
- Si no, se muestra recomendación de acción

### 3. **Caché Proactivo de Datos Críticos**

**Archivo:** `hooks/useInitializeCriticalData.ts`

Se ejecuta automáticamente al iniciar la app:

```typescript
// En AppV3.tsx
const initStatus = useInitializeCriticalData();
```

Precachea en primer plano:
- 📦 Items activos
- 📚 Estanterías
- ⚙️ Configuración
- 📍 Ubicaciones

**Beneficio:** Primera carga sin WiFi = datos disponibles localmente

### 4. **Búsqueda Global con Fallback**

**Archivo:** `hooks/useGlobalSearchWithCache.ts`

Funciona en dos modos:

```typescript
// Modo 1: Con WiFi
→ Datos en tiempo real desde Firestore

// Modo 2: Sin WiFi (fallback)
→ Datos desde localStorage
→ Muestra badge "📦 Datos en caché"
```

**Integrado en:** `components/kiosk/KioskSearchBar.tsx`

### 5. **Sincronización Bidireccional**

**Archivo:** `lib/offline/bidirectionalSync.ts`

Mientras la app está abierta:
- Escucha cambios en el servidor
- Actualiza caché local automáticamente
- Dispara eventos para que componentes se refresque

```typescript
// Los componentes pueden escuchar actualizaciones
listenForCacheUpdates((event) => {
  if (event.type === 'items') {
    // Items fueron actualizados desde servidor
    refetch();
  }
});
```

### 6. **Gestión de Almacenamiento**

**Archivo:** `lib/offline/storageManager.ts`

**Límites automáticos:**
- Máximo 5 MB de localStorage
- Máximo 100 operaciones en cola
- Limpia cache con >7 días antigüedad
- Enforza al sincronizar

**API:**
```typescript
getStorageStats()        // Estadísticas de almacenamiento
enforceStorageLimits()   // Aplica límites
clearOldCacheEntries(7)  // Limpia cache antiguo
getCacheInfo(key)        // Info de un caché
```

### 7. **Auditoría de Caché**

**Archivo:** `lib/offline/cacheAudit.ts`

Diagnóstico completo del estado offline:

```typescript
const audit = generateCacheAuditReport();
// Retorna:
{
  health: 'good' | 'warning' | 'critical',
  recommendations: string[],
  storage: { totalSizeMB, cacheItems, queueItems, ... },
  queue: { pendingCount, conflictCount, ... },
  caches: { items, shelves, config, locations }
}

printCacheAuditReport(audit); // Imprime en consola
```

---

## 🎮 UI / Componentes Mejorados

### OfflineIndicator (Banner superior)

Muestra estado en tiempo real:

```
⚠️ Sin conexión — 3 cambio(s) en cola local
🔴 1 conflicto(s) pendiente — revisar manualmente
⚠️ 2 cambio(s) listos para reintento
🔄 Sincronizando 4 cambio(s)...
✅ Conexión recuperada — datos sincronizados
```

Clickea "Ver centro offline" → **OfflineQueuePanel**

### OfflineQueuePanel (Panel lateral completo)

**Dos pestañas:**

#### 1️⃣ **Cola**
- Operaciones pendientes, reintentos, conflictos
- Botones: Sincronizar, Reintentar, Reponer, Descartar
- **Análisis automático** de conflictos: `Analizar automáticamente`
  - Compara estado con servidor
  - Si es resolvible: ✅ auto-resuelve
  - Si no: muestra recomendación

#### 2️⃣ **Auditoría**
- Almacenamiento: tamaño, caché, antigüedad
- Estado general: ✅ good / ⚠️ warning / 🔴 critical
- Recomendaciones automáticas
- Cachés disponibles: items, estanterías, config, ubicaciones

### KioskSearchBar (Búsqueda mejorada)

Ahora muestra:
```
Buscar por artículo o OF...
📦 Búsqueda en caché (2.5h)  ← Badge cuando está en caché
```

### OfflineDebugPanel (Solo desarrollo)

**Acceso:** Añade `?debug` a la URL

```
localhost:5173?debug
```

Muestra:
- Simular offline/online
- Estado de sincronización
- Auditoría en tiempo real
- Botones de acción rápida
- Enlace a ver auditoría en consola

---

## 🧪 Testing Offline

### Método 1: OfflineDebugPanel

```
1. Abre la app con ?debug en URL
2. Haz click en "🔧 Offline Debug"
3. Botón "Forzar Offline"
4. Realiza operaciones
5. Botón "Forzar Online"
6. Verifica "Sincronizar Ahora"
```

### Método 2: DevTools del navegador

```
F12 → Network → Offline
```

### Método 3: Desconectar WiFi real

La forma más realista de testing.

---

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────────────────┐
│ Usuario abre app                             │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ useInitializeCriticalData                   │
│ - Precachea items, shelves, config          │
│ - Inicia sincronización bidireccional       │
└──────────────┬──────────────────────────────┘
               │
         ┌─────┴──────┐
         │            │
        ▼            ▼
    ┌──────────┐  ┌──────────┐
    │ Online   │  │ Offline  │
    └────┬─────┘  └────┬─────┘
         │             │
    Con WiFi       Sin WiFi
         │             │
         │             ├─→ Usa caché local
         │             ├─→ Cola offline guarda
         │             ├─→ Búsqueda en caché
         │             └─→ UI indica estado
         │
    Recupera WiFi (evento 'online')
         │
         ▼
    ┌─────────────────────┐
    │ drainOfflineQueue   │
    │ - Aplica retry      │
    │ - Resuelve conflictos│
    │ - Sincroniza        │
    └──────────┬──────────┘
               │
         ┌─────┴────────┐
         │              │
        ▼              ▼
    ✅ OK         ⚠️ CONFLICTO
    Eliminado    Cola espera
    de cola      revisión
```

---

## ⚙️ Configuración

### Límites (editable en `storageManager.ts`)

```typescript
const MAX_QUEUE_SIZE = 100;              // Operaciones máximo
const MAX_CACHE_AGE_DAYS = 7;            // Antigüedad máxima caché
const MAX_CACHE_SIZE_MB = 5;             // Tamaño máximo localStorage
```

### Reintentos (editable en `retryStrategy.ts`)

```typescript
maxAttempts: 5,              // Máximo reintentos
initialDelayMs: 1000,        // Espera inicial (1s)
maxDelayMs: 30000,           // Espera máxima (30s)
jitterFactor: 0.2            // Jitter ±20%
```

### Sincronización (editable en `bidirectionalSync.ts`)

```typescript
startBidirectionalSync()  // Inicia escucha de cambios
stopBidirectionalSync()   // Para escucha
```

---

## 🔍 Debugging

### En Consola

```javascript
// Ver auditoría completa
generateCacheAuditReport().then(r => printCacheAuditReport(r))

// Ver estadísticas de almacenamiento
getStorageStats()

// Ver cola offline
getOfflineQueueEntries()

// Simular error de red
navigator.onLine === false

// Forzar sincronización
drainOfflineQueue()
```

### Con OfflineDebugPanel

```
URL: http://localhost:5173?debug

Botones:
- Forzar Offline / Forzar Online
- Sincronizar Ahora
- Limpiar todo y recargar
- Ver en consola (auditoría)
```

---

## 📈 Casos de Uso Probados

### ✅ Caso 1: Operario sin WiFi primera carga

```
1. Operario entra en almacén sin WiFi
2. Abre app
3. ✅ Ve su estantería (datos precacheados)
4. ✅ Busca artículos (búsqueda en caché)
5. Realiza UBICAR/RETIRAR (guardados en cola)
6. Se conecta a WiFi
7. ✅ Operaciones se sincronizan automáticamente
```

### ✅ Caso 2: Conflicto de artículo retirado

```
1. Usuario offline: RETIRAR artículo XYZ de PLE-001
2. Otro usuario online RETIRA el mismo artículo
3. Usuario 1 se conecta → conflicto detectado
4. Sistema analiza → "Artículo ya fue retirado"
5. ✅ Se resuelve automáticamente
6. Usuario 1 no ve el conflicto (fue resuelto)
```

### ✅ Caso 3: Conflicto real (revisión manual)

```
1. Usuario offline: UBICAR artículo ABC
2. Admin mueve ubicación de PLE a PLI (cambios en config)
3. Usuario intenta sincronizar
4. Sistema detecta: "Posición destino cambió"
5. ⚠️ Marca como CONFLICTO (no es auto-resolvible)
6. Usuario abre panel → "Ver análisis"
7. ✅ Elige: Reintentar / Reponer / Descartar
```

---

## 🎯 Checklist: ¿Está todo funcionando?

- [ ] OfflineIndicator muestra estado
- [ ] OfflineQueuePanel accesible via "Ver centro offline"
- [ ] Sin WiFi: búsquedas muestran badge "📦 Datos en caché"
- [ ] Sin WiFi: operaciones se guardan en cola
- [ ] Con WiFi: cola se sincroniza automáticamente
- [ ] Conflictos muestran botón "Analizar automáticamente"
- [ ] OfflineDebugPanel funciona con `?debug` en URL
- [ ] Auditoría en console muestra estado correcto
- [ ] Almacenamiento se limpia si >5MB
- [ ] Cache antiguo se descarta automáticamente

---

## 🛠️ Archivos Creados/Modificados

### Nuevos Archivos

```
lib/offline/
  ├── retryStrategy.ts          (retry exponencial)
  ├── conflictResolver.ts       (análisis de conflictos)
  ├── storageManager.ts         (gestión de almacenamiento)
  ├── bidirectionalSync.ts      (sincronización bidireccional)
  └── cacheAudit.ts             (auditoría de caché)

hooks/
  ├── useGlobalSearchWithCache.ts    (búsqueda con fallback)
  ├── useInitializeCriticalData.ts   (precaché)
  └── useCacheAudit.ts               (auditoría en hook)

components/common/
  ├── OfflineDebugPanel.tsx      (panel de debug)
  └── OfflineQueuePanel.tsx      (panel mejorado)
```

### Modificados

```
lib/offline/
  ├── offlineQueue.ts            (integró retry + conflict resolution)
  ├── offlineManager.ts          (arreglé import de firebase)
  └── index.ts                   (exporta nuevos módulos)

hooks/
  └── useOfflineStatus.ts        (sin cambios, aún funciona)

components/
  ├── common/OfflineIndicator.tsx    (UI mejorada)
  ├── kiosk/KioskSearchBar.tsx       (usa useGlobalSearchWithCache)
  └── AppV3.tsx                      (añadió init + debug panel)
```

---

## 🚀 Próximas Mejoras (Opcional)

- [ ] Caché de búsquedas históricas
- [ ] Compresión GZIP de localStorage
- [ ] Worker para sincronización en background
- [ ] Visualización de conflictos por tipo
- [ ] Exportar/importar caché para migraciones
- [ ] Analytics de uso offline
- [ ] Notificaciones push al completar sincronización

---

## 📞 Soporte

¿Problema offline? Usa OfflineDebugPanel:

```
?debug → 🔧 Offline Debug → Ver en consola
```

Reporta en consola:
```javascript
generateCacheAuditReport()
getOfflineQueueEntries()
getStorageStats()
```

---

**Implementado:** 2026-05-15  
**Versión:** WMS v3.0  
**Estado:** ✅ CRÍTICO + ALTO + MEDIO completados
