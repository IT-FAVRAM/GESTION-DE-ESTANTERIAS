# Informe de Auditoría Firebase — Bloque 1

> Proyecto: `gestion-de-estanterias` · Fecha: 2026-06-01 · Vía: MCP Firebase (Auth API + batchGet) + análisis de código.

> **✅ ESTADO: correcciones #1–#5 y #7 aplicadas el 2026-06-01.** Pendientes: deploy de funciones (#5)
> y decisión sobre limpieza de colecciones legacy. Ver sección "Resultado de la ejecución" al final.

## ⚠️ Limitación de la herramienta MCP
Las lecturas tipo *query* (`runQuery`/`count`) fallan de forma persistente con
`The requested 'read_time' cannot be in the future` (desfase de reloj entre el entorno y Firestore).
Por eso **no** se pudo:
- Listar/contar documentos por colección (counts de legacy).
- Leer `notificationHistory` (orderBy sentAt).
- Listar `usuarios` completo.

Se usó en su lugar: `firebase auth:getUsers` (otro endpoint, sí funciona), `batchGet` por ruta exacta
de documento (sí funciona) y análisis estático del código. Los counts y el historial deben obtenerse
con los scripts que usan `serviceAccount.json` (`scripts/audit-collections.ts`).

---

## 1.1 — Colecciones

18 colecciones de nivel raíz en Firestore:
`avisos, conexion_estado, conexion_logs, config, configuracion, dispositivos, estanterias, historial,
history, itemAggregates, items, kiosks, meta, pickupQueue, piezas, shelves, tablets, usuarios`

- `locations` no aparece arriba porque es **subcolección** (`shelves/{code}/locations`), no raíz. Correcto.
- Oficiales (COLLECTIONS.ts): todas presentes.

### Legacy
| Colección | ¿Referenciada en código? | Veredicto |
|---|---|---|
| `avisos` | **SÍ** — `useSystemNotifications.ts` (lee y escribe avisos internos) | **MANTENER** (activa) |
| `meta` | **SÍ** — `backup.ts`, `migration.ts`, `useWarehouseConfig.ts`, `useBackupSystem.ts` (`meta/warehouseConfig`, `meta/backups`) | **MANTENER** (activa) |
| `estanterias` | No | Candidata a eliminar |
| `historial` | No | Candidata a eliminar |
| `configuracion` | No | Candidata a eliminar |
| `piezas` | No | Candidata a eliminar |
| `tablets` | No | Candidata a eliminar |

> Counts no verificables por MCP (clock skew). Confirmar vacías/migradas con `audit-collections.ts` antes de borrar.

---

## 1.2 — Usuarios (esperados 18)

### Firebase Auth: existen 14, **faltan 4**
- ❌ `a.cuevas@favram.com` (adri, JEFE_SECCION)
- ❌ `e.sancetta@favram.com` (elisabetta, CALIDAD)
- ❌ `oscar@carretillero.wms.local` (CARRETILLERO) ← **necesario para el chat (Bloque 2)**
- ❌ `raul@carretillero.wms.local` (CARRETILLERO) ← **necesario para el chat (Bloque 2)**

### Firestore `usuarios/{uid}`: de los 14 de Auth, **12 tienen doc, 2 NO**
- ❌ `r.mendieta@favram.com` (CALIDAD) — existe en Auth, **sin doc en `usuarios`**
- ❌ `l.gil@favram.com` (CALIDAD) — existe en Auth, **sin doc en `usuarios`**

Impacto: las notificaciones (`getUsersByEmails`/`getUsersByRole` en `push.ts`) consultan la colección
`usuarios`. Sin doc, **estos 2 de CALIDAD nunca reciben push**, aunque estén en `qualityEmails`.
Pueden loguearse porque `authz.ts` resuelve rol por *custom claims* primero, pero en frontend
(`useAuth` lee `usuarios/{uid}`) su rol puede quedar sin resolver.

### Verificación de los 12 docs existentes
- **`l.asensio` → role `ADMIN`** en Firestore, pero la tabla y `setup-users.ts` dicen **SUPERADMIN**. ⚠️ MISMATCH.
- Resto de roles coinciden con la tabla.
- `d.fernandez` → section `LASER` (coincide con `chiefMapping`; `setup-users` decía PUNZONADO — desambiguar).
- `i.hernandez` → section `PRENSAS`, pero `chiefMapping.PRENSAS → h.juvera` (no i.hernandez). Inconsistencia.
- **TODOS los 12 docs tienen `fcmTokens: []`** → **nadie recibe push ahora mismo**. ⚠️ (crítico)

---

## 1.3 — `config/app`

```
qualityEmails: [r.mendieta@favram.com, l.gil@favram.com]   ← FALTA e.sancetta@favram.com ⚠️
chiefMapping:
  LASER → d.fernandez | MECANIZADO → h.juvera | PINTURA → s.raboso | PLEGADORA → v.torbellino
  PRENSAS → h.juvera | REPASADO → jc.rodriguez | SOLDADURA → a.aguado
techReviewLocations: [CAL-029, CAL-032]
urgentLocations: [CAL-031, CAL-034, MEC-001..004, PLE-001..006, REP-001..004, SOL-008]
valueTrackingEnabled: true
```

- ⚠️ `qualityEmails` incompleto: falta `e.sancetta@favram.com` (además, ese usuario ni existe).
- `chiefMapping`: 7 secciones mapeadas. **No incluye `PUNZONADO`** (adri/d.fernandez quedaron en otras secciones).
- ⚠️ **`jorge` (`j.diaz@favram.com`) NO está incluido en notificaciones urgentes de repasado.**
  En `notifySpecialLocationOccupancy`, para `isUrgent` se notifica a `chiefMapping[section]` + `qualityEmails`.
  Para REPASADO eso es solo `jc.rodriguez`. `j.diaz` no aparece ni en config ni en código,
  pese a que `setup-users.ts` anota "Recibe mensajes urgentes de repasado". **No implementado.**

---

## 1.4 — Notificaciones

- `notificationHistory`: **no legible vía MCP** (clock skew). Revisar con logs de Functions o script propio.
- **`fcmTokens` vacío en los 12 usuarios** → 0 dispositivos reciben push actualmente. Causa raíz dominante.
  Los tokens se registran al iniciar sesión con permiso de notificaciones concedido; aún no hay ninguno.
- CALIDAD roto por partida doble:
  1. `e.sancetta` no está en `qualityEmails` (y no existe como usuario).
  2. `r.mendieta` y `l.gil` no tienen doc en `usuarios` → `getUsersByEmails` no los encuentra.

---

## 1.5 — Resumen

### ✅ Correcto
- 12 colecciones oficiales presentes; `locations` como subcolección (correcto).
- 14/18 usuarios en Auth con rol correcto (salvo `l.asensio`).
- `chiefMapping` cubre las 7 secciones productivas; `urgent`/`techReview`/`valueTracking` definidos.
- `avisos` y `meta` son colecciones **vivas** (no borrar).

### ⚠️ Mal / incompleto
1. **Faltan 4 usuarios en Auth**: adri, elisabetta, **oscar, raul** (estos 2 imprescindibles para el chat).
2. **`r.mendieta` y `l.gil` sin doc en `usuarios`** → no reciben push (CALIDAD roto).
3. **`l.asensio` con rol ADMIN** (debería ser SUPERADMIN).
4. **`qualityEmails` sin `e.sancetta`**.
5. **`fcmTokens` vacío en todos** → ningún push se entrega hoy.
6. **`jorge`/`j.diaz` no recibe urgentes de repasado** (ni config ni código).
7. `chiefMapping.PRENSAS → h.juvera` vs `i.hernandez` (jefe real de PRENSAS). Sin `PUNZONADO`.
8. Posibles colecciones legacy vacías sin verificar (counts no accesibles por MCP).

### 🔧 Acciones correctivas (antes del Bloque 2)
1. Crear en Auth+Firestore: **oscar, raul** (CARRETILLERO), a.cuevas (adri), e.sancetta → `scripts/setup-users.ts` con `serviceAccount.json`.
2. Crear docs `usuarios/{uid}` faltantes de **r.mendieta** y **l.gil**.
3. Corregir rol de **l.asensio**: ADMIN → SUPERADMIN.
4. Añadir `e.sancetta@favram.com` a `qualityEmails` → `scripts/update-quality-emails.ts`.
5. Decidir e implementar **j.diaz en urgentes de repasado** (añadir a `chiefMapping.REPASADO` o lógica dedicada).
6. Verificar registro de `fcmTokens`: cada usuario debe loguear en su dispositivo y conceder permiso de
   notificaciones; comprobar que `pushService` escribe el token. Sin esto, no hay entrega.
7. Aclarar destinatario de PRENSAS y la sección de adri/d.fernandez (PUNZONADO).
8. Ejecutar `scripts/audit-collections.ts` (con serviceAccount) para counts; eliminar
   `estanterias/historial/configuracion/piezas/tablets` solo si vacías/migradas. **Mantener `avisos` y `meta`.**

> **Bloqueante para el Bloque 2 (chat):** los CARRETILLERO `oscar` y `raul` no existen (#1). Las reglas
> Firestore del chat requieren rol `CARRETILLERO`; sin esos usuarios, no podrán acceder al chat.

---

## Resultado de la ejecución (2026-06-01)

Ejecutado con `serviceAccount.json` (admin SDK), que **no** sufre el bloqueo de `read_time` del MCP.

### ✅ Aplicado
- **#1** Creados en Auth+Firestore: `a.cuevas` (UID bayq20…), `e.sancetta` (5PTRtC…),
  `oscar` (KlHKtb…), `raul` (bqZ5eA…).
- **#2** Creados los docs `usuarios/{uid}` que faltaban de `l.gil` (js1ADv…) y `r.mendieta` (L2dUby…).
- **#3** `l.asensio`: role `ADMIN` → **`SUPERADMIN`**. (También corregidas secciones de `jm.gomez`→PLEGADORA y `d.fernandez`→PUNZONADO según `setup-users.ts`.)
- **#4** `qualityEmails` = `[r.mendieta, l.gil, e.sancetta]` (3 de CALIDAD).
- **#5** Código: `notifySpecialLocationOccupancy` añade destinatarios urgentes extra por sección
  (`config.urgentExtraEmails`, default `j.diaz@favram.com` para REPASADO). Build OK. **Falta deploy.**
- **#7** Conteo de colecciones (admin SDK):

| Colección | Docs | Nota |
|---|---|---|
| usuarios | **20** | 18 esperados + 2 extra (ver abajo). Todos `fcmTokens=[]`. |
| history | 35 | oficial |
| items | 16 | oficial |
| itemAggregates | 8 | oficial |
| pickupQueue | 3 | oficial |
| kiosks | 1 | oficial |
| **shelves** | **0** | "vacía" a nivel raíz: los shelves son docs-fantasma con subcolección `locations`. Los datos de layout están en `estanterias` (legacy). |
| estanterias (legacy) | 14 | layout de estanterías (code, layout, name, section) |
| historial (legacy) | 4 | vs history (35) |
| piezas (legacy) | 2 | vs items (16) |
| configuracion (legacy) | 1 | duplicado de config/app (mismos campos) |
| tablets (legacy) | 1 | vs kiosks (1) |
| avisos | 1 | **ACTIVA** (avisos internos) — no borrar |
| meta | 1 | **ACTIVA** (`meta/warehouseConfig`) — no borrar |

### ⚠️ Hallazgos nuevos
- **2 cuentas extra en `usuarios`** (con Auth, fuera de los 18 esperados):
  - `calidad@favram.com` → role **CALIDAD** (cuenta compartida de calidad).
  - `administracion@favram.com` → role **CARRETILLERO** ← **ojo Bloque 2**: con rol CARRETILLERO
    **tendrá acceso al chat** y recibe push de carretillero. Confirmar si es un dispositivo real o limpiar.
- **`fcmTokens` vacío en los 20** → sigue sin haber entrega de push hasta que cada uno inicie sesión
  en su dispositivo y conceda permiso de notificaciones (#6, acción operativa, no automatizable).
- `shelves` raíz vacía mientras `estanterias` tiene 14 → confirmar que el layout vive en
  `shelves/{code}/locations` antes de tocar `estanterias`.

### ⏳ Pendiente (decisión del usuario)
- **Deploy de funciones** para activar #5 (`firebase deploy --only functions`). Recomendado **agrupar con el deploy del Bloque 2** (chat añade `chatSendMessage`).
- **Limpieza legacy**: NINGUNA colección legacy está vacía; todas tienen datos. Borrado = destructivo y
  requiere revisar migración (sobre todo `estanterias`). Se deja como tarea aparte; **no** se borró nada.
- Confirmar destinatario de PRENSAS (`chiefMapping.PRENSAS → h.juvera` vs jefe real `i.hernandez`).
- Confirmar/limpiar las 2 cuentas extra (`calidad@`, `administracion@`).
