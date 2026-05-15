# Ejemplos de Uso: Sistema Offline

## 📖 Ejemplos Prácticos

### 1. Usar búsqueda con fallback offline

**Antes (sin fallback):**
```typescript
const { results, loading } = useGlobalSearch(query, shelfCode);
```

**Ahora (con fallback):**
```typescript
const { 
  results,        // Resultados
  loading,        // Cargando
  isCached,       // ¿Datos en caché?
  cacheInfo,      // { age: number, itemCount: number }
} = useGlobalSearchWithCache(query, shelfCode);

// Mostrar indicador
{isCached && <span>📦 Datos en caché ({cacheInfo?.age.toFixed(1)}h)</span>}
```

---

### 2. Inicializar caché crítico en app

**En AppV3 o componente raíz:**

```typescript
import { useInitializeCriticalData } from './hooks/useInitializeCriticalData';

const App = () => {
  // Se ejecuta automáticamente una sola vez
  const initStatus = useInitializeCriticalData();

  if (initStatus.isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <>
      {!initStatus.itemsLoaded && <Warning>Items no cacheados</Warning>}
      {!initStatus.shelvesLoaded && <Warning>Estanterías no cacheadas</Warning>}
      {/* Tu app */}
    </>
  );
};
```

---

### 3. Monitorear estado offline

```typescript
import { useOfflineStatus } from './hooks/useOfflineStatus';

const MyComponent = () => {
  const {
    isOnline,
    isOffline,
    pendingCount,
    conflictCount,
    retryableCount,
    isSyncing,
    lastSyncAt,
    lastSyncError,
    entries,
    syncNow,
  } = useOfflineStatus();

  return (
    <>
      {isOffline && <Banner>Sin conexión</Banner>}
      {conflictCount > 0 && (
        <Button onClick={() => handleConflict()}>
          {conflictCount} conflictos
        </Button>
      )}
      <Button onClick={syncNow} disabled={isSyncing}>
        {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
      </Button>
    </>
  );
};
```

---

### 4. Auditoría de caché en componente

```typescript
import { useCacheAudit } from './hooks/useCacheAudit';

const DebugComponent = () => {
  const { report, lastUpdated } = useCacheAudit(5000); // Actualiza cada 5s

  if (!report) return null;

  return (
    <div>
      <p>Salud: {report.health}</p>
      <p>Tamaño: {report.storage.totalSizeMB.toFixed(2)}MB / 5MB</p>
      <ul>
        {report.recommendations.map((rec, i) => (
          <li key={i}>{rec}</li>
        ))}
      </ul>
    </div>
  );
};
```

---

### 5. Resolver conflicto manualmente

```typescript
import { 
  analyzeConflict, 
  shouldAutoResolve 
} from '../lib/offline/conflictResolver';
import type { OfflineQueueEntry } from '../lib/offline';

const ConflictHandler = ({ entry }: { entry: OfflineQueueEntry }) => {
  const [analysis, setAnalysis] = useState(null);

  const handleAnalyze = async () => {
    const result = await analyzeConflict(entry);
    setAnalysis(result);

    if (shouldAutoResolve(result)) {
      // Auto-resolvable
      discardOfflineEntry(entry.id);
    }
  };

  return (
    <button onClick={handleAnalyze}>
      Analizar conflicto
    </button>
  );
};
```

---

### 6. Escuchar cambios de caché en tiempo real

```typescript
import { listenForCacheUpdates } from '../lib/offline/bidirectionalSync';
import { useEffect } from 'react';

const MyComponent = () => {
  useEffect(() => {
    const unsubscribe = listenForCacheUpdates((event) => {
      console.log('Caché actualizado:', event.type, event.count);
      
      if (event.type === 'items') {
        // Items fueron actualizados, refetch si es necesario
        refetchItems();
      }
    });

    return unsubscribe;
  }, []);

  return <div>Escuchando cambios de caché...</div>;
};
```

---

### 7. Obtener estadísticas de almacenamiento

```typescript
import { 
  getStorageStats, 
  enforceStorageLimits 
} from '../lib/offline/storageManager';

const StorageMonitor = () => {
  const stats = getStorageStats();

  // Aplicar límites si es necesario
  const result = enforceStorageLimits();

  return (
    <div>
      <p>Total: {stats.totalSizeMB.toFixed(2)} MB / 5 MB</p>
      <p>Cache items: {stats.cacheItems}</p>
      <p>Queue items: {stats.queueItems}</p>
      {result.cleaned && <p>✅ Limpiado: {result.reason}</p>}
    </div>
  );
};
```

---

### 8. Generar reporte de auditoría

```typescript
import { 
  generateCacheAuditReport, 
  printCacheAuditReport 
} from '../lib/offline/cacheAudit';

const AuditButton = () => {
  const handleAudit = () => {
    const report = generateCacheAuditReport();
    
    // Imprimir en consola
    printCacheAuditReport(report);
    
    // O procesar el reporte
    if (report.health === 'critical') {
      alert('Almacenamiento crítico!');
    }
  };

  return <button onClick={handleAudit}>Ver Auditoría</button>;
};
```

---

### 9. Simular offline para testing

```typescript
import { 
  forceOfflineMode, 
  forceOnlineMode 
} from '../lib/offline/offlineManager';

const TestPanel = () => {
  return (
    <div>
      <button onClick={() => void forceOfflineMode()}>
        🔴 Simular Offline
      </button>
      <button onClick={() => void forceOnlineMode()}>
        🟢 Simular Online
      </button>
    </div>
  );
};
```

---

### 10. Usar retry strategy directamente

```typescript
import { 
  calculateBackoff, 
  shouldRetry,
  formatBackoffTime 
} from '../lib/offline/retryStrategy';

const MyRetryLogic = async (entry, attempts) => {
  // Calcular cuánto esperar
  const delayMs = calculateBackoff(attempts);
  
  // Esperar
  await new Promise(r => setTimeout(r, delayMs));
  
  // ¿Reintentar?
  if (shouldRetry(attempts)) {
    // Sí, reintentar
    console.log(`Reintentando en ${formatBackoffTime(delayMs)}`);
  } else {
    // No, marcar como conflicto
    console.log('Máximo reintentos alcanzado');
  }
};
```

---

## 🎯 Patrones Comunes

### Patrón 1: Componente que funciona offline

```typescript
const ShelfBrowser = ({ shelfCode }: Props) => {
  // 1. Búsqueda con fallback
  const { results, isCached } = useGlobalSearchWithCache(query, shelfCode);
  
  // 2. Monitor de estado
  const offline = useOfflineStatus();

  return (
    <>
      {isCached && <Badge>En caché</Badge>}
      {offline.isOffline && <Banner>Sin WiFi</Banner>}
      
      <SearchBar results={results} />
      <Items />
      
      {offline.pendingCount > 0 && (
        <Button onClick={offline.syncNow}>
          Sincronizar {offline.pendingCount} cambios
        </Button>
      )}
    </>
  );
};
```

### Patrón 2: Error handler con fallback

```typescript
const handleOperation = async (operation) => {
  try {
    // Intentar en línea
    return await inventoryApi.ubicar(operation);
  } catch (error) {
    // Si falla, encolar para offline
    if (!navigator.onLine) {
      enqueueOfflineOperation('UBICAR', operation);
      showNotification('Guardado en cola local, se sincronizará cuando haya WiFi');
    } else {
      throw error;
    }
  }
};
```

### Patrón 3: Auditoría periódica

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const report = generateCacheAuditReport();
    
    if (report.health === 'critical') {
      console.warn('⚠️ Almacenamiento crítico', report);
    }
  }, 60000); // Cada minuto

  return () => clearInterval(interval);
}, []);
```

---

## ✅ Checklist de Implementación

Al integrar en tu componente:

- [ ] Importé `useGlobalSearchWithCache` (no `useGlobalSearch`)
- [ ] Uso `useOfflineStatus()` para monitorear
- [ ] Muestro badge "📦 en caché" cuando `isCached === true`
- [ ] Tengo botón para sincronizar cuando hay pendientes
- [ ] Manejo errores con `enqueueOfflineOperation`
- [ ] Test offline: conexión simulada funciona
- [ ] Test offline: datos se sincronizan al reconectar
- [ ] Test conflicto: aparece en OfflineQueuePanel
- [ ] Auditoría: `?debug` panel muestra estado correcto
