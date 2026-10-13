# 📱 Guía: Nuevas Características Móvil

## ✨ Lo que se agregó

### 1️⃣ **Scroll Horizontal en Estanterías Anchas**

**Problema anterior:**
- Estanterías muy anchas no cabían en pantalla
- No había forma de ver todas las celdas

**Solución:**
- Las estanterías anchas ahora tienen **scroll horizontal**
- Desliza a izquierda/derecha para ver todas las celdas
- El scroll es suave y amigable en móvil

**Uso:**
```
Vista de estantería ancha
┌─────────────────────────┐
│ ← [Celdas] [Celdas] →   │  ← Desliza aquí
│ [MEC-001] [MEC-002] ... │
│ [MEC-003] [MEC-004] ... │
└─────────────────────────┘
```

---

### 2️⃣ **Escaneo QR por Cámara Móvil**

**Disponible para:**
- 🚚 **Carretillero** 
- 👨‍💼 **Jefe de Sección**
- 🔧 **Admin**

**Antes:**
- Solo con pistola QR (hardware específico)

**Ahora:**
- Botón 📷 **"Cámara"** en el header
- Escanea códigos QR con la cámara del móvil
- Funciona igual que la pistola

---

## 🎯 Cómo Usar: Cámara QR

### Paso 1: Abre la Cámara

1. En cualquier vista (Carretillero, Jefe Sección, Admin)
2. Click en botón **📷 Cámara** (arriba derecha)

```
┌─────────────────────────────┐
│ [📷 Cámara] [Volver]       │  ← Click aquí
└─────────────────────────────┘
```

### Paso 2: Apunta al QR

La cámara se abrirá:

```
┌──────────────────────────┐
│ 📷 Escanear QR           │  [×]
├──────────────────────────┤
│                          │
│      [Camera Stream]     │
│      Apunta al QR        │
│                          │
├──────────────────────────┤
│ 🔴 Cámara activa...      │
└──────────────────────────┘
```

### Paso 3: Escanea

- Apunta el QR al centro del cuadro
- La app escanea **automáticamente**
- No necesitas presionar nada

### Paso 4: Resultado

El QR se procesa como si fuera de la pistola:
- Se busca el artículo
- Se muestra la información
- Puedes continuar con operaciones

---

## ✅ Requisitos

### Permisos
- ✅ La app solicita permiso de cámara
- ✅ Aprueba en el diálogo del navegador
- ❌ Si rechazas, el botón de cámara no funciona

### Dispositivo
- ✅ Móvil con cámara
- ✅ Navegador moderno (Chrome, Firefox, Safari)
- ❌ No funciona en navegadores muy antiguos

### Conexión
- ✅ Funciona con o sin WiFi
- ✅ Si estás offline, los QR se encolan (como operario)

---

## 🧪 Testing

### Test 1: Verificar scroll horizontal

1. Entra a una estantería ancha (ej: MEC con 50+ celdas)
2. Intenta deslizar a izquierda/derecha
3. Debe mostrar más celdas

### Test 2: Verificar cámara

**Carretillero:**
1. Login como Carretillero
2. Click en 📷 Cámara
3. Apunta a un código QR
4. Debe escanear automáticamente

**Jefe de Sección:**
1. Login como Jefe de Sección
2. En la vista operativa (click "Modo Operativo")
3. Click en 📷 Cámara
4. Debe funcionar igual

**Admin:**
1. Login como Admin
2. En el panel (ej: ShelfBrowser)
3. Click en 📷 Cámara
4. Debe funcionar igual

### Test 3: Cierre de cámara

1. Abre la cámara
2. Click en la X (arriba derecha)
3. Debe cerrar sin errores

---

## ⚙️ Detalles Técnicos

### Librería
- **html5-qrcode** v2.3.8
- Escaneo en tiempo real
- Soporte para todo tipo de códigos QR

### Cámara
- **Resolución:** 15 FPS (eficiente en móvil)
- **Caja de escaneo:** 250x250 px (centrada)
- **Cámara:** Trasera (environment) por defecto
- **Almacenamiento:** Recuerda última cámara usada

### Performance
- ✅ No interfiere con otras operaciones
- ✅ Scroll horizontal eficiente (sin lag)
- ✅ Detector de QR corre en background

---

## 🚀 Flujo Completo: Carretillero con Cámara

```
1. Login como Carretillero
   ↓
2. Ves vista de ESTANTERÍAS
   ↓
3. Click 📷 Cámara
   ↓
4. Se abre cámara
   ↓
5. Apuntas QR
   ↓
6. App escanea automáticamente
   ↓
7. Muestra artículo + información
   ↓
8. Cierra cámara automáticamente
   ↓
9. Puedes ubicar, retirar, etc.
   (igual que con pistola)
```

---

## ❌ Troubleshooting

### No aparece botón de cámara

- ✅ Verifica que estés logueado como Carretillero/Jefe/Admin
- ✅ Recarga la página

### Cámara no se abre

- ✅ Verifica permisos del navegador:
  - Chrome: Settings → Privacy → Camera
  - Firefox: Preferences → Privacy → Permissions
- ✅ Concede acceso a la cámara
- ✅ Recarga la página

### Escaneo no funciona

- ✅ Asegúrate de que el QR sea legible
- ✅ Acércate más al código
- ✅ Limpia la lente de la cámara
- ✅ Mejora la iluminación

### Scroll horizontal no aparece

- ✅ La estantería debe ser muy ancha (>6 celdas de ancho)
- ✅ Intenta deslizar más lentamente
- ✅ Verifica que no tengas zoom activo (pinch-to-zoom)

---

## 📊 Comparación: Pistola vs Cámara

| Aspecto | Pistola QR | Cámara Móvil |
|---------|-----------|--------------|
| **Hardware requerido** | Pistola específica | Móvil cualquiera |
| **Costo** | $$$ | Gratis (ya tienes móvil) |
| **Portabilidad** | Media | Alta |
| **Velocidad** | Rápida | Rápida |
| **Precisión** | Muy alta | Alta |
| **Batería** | Externa | Móvil |
| **Entrenamiento** | Sí | No |
| **Disponibilidad** | Limitada | Siempre disponible |

---

## 🎓 Casos de Uso

### Caso 1: Carretillero sin pistola

```
Escenario: Pistola se descarga
Solución: Usa cámara del móvil
Resultado: Puedes continuar trabajando
```

### Caso 2: Verificación rápida

```
Escenario: Necesitas verificar un artículo rápidamente
Solución: Abre cámara, escanea, cierra
Resultado: Información al instante
```

### Caso 3: Estantería ancha

```
Escenario: No ves todas las celdas
Solución: Desliza horizontalmente
Resultado: Ves todas las posiciones
```

---

## ✨ Ventajas

✅ **Más flexibilidad** — No depende de pistola QR  
✅ **Costo cero** — Ya tienes móvil  
✅ **Backup** — Si falla la pistola, tienes opción  
✅ **Experiencia mejorada** — Vistas completas de estanterías  
✅ **Fácil de usar** — Apunta y listo  

---

## 🎯 Próximas Mejoras

- [ ] Historial de QRs escaneados
- [ ] Búsqueda por voz
- [ ] Escaneo múltiple (batch)
- [ ] Integración con código de barras EAN

---

## 📞 Soporte

Si tienes problemas:
1. Verifica los requisitos (cámara, permisos)
2. Recarga la página
3. Limpia caché del navegador
4. Prueba en otro navegador
5. Reinicia el móvil

---

**¡La cámara está lista! 📷**

URL: https://gestion-de-estanterias.web.app

