# 📋 PLAN DE EJECUCIÓN: MIGRACIÓN SOLDADURA + AUDITORÍA BD
**Fecha:** 2026-06-09  
**Status:** ✅ LISTO PARA EJECUTAR

---

## 📊 RESUMEN DE CAMBIOS

| Componente | Estado | Detalles |
|-----------|--------|----------|
| **shelves.ts** | ✅ Actualizado | 73 ubicaciones (7x13) |
| **migrate-SOL-structure.ts** | ✅ Creado | Script de migración 54→73 |
| **audit-BD-complete.ts** | ✅ Creado | Auditoría completa de BD |
| **admin.ts** | ✅ Integrado | Operaciones adminOperate |
| **Cloud Functions** | ⏳ Pendiente | Necesita deploy |

---

## 🚀 PLAN DE EJECUCIÓN

### FASE 1: AUDITORÍA (Verificar problemas)

**Objetivo:** Identificar bugs e inconsistencias en BD antes de migrar

**Pasos:**
1. ✅ Deploy de funciones actualizadas
   ```bash
   firebase deploy --only functions
   ```

2. ✅ Ejecutar auditoría desde consola del navegador
   ```javascript
   adminOperate({
     op: 'auditDatabase',
     payload: {}
   }).then(r => {
     console.log('AUDITORÍA:', r.data);
     console.table(r.data.issues);
   });
   ```

3. ✅ Analizar resultados
   - Buscar problemas CRITICAL (🔴)
   - Anotar advertencias (🟡)
   - Revisar integridad referencial

**Duración estimada:** 2-5 minutos (depende del tamaño de BD)

---

### FASE 2: CORRECCIONES (Si hay problemas críticos)

**Si se encuentran CRITICAL issues:**

1. **LOCATION_COUNT_MISMATCH**
   - Causa: Ubicaciones faltantes o extra
   - Solución: Recrear ubicaciones faltantes / eliminar extras

2. **LOCATION_STRUCTURE**
   - Causa: Campo items corrupto
   - Solución: Restaurar desde backup o corregir campos

3. **REFERENTIAL_INTEGRITY**
   - Causa: Ubicaciones urgentes/tech-review que no existen
   - Solución: Limpiar referencias o crear ubicaciones

4. **MISSING_SHELF**
   - Causa: Estantería esperada no en BD
   - Solución: Ejecutar seed para estantería faltante

---

### FASE 3: MIGRACIÓN SOLDADURA

**Objetivo:** Cambiar estructura de SOLDADURA de 54 a 73 ubicaciones

**Pasos:**
1. ✅ Verificar que auditoría no tenga CRITICAL issues
2. ✅ Ejecutar migración desde consola
   ```javascript
   adminOperate({
     op: 'migrateSoldadura',
     payload: {}
   }).then(r => {
     console.log('MIGRACIÓN COMPLETADA:', r.data);
   });
   ```

3. ✅ Esperar confirmación en console
4. ✅ Verificar resultados

**Duración estimada:** 1-2 minutos

---

### FASE 4: VALIDACIÓN POST-MIGRACIÓN

**Verificar en Firestore:**

1. Colección `shelves/SOL/locations`
   - ✓ Debe tener 73 documentos
   - ✓ Documentos: 001-073 (todos con items array vacío)

2. Documento `shelves/SOL`
   - ✓ `locationCount: 73`
   - ✓ `layout.physicalBlocks[0].rows` tiene 7 arrays de 13 elementos

3. En la app
   - ✓ Ir a ShelfRackView → SOLDADURA
   - ✓ Debe mostrar 7 filas × 13 columnas
   - ✓ Ubicaciones van de 001 a 073

---

## 🔍 AUDITORÍA: CATEGORÍAS A VERIFICAR

```
┌─────────────────────────────────────────────────────┐
│ PROBLEMAS CRÍTICOS (Corregir primero)              │
├─────────────────────────────────────────────────────┤
│ 🔴 LOCATION_COUNT_MISMATCH                         │
│    → Ubicaciones inconsistentes en BD              │
│                                                     │
│ 🔴 LOCATION_STRUCTURE                              │
│    → Campos de ubicación corrompidos               │
│                                                     │
│ 🔴 MISSING_SHELF                                   │
│    → Estantería esperada no existe                 │
│                                                     │
│ 🔴 REFERENTIAL_INTEGRITY                           │
│    → Referencias rotas a ubicaciones               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ADVERTENCIAS (Revisar y posiblemente corregir)     │
├─────────────────────────────────────────────────────┤
│ 🟡 LOCATION_FORMAT                                 │
│    → Ubicaciones con formato incorrecto            │
│                                                     │
│ 🟡 ITEM_STRUCTURE                                  │
│    → Items sin campos requeridos                   │
│                                                     │
│ 🟡 USER_STRUCTURE                                  │
│    → Usuarios con datos faltantes                  │
│                                                     │
│ 🟡 DEVICE_STRUCTURE                                │
│    → Dispositivos mal configurados                 │
│                                                     │
│ 🟡 SHELF_MISMATCH                                  │
│    → Nombre o data inconsistente con definición    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ INFORMATIVOS (Solo notificación)                   │
├─────────────────────────────────────────────────────┤
│ 🔵 CONFIG                                          │
│    → Configuración incompleta o faltante          │
└─────────────────────────────────────────────────────┘
```

---

## 📈 CHECKLIST DE EJECUCIÓN

### PRE-EJECUCIÓN
- [ ] Usuario logueado como SUPERADMIN
- [ ] BD tiene backup reciente
- [ ] Consola del navegador abierta
- [ ] Funciones deployadas (`firebase deploy --only functions`)

### FASE 1: AUDITORÍA
- [ ] Ejecutar `adminOperate({ op: 'auditDatabase' })`
- [ ] Revisar resumen de problemas
- [ ] Anotar problemas críticos
- [ ] Tomar screenshot del resultado

### FASE 2: CORRECCIONES (Si aplica)
- [ ] Identificar root cause de cada problema crítico
- [ ] Ejecutar correcciones correspondientes
- [ ] Re-ejecutar auditoría para validar

### FASE 3: MIGRACIÓN
- [ ] Confirmar que no hay problemas críticos
- [ ] Ejecutar `adminOperate({ op: 'migrateSoldadura' })`
- [ ] Esperar confirmación en console
- [ ] Tomar screenshot

### POST-MIGRACIÓN
- [ ] Verificar 73 ubicaciones en Firestore
- [ ] Verificar layout en la app (7x13)
- [ ] Probar ubicar artículo en SOLDADURA
- [ ] Verificar persistencia de datos

---

## 🎯 ERRORES ESPERADOS Y SOLUCIONES

### "Permission denied"
```
→ Usuario no es SUPERADMIN o token expirado
  Solución: Recargar página, verificar rol
```

### "Module not found: firebase-functions"
```
→ Funciones no están deployadas
  Solución: Ejecutar firebase deploy --only functions
```

### "Cannot find module '../scripts/...'"
```
→ Import path incorrecto en admin.ts
  Solución: Verificar rutas relativas en imports
```

### "Auditoría tarda mucho (>5 minutos)"
```
→ Normal si BD es grande (>100MB)
  Solución: No interrumpir, esperar a completación
```

### "LOCATION_COUNT_MISMATCH después de migración"
```
→ Ubicaciones antiguas no se eliminaron completamente
  Solución: Ejecutar script de limpieza manual
```

---

## 📝 COMANDOS RÁPIDOS

```bash
# Deploy funciones
firebase deploy --only functions

# Ver logs de funciones
firebase functions:log --limit 50

# Descargar backup de SOL
gsutil cp -r gs://tu-proyecto.appspot.com/shelves/SOL ./backups/

# Limpiar completamente SOL (DESTRUCTIVO - solo en desarrollo)
firebase firestore:delete --recursive shelves/SOL/locations
```

---

## 🎬 SCRIPTS DE CONSOLA

### Ejecutar TODO en orden
```javascript
async function executeMigrationFlow() {
  try {
    console.log('=== INICIANDO AUDITORÍA ===');
    const auditResult = await adminOperate({
      op: 'auditDatabase',
      payload: {}
    });
    
    console.log('AUDITORÍA COMPLETA:', auditResult.data.summary);
    console.table(auditResult.data.issues.filter(i => i.severity === 'CRITICAL'));
    
    if (auditResult.data.summary.critical === 0) {
      console.log('\n✅ Sin problemas críticos. Procediendo con migración...');
      
      const migrateResult = await adminOperate({
        op: 'migrateSoldadura',
        payload: {}
      });
      
      console.log('✅ MIGRACIÓN COMPLETADA:', migrateResult.data);
    } else {
      console.error('⚠️ Hay problemas críticos. Corregir primero.');
    }
  } catch (e) {
    console.error('❌ ERROR:', e);
  }
}

// Ejecutar
executeMigrationFlow();
```

---

## ✅ VALIDACIÓN FINAL

Después de todo, ejecuta:

```javascript
// Verificar SOLDADURA
const shelfSnap = await db.collection('shelves').doc('SOL').get();
const shelfData = shelfSnap.data();
console.log('SOL locationCount:', shelfData.locationCount); // Debe ser 73
console.log('SOL layout filas:', shelfData.layout.physicalBlocks[0].rows.length); // Debe ser 7
console.log('SOL layout columnas:', shelfData.layout.physicalBlocks[0].rows[0].length); // Debe ser 13

const locsSnap = await db.collection('shelves/SOL/locations').get();
console.log('Total ubicaciones en BD:', locsSnap.size); // Debe ser 73
```

---

**Status Actual:** ✅ Listo para ejecutar  
**Próximo paso:** Deploy de funciones + Ejecutar auditoría  
**Responsable:** Usuario SUPERADMIN
