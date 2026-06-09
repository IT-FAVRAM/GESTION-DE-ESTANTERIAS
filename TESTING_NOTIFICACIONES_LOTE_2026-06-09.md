# 📋 TESTING EXHAUSTIVO: Notificaciones + Ubicación en Lote
**Fecha:** 2026-06-09  
**Status:** Listo para Testing  

---

## ✅ FIXES APLICADOS HOY

### FIX #1: Contigüidad Multi-Bloque (Alta Severidad)
**Archivo:** `contiguityValidator.ts`

**Problema:** No se podía ubicar en múltiples bloques físicos (ej: PLEGADORA, REPASADO)

**Solución:** Permitir múltiples bloques SOLO en estanterías que lo soportan (PLE, REP, PIN)

```typescript
// Ahora permite:
- Ubicar en posiciones 31, 32, 33 (múltiples bloques)
- Ubicar en posiciones 1, 2 (mismo bloque)
- Rechaza posiciones no consecutivas (31, 33 sin 32)
```

### FIX #2: MOVER Entre Estanterías (Alta Severidad)
**Archivo:** `useOperativeShelf.ts` línea 759-768

**Problema:** MOVER solo buscaba en estantería actual

**Solución:** MOVER ahora busca en todas las estanterías globalmente

```typescript
// Antes:
findArticle(articleCode, orderFab) // Busca solo en shelfCode actual

// Ahora:
findArticleGlobal(articleCode, orderFab) // Busca en todas las estanterías
```

---

## 🔔 FLUJOS DE NOTIFICACIÓN POR ROL

### ROL: OPERARIO

**Ubicación en estantería asignada:**

```
OPERARIO (PRE-001, MEC-001, etc.) ubica artículo en su estantería
  └─ ¿Es ubicación URGENTE?
      ├─ SÍ → Notificación a Jefe SOLDADURA (si aplica)
      └─ NO → Notificación a Jefe OPERARIO (según sección)

Canales:
  ├─ Email: jefe@company.com
  ├─ FCM Push: dispositivo registrado
  └─ History: notificationHistory en Firestore
```

**Tabla de Ubicaciones URGENTES:**
| Estantería | Ubicaciones | Jefe Notificado |
|-----------|-------------|-----------------|
| PRE (Prensas) | URG-001 a URG-004 | Jefe PRENSAS_MECANIZADO |
| MEC (Mecanizado) | URG-001 a URG-004 | Jefe PRENSAS_MECANIZADO |
| SOL (Soldadura) | 001-004 | Jefe SOLDADURA |
| PLE (Plegadora) | 001-006 | Jefe PLEGADORA |

### ROL: CARRETILLERO

**Ubicación en CUALQUIER estantería:**

```
CARRETILLERO ubica artículo en estantería A, B, C, ...
  └─ ¿Es ubicación URGENTE?
      ├─ SÍ → Notificación a Jefe de esa sección
      ├─ SÍ → Notificación a CALIDAD
      └─ NO → Solo notificación a Jefe de sección
```

**Notificaciones Prioritarias:**
1. URGENTE + CALIDAD → Email + Push a ambas
2. URGENTE (no CALIDAD) → Email + Push a Jefe
3. Regular (SOLDADURA) → Email + Push a Jefe

### ROL: JEFE_SECCION

**Ubicación en su sección asignada:**

```
JEFE_SECCION (SOLDADURA) ubica en SOL, RSO, SXP
  └─ ¿Es ubicación URGENTE?
      ├─ SÍ → Notificación a Jefe superior
      └─ NO → Sin notificación (se notifica a sí mismo)
```

**Excepciones:**
- JEFE_SECCION NO recibe notificaciones de sí mismo
- JEFE_SECCION PUEDE vaciar su sección (fix aplicado)

### ROL: CALIDAD

**Ubicación SOLO en CAL (Calidad):**

```
CALIDAD ubica en CAL-001 a CAL-034
  └─ Ubicaciones 001-022 (Reprocesos)?
      ├─ SÍ → Notificación a CALIDAD lead + responsables
      ├─ SÍ → Modal solicita Importe/Cantidad
      └─ NO → Notificación estándar a Jefe CALIDAD
```

**Casos Especiales - Notificación a Equipo Técnico:**
- Ubicación en CAL-TAR-001 (TAR = Técnica) → Notifica a equipo TAR
- Ubicación en reprocesos → Notifica al ubicador previo

### ROL: ADMIN

**Ubicación en TODAS las estanterías:**

```
ADMIN ubica en A, B, C, ... (sin restricciones)
  └─ ¿Es ubicación URGENTE?
      ├─ SÍ → Notificación a todos los jefes de sección
      └─ NO → Notificación solo a Jefe de esa estantería

Restricción especial:
  └─ ADMIN todavía respeta contigüidad (diseño intencional)
```

### ROL: SUPERADMIN

**Ubicación en TODAS las estanterías:**

```
SUPERADMIN ubica en A, B, C, ... (sin restricciones)
  └─ SUPERADMIN puede:
      ├─ Ignorar contigüidad (si configura así)
      ├─ Ubicar en cualquier posición
      ├─ Actualizar urgencias (adminOperate)
      └─ Bypass de todas las validaciones (configurables)
```

---

## 📦 UBICACIÓN EN LOTE - TESTING POR ROL

### Caso 1: OPERARIO Ubicación en Lote
**Escenario:** OPERARIO ubica 3 artículos iguales en 3 posiciones contiguas

```
Entrada:
  └─ Artículo: ABC123, OF: ORD-001
  └─ Posiciones: 7, 8, 9 (contiguas en PRE-001)
  └─ Rol: OPERARIO
  └─ Sección: PRENSAS_MECANIZADO

Proceso:
  1. Escanear código ABC123
  2. Escanear OF ORD-001
  3. Sistema pregunta: "¿Ubicar en lote? Sí/No"
  4. Seleccionar 3 posiciones (7, 8, 9)
  5. Validar contigüidad ✓ (misma fila)
  6. Confirmar ubicación

Salida esperada:
  ✓ 3 artículos ubicados en posiciones 7, 8, 9
  ✓ Notificación a Jefe PRENSAS_MECANIZADO
  ✓ Registro en notificationHistory
  ✓ Ubicaciones NO contiguas → ERROR ✓
```

**Test de Validación - Fallos Esperados:**
```
❌ Posiciones 7, 9 (sin 8): "Las posiciones deben ser contiguas"
❌ Posiciones 7, 13 (diferente bloque en PRE): Error según estantería
✓ Posiciones 7, 8, 9: OK
```

### Caso 2: CARRETILLERO Ubicación en Lote Multi-Estantería
**Escenario:** CARRETILLERO ubica en PLEGADORA (multi-bloque)

```
Entrada:
  └─ Artículo: XYZ789, OF: ORD-002
  └─ Posiciones: 31, 32, 33 (múltiples bloques en PLE)
  └─ Rol: CARRETILLERO
  └─ Estantería origen: Desconocida (CARRETILLERO mobile)

Proceso:
  1. Escanear código XYZ789
  2. Sistema pregunta: "¿Ubicar en lote?"
  3. Seleccionar 3 posiciones (31, 32, 33)
  4. Validar contigüidad ✓ (multi-bloque permitido en PLE)
  5. Confirmar ubicación

Salida esperada:
  ✓ 3 artículos ubicados
  ✓ Notificación a Jefe PLEGADORA
  ✓ Sin restricción de bloque físico
  ✓ FIX #1 funcionando correctamente
```

### Caso 3: JEFE_SECCION Ubicación en Lote (Su Sección)
**Escenario:** JEFE_SECCION SOLDADURA ubica en SOL

```
Entrada:
  └─ Artículo: DEF456, OF: ORD-003
  └─ Posiciones: 10, 11, 12 (contiguas en SOL)
  └─ Rol: JEFE_SECCION
  └─ Sección asignada: SOLDADURA

Proceso:
  1. Escanear artículo
  2. Sistema pregunta: "¿Ubicar en lote?"
  3. Seleccionar posiciones 10, 11, 12
  4. Validar: JEFE_SECCION de SOLDADURA ✓
  5. Validar contigüidad ✓
  6. Confirmar

Salida esperada:
  ✓ Ubicación permitida
  ✓ Notificación a nivel superior (si existe)
  ✓ Sin notificación a sí mismo
  ✓ Permiso de vaciar sección (FIX #2) ✓
```

### Caso 4: CALIDAD Ubicación en Lote (Reprocesos)
**Escenario:** CALIDAD ubica en reprocesos (001-022 de CAL)

```
Entrada:
  └─ Artículo: REP123, OF: ORD-004
  └─ Posiciones: 1, 2, 3 (reprocesos en CAL)
  └─ Rol: CALIDAD
  └─ Sección: CALIDAD

Proceso:
  1. Escanear artículo REP123
  2. Sistema pregunta: "¿Ubicar en lote?"
  3. Seleccionar posiciones 1, 2, 3
  4. Modal aparece: "Solicitar Importe/Cantidad"
  5. Ingresar: EUR 50.00, 10 pzas
  6. Confirmar

Salida esperada:
  ✓ Ubicación con datos adicionales (importe/cantidad)
  ✓ Notificación a equipo CALIDAD
  ✓ Registro de importe/cantidad en BD
  ✓ Ubicaciones solo en reprocesos (001-022) ✓
```

### Caso 5: ADMIN Ubicación en Lote (Multi-Estantería)
**Escenario:** ADMIN ubica artículo en diferentes estanterías

```
Entrada:
  └─ Artículo: MULTI789, OF: ORD-005
  └─ Posiciones: SOL-5, PLE-10, REP-15 (diferentes estanterías)
  └─ Rol: ADMIN
  └─ Sin restricción de sección

Proceso:
  1. Escanear artículo
  2. Sistema pregunta: "¿Ubicar en lote?"
  3. Cambiar a SOL → seleccionar 5
  4. Cambiar a PLE → seleccionar 10
  5. Cambiar a REP → seleccionar 15
  6. Confirmar múltiples ubicaciones

Salida esperada:
  ✓ Ubicación en múltiples estanterías permitida
  ✓ Contigüidad validada POR ESTANTERÍA
  ✓ Notificaciones a jefes correspondientes
  ✓ Sin restricción por estantería ✓
```

### Caso 6: SUPERADMIN Ubicación No-Contigua (Bypass)
**Escenario:** SUPERADMIN ubica en posiciones NO contiguas (si está habilitado)

```
Entrada:
  └─ Artículo: BYPASS999, OF: ORD-006
  └─ Posiciones: 1, 5, 10 (NO contiguas)
  └─ Rol: SUPERADMIN
  └─ Flag: SUPERADMIN_BYPASS_CONTIGUITY = true

Proceso:
  1. Escanear artículo
  2. Seleccionar posiciones 1, 5, 10
  3. Sistema verifica SUPERADMIN + flag
  4. Validación de contigüidad se salta ✓
  5. Confirmar

Salida esperada:
  ✓ Ubicación en posiciones no-contiguas permitida (solo para SUPERADMIN)
  ✓ Notificación estándar
  ✓ Warning log en Cloud Functions (auditoría)
```

---

## 🧪 MATRIZ DE TESTING NOTIFICACIONES

### Email Verificación

| Rol | Acción | Ubicación | Email Recibido | Destinatario |
|-----|--------|-----------|-----------------|--------------|
| OPERARIO | Ubicar | PRE-7 | ✓ | Jefe PRENSAS |
| OPERARIO | Ubicar | URG-001 | ✓ | Jefe PRENSAS |
| CARRETILLERO | Ubicar | SOL-1 (URGENTE) | ✓ | Jefe SOLDADURA + CALIDAD |
| CARRETILLERO | Ubicar | SOL-5 (regular) | ✓ | Jefe SOLDADURA |
| JEFE_SECCION | Ubicar | SOL-1 (URGENTE) | ✗ | (no a sí mismo) |
| CALIDAD | Ubicar | CAL-001 (reprocesos) | ✓ | CALIDAD lead |
| ADMIN | Ubicar | SOL-1 (URGENTE) | ✓ | Todos jefes |
| SUPERADMIN | Ubicar | CUALQUIER | ✓ | Según config |

### FCM Push Verificación

| Dispositivo | Ubicación | Push Recibido | Tipo |
|-------------|-----------|---------------|------|
| Móvil OPERARIO | URG | ✓ | Push |
| Móvil CARRETILLERO | URGENTE | ✓ | High priority |
| Tablet JEFE | Su sección | ✓ | Alert |
| Desktop ADMIN | Multi-estantería | ✓ | Info |

---

## 🚨 CASOS DE ERROR A VERIFICAR

### Error #1: Contigüidad Falla
```
Acción: Ubicar en posiciones 7, 9, 11 (con huecos)
Resultado: "❌ Las posiciones deben ser contiguas"
Verificar: Error message clara ✓
```

### Error #2: MOVER Falla Antigua (Ahora Arreglada)
```
Acción: CARRETILLERO cambia Est A → B, intenta MOVER de A
Antes: "No encontrado en Estantería B" ❌
Ahora: "Artículo encontrado en 1 ubicación. Selecciona destino." ✓
```

### Error #3: Permiso Denegado (No Rol)
```
Acción: OPERARIO intenta ubicar en MEC (no asignada)
Resultado: "No tienes permisos para ubicar en MEC"
Verificar: Mensaje correcto ✓
```

### Error #4: Ubicación Fuera de Rango
```
Acción: Intentar ubicar en posición 101 en SOL (máx 73)
Resultado: Error de validación
Verificar: Error message clara ✓
```

---

## ✅ CHECKLIST FINAL

### Notificaciones
- [ ] Email recibido al ubicar URGENTE
- [ ] Push notification en dispositivo
- [ ] Historial en `notificationHistory`
- [ ] Destinatarios correctos por rol
- [ ] No envía a usuario mismo (JEFE)

### Contigüidad
- [ ] Posiciones contiguas: Permitidas ✓
- [ ] Posiciones no-contiguas: Rechazadas ✓
- [ ] Multi-bloque en PLE/REP: Permitidas ✓
- [ ] Multi-bloque en otras: Rechazadas ✓
- [ ] Mensaje error claro ✓

### MOVER
- [ ] Búsqueda global funcionando
- [ ] Encuentra en estantería anterior
- [ ] Permite seleccionar destino
- [ ] Mensaje de éxito claro

### Ubicación en Lote
- [ ] OPERARIO: Funciona en su estantería
- [ ] CARRETILLERO: Multi-estantería OK
- [ ] JEFE_SECCION: Solo en su sección
- [ ] CALIDAD: Con importe/cantidad
- [ ] ADMIN: Multi-estantería OK
- [ ] SUPERADMIN: Bypass configurables

---

**Status:** ✅ Listo para testing exhaustivo  
**Deploy:** ✅ Completado  
**Documentación:** ✅ Generada