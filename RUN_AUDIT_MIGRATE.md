# 🔧 Ejecución de Auditoría y Migración SOLDADURA

## Requisitos
- ✅ Usuario SUPERADMIN autenticado en la app
- ✅ Consola del navegador abierta (F12 → Console)
- ✅ Deploy de funciones realizado (`firebase deploy --only functions`)

## 📋 AUDITORÍA COMPLETA DE LA BD

Ejecuta esto en la consola del navegador:

```javascript
// Obtener la función de Cloud Functions
const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js');
const { getFunctions } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js');
const functions = getFunctions();
const adminOperate = httpsCallable(functions, 'adminOperate');

// Ejecutar auditoría
adminOperate({
  op: 'auditDatabase',
  payload: {}
}).then(result => {
  console.log('✅ Auditoría completada:', result.data);
  console.table(result.data.issues);
}).catch(error => {
  console.error('❌ Error:', error.message);
});
```

### O simplemente (si ya tienes las funciones importadas en la app):

```javascript
// Desde la consola cuando la app ya está corriendo
window.adminOperate = window.adminOperate || (await import(...));

adminOperate({
  op: 'auditDatabase',
  payload: {}
}).then(r => {
  console.log('AUDITORÍA RESULTADO:', r.data);
  console.table(r.data.issues);
  // Exportar a JSON si lo necesitas
  copy(JSON.stringify(r.data.issues, null, 2));
}).catch(e => console.error('Error:', e));
```

## 🚀 MIGRACIÓN SOLDADURA (54 → 73)

Ejecuta en la consola del navegador:

```javascript
adminOperate({
  op: 'migrateSoldadura',
  payload: {}
}).then(result => {
  console.log('✅ Migración completada:', result.data);
  console.log('SOLDADURA ahora tiene 73 ubicaciones (7 filas x 13 columnas)');
}).catch(error => {
  console.error('❌ Error en migración:', error.message);
});
```

## 📊 VERIFICACIÓN POST-EJECUCIÓN

Después de la auditoría o migración, verifica en Firestore:

### Para AUDITORÍA
1. Revisa el resultado en la consola
2. Busca problemas críticos (🔴 severity: CRITICAL)
3. Categorías a revisar:
   - `LOCATION_COUNT_MISMATCH` - ubicaciones inconsistentes
   - `LOCATION_STRUCTURE` - estructura de ubicaciones incorrecta
   - `MISSING_SHELF` - estanterías faltantes
   - `REFERENTIAL_INTEGRITY` - referencias rotas

### Para MIGRACIÓN
1. Ve a Firestore Console → `shelves/SOL/locations`
2. Verifica que haya 73 documentos (ubicaciones 001-073)
3. Verifica que `locationCount` en el documento SOL sea 73
4. Abre la app → ShelfRackView → SOLDADURA debe mostrar 7 filas × 13 columnas

## ⚠️ NOTAS IMPORTANTES

- **SUPERADMIN REQUERIDO**: Solo usuarios con rol SUPERADMIN pueden ejecutar estas operaciones
- **BACKUP RECOMENDADO**: Antes de ejecutar la migración, descarga un backup de la colección SOL
- **SIN DATOS PERDIDOS**: La migración crea ubicaciones vacías nuevas, los artículos existentes se conservan

## 🔍 INTERPRETACIÓN DE AUDITORÍA

| Severity | Significado | Acción |
|----------|-------------|--------|
| 🔴 CRITICAL | Problema grave que afecta funcionalidad | Corregir inmediatamente |
| 🟡 WARNING | Inconsistencia que puede causar problemas | Revisar y corregir |
| 🔵 INFO | Información o recomendación | Revisar para mejorar |

### Ejemplos de Problemas Comunes

**LOCATION_COUNT_MISMATCH**
```
Estantería MEC: locationCount inconsistente (BD: 34, Esperado: 37)
```
→ Hay discrepancia entre el número de ubicaciones en el documento y en la colección

**REFERENTIAL_INTEGRITY**
```
Config: urgentLocation SOL-001 no existe
```
→ Una ubicación urgente configurada no existe

**LOCATION_STRUCTURE**
```
SOL-005: campo 'items' no es array
```
→ El campo items está corrupto

## 🛠️ TROUBLESHOOTING

**Error: "Permission denied"**
- ✓ Verifica que sea SUPERADMIN
- ✓ Token puede haber expirado, recarga la página

**Error: "Module not found"**
- ✓ Funciones no están deployadas, ejecuta `firebase deploy --only functions`
- ✓ Espera 1-2 minutos después del deploy

**Auditoría tarda mucho**
- ✓ Firestore con muchos datos, es normal
- ✓ No interrumpas, déjalo completar

## 📝 DEPLOYMENT

Si realizaste cambios en las funciones, deploy:

```bash
# Desde la carpeta raíz del proyecto
firebase deploy --only functions

# O solo si quieres evitar storage/hosting:
cd APP/backend && npm run deploy
```

---

**Última actualización:** 2026-06-09
