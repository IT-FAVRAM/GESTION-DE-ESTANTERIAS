---
name: claude-setup-readme
description: Guía de la carpeta .claude y cómo usarla
metadata:
  type: reference
---

# 📁 Carpeta `.claude/` — Guía Completa

Esta carpeta contiene **documentación base + memoria** de la app WMS para que tú y Claude podamos colaborar mejor sin romper cosas.

---

## 📂 Estructura

```
.claude/
├── README.md                    ← Estás aquí
├── CLAUDE.md                    ← Instrucciones globales para Claude
│
└── project/                     ← 📚 DOCUMENTOS (7 archivos = tu mapa)
    ├─ 1️⃣ ROLES.md              ← Matriz de roles y permisos
    ├─ 2️⃣ ARCHITECTURE.md       ← Stack, colecciones, flujos
    ├─ 3️⃣ RULES.md             ← Qué puede romper qué + checklist
    ├─ 4️⃣ CLAUDE_GUIDE.md      ← 🗺️ Mapa: pregunta → archivo
    ├─ 5️⃣ DEBUGGING_GUIDE.md    ← 7 bugs frecuentes + soluciones
    ├─ 6️⃣ FIRESTORE_SCHEMA.md   ← 13 colecciones, relaciones, queries
    └─ 7️⃣ DEPLOY_CHECKLIST.md   ← Pre/post deploy + rollback plan
    
└── memory/                      ← 📖 Memoria histórica
    ├── MEMORY.md                ← Índice de memorias
    ├── auditoria_*.md           ← Auditorías completadas
    ├── feature_*.md             ← Features implementadas
    ├── security_*.md            ← Auditorías de seguridad
    └── ...
```

---

## 🎯 Cuál Documento Usar Según la Tarea

### 1️⃣ Quiero **entender la arquitectura**
→ Lee en este orden:
1. `project/ROLES.md` — Entiende qué hace cada rol
2. `project/ARCHITECTURE.md` — Entiende cómo funciona todo
3. `project/CLAUDE_GUIDE.md` — Navega a archivos específicos

---

### 2️⃣ Voy a **arreglar un bug**
→ Pasos:
1. Abre `project/RULES.md` → "Cosas que rompemos frecuentemente"
2. ¿Coincide tu problema? Sigue el fix recomendado
3. Usa `project/CLAUDE_GUIDE.md` para ir a archivos específicos
4. Aplica el checklist de `RULES.md` post-cambios

---

### 3️⃣ Voy a **cambiar funcionalidad**
→ Pasos:
1. Lee `project/RULES.md` → "Cambios CRÍTICOS/MEDIOS"
2. ¿Es crítico tu cambio? Revisa toda la matriz de impacto
3. Usa `project/CLAUDE_GUIDE.md` para encontrar los archivos
4. Ejecuta el checklist post-cambios

---

### 4️⃣ Me pregunta Claude **"¿Dónde está X?"**
→ Usa `project/CLAUDE_GUIDE.md` — Es un índice reversible

Ejemplo: "¿Cómo funciona UBICAR?"
- Busca en CLAUDE_GUIDE → "Ubicar"
- Te dice: `ARCHITECTURE.md` → "Flujos Clave → UBICAR"
- También: `hooks/useOperativeShelf.ts` + `APP/backend/functions/operateLocation.ts`

---

### 5️⃣ Necesito **verificar qué pasó antes**
→ Lee `memory/MEMORY.md` — Índice de auditorías + features

---

## 📚 Documento por Documento

### `ROLES.md` (4.2 KB)
**¿Quién puede hacer qué?**
- Tabla: 6 roles × permisos (Ubicar, Retirar, Ver costos, etc)
- Auth: Diferencia Kiosk vs Firebase Auth
- Flujos de login para cada rol
- Casos especiales (ej: juanma ADMIN + JEFE_SECCION)

**Cuándo leer**: Cuando haya duda sobre permisos o flujos de login

---

### `ARCHITECTURE.md` (8.1 KB)
**¿Cómo funciona todo?**
- Stack: React, Firebase, Cloud Functions
- 13 colecciones Firestore (usuarios/, shelves/, items/, chat/, etc)
- 30+ hooks principales (useShelf, useAuth, useOperativeShelf, etc)
- 5 flujos detallados: Ubicar → Retirar → Compra → Alertas → Chat
- Validación de datos + API contracts

**Cuándo leer**: Cuando necesites entender dependencias o integración

---

### `RULES.md` (8.0 KB)
**¿Qué puede romper qué?**
- Matriz: Cambios CRÍTICOS/MEDIOS/SEGUROS + qué revisar
- 7 "bugs frecuentes" con síntomas + fixes (ej: datos pierden offline)
- Checklist post-cambios (typecheck, build, deploy)
- Dónde está cada cosa (qué archivo editar)

**Cuándo leer**: ANTES de cambiar código o cuando hay bug

---

### `CLAUDE_GUIDE.md` (12 KB)
**🗺️ Mapa: Pregunta → Archivo**
- Índices por tema:
  - Autenticación & Roles
  - Colecciones & BD
  - Flujos (Ubicar/Retirar/Compra)
  - Notificaciones & Alertas
  - Componentes
  - Hooks principales
  - Debugging
- Tabla rápida de archivos + líneas
- Estructura de carpetas
- Tips prácticos

**Cuándo leer**: Cuando necesites ir a un archivo específico

---

### `DEBUGGING_GUIDE.md` (14 KB)
**🐛 Procedimientos: 7 bugs frecuentes**
- **Los 7 bugs recurrentes**:
  1. Usuario no ve opción de ubicar (permisos)
  2. Ubicación rechazada (validación)
  3. itemAggregates desincronizado (sync)
  4. CAL acceso roto (CALIDAD)
  5. FCM no llega (notificaciones)
  6. Restricción rota (shelf access)
  7. Data loss offline (optimistic update)
- Árbol de diagnóstico para cada uno
- Pasos para arreglar (comandos incluidos)
- Checklist post-fix

**Cuándo leer**: Cuando algo no funciona y no sabes por qué

---

### `FIRESTORE_SCHEMA.md` (16 KB)
**📊 Diagrama: 13 colecciones + relaciones**
- Estructura completa de Firestore:
  - config/, usuarios/, shelves/, items/, itemAggregates/
  - pickupQueue/, kiosks/, history/, urgent_alerts/, chat/
  - conversations/, dispositivos/, conexion_estado/, conexion_logs/
- Campos de cada documento
- Relaciones y flows (items → aggregates → history)
- Índices críticos
- Querying examples
- Data integrity rules

**Cuándo leer**: Para entender dónde va cada dato + relaciones

---

### `DEPLOY_CHECKLIST.md` (15 KB)
**🚀 Pre/post deploy: 10 pasos obligatorios**
- Checklist principal:
  1. Code Quality (typecheck, build, tests, lint)
  2. Backend build
  3. Firestore rules
  4. Environment & secrets
  5. Dependencies (audit)
  6. Data integrity
  7. Manual testing (7 flows)
  8. CI/CD checks
  9. Backup & rollback plan
  10. El deploy mismo
- Verificación post-deploy (5 min + 24h)
- Si algo falla (revert plan)
- Escalation matrix

**Cuándo leer**: SIEMPRE antes de hacer `firebase deploy`

---

## 🚀 Flujo Típico con Claude

### Scenario: "Claude, arregla X"

```
1. TÚ: "Claude, hay un bug donde [descripción]"

2. CLAUDE:
   → Lee RULES.md → "Cosas que rompemos frecuentemente"
   → ¿Encuentra el síntoma? Sigue el fix
   → Si no, usa CLAUDE_GUIDE.md para navegar a archivos

3. CLAUDE hace cambios + ejecuta:
   npm run typecheck && npm run build

4. CLAUDE verifica en RULES.md checklist post-cambios

5. TÚ verificas en dev y das feedback
```

---

### Scenario: "¿Cómo funciona X?"

```
1. TÚ: "¿Cómo funciona el login de CALIDAD?"

2. CLAUDE:
   → Ve a CLAUDE_GUIDE.md → "Autenticación & Roles"
   → Encuentra: "¿Cómo funciona login CALIDAD/ADMIN?" → hooks/useAuth.ts
   → Lee ese hook + ROLES.md sección "AUTH_ROLES"
   → Explica con contexto

3. Si es complejo, también trae:
   → ARCHITECTURE.md → "Flujos de Autenticación"
```

---

### Scenario: "Necesito cambiar X"

```
1. TÚ: "Quiero que CARRETILLERO vea también CAL"

2. CLAUDE:
   → Lee RULES.md → "Cambios CRÍTICOS" → "Modificar authCapabilities"
   → Ve qué revisar: todos los canAccessShelf() calls
   → Usa CLAUDE_GUIDE.md para encontrar archivos

3. CLAUDE edita + propone cambios

4. TÚ: "Hazlo"

5. CLAUDE ejecuta:
   npm run typecheck && npm run build && firebase deploy
   
6. Verifica checklist en RULES.md
```

---

## 💡 Tips para Usar Esto Bien

### ✅ HACES ESTO BIEN
- **Lees RULES.md antes de cambiar** → Evitas sorpresas
- **Usas CLAUDE_GUIDE.md para navegar** → Directo al archivo
- **Verificas el checklist post-cambios** → Nada roto en prod
- **Documentas cambios en memory/** → Futuro tú lo entiende

### ❌ EVITA ESTO
- Cambiar sin leer RULES.md → Rompes cosas
- Buscar archivos manualmente → Usa CLAUDE_GUIDE.md
- Ignorar warnings en build → Revisa typecheck antes de deploy
- Olvidar que offline + optimistic update = data loss → Lee RULES.md

---

## 📞 Preguntas Frecuentes

### P: ¿Dónde busco X?
**R**: `CLAUDE_GUIDE.md` — Tiene índice de TODO

### P: Cambié y algo rompió, ¿qué hago?
**R**: 
1. Lee `RULES.md` → "Cosas que rompemos frecuentemente"
2. ¿Tu síntoma está? Sigue el fix
3. Si no, describe el síntoma y busca en `CLAUDE_GUIDE.md` Debugging

### P: ¿Cómo agrego algo nuevo?
**R**: 
1. Lee `ARCHITECTURE.md` para entender dependencias
2. Lee `RULES.md` para ver si es CRÍTICO/MEDIO cambio
3. Implementa
4. Ejecuta checklist post-cambios
5. Documenta en `memory/` si es feature/bug importante

### P: ¿Cuál es la verdad: código o documentos?
**R**: El **código es autoridad**. Los documentos son **mapas** para navegar el código.

Si documento y código dicen cosas diferentes → El código gana, actualiza el documento.

---

## 🔄 Mantenimiento de Documentos

### Cuándo actualizar
- Después de feature importante → Actualiza `ARCHITECTURE.md`
- Después de cambio de permisos → Actualiza `ROLES.md`
- Cuando encuentras "cosa que rompe" nueva → Actualiza `RULES.md`
- Cuando renombras archivo o función → Actualiza `CLAUDE_GUIDE.md`

### Cómo mantenerlo
```bash
# Después de cambio grande:
1. Edita el doc correspondiente
2. Actualiza CLAUDE_GUIDE.md si hay nuevos archivos/funciones
3. Commit: "docs: Update [DOC].md - [razón]"
```

---

## 🎓 Resumen Ultra-Rápido

| Necesito... | Leer... |
|-------------|---------|
| Entender qué hace cada rol | ROLES.md |
| Entender cómo funciona todo | ARCHITECTURE.md |
| Saber qué puede romper qué | RULES.md |
| Encontrar archivo específico | CLAUDE_GUIDE.md |
| Debuggear un bug | DEBUGGING_GUIDE.md |
| Entender colecciones Firestore | FIRESTORE_SCHEMA.md |
| Antes de hacer deploy | DEPLOY_CHECKLIST.md |
| Buscar historia de cambios | memory/MEMORY.md |

---

## 📅 Versión & Historial

- **v1.0** — 2026-06-10 — Creados documentos base (ROLES, ARCHITECTURE, RULES, CLAUDE_GUIDE)
- Versión anterior: nada (esto es nuevo)

---

## 🤝 Colaboración con Claude

Estos documentos existen **para que Claude no rompa nada**.

Cada vez que hables con Claude:
1. El/ella lee ROLES.md + ARCHITECTURE.md automáticamente
2. Antes de cambiar, lee RULES.md
3. Para navegar, usa CLAUDE_GUIDE.md
4. Post-cambios, ejecuta checklist

**Resultado**: Menos bugs en producción, más confianza en cambios. ✅
