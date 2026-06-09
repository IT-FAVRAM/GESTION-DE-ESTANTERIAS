# ✅ CHECKLIST DE TESTING MANUAL - 2026-06-09

## 🎯 OBJETIVO
Verificar que todos los bugs de alta severidad están corregidos y que el sistema de notificaciones funciona perfectamente con todos los roles.

---

## 📋 TESTS A REALIZAR

### TEST 1: Ubicaciones URGENTES en SOLDADURA (Visual)
**Responsable:** Dani (Tester)  
**Tiempo:** 5 min

```
Pasos:
  1. Abrir app en navegador
  2. Ir a SOLDADURA (SOL)
  3. Verificar que ubicaciones 001-004 están en ROJO (#ef4444)
  4. Verificar que ubicaciones 005-073 están en AZUL (#3b82f6)
  
Resultado esperado: ✓ Ubicaciones rojas y azules correctas

Evidencia a capturar:
  □ Screenshot de grid SOL con colores
```

---

### TEST 2: OPERARIO - Ubicación en Lote (Estantería Asignada)
**Rol:** OPERARIO  
**Tiempo:** 10 min

```
Precondición:
  - User con role OPERARIO asignado a PRE-001
  - Dispositivo registrado como KIOSK PRE

Pasos:
  1. Login como OPERARIO
  2. Ir a PRE (Prensas)
  3. Escanear artículo: ABC001
  4. Escanear OF: ORD-2026-001
  5. Sistema pregunta: "¿Ubicar en lote?"
  6. Responder: SÍ
  7. Seleccionar posiciones: 7, 8, 9 (contiguas)
  8. Confirmar

Resultado esperado:
  ✓ Ubicación en 3 posiciones sin error
  ✓ Notificación email a jefe PRENSAS
  ✓ Notificación push en dispositivo
  ✓ Registro en notificationHistory

Evidencia:
  □ Email recibido
  □ Push notif screenshot
  □ Console log "shelfOperate success"
  
Error si:
  ✗ Posiciones 7, 9, 11 (no-contiguas): Debe rechazar
```

---

### TEST 3: CARRETILLERO - MOVER Entre Estanterías (BUG #2 FIX)
**Rol:** CARRETILLERO  
**Tiempo:** 15 min

```
Precondición:
  - Artículo ABC002 ubicado en SOL-010
  - User con role CARRETILLERO
  - Dispositivo móvil registrado

Pasos:
  1. Login como CARRETILLERO
  2. Ir a SOL (Soldadura)
  3. Verificar que ve artículo ABC002 en posición 10
  4. Ejecutar acción MOVER
  5. Escanear código ABC002
  6. Sistema busca globalmente
  7. Resultado: Encuentra en SOL-010
  8. Cambiar a MEC (Mecanizado)
  9. Seleccionar posición destino: MEC-005
  10. Confirmar MOVER

Resultado esperado:
  ✓ Artículo encontrado globalmente (NO solo en MEC)
  ✓ Se mueve de SOL-010 a MEC-005
  ✓ Notificación a Jefe MECANIZADO
  ✓ Sin error "no encontrado"

Evidencia:
  □ Artículo desaparece de SOL-010
  □ Artículo aparece en MEC-005
  □ Email a Jefe MECANIZADO
  □ Console: "mover success"

Error si:
  ✗ Mensaje "ABC002 no encontrado en MEC" (BUG NO CORREGIDO)
```

---

### TEST 4: CARRETILLERO - Ubicación Multi-Bloque PLEGADORA (BUG #3 FIX)
**Rol:** CARRETILLERO  
**Tiempo:** 15 min

```
Precondición:
  - Posiciones 31-34 están disponibles en PLEGADORA
  - Span múltiples bloques físicos (ple-punz)

Pasos:
  1. Login como CARRETILLERO
  2. Ir a PLEGADORA (PLE)
  3. Escanear artículo: XYZ789
  4. Escanear OF: ORD-2026-002
  5. Sistema pregunta: "¿Ubicar en lote?"
  6. Responder: SÍ
  7. Seleccionar posiciones: 31, 32, 33, 34
  8. Validación: Verifica contigüidad
  9. Confirmar

Resultado esperado:
  ✓ Ubicación PERMITIDA (multi-bloque OK en PLE)
  ✓ Mensaje: "4 posiciones contiguas (multi-bloque)"
  ✓ 4 artículos ubicados en PLE
  ✓ Notificación a Jefe PLEGADORA

Evidencia:
  □ 4 posiciones ocupadas
  □ Sin error "mismo bloque físico"
  □ Email a Jefe PLEGADORA
  □ Console: "Located in 4 positions across blocks"

Error si:
  ✗ Mensaje "Las posiciones deben estar en el mismo bloque" (BUG NO CORREGIDO)
```

---

### TEST 5: JEFE_SECCION - Permiso Vaciar Sección (BUG #5 FIX)
**Rol:** JEFE_SECCION  
**Tiempo:** 10 min

```
Precondición:
  - JEFE_SECCION asignado a SOLDADURA
  - SOL tiene artículos ubicados

Pasos:
  1. Login como JEFE_SECCION SOLDADURA
  2. Ir a SOLDADURA (SOL)
  3. Encontrar botón: "Vaciar estantería"
  4. Click en "Vaciar"
  5. Confirmar: "¿Seguro vaciar toda SOL?"
  6. Responder: SÍ

Resultado esperado:
  ✓ Estantería se vacía completamente
  ✓ Todas las ubicaciones quedan vacías
  ✓ Permiso concedido (no error "Only ADMIN")
  ✓ Notificación a nivel superior

Evidencia:
  □ Todas las celdas vacías (isEmpty: true)
  □ Sin error "Solo admin puede vaciar"
  □ Email a ADMIN (notificación superior)
  □ Console: "emptyShelf success"

Error si:
  ✗ Mensaje "No tienes permisos para vaciar" (BUG NO CORREGIDO)
```

---

### TEST 6: CALIDAD - Ubicación en Reprocesos (Importe/Cantidad)
**Rol:** CALIDAD  
**Tiempo:** 15 min

```
Precondición:
  - User CALIDAD
  - Configuración reprocesos habilitada (CAL-001 a CAL-022)

Pasos:
  1. Login como CALIDAD
  2. Ir a CAL (Calidad)
  3. Escanear artículo: REP456
  4. Escanear OF: ORD-2026-003
  5. Sistema pregunta: "¿Ubicar en lote?"
  6. Responder: SÍ
  7. Seleccionar posiciones: 001, 002, 003 (reprocesos)
  8. Modal aparece: "Solicitar importe/cantidad"
  9. Ingresar: EUR 75.50, 25 pzas
  10. Confirmar

Resultado esperado:
  ✓ Ubicación en reprocesos con datos
  ✓ Importe EUR 75.50 registrado
  ✓ Cantidad 25 pzas registrado
  ✓ Notificación a CALIDAD lead
  ✓ Ubicaciones CAL-023+ (no reproceso): Sin modal

Evidencia:
  □ Datos guardados en BD
  □ Query: db.collection('shelves').doc('CAL').collection('locations').doc('001').get()
    {items: [{...importe: 75.50, quantity: 25}]}
  □ Email a CALIDAD
  □ Console: "Ubicación reproceso registrada"

Error si:
  ✗ Modal no aparece
  ✗ Datos no se guardan
```

---

### TEST 7: ADMIN - Multi-Estantería Sin Restricción
**Rol:** ADMIN  
**Tiempo:** 15 min

```
Precondición:
  - User ADMIN
  - Múltiples estanterías disponibles

Pasos:
  1. Login como ADMIN
  2. Ir a SOLDADURA (SOL)
  3. Escanear artículo: ADM999
  4. Escanear OF: ORD-2026-004
  5. Sistema pregunta: "¿Ubicar en lote?"
  6. Responder: SÍ
  7. Seleccionar SOL-010
  8. Cambiar a PLEGADORA (PLE)
  9. Seleccionar PLE-040
  10. Confirmar ubicar en 2 estanterías

Resultado esperado:
  ✓ Ubicación en SOL-010 OK
  ✓ Ubicación en PLE-040 OK
  ✓ Notificación a Jefe SOLDADURA
  ✓ Notificación a Jefe PLEGADORA
  ✓ Sin restricción por estantería

Evidencia:
  □ Artículo en SOL-010
  □ Artículo en PLE-040
  □ 2 emails recibidos
  □ Console: "Multi-shelf operation success"

Error si:
  ✗ Rechazo por "no tienes permisos"
  ✗ Solo ubica en 1 estantería
```

---

### TEST 8: Notificaciones - Email + Push Combinadas
**Rol:** CARRETILLERO + Jefe receptores  
**Tiempo:** 20 min

```
Setup:
  - CARRETILLERO en dispositivo móvil
  - Jefe con email y FCM token registrado
  - Config con chiefMapping y qualityEmails

Pasos:
  1. Login CARRETILLERO
  2. Ir a SOLDADURA (SOL)
  3. Escanear artículo: NOT001
  4. Escanear OF: ORD-2026-005
  5. Seleccionar ubicación: SOL-001 (URGENTE)
  6. Confirmar ubicación
  7. Esperar 3 segundos
  8. Revisar:
     - Email en bandeja jefe@company.com
     - Push notification en dispositivo jefe
     - Historial en Firestore

Verificar canales:
  Email:
    ✓ De: noreply@firebase.com
    ✓ Asunto: "Articulo urgente ubicado"
    ✓ Body: "NOT001 ORD-2026-005 ha sido ubicado en SOL-001"
    ✓ Destinatarios: Jefe SOLDADURA + CALIDAD

  FCM Push:
    ✓ Título: "Articulo urgente ubicado"
    ✓ Mensaje: "NOT001 ORD-2026-005 en SOL-001"
    ✓ Tipo: "URGENT_LOCATION"
    ✓ Prioridad: high

  Firestore:
    ✓ Collection: notificationHistory
    ✓ title: "Articulo urgente ubicado"
    ✓ body: "NOT001 ORD-2026-005 ha sido ubicado en SOL-001"
    ✓ data.type: "URGENT_LOCATION"
    ✓ sentAt: timestamp válido
    ✓ successCount: > 0

Evidencia:
  □ Screenshot email
  □ Screenshot push en dispositivo
  □ Firestore query output
  □ Cloud Functions logs
```

---

### TEST 9: Contigüidad Negativa - Rechaza No-Contiguas
**Rol:** Cualquiera  
**Tiempo:** 5 min

```
Pasos:
  1. Ir a cualquier estantería
  2. Escanear artículo: BAD001
  3. Sistema pregunta: "¿Ubicar en lote?"
  4. Responder: SÍ
  5. Seleccionar posiciones: 5, 7, 10 (NO CONTIGUAS)
  6. Sistema valida

Resultado esperado:
  ✗ Rechazo: "❌ Las posiciones deben ser contiguas"
  ✗ Mensaje claro
  ✗ Permiso denegado

Evidencia:
  □ Error message en toast
  □ No se ubica nada
  □ Posiciones quedan sin seleccionar
```

---

## 📊 RESUMEN DE TESTS

| Test # | Nombre | Rol | Bugs Validados | Status |
|--------|--------|-----|-----------------|--------|
| 1 | Colores Urgencias | - | Visual | ☐ |
| 2 | OPERARIO Lote | OPERARIO | Contigüidad | ☐ |
| 3 | CARRETILLERO MOVER | CARRETILLERO | BUG #2 | ☐ |
| 4 | CARRETILLERO Multi-Bloque | CARRETILLERO | BUG #3 | ☐ |
| 5 | JEFE Vaciar | JEFE_SECCION | BUG #5 | ☐ |
| 6 | CALIDAD Reprocesos | CALIDAD | Notif | ☐ |
| 7 | ADMIN Multi-Est | ADMIN | Permisos | ☐ |
| 8 | Notificaciones | All | Notif Sys | ☐ |
| 9 | Contigüidad Neg | All | Validación | ☐ |

---

## ✅ RESULTADO FINAL

**Todos los tests DEBEN pasar para deploy a producción**

```
Total tests: 9
Críticos: 5 (Tests 2,3,4,5,8)
Complementarios: 4 (Tests 1,6,7,9)

Criterio éxito:
  ✅ Todos tests críticos: PASS
  ✅ Todos tests complementarios: PASS
  ✅ Sin errores inesperados
  ✅ Documentación actualizada
```

---

**Responsable Testing:** Dani (d.soler@favram.com)  
**Fecha Target:** 2026-06-09  
**Tiempo Total:** ~2 horas  

¡ÉXITO! 🚀