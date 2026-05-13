# Plan de reestructuracion tecnica: login, calidad y limpieza de consola

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** unificar la autenticacion, restringir correctamente el acceso de CALIDAD, ocultar el importe de reprocesos fuera del acceso autenticado de calidad y eliminar avisos de consola evitables sin tocar aun la implementacion.

**Architecture:** la app debe pasar de un acceso fragmentado (guest/email/legacy) a un nucleo unico de sesion con una sola fuente de verdad para rol, seccion, tipo de acceso y capacidades. La UI debe dejar de decidir permisos por checks locales y consumir capacidades centralizadas, separando ademas vistas operativas, vistas de calidad y visuales read-only. La deuda legacy debe aislarse para que la v3 no siga compartiendo tipos, storage keys ni componentes de entrada incompatibles.

**Tech Stack:** Vite, React 19, TypeScript, Firebase Auth, Firestore Web SDK v12, Tailwind CSS 3, Zustand (disponible), Cloud Functions/Firebase rules.

---

## 1. Diagnostico consolidado

### Problemas funcionales detectados

- `app/web/index.html:9` sigue cargando `https://cdn.tailwindcss.com` aunque `tailwindcss`, `postcss` y `autoprefixer` ya existen en `app/web/package.json:25`; esto genera el warning de produccion y deja el estilo fuera del pipeline de build.
- `app/web/index.tsx:13` monta React en `StrictMode`; el mensaje de React DevTools procede del bundle de desarrollo y no debe intentarse silenciar con hacks. El criterio correcto es que desaparezca en `vite build` + `vite preview`.
- `app/web/lib/firebaseV3.ts:8` usa `enableMultiTabIndexedDbPersistence`, API ya marcada como futura deprecacion; hay que migrar a cache configurada con `FirestoreSettings.cache`.
- `app/web/hooks/useAuth.ts:145` concentra sesion guest, sesion email, deteccion de dispositivo, resolucion de perfil, storage local, logout y estado UI en un solo hook.
- `app/web/hooks/useRoles.ts:3` mantiene una segunda pila de auth/roles basada en `legacy/firebaseCompat`, con nombres de rol distintos y otras claves de almacenamiento.
- `app/web/components/auth/UnifiedLogin.tsx:7`, `app/web/components/LoginScreen.tsx:10` y `app/web/components/auth/LoginRouter.tsx:12` representan tres entradas diferentes para login; una esta activa, otra es legacy y otra parece intermedia pero no conectada.
- `app/web/components/app/CalidadView.tsx:5` contradice el requisito actual porque permite a CALIDAD ver todas las estanterias y operar en ellas.
- `app/web/components/app/CalidadView.tsx:211` y `app/web/components/kiosk/ReprocesosEditor.tsx:109` no estan alineados: la ayuda UI dice que solo se puede editar una ubicacion ocupada de reprocesos, pero el editor y la Cloud Function si soportan crear un articulo nuevo en una celda vacia de `CAL 001-022`; por tanto, si hoy no se puede cargar cantidad/importe, no parece deberse a la ausencia de articulos asignados sino a un problema de flujo, descubribilidad o integracion pendiente.
- `app/web/components/kiosk/ShelfGridCell.tsx:214` muestra importe de reprocesos para cualquier consumidor del grid; hoy no existe una capacidad especifica de "ver importes".
- `app/web/components/kiosk/ShelfGrid.tsx:103` expone botones locales `Contraer/Expandir` por bloque cuyo comportamiento percibido no coincide con la expectativa de negocio; hay que dejar inequívoco si actuan sobre el bloque o sobre las tarjetas internas y hacer que etiqueta + accion coincidan.
- `app/web/lib/operationalSession.ts:1` solo contempla `OPERARIO` y `CARRETILLERO`, pero `app/web/hooks/useShelf.ts:181` y `app/web/hooks/useShelf.ts:205` dependen de esa sesion para operar, lo que deja incoherencias para CALIDAD y ADMIN.
- `app/web/components/admin/AdminShelfBrowser.tsx:5` sigue siendo una vista de solo lectura, pero el requisito actualizado exige que `ADMIN` y `SUPERADMIN` puedan ubicar, retirar y mover articulos manualmente desde la vista de estanterias en ordenador.

### Problemas estructurales detectados

- Duplicacion de tipos de rol y seccion entre `app/web/lib/firestoreSchema.ts:32`, `app/web/lib/permissionMatrix.ts:1`, `app/web/hooks/useRoles.ts:8` y `app/web/lib/warehouseData.ts:142`.
- Mezcla de V3 y legacy en un mismo arbol (`app/web/legacy`, `app/web/hooks`, `app/web/lib`), sin frontera clara de migracion.
- Archivos demasiado largos o con demasiadas responsabilidades:
  - `app/web/lib/firestoreSchema.ts` (~999 lineas)
  - `app/web/hooks/useAppLogic.ts` (~726 lineas)
  - `app/web/components/app/CalidadView.tsx` (~360 lineas)
  - `app/web/hooks/useAuth.ts` (~305 lineas)
  - `app/web/hooks/useShelf.ts` (~300 lineas)
  - `app/web/components/kiosk/ShelfGrid.tsx` (~434 lineas)
  - `app/web/legacy/components/AssignmentList.tsx` (~1335 lineas)
  - `app/web/legacy/components/AdminPanel.tsx` (~795 lineas)
- La documentacion y la realidad del repo no estan alineadas: `README.md:11` menciona `app/docs`, pero los documentos activos estan en `docs/` en raiz.
- Existe una copia de seguridad dentro del repo (`-- COPIA SEGURA ESTANTERIAS --`), lo que aumenta ruido de busqueda, riesgo de cambios accidentales y ambiguedad sobre la fuente de verdad.

## 2. Requisitos objetivo cerrados

### Requisitos de consola

1. El warning de Tailwind CDN debe desaparecer en la app servida por Vite.
2. El warning de Firestore por `enableMultiTabIndexedDbPersistence()` debe desaparecer migrando a la API actual.
3. El mensaje de React DevTools no debe considerarse defecto si solo aparece en desarrollo; la validacion oficial sera en build de produccion.

### Requisitos de login

1. El acceso debe sentirse continuo al cambiar de un rol a otro sin depender de `window.location.reload()`.
2. Debe existir una sola ruta de entrada y una sola capa de sesion.
3. Debe diferenciarse claramente el tipo de acceso:
   - `guest`/acceso rapido
   - `password`/correo + contrasena
   - `device`/modo asociado a dispositivo si se mantiene
4. Al salir de una sesion y entrar con otra no deben quedar residuos de storage incompatibles.

### Requisitos de CALIDAD

1. CALIDAD no debe poder navegar ni operar sobre el resto de estanterias.
2. CALIDAD debe tener una vista propia centrada en `CAL`.
3. El importe de reprocesos no debe verse en la visual tipo kiosko de calidad.
4. El importe de reprocesos solo debe verse con rol `CALIDAD` autenticado por correo + contrasena.
5. Si existe un kiosko fisico asignado a `CAL`, esa visual debe ser read-only respecto a importes.
6. Debe validarse explicitamente la alta de un articulo nuevo de reproceso en una celda vacia de `CAL 001-022`, introduciendo `articulo + OF + cantidad + importe`, sin depender de que exista una presencia previa.

### Requisitos de ADMIN y SUPERADMIN en vista de estanterias

1. `ADMIN` y `SUPERADMIN` deben poder seguir viendo de forma visual todas las estanterias desde ordenador.
2. Desde esa misma visual deben poder operar manualmente articulos por texto, al menos para `ubicar` y `retirar`, introduciendo `articulo + OF`.
3. Deben poder `mover` articulos desde la visual de estanterias, bien seleccionando origen/destino en la UI actual o mediante una interaccion mas directa si ya existe una base reutilizable.
4. Esta operativa de escritorio solo debe estar disponible para `ADMIN` y `SUPERADMIN`, nunca para roles de solo consulta.

### Requisitos de UX de estanterias

1. Los controles locales de cada estanteria para `contraer/expandir` deben hacer exactamente lo que su etiqueta promete.
2. Debe distinguirse visualmente entre `contraer/expandir bloque` y `contraer/expandir tarjetas` si ambas acciones siguen coexistiendo.

### Requisitos de estructura

1. Una sola fuente de verdad para roles, secciones, capacidades y tipo de sesion.
2. Separacion explicita entre modulos `v3` activos y modulos `legacy` en retirada.
3. Reduccion progresiva de archivos monoliticos antes de seguir ampliando funcionalidad.
4. Documentacion tecnica alineada con la estructura real del repo.

## 3. Mapa tecnico de archivos

### Crear

- `app/web/domain/auth/authTypes.ts` - tipos unicos de sesion, metodo de acceso y estado autenticado.
- `app/web/domain/auth/authStorage.ts` - claves de storage, lectura/escritura y limpieza atomica.
- `app/web/domain/auth/authCapabilities.ts` - matriz central de capacidades por rol + metodo de acceso.
- `app/web/domain/auth/authSessionResolver.ts` - resolucion de sesion a partir de Firebase, guest storage y device config.
- `app/web/domain/shelves/shelfAccess.ts` - reglas de acceso a estanterias por rol/seccion.
- `app/web/domain/reprocesos/reprocesosVisibility.ts` - politica `canViewReprocessCosts` y `canEditReprocesses`.
- `app/web/components/auth/LoginModeSwitcher.tsx` - selector fluido entre acceso rapido y acceso con cuenta.
- `app/web/components/auth/QuickAccessGrid.tsx` - grid desacoplado para accesos rapidos.
- `app/web/components/auth/EmailLoginForm.tsx` - formulario aislado para correo/contrasena.
- `app/web/components/app/CalidadDashboard.tsx` - contenedor reducido para calidad autenticada.
- `app/web/components/app/CalidadKioskView.tsx` - visual de calidad sin importes, utilizable en modo kiosko/read-only.
- `app/web/components/kiosk/ReprocessCostBadge.tsx` - presentacion aislada del bloque de importe si se mantiene visible.
- `app/web/tailwind.config.ts` - configuracion Tailwind local para build.
- `app/web/postcss.config.cjs` - pipeline PostCSS de Tailwind.
- `docs/arquitectura/auth-v3.md` - contrato tecnico de sesion y capacidades.
- `docs/arquitectura/calidad-v3.md` - reglas de acceso y visualizacion para CALIDAD.

### Modificar

- `app/web/index.html` - eliminar CDN Tailwind y revisar la necesidad del `importmap` heredado.
- `app/web/index.css` - incorporar `@tailwind base`, `@tailwind components` y `@tailwind utilities` sin perder estilos globales existentes.
- `app/web/lib/firebaseV3.ts` - migrar persistencia a configuracion moderna de cache de Firestore.
- `app/web/AppV3.tsx` - enrutar por capacidades y no solo por rol literal; conectar la nueva vista de calidad.
- `app/web/hooks/useAuth.ts` - adelgazarlo hasta dejarlo como fachada del nuevo dominio `auth`.
- `app/web/hooks/useShelf.ts` - validar capacidades operativas y acceso a estanteria antes de ubicar/retirar/mover.
- `app/web/components/auth/UnifiedLogin.tsx` - convertirlo en shell de los subcomponentes de auth o reemplazarlo por uno nuevo.
- `app/web/components/kiosk/KioskView.tsx` - inyectar politica de visibilidad de importes y acceso por estanteria.
- `app/web/components/kiosk/ShelfGrid.tsx` - propagar flags de visibilidad/capacidad al grid.
- `app/web/components/kiosk/ShelfGridCell.tsx` - dejar de mostrar importes por defecto y responder a `showReprocessCosts`.
- `app/web/components/app/CalidadView.tsx` - simplificarlo o dejarlo como adaptador temporal mientras se extraen vistas separadas.
- `app/web/components/admin/AdminShelfBrowser.tsx` - dejar de ser read-only y convertirse en visual operativa de escritorio para `ADMIN`/`SUPERADMIN`.
- `app/web/lib/firestoreSchema.ts` - extraer tipos, definiciones y helpers a modulos menores sin romper imports de golpe.
- `app/web/lib/operationalSession.ts` - alinearlo con el nuevo contrato de sesion operativa o integrarlo en `domain/auth`.
- `README.md` - corregir rutas reales de documentacion y arquitectura.
- `app/tests/*` - ampliar regresiones de auth/permisos/calidad.

### Eliminar o deprecar

- `app/web/components/LoginScreen.tsx` - duplicado legacy una vez migrada la entrada unica.
- `app/web/components/auth/LoginRouter.tsx` - si deja de tener valor tras el nuevo orquestador de login.
- `app/web/components/auth/KioskLogin.tsx` - si sigue apuntando a APIs inexistentes.
- `app/web/components/auth/CarretilleroLogin.tsx` - si sigue apuntando a APIs inexistentes.
- `app/web/hooks/useRoles.ts` - retirar cuando toda la app consuma la nueva capa de auth/capabilities.
- `app/web/lib/permissionMatrix.ts` - sustituir por `authCapabilities.ts`.
- `-- COPIA SEGURA ESTANTERIAS --` - sacar del repo operativo o excluirlo del flujo principal; no borrarlo hasta validarlo con negocio.

## 4. Plan de implementacion por fases

### Fase 0 - Asegurar linea base y decisiones funcionales

**Objetivo:** fijar la fuente de verdad actual antes de refactorizar.

**Archivos:**
- Revisar: `app/web/AppV3.tsx`, `app/web/hooks/useAuth.ts`, `app/web/hooks/useRoles.ts`, `app/web/components/auth/UnifiedLogin.tsx`, `app/web/components/app/CalidadView.tsx`, `app/web/components/kiosk/KioskView.tsx`, `app/web/components/kiosk/ShelfGridCell.tsx`, `app/web/lib/firebaseV3.ts`
- Documentar: `docs/arquitectura/auth-v3.md`, `docs/arquitectura/calidad-v3.md`

- [ ] Inventariar todos los caminos de entrada reales a la app y marcar cuales estan activos, legacy, muertos o intermedios.
- [ ] Congelar el vocabulario canonico: `role`, `section`, `authMethod`, `sessionKind`, `capabilities`, `assignedShelf`.
- [ ] Definir por escrito la matriz de visibilidad para `OPERARIO`, `CARRETILLERO`, `CALIDAD guest`, `CALIDAD password`, `ADMIN`, `SUPERADMIN`.
- [ ] Decidir si el kiosko fisico de calidad entra como `OPERARIO` asignado a `CAL` o como `CALIDAD` en modo limitado; esta decision afecta a la matriz de capacidades.

**Criterio de salida:** existe un contrato funcional firmado en docs antes de tocar codigo.

### Fase 1 - Unificar sesion y login

**Objetivo:** que cualquier alta, salida y cambio de rol pase por una sola capa de sesion sin recargas completas.

**Archivos:**
- Crear: `app/web/domain/auth/authTypes.ts`, `app/web/domain/auth/authStorage.ts`, `app/web/domain/auth/authCapabilities.ts`, `app/web/domain/auth/authSessionResolver.ts`
- Modificar: `app/web/hooks/useAuth.ts`, `app/web/components/auth/UnifiedLogin.tsx`, `app/web/AppV3.tsx`
- Deprecar: `app/web/hooks/useRoles.ts`, `app/web/components/LoginScreen.tsx`, `app/web/components/auth/LoginRouter.tsx`

- [ ] Extraer del hook actual los tipos y storage keys a un modulo de dominio reutilizable.
- [ ] Cambiar el almacenamiento de sesion para que exista una sola clave versionada, por ejemplo `wms_auth_session_v1`.
- [ ] Implementar una limpieza atomica de sesion que borre estado guest, estado email, sesion operativa y residuos legacy antes de iniciar otro acceso.
- [ ] Separar en `useAuth` la deteccion de dispositivo, la resolucion de perfil y las acciones `login/logout/switchSession`.
- [ ] Rehacer `UnifiedLogin` con subcomponentes pequeños y transicion directa entre modos, sin `reload`.
- [ ] Introducir una accion explicita `switchAccessMode()` para pasar de un boton rapido a otro o a correo/contrasena sin estado colgado.
- [ ] Reemplazar mensajes tecnicos de Firebase por errores de dominio mas legibles.

**Riesgos a controlar:** carreras entre `onAuthStateChanged`, sesion guest inicial y cambio de vista; doble render por `StrictMode`; residuos de `guest_role`, `guest_section` y `wms_guest_session`.

**Criterio de salida:** cambiar de un acceso rapido a otro y de un acceso rapido a correo/contrasena no requiere refresco manual ni deja estados mezclados.

### Fase 2 - Centralizar permisos y accesos

**Objetivo:** quitar permisos dispersos y convertirlos en capacidades consumibles por vistas y hooks.

**Archivos:**
- Crear: `app/web/domain/shelves/shelfAccess.ts`, `app/web/domain/reprocesos/reprocesosVisibility.ts`
- Modificar: `app/web/domain/auth/authCapabilities.ts`, `app/web/AppV3.tsx`, `app/web/hooks/useShelf.ts`, `app/web/components/kiosk/KioskView.tsx`, `app/web/components/app/CalidadView.tsx`
- Eliminar: `app/web/lib/permissionMatrix.ts`, `app/web/hooks/useRoles.ts`

- [ ] Definir capacidades separadas para `canAccessShelf`, `canOperateShelf`, `canViewReprocessCosts`, `canEditReprocesses`, `canBrowseAllShelves`.
- [ ] Expresar las reglas con condicion adicional por `authMethod`, no solo por `role`.
- [ ] Mover la validacion de acceso de estanteria fuera de la UI y duplicarla en `useShelf` como defensa tecnica.
- [ ] Cambiar `AppV3` para que rote a vistas por capacidades y no por `switch(role)` rigido.
- [ ] Hacer que `useShelf` rechace operaciones si la sesion no puede operar en la estanteria pedida.

**Criterio de salida:** la navegacion y la operativa no dependen de checks inline repetidos.

### Fase 3 - Rehacer el flujo de CALIDAD

**Objetivo:** alinear completamente la experiencia del rol CALIDAD con tus reglas de negocio actuales.

**Archivos:**
- Crear: `app/web/components/app/CalidadDashboard.tsx`, `app/web/components/app/CalidadKioskView.tsx`
- Modificar: `app/web/AppV3.tsx`, `app/web/components/app/CalidadView.tsx`, `app/web/components/kiosk/KioskView.tsx`, `app/web/hooks/useShelf.ts`

- [ ] Separar dos experiencias distintas:
  - `CALIDAD password`: vista de calidad autenticada con privilegios completos de reprocesos.
  - `CALIDAD visual/kiosko`: vista de `CAL` sin importes, sin navegador global y con operativa recortada segun contrato.
- [ ] Corregir el flujo de reprocesos para que una sesion `CALIDAD password` pueda abrir tambien una celda vacia de `CAL 001-022` y dar de alta `articulo + OF + cantidad + importe` desde cero.
- [ ] Alinear el copy y el comportamiento real: si una celda vacia es editable en reprocesos, la ayuda de `CalidadView` debe decirlo explicitamente.
- [ ] Retirar de `CalidadView` la pestana `ESTANTERIAS` y cualquier selector global de estanterias.
- [ ] Decidir si las acciones `ubicar`, `retirar`, `mover`, `avisar` se mantienen todas para calidad autenticada o se acotan por subcapacidad.
- [ ] Reutilizar `QualityShelfView.tsx` como base de la visual restringida si encaja, o absorberla en `CalidadKioskView.tsx`.
- [ ] Garantizar que el rol CALIDAD no vea el resto de estanterias ni por UI ni pasando un codigo manual.

**Criterio de salida:** CALIDAD siempre aterriza en `CAL` y no puede abrir el resto de estanterias.

### Fase 4 - Ocultar importe de reprocesos fuera del acceso autenticado de CALIDAD

**Objetivo:** que el importe solo sea visible en el contexto autorizado.

**Archivos:**
- Crear: `app/web/components/kiosk/ReprocessCostBadge.tsx`, `app/web/domain/reprocesos/reprocesosVisibility.ts`
- Modificar: `app/web/components/kiosk/ShelfGrid.tsx`, `app/web/components/kiosk/ShelfGridCell.tsx`, `app/web/components/kiosk/KioskView.tsx`, `app/web/components/app/CalidadView.tsx`, `app/web/components/app/CalidadDashboard.tsx`, `app/web/components/kiosk/ReprocesosEditor.tsx`

- [ ] Introducir una prop explicita `showReprocessCosts` en `ShelfGrid` y `ShelfGridCell` con valor por defecto `false`.
- [ ] Mostrar el badge `€` y la linea `{quantity} ud · {unitCost} €/ud` solo cuando la capacidad `canViewReprocessCosts` sea `true`.
- [ ] Mantener visibles cantidades y articulos si el negocio lo permite, pero no importes unitarios ni agregados fuera del acceso autenticado de calidad.
- [ ] Ocultar tambien el banner agregado de `Total Reprocesos` si la sesion no tiene permiso.

**Criterio de salida:** un kiosko de calidad o una visual de `CAL` no enseña importes; el acceso con correo/contrasena de calidad si.

### Fase 5 - Limpiar consola y build frontend

**Objetivo:** quitar avisos evitables y dejar el frontend listo para build estable.

**Archivos:**
- Crear: `app/web/tailwind.config.ts`, `app/web/postcss.config.cjs`
- Modificar: `app/web/index.html`, `app/web/index.css`, `app/web/lib/firebaseV3.ts`, opcionalmente `app/web/vite.config.ts`

- [ ] Mover Tailwind a pipeline local y borrar el script CDN de `index.html`.
- [ ] Revisar si el `importmap` sigue siendo necesario en Vite; si no lo es, retirarlo para simplificar el documento raiz.
- [ ] Migrar Firestore a cache configurada con la API moderna de `FirestoreSettings.cache`.
- [ ] Verificar que el mensaje de React DevTools solo aparece en desarrollo y no en la build de produccion.
- [ ] No introducir filtros de consola para ocultar mensajes legitimos del modo dev.

**Criterio de salida:** no hay warning de Tailwind ni deprecacion de Firestore en la version validada; React DevTools desaparece en preview de produccion.

### Fase 6 - Reducir archivos monoliticos y frontera legacy/v3

**Objetivo:** mejorar la estructura antes de seguir creciendo.

**Archivos prioritarios:**
- `app/web/lib/firestoreSchema.ts`
- `app/web/hooks/useAuth.ts`
- `app/web/hooks/useShelf.ts`
- `app/web/components/app/CalidadView.tsx`
- `app/web/components/kiosk/ShelfGrid.tsx`
- `app/web/legacy/**`

- [x] Partir `firestoreSchema.ts` por dominios: `collections`, `roles`, `sections`, `shelves`, `locations`, `users`, `devices`, `documents`. Barrel en `lib/firestoreSchema.ts` re-exporta todo sin romper imports existentes. (2026-04-29)
- [x] Convertir `CalidadView.tsx` en un contenedor fino: banner de totales y bloque de ayuda extraidos a `CalidadReprocesosSection.tsx`. (2026-04-29)
- [x] Extraer de `useShelf.ts` la logica offline a `lib/shelfOptimisticUpdates.ts` (funciones puras testables: `applyUbicar`, `applyRetirar`, `applyMover`). Validacion de acceso y suscripcion quedan en el hook pero con secciones etiquetadas. (2026-04-29)
- [x] Corregir en `ShelfGrid.tsx` la semantica de los controles locales `Contraer/Expandir`: renombrados a "Colapsar tarjetas" / "Expandir tarjetas" para distinguirlos inequivocamente del control de bloque. Test `shelf_grid_local_expand_controls.cjs` cubre regresion. (2026-04-29)
- [x] Evolucionar `AdminShelfBrowser.tsx` de navegador read-only a visual operativa de escritorio con acciones manuales de `ubicar`, `retirar` y `mover` para `ADMIN`/`SUPERADMIN`. Inputs de texto para articulo+OF, grid cambia a no-compact durante la operativa. Test `admin_shelf_browser_manual_operations.cjs`. (2026-04-29)
- [x] Reutilizar `useShelf` (ubicar/retirar/mover/findArticle) y `ConfirmationModal` en `AdminShelfBrowser.tsx` sin duplicar logica de negocio. (2026-04-29)
- [x] Etiquetar el arbol `legacy` como congelado y documentar su retiro por etapas en `app/web/legacy/README.md`. Se confirma que `hooks/useRoles.ts` sigue teniendo consumidores ligados al shell legacy (`AppLegacy.tsx` y componentes compartidos usados por ese shell), por lo que su eliminacion queda condicionada a retirar ese runtime completo. (2026-04-29)
- [x] Revisar `README.md` para reflejar la estructura real: añadidas sub-rutas `domain/`, `hooks/`, `lib/schema/`, `components/`. (2026-04-29)

> **Completado el 2026-04-29 (sesion Fase 6 parcial):**
> - P1: Corregido el copy de `CalidadView.tsx` — la ayuda ahora dice "vacía o con artículos" en lugar de "ubicacion ocupada", alineando el texto con el comportamiento real del editor de reprocesos. Test `quality_reprocess_empty_cell_creation.cjs` añadido.
> - P2: Botones locales de bloque renombrados. "Contraer" → "Colapsar tarjetas", "Expandir" → "Expandir tarjetas". Los botones globales "Contraer todo"/"Expandir todo" siguen afectando bloques. Semántica inequívoca y cubierta con test.
> - P3: `AdminShelfBrowser.tsx` reescrito. ADMIN y SUPERADMIN pueden ubicar, retirar y mover manualmente introduciendo artículo+OF. Grid cambia a modo detallado durante operativa. Usa `useShelf` y `ConfirmationModal` existentes.
> - Build `npm --prefix app/web run build` limpio (14.82 s, 0 errores TS).
>
> **Completado el 2026-04-29 (sesion Fase 6 estructural):**
> - A: `firestoreSchema.ts` (998 lineas) convertido en barrel de 9 lineas; contenido dividido en 8 sub-modulos bajo `lib/schema/`. Los 27 importadores existentes siguen funcionando sin cambios.
> - B: `useShelf.ts` refactorizado: logica optimista extraida a `lib/shelfOptimisticUpdates.ts`; `ShelfLocationState` movido a `lib/schema/locations.ts` para evitar dependencia circular; re-exportado desde `useShelf.ts` para compatibilidad.
> - C: `CalidadView.tsx` adelgazado: banner de totales y bloque de ayuda extraidos a `CalidadReprocesosSection.tsx`.
> - D: `README.md` actualizado con la estructura real de `domain/`, `hooks/`, `lib/schema/`, `components/`.
> - Tests: todos los 35 tests pasan (incluyendo actualizacion de rutas de `isReprocesosLocation` y de la comprobacion de gating de banner).
> - Build limpio: 301 modulos, 12.12 s, 0 errores TS.
> - Legacy etiquetado como congelado en `app/web/legacy/README.md`; retiro condicionado a la desaparicion de `AppLegacy.tsx` y de los consumidores restantes de `hooks/useRoles.ts`.

**Criterio de salida:** la v3 queda comprensible por modulos y los componentes de acceso/permiso dejan de ser monoliticos.

## 5. Matriz objetivo de acceso y visibilidad

| Contexto | Estanterias visibles | Operar en CAL | Operar fuera de CAL | Ver importes reprocesos |
|---|---|---:|---:|---:|
| `OPERARIO` kiosko | Solo `assignedShelf` | Solo si `assignedShelf === CAL` y negocio lo permite | No | No |
| `CARRETILLERO` | Todas las permitidas por negocio | Si | Si | No |
| `CALIDAD` acceso rapido/visual | Solo `CAL` | Segun subcapacidad definida | No | No |
| `CALIDAD` correo + contrasena | Solo `CAL` | Si | No | Si |
| `ADMIN` | Todas | Si | Si | Segun negocio |
| `SUPERADMIN` | Todas | Si | Si | Segun negocio |

## 6. Estrategia de pruebas

### Tests a crear o ampliar

- `app/tests/auth_session_single_source.cjs` - asegura que guest/email/device comparten el mismo contrato de sesion.
- `app/tests/auth_logout_switch_role_flow.cjs` - salir de un rol y entrar en otro sin refresco y sin residuos.
- `app/tests/quality_access_restricted_to_cal.cjs` - CALIDAD no puede abrir otras estanterias.
- `app/tests/quality_reprocess_cost_visibility.cjs` - importes ocultos en kiosko/visual y visibles solo en `CALIDAD password`.
- `app/tests/quality_reprocess_empty_cell_creation.cjs` - alta de articulo nuevo en `CAL 001-022` sin presencia previa.
- `app/tests/firestore_cache_configuration.cjs` - no se usa la API deprecada de persistencia.
- `app/tests/layout_login_entrypoint_consistency.cjs` - solo existe una entrada activa de login.
- `app/tests/shelf_grid_local_expand_controls.cjs` - los controles locales no estan invertidos respecto a su etiqueta.
- `app/tests/admin_shelf_browser_manual_operations.cjs` - `ADMIN` y `SUPERADMIN` pueden ubicar, retirar y mover manualmente desde desktop shelf view.

### Verificaciones manuales obligatorias

- Iniciar con acceso rapido `OPERARIO`, salir y entrar como `CALIDAD`, luego `ADMIN`, sin recargar navegador.
- Entrar con correo/contrasena de CALIDAD y comprobar que el banner y detalle de importes son visibles.
- Entrar con correo/contrasena de CALIDAD, abrir una celda vacia de `CAL 001-022` y crear un articulo nuevo con cantidad e importe.
- Entrar en visual/kiosko de `CAL` y comprobar que solo se ve la estanteria `CAL` y nunca el importe.
- Forzar navegacion manual a otra estanteria desde una sesion CALIDAD y confirmar bloqueo.
- Probar en escritorio con `ADMIN` y con `SUPERADMIN` la operativa manual desde la visual de estanterias: ubicar por texto, retirar por texto y mover a destino.
- Validar en una estanteria con bloques que los botones locales `Contraer` y `Expandir` hacen exactamente la accion indicada.
- Ejecutar `npm --prefix app/web run build` y validar la consola de `vite preview`.

## 7. Orden de ejecucion recomendado

1. Fase 0 - contrato funcional y matriz de acceso.
2. Fase 1 - sesion unica y login fluido.
3. Fase 2 - capacidades centralizadas.
4. Fase 3 - reestructuracion de CALIDAD.
5. Fase 4 - visibilidad de importes.
6. Fase 5 - limpieza de consola y build.
7. Fase 6 - limpieza estructural y retirada legacy.

## 8. Riesgos y decisiones pendientes

- Si actualmente existe personal de calidad usando acceso rapido con privilegios operativos completos, la nueva matriz puede cambiar su forma de trabajo; hay que fijarlo antes de implementar.
- Si el kiosko fisico de `CAL` necesita editar reprocesos pero no ver importes, habra que separar `canEditReprocesses` de `canViewReprocessCosts`.
- Si `AppV3` sigue dependiendo de device mode para despliegues futuros, la capa nueva de sesion debe conservar ese concepto sin mezclarlo con `role`.
- Antes de borrar cualquier pieza legacy, hay que confirmar que no la consume ningun flujo fuera del entrypoint actual.

## 9. Resultado esperado al terminar el plan

- Login unico, rapido y sin residuos entre roles.
- CALIDAD limitada a su estanteria.
- Reprocesos editables tambien desde celdas vacias de `CAL 001-022` cuando la sesion este autorizada.
- Visual de calidad sin importes de reproceso.
- Importes visibles solo con acceso autenticado de CALIDAD por correo/contrasena.
- Visual de estanterias de escritorio operativa para `ADMIN` y `SUPERADMIN`.
- Controles locales de `contraer/expandir` coherentes y no invertidos.
- Consola limpia de warnings evitables.
- Estructura del codigo mas clara, con menos duplicacion y mejor frontera entre `v3` y `legacy`.
