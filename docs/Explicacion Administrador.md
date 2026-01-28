# Guía de Usuario - Administradores 🔧

## ¿Qué es esta aplicación?

Sistema de Gestión de Estanterías con **permisos completos** para administración, configuración y mantenimiento del inventario. Como **Administrador**, tienes acceso total al sistema.

---

## 🎯 Tus Permisos y Capacidades

Como Administrador, tienes **todos los permisos**:

- ✅ **Todas las funciones** de Carretilleros y Jefes
- ✅ **Editar estructura** de almacenes (crear/eliminar ubicaciones)
- ✅ **Gestionar usuarios** y roles
- ✅ **Analizar anomalías** en el inventario
- ✅ **Acceso al Panel de Administración** avanzado
- ✅ **Limpiar ubicaciones masivamente** (Admin Clear)
- ✅ **Omitir validaciones** de ubicación
- ✅ **Configurar almacenes** dinámicamente
- ✅ **Gestionar backups** del sistema
- ✅ **Exportar/Importar** datos completos

---

## 📋 Funcionalidades Principales

### 1️⃣ **Panel de Administración**

Accede haciendo clic en **⚙️ Configuración** en el menú superior.

El panel incluye múltiples pestañas:

#### **📊 Configuración de Almacenes**
- **Ver estructura actual**: Almacenes, estanterías, posiciones
- **Agregar nuevos almacenes**: Código, nombre, descripción
- **Modificar almacenes existentes**: Editar parámetros
- **Eliminar almacenes**: Con confirmación de seguridad

#### **👥 Gestión de Usuarios**
- **Lista de usuarios registrados**: UID, email, rol, sección
- **Asignar roles**:
  - **CARRETILLERO**: Operador de inventario
  - **JEFE**: Jefe de Sección (asociado a una sección específica)
  - **ADMIN**: Administrador completo
- **Asignar secciones** a Jefes:
  - MECANIZADO, PLEGADORA, SOLDADURA, REPASADO, LASER, ROBOT_PLEGADO, OTROS
- **Cambiar permisos** en tiempo real (se aplican inmediatamente)

#### **🧹 Limpieza Masiva (Admin Clear)**
- **Limpiar ubicaciones completas**: Vacía todas las posiciones de un almacén
- **Confirmación doble**: Evita borrados accidentales
- **Registro en historial**: Todas las acciones quedan registradas

#### **💾 Backup y Restauración**
- **Crear backups manuales**: Guarda el estado del inventario
- **Programar backups automáticos**: Configurables por frecuencia
- **Restaurar desde backup**: Recupera estados previos

#### **📥 Importación/Exportación**
- **Exportar inventario completo**: Excel, CSV, JSON
- **Importar datos masivos**: Subida de archivos estructurados
- **Validación de datos**: Comprueba integridad antes de importar

---

### 2️⃣ **Análisis de Anomalías**

Detecta problemas en el inventario:

**¿Qué detecta?**
- 🔴 **Artículos duplicados**: Mismo código en múltiples ubicaciones (sin justificación)
- 🔴 **Ubicaciones sobrecargadas**: Más artículos de los recomendados
- 🔴 **Artículos sin OF**: Pedidos no asociados (marcados como "PENDIENTE")
- 🔴 **Inconsistencias de sección**: Artículos en almacenes inadecuados

**¿Cómo acceder?**
1. Haz clic en **"Analizar Anomalías"** en el Panel de Admin
2. El sistema escaneará todo el inventario
3. Verás un reporte con:
   - Tipo de anomalía
   - Ubicación afectada
   - Artículo problemático
   - Sugerencia de acción

**Acciones posibles:**
- Marcar como **"Falso Positivo"** (si es intencional)
- **Resolver manualmente**: Mover o retirar el artículo
- **Generar reporte**: Exportar anomalías a Excel

---

### 3️⃣ **Editar Estructura de Almacenes**

Crear o modificar la configuración física:

**Agregar una nueva ubicación:**
1. Ve a **Panel Admin → Configuración de Almacenes**
2. Haz clic en **"Agregar Ubicación"**
3. Introduce:
   - **Código de Almacén** (ej: MEC, SOL)
   - **Estantería** (número)
   - **Balda** (número)
   - **Posición** (texto descriptivo, ej: "MEC 045")
4. Confirma

**Eliminar una ubicación:**
1. Selecciona la ubicación en la lista
2. Haz clic en **"Eliminar"**
3. ⚠️ **ADVERTENCIA**: Solo puedes eliminar ubicaciones **vacías**
4. Confirma la acción

---

### 4️⃣ **Gestión Avanzada de Usuarios**

**Ver detalles de un usuario:**
1. Panel Admin → **Gestión de Usuarios**
2. Haz clic en el usuario deseado
3. Verás:
   - UID (identificador único)
   - Email
   - Rol actual
   - Sección asignada (si es Jefe)
   - Última actividad

**Cambiar rol de un usuario:**
1. Selecciona el usuario
2. Menú desplegable **"Rol"**
3. Elige: CARRETILLERO, JEFE o ADMIN
4. Si es **JEFE**, asigna una **Sección**
5. Guarda cambios

**Eliminar un usuario** (desactivar):
1. Selecciona el usuario
2. Haz clic en **"Desactivar Usuario"**
3. El usuario perderá acceso al sistema (pero su UID se mantiene en BD)

---

### 5️⃣ **Funciones Operativas Estándar**

Como Admin, también puedes realizar todas las operaciones de Carretilleros y Jefes:

- **Asignar artículos** a ubicaciones
- **Mover artículos** entre ubicaciones
- **Retirar artículos** sin restricciones de sección
- **Atender solicitudes** de Jefes
- **Finalizar producción**
- **Exportar inventario** a Excel
- **Buscar y filtrar** artículos

**Ventaja especial**: **Omites validaciones automáticas** (puedes asignar sin escanear ubicación si es necesario).

---

### 6️⃣ **Configuración de Almacenes Dinámicos**

El sistema permite configurar almacenes personalizados:

**¿Qué se puede configurar?**
- **Código del almacén** (ej: MEC, SOL, NEW)
- **Nombre completo** (ej: "Mecanizado", "Soldadura")
- **Número de estanterías** por almacén
- **Posiciones por estantería**
- **Tipos de embalaje permitidos**

**¿Cómo configurar?**
1. Panel Admin → **Configuración de Almacenes**
2. Haz clic en **"Editar Configuración"**
3. Modifica los parámetros dinámicos
4. Guarda los cambios (se aplicarán inmediatamente)

---

### 7️⃣ **Historial y Auditoría**

Acceso completo al registro de actividad:

**¿Qué se registra?**
- ✅ Asignaciones de artículos
- ✅ Movimientos entre ubicaciones
- ✅ Retiros de inventario
- ✅ Solicitudes de Jefes
- ✅ Producción finalizada
- ✅ Acciones de administración (limpiezas masivas, cambios de rol)

**Filtros disponibles:**
- Por **usuario** (quién hizo la acción)
- Por **fecha** (rango temporal)
- Por **tipo de acción** (asignación, movimiento, retiro, etc.)
- Por **artículo** (código de barras específico)

---

## 🏭 Secciones y Almacenes

Estructura organizativa del sistema:

| **Sección** | **Almacenes** | **Descripción** |
|------------|-------------|----------------|
| **MECANIZADO** | MEC | Piezas mecanizadas |
| **PLEGADORA** | PLE, RPL | Plegado manual y robotizado |
| **SOLDADURA** | SOL, RSO, SXP | Soldadura, robot, puntos |
| **REPASADO** | REP, PIN, ZIN | Acabados, pintura, zincado |
| **LASER** | LAS | Corte láser |
| **OTROS** | CAL, COM | Calidad, comodín |

---

## 💡 Casos de Uso Comunes

### ✅ **Necesito crear un nuevo almacén**
1. Panel Admin → **Configuración de Almacenes**
2. Haz clic en **"Agregar Almacén"**
3. Introduce código (ej: "NEW"), nombre ("Nuevo Almacén")
4. Define estanterías y posiciones
5. Guarda

### ✅ **Un usuario no tiene los permisos correctos**
1. Panel Admin → **Gestión de Usuarios**
2. Localiza al usuario (busca por email)
3. Cambia su **Rol** (CARRETILLERO → JEFE → ADMIN)
4. Si es Jefe, asigna su **Sección**
5. Guarda cambios

### ✅ **Hay demasiados errores en el inventario**
1. Usa **"Analizar Anomalías"**
2. Revisa el reporte generado
3. Resuelve manualmente o marca falsos positivos
4. Exporta un Excel con las anomalías pendientes

### ✅ **Necesito limpiar un almacén completo**
1. Panel Admin → **Limpieza Masiva**
2. Selecciona el almacén (ej: MEC)
3. Confirma **dos veces** (seguridad)
4. Todas las ubicaciones quedarán vacías (se registrará en historial)

### ✅ **Quiero hacer un backup antes de cambios importantes**
1. Panel Admin → **Backup y Restauración**
2. Haz clic en **"Crear Backup Manual"**
3. Asigna un nombre descriptivo (ej: "Pre-Reorg-MEC")
4. Confirma
5. El backup se guardará en Firebase

---

## 🔒 Seguridad y Buenas Prácticas

1. **No compartas credenciales** de Administrador
2. **Crea backups regulares** antes de operaciones masivas
3. **Verifica dos veces** antes de limpiar ubicaciones
4. **Audita el historial** para detectar comportamientos anómalos
5. **Asigna roles mínimos necesarios** (principio de menor privilegio)
6. **Documenta cambios críticos** en la estructura de almacenes

---

## 🛠️ Funciones Técnicas Avanzadas

### **Modo "Omitir Validación"**
Como Admin, puedes asignar artículos sin escanear la ubicación física:
1. Haz clic en "Asignar"
2. Introduce manualmente el artículo y la ubicación
3. El sistema **no pedirá validación** (útil para correcciones rápidas)

### **Relocate Location Contents**
Mueve **todo el contenido** de una ubicación a otra:
1. Selecciona la ubicación origen
2. Haz clic en **"Relocate All"**
3. Escanea o introduce la ubicación destino
4. Todos los artículos se moverán automáticamente

### **Empty Shelf**
Vacía una **estantería completa** (todas las posiciones):
1. Haz clic en el menú de la estantería
2. Selecciona **"Empty Shelf"**
3. Confirma (doble verificación)
4. Todas las posiciones quedarán vacías

---

## 📊 Reportes y Exportación

### **Tipos de exportación disponibles:**
- **Excel estándar**: Inventario actual completo
- **Excel por almacén**: Solo un almacén específico
- **Historial completo**: Todas las acciones registradas
- **Anomalías**: Reporte de errores detectados
- **Usuarios y roles**: Lista de permisos actuales

---

## 🆘 Soporte y Resolución de Problemas

### **Problema: Un usuario no puede acceder**
- Verifica su **rol en Gestión de Usuarios**
- Confirma que tiene **email verificado** en Firebase
- Revisa los **logs del sistema** (si están disponibles)

### **Problema: Artículos duplicados sin explicación**
- Usa **"Analizar Anomalías"**
- Revisa el **Historial** para ver quién los asignó
- Consolida manualmente o retira duplicados

### **Problema: Necesito restaurar el inventario de ayer**
- Panel Admin → **Backup y Restauración**
- Selecciona el backup del día anterior
- Haz clic en **"Restaurar"** (esto **sobrescribirá** el inventario actual)

### **Problema: El sistema está lento**
- Limpia **ubicaciones vacías** innecesarias
- Archiva **historial antiguo** (si excede 1000 entradas)
- Contacta al administrador técnico para optimización de base de datos

---

## 🚀 Funcionalidades Futuras (Roadmap)

- 🔄 **Sincronización offline**: Trabajar sin conexión
- 📊 **Dashboard Analytics**: Métricas de uso y eficiencia
- 📱 **App móvil nativa**: Para dispositivos Android/iOS
- 🤖 **IA para predicción de ubicaciones**: Sugerencias automáticas
- 🔔 **Notificaciones push**: Alertas en tiempo real

---

**Versión del sistema**: 2.0  
**Última actualización**: Enero 2026  
**Soporte técnico**: Administrador del sistema
