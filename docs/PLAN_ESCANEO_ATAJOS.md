# Plan de implementación — Atajos de escaneo (scan-first) con QR/pistola

_Fecha: 2026-06-15 · Autor: análisis sobre el código actual_

> ## ✅ Estado: IMPLEMENTADO (2026-06-16) — pendiente de deploy
>
> Implementadas las Fases 1, 2 y 3 (todo el plan menos lo descartado: MOVER desde
> bandeja). **No desplegado** todavía (sin `firebase deploy`). `typecheck` ✅,
> `build` ✅, tests **77/77** ✅.
>
> **Archivos nuevos**
> - `hooks/useScannerCapture.ts` — detector de pistola global (heurística gap<35ms + Enter, len≥4; preventDefault de la ráfaga para no contaminar el buscador). §4.
> - `components/operative/ScanTray.tsx` — UI de la bandeja (badges ubicado/sin-ubicar en tiempo real, UBICAR todos / RETIRAR subconjunto / Vaciar). §3.
>
> **Archivos modificados**
> - `lib/operative/operativeConfig.ts` — `canUseScanTray(role,email)` + `SCAN_TRAY_SUPERADMIN_EMAILS`. §7.
> - `hooks/useOperativeShelf.ts` — estado `trayItems` + persistencia `wms.scantray.v1`, resolución `located` por item (`findArticleGlobal`), `ubicarTray` (siembra el lote existente), `retirarTray`/`processTrayRetirar` (retira el subconjunto ubicado vía `inventoryApi.retirarDeUbicacion`), `requestDeliveryToSection` (§7bis). Param `enableScanTray`.
> - `components/operative/OperativeShelfArea.tsx` — render de `ScanTray` en idle, wiring de `useScannerCapture` (activo solo idle + sin modales), modal selector de sección destino para "Solicitar traer".
> - `components/kiosk/KioskSearchBar.tsx` — prop `onSolicitarTraer` + botón "🚚 Solicitar traer" en la ficha del resultado.
> - `components/carretillero/CarretilleroView.tsx` — calcula `enableScanTray` con el gate y lo pasa al motor.
>
> **§8 (QR primario)**: ya estaba — `ScanMethodPicker` lista pistola/QR como opción
> principal y OCR como alternativa. Sin cambios.
>
> **Notas / riesgos asumidos**
> - La heurística deja "escapar" como mucho 1 carácter al buscador (el primero de
>   la ráfaga, con gap grande); los siguientes se bloquean. Umbral configurable.
> - `retirarTray` retira por artículo+OF+posición sin `presenceId`: si el mismo
>   artículo/OF tiene varias presencias en la misma celda, retira la primera coincidencia.
> - Pendiente al desplegar: verificar en dispositivo real la heurística de pistola
>   y el formato del QR físico (`ARTÍCULO // OFxx-nnnnn`).

## 1. Objetivo

Cuando exista el QR en las etiquetas, la **pistola de escaneo** pasa a ser el método
habitual (por encima del OCR). Sobre eso, añadir un **atajo más rápido** sin romper nada:

- **Mantener** el flujo actual: pulsar acción (UBICAR/RETIRAR/MOVER…) → elegir método →
  escanear → continuar. No se toca.
- **Añadir** un flujo **"scan-first"**: en reposo (idle), poder **escanear varias cosas
  seguidas sin pulsar nada**; se acumulan en una **bandeja**. Después el operario pulsa
  la acción (p.ej. UBICAR) y se aplica a todo.
- **Propuesta inteligente (no excluyente)**: la app **informa** del estado de cada
  artículo (ubicado / sin ubicar) y ofrece la acción más probable, pero **nunca bloquea
  UBICAR**. Si está sin ubicar → sugiere UBICAR. Si ya está ubicado → ofrece RETIRAR
  **y además** sigue permitiendo UBICAR (ver parciales abajo).

### Parciales (caso muy común)

Que un artículo ya figure ubicado **no** implica "solo se puede retirar": es frecuente
ubicar un **parcial** del mismo artículo/OF en otra posición. Por tanto:

- **UBICAR está SIEMPRE disponible** para cualquier artículo de la bandeja, esté o no
  ubicado. Para los ya ubicados, se mantiene el aviso existente "⚠️ ya ubicado en X"
  como **confirmación** (no como bloqueo) — el motor ya permite el append/parcial
  ("Sí, ubicar de nuevo").
- **RETIRAR** es una acción **adicional**, disponible solo para los artículos que sí
  están ubicados.

## 2. Principio de diseño: reutilizar, no reescribir

Todo el comportamiento operativo vive en un único motor (`useOperativeShelf`) que ya
contempla el concepto de **lote** (`batchArticles`) y la resolución global de ubicación
(`findArticleGlobal`). El atajo se construye **encima** de esas piezas:

- El "tray/bandeja" es una **generalización del lote actual**: hoy el lote (a) solo
  arranca tras pulsar UBICAR y (b) solo sirve para ubicar. Lo extendemos a (a) poder
  empezar en idle por escaneo y (b) resolver a UBICAR **o** RETIRAR según el estado.
- La detección "¿está ubicado?" usa `findArticleGlobal` (ya existente), que devuelve las
  ubicaciones reales del artículo en toda la nave.

Esto reduce el riesgo: no se duplica lógica de negocio ni de Firestore.

## 3. Concepto UX: la "Bandeja de escaneo"

En reposo, una pequeña barra/área (colapsada hasta el primer escaneo):

```
┌─ Bandeja (3) ───────────────────────────── [Vaciar] ─┐
│ • CHAPA-1234  // OF26-0911   ✅ ubicado: PLEGADORA p.12 │
│ • CHAPA-5678  // OF26-0911   ⬜ sin ubicar             │
│ • TAPA-22     // OF26-0033   ⬜ sin ubicar             │
├───────────────────────────────────────────────────────┤
│  [📦 UBICAR los 3]            1 ubicado → [📤 RETIRAR]  │
│  (los ya ubicados se ubican como parcial, con aviso)    │
└───────────────────────────────────────────────────────┘
```

- Cada línea muestra el artículo + **badge de estado** (resuelto con `findArticleGlobal`).
- Botones de acción:
  - **UBICAR** — SIEMPRE disponible, actúa sobre **toda** la bandeja (los ya ubicados se
    ubican como **parcial**, con su aviso de confirmación). Es la acción por defecto.
  - **RETIRAR** — aparece solo si hay artículos ubicados; actúa sobre **el subconjunto
    ubicado**.
  - Así el caso mixto se resuelve sin ambigüedad: UBICAR para todo / RETIRAR para lo que
    ya estaba. El estado por línea (badge) informa; no obliga.
- "Vaciar" descarta la bandeja. Igual que el lote, se **persiste en localStorage**
  (tolerancia a recarga/desconexión), reutilizando el patrón `BATCH_STORAGE_KEY`.
- **Tiempo real**: cada escaneo aparece en la lista al instante; su badge de estado
  (ubicado/sin ubicar) se resuelve en segundo plano (`findArticleGlobal`) y se actualiza
  en cuanto responde. Los botones **UBICAR** / **RETIRAR** se muestran/activan en cuanto
  son posibles (RETIRAR aparece al haber ≥1 artículo ubicado).

El flujo clásico sigue intacto: si en idle el operario pulsa directamente un botón de
acción, se ejecuta el flujo de siempre (la bandeja se ignora o se ofrece usarla).

## 4. Mecanismo técnico: escanear "sin pulsar nada"

Hoy `ScannerInput` solo captura cuando `scannerActive=true` (dentro de un flujo). Para
capturar en idle sin robar el foco al buscador de artículos, se añade un **detector de
pistola global**:

- Listener `keydown` en captura, **activo solo cuando `action==='idle'` y no hay modal
  abierto**.
- **Heurística de pistola** (estándar): caracteres que llegan muy rápido (gap < ~35 ms)
  y terminan en `Enter`, con longitud ≥ 4 → es un escaneo (no tecleo humano).
- Al detectar escaneo: `preventDefault`, parsear con `parseScanInput` y **añadir a la
  bandeja** (aunque el foco estuviera en el buscador; el tecleo humano normal no dispara
  la heurística, así que el buscador sigue usable).
- Alternativa válida: librería `onscan.js` en vez de heurística propia (decisión menor).

> Importante: el QR/etiqueta debe codificar `ARTÍCULO // OFxx-nnnnn` (formato que ya
> entiende `parseScanInput`). Si el QR trae otro formato, se añade un parser específico.

## 5. Lógica de la propuesta contextual

Por cada artículo que entra en la bandeja:

1. `parseScanInput` → `{ articleCode, orderFab }`.
2. `findArticleGlobal(articleCode, orderFab)` → ubicaciones actuales.
3. Anotar el item: `located: boolean`, `locations: [{shelfCode, position, shelfName}]`.
4. Recalcular CTAs: nº sin ubicar / nº ubicados → botones contextuales.

Reglas heredadas que se respetan:
- **UBICAR**: si un artículo ya figura ubicado, mantener el aviso "⚠️ ya ubicado" antes
  de duplicar (lógica ghost ya existente en `handleScan`).
- **Contigüidad** de posiciones al ubicar (`validateContiguity`).
- **Duplicados** dentro de la bandeja: avisar y no añadir dos veces (como el lote actual).

## 6. Flujos detallados

### 6.1 Scan-first → UBICAR
1. Escaneo idle → items a la bandeja (todos "sin ubicar").
2. Pulsar **UBICAR** en la bandeja → entra en el flujo de **lote existente**
   (`batchMode`, selección de posiciones con contigüidad) → confirmar → backend
   `ubicar/ubicarMulti`. **Cero código de negocio nuevo**, solo "sembrar" el lote desde
   la bandeja.

### 6.2 Scan-first → RETIRAR
1. Escaneo idle de artículos **ya ubicados**.
2. Pulsar **RETIRAR** → para cada item, retirar de su(s) ubicación(es) conocidas vía
   `findArticleGlobal` → `shelfOperate {op:'retirar'/'retirarDeUbicacion'}` por presencia.
3. Pantalla de confirmación tipo "se retirarán N artículos de estas ubicaciones".
4. Reutiliza `retirarDeUbicacion` / la cola de retirada (`pendingRetirarQueue`).

> Es la inversa del retirar actual (hoy es por celda; aquí es por artículo escaneado),
> pero usa los mismos endpoints.

### 6.3 Scan-first → MOVER
**Fuera de alcance por ahora** (decisión del 2026-06-15). Se podrá añadir más adelante
sin afectar al diseño (escanear → MOVER → elegir destinos).

## 7. Alcance: SOLO carretillero + 2 superadmins

La **bandeja de escaneo** (scan-first ubicar/retirar) se habilita **únicamente** para:

- **CARRETILLERO** (cualquiera).
- **SUPERADMIN** por email: `d.soler@favram.com` y `j.diaz@favram.com`.

Gate (en el chrome que monta la bandeja):

```ts
const canScanTray =
  role === 'CARRETILLERO' ||
  ['d.soler@favram.com', 'j.diaz@favram.com'].includes((firebaseUser?.email || '').toLowerCase());
```

Estos perfiles ya operan con `shelfScope: 'all'` (navegan todas las secciones), así que
**desaparece el problema de permisos cross-sección**: pueden UBICAR eligiendo sección y
RETIRAR de cualquier ubicación. No hace falta el fallback "avisar al carretillero" dentro
de la bandeja (el propio carretillero la usa).

El resto de roles (operario/jefe/calidad) **no** ven la bandeja; su vía para mover stock
sigue siendo el flujo AVISAR/“solicitar traer” (ver §7bis).

## 7bis. Solicitar "traer a sección" desde el buscador (para las secciones)

Independiente de la bandeja. Hoy el buscador global (`KioskSearchBar`) muestra dónde está
un artículo. Añadir, en la ficha del resultado, un botón **“🚚 Solicitar traer”**:

1. El usuario de una sección busca el artículo y pulsa “Solicitar traer”.
2. Se abre un **selector de sección destino** (“¿a qué sección debe llevarlo el
   carretillero?”).
3. Se crea una solicitud de entrega reutilizando **`createDeliveryRequest`** (el mismo
   backend que ya usa el flujo AVISAR→TRAER y `TraerArticuloModal`), que entra en la cola
   del carretillero (`pickupQueue`).

Esto NO requiere lógica nueva de negocio: solo enganchar el botón del buscador al modal de
sección destino + `createDeliveryRequest` existente.

**Disponible en el buscador global para TODOS menos el carretillero**: KIOSKO/OPERARIO,
JEFE_SECCIÓN, CALIDAD, ADMIN y SUPERADMIN. (El carretillero es quien ejecuta las entregas,
no quien las solicita.)

## 8. QR como método por defecto

- En `ScanMethodPicker`, marcar **pistola/QR** como opción primaria/recordada cuando el
  dispositivo lo soporte; OCR pasa a secundario ("método alternativo").
- El flujo clásico no cambia; solo el orden/énfasis de los botones.
- Mantener OCR y entrada manual (dual-field) como respaldo (sin QR / etiqueta dañada).

## 9. Casos límite y reglas a respetar

- **Foco compartido** con el buscador de artículos (idle) → resuelto por la heurística de
  pistola (no roba tecleo humano).
- **Modales abiertos** → detector desactivado (no capturar escaneos a media confirmación).
- **Offline** → `findArticleGlobal` ya cae a caché (`wms-items-cache`); marcar el estado
  como "según última sincronización".
- **Persistencia** de la bandeja (recarga/caída) → reutilizar patrón del lote.
- **Mixto** ubicado/sin-ubicar → dos CTAs por subconjunto.
- **Item ubicado en varias posiciones** → al retirar, listar y dejar elegir cuáles.

## 10. Cambios por archivo (estimación)

- `hooks/useOperativeShelf.ts` — generalizar lote a "bandeja": permitir sembrar
  `batchArticles` en idle; resolver `located` por item; CTAs contextuales; rama RETIRAR
  desde bandeja. (Núcleo del cambio.)
- `components/operative/OperativeShelfArea.tsx` — UI de la bandeja en idle + botones
  contextuales.
- **Nuevo** `hooks/useScannerCapture.ts` — detector de pistola global (heurística).
- `components/kiosk/ScanMethodPicker.tsx` — QR/pistola como método primario.
- `lib/operative/operativeConfig.ts` — flag `scanFirst` por rol (activar gradualmente).
- (Posible) `lib/qrParser.ts` — parser del formato real del QR si no es `// OF`.

## 11. Fases

- ✅ **Fase 1 (MVP)**: gate (carretillero + 2 superadmins) + detector de pistola en idle +
  bandeja en tiempo real + scan-first→**UBICAR** (reusa el lote; parciales incluidos).
  QR/pistola como método primario.
- ✅ **Fase 2**: scan-first→**RETIRAR** del subconjunto ubicado (badge en tiempo real con
  `findArticleGlobal`) + caso mixto (UBICAR todo / RETIRAR lo ubicado).
- ✅ **Fase 3**: **"Solicitar traer"** en el buscador global (§7bis) para todos menos el
  carretillero + persistencia de la bandeja (`wms.scantray.v1`).
- _Descartado de momento_: MOVER desde bandeja.

## 12. Decisiones

1. ✅ **Alcance**: solo CARRETILLERO + superadmins `d.soler@favram.com` / `j.diaz@favram.com`.
2. ✅ **Permisos cross-sección**: no aplica (scope 'all'); sin fallback AVISAR en la bandeja.
3. ✅ **Formato del QR**: **artículo + OF** → `ARTÍCULO // OFxx-nnnnn` (ya soportado por
   `parseScanInput`). No hace falta parser nuevo.
4. ✅ **Activación**: bandeja **siempre activa** en idle para esos perfiles (transparente).
5. ✅ **MOVER** desde bandeja: **fuera de alcance** por ahora.
6. ✅ **"Solicitar traer"** (§7bis): sobre el **buscador global**, para **todos menos el
   carretillero** (kiosko, jefe de sección, calidad, admin, superadmin).

**Todas las decisiones cerradas → plan listo para implementar.**

## 13. Riesgos

- Falsos positivos/negativos de la heurística de pistola (mitigable: umbral configurable
  o `onscan.js`).
- Coste de `findArticleGlobal` por cada escaneo (mitigable: caché/in-flight dedupe; ya hay
  caché de items).
- Permisos cross-shelf en RETIRAR (resuelto vía scope + AVISAR).
```
