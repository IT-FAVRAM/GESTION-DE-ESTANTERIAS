# 🔍 PROMPT DE AUDITORÍA CORE - GESTOR DE ESTANTERÍAS WMS v3

## Objetivo
Realizar una auditoría COMPLETA de las funcionalidades críticas de la aplicación WMS de gestión de estanterías. Esta auditoría valida que el sistema está operativo y seguro post-deployment.

## Contexto de la Aplicación
- **Stack**: React 19 + Vite + Firebase + TypeScript
- **Usuarios**: 5 roles (Admin, Jefe Sección, Calidad, Carretillero, Kiosk)
- **Operaciones Core**: UBICAR, RETIRAR, MOVER, REUBICAR, ALMACÉN
- **Estanterías**: PRE (PRENSAS 1-9), MEC (MECANIZADO 14-46), CAL (CALIDAD), PLE (PLEGADORA), REP (REPASADO), PIN (PINTURA), ALM (ALMACÉN)
- **Nota Crítica**: PRE y MEC están SEPARADOS en Firestore pero COMBINADOS en frontend (véase useShelf.ts)

---

## PARTE 1: VERIFICACIÓN DE INTEGRIDAD DE DATOS

### 1.1 Estado de Estanterías en Firestore
**Verificar cada estantería tiene datos consistentes:**

```
Firebase MCP Query:
- shelves/PRE/locations: ¿>0 locations con items? (esperado: SÍ, 20+ artículos)
- shelves/MEC/locations: ¿>0 locations con items? (esperado: SÍ, 2+ ubicaciones no vacías)
- shelves/CAL/locations: ¿status consistente? (esperado: SÍ)
- shelves/PLE/locations: ¿locations 001-065 definidas? (esperado: SÍ)
- shelves/REP/locations: ¿estructura correcta? (esperado: SÍ)
- shelves/PIN/locations: ¿estructura correcta? (esperado: SÍ)
- shelves/ALM/locations: ¿estructura correcta? (esperado: SÍ)
```

**Resultado esperado**: TODAS las estanterías deben estar definidas y tener locations válidas.

### 1.2 Integridad de Items
**Verificar items ubicados tienen datos requeridos:**

```
Buscar 5 items aleatorios en cada estantería y validar:
- ✓ articleCode (no vacío)
- ✓ orderFab (formato OF26-XXXXX)
- ✓ locatedAt (timestamp válido)
- ✓ locatedBy (presenceId válido)
- ✓ presenceId (único por item)
- ✓ items array no tiene duplicados
```

**Resultado esperado**: 100% de items tienen estructura válida, sin datos corruptos.

### 1.3 HOTFIX PRE+MEC Check
**Validar que el workaround está en lugar:**

```
Verificar en código:
- useShelf.ts línea ~98: ¿Detecta shelfCode === 'PRE'?
- ¿Lee de collection 'PRE'?
- ¿Lee de collection 'MEC' en paralelo?
- ¿Combina results y ordena numéricamente?
```

**Resultado esperado**: HOTFIX está implementado correctamente.

---

## PARTE 2: VERIFICACIÓN DE FUNCIONALIDADES CORE

### 2.1 Flujo UBICAR (El más crítico)
**Validar que se pueden ubicar artículos:**

```
Escenarios a probar:
1. UBICAR en PRENSAS (PRE, posiciones 1-9)
   - Seleccionar artículo: 27894-05, OF26-04609
   - Seleccionar posición: 001
   - ¿Se ubica exitosamente?
   - ¿Aparece en grid?
   - ¿Se persiste en Firestore?

2. UBICAR en MECANIZADO (MEC, posiciones 14-46)
   - Seleccionar artículo nuevo
   - Seleccionar posición: 025
   - ¿Se ubica?
   - ¿Se persiste?

3. UBICAR en CALIDAD sin OF (reprocesos)
   - ¿Acepta artículos sin OF?
   - ¿Aparece en vista reprocesos?

4. UBICAR múltiples artículos (lote)
   - ¿Modo lote funciona?
   - ¿Se ubican todos?
```

**Resultado esperado**: 100% de escenarios UBICAR funcionan sin errores.

### 2.2 Flujo RETIRAR (El más peligroso)
**Validar que se pueden retirar artículos:**

```
Escenarios a probar:
1. RETIRAR de PRENSAS
   - Seleccionar location con artículos
   - ¿Muestra lista de items?
   - ¿Permite seleccionar items?
   - ¿Se retiran exitosamente?
   - ¿Desaparecen del grid?

2. RETIRAR de MECANIZADO
   - ¿Funciona igual?
   - ¿Se persiste eliminación?

3. RETIRAR de CALIDAD (reprocesos)
   - ¿Permite retirar reprocesos?
   - ¿Actualiza cantidad?

4. RETIRAR por rol
   - CARRETILLERO: ¿puede retirar por sección?
   - ADMIN: ¿puede retirar de cualquier shelf?
   - KIOSK: ¿puede retirar?
```

**Resultado esperado**: 100% de retiradas funcionan, datos se persisten, sin pérdida de información.

### 2.3 Flujo MOVER
**Validar movimiento de artículos:**

```
- Artículo en posición 001
- ¿Se puede mover a posición 005?
- ¿Se elimina de ubicación origen?
- ¿Aparece en ubicación destino?
- ¿Firestore refleja cambio?
```

**Resultado esperado**: MOVER funciona bidireccional, sin pérdida de datos.

### 2.4 Flujo REUBICAR (Admin only)
**Validar reubicación entre estanterías:**

```
- Artículo en PRE
- ¿Se puede reubicar a MEC?
- ¿Se actualiza shelfCode?
- ¿Aparece en estantería destino?
```

**Resultado esperado**: REUBICAR funciona entre estanterías.

### 2.5 Flujo ALMACÉN
**Validar envío a almacén:**

```
- Artículos en estantería operativa
- ¿Se pueden enviar a almacén?
- ¿Se marcan como "enviado"?
- ¿Desaparecen de inventario operativo?
```

**Resultado esperado**: ALMACÉN funciona, sin duplicados, sin pérdidas.

---

## PARTE 3: VERIFICACIÓN DE SEGURIDAD Y PERMISOS

### 3.1 Control de Acceso por Rol
**Validar que cada rol solo ve/opera lo permitido:**

```
Matriz de acceso:
┌─────────────┬─────┬──────┬────────┬────────────┬──────┐
│ Rol         │ VER │ OPER │ RETIRAR│ REUBICAR   │ ALM  │
├─────────────┼─────┼──────┼────────┼────────────┼──────┤
│ ADMIN       │ ALL │ ALL  │ ALL    │ ALL        │ ALL  │
│ CALIDAD     │ CAL │ CAL  │ CAL    │ NO         │ NO   │
│ CARRETILLERO│ ALL │ SOME │ SOME   │ NO         │ SOME │
│ KIOSK       │ 1   │ 1    │ 1      │ NO         │ NO   │
│ JEFE_SECC   │ 1   │ 1    │ 1      │ NO         │ NO   │
└─────────────┴─────┴──────┴────────┴────────────┴──────┘

Verificar: ¿Cada rol es bloqueado fuera de su scope?
```

**Resultado esperado**: TODOS los roles tienen permisos correctos, no hay acceso no autorizado.

### 3.2 Validación de Datos de Entrada
**Verificar que la app rechaza datos inválidos:**

```
- ¿Rechaza OF con formato inválido?
- ¿Rechaza posiciones no numéricas?
- ¿Rechaza artículos duplicados en misma posición?
- ¿Valida contiguidad de posiciones?
```

**Resultado esperado**: Sistema rechaza todas las entradas inválidas con error claro.

### 3.3 Auditoría de Cambios
**Verificar que se registran todas las operaciones:**

```
Firestore collections:
- history/{operationId}: ¿contiene todos los cambios?
- Cada item tiene: articleCode, shelfCode, position, action, timestamp, operarioId
```

**Resultado esperado**: 100% de operaciones están auditadas.

---

## PARTE 4: VERIFICACIÓN DE BUGS CRÍTICOS (REGRESSIONS)

### 4.1 Data Persistence Bug
**Verificar que los datos se persisten correctamente:**

```
Test:
1. Ubicar artículo
2. Recargar página (F5)
3. ¿Artículo sigue visible?
4. Firestore muestra los datos?
```

**Esperado**: PASS - Datos persisten correctamente.

### 4.2 Race Condition en Operaciones Rápidas
**Verificar sin duplicados/pérdidas con clics rápidos:**

```
Test:
1. Click rápido "Ubicar" 3 veces seguidas
2. ¿Solo se crea 1 ubicación?
3. ¿No hay duplicados?
4. ¿No hay datos corruptos?
```

**Esperado**: PASS - Sistema es thread-safe.

### 4.3 Offline Fallback
**Verificar que funciona offline (si está implementado):**

```
Test:
1. Desconectar red (DevTools)
2. Intentar ubicar artículo
3. ¿Se enlaza localmente?
4. Reconectar
5. ¿Se sincroniza automáticamente?
```

**Esperado**: PASS - Sistema funciona offline con sincronización automática.

### 4.4 OCR Scanning
**Verificar que el OCR funciona:**

```
Test:
1. Abrir cámara OCR
2. Fotografiar etiqueta con artículo y OF
3. ¿Extrae datos correctamente?
4. ¿Rellena campos automáticamente?
```

**Esperado**: PASS - OCR extrae datos precisamente.

### 4.5 API Integration (Swagger)
**Verificar integración con API externa:**

```
Test:
1. Ingresar código de barras
2. ¿Busca automáticamente en API?
3. ¿Rellena artículo automáticamente?
4. ¿Maneja errores de API?
```

**Esperado**: PASS - API integration funciona, con fallback si API falla.

---

## PARTE 5: VERIFICACIÓN DE PERFORMANCE

### 5.1 Carga de Grid
**Verificar que el grid carga rápidamente:**

```
Métricas:
- ¿Grid con 50+ ubicaciones carga en <2s?
- ¿Scroll es smooth (60fps)?
- ¿Interacciones responden inmediatamente?
```

**Esperado**: Grid performante sin lag.

### 5.2 Búsqueda Global
**Verificar búsqueda es rápida:**

```
- Buscar artículo "27894-05"
- ¿Resultados en <500ms?
- ¿Destaca ubicaciones?
```

**Esperado**: Búsqueda < 1s, responsive.

### 5.3 Sincronización Firestore
**Verificar listeners no se multiplican:**

```
Cambiar entre 5 estanterías rápidamente
- ¿Console muestra >1 listener por shelf?
- ¿Memory crece sin límite?
```

**Esperado**: Un listener por shelf, cleanup correcto.

---

## PARTE 6: REPORTE FINAL

### Plantilla de Reporte
```
═══════════════════════════════════════════════════════════════
AUDITORÍA CORE - GESTOR DE ESTANTERÍAS WMS v3
═══════════════════════════════════════════════════════════════

📊 RESUMEN EJECUTIVO
─────────────────────────────────────────────────────────────
Estatus General: [🟢 OPERATIVO / 🟡 CON ADVERTENCIAS / 🔴 CRÍTICO]
Fecha Auditoría: [YYYY-MM-DD]
Duración: [X minutos]
Auditor: [Agent Name]

📈 PUNTUACIÓN POR ÁREA
─────────────────────────────────────────────────────────────
Integridad de Datos:        [X/10]  ✓✓✓✓✓ (explicación)
Funcionalidades Core:       [X/10]  ✓✓✓✓✓ (explicación)
Seguridad y Permisos:       [X/10]  ✓✓✓✓✓ (explicación)
Regressions Críticas:       [X/10]  ✓✓✓✓✓ (explicación)
Performance:                [X/10]  ✓✓✓✓✓ (explicación)

PUNTUACIÓN FINAL:          [XX/50]  = [XX%]

🔴 PROBLEMAS CRÍTICOS (si aplica)
─────────────────────────────────────────────────────────────
1. [Problema]: [Impacto]: [Solución recomendada]
2. [Problema]: [Impacto]: [Solución recomendada]

⚠️ ADVERTENCIAS (si aplica)
─────────────────────────────────────────────────────────────
1. [Advertencia]: [Recomendación]

✅ ASPECTOS POSITIVOS
─────────────────────────────────────────────────────────────
- [Aspecto que funciona bien]
- [Aspecto que funciona bien]

📋 DETALLES POR SECCIÓN
─────────────────────────────────────────────────────────────

### 1. Integridad de Datos
[Detalle de verificaciones realizadas y resultados]

### 2. Funcionalidades Core
[Detalle de cada flujo probado: UBICAR, RETIRAR, MOVER, REUBICAR, ALMACÉN]

### 3. Seguridad
[Detalle de permisos y validaciones]

### 4. Bugs Críticos
[Estado de cada regression check]

### 5. Performance
[Métricas medidas]

🎯 RECOMENDACIONES
─────────────────────────────────────────────────────────────
1. [Prioridad 1] [Acción]
2. [Prioridad 2] [Acción]
3. [Prioridad 3] [Acción]

✔️ CONCLUSIÓN
─────────────────────────────────────────────────────────────
[Párrafo: resumen de estado, aprobación para producción o blockers]

═══════════════════════════════════════════════════════════════
```

---

## NOTAS IMPORTANTES PARA EL AUDITOR

### ⚠️ Consideraciones Especiales

1. **PRE + MEC Hotfix**
   - Los datos de PRENSAS y MECANIZADO están en colecciones separadas
   - El frontend combina ambas en useShelf.ts
   - Esto es temporal hasta que se migre todo a PME

2. **Datos Esperados**
   - PRE debe tener artículos en posiciones 1-9
   - MEC debe tener artículos en posiciones 14-46
   - Si PRE está vacío = CRÍTICO
   - Si MEC está vacío = OK (durante migración)

3. **Roles de Prueba**
   - Testear con al menos un usuario de cada rol
   - No todos los usuarios pueden acceder a todas las estanterías
   - Reportar si un rol no puede hacer lo que debería

4. **Firestore Rules**
   - Security rules deben estar validando permisos
   - Si alguien ubica sin permiso = CRÍTICO

5. **Offline/Online**
   - La app puede funcionar offline con sincronización posterior
   - Verificar que no crea duplicados al sincronizar

---

## EJECUCIÓN

**Tiempo estimado**: 45-60 minutos de auditoría manual + análisis de datos

**Requerimientos**:
- Acceso a Firestore (Firebase MCP)
- Acceso a la app (navegador)
- 5 cuentas de usuario (una por rol) O acceso admin
- Conexión de red estable

**Entregable Final**:
Reporte completo en el formato especificado arriba, con recomendaciones claras.
