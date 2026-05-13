# Layout, Global Search And User Push Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** maximizar la vista de estanterías en kiosko y carretillero, añadir una búsqueda global reutilizable con dropdown contextual y generar un informe puntual de usuarios activos con push configurado.

**Architecture:** la ampliación visual se resuelve desde `ShelfGrid` con un modo de pantalla completa que oculta KPIs/leyenda y reduce chrome alrededor del grid, mientras las vistas consumidoras ajustan su layout para cederle casi toda la altura disponible. La búsqueda global se implementa como un hook compartido basado en la colección `items` activa, agrupando resultados por artículo/OF y estantería para que `KioskSearchBar` pueda mostrar un dropdown reutilizable y decidir entre resaltar, informar o navegar según permisos. El informe se resuelve como script TypeScript en `app/functions/src/scripts` para reutilizar Firebase Admin y ejecutarlo tras compilar sin tocar la UI.

**Tech Stack:** React 19, TypeScript, Vite, Firebase Firestore Web SDK, Firebase Admin SDK, Tailwind CSS.

---

## File Map

- Modify: `app/web/components/kiosk/ShelfGrid.tsx`
- Modify: `app/web/components/kiosk/KioskView.tsx`
- Modify: `app/web/components/kiosk/KioskSearchBar.tsx`
- Modify: `app/web/components/carretillero/CarretilleroView.tsx`
- Modify: `app/web/components/carretillero/ShelfNavigator.tsx`
- Modify: `app/web/components/carretillero/ShelfNavigatorStatus.tsx`
- Modify: `app/web/components/admin/AdminShelfBrowser.tsx`
- Create: `app/web/hooks/useGlobalSearch.ts`
- Verify: `app/web/lib/schema/locations.ts`
- Verify: `app/web/lib/schema/shelves.ts`
- Create: `app/functions/src/scripts/generate_report.ts`
- Modify: `app/functions/package.json`

### Task 1: Añadir modo fullscreen al grid de estantería

**Files:**
- Modify: `app/web/components/kiosk/ShelfGrid.tsx`

- [ ] Añadir un prop explícito (`fullscreenMode` o `hideKPIs`) en `ShelfGridProps` y usarlo solo en el render no compacto.
- [ ] Ocultar `ShelfGridStats` y el bloque que hoy contiene barra de ocupación + `ShelfGridLegend` cuando el modo fullscreen esté activo.
- [ ] Reducir espacios verticales del grid principal (`mb-5`, `gap-3`, paddings de wrappers) para que los bloques ocupen más alto útil sin cambiar la lógica de selección/resaltado.
- [ ] Mantener intacto `compact`, `showReprocessCosts`, el colapso de secciones y los estados visuales existentes.

### Task 2: Expandir kiosko y carretillero para ceder más espacio al grid

**Files:**
- Modify: `app/web/components/kiosk/KioskView.tsx`
- Modify: `app/web/components/carretillero/CarretilleroView.tsx`
- Modify: `app/web/components/carretillero/ShelfNavigator.tsx`
- Modify: `app/web/components/carretillero/ShelfNavigatorStatus.tsx`

- [ ] En `KioskView`, convertir el contenedor del grid en una columna con `min-h-0` y `overflow-hidden`, reducir `p-4 md:p-5`, y pasar `fullscreenMode` a `ShelfGrid` cuando la estantería esté visible.
- [ ] En `ShelfNavigator`, mover búsqueda, feedback y grid dentro de una columna `flex-1 min-h-0` para evitar márgenes muertos y pasar `fullscreenMode` a `ShelfGrid`.
- [ ] En `ShelfNavigatorStatus`, eliminar el bloque de KPIs (vacíos/ocupados/artículos) o esconderlo bajo el mismo modo fullscreen, conservando solo acciones activas y mensajes de escaneo.
- [ ] En `CarretilleroView`, asegurar que la pestaña `shelves` hereda toda la altura disponible (`flex-1 min-h-0 overflow-hidden`) para que `ShelfNavigator` no quede comprimido por scrolls anidados.

### Task 3: Crear el hook reutilizable de búsqueda global

**Files:**
- Create: `app/web/hooks/useGlobalSearch.ts`
- Verify: `app/web/lib/schema/locations.ts`
- Verify: `app/web/lib/schema/shelves.ts`

- [ ] Crear un tipo de resultado local del hook con al menos `articleCode`, `orderFab`, `aggregateKey`, `shelfCode`, `positions`, `locationIds`, `matchesCurrentShelf` y `matchLabel`.
- [ ] Suscribirse a `query(collection(db, COLLECTIONS.ITEMS), where('active', '==', true))`, siguiendo el patrón de `useAnalytics`, para cargar presencias activas globales una sola vez.
- [ ] Agrupar los documentos activos por `aggregateKey + shelfCode` para que un artículo repetido en la misma estantería salga como un único resultado con varias posiciones.
- [ ] Usar `parseLocationId` para derivar posiciones legibles desde `locationIds` y exponer un filtro en memoria por artículo, OF y combinación normalizada en mayúsculas.
- [ ] Limitar el dropdown a un máximo razonable de resultados visibles (por ejemplo 8-12) y exponer también estados `loading`, `hasQuery`, `hasExactShelfMatch` y `clear`.

### Task 4: Refactorizar la barra de búsqueda para soportar dropdown global

**Files:**
- Modify: `app/web/components/kiosk/KioskSearchBar.tsx`
- Create: `app/web/hooks/useGlobalSearch.ts`

- [ ] Mantener el comportamiento actual como modo local por defecto para no romper `CalidadView` ni otros consumidores que solo necesiten resaltar posiciones de la estantería actual.
- [ ] Añadir props nuevas en `KioskSearchBar` para modo global: `global`, `currentShelfCode`, `canNavigateToShelf`, `onShelfNavigate`, `onResultSelect` y un callback opcional de aviso para resultados fuera de la estantería actual.
- [ ] En modo global, delegar la búsqueda al hook nuevo y renderizar un dropdown absoluto debajo del input con artículo, OF, estantería y posiciones, además de un estado de carga y un estado sin resultados.
- [ ] Al pulsar un resultado de la estantería actual, llamar a `onHighlight` con sus posiciones y cerrar el dropdown; al pulsar un resultado de otra estantería, navegar si hay permiso o mostrar un mensaje informativo si no lo hay.
- [ ] Mantener `debounce`, botón limpiar, accesibilidad básica (`aria-expanded`, `aria-controls`, cierre al perder foco/escape`) y texto de recuento coherente con ambos modos.

### Task 5: Conectar la búsqueda global en kiosko, carretillero y admin

**Files:**
- Modify: `app/web/components/kiosk/KioskView.tsx`
- Modify: `app/web/components/carretillero/ShelfNavigator.tsx`
- Modify: `app/web/components/admin/AdminShelfBrowser.tsx`

- [ ] En `KioskView`, activar `global` en `KioskSearchBar`, pasar `currentShelfCode={shelfCode}` y mantener el comportamiento de solo resaltar dentro de la estantería asignada; para otras estanterías, mostrar aviso sin navegación.
- [ ] En `ShelfNavigator`, activar `global`, pasar `currentShelfCode={selectedShelf}` y usar `setSelectedShelf` como `onShelfNavigate` para que carretillero cambie de pestaña y resalte el resultado seleccionado.
- [ ] En `AdminShelfBrowser`, sustituir la búsqueda local por la global usando `selectedShelf` y navegación entre tabs de estantería, manteniendo compatibles los flujos manuales de ubicar/retirar/mover.
- [ ] Al cambiar de estantería por navegación manual o por resultado global, limpiar highlights anteriores antes de aplicar los nuevos para evitar residuos visuales.
- [ ] Verificar que `CalidadView` y cualquier otro consumidor de `KioskSearchBar` siguen funcionando con el modo local por defecto sin props adicionales.

### Task 6: Generar el informe de usuarios activos y push configurado

**Files:**
- Create: `app/functions/src/scripts/generate_report.ts`
- Modify: `app/functions/package.json`

- [ ] Crear un script TypeScript ejecutable tras `npm --prefix app/functions run build` que importe `admin` desde `../firebaseAdmin` y consulte `admin.firestore().collection('users')`.
- [ ] Definir con claridad la métrica de “usuario activo” antes de contar: priorizar `active !== false` si el documento lo usa, y si no existe ese campo, contar el usuario como activo/listado para no perder registros legacy.
- [ ] Contar al menos tres cifras: total de usuarios listados, total de usuarios activos según la regla anterior y total de usuarios activos con `fcmTokens` no vacío.
- [ ] Imprimir un resumen legible en consola incluyendo, si ayuda, un desglose secundario por `role` para validar rápidamente que la cifra encaja con negocio.
- [ ] Añadir un script npm corto, por ejemplo `report:users-push`, que ejecute `npm run build && node lib/scripts/generate_report.js`.

### Task 7: Verificación funcional y técnica

**Files:**
- Verify: `app/web/package.json`
- Verify: `app/functions/package.json`

- [ ] Ejecutar `npm --prefix app/web run typecheck`.
- [ ] Ejecutar `npm --prefix app/web run build`.
- [ ] Ejecutar `npm --prefix app/functions run build`.
- [ ] Ejecutar `npm --prefix app/functions run report:users-push` y guardar en el chat las cifras devueltas.
- [ ] Verificación manual kiosko: abrir una estantería, confirmar que no aparecen KPIs del grid, buscar un artículo de la misma estantería y uno de otra para validar highlight + aviso.
- [ ] Verificación manual carretillero/admin: buscar un artículo en otra estantería, seleccionar el resultado en el dropdown y confirmar cambio de estantería + highlight correcto.

## Self-Review

- Cobertura del spec: la Fase 1 queda cubierta en las tareas 1-2; la búsqueda global de la Fase 2 queda cubierta en las tareas 3-5; el informe backend de la Fase 3 queda cubierto en la tarea 6; la verificación pedida queda centralizada en la tarea 7.
- Riesgos ya contemplados: no romper el modo local existente, agrupar duplicados de `items`, limpiar highlights al navegar entre estanterías y tratar usuarios legacy sin campo `active`.
- Sin huecos conocidos: no hace falta tocar backend productivo ni crear índices nuevos para una primera versión porque la carga global se apoya en `active == true` y filtrado en memoria.
