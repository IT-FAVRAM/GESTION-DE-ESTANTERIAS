# Auditoría de Rendimiento — Gestor de Estanterías (WMS)
**Objetivo:** app extremadamente rápida SIN cambiar funcionamiento. · 2026-06-23

---

## 0. Método
Auditoría basada en datos reales del build (`vite build`) y del código, no en suposiciones. Se midió el tamaño de cada chunk antes/después de cada cambio. Stack: React 19 + Vite 6 + Firebase 12 + Tailwind 3.

---

## 1. Resumen ejecutivo — qué se IMPLEMENTÓ (seguro, sin tocar funcionamiento)

| # | Optimización | Antes | Después | Impacto |
|---|--------------|-------|---------|---------|
| 1 | **Split de vendor (`manualChunks`)** | `index.js` monolítico **1.013 kB** (259 kB gz) | `index.js` **111 kB** (31 kB gz) + `vendor-firebase` 670 kB + `vendor-react` 231 kB | En cada deploy se redescarga **solo 111 kB** en vez de 1 MB. Firebase/React quedan **cacheados entre versiones**. ~88% menos descarga al actualizar. |
| 2 | **Lazy-load de `exceljs`** | `SuperAdminPanel` **1.027 kB** (293 kB gz) | `SuperAdminPanel` **85 kB** (22 kB gz); exceljs (944 kB) en chunk aparte que solo carga **al exportar** | Panel admin **92% más ligero** al abrir. |
| 3 | **Lazy-load escáneres QR** (`CameraQRScanner`, `QRScanner`) | html5-qrcode cargaba **con el área de estanterías** (ruta del operario/kiosko) | Se cargan solo al abrir la cámara | Operarios ya **no descargan html5-qrcode** de inicio. |
| 4 | **Paralelizar N+1 de arranque** (`useInitializeCriticalData`) | Descarga de `locations` **secuencial** estantería por estantería (N viajes encadenados) | `Promise.all` — N descargas **en paralelo** | Arranque de sesión mucho más rápido (de O(N) viajes a O(1) en latencia). |

> **Nota honesta:** en la **primera visita absoluta** (caché vacía) el total descargado es similar; las ganancias reales son: (a) **revisitas y post-deploy** muchísimo más rápidas por caché de vendor, (b) **cada ruta** carga solo lo suyo (admin no arrastra exceljs, operario no arrastra OCR/QR), y (c) **arranque** sin el N+1.

---

## 2. Detalle de los cambios

### 2.1 `manualChunks` (vite.config.ts) — el cambio de mayor impacto
**Problema:** no había estrategia de chunking; firebase (~670 kB) + react (~231 kB) + todo el código de la app vivían en un único `index.js` de 1 MB. Cualquier cambio de una línea de la app invalidaba la caché del navegador de TODO (incluido firebase, que casi nunca cambia).
**Solución:** `vendor-firebase` y `vendor-react` en chunks propios y estables. Solo se reasignan librerías que cargan SIEMPRE de inicio; las pesadas dinámicas (exceljs, tesseract, html5-qrcode) se dejan a Rollup para **no romper su lazy-loading**.

### 2.2 Lazy `exceljs` (ProfessionalInventoryExport, InventoryReport)
`import ExcelJS from 'exceljs'` (estático) → loader dinámico cacheado `await import('exceljs')` dentro de las funciones de exportar/importar. exceljs (944 kB / 272 kB gz) solo se descarga cuando el admin pulsa Exportar.

### 2.3 Lazy escáneres (OperativeShelfArea)
`CameraQRScanner` y `QRScanner` pasan de import estático a `React.lazy` + `Suspense` (igual que ya estaba `CameraOCRScanner`). Solo se cargan al abrir la cámara/escáner.

### 2.4 N+1 en arranque (useInitializeCriticalData)
El precaché descargaba todas las estanterías y luego, en bucle `await`, las `locations` de cada una (secuencial). Ahora `Promise.all` paraleliza las descargas por estantería. Mismo resultado, mucha menos latencia acumulada.

---

## 3. Pendiente / recomendado (NO implementado — requiere decisión o más riesgo)

| Prioridad | Hallazgo | Acción propuesta | Riesgo |
|-----------|----------|------------------|--------|
| 🟡 Media | **`CarretilleroPicker` 400 kB** = html5-qrcode, arrastrado por `ShelfNavigator` (import estático de `CameraQRScanner`). | Hacer lazy también en `ShelfNavigator` (carros). | Bajo |
| 🟡 Media | **`build.target: 'es2015'`** fuerza transpilación/polyfills extra. Las tablets son Android modernas. | Subir a `es2020` → bundle más pequeño y rápido. | Bajo-medio (verificar dispositivos antiguos) |
| 🟡 Media | **Doble caché de datos**: `useInitializeCriticalData` vuelca todos los items+locations a `localStorage` con `JSON.stringify` síncrono (bloquea el hilo principal en el arranque) **además** de la persistencia IndexedDB de Firestore ya activada (`persistentLocalCache`). | Evaluar si el localStorage manual es redundante; si lo es, eliminarlo o mover a IndexedDB/worker. | Medio (toca offline) |
| 🟢 Baja | **`useShelf.ts` tiene 13 listeners `onSnapshot`.** | Revisar si pueden consolidarse o si alguno puede ser one-shot (`getDocs`). | Medio |
| 🟢 Baja | **Baja memoización** (solo 5 `React.memo` en toda la app). Grids de 160+ celdas (`ShelfGrid`, `ChaperoGrid`) re-renderizan en cascada. | `React.memo` en celdas + `useCallback` en handlers de celda. | Bajo |
| 🟢 Baja | **`index.css` 137 kB** (20 kB gz) — Tailwind con purga, pero revisable. | Confirmar `content` de tailwind cubre y no infla. | Bajo |

---

## 4. Estado de los chunks tras la optimización

```
exceljs.min          944 kB  (lazy — solo al exportar Excel)
vendor-firebase      671 kB  (estable, cacheado entre deploys)
CarretilleroPicker   400 kB  (lazy — html5-qrcode; ver §3)
vendor-react         231 kB  (estable, cacheado entre deploys)
index                111 kB  ← código de app (lo único que cambia por deploy)
OperativeActionBtns  108 kB  (shell operativo compartido)
SuperAdminPanel       85 kB  (lazy — antes 1.027 kB)
ShelfGrid             55 kB
CameraOCRScanner      34 kB  (lazy — tesseract)
```

---

## 5. Verificación
- `tsc --noEmit` ✅ · `vite build` ✅ en cada paso.
- Sin cambios de comportamiento: mismas funciones, mismos datos, misma UI. Solo cambia **cuándo** y **en qué chunk** se carga el código.
