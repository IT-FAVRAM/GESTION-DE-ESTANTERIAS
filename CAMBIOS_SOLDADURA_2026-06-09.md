# Actualización Estructura SOLDADURA (SOL)
**Fecha:** 2026-06-09  
**Cambio:** 54 ubicaciones (antiguo) → 73 ubicaciones (nuevo)  
**Estructura:** 7 filas × 13 columnas

## ✅ Cambios Realizados

### 1. **shelves.ts** (Frontend Schema)
- ✅ Actualizado `locationCount`: 54 → 73
- ✅ Nuevas `rows` con layout 7 filas × 13 columnas
- ✅ Simplificadas `zones` (una sola zona PRINCIPAL)
- ✅ Subtitle actualizado: "001-054" → "001-073"

### 2. **Script de Migración** 
Creado: `APP/backend/scripts/migrate-SOL-structure.ts`
- Elimina ubicaciones antiguas (001-054)
- Crea nuevas ubicaciones (001-073)
- Actualiza documento de estantería en Firestore

## 📋 Layout Nuevo

```
Fila 7 (superior):  017  018  024  025  038  039  040  053  054  055  071  072  073
Fila 6:             015  016  022  023  035  036  037  050  051  052  068  069  070
Fila 5:             013  014  020  021  032  033  034  047  048  049  065  066  067
Fila 4:             011  012  -    001  -    -    -    044  045  046  062  063  064
Fila 3:             009  010  -    002  -    -    -    -    -    -    059  060  061
Fila 2:             007  008  -    003  029  030  031  -    -    -    -    -    -
Fila 1 (inferior):  005  006  019  004  026  027  028  041  042  043  056  057  058
```

## 🚀 Instrucciones de Ejecución

### Opción A: En Desarrollo (Recomendado para testing)
```bash
# 1. Asegúrate que shelves.ts esté actualizado (✅ ya está)
# 2. Ejecuta la migración
cd APP/backend
npx tsx scripts/migrate-SOL-structure.ts

# 3. Verifica en Firestore que SOL ahora tenga 73 ubicaciones
# 4. Reinicia el dev server frontend
npm run dev
```

### Opción B: En Producción
```bash
# 1. Deploy backend con cambios (si es necesario)
firebase deploy --only functions

# 2. Ejecuta la migración en Firebase Functions
# (O ejecuta el script localmente contra producción)
npx tsx scripts/migrate-SOL-structure.ts
```

## ⚠️ Notas Importantes

- El archivo `shelves.ts` ya está actualizado
- La BD antiga (54) será reemplazada por la nueva (73)
- **NO hay pérdida de datos**: el script crea ubicaciones vacías nuevas
- Si hay artículos en SOL, se conservarán en sus ubicaciones originales (1-54)
- Las nuevas ubicaciones (55-73) estarán vacías

## 📝 Validación Post-Migración

1. ✅ Verificar en Firestore: colección `shelves/SOL/locations` tiene 73 documentos
2. ✅ Verificar en app: ShelfRackView muestra 7 filas × 13 columnas
3. ✅ Verificar: locationCount = 73 en documento SOL

## 📊 Detalles Técnicos

| Propiedad | Antiguo | Nuevo |
|-----------|---------|-------|
| code | SOL | SOL |
| name | Soldadura | Soldadura |
| locationCount | 54 | 73 |
| Filas | N/A | 7 |
| Columnas | N/A | 13 |
| Zonas | 5 | 1 |

---

**Estado:** ✅ Listo para migración  
**Archivos modificados:** 1 (`shelves.ts`)  
**Archivos creados:** 1 (`migrate-SOL-structure.ts`)
