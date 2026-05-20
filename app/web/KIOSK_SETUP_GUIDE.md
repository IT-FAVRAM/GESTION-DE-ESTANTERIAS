# 📱 Guía de Configuración de Kioscos

## ¿Qué es un Kiosko?

Un **kiosko** es un punto de trabajo que puede tener **una o más estanterías asignadas**. Una **tablet** se asocia a un kiosko y puede cambiar entre sus estanterías con un botón simple.

**Ejemplo:**
- Kiosko "Mecanizado-Prensas" con estanterías: `MEC`, `PRE`
- Una tablet asociada a este kiosko puede cambiar entre las dos estanterías

---

## 🔧 Paso 1: Crear un Kiosko en Firestore

1. Ve a **Firebase Console** → **Firestore**
2. Crea una colección llamada `kiosks`
3. Añade un documento con estructura así:

```json
{
  "id": "kiosko-001",
  "name": "Mecanizado-Prensas",
  "shelves": ["MEC", "PRE"],
  "description": "Estanterías de mecanizado y prensas al lado",
  "location": "Planta 1 - Esquina noroeste",
  "isActive": true,
  "createdAt": "2026-05-15T00:00:00Z",
  "updatedAt": "2026-05-15T00:00:00Z"
}
```

**Campos:**
- `id`: ID único del kiosko (ej: `kiosko-001`)
- `name`: Nombre visible (ej: "Mecanizado-Prensas")
- `shelves`: Array de códigos de estantería (ej: `["MEC", "PRE"]`)
- `description`: Descripción opcional
- `location`: Ubicación física (opcional)
- `isActive`: Si está activo (boolean)
- `createdAt`, `updatedAt`: Timestamps ISO

---

## 🔧 Paso 2: Asignar Tablet al Kiosko

1. Ve a **Firebase Console** → **Firestore**
2. Abre la colección `devices`
3. Encuentra o crea un documento para la tablet (ej: `tablet-001`)
4. Actualiza el documento con:

```json
{
  "type": "KIOSK",
  "name": "Tablet 01 - Mecanizado",
  "kioskId": "kiosko-001",
  "lastSeen": "2026-05-15T14:30:00Z",
  "active": true
}
```

**Campos importantes:**
- `type`: Debe ser `"KIOSK"`
- `kioskId`: El ID del kiosko creado en Paso 1 (ej: `kiosko-001`)
- `name`: Nombre descriptivo de la tablet
- `active`: Si está activa

---

## 📱 Paso 3: Usar la Tablet

1. Accede a: `https://gestion-de-estanterias.web.app`
2. Haz login como **OPERARIO**
3. La tablet se conectará automáticamente al kiosko
4. Verás un **botón de cambio de estantería** en la parte superior:

```
Estantería: [MEC] [PRE]
```

- Click en `[MEC]` → Ver estantería MEC
- Click en `[PRE]` → Ver estantería PRE
- La selección se **guarda automáticamente** en localStorage

---

## 🎯 Ejemplos de Configuración

### Ejemplo 1: Mecanizado + Prensas (2 estanterías)

**Kiosko document:**
```json
{
  "id": "kiosko-mecanizado",
  "name": "Mecanizado-Prensas",
  "shelves": ["MEC", "PRE"],
  "isActive": true
}
```

**Device document:**
```json
{
  "type": "KIOSK",
  "kioskId": "kiosko-mecanizado",
  "name": "Tablet Mecanizado 01"
}
```

---

### Ejemplo 2: Plegadora única (1 estantería)

**Kiosko document:**
```json
{
  "id": "kiosko-plegadora",
  "name": "Plegadora",
  "shelves": ["PLE"],
  "isActive": true
}
```

**Resultado:** Sin botón de cambio (solo 1 estantería)

---

### Ejemplo 3: Soldadura + Repasado + Pintura (3 estanterías)

**Kiosko document:**
```json
{
  "id": "kiosko-acabado",
  "name": "Área de Acabado",
  "shelves": ["SOL", "REP", "PIN"],
  "isActive": true
}
```

**Resultado:** Botones `[SOL] [REP] [PIN]`

---

## 🔄 Cambiar Estantería de un Kiosko (Ya en Uso)

Si necesitas agregar/quitar estanterías de un kiosko **que ya está en uso**:

1. Ve a Firestore → `kiosks` → Tu documento
2. Modifica el campo `shelves` (ej: `["MEC", "PRE"]` → `["MEC", "PRE", "SOL"]`)
3. Guarda los cambios
4. La tablet se actualizará automáticamente en el siguiente reload

---

## 🧪 Testing

### Test 1: Verificar que la tablet se conecta

1. Login como OPERARIO
2. Verifica que aparezca el selector de estanterías
3. Click en cada botón → debe cambiar la vista

### Test 2: Verificar que se guarda la selección

1. Login como OPERARIO
2. Selecciona estantería "PRE"
3. Recarga la página (F5)
4. Debe mantener "PRE" seleccionada

### Test 3: Agregar una estantería al kiosko

1. En Firestore, modifica `shelves: ["MEC", "PRE"]` → `["MEC", "PRE", "SOL"]`
2. Recarga la tablet
3. Debe mostrar el nuevo botón `[SOL]`

---

## ❌ Troubleshooting

### No veo el selector de estanterías

- ✅ Verifica que `kioskId` esté configurado en `devices`
- ✅ Verifica que el documento en `kiosks` exista
- ✅ Verifica que `shelves` tenga al menos 2 elementos

### Cambio de estantería pero no se actualiza la vista

- ✅ Recarga la página
- ✅ Limpia localStorage: DevTools → Application → Storage → Clear All

### La tablet se asoció a un kiosko antiguo

- ✅ Ve a `devices` → Tu tablet
- ✅ Actualiza `kioskId` al nuevo valor
- ✅ Recarga la tablet

---

## 📊 Estructura Final de Firestore

```
firestore
├── devices/
│   └── tablet-001
│       ├── type: "KIOSK"
│       ├── kioskId: "kiosko-001"
│       ├── name: "Tablet Mecanizado 01"
│       └── active: true
│
└── kiosks/
    ├── kiosko-001/
    │   ├── id: "kiosko-001"
    │   ├── name: "Mecanizado-Prensas"
    │   ├── shelves: ["MEC", "PRE"]
    │   ├── isActive: true
    │   ├── createdAt: "..."
    │   └── updatedAt: "..."
    │
    └── kiosko-002/
        ├── id: "kiosko-002"
        ├── name: "Área de Acabado"
        ├── shelves: ["SOL", "REP", "PIN"]
        └── isActive: true
```

---

## ✅ Resumen

| Paso | Acción |
|------|--------|
| 1 | Crear colección `kiosks` en Firestore |
| 2 | Crear documento de kiosko con `shelves` array |
| 3 | Asignar tablet: agregar `kioskId` a `devices` |
| 4 | Login en tablet → Ver selector de estanterías |
| 5 | Click en botones para cambiar estantería |

¡Listo! 🎉

