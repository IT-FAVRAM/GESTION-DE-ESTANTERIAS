---
name: deploy-checklist
description: Pasos obligatorios antes de deploy a producción
metadata:
  type: reference
---

# 🚀 Deploy Checklist — No Romper Prod

**Propósito**: Checklist obligatorio ANTES de `firebase deploy` o cambios en prod.

---

## ⚠️ Antes de Empezar

```
Pregúntate:
  [ ] ¿Leí RULES.md para saber qué puede romper?
  [ ] ¿Este cambio es CRÍTICO/MEDIO/SEGURO?
  [ ] ¿Hay tests para validar el cambio?
  [ ] ¿He comunicado a stakeholders (si es necesario)?
```

Si respondiste NO a alguna → **NO DEPLOYS**, lee primero.

---

## 📋 Checklist Principal

### 1️⃣ Code Quality (Frontend)

```bash
# En APP/frontend/

# Type check
npm run typecheck
# ✅ Debe pasar sin errores
# ❌ Si hay errores: arréglaclos, no pushes

# Build
npm run build
# ✅ Debe completar sin warnings (si es posible)
# ⚠️ Warnings = revisar, pero puede proceder si conoces el riesgo
# ❌ Errors = NO DEPLOY

# Tests (si existen)
npm run test
# ✅ Todos deben pasar
# ❌ Si alguno falla → revisar qué cambió

# Lint (si existe)
npm run lint
# ✅ Sin errores
# ⚠️ Warnings = ajusta código

# Check imports (quick scan)
grep -r "TODO\|FIXME\|XXX" src/ --include="*.ts" --include="*.tsx"
# Si encontraste algo tuyo → documenta o arréglalo
```

---

### 2️⃣ Code Quality (Backend)

```bash
# En APP/backend/ y functions/

# Type check
npm run typecheck
# ✅ Debe pasar sin errores

# Build
npm run build
# ✅ Debe completar

# Tests
npm run test
# ✅ Todos deben pasar (si hay)

# Lint
npm run lint
# ✅ Sin errores críticos
```

---

### 3️⃣ Firestore Rules & Config

```bash
# Revisar firestore.rules
cat firestore.rules | wc -l
# ✅ Debe tener contenido significativo (>100 líneas)

# Revisar que las rules hacen sentido
grep -n "allow read" firestore.rules
grep -n "allow write" firestore.rules
# ✅ Debe haber restricciones por rol

# Si cambió schema:
cat firestore.indexes.json
# ✅ Índices actualizados para nuevas queries

# Test rules localmente
firebase emulators:start
# (En otro terminal)
firebase deploy --only firestore:rules --dry-run
# ✅ Debe completar sin errores

# Espera que emulator levante completamente, luego:
# npm run dev
# Test manual cada flujo
```

---

### 4️⃣ Environment & Secrets

```bash
# Revisar variables de entorno
cat APP/backend/.env.keys.json
# ✅ Debe contener: serviceAccount completo
# ❌ NUNCA comitear en git (debe estar en .gitignore)

cat APP/frontend/.env.local
# ✅ Firebase config presente
# ❌ NO tokens, NO secretos

# Revisar que .gitignore cubre:
grep -E ".env|serviceAccount|secrets" .gitignore
# ✅ Deve estar listado

# Si hiciste cambios en secrets:
firebase functions:config:get
# ✅ Verifica que las secrets están disponibles
```

---

### 5️⃣ Dependencies & Packages

```bash
# Frontend
cd APP/frontend
npm audit
# ✅ Idealmente: 0 vulnerabilities
# ⚠️ Si hay: evalúa severidad
#   - Critical/High: NO DEPLOY, actualiza package
#   - Medium/Low: Documenta en memory/, decide si actualizar

npm list --depth=0
# ✅ Versiones conocidas (no cambios inesperados)

# Backend
cd APP/backend
npm audit
# ✅ Idealmente: 0 vulnerabilities

# Verifica package-lock.json sincronizado
git diff package-lock.json
# ✅ Si viste cambios, fueron intencionales
# ❌ Si cambios inesperados → npm ci (reinstala lock exacto)
```

---

### 6️⃣ Data Integrity Check

```bash
# Antes de deploy si cambió schema Firestore:

firebase firestore:shell << 'EOF'
// Check critical collections exist
db.listCollections().then(collections => {
  console.log('Collections:', collections.map(c => c.id));
});

// Check sample documents
db.collection('config').doc('app').get().then(doc => {
  console.log('Config doc exists:', doc.exists);
});

db.collection('usuarios').limit(1).get().then(snap => {
  console.log('Users count:', snap.size);
});

db.collection('items').limit(1).get().then(snap => {
  console.log('Items count:', snap.size);
});
EOF

# ✅ Debe tener data si es prod
# ❌ Si colecciones vacías: revisar si es intencional
```

---

### 7️⃣ Manual Testing (Critical Flows)

**OBLIGATORIO antes de deploy:**

```bash
npm run dev
# Espera que ambos (frontend + backend) estén ready

# Test 1: Login cada rol
[ ] OPERARIO: kiosk con número → entra a su shelf
[ ] CARRETILLERO: kiosk con número → ve todas las estanterías
[ ] CALIDAD: email+pwd → accede a CAL only
[ ] JEFE_SECCION: email+pwd → accede a su sección only
[ ] ADMIN: email+pwd → accede a todo

# Test 2: Ubicar artículo
[ ] OPERARIO ubica en su shelf → persiste en Firestore
[ ] CARRETILLERO ubica en cualquier shelf → persiste
[ ] Grid actualiza correctamente
[ ] itemAggregates incrementa

# Test 3: Retirar artículo
[ ] Retirar visual grid funciona
[ ] Multi-select funciona
[ ] "¿Retirar más?" loop funciona
[ ] Data se elimina de Firestore correctamente
[ ] itemAggregates decrementa

# Test 4: Alertas urgentes
[ ] Crear alert → llega FCM
[ ] "Resolver" funciona
[ ] Auto-dismiss después 10s

# Test 5: Chat
[ ] Mensaje en chat/ es visible
[ ] Si CALIDAD → también en conversations/
[ ] FCM notifica

# Test 6: Offline
[ ] Desconecta WiFi
[ ] Ubica artículo → feedback visual
[ ] Reconecta WiFi
[ ] ¿Data persiste? (SI ✅, NO ❌ BUG)

# Test 7: Mobile
[ ] Abre en iPhone 14 (390x844) o equivalente
[ ] Responsive layout OK
[ ] Buttons clickeables
[ ] Grid OK

# Si ALGO falla:
# ❌ NO DEPLOYS
# → Revisa RULES.md → "Cosas que rompemos"
# → Arregla + retorna al test
```

---

### 8️⃣ CI/CD Checks (Si existe GitHub Actions)

```bash
# Ver status de checks
gh pr checks
# o
gh run list

# ✅ Todos deben estar green
# ❌ Si rojo: ver logs y arreglar

# Si no existe CI/CD:
# Al menos ejecuta localmente:
npm run typecheck && npm run build
```

---

### 9️⃣ Review de Cambios (Code Review)

```
Si es cambio importante:
[ ] ¿Código está comentado donde necesario?
[ ] ¿No cambié archivos que no tenía que cambiar?
[ ] ¿Sigo las convenciones del proyecto?
[ ] ¿Las funciones tienen nombres claros?
[ ] ¿No hay código muerto/comentado?
```

---

### 🔟 Backup & Rollback Plan

```
Antes de deploy:
[ ] ¿Sé cuál es el último commit bueno?
      git log --oneline | head -5

[ ] ¿Sé cómo revertir si falla?
      git revert --no-edit {COMMIT_SHA}
      firebase deploy

[ ] ¿Tengo Firebase backup habilitado?
      (ask ADMIN para verificar)

[ ] ¿Documenté cambios en memory/?
      Así futuros Claude/yo entiende qué cambió
```

---

## 🚀 El Deploy Mismo

### Opción 1: Deploy Completo (Frontend + Backend + Rules)

```bash
# Desde raíz del proyecto

# Paso 1: Verificar estado
git status
# ✅ Debe estar clean (todo commiteado)
# ❌ Si hay cambios sin comitear: git add + git commit

# Paso 2: Deploy
firebase deploy
# ✅ Espera que completo sin errores
# Debe mostrar:
#   - Hosting deployed to ...
#   - Functions deployed to ...
#   - Firestore Rules updated
#   - Indexes updated

# Paso 3: Verificar
firebase deploy:log  # último deploy status
firebase functions:log | tail -20  # últimos logs

echo "✅ Deploy completado"
```

### Opción 2: Deploy Solo Frontend

```bash
cd APP/frontend
npm run build

firebase deploy --only hosting
# ✅ Hosting deployed to ...
```

### Opción 3: Deploy Solo Backend/Functions

```bash
cd APP/backend
npm run build

firebase deploy --only functions
# ✅ Functions deployed to ...
```

### Opción 4: Deploy Solo Firestore Rules

```bash
firebase deploy --only firestore:rules
# ✅ Firestore Rules updated
```

---

## ✅ Después del Deploy

### Verificación Inmediata (5 min post-deploy)

```
[ ] Abrir app en browser
    https://tu-firebase-app.web.app
    [ ] ¿Carga sin errores?
    [ ] ¿Puedes loguearte?

[ ] Ver Cloud Functions logs
    firebase functions:log | tail -30
    [ ] ¿Hay errores?
    [ ] ¿Todas las funciones se llaman?

[ ] Hacer operación básica
    [ ] OPERARIO ubica un artículo
    [ ] Verifica: ¿aparece en Firestore?
    [ ] Recargar → ¿persiste?

[ ] Revisar Console errors
    Browser DevTools → Console
    [ ] ¿Errores JavaScript críticos?
    [ ] ¿Warnings de CORS?

[ ] Test FCM (si tocaste notifications)
    [ ] ¿Llegan push notifications?
    [ ] ¿Mensaje es correcto?
```

### Monitoreo (24h post-deploy)

```bash
# Monitorear logs
firebase functions:log --follow

# Alertas a usuario: "Reporting any issues?"

# Si reportan bug:
[ ] Prioridad alta (data loss, auth broken)
    → Revert inmediatamente
[ ] Prioridad media (UI broken)
    → Evaluaa quick fix vs revert
[ ] Prioridad baja (typo, cosmético)
    → Arregla en siguiente deploy
```

---

## 🔴 Si Algo Falla

### Deploy Roto (App no carga)

```bash
# 1. Revert inmediatamente
git revert --no-edit HEAD
firebase deploy

# 2. Documenta qué pasó
# Abre issue: "Deploy fallido [fecha] - [razón]"

# 3. Arregla en local
# Tómate tiempo, no apures

# 4. Re-test TODO
# Sigue este checklist de nuevo

# 5. Redeploy cuando esté listo
```

### Algunos endpoints broken

```bash
# 1. Identifica cuál Cloud Function falla
firebase functions:log | grep ERROR

# 2. Revert esa función
git log --oneline APP/backend/functions/
git revert --no-edit {COMMIT_SHA}

# 3. Redeploy solo functions
firebase deploy --only functions

# 4. Si rápidamente arreglable:
# Fix en local → npm run build → firebase deploy --only functions

# 5. Comunica a users: "Problema resuelto a las XX:XX"
```

### Data corrupted (⚠️ CRÍTICO)

```bash
# 1. Evalúa daño
firebase firestore:shell
> db.collection('items').count().get()
# ¿Cuántos documentos afectados?

# 2. Si < 100 docs: manual fix
# Si > 100 docs: ejecuta script de recuperación

# 3. Recupera desde backup
firebase firestore:export gs://tu-bucket/backups/latest.tar.gz
# (Si disponible; requiere configuración previa)

# 4. Documenta:
# memory/incident_[fecha].md
# - Qué pasó
# - Cómo se arregló
# - Cómo evitar en futuro
```

---

## 📊 Checklist Rápido (Copy-Paste)

```
PRE-DEPLOY:
[ ] npm run typecheck (frontend)
[ ] npm run build (frontend)
[ ] npm run test (if exists)
[ ] npm run build (backend)
[ ] firebase emulators:start (test locally)
[ ] Manual test: all 7 flows
[ ] git status (clean)
[ ] firebase deploy --dry-run

DEPLOY:
[ ] firebase deploy

POST-DEPLOY:
[ ] App loads without errors
[ ] firebase functions:log (check for errors)
[ ] Test basic operation (UBICAR + RETIRAR)
[ ] Browser console (no critical errors)
[ ] 24h monitoring
```

---

## 🎓 Verdades Incómodas

### ✅ Esto siempre funciona:
- `npm run typecheck` antes de build
- `npm run build` antes de deploy
- Manual testing de flows críticos
- Dry-run antes del deploy real

### ❌ Esto te quema:
- Skipear typecheck ("está todo bien")
- Deploy directo (sin build)
- No testear offline
- No revisar firestore.rules después de cambios
- Deployar cambios grandes sin testing

### 🔴 Esto te destruye:
- Cambiar schema sin migration script
- Romper validación en backend
- Deployar con secretos en código
- No tener plan de rollback
- Ignorar Firestore rules errors

---

## 📞 Escalation Matrix

| Problema | Acción |
|----------|--------|
| Build error | NO DEPLOY, arregla error |
| Test falla | NO DEPLOY, investiga |
| Manual test falla | NO DEPLOY, investiga |
| Deploy completado pero app roto | REVERT inmediatamente |
| Data integrity issue | REVERT + incident report |
| Users reportan data loss | CRITICAL: stop other work |

---

## 📚 Referencias

- `RULES.md` → Cambios críticos + qué revisar
- `ARCHITECTURE.md` → Qué depende de qué
- `DEBUGGING_GUIDE.md` → Si falla, cómo debuggear
- `FIRESTORE_SCHEMA.md` → Si cambió schema
- firestore.rules → Security rules (authoritative)

---

## 🎯 El Mejor Test

> "Si no estoy 100% seguro de que esto funciona, no deployaré."

Si tienes dudas:
1. Lee RULES.md
2. Test más
3. Pide review
4. Consulta con otro dev
5. LUEGO deployea

**No hay prisa. Breaks en prod son caros.**
